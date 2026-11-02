-- Rivio 0.70 : lien d'invitation personnel (ambassadeur) et heure réelle de la prise.
-- Complète 0014_v070_echanges.sql. Rejouable sans erreur.

-- ---------------------------------------------------------------------------
-- 1. Lien d'invitation personnel (ambassadeur)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;

create or replace function public.set_referrer(p_username text)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.profiles%rowtype; r uuid;
begin
  if auth.uid() is null then return false; end if;
  select * into me from public.profiles where id = auth.uid();
  if not found or me.referred_by is not null or me.created_at < now() - interval '7 days' then return false; end if;
  select id into r from public.profiles where lower(username) = lower(btrim(p_username));
  if r is null or r = auth.uid() then return false; end if;
  update public.profiles set referred_by = r where id = auth.uid();
  insert into public.notifications (user_id, title, body, url, tag)
  values (r, '🎉 Un ami t''a rejoint', '@' || me.username || ' vient de s''inscrire grâce à ton lien. Il comptera pour ton badge d''ambassadeur dès sa première prise !', './#profil', 'parrain-' || auth.uid());
  return true;
end $$;
revoke all on function public.set_referrer(text) from public, anon;
grant execute on function public.set_referrer(text) to authenticated;

-- nombre d'amis invités actifs (au moins une prise publiée)
create or replace function public.referral_count(p_user uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.profiles f
   where f.referred_by = p_user
     and exists (select 1 from public.posts p where p.user_id = f.id and p.status = 'published');
$$;
revoke all on function public.referral_count(uuid) from public, anon;
grant execute on function public.referral_count(uuid) to authenticated;

-- première prise publiée d'un ami invité : celui qui l'a invité est prévenu
create or replace function public.referral_first_post()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare r uuid; u text;
begin
  if new.status <> 'published' then return new; end if;
  if TG_OP = 'UPDATE' and old.status = 'published' then return new; end if;
  select referred_by, username into r, u from public.profiles where id = new.user_id;
  if r is null then return new; end if;
  if exists (select 1 from public.posts where user_id = new.user_id and status = 'published' and id <> new.id) then return new; end if;
  perform public.call_notify(jsonb_build_object('table', 'parrain', 'user_id', r, 'filleul', u));
  return new;
end $$;
revoke all on function public.referral_first_post() from public, anon, authenticated;
drop trigger if exists posts_referral on public.posts;
create trigger posts_referral after insert or update of status on public.posts
  for each row execute function public.referral_first_post();

-- ---------------------------------------------------------------------------
-- 2. Heure réelle de la prise (lue dans la photo)
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists caught_at timestamptz;
alter table public.posts drop constraint if exists posts_caught_at_check;
alter table public.posts add constraint posts_caught_at_check check (caught_at is null or (caught_at <= created_at + interval '1 hour' and caught_at > created_at - interval '400 days'));

-- ---------------------------------------------------------------------------
-- 3. Signaler un message privé : il part au staff, qui peut le supprimer
-- ---------------------------------------------------------------------------
alter table public.reports alter column group_id drop not null;
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check check (kind = any (array['post', 'comment', 'message', 'dm']));
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (user_id = auth.uid() and (
    (group_id is not null and (public.is_member_of(group_id) or public.is_staff()))
    or (group_id is null and kind = 'dm'
        and exists (select 1 from public.direct_messages d where d.id = target_id and d.to_user = auth.uid()))));
drop policy if exists direct_messages_delete_staff on public.direct_messages;
create policy direct_messages_delete_staff on public.direct_messages for delete to authenticated
  using (public.is_staff() and exists (select 1 from public.reports r where r.kind = 'dm' and r.target_id = direct_messages.id));

insert into public.schema_migrations (version, notes)
values ('0015_v070_lien_parrain', 'lien de parrainage, heure réelle de la prise, signalement des messages privés')
on conflict (version) do nothing;
