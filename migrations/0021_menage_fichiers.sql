-- 0021 — Ménage des photos, avatars et vocaux (plan de reprise, étape 5)
--
-- Avant : supprimer une prise, un message, un compte ou changer d'avatar
-- effaçait la ligne en base mais laissait le fichier dans le stockage.
-- Maintenant :
--   - chaque suppression (ou remplacement) met les anciens fichiers en file
--     d'attente (public.storage_purge) et déclenche aussitôt la fonction
--     « notify » qui les efface par l'API Storage (la suppression directe en SQL
--     est interdite par Supabase) ;
--   - chaque nuit, un balayage efface aussi les fichiers qui ne sont plus
--     référencés nulle part depuis plus de 24 h (rattrapage : envoi interrompu,
--     groupe supprimé…). Les 24 h protègent un envoi en cours : le fichier part
--     avant la ligne qui le référence.
-- Un fichier encore référencé ailleurs n'est jamais effacé.
-- Rejouable sans erreur.

create table if not exists public.storage_purge (
  id bigint generated always as identity primary key,
  name text not null,
  queued_at timestamptz not null default now(),
  done_at timestamptz,
  attempts int not null default 0,
  error text
);
alter table public.storage_purge enable row level security;
revoke all on table public.storage_purge from anon, authenticated;
create index if not exists storage_purge_pending on public.storage_purge (queued_at) where done_at is null;

-- Tous les chemins de fichiers encore utilisés par l'application.
create or replace function public.file_refs()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select unnest(coalesce(photo_paths, '{}'::text[])) from public.posts
  union select photo_path from public.posts
  union select photo_path from public.messages
  union select audio_path from public.messages
  union select photo_path from public.staff_messages
  union select audio_path from public.staff_messages
  union select photo_path from public.memos
  union select photo_path from public.env_reports
  union select photo_path from public.lures
  union select photo_path from public.bug_reports
  union select avatar_path from public.profiles
$$;

-- Chemins de fichiers d'une ligne (colonnes photo_path, audio_path, avatar_path, photo_paths).
create or replace function public.row_file_paths(r jsonb)
returns setof text
language sql
immutable
set search_path = ''
as $$
  select x from (
    select r ->> k as x from unnest(array['photo_path', 'audio_path', 'avatar_path']) as k
    union
    select jsonb_array_elements_text(case when jsonb_typeof(r -> 'photo_paths') = 'array' then r -> 'photo_paths' else '[]'::jsonb end)
  ) a
  where x is not null and x <> ''
$$;

-- Ligne supprimée ou fichier remplacé : les anciens chemins partent en file d'attente.
create or replace function public.queue_file_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.storage_purge (name)
  select p from public.row_file_paths(to_jsonb(OLD)) p
  except
  select p from public.row_file_paths(case when TG_OP = 'UPDATE' then to_jsonb(NEW) else '{}'::jsonb end) p;
  return null;
end
$$;

-- Fin de l'instruction : s'il y a des fichiers en attente, on réveille la fonction de ménage.
create or replace function public.kick_file_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.storage_purge where done_at is null and attempts < 5) then
    perform public.call_notify('{"table":"purge"}'::jsonb);
  end if;
  return null;
end
$$;

do $$
declare t record;
begin
  for t in select * from (values
      ('posts', 'photo_path, photo_paths'),
      ('messages', 'photo_path, audio_path'),
      ('staff_messages', 'photo_path, audio_path'),
      ('memos', 'photo_path'),
      ('env_reports', 'photo_path'),
      ('lures', 'photo_path'),
      ('bug_reports', 'photo_path'),
      ('profiles', 'avatar_path')) as v(tbl, cols)
  loop
    execute format('drop trigger if exists %I on public.%I', t.tbl || '_file_purge', t.tbl);
    execute format('create trigger %I after delete or update of %s on public.%I for each row execute function public.queue_file_purge()',
                   t.tbl || '_file_purge', t.cols, t.tbl);
    execute format('drop trigger if exists %I on public.%I', t.tbl || '_file_purge_kick', t.tbl);
    execute format('create trigger %I after delete or update of %s on public.%I for each statement execute function public.kick_file_purge()',
                   t.tbl || '_file_purge_kick', t.cols, t.tbl);
  end loop;
end $$;

-- Liste des fichiers à effacer, appelée par la fonction « notify » (rôle service uniquement).
-- Les fichiers déjà absents du stockage ou de nouveau référencés sont simplement clos.
create or replace function public.purge_candidates(p_sweep boolean default false)
returns table (id bigint, bucket text, name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.storage_purge q set done_at = now(), error = 'déjà absent ou encore utilisé'
   where q.done_at is null
     and (not exists (select 1 from storage.objects o where o.name = q.name)
          or q.name in (select f from public.file_refs() f where f is not null));

  return query
    select q.id, o.bucket_id::text, o.name::text
      from public.storage_purge q
      join storage.objects o on o.name = q.name
     where q.done_at is null and q.attempts < 5
    union
    select null::bigint, o.bucket_id::text, o.name::text
      from storage.objects o
     where p_sweep
       and o.bucket_id in ('photos', 'avatars', 'staff-media', 'bugs')
       and o.created_at < now() - interval '24 hours'
       and o.name not in (select f from public.file_refs() f where f is not null);
end
$$;

create or replace function public.purge_done(p_ids bigint[], p_ok boolean, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.storage_purge
     set attempts = attempts + 1,
         done_at = case when p_ok then now() else done_at end,
         error = p_error
   where id = any(p_ids)
$$;

revoke all on function public.file_refs() from public, anon, authenticated;
revoke all on function public.row_file_paths(jsonb) from public, anon, authenticated;
revoke all on function public.queue_file_purge() from public, anon, authenticated;
revoke all on function public.kick_file_purge() from public, anon, authenticated;
revoke all on function public.purge_candidates(boolean) from public, anon, authenticated;
revoke all on function public.purge_done(bigint[], boolean, text) from public, anon, authenticated;
grant execute on function public.purge_candidates(boolean) to service_role;
grant execute on function public.purge_done(bigint[], boolean, text) to service_role;

-- Balayage de rattrapage chaque nuit.
select cron.schedule('cdj-menage-fichiers', '47 3 * * *', $c$ select public.call_notify('{"table":"purge","sweep":true}'::jsonb) $c$);

insert into public.schema_migrations (version, notes)
values ('0021_menage_fichiers', 'effacement immédiat des fichiers supprimés ou remplacés, balayage nocturne des fichiers orphelins')
on conflict (version) do nothing;
