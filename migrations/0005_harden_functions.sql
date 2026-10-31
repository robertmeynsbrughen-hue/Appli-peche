-- 0005 : durcissement des fonctions SECURITY DEFINER
--
-- Audit du 31/10/2026. Deux points corriges, sans changement de comportement :
--
-- 1. search_path : ajoute pg_temp en dernier la ou il manque, sur le modele des
--    fonctions ecrites apres la baseline (0002+). Sans pg_temp en dernier, un
--    utilisateur connecte peut creer une table temporaire qui masque une table
--    publique non qualifiee. Aucune fonction n'utilise de reference non qualifiee
--    aujourd'hui, le risque est donc latent, mais la correction est gratuite.
--
-- 2. Acces anonyme : create_group_invite et redeem_invite etaient ouvertes a
--    PUBLIC (ACL « =X/postgres »), donc a anon, alors qu'elles exigent deja une
--    session et l'appartenance au groupe. On retire l'acces anonyme ; les roles
--    authenticated et service_role conservent le leur.
--
-- Rejouable sans erreur (conforme a migrations/README.md).

do $do$
declare
  r record;
begin
  for r in
    select n.nspname                as schema_name,
           p.proname                as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') = 'search_path=public'
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      r.schema_name, r.function_name, r.args
    );
  end loop;
end
$do$;

revoke execute on function public.create_group_invite(bigint) from public;
revoke execute on function public.create_group_invite(bigint) from anon;

revoke execute on function public.redeem_invite(text) from public;
revoke execute on function public.redeem_invite(text) from anon;

grant execute on function public.create_group_invite(bigint) to authenticated, service_role;
grant execute on function public.redeem_invite(text) to authenticated, service_role;

insert into public.schema_migrations (version)
values ('0005_harden_functions')
on conflict do nothing;
