-- 0030 — Import du sondeur, planning des postes, sessions carpe en direct
--
-- 1. depth_points.import_name : les relevés importés d'un fichier de sondeur
--    (Deeper, Garmin…) portent le nom de l'import, pour les afficher légers et
--    pouvoir supprimer un import entier.
-- 2. spot_bookings : qui pêche sur quel poste, et quand. Lecture par les membres
--    du groupe ; chacun réserve pour lui-même, sur un poste de son groupe.
-- 3. Temps réel : les sessions carpe et leurs événements sont diffusés aux
--    membres du groupe (les règles d'accès s'appliquent). Rejouable sans erreur.

alter table public.depth_points add column if not exists import_name text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'depth_points_import_name_len') then
    alter table public.depth_points add constraint depth_points_import_name_len check (import_name is null or char_length(import_name) <= 80);
  end if;
end $$;
create index if not exists depth_points_import_idx on public.depth_points (group_id, import_name) where import_name is not null;

create table if not exists public.spot_bookings (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  spot_id bigint not null references public.spots (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  rods smallint check (rods is null or rods between 1 and 4),
  note text check (note is null or char_length(note) <= 160),
  created_at timestamptz not null default now(),
  constraint spot_bookings_period check (ends_at > starts_at and ends_at - starts_at <= interval '7 days')
);
create index if not exists spot_bookings_group_idx on public.spot_bookings (group_id, ends_at);
create index if not exists spot_bookings_spot_idx on public.spot_bookings (spot_id, starts_at);
create index if not exists spot_bookings_user_idx on public.spot_bookings (user_id);

alter table public.spot_bookings enable row level security;
revoke all on public.spot_bookings from anon;
grant select, insert, delete on public.spot_bookings to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'spot_bookings' and policyname = 'spot_bookings_select') then
    create policy spot_bookings_select on public.spot_bookings for select to authenticated
      using (public.is_staff() or public.is_member_of(group_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'spot_bookings' and policyname = 'spot_bookings_insert') then
    create policy spot_bookings_insert on public.spot_bookings for insert to authenticated
      with check (user_id = (select auth.uid()) and public.is_member_of(group_id)
                  and exists (select 1 from public.spots s where s.id = spot_id and s.group_id = spot_bookings.group_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'spot_bookings' and policyname = 'spot_bookings_delete') then
    create policy spot_bookings_delete on public.spot_bookings for delete to authenticated
      using (user_id = (select auth.uid()) or public.can_moderate(group_id));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'timeout_guard' and tgrelid = 'public.spot_bookings'::regclass) then
    create trigger timeout_guard before insert or update on public.spot_bookings for each row execute function public.enforce_timeout();
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'carp_events') then
      alter publication supabase_realtime add table public.carp_events;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'carp_sessions') then
      alter publication supabase_realtime add table public.carp_sessions;
    end if;
  end if;
end $$;

insert into public.schema_migrations (version, notes)
values ('0030_sondeur_postes_direct', 'import du sondeur, planning des postes, sessions carpe en direct')
on conflict (version) do nothing;
