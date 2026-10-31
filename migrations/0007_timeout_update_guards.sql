-- 0007 : étend les garde-fous des sanctions temporaires aux modifications
--
-- La migration 0006 bloquait la *création* de prises, commentaires et messages.
-- Un membre suspendu pouvait donc encore modifier un contenu existant lorsque
-- la policy RLS l'autorisait (c'était le cas de `memos`, et de `reports` pour
-- les modérateurs), ou écrire dans d'autres tables de contenu partagé.
--
-- Cette migration :
--   * remplace `timeout_guard` par un trigger BEFORE INSERT OR UPDATE sur
--     posts / comments / messages / staff_messages ;
--   * ajoute le même garde-fou INSERT + UPDATE sur les contenus partagés
--     (memos, env_reports, polls, outings, spots, tracks) ;
--   * ajoute un garde-fou INSERT sur reports (signalement = écriture) ;
--   * publie `timeout_schema_version()` pour que l'application puisse vérifier
--     que la base applique bien ces règles.
--
-- `enforce_timeout()` ne bloque que les lignes dont `user_id` est l'auteur de
-- l'action (`auth.uid()`). Les mises à jour faites par un modérateur sur le
-- contenu d'un autre membre passent donc normalement.
--
-- Migration rejouable sans erreur (conforme à migrations/README.md).
-- À appliquer séparément, hors déploiement automatique.

begin;

-- La fonction de garde vient de 0006 : message clair si elle manque.
do $$
begin
  if to_regprocedure('public.enforce_timeout()') is null then
    raise exception
      '0007 nécessite la migration 0006_timeouts.sql (fonction public.enforce_timeout absente)';
  end if;
end $$;

-- Trigger unique et rejouable sur chaque table de contenu.
do $$
declare
  t text;
begin
  foreach t in array array[
    'posts', 'comments', 'messages', 'staff_messages',
    'memos', 'env_reports', 'polls', 'outings', 'spots', 'tracks'
  ] loop
    execute format('drop trigger if exists timeout_guard on public.%I', t);
    execute format(
      'create trigger timeout_guard before insert or update on public.%I '
      'for each row execute function public.enforce_timeout()',
      t
    );
  end loop;

  -- Un signalement est une écriture : on le bloque à la création.
  -- (La mise à jour d'un signalement est réservée aux modérateurs, et
  --  `enforce_timeout()` ne regarde que les lignes de l'auteur de l'action.)
  execute 'drop trigger if exists timeout_guard on public.reports';
  execute 'create trigger timeout_guard before insert on public.reports '
          'for each row execute function public.enforce_timeout()';
end $$;

comment on trigger timeout_guard on public.posts is
  'Sanction temporaire : bloque creation et modification des prises.';
comment on trigger timeout_guard on public.memos is
  'Sanction temporaire : bloque creation et modification des memoires de groupe.';

-- L'application lit cette version pour afficher l'état réel des garde-fous.
create or replace function public.timeout_schema_version()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select '0007'::text;
$$;

revoke execute on function public.timeout_schema_version() from public, anon;
grant execute on function public.timeout_schema_version() to authenticated, service_role;

insert into public.schema_migrations (version, notes)
values (
  '0007_timeout_update_guards',
  'sanctions temporaires : garde-fous INSERT+UPDATE sur les contenus, version de schéma'
)
on conflict (version) do nothing;

commit;
