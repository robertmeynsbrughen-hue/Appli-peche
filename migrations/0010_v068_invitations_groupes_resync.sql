-- Rivio 0.68 : invitations par lien fiables, suppression et transmission de groupe réparées,
-- et resynchronisation du dépôt avec la base de production.
-- Rejouable sans erreur. Appliquée le 2 novembre 2026.

-- ===================================================================
-- 1. Suppression et départ d'un responsable
--    Le garde-fou guard_owner_leave bloquait aussi delete_group et leave_group :
--    un responsable ne pouvait ni supprimer son groupe ni le transmettre puis partir.
-- ===================================================================
create or replace function public.guard_owner_leave()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.role = 'owner'
     and old.status = 'active'
     and coalesce(current_setting('app.group_deletion', true), '') <> 'on'
     and not public.is_admin()
     -- un autre responsable actif a pris le relais : le départ est permis
     and not exists (select 1 from public.memberships m
                      where m.group_id = old.group_id and m.role = 'owner'
                        and m.status = 'active' and m.user_id <> old.user_id) then
    raise exception 'transmets le groupe avant de partir';
  end if;
  return old;
end $$;
revoke all on function public.guard_owner_leave() from public, anon, authenticated;

drop trigger if exists memberships_owner_guard on public.memberships;
create trigger memberships_owner_guard before delete on public.memberships
  for each row execute function public.guard_owner_leave();

create or replace function public.delete_group(p_group bigint, p_confirmation text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_name text;
begin
  if auth.uid() is null then raise exception 'non authentifié'; end if;
  select name into v_name from public.groups where id = p_group for update;
  if not found then raise exception 'groupe introuvable'; end if;
  if not public.can_manage(p_group) then raise exception 'non autorisé'; end if;
  if p_confirmation is distinct from v_name then raise exception 'confirmation du nom incorrecte'; end if;

  insert into public.group_delete_cleanup (group_id, user_id, expires_at)
  values (p_group, auth.uid(), now() + interval '24 hours')
  on conflict (group_id, user_id) do update set expires_at = excluded.expires_at;
  -- autorise la suppression en cascade des adhésions, responsable compris, pour cette transaction seulement
  perform set_config('app.group_deletion', 'on', true);
  delete from public.groups where id = p_group;
end $$;
revoke all on function public.delete_group(bigint, text) from public, anon;
grant execute on function public.delete_group(bigint, text) to authenticated;

-- transmission explicite du rôle de responsable (présente en base, absente du dépôt jusqu'ici)
create or replace function public.transfer_ownership(p_group bigint, p_user uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if not (public.is_admin() or public.is_owner_of(p_group)) then raise exception 'non autorisé'; end if;
  if not exists (select 1 from public.memberships
                  where group_id = p_group and user_id = p_user and status = 'active') then
    raise exception 'membre introuvable';
  end if;
  -- un seul responsable : l'ancien redevient modérateur, le successeur prend la tête
  update public.memberships set role = 'moderator'
   where group_id = p_group and role = 'owner' and user_id <> p_user;
  update public.memberships set role = 'owner'
   where group_id = p_group and user_id = p_user;
end $$;
revoke all on function public.transfer_ownership(bigint, uuid) from public, anon;
grant execute on function public.transfer_ownership(bigint, uuid) to authenticated;

-- ===================================================================
-- 2. Invitations par lien
--    Respectent désormais la validation des membres, la limite du groupe et les sanctions.
-- ===================================================================
create or replace function public.redeem_invite(p_token text)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row public.group_invites;
  v_appr boolean;
  v_status text;
begin
  if auth.uid() is null then raise exception 'non authentifié'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'profil à terminer'; end if;
  if p_token is null or length(p_token) < 16 then raise exception 'invitation invalide'; end if;

  select * into v_row from public.group_invites
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and not revoked and expires_at > now();
  if not found then raise exception 'invitation expirée ou invalide'; end if;

  if exists (select 1 from public.memberships m where m.group_id = v_row.group_id and m.user_id = auth.uid()) then
    return v_row.group_id;
  end if;
  if public.is_timed_out() then raise exception 'compte suspendu : impossible de rejoindre un groupe pour le moment'; end if;
  if public.group_is_full(v_row.group_id) and not public.is_admin() then raise exception 'groupe complet'; end if;

  select require_approval into v_appr from public.groups where id = v_row.group_id;
  v_status := case when coalesce(v_appr, false) and not public.is_admin() then 'pending' else 'active' end;

  insert into public.memberships (group_id, user_id, role, status)
  values (v_row.group_id, auth.uid(), 'member', v_status)
  on conflict do nothing;
  return v_row.group_id;
end $$;
revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.redeem_invite(text) to authenticated;

-- aperçu d'une invitation sans compte : seulement le nom du groupe et s'il faut une validation.
-- Le jeton fait 128 bits : impossible à deviner, l'aperçu ne révèle rien d'autre.
create or replace function public.peek_invite(p_token text)
returns table (name text, require_approval boolean, full_group boolean, expires_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_token is null or length(p_token) < 16 then return; end if;
  return query
    select g.name, g.require_approval, public.group_is_full(g.id), i.expires_at
      from public.group_invites i join public.groups g on g.id = i.group_id
     where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
       and not i.revoked and i.expires_at > now();
end $$;
revoke all on function public.peek_invite(text) from public;
grant execute on function public.peek_invite(text) to anon, authenticated;

-- un membre sanctionné ne rejoint pas non plus un groupe avec un code
create or replace function public.join_group(p_code text, p_username text default null)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare g bigint; appr boolean;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  select id, require_approval into g, appr from public.groups where invite_code = p_code;
  perform public.invite_guard(g is not null);
  if g is null then return null; end if;
  if exists (select 1 from public.memberships where group_id = g and user_id = auth.uid()) then return g; end if;
  if public.is_timed_out() then raise exception 'compte suspendu : impossible de rejoindre un groupe pour le moment'; end if;
  if public.group_is_full(g) and not public.is_admin() then raise exception 'groupe complet'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'nom d''utilisateur manquant'; end if;
    insert into public.profiles (id, username, is_admin) values (auth.uid(), p_username, false);
  end if;
  insert into public.memberships (group_id, user_id, status)
    values (g, auth.uid(), case when appr and not public.is_admin() then 'pending' else 'active' end)
    on conflict do nothing;
  return g;
end $$;
revoke all on function public.join_group(text, text) from public, anon;
grant execute on function public.join_group(text, text) to authenticated;

-- ===================================================================
-- 3. Resynchronisation : objets présents en production mais absents du dépôt
-- ===================================================================
-- stockage des photos de prises (groupe/utilisateur/fichier)
drop policy if exists photos_select on storage.objects;
create policy photos_select on storage.objects for select
  using (bucket_id = 'photos' and (public.is_staff() or public.is_member_of(public.photo_group(name))));
drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert
  with check (bucket_id = 'photos' and split_part(name, '/', 2) = auth.uid()::text
              and (public.is_member_of(public.photo_group(name)) or public.is_admin()));
drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete
  using (bucket_id = 'photos' and (split_part(name, '/', 2) = auth.uid()::text or public.can_moderate(public.photo_group(name))));

-- photos de profil (utilisateur/fichier)
drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

-- salon staff : deux jeux de règles se superposaient (staff_msgs_* et staff_messages_*) ; on n'en garde qu'un
drop policy if exists staff_msgs_select on public.staff_messages;
drop policy if exists staff_msgs_insert on public.staff_messages;
drop policy if exists staff_msgs_delete on public.staff_messages;
drop policy if exists staff_messages_delete on public.staff_messages;
create policy staff_messages_delete on public.staff_messages for delete to authenticated
  using ((user_id = auth.uid() and public.is_staff()) or public.is_admin());

-- tâches planifiées, nommées : cron.schedule(nom, …) remplace la tâche existante du même nom
select cron.schedule('cdj-alerte-matin', '30 4 * * *', $c$ select public.call_notify('{"table":"morning"}'::jsonb) $c$);
select cron.schedule('cdj-amorcage', '*/2 * * * *', $c$ select public.call_notify('{"table":"bait_reminders"}'::jsonb) where exists (select 1 from public.carp_sessions where ended_at is null and next_bait_at <= now()) $c$);
select cron.schedule('cdj-crue', '20 * * * *', $c$ select public.call_notify('{"table":"flood_watch"}'::jsonb) where exists (select 1 from public.alert_prefs where flood and lat is not null) $c$);
select cron.schedule('cdj-orage', '*/15 * * * *', $c$ select public.call_notify('{"table":"storm_watch"}'::jsonb) where exists (select 1 from public.checkins where ended_at is null and ends_at > now() and (storm_sent_at is null or storm_sent_at < now() - interval '3 hours')) or exists (select 1 from public.carp_sessions where ended_at is null and spot_id is not null and (storm_sent_at is null or storm_sent_at < now() - interval '3 hours') and started_at > now() - interval '3 days') $c$);
select cron.schedule('cdj-photo-mois', '0 9 1 * *', $c$ select public.call_notify('{"table":"photo_month"}'::jsonb) $c$);
select cron.schedule('cdj-rappel-sorties', '0 17 * * *', $c$ select public.call_notify('{"table":"outing_reminders"}'::jsonb) $c$);
select cron.schedule('cdj-reveil', '* * * * *', $c$ select public.call_notify('{"table":"wake_alarms"}'::jsonb) where exists (select 1 from public.wake_alarms where sent_at is null and fire_at <= now()) $c$);
select cron.schedule('cdj-sauvegarde', '15 3 * * 0', $c$ select backup.weekly() $c$);
select cron.schedule('cdj-notifs-menage', '40 3 * * *', $c$ delete from public.notifications where created_at < now() - interval '60 days' $c$);
select cron.schedule('cdj-eau-menage', '50 3 * * *', $c$ delete from public.water_reports where created_at < now() - interval '7 days'; delete from public.env_reports where status = 'resolu' and coalesce(updated_at, created_at) < now() - interval '6 months'; $c$);
select cron.schedule('cdj-invite-menage', '55 3 * * *', $c$ delete from public.invite_attempts where at < now() - interval '1 day'; delete from public.group_invites where expires_at < now() - interval '7 days'; $c$);
-- positions partagées expirées : effacées et pas seulement masquées
select cron.schedule('cdj-positions-menage', '10 * * * *', $c$ delete from public.live_positions where expires_at < now() - interval '1 hour' $c$);

-- ===================================================================
-- 4. Journal des migrations
-- ===================================================================
update public.schema_migrations set notes = 'historique : contenu repris par 0003_group_management_staff_chat, absent du dépôt'
 where version = '0003_group_delete';
update public.schema_migrations set notes = 'historique : contenu repris par 0010_v068 (guard_owner_leave, transfer_ownership), absent du dépôt'
 where version = '0004_group_succession';
update public.schema_migrations set notes = 'historique : contenu repris par 0003_group_management_staff_chat, règles en double retirées par 0010_v068'
 where version = '0005_staff_chat';
insert into public.schema_migrations (version, notes)
values ('0010_v068_invitations_groupes_resync', 'invitations par lien fiables, suppression et transmission de groupe réparées, resynchronisation dépôt/production')
on conflict (version) do nothing;
