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
