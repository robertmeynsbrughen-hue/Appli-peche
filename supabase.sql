-- =====================================================================
-- Coup du Jour : installation de la base Supabase
-- 1) Remplace CHANGE-MOI ci-dessous par le code de ton groupe
-- 2) Colle tout ce fichier dans Supabase > SQL Editor > New query > Run
-- =====================================================================

-- Code d'invitation du groupe (illisible depuis l'appli)
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  invite_code text not null
);
insert into public.config (id, invite_code) values (1, 'CHANGE-MOI')
  on conflict (id) do update set invite_code = excluded.invite_code;
alter table public.config enable row level security;

-- Profils (membres du groupe)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.check_invite(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_code = (select invite_code from public.config where id = 1);
$$;

create or replace function public.join_group(p_code text, p_username text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if not public.check_invite(p_code) then raise exception 'code invalide'; end if;
  insert into public.profiles (id, username) values (auth.uid(), p_username)
    on conflict (id) do nothing;
end;
$$;

revoke all on function public.join_group(text, text) from public, anon;
grant execute on function public.join_group(text, text) to authenticated;
grant execute on function public.check_invite(text) to anon, authenticated;

drop policy if exists "membres lisent les profils" on public.profiles;
create policy "membres lisent les profils" on public.profiles
  for select using (public.is_member());

-- Spots
create table if not exists public.spots (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  note text check (char_length(note) <= 400),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  created_at timestamptz not null default now()
);
alter table public.spots enable row level security;
drop policy if exists "membres lisent les spots" on public.spots;
drop policy if exists "membres ajoutent des spots" on public.spots;
drop policy if exists "auteur supprime son spot" on public.spots;
create policy "membres lisent les spots" on public.spots for select using (public.is_member());
create policy "membres ajoutent des spots" on public.spots for insert
  with check (public.is_member() and user_id = auth.uid());
create policy "auteur supprime son spot" on public.spots for delete using (user_id = auth.uid());

-- Publications
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  caption text check (char_length(caption) <= 500),
  species text check (char_length(species) <= 30),
  photo_path text,
  spot_id bigint references public.spots (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
drop policy if exists "membres lisent les posts" on public.posts;
drop policy if exists "membres publient" on public.posts;
drop policy if exists "auteur supprime son post" on public.posts;
create policy "membres lisent les posts" on public.posts for select using (public.is_member());
create policy "membres publient" on public.posts for insert
  with check (public.is_member() and user_id = auth.uid());
create policy "auteur supprime son post" on public.posts for delete using (user_id = auth.uid());

-- Photos (stockage privé, visible des seuls membres)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('photos', 'photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;

drop policy if exists "membres voient les photos" on storage.objects;
drop policy if exists "membres envoient leurs photos" on storage.objects;
drop policy if exists "auteur supprime ses photos" on storage.objects;
create policy "membres voient les photos" on storage.objects for select
  using (bucket_id = 'photos' and public.is_member());
create policy "membres envoient leurs photos" on storage.objects for insert
  with check (bucket_id = 'photos' and public.is_member() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "auteur supprime ses photos" on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
