-- Rivio 0.68 : sanctions complètes.
-- Décisions du 2 novembre 2026 :
--   A. tout ce que le groupe voit est bloqué pendant une sanction ; les outils personnels restent permis ;
--   B. « Je pars pêcher » reste possible (sécurité), mais sans note ni notification au groupe ;
--   C. un membre sanctionné peut toujours signaler un membre ou un contenu.
-- Rejouable sans erreur.

-- A. contenus visibles par le groupe : même garde-fou que les prises (enforce_timeout)
do $$
declare t text;
begin
  foreach t in array array['challenges','competitions','sessions','fish_events','map_zones','structures',
                           'water_reports','depth_points','reactions','poll_votes','outing_rsvps',
                           'photo_votes','carp_sessions','post_shares'] loop
    execute format('drop trigger if exists timeout_guard on public.%I', t);
    execute format('create trigger timeout_guard before insert or update on public.%I for each row execute function public.enforce_timeout()', t);
  end loop;
end $$;

-- fonctions qui modifient un contenu partagé dont le membre n'est pas forcément l'auteur
create or replace function public.update_spot_sheet(p_id bigint, p_depth numeric, p_tours int, p_bottom text, p_details text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare g bigint;
begin
  select group_id into g from public.spots where id = p_id;
  if g is null then raise exception 'spot introuvable'; end if;
  if not (public.is_member_of(g) or public.is_admin()) then raise exception 'non autorisé'; end if;
  if public.is_timed_out() then raise exception 'compte suspendu : modification impossible pour le moment' using errcode = '42501'; end if;
  update public.spots set depth_m = p_depth, distance_tours = p_tours,
    bottom = nullif(trim(p_bottom), ''), details = nullif(trim(p_details), ''),
    sheet_updated_at = now(), sheet_updated_by = auth.uid()
  where id = p_id;
end $$;

create or replace function public.set_spot_facing(p_id bigint, p_facing int)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare g bigint;
begin
  select group_id into g from public.spots where id = p_id;
  if g is null then raise exception 'spot introuvable'; end if;
  if not (public.is_member_of(g) or public.is_admin()) then raise exception 'non autorisé'; end if;
  if public.is_timed_out() then raise exception 'compte suspendu : modification impossible pour le moment' using errcode = '42501'; end if;
  if p_facing is not null and (p_facing < 0 or p_facing > 359) then raise exception 'orientation invalide'; end if;
  update public.spots set facing = p_facing, sheet_updated_at = now(), sheet_updated_by = auth.uid() where id = p_id;
end $$;

-- profil public (bio, espèces favorites, photo) : visible par les groupes, donc bloqué aussi
create or replace function public.update_my_profile(p_bio text, p_fav text[], p_avatar text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if public.is_timed_out() then raise exception 'compte suspendu : profil non modifiable pour le moment' using errcode = '42501'; end if;
  if p_avatar is not null and p_avatar not like auth.uid()::text || '/%' then raise exception 'non autorisé'; end if;
  update public.profiles
     set bio = nullif(trim(p_bio), ''),
         fav_species = (select coalesce(array_agg(left(trim(x), 30) order by o), '{}') from unnest(coalesce(p_fav, '{}')) with ordinality t(x, o) where trim(x) <> '' and o <= 3),
         avatar_path = p_avatar
   where id = auth.uid();
end $$;

drop policy if exists timeout_photos_upload on storage.objects;
create policy timeout_photos_upload on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> all (array['photos', 'staff-media', 'avatars']) or not public.is_timed_out());

-- B. « Je pars pêcher » : permis, mais discret pendant une sanction
create or replace function public.checkin_timeout_quiet()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null and new.user_id = auth.uid() and public.is_timed_out() then
    new.announce := false;
    new.note := null;
  end if;
  return new;
end $$;
revoke all on function public.checkin_timeout_quiet() from public, anon, authenticated;
drop trigger if exists checkins_timeout_quiet on public.checkins;
create trigger checkins_timeout_quiet before insert or update on public.checkins
  for each row execute function public.checkin_timeout_quiet();

-- aucune notification au groupe (ni annonce, ni « pote à proximité ») pour un membre sanctionné
drop trigger if exists checkins_notify on public.checkins;
create trigger checkins_notify after insert on public.checkins
  for each row when (not public.is_timed_out()) execute function public.notify_new();

-- C. signaler reste possible pendant une sanction (se défendre en cas de harcèlement)
drop trigger if exists timeout_guard on public.reports;

insert into public.schema_migrations (version, notes)
values ('0011_v068_sanctions_completes', 'sanctions : contenus du groupe bloqués, Je pars pêcher discret, signalement permis')
on conflict (version) do nothing;
