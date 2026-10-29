-- =====================================================================
-- Coup du Jour : installation de la base Supabase (multi-groupes + admin)
--
-- AVANT DE LANCER, remplace les 4 valeurs marquées <<< plus bas :
--   - ton futur nom d'utilisateur (tu seras admin automatiquement)
--   - le nom, la région et le code du premier groupe
-- Puis colle tout ce fichier dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Réglages ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  admin_username text not null
);
insert into public.settings (id, admin_username)
  values (1, 'TON_PSEUDO')                                   -- <<< ton nom d'utilisateur
  on conflict (id) do update set admin_username = excluded.admin_username;
alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;

-- ---------- Tables ----------
create table if not exists public.groups (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 40),
  region text check (char_length(region) <= 40),
  invite_code text not null unique check (char_length(invite_code) >= 6),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.spots (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  note text check (char_length(note) <= 400),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  caption text check (char_length(caption) <= 500),
  species text check (char_length(species) <= 30),
  photo_path text,
  spot_id bigint references public.spots (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Premier groupe
insert into public.groups (name, region, invite_code)
  values ('Les potes', 'Lot-et-Garonne', 'CODE-A-CHANGER')    -- <<< nom, région, code (6 caractères min.)
  on conflict (invite_code) do nothing;

-- ---------- Fonctions d'aide (droits) ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_member_of(g bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where group_id = g and user_id = auth.uid());
$$;

create or replace function public.shares_group(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = u);
$$;

-- ---------- Règles d'accès ----------
alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.spots enable row level security;
alter table public.posts enable row level security;

-- Le code d'invitation n'est jamais lisible directement
revoke all on public.groups from anon, authenticated;
grant select (id, name, region, created_at) on public.groups to authenticated;

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select
  using (public.is_admin() or public.is_member_of(id));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin() or public.shares_group(id));

drop policy if exists memberships_select on public.memberships;
drop policy if exists memberships_delete on public.memberships;
create policy memberships_select on public.memberships for select
  using (user_id = auth.uid() or public.is_admin() or public.is_member_of(group_id));
create policy memberships_delete on public.memberships for delete
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists spots_select on public.spots;
drop policy if exists spots_insert on public.spots;
drop policy if exists spots_delete on public.spots;
create policy spots_select on public.spots for select
  using (public.is_admin() or public.is_member_of(group_id));
create policy spots_insert on public.spots for insert
  with check (user_id = auth.uid() and (public.is_member_of(group_id) or public.is_admin()));
create policy spots_delete on public.spots for delete
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists posts_select on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_delete on public.posts;
create policy posts_select on public.posts for select
  using (public.is_admin() or public.is_member_of(group_id));
create policy posts_insert on public.posts for insert
  with check (user_id = auth.uid() and (public.is_member_of(group_id) or public.is_admin()));
create policy posts_delete on public.posts for delete
  using (user_id = auth.uid() or public.is_admin());

-- ---------- Inscription et groupes ----------
create or replace function public.check_invite(p_code text)
returns table (name text, region text)
language sql stable security definer set search_path = public as $$
  select g.name, g.region from public.groups g where g.invite_code = p_code;
$$;

create or replace function public.join_group(p_code text, p_username text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare g bigint;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  select id into g from public.groups where invite_code = p_code;
  if g is null then raise exception 'code invalide'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    if p_username is null then raise exception 'nom d''utilisateur manquant'; end if;
    insert into public.profiles (id, username, is_admin)
      values (auth.uid(), p_username,
              lower(p_username) = lower((select admin_username from public.settings where id = 1)));
  end if;
  insert into public.memberships (group_id, user_id) values (g, auth.uid())
    on conflict do nothing;
  return g;
end;
$$;

-- ---------- Fonctions réservées à l'admin ----------
create or replace function public.admin_groups()
returns table (id bigint, name text, region text, invite_code text,
               members bigint, posts bigint, spots bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''admin'; end if;
  return query
    select g.id, g.name, g.region, g.invite_code,
      (select count(*) from public.memberships m where m.group_id = g.id),
      (select count(*) from public.posts p where p.group_id = g.id),
      (select count(*) from public.spots s where s.group_id = g.id),
      g.created_at
    from public.groups g order by g.name;
end;
$$;

create or replace function public.admin_save_group(p_id bigint, p_name text, p_region text, p_code text)
returns bigint
language plpgsql security definer set search_path = public as $$
declare r bigint;
begin
  if not public.is_admin() then raise exception 'réservé à l''admin'; end if;
  if p_id is null then
    insert into public.groups (name, region, invite_code) values (p_name, nullif(p_region, ''), p_code)
      returning id into r;
  else
    update public.groups set name = p_name, region = nullif(p_region, ''), invite_code = p_code
      where id = p_id returning id into r;
  end if;
  return r;
end;
$$;

create or replace function public.admin_members(p_group bigint)
returns table (user_id uuid, username text, is_admin boolean, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''admin'; end if;
  return query
    select p.id, p.username, p.is_admin, m.joined_at
    from public.memberships m join public.profiles p on p.id = m.user_id
    where m.group_id = p_group order by p.username;
end;
$$;

revoke all on function public.join_group(text, text) from public, anon;
revoke all on function public.admin_groups() from public, anon;
revoke all on function public.admin_save_group(bigint, text, text, text) from public, anon;
revoke all on function public.admin_members(bigint) from public, anon;
grant execute on function public.check_invite(text) to anon, authenticated;
grant execute on function public.join_group(text, text) to authenticated;
grant execute on function public.admin_groups() to authenticated;
grant execute on function public.admin_save_group(bigint, text, text, text) to authenticated;
grant execute on function public.admin_members(bigint) to authenticated;

-- ---------- Photos (stockage privé : <groupe>/<membre>/<fichier>.jpg) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;

create or replace function public.photo_group(path text) returns bigint
language sql immutable as $$
  select case when split_part(path, '/', 1) ~ '^[0-9]+$' then split_part(path, '/', 1)::bigint end;
$$;

drop policy if exists photos_select on storage.objects;
drop policy if exists photos_insert on storage.objects;
drop policy if exists photos_delete on storage.objects;
create policy photos_select on storage.objects for select
  using (bucket_id = 'photos' and (public.is_admin() or public.is_member_of(public.photo_group(name))));
create policy photos_insert on storage.objects for insert
  with check (bucket_id = 'photos'
    and split_part(name, '/', 2) = auth.uid()::text
    and (public.is_member_of(public.photo_group(name)) or public.is_admin()));
create policy photos_delete on storage.objects for delete
  using (bucket_id = 'photos' and (split_part(name, '/', 2) = auth.uid()::text or public.is_admin()));

-- ---------- Mise à jour : rôles, validations, sondages, mémos, bilans, chat ----------
-- Coup du Jour : rôles (responsable / modérateur / membre), validations, sondages, mémos

-- ---------- 1. Rôles, statuts et options de groupe ----------
alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships add constraint memberships_role_check check (role in ('member', 'moderator', 'owner'));
alter table public.memberships add column if not exists status text not null default 'active';
alter table public.memberships drop constraint if exists memberships_status_check;
alter table public.memberships add constraint memberships_status_check check (status in ('active', 'pending'));

alter table public.groups add column if not exists require_approval boolean not null default false;
alter table public.groups add column if not exists post_approval boolean not null default false;
grant select (id, name, region, created_at, require_approval, post_approval) on public.groups to authenticated;

alter table public.posts add column if not exists status text not null default 'published';
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add constraint posts_status_check check (status in ('published', 'pending'));

-- ---------- 2. Fonctions d'aide ----------
create or replace function public.is_member_of(g bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where group_id = g and user_id = auth.uid() and status = 'active');
$$;
create or replace function public.is_pending_in(g bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where group_id = g and user_id = auth.uid() and status = 'pending');
$$;
create or replace function public.is_owner_of(g bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where group_id = g and user_id = auth.uid() and status = 'active' and role = 'owner');
$$;
create or replace function public.is_mod_of(g bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
                 where group_id = g and user_id = auth.uid() and status = 'active' and role in ('owner', 'moderator'));
$$;
create or replace function public.can_manage(g bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_owner_of(g);
$$;
create or replace function public.can_moderate(g bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_mod_of(g);
$$;
create or replace function public.shares_group(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = u and a.status = 'active' and b.status = 'active');
$$;
create or replace function public.photo_group(path text) returns bigint
language sql immutable set search_path = public as $$
  select case when split_part(path, '/', 1) ~ '^[0-9]+$' then split_part(path, '/', 1)::bigint end;
$$;

-- ---------- 3. Règles d'accès mises à jour ----------
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select
  using (public.is_admin() or public.is_member_of(id) or public.is_pending_in(id));

drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select
  using (user_id = auth.uid() or public.is_admin()
         or (public.is_member_of(group_id) and (status = 'active' or public.can_moderate(group_id))));
drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships for delete
  using (user_id = auth.uid() or public.is_admin()
         or (public.is_owner_of(group_id) and role <> 'owner')
         or (public.is_mod_of(group_id) and role = 'member'));

drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select
  using (public.is_admin() or (public.is_member_of(group_id)
         and (status = 'published' or user_id = auth.uid() or public.can_moderate(group_id))));
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete
  using (user_id = auth.uid() or public.can_moderate(group_id));
drop policy if exists spots_delete on public.spots;
create policy spots_delete on public.spots for delete
  using (user_id = auth.uid() or public.can_moderate(group_id));
drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete
  using (bucket_id = 'photos' and (split_part(name, '/', 2) = auth.uid()::text
         or public.can_moderate(public.photo_group(name))));

-- Une publication passe en attente si le groupe l'exige (sauf pour les modérateurs)
create or replace function public.set_post_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  NEW.status := case
    when coalesce((select post_approval from public.groups where id = NEW.group_id), false)
         and not public.can_moderate(NEW.group_id) then 'pending'
    else 'published' end;
  return NEW;
end;
$$;
drop trigger if exists posts_status on public.posts;
create trigger posts_status before insert on public.posts
  for each row execute function public.set_post_status();

-- ---------- 4. Adhésion, rôles, validations ----------
drop function if exists public.check_invite(text);
create function public.check_invite(p_code text)
returns table (name text, region text, require_approval boolean)
language sql stable security definer set search_path = public as $$
  select g.name, g.region, g.require_approval from public.groups g where g.invite_code = p_code;
$$;

create or replace function public.join_group(p_code text, p_username text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare g bigint; appr boolean;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  select id, require_approval into g, appr from public.groups where invite_code = p_code;
  if g is null then raise exception 'code invalide'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    if p_username is null then raise exception 'nom d''utilisateur manquant'; end if;
    insert into public.profiles (id, username, is_admin)
      values (auth.uid(), p_username,
              lower(p_username) = lower((select admin_username from public.settings where id = 1)));
  end if;
  insert into public.memberships (group_id, user_id, status)
    values (g, auth.uid(), case when appr and not public.is_admin() then 'pending' else 'active' end)
    on conflict do nothing;
  return g;
end;
$$;

create or replace function public.approve_member(p_group bigint, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_moderate(p_group) then raise exception 'non autorisé'; end if;
  update public.memberships set status = 'active', joined_at = now()
    where group_id = p_group and user_id = p_user and status = 'pending';
end;
$$;

create or replace function public.set_member_role(p_group bigint, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if p_role not in ('member', 'moderator', 'owner') then raise exception 'rôle inconnu'; end if;
  if not public.can_manage(p_group) then raise exception 'non autorisé'; end if;
  select role into cur from public.memberships where group_id = p_group and user_id = p_user and status = 'active';
  if cur is null then raise exception 'membre introuvable'; end if;
  if (p_role = 'owner' or cur = 'owner') and not public.is_admin() then
    raise exception 'seul l''admin peut changer le responsable';
  end if;
  update public.memberships set role = p_role where group_id = p_group and user_id = p_user;
end;
$$;

create or replace function public.approve_post(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare g bigint;
begin
  select group_id into g from public.posts where id = p_id;
  if g is null then raise exception 'post introuvable'; end if;
  if not public.can_moderate(g) then raise exception 'non autorisé'; end if;
  update public.posts set status = 'published' where id = p_id and status = 'pending';
end;
$$;

create or replace function public.set_group_options(p_id bigint, p_require_approval boolean, p_post_approval boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage(p_id) then raise exception 'non autorisé'; end if;
  update public.groups set require_approval = p_require_approval, post_approval = p_post_approval where id = p_id;
end;
$$;

drop function if exists public.manage_groups();
create function public.manage_groups()
returns table (id bigint, name text, region text, invite_code text, require_approval boolean, post_approval boolean,
               my_role text, members bigint, pending_members bigint, posts bigint, pending_posts bigint,
               spots bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.region, g.invite_code, g.require_approval, g.post_approval,
    case when public.is_admin() then 'admin'
         else (select m.role from public.memberships m where m.group_id = g.id and m.user_id = auth.uid()) end,
    (select count(*) from public.memberships m where m.group_id = g.id and m.status = 'active'),
    (select count(*) from public.memberships m where m.group_id = g.id and m.status = 'pending'),
    (select count(*) from public.posts p where p.group_id = g.id and p.status = 'published'),
    (select count(*) from public.posts p where p.group_id = g.id and p.status = 'pending'),
    (select count(*) from public.spots s where s.group_id = g.id),
    g.created_at
  from public.groups g
  where public.can_moderate(g.id)
  order by g.name;
$$;

drop function if exists public.manage_members(bigint);
create function public.manage_members(p_group bigint)
returns table (user_id uuid, username text, is_admin boolean, role text, status text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_moderate(p_group) then raise exception 'non autorisé'; end if;
  return query
    select p.id, p.username, p.is_admin, m.role, m.status, m.joined_at
    from public.memberships m join public.profiles p on p.id = m.user_id
    where m.group_id = p_group
    order by (m.status = 'pending') desc, (case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end), p.username;
end;
$$;

-- ---------- 5. Sondages de sortie ----------
create table if not exists public.polls (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  question text not null check (char_length(question) between 3 and 200),
  place text check (char_length(place) <= 80),
  event_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.poll_votes (
  poll_id bigint not null references public.polls (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  choice text not null check (choice in ('oui', 'non', 'peut-etre')),
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
create or replace function public.poll_group(p bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select group_id from public.polls where id = p;
$$;
drop policy if exists polls_select on public.polls;
drop policy if exists polls_insert on public.polls;
drop policy if exists polls_delete on public.polls;
create policy polls_select on public.polls for select using (public.is_admin() or public.is_member_of(group_id));
create policy polls_insert on public.polls for insert with check (user_id = auth.uid() and public.is_member_of(group_id));
create policy polls_delete on public.polls for delete using (user_id = auth.uid() or public.can_moderate(group_id));
drop policy if exists votes_select on public.poll_votes;
drop policy if exists votes_insert on public.poll_votes;
drop policy if exists votes_update on public.poll_votes;
drop policy if exists votes_delete on public.poll_votes;
create policy votes_select on public.poll_votes for select
  using (public.is_admin() or public.is_member_of(public.poll_group(poll_id)));
create policy votes_insert on public.poll_votes for insert
  with check (user_id = auth.uid() and public.is_member_of(public.poll_group(poll_id)));
create policy votes_update on public.poll_votes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member_of(public.poll_group(poll_id)));
create policy votes_delete on public.poll_votes for delete using (user_id = auth.uid());

-- ---------- 6. Mémos partagés ----------
create table if not exists public.memos (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text check (char_length(body) <= 2000),
  link text check (char_length(link) <= 300),
  photo_path text,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.memos enable row level security;
drop policy if exists memos_select on public.memos;
drop policy if exists memos_insert on public.memos;
drop policy if exists memos_update on public.memos;
drop policy if exists memos_delete on public.memos;
create policy memos_select on public.memos for select using (public.is_admin() or public.is_member_of(group_id));
create policy memos_insert on public.memos for insert
  with check (user_id = auth.uid() and public.is_member_of(group_id) and (not pinned or public.can_moderate(group_id)));
create policy memos_update on public.memos for update
  using (user_id = auth.uid() or public.can_moderate(group_id))
  with check (public.is_member_of(group_id) or public.is_admin());
create policy memos_delete on public.memos for delete using (user_id = auth.uid() or public.can_moderate(group_id));
create or replace function public.memo_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.group_id <> OLD.group_id or NEW.user_id <> OLD.user_id then raise exception 'non autorisé'; end if;
  if NEW.pinned <> OLD.pinned and not public.can_moderate(NEW.group_id) then
    raise exception 'seuls les modérateurs peuvent épingler';
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;
drop trigger if exists memos_guard on public.memos;
create trigger memos_guard before update on public.memos
  for each row execute function public.memo_guard();

-- ---------- 7. Droits d'appel des fonctions ----------
revoke all on function public.approve_member(bigint, uuid) from public, anon;
revoke all on function public.set_member_role(bigint, uuid, text) from public, anon;
revoke all on function public.approve_post(bigint) from public, anon;
revoke all on function public.set_group_options(bigint, boolean, boolean) from public, anon;
revoke all on function public.manage_groups() from public, anon;
revoke all on function public.manage_members(bigint) from public, anon;
grant execute on function public.check_invite(text) to anon, authenticated;
grant execute on function public.approve_member(bigint, uuid) to authenticated;
grant execute on function public.set_member_role(bigint, uuid, text) to authenticated;
grant execute on function public.approve_post(bigint) to authenticated;
grant execute on function public.set_group_options(bigint, boolean, boolean) to authenticated;
grant execute on function public.manage_groups() to authenticated;
grant execute on function public.manage_members(bigint) to authenticated;

-- ---------- 8. Bilans de session ----------
create table if not exists public.sessions (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  species text check (char_length(species) <= 30),
  caught boolean not null default true,
  length_cm numeric check (length_cm > 0 and length_cm <= 300),
  lure text check (char_length(lure) <= 60),
  color text check (char_length(color) <= 40),
  rating smallint not null check (rating between 1 and 4),
  water_type text check (water_type in ('etang', 'riviere', 'canal')),
  created_at timestamptz not null default now()
);
alter table public.sessions enable row level security;
drop policy if exists sessions_select on public.sessions;
drop policy if exists sessions_insert on public.sessions;
drop policy if exists sessions_delete on public.sessions;
create policy sessions_select on public.sessions for select using (public.is_admin() or public.is_member_of(group_id));
create policy sessions_insert on public.sessions for insert with check (user_id = auth.uid() and public.is_member_of(group_id));
create policy sessions_delete on public.sessions for delete using (user_id = auth.uid() or public.can_moderate(group_id));

-- ---------- 9. Chat de groupe ----------
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_group_time on public.messages (group_id, created_at desc);
alter table public.messages enable row level security;
drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_delete on public.messages;
create policy messages_select on public.messages for select using (public.is_admin() or public.is_member_of(group_id));
create policy messages_insert on public.messages for insert with check (user_id = auth.uid() and public.is_member_of(group_id));
create policy messages_delete on public.messages for delete using (user_id = auth.uid() or public.can_moderate(group_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (user_id = auth.uid() and (public.is_member_of(group_id) or public.is_admin()));
