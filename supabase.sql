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

-- ========== Vague 1 : réactions, commentaires, défis, limite de 20 membres ==========

-- ---------- Limite de 20 membres par groupe (demandes en attente comprises) ----------
create or replace function public.group_is_full(g bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.memberships where group_id = g) >= 20;
$$;

create or replace function public.join_group(p_code text, p_username text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare g bigint; appr boolean;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  select id, require_approval into g, appr from public.groups where invite_code = p_code;
  if g is null then raise exception 'code invalide'; end if;
  if exists (select 1 from public.memberships where group_id = g and user_id = auth.uid()) then return g; end if;
  if public.group_is_full(g) and not public.is_admin() then raise exception 'groupe complet'; end if;
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

drop function if exists public.check_invite(text);
create function public.check_invite(p_code text)
returns table (name text, region text, require_approval boolean, full_group boolean)
language sql stable security definer set search_path = public as $$
  select g.name, g.region, g.require_approval, public.group_is_full(g.id) from public.groups g where g.invite_code = p_code;
$$;
grant execute on function public.check_invite(text) to anon, authenticated;

-- ---------- Réactions et commentaires ----------
create or replace function public.post_group(p bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select group_id from public.posts where id = p;
$$;

create table if not exists public.reactions (
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('fire', 'clap', 'fish')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
alter table public.reactions enable row level security;
drop policy if exists reactions_select on public.reactions;
drop policy if exists reactions_insert on public.reactions;
drop policy if exists reactions_delete on public.reactions;
create policy reactions_select on public.reactions for select
  using (public.is_admin() or public.is_member_of(public.post_group(post_id)));
create policy reactions_insert on public.reactions for insert
  with check (user_id = auth.uid() and (public.is_member_of(public.post_group(post_id)) or public.is_admin()));
create policy reactions_delete on public.reactions for delete using (user_id = auth.uid());

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists comments_post on public.comments (post_id, created_at);
alter table public.comments enable row level security;
drop policy if exists comments_select on public.comments;
drop policy if exists comments_insert on public.comments;
drop policy if exists comments_delete on public.comments;
create policy comments_select on public.comments for select
  using (public.is_admin() or public.is_member_of(public.post_group(post_id)));
create policy comments_insert on public.comments for insert
  with check (user_id = auth.uid() and (public.is_member_of(public.post_group(post_id)) or public.is_admin()));
create policy comments_delete on public.comments for delete
  using (user_id = auth.uid() or public.can_moderate(public.post_group(post_id)));

-- ---------- Défis mensuels ----------
create table if not exists public.challenges (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  species text check (char_length(species) <= 30),
  min_length numeric check (min_length > 0 and min_length <= 300),
  month date not null default date_trunc('month', now())::date,
  created_at timestamptz not null default now()
);
alter table public.challenges enable row level security;
drop policy if exists challenges_select on public.challenges;
drop policy if exists challenges_insert on public.challenges;
drop policy if exists challenges_delete on public.challenges;
create policy challenges_select on public.challenges for select using (public.is_admin() or public.is_member_of(group_id));
create policy challenges_insert on public.challenges for insert
  with check (user_id = auth.uid() and public.can_moderate(group_id));
create policy challenges_delete on public.challenges for delete using (public.can_moderate(group_id));

-- ---------- Notifications ----------
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_new();
drop trigger if exists challenges_notify on public.challenges;
create trigger challenges_notify after insert on public.challenges
  for each row execute function public.notify_new();

revoke all on function public.group_is_full(bigint) from public, anon;
grant execute on function public.group_is_full(bigint) to authenticated;

-- ========== Vague 2 : fiche poste, sessions carpe, liste de matos ==========

-- ---------- Fiche poste ----------
alter table public.spots add column if not exists depth_m numeric check (depth_m > 0 and depth_m <= 100);
alter table public.spots add column if not exists distance_tours int check (distance_tours between 1 and 500);
alter table public.spots add column if not exists bottom text check (char_length(bottom) <= 40);
alter table public.spots add column if not exists details text check (char_length(details) <= 1000);
alter table public.spots add column if not exists sheet_updated_at timestamptz;
alter table public.spots add column if not exists sheet_updated_by uuid references public.profiles (id) on delete set null;

-- tout membre du groupe peut compléter la fiche (pas le nom ni la position)
create or replace function public.update_spot_sheet(p_id bigint, p_depth numeric, p_tours int, p_bottom text, p_details text)
returns void language plpgsql security definer set search_path = public as $$
declare g bigint;
begin
  select group_id into g from public.spots where id = p_id;
  if g is null then raise exception 'spot introuvable'; end if;
  if not (public.is_member_of(g) or public.is_admin()) then raise exception 'non autorisé'; end if;
  update public.spots set depth_m = p_depth, distance_tours = p_tours,
    bottom = nullif(trim(p_bottom), ''), details = nullif(trim(p_details), ''),
    sheet_updated_at = now(), sheet_updated_by = auth.uid()
  where id = p_id;
end;
$$;
revoke all on function public.update_spot_sheet(bigint, numeric, int, text, text) from public, anon;
grant execute on function public.update_spot_sheet(bigint, numeric, int, text, text) to authenticated;

-- ---------- Sessions carpe ----------
create table if not exists public.carp_sessions (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  spot_id bigint references public.spots (id) on delete set null,
  rods int not null default 2 check (rods between 1 and 6),
  bait text check (char_length(bait) <= 120),
  groundbait text check (char_length(groundbait) <= 200),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists carp_sessions_group on public.carp_sessions (group_id, started_at desc);
create index if not exists carp_sessions_spot on public.carp_sessions (spot_id);
alter table public.carp_sessions enable row level security;
drop policy if exists carp_sessions_select on public.carp_sessions;
drop policy if exists carp_sessions_insert on public.carp_sessions;
drop policy if exists carp_sessions_update on public.carp_sessions;
drop policy if exists carp_sessions_delete on public.carp_sessions;
create policy carp_sessions_select on public.carp_sessions for select using (public.is_admin() or public.is_member_of(group_id));
create policy carp_sessions_insert on public.carp_sessions for insert with check (user_id = auth.uid() and public.is_member_of(group_id));
create policy carp_sessions_update on public.carp_sessions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy carp_sessions_delete on public.carp_sessions for delete using (user_id = auth.uid() or public.can_moderate(group_id));

create or replace function public.carp_group(s bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select group_id from public.carp_sessions where id = s;
$$;
create or replace function public.carp_owner(s bigint) returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from public.carp_sessions where id = s;
$$;

create table if not exists public.carp_events (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.carp_sessions (id) on delete cascade,
  kind text not null check (kind in ('depart', 'touche', 'prise', 'amorcage')),
  at timestamptz not null default now(),
  rod int check (rod between 1 and 6),
  weight_kg numeric check (weight_kg > 0 and weight_kg < 60),
  note text check (char_length(note) <= 200)
);
create index if not exists carp_events_session on public.carp_events (session_id, at);
alter table public.carp_events enable row level security;
drop policy if exists carp_events_select on public.carp_events;
drop policy if exists carp_events_insert on public.carp_events;
drop policy if exists carp_events_delete on public.carp_events;
create policy carp_events_select on public.carp_events for select
  using (public.is_admin() or public.is_member_of(public.carp_group(session_id)));
create policy carp_events_insert on public.carp_events for insert
  with check (public.carp_owner(session_id) = auth.uid());
create policy carp_events_delete on public.carp_events for delete
  using (public.carp_owner(session_id) = auth.uid());

-- ---------- Liste de matos (perso) ----------
create table if not exists public.gear_items (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kit text not null default 'Général' check (char_length(kit) between 1 and 40),
  name text not null check (char_length(name) between 1 and 80),
  checked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gear_items_user on public.gear_items (user_id, kit);
alter table public.gear_items enable row level security;
drop policy if exists gear_items_all on public.gear_items;
create policy gear_items_all on public.gear_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on function public.carp_group(bigint) from public, anon;
revoke all on function public.carp_owner(bigint) from public, anon;
grant execute on function public.carp_group(bigint) to authenticated;
grant execute on function public.carp_owner(bigint) to authenticated;

-- ========== Vague 3 : alerte du matin (remplace <CLE_ANON> et <SECRET>) ==========
create table if not exists public.alert_prefs (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  enabled boolean not null default true,
  lat numeric check (lat between -90 and 90),
  lon numeric check (lon between -180 and 180),
  place text check (char_length(place) <= 60),
  species text[] not null default '{}',
  threshold int not null default 70 check (threshold between 40 and 95),
  water text not null default 'etang' check (water in ('etang', 'riviere', 'canal')),
  opening boolean not null default true,
  last_sent date,
  updated_at timestamptz not null default now()
);
alter table public.alert_prefs enable row level security;
drop policy if exists alert_prefs_all on public.alert_prefs;
create policy alert_prefs_all on public.alert_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- appel interne de la fonction notify (contient le secret, réservé au serveur)
create or replace function public.call_notify(payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://gnamfqwbzmwivjagwogy.supabase.co/functions/v1/notify',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer <CLE_ANON>', 'x-hook-secret', '<SECRET>'),
    timeout_milliseconds := 60000);
end;
$$;
revoke all on function public.call_notify(jsonb) from public, anon, authenticated;

create or replace function public.test_morning_alert() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.alert_prefs where user_id = auth.uid()) then
    raise exception 'alerte non configurée';
  end if;
  perform public.call_notify(jsonb_build_object('table', 'morning', 'test', true, 'user_id', auth.uid()));
end;
$$;
revoke all on function public.test_morning_alert() from public, anon;
grant execute on function public.test_morning_alert() to authenticated;

create extension if not exists pg_cron;
select cron.unschedule('cdj-alerte-matin') where exists (select 1 from cron.job where jobname = 'cdj-alerte-matin');
select cron.schedule('cdj-alerte-matin', '30 4 * * *', $c$ select public.call_notify('{"table":"morning"}'::jsonb) $c$);

-- ========== Photos et messages vocaux dans le chat ==========
alter table public.messages add column if not exists photo_path text;
alter table public.messages add column if not exists audio_path text;
alter table public.messages add column if not exists audio_secs int;
alter table public.messages alter column body drop not null;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.messages'::regclass and contype = 'c' loop
    execute format('alter table public.messages drop constraint %I', c);
  end loop;
end $$;
alter table public.messages add constraint messages_body_len check (body is null or char_length(body) between 1 and 1000);
alter table public.messages add constraint messages_not_empty check (body is not null or photo_path is not null or audio_path is not null);
alter table public.messages add constraint messages_photo_path check (photo_path is null or photo_path like group_id::text || '/' || user_id::text || '/%');
alter table public.messages add constraint messages_audio_path check (audio_path is null or audio_path like group_id::text || '/' || user_id::text || '/%');
alter table public.messages add constraint messages_audio_secs check (audio_secs is null or audio_secs between 1 and 180);
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac'] where id = 'photos';

-- ========== Sorties planifiées et position en direct ==========

-- ---------- Sorties planifiées ----------
create table if not exists public.outings (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  place text check (char_length(place) <= 80),
  spot_id bigint references public.spots (id) on delete set null,
  start_at timestamptz not null,
  notes text check (char_length(notes) <= 500),
  reminded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists outings_group on public.outings (group_id, start_at);
alter table public.outings enable row level security;
drop policy if exists outings_select on public.outings;
drop policy if exists outings_insert on public.outings;
drop policy if exists outings_update on public.outings;
drop policy if exists outings_delete on public.outings;
create policy outings_select on public.outings for select using (public.is_admin() or public.is_member_of(group_id));
create policy outings_insert on public.outings for insert with check (user_id = auth.uid() and public.is_member_of(group_id));
create policy outings_update on public.outings for update using (user_id = auth.uid() or public.can_moderate(group_id))
  with check (user_id = auth.uid() or public.can_moderate(group_id));
create policy outings_delete on public.outings for delete using (user_id = auth.uid() or public.can_moderate(group_id));

create or replace function public.outing_group(o bigint) returns bigint
language sql stable security definer set search_path = public as $$
  select group_id from public.outings where id = o;
$$;

create table if not exists public.outing_rsvps (
  outing_id bigint not null references public.outings (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status text not null default 'yes' check (status in ('yes', 'maybe', 'no')),
  seats int not null default 0 check (seats between 0 and 8),
  needs_ride boolean not null default false,
  brings text check (char_length(brings) <= 120),
  updated_at timestamptz not null default now(),
  primary key (outing_id, user_id)
);
alter table public.outing_rsvps enable row level security;
drop policy if exists outing_rsvps_select on public.outing_rsvps;
drop policy if exists outing_rsvps_write on public.outing_rsvps;
create policy outing_rsvps_select on public.outing_rsvps for select
  using (public.is_admin() or public.is_member_of(public.outing_group(outing_id)));
create policy outing_rsvps_write on public.outing_rsvps for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member_of(public.outing_group(outing_id)));

drop trigger if exists outings_notify on public.outings;
create trigger outings_notify after insert on public.outings
  for each row execute function public.notify_new();

-- ---------- Position en direct ----------
create table if not exists public.live_positions (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  group_id bigint not null references public.groups (id) on delete cascade,
  lat numeric not null check (lat between -90 and 90),
  lon numeric not null check (lon between -180 and 180),
  accuracy int,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours'
);
alter table public.live_positions enable row level security;
drop policy if exists live_select on public.live_positions;
drop policy if exists live_write on public.live_positions;
create policy live_select on public.live_positions for select
  using (expires_at > now() and (public.is_member_of(group_id) or public.is_admin()));
create policy live_write on public.live_positions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member_of(group_id) and expires_at <= now() + interval '8 hours');

revoke all on function public.outing_group(bigint) from public, anon;
grant execute on function public.outing_group(bigint) to authenticated;
select cron.schedule('cdj-rappel-sorties', '0 17 * * *', $c$ select public.call_notify('{"table":"outing_reminders"}'::jsonb) $c$);

-- ========== Profil public ==========
alter table public.profiles add column if not exists bio text check (char_length(bio) <= 160);
alter table public.profiles add column if not exists fav_species text[] not null default '{}' check (cardinality(fav_species) <= 3);
alter table public.profiles add column if not exists avatar_path text check (char_length(avatar_path) <= 200);

create or replace function public.update_my_profile(p_bio text, p_fav text[], p_avatar text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if p_avatar is not null and p_avatar not like auth.uid()::text || '/%' then raise exception 'non autorisé'; end if;
  update public.profiles
     set bio = nullif(trim(p_bio), ''),
         fav_species = (select coalesce(array_agg(left(trim(x), 30) order by o), '{}') from unnest(coalesce(p_fav, '{}')) with ordinality t(x, o) where trim(x) <> '' and o <= 3),
         avatar_path = p_avatar
   where id = auth.uid();
end;
$$;
revoke all on function public.update_my_profile(text, text[], text) from public, anon;
grant execute on function public.update_my_profile(text, text[], text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;
drop policy if exists avatars_insert on storage.objects;
drop policy if exists avatars_delete on storage.objects;
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

-- ========== Rôle contrôleur ==========
alter table public.profiles add column if not exists is_controller boolean not null default false;

create or replace function public.is_controller() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_controller from public.profiles where id = auth.uid()), false);
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_controller();
$$;
create or replace function public.can_moderate(g bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or public.is_mod_of(g);
$$;

-- le contrôleur voit tout, comme l'admin
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname, qual from pg_policies
           where cmd = 'SELECT' and qual like '%is_admin()%' loop
    execute format('alter policy %I on %I.%I using (%s)', r.policyname, r.schemaname, r.tablename, replace(r.qual, 'is_admin()', 'is_staff()'));
  end loop;
end $$;

-- il peut écrire dans les chats et retirer un simple membre
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (user_id = auth.uid() and (public.is_member_of(group_id) or public.is_staff()));
drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships for delete
  using (user_id = auth.uid() or public.is_admin()
         or (public.is_owner_of(group_id) and role <> 'owner')
         or ((public.is_mod_of(group_id) or public.is_controller()) and role = 'member'));

-- son rôle apparaît dans la vue d'ensemble des groupes
do $$ declare d text; begin
  d := pg_get_functiondef('public.manage_groups()'::regprocedure);
  if position('is_controller' in d) = 0 then
    execute replace(d, 'when public.is_admin() then ''admin''', 'when public.is_admin() then ''admin'' when public.is_controller() then ''controleur''');
  end if;
end $$;

-- nomination par l'admin uniquement
create or replace function public.set_controller(p_username text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'seul l''admin peut nommer un contrôleur'; end if;
  update public.profiles set is_controller = p_on where lower(username) = lower(p_username) and not is_admin;
  if not found then raise exception 'utilisateur introuvable'; end if;
end;
$$;
create or replace function public.list_controllers() returns table (username text)
language sql stable security definer set search_path = public as $$
  select username from public.profiles where is_controller order by username;
$$;
revoke all on function public.set_controller(text, boolean) from public, anon;
revoke all on function public.list_controllers() from public, anon;
grant execute on function public.set_controller(text, boolean) to authenticated;
grant execute on function public.list_controllers() to authenticated;
grant execute on function public.is_controller() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- ========== Lot 5 : leurres, signalements, compétitions, sauvegarde ==========

-- ---------- Conditions météo enregistrées avec les bilans et les prises (prédiction) ----------
alter table public.sessions add column if not exists conditions jsonb;
alter table public.posts add column if not exists conditions jsonb;

-- ---------- Journal des leurres (perso) ----------
create table if not exists public.lures (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text check (char_length(kind) <= 40),
  color text check (char_length(color) <= 40),
  weight_g numeric check (weight_g > 0 and weight_g < 1000),
  photo_path text check (char_length(photo_path) <= 200),
  notes text check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);
alter table public.lures enable row level security;
drop policy if exists lures_all on public.lures;
create policy lures_all on public.lures for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Signalements ----------
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('post', 'comment', 'message')),
  target_id bigint not null,
  excerpt text check (char_length(excerpt) <= 200),
  author_id uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) between 2 and 200),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  handled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists reports_group on public.reports (group_id, status);
alter table public.reports enable row level security;
drop policy if exists reports_select on public.reports;
drop policy if exists reports_insert on public.reports;
drop policy if exists reports_update on public.reports;
create policy reports_select on public.reports for select using (user_id = auth.uid() or public.can_moderate(group_id));
create policy reports_insert on public.reports for insert with check (user_id = auth.uid() and (public.is_member_of(group_id) or public.is_staff()));
create policy reports_update on public.reports for update using (public.can_moderate(group_id)) with check (public.can_moderate(group_id));
drop trigger if exists reports_notify on public.reports;
create trigger reports_notify after insert on public.reports for each row execute function public.notify_new();

-- ---------- Compétitions ----------
create table if not exists public.competitions (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  mode text not null default 'points' check (mode in ('points', 'biggest', 'count')),
  species text check (char_length(species) <= 30),
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (end_at > start_at and end_at <= start_at + interval '31 days')
);
create index if not exists competitions_group on public.competitions (group_id, end_at);
alter table public.competitions enable row level security;
drop policy if exists competitions_select on public.competitions;
drop policy if exists competitions_insert on public.competitions;
drop policy if exists competitions_delete on public.competitions;
create policy competitions_select on public.competitions for select using (public.is_staff() or public.is_member_of(group_id));
create policy competitions_insert on public.competitions for insert with check (user_id = auth.uid() and public.can_moderate(group_id));
create policy competitions_delete on public.competitions for delete using (user_id = auth.uid() or public.can_moderate(group_id));
drop trigger if exists competitions_notify on public.competitions;
create trigger competitions_notify after insert on public.competitions for each row execute function public.notify_new();

-- ---------- Sauvegarde automatique hebdomadaire (5 semaines gardées) ----------
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;
create table if not exists backup.snapshots (
  id bigint generated always as identity primary key,
  snap date not null,
  tbl text not null,
  data jsonb not null
);
create index if not exists snapshots_snap on backup.snapshots (snap, tbl);
create or replace function backup.weekly() returns void
language plpgsql security definer set search_path = public, backup as $$
declare t text;
begin
  delete from backup.snapshots where snap = current_date or snap < current_date - 35;
  foreach t in array array['settings','groups','profiles','memberships','spots','posts','sessions','polls','poll_votes','memos','messages',
    'reactions','comments','challenges','carp_sessions','carp_events','gear_items','alert_prefs','outings','outing_rsvps','lures','reports','competitions'] loop
    if to_regclass('public.' || t) is not null then
      execute format('insert into backup.snapshots (snap, tbl, data) select current_date, %L, to_jsonb(x) from public.%I x', t, t);
    end if;
  end loop;
end;
$$;
revoke all on function backup.weekly() from public, anon, authenticated;


-- ===== Lot 6 (v26) =====
-- Coup du Jour : partage public, carte de pêche, rappel d'amorçage, traces GPS, profondeurs, alertes crue

-- ---------- Partage public d'une prise (lien sans compte) ----------
create table if not exists public.post_shares (
  token uuid primary key default gen_random_uuid(),
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  show_spot boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.post_shares enable row level security;
drop policy if exists shares_select on public.post_shares;
drop policy if exists shares_insert on public.post_shares;
drop policy if exists shares_delete on public.post_shares;
create policy shares_select on public.post_shares for select using (user_id = auth.uid());
create policy shares_insert on public.post_shares for insert
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid() and p.status = 'published'));
create policy shares_delete on public.post_shares for delete using (user_id = auth.uid());

-- ---------- Carte de pêche ----------
alter table public.profiles add column if not exists permit_end date;
create or replace function public.set_permit_end(p_date date) returns void
language sql security definer set search_path = public as $$
  update public.profiles set permit_end = p_date where id = auth.uid();
$$;
revoke all on function public.set_permit_end(date) from public, anon;
grant execute on function public.set_permit_end(date) to authenticated;

-- ---------- Alerte crue (avec l'alerte du matin) ----------
alter table public.alert_prefs add column if not exists flood boolean not null default true;

-- ---------- Rappel d'amorçage pendant une session carpe ----------
alter table public.carp_sessions add column if not exists bait_every_min int check (bait_every_min between 10 and 600);
alter table public.carp_sessions add column if not exists next_bait_at timestamptz;
create index if not exists carp_sessions_bait on public.carp_sessions (next_bait_at) where ended_at is null;

-- ---------- Traces GPS ----------
create table if not exists public.tracks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  group_id bigint references public.groups (id) on delete set null,
  title text check (char_length(title) <= 80),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  points jsonb not null,
  bites jsonb not null default '[]',
  distance_m numeric,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) <= 20000)
);
create index if not exists tracks_user on public.tracks (user_id, started_at desc);
alter table public.tracks enable row level security;
drop policy if exists tracks_select on public.tracks;
drop policy if exists tracks_write on public.tracks;
create policy tracks_select on public.tracks for select
  using (user_id = auth.uid() or (shared and group_id is not null and (public.is_member_of(group_id) or public.is_staff())));
create policy tracks_write on public.tracks for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and (group_id is null or public.is_member_of(group_id) or public.is_staff()));

-- ---------- Profondeurs et nature du fond (relevés des membres) ----------
create table if not exists public.depth_points (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  lat numeric not null check (lat between -90 and 90),
  lon numeric not null check (lon between -180 and 180),
  depth_m numeric check (depth_m > 0 and depth_m <= 200),
  bottom text check (char_length(bottom) <= 40),
  note text check (char_length(note) <= 160),
  created_at timestamptz not null default now(),
  check (depth_m is not null or bottom is not null)
);
create index if not exists depth_group on public.depth_points (group_id);
alter table public.depth_points enable row level security;
drop policy if exists depth_select on public.depth_points;
drop policy if exists depth_insert on public.depth_points;
drop policy if exists depth_delete on public.depth_points;
create policy depth_select on public.depth_points for select using (public.is_staff() or public.is_member_of(group_id));
create policy depth_insert on public.depth_points for insert with check (user_id = auth.uid() and public.is_member_of(group_id));
create policy depth_delete on public.depth_points for delete using (user_id = auth.uid() or public.can_moderate(group_id));

-- ---------- Rappel d'amorçage : vérification toutes les 2 minutes ----------
do $$ begin perform cron.unschedule('cdj-amorcage'); exception when others then null; end $$;
select cron.schedule('cdj-amorcage','*/2 * * * *', $$ select public.call_notify('{"table":"bait_reminders"}'::jsonb) where exists (select 1 from public.carp_sessions where ended_at is null and next_bait_at <= now()) $$);


-- ===== Lot 7 (v30) =====
-- Coup du Jour lot 7 : surveillance des crues mesurées, bilan lié à une trace, zones sur la carte, stock d'appâts

-- surveillance des stations Hub'Eau (alerte « l'eau monte vite »)
alter table public.alert_prefs add column if not exists flood_sent_at timestamptz;

-- bilan pré-rempli depuis une trace GPS
alter table public.sessions add column if not exists track_id bigint references public.tracks (id) on delete set null;
alter table public.sessions add column if not exists duration_min int check (duration_min between 0 and 10000);
alter table public.sessions add column if not exists distance_m numeric check (distance_m >= 0 and distance_m <= 500000);
alter table public.sessions add column if not exists bites int check (bites between 0 and 1000);

-- zones dessinées par les membres
create table if not exists public.map_zones (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('reserve', 'nokill', 'nuit', 'mise_eau', 'danger', 'autre')),
  name text check (char_length(name) <= 60),
  note text check (char_length(note) <= 300),
  geom jsonb not null check (jsonb_typeof(geom) = 'object' and jsonb_array_length(geom -> 'coords') between 1 and 400),
  created_at timestamptz not null default now()
);
create index if not exists map_zones_group on public.map_zones (group_id);
alter table public.map_zones enable row level security;
drop policy if exists zones_select on public.map_zones;
drop policy if exists zones_insert on public.map_zones;
drop policy if exists zones_update on public.map_zones;
drop policy if exists zones_delete on public.map_zones;
create policy zones_select on public.map_zones for select using (public.is_staff() or public.is_member_of(group_id));
create policy zones_insert on public.map_zones for insert with check (user_id = auth.uid() and (public.is_member_of(group_id) or public.is_staff()));
create policy zones_update on public.map_zones for update using (user_id = auth.uid() or public.can_moderate(group_id)) with check (user_id = auth.uid() or public.can_moderate(group_id));
create policy zones_delete on public.map_zones for delete using (user_id = auth.uid() or public.can_moderate(group_id));

-- stock d'appâts personnel
create table if not exists public.bait_stock (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  unit text not null default 'kg' check (unit in ('kg', 'g', 'L', 'sachets', 'boîtes', 'pots', 'pièces')),
  qty numeric not null default 0 check (qty >= 0 and qty <= 100000),
  low_at numeric check (low_at >= 0 and low_at <= 100000),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists bait_stock_user on public.bait_stock (user_id);
alter table public.bait_stock enable row level security;
drop policy if exists stock_own on public.bait_stock;
create policy stock_own on public.bait_stock for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- vérification des stations toutes les heures
do $$ begin perform cron.unschedule('cdj-crue'); exception when others then null; end $$;
select cron.schedule('cdj-crue', '20 * * * *', $c$ select public.call_notify('{"table":"flood_watch"}'::jsonb) where exists (select 1 from public.alert_prefs where flood and lat is not null) $c$);


-- ===== Lot 8 (v32) =====
-- Coup du Jour lot 8 : « Je pars pêcher », potes à proximité

create table if not exists public.checkins (
  id bigint generated always as identity primary key,
  group_id bigint references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'session' check (kind in ('session', 'trace', 'live')),
  announce boolean not null default false,
  spot_id bigint references public.spots (id) on delete set null,
  place text check (char_length(place) <= 80),
  lat numeric not null check (lat between -90 and 90),
  lon numeric not null check (lon between -180 and 180),
  note text check (char_length(note) <= 140),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '4 hours',
  ended_at timestamptz,
  check (ends_at > started_at and ends_at <= started_at + interval '3 days')
);
create index if not exists checkins_active on public.checkins (group_id, ends_at) where ended_at is null;
create index if not exists checkins_user on public.checkins (user_id, started_at desc);
alter table public.checkins enable row level security;
drop policy if exists checkins_select on public.checkins;
drop policy if exists checkins_insert on public.checkins;
drop policy if exists checkins_update on public.checkins;
drop policy if exists checkins_delete on public.checkins;
-- visible par les membres du groupe ; un signalement discret (sans groupe) seulement par son auteur
create policy checkins_select on public.checkins for select
  using (user_id = auth.uid() or (group_id is not null and announce and (public.is_member_of(group_id) or public.is_staff())));
create policy checkins_insert on public.checkins for insert
  with check (user_id = auth.uid() and (group_id is null or public.is_member_of(group_id)));
create policy checkins_update on public.checkins for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy checkins_delete on public.checkins for delete using (user_id = auth.uid());

drop trigger if exists checkins_notify on public.checkins;
create trigger checkins_notify after insert on public.checkins for each row execute function public.notify_new();

-- préférences « potes à proximité » : rayon de réception (0 = jamais) et partage de mes sorties discrètes
alter table public.profiles add column if not exists nearby_km int not null default 15 check (nearby_km between 0 and 60);
alter table public.profiles add column if not exists nearby_share boolean not null default true;
create or replace function public.set_nearby(p_km int, p_share boolean) returns void
language sql security definer set search_path = public as $$
  update public.profiles set nearby_km = greatest(0, least(60, p_km)), nearby_share = coalesce(p_share, true) where id = auth.uid();
$$;
revoke all on function public.set_nearby(int, boolean) from public, anon;
grant execute on function public.set_nearby(int, boolean) to authenticated;


-- ===== Lot 9 (0.36) =====
-- réactions supplémentaires (appui long)
alter table public.reactions drop constraint if exists reactions_emoji_check;
alter table public.reactions add constraint reactions_emoji_check check (emoji in ('fire','clap','fish','heart','wow','lol','muscle','jealous'));


-- ===== Durcissement (0.38) =====
revoke execute on function public.can_manage(bigint), public.can_moderate(bigint), public.is_admin(), public.is_controller(),
  public.is_member_of(bigint), public.is_mod_of(bigint), public.is_owner_of(bigint), public.is_pending_in(bigint), public.is_staff(),
  public.poll_group(bigint), public.post_group(bigint), public.shares_group(uuid) from anon, public;
grant execute on function public.can_manage(bigint), public.can_moderate(bigint), public.is_admin(), public.is_controller(),
  public.is_member_of(bigint), public.is_mod_of(bigint), public.is_owner_of(bigint), public.is_pending_in(bigint), public.is_staff(),
  public.poll_group(bigint), public.post_group(bigint), public.shares_group(uuid) to authenticated, service_role;
revoke execute on function public.memo_guard(), public.set_post_status(), public.rls_auto_enable() from anon, authenticated, public;
revoke execute on function public.admin_groups(), public.admin_members(bigint), public.admin_save_group(bigint, text, text, text) from anon, public;
