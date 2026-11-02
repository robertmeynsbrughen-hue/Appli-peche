-- 0022 — Le ménage du stockage passe par sa propre fonction Supabase « menage »
--
-- call_notify(payload) appelle désormais la fonction nommée dans payload.fn
-- (par défaut « notify », comme avant). Le corps de call_notify contient le
-- secret et la clé publique du projet : on ne le réécrit pas ici, on modifie
-- seulement son adresse d'appel, en place, à partir de sa définition actuelle.
-- Rejouable sans erreur.

do $$
declare d text;
begin
  select pg_get_functiondef('public.call_notify(jsonb)'::regprocedure) into d;
  if position('payload->>''fn''' in d) = 0 then
    d := regexp_replace(d, '''(https://[a-z0-9]+\.supabase\.co/functions/v1/)notify''',
                        '''\1'' || coalesce(payload->>''fn'', ''notify'')');
    if position('payload->>''fn''' in d) = 0 then
      raise exception 'call_notify : adresse d''appel introuvable, rien n''est modifié';
    end if;
    execute d;
  end if;
end $$;

create or replace function public.kick_file_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.storage_purge where done_at is null and attempts < 5) then
    perform public.call_notify('{"table":"purge","fn":"menage"}'::jsonb);
  end if;
  return null;
end
$$;
revoke all on function public.kick_file_purge() from public, anon, authenticated;

select cron.schedule('cdj-menage-fichiers', '47 3 * * *', $c$ select public.call_notify('{"table":"purge","sweep":true,"fn":"menage"}'::jsonb) $c$);

insert into public.schema_migrations (version, notes)
values ('0022_menage_fonction', 'ménage du stockage par la fonction menage ; call_notify choisit la fonction appelée')
on conflict (version) do nothing;
