-- 0003_group_management_staff_chat
-- Suppression sûre des groupes, transmission du rôle responsable et chat staff isolé.

create table if not exists public.staff_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body        text,
  photo_path  text,
  audio_path  text,
  audio_secs  integer,
  created_at  timestamptz not null default now(),
  constraint staff_messages_body_len check (body is null or char_length(body) between 1 and 1000),
  constraint staff_messages_not_empty check (body is not null or photo_path is not null or audio_path is not null),
  constraint staff_messages_photo_path check (photo_path is null or left(photo_path, length(user_id::text || '/')) = user_id::text || '/'),
  constraint staff_messages_audio_path check (audio_path is null or left(audio_path, length(user_id::text || '/')) = user_id::text || '/'),
  constraint staff_messages_audio_secs check (audio_secs is null or audio_secs between 1 and 120)
);

create index if not exists staff_messages_time on public.staff_messages (created_at desc);
alter table public.staff_messages enable row level security;

revoke all on public.staff_messages from public, anon;
grant select, insert, delete on public.staff_messages to authenticated;
grant usage, select on sequence public.staff_messages_id_seq to authenticated;

drop policy if exists staff_messages_select on public.staff_messages;
create policy staff_messages_select on public.staff_messages for select to authenticated
  using (public.is_staff());
drop policy if exists staff_messages_insert on public.staff_messages;
create policy staff_messages_insert on public.staff_messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_staff());
drop policy if exists staff_messages_delete on public.staff_messages;
create policy staff_messages_delete on public.staff_messages for delete to authenticated
  using (user_id = auth.uid() and public.is_staff());

-- Bucket privé distinct : les règles du bucket photos existant n'acceptent que
-- les images et les membres ordinaires ne doivent jamais pouvoir lire ces médias.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-media', 'staff-media', false, 5242880,
        array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/ogg'])
on conflict (id) do nothing;

drop policy if exists staff_media_select on storage.objects;
create policy staff_media_select on storage.objects for select to authenticated
  using (bucket_id = 'staff-media' and public.is_staff());
drop policy if exists staff_media_insert on storage.objects;
create policy staff_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_staff());
drop policy if exists staff_media_delete on storage.objects;
create policy staff_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'staff-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_staff());

-- Autorise le dernier nettoyage des photos après la suppression en base : le
-- responsable perd alors son adhésion, mais doit encore pouvoir retirer les
-- objets Storage liés au groupe. Le droit temporaire est lié à l'utilisateur.
create table if not exists public.group_delete_cleanup (
  group_id   bigint not null,
  user_id    uuid not null,
  expires_at timestamptz not null,
  primary key (group_id, user_id)
);
alter table public.group_delete_cleanup enable row level security;
revoke all on public.group_delete_cleanup from public, anon, authenticated;

create or replace function public.can_cleanup_group_photo(p_path text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_delete_cleanup c
     where c.group_id = public.photo_group(p_path)
       and c.user_id = auth.uid()
       and c.expires_at > now()
  );
$$;
revoke all on function public.can_cleanup_group_photo(text) from public, anon;
grant execute on function public.can_cleanup_group_photo(text) to authenticated;

drop policy if exists photos_cleanup_select on storage.objects;
create policy photos_cleanup_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.can_cleanup_group_photo(name));
drop policy if exists photos_cleanup_delete on storage.objects;
create policy photos_cleanup_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.can_cleanup_group_photo(name));

create or replace function public.finish_group_delete_cleanup(p_group bigint)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from storage.objects
              where bucket_id = 'photos'
                and name like p_group::text || '/%') then
    raise exception 'des photos du groupe restent à nettoyer';
  end if;
  delete from public.group_delete_cleanup where group_id = p_group and user_id = auth.uid();
  if not found then raise exception 'nettoyage introuvable ou non autorisé'; end if;
end $$;
revoke all on function public.finish_group_delete_cleanup(bigint) from public, anon;
grant execute on function public.finish_group_delete_cleanup(bigint) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'staff_messages'
     ) then
    alter publication supabase_realtime add table public.staff_messages;
  end if;
end $$;

create or replace function public.delete_group(p_group bigint, p_confirmation text)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_name text;
begin
  if auth.uid() is null then raise exception 'non authentifié'; end if;
  select name into v_name from public.groups where id = p_group for update;
  if not found then raise exception 'groupe introuvable'; end if;
  if not public.can_manage(p_group) then raise exception 'non autorisé'; end if;
  if p_confirmation is distinct from v_name then raise exception 'confirmation du nom incorrecte'; end if;

  insert into public.group_delete_cleanup (group_id, user_id, expires_at)
  values (p_group, auth.uid(), now() + interval '24 hours')
  on conflict (group_id, user_id) do update set expires_at = excluded.expires_at;
  delete from public.groups where id = p_group;
end $$;

create or replace function public.leave_group(
  p_group bigint,
  p_successor uuid default null,
  p_confirmation text default null
)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_role text;
  v_successor_role text;
  v_active_count integer;
begin
  if auth.uid() is null then raise exception 'non authentifié'; end if;
  select name into v_name from public.groups where id = p_group for update;
  if not found then raise exception 'groupe introuvable'; end if;

  select role into v_role from public.memberships
   where group_id = p_group and user_id = auth.uid() and status = 'active' for update;
  if v_role is null then raise exception 'adhésion active introuvable'; end if;

  if v_role <> 'owner' then
    delete from public.memberships where group_id = p_group and user_id = auth.uid();
    return 'left';
  end if;

  perform 1 from public.memberships where group_id = p_group and status = 'active' for update;
  select count(*) into v_active_count from public.memberships where group_id = p_group and status = 'active';

  if v_active_count = 1 then
    if p_confirmation is distinct from v_name then raise exception 'confirmation du nom incorrecte'; end if;
    perform public.delete_group(p_group, p_confirmation);
    return 'deleted';
  end if;

  if p_successor is null or p_successor = auth.uid() then
    raise exception 'désigne un successeur parmi les membres actifs';
  end if;
  select role into v_successor_role from public.memberships
   where group_id = p_group and user_id = p_successor and status = 'active' for update;
  if not found then raise exception 'le successeur doit être un membre actif du groupe'; end if;

  if v_successor_role <> 'owner' then
    update public.memberships set role = 'owner'
     where group_id = p_group and user_id = p_successor and status = 'active';
  end if;
  delete from public.memberships where group_id = p_group and user_id = auth.uid();
  return 'left';
end $$;

revoke all on function public.delete_group(bigint, text) from public, anon;
grant execute on function public.delete_group(bigint, text) to authenticated;
revoke all on function public.leave_group(bigint, uuid, text) from public, anon;
grant execute on function public.leave_group(bigint, uuid, text) to authenticated;

insert into public.schema_migrations (version, notes)
values ('0003_group_management_staff_chat', 'suppression de groupe, transmission du responsable et chat staff protégé')
on conflict (version) do nothing;
