-- 0019 — Rôle de lecture seule pour la sauvegarde externe
--
-- La sauvegarde quotidienne (.github/workflows/sauvegarde.yml) se connecte avec
-- ce rôle plutôt qu'avec le compte postgres : il peut tout LIRE (y compris les
-- lignes protégées par RLS, d'où bypassrls) mais ne peut rien modifier.
--
-- Le mot de passe n'est PAS dans ce fichier (dépôt public). Après application,
-- Robert le définit lui-même dans l'éditeur SQL de Supabase :
--   alter role rivio_backup password '<mot de passe long et unique>';
-- Sans mot de passe, le rôle ne peut pas se connecter.
-- Rejouable sans erreur.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'rivio_backup') then
    create role rivio_backup login bypassrls nocreatedb nocreaterole noinherit;
  end if;
end $$;

alter role rivio_backup set default_transaction_read_only = on;
alter role rivio_backup set statement_timeout = '10min';

grant usage on schema public, auth, storage, cron to rivio_backup;
grant select on all tables in schema public to rivio_backup;
grant select on all sequences in schema public to rivio_backup;
grant select on auth.users, auth.identities, storage.buckets, storage.objects, cron.job to rivio_backup;

-- les tables créées plus tard par les migrations sont lisibles automatiquement
alter default privileges in schema public grant select on tables to rivio_backup;
alter default privileges in schema public grant select on sequences to rivio_backup;

insert into public.schema_migrations(version, notes)
values ('0019_role_sauvegarde', 'rôle rivio_backup en lecture seule pour la sauvegarde externe chiffrée')
on conflict (version) do nothing;
