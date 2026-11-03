-- 0028 — Réponse légère pour la carte de chaleur
--
-- La carte n'utilise que le premier point de chaque trace. Ne renvoie donc pas
-- tout le JSON des traces (jusqu'à 20 000 points par trace) au navigateur.
-- La fonction reste SECURITY INVOKER : les règles RLS des sessions et des
-- traces continuent de décider quelles données le membre peut voir.

create or replace function public.heatmap_track_starts(p_group_id bigint default null)
returns table (lat double precision, lon double precision, species text, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case jsonb_typeof(t.points -> 0)
      when 'array' then nullif(t.points -> 0 ->> 0, '')::double precision
      when 'object' then nullif(t.points -> 0 ->> 'lat', '')::double precision
    end as lat,
    case jsonb_typeof(t.points -> 0)
      when 'array' then nullif(t.points -> 0 ->> 1, '')::double precision
      when 'object' then coalesce(
        nullif(t.points -> 0 ->> 'lon', ''),
        nullif(t.points -> 0 ->> 'lng', '')
      )::double precision
    end as lon,
    s.species,
    s.created_at
  from public.sessions s
  join public.tracks t on t.id = s.track_id
  where s.caught
    and s.track_id is not null
    and jsonb_array_length(t.points) > 0
    and (p_group_id is null or s.group_id = p_group_id)
  order by s.created_at desc
  limit 2000
$$;

revoke all on function public.heatmap_track_starts(bigint) from public, anon, authenticated;
grant execute on function public.heatmap_track_starts(bigint) to authenticated;

insert into public.schema_migrations (version, notes)
values ('0028_carte_chaleur_leger', 'la carte de chaleur ne récupère que le premier point de chaque trace')
on conflict (version) do nothing;
