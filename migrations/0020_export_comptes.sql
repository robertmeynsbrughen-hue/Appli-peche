-- 0020 — Export des comptes pour la sauvegarde externe
--
-- Supabase ne permet pas de donner au rôle rivio_backup l'accès direct au
-- schéma auth. Cette fonction, exécutable uniquement par rivio_backup, renvoie
-- en lecture seule les comptes (auth.users) et leurs identités (auth.identities)
-- pour qu'ils figurent dans l'archive chiffrée. Personne d'autre ne peut l'appeler.
-- Rejouable sans erreur.

create or replace function backup.auth_export()
returns table (tbl text, data jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select 'auth.users', to_jsonb(u) from auth.users u
  union all
  select 'auth.identities', to_jsonb(i) from auth.identities i
$$;

revoke all on function backup.auth_export() from public, anon, authenticated;
grant usage on schema backup to rivio_backup;
grant execute on function backup.auth_export() to rivio_backup;

-- l'accès direct accordé par 0019 est inopérant (pas d'usage du schéma auth) : on le retire
revoke select on auth.users, auth.identities from rivio_backup;

insert into public.schema_migrations(version, notes)
values ('0020_export_comptes', 'export des comptes réservé au rôle de sauvegarde')
on conflict (version) do nothing;
