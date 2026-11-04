-- 0029 — Conseils : « ce que disent vos bilans » calculé par la base
--
-- Avant : chaque téléphone téléchargeait jusqu'à 2 000 sorties et 2 000 prises
-- avec leurs conditions pour trouver, espèce par espèce, les sorties faites
-- dans des conditions proches. Au-delà, le bilan était incomplet.
-- Maintenant la base fait le même calcul et ne renvoie qu'une ligne par espèce.
-- SECURITY INVOKER : les règles d'accès décident toujours de ce que le membre
-- peut voir (ses groupes uniquement). Rejouable sans erreur.

create or replace function public.advice_history(
  p_water double precision, p_dp double precision, p_wind double precision, p_cloud double precision,
  p_phase text default null, p_lat double precision default null, p_lon double precision default null)
returns table (species text, n integer, caught integer, succ double precision)
language sql stable security invoker set search_path = ''
as $$
  with num as (
    select lower(s.species) as sp, s.caught is distinct from false as ok, coalesce(s.rating, 2)::double precision as r, s.conditions as c
      from public.sessions s
     where s.conditions is not null and s.species is not null and jsonb_typeof(s.conditions) = 'object'
    union all
    select lower(p.species), true, 3, p.conditions
      from public.posts p
     where p.status = 'published' and p.conditions is not null and p.species is not null and jsonb_typeof(p.conditions) = 'object'
  ), v as (
    select sp, ok, r,
           case when jsonb_typeof(c -> 'water') = 'number' then (c ->> 'water')::double precision end as water,
           case when jsonb_typeof(c -> 'dp') = 'number' then (c ->> 'dp')::double precision end as dp,
           case when jsonb_typeof(c -> 'wind') = 'number' then (c ->> 'wind')::double precision end as wind,
           case when jsonb_typeof(c -> 'cloud') = 'number' then (c ->> 'cloud')::double precision end as cloud,
           nullif(c ->> 'phase', '') as phase,
           case when jsonb_typeof(c -> 'lat') = 'number' then (c ->> 'lat')::double precision end as lat,
           case when jsonb_typeof(c -> 'lon') = 'number' then (c ->> 'lon')::double precision end as lon
      from num
  ), d as (
    select sp, ok, r,
           abs(coalesce(water, p_water) - p_water) / 3
           + abs(coalesce(dp, 0) - p_dp) / 2
           + abs(coalesce(wind, p_wind) - p_wind) / 15
           + abs(coalesce(cloud, p_cloud) - p_cloud) / 60
           + case when phase is not null and phase is distinct from p_phase then 0.5 else 0 end
           + case when lat is not null and lon is not null and p_lat is not null and p_lon is not null
                   and 2 * 6371 * asin(sqrt(power(sin(radians(p_lat - lat) / 2), 2)
                         + cos(radians(lat)) * cos(radians(p_lat)) * power(sin(radians(p_lon - lon) / 2), 2))) > 30
                  then 1 else 0 end as dist
      from v
  ), ranked as (
    select sp, ok, r, row_number() over (partition by sp order by dist) as rn
      from d where dist < 2.5
  )
  select sp, count(*)::integer, (count(*) filter (where ok))::integer,
         avg(case when ok then r / 4 else 0 end)
    from ranked where rn <= 8 group by sp
$$;

revoke all on function public.advice_history(double precision, double precision, double precision, double precision, text, double precision, double precision) from public, anon;
grant execute on function public.advice_history(double precision, double precision, double precision, double precision, text, double precision, double precision) to authenticated;

insert into public.schema_migrations (version, notes)
values ('0029_historique_leger', 'bilans « conditions proches » calculés par la base au lieu du téléphone')
on conflict (version) do nothing;
