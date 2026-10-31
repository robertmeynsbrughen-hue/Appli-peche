-- 0001_baseline — schéma complet, tel qu'il existe en production au 31/10/2026.
-- Généré depuis pg_catalog. Rejouable. Ne pas éditer à la main :
-- les évolutions vont dans 0002_*.sql, 0003_*.sql, etc.

create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now(),
  notes text
);

-- Rivio — schéma complet, reconstruit depuis la base de production
-- Généré le 2026-10-31 à partir du catalogue PostgreSQL (pg_catalog),
-- et non du fichier supabase.sql historique, qui avait pris du retard.
-- Objectif : pouvoir recréer la base à l'identique. Tout est idempotent :
-- le script peut être rejoué sans erreur sur une base existante.

set client_min_messages = warning;

-- ─────────────────────────── Extensions ───────────────────────────
-- Supabase en fournit certaines nativement ; on tolère leur absence.
do $$ begin create extension if not exists "pg_cron"; exception when others then raise warning 'extension pg_cron indisponible'; end $$;
do $$ begin create extension if not exists "pg_net"; exception when others then raise warning 'extension pg_net indisponible'; end $$;
do $$ begin create extension if not exists "pgcrypto"; exception when others then raise warning 'extension pgcrypto indisponible'; end $$;
do $$ begin create extension if not exists "supabase_vault"; exception when others then raise warning 'extension supabase_vault indisponible'; end $$;
do $$ begin create extension if not exists "uuid-ossp"; exception when others then raise warning 'extension uuid-ossp indisponible'; end $$;

-- ─────────────────────────── Schémas ───────────────────────────
create schema if not exists backup;

-- ─────────────────────────── Types énumérés ───────────────────────────

-- ─────────────────────────── Tables ───────────────────────────
create table if not exists backup.snapshots (
  id bigint generated always as identity not null,
  snap date not null,
  tbl text not null,
  data jsonb not null,
  constraint snapshots_pkey PRIMARY KEY (id)
);
create table if not exists public.alert_prefs (
  user_id uuid default auth.uid() not null,
  enabled boolean default true not null,
  lat numeric,
  lon numeric,
  place text,
  species text[] default '{}'::text[] not null,
  threshold integer default 70 not null,
  water text default 'etang'::text not null,
  opening boolean default true not null,
  last_sent date,
  updated_at timestamp with time zone default now() not null,
  flood boolean default true not null,
  flood_sent_at timestamp with time zone,
  constraint alert_prefs_pkey PRIMARY KEY (user_id)
);
create table if not exists public.bait_stock (
  id bigint generated always as identity not null,
  user_id uuid default auth.uid() not null,
  name text not null,
  unit text default 'kg'::text not null,
  qty numeric default 0 not null,
  low_at numeric,
  updated_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null,
  constraint bait_stock_pkey PRIMARY KEY (id)
);
create table if not exists public.baitings (
  id bigint generated always as identity not null,
  user_id uuid default auth.uid() not null,
  group_id bigint,
  spot_id bigint,
  at timestamp with time zone default now() not null,
  mix text[] default '{}'::text[] not null,
  qty_kg numeric,
  note text,
  created_at timestamp with time zone default now() not null,
  constraint baitings_pkey PRIMARY KEY (id)
);
create table if not exists public.carp_events (
  id bigint generated always as identity not null,
  session_id bigint not null,
  kind text not null,
  at timestamp with time zone default now() not null,
  rod integer,
  weight_kg numeric,
  note text,
  constraint carp_events_pkey PRIMARY KEY (id)
);
create table if not exists public.carp_sessions (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  spot_id bigint,
  rods integer default 2 not null,
  bait text,
  groundbait text,
  started_at timestamp with time zone default now() not null,
  ended_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  bait_every_min integer,
  next_bait_at timestamp with time zone,
  storm_sent_at timestamp with time zone,
  constraint carp_sessions_pkey PRIMARY KEY (id)
);
create table if not exists public.challenges (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  title text not null,
  species text,
  min_length numeric,
  month date default (date_trunc('month'::text, now()))::date not null,
  created_at timestamp with time zone default now() not null,
  constraint challenges_pkey PRIMARY KEY (id)
);
create table if not exists public.checkins (
  id bigint generated always as identity not null,
  group_id bigint,
  user_id uuid default auth.uid() not null,
  kind text default 'session'::text not null,
  announce boolean default false not null,
  spot_id bigint,
  place text,
  lat numeric not null,
  lon numeric not null,
  note text,
  started_at timestamp with time zone default now() not null,
  ends_at timestamp with time zone default (now() + '04:00:00'::interval) not null,
  ended_at timestamp with time zone,
  storm_sent_at timestamp with time zone,
  constraint checkins_pkey PRIMARY KEY (id)
);
create table if not exists public.comments (
  id bigint generated always as identity not null,
  post_id bigint not null,
  user_id uuid default auth.uid() not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  constraint comments_pkey PRIMARY KEY (id)
);
create table if not exists public.competitions (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  title text not null,
  mode text default 'points'::text not null,
  species text,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  constraint competitions_pkey PRIMARY KEY (id)
);
create table if not exists public.depth_points (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  lat numeric not null,
  lon numeric not null,
  depth_m numeric,
  bottom text,
  note text,
  created_at timestamp with time zone default now() not null,
  constraint depth_points_pkey PRIMARY KEY (id)
);
create table if not exists public.env_reports (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  kind text not null,
  lat double precision not null,
  lon double precision not null,
  place text,
  details text,
  photo_path text,
  status text default 'ouvert'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone,
  constraint env_reports_pkey PRIMARY KEY (id)
);
create table if not exists public.fish_events (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  kind text not null,
  title text not null,
  start_date date not null,
  end_date date,
  place text,
  url text,
  note text,
  created_at timestamp with time zone default now() not null,
  constraint fish_events_pkey PRIMARY KEY (id)
);
create table if not exists public.gear_items (
  id bigint generated always as identity not null,
  user_id uuid default auth.uid() not null,
  kit text default 'Général'::text not null,
  name text not null,
  checked boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint gear_items_pkey PRIMARY KEY (id)
);
create table if not exists public.groups (
  id bigint generated always as identity not null,
  name text not null,
  region text,
  invite_code text not null,
  created_at timestamp with time zone default now() not null,
  require_approval boolean default false not null,
  post_approval boolean default false not null,
  constraint groups_pkey PRIMARY KEY (id)
);
create table if not exists public.invite_attempts (
  id bigint generated always as identity not null,
  who text not null,
  at timestamp with time zone default now() not null,
  constraint invite_attempts_pkey PRIMARY KEY (id)
);
create table if not exists public.live_positions (
  user_id uuid default auth.uid() not null,
  group_id bigint not null,
  lat numeric not null,
  lon numeric not null,
  accuracy integer,
  updated_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '02:00:00'::interval) not null,
  constraint live_positions_pkey PRIMARY KEY (user_id)
);
create table if not exists public.lures (
  id bigint generated always as identity not null,
  user_id uuid default auth.uid() not null,
  name text not null,
  kind text,
  color text,
  weight_g numeric,
  photo_path text,
  notes text,
  created_at timestamp with time zone default now() not null,
  constraint lures_pkey PRIMARY KEY (id)
);
create table if not exists public.map_zones (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  kind text not null,
  name text,
  note text,
  geom jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint map_zones_pkey PRIMARY KEY (id)
);
create table if not exists public.memberships (
  group_id bigint not null,
  user_id uuid not null,
  joined_at timestamp with time zone default now() not null,
  role text default 'member'::text not null,
  status text default 'active'::text not null,
  constraint memberships_pkey PRIMARY KEY (group_id, user_id)
);
create table if not exists public.memos (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  title text not null,
  body text,
  link text,
  photo_path text,
  pinned boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint memos_pkey PRIMARY KEY (id)
);
create table if not exists public.messages (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  body text,
  created_at timestamp with time zone default now() not null,
  photo_path text,
  audio_path text,
  audio_secs integer,
  constraint messages_pkey PRIMARY KEY (id)
);
create table if not exists public.notifications (
  id bigint generated always as identity not null,
  user_id uuid not null,
  title text not null,
  body text,
  url text,
  tag text,
  created_at timestamp with time zone default now() not null,
  read_at timestamp with time zone,
  constraint notifications_pkey PRIMARY KEY (id)
);
create table if not exists public.outing_rsvps (
  outing_id bigint not null,
  user_id uuid default auth.uid() not null,
  status text default 'yes'::text not null,
  seats integer default 0 not null,
  needs_ride boolean default false not null,
  brings text,
  updated_at timestamp with time zone default now() not null,
  constraint outing_rsvps_pkey PRIMARY KEY (outing_id, user_id)
);
create table if not exists public.outings (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  title text not null,
  place text,
  spot_id bigint,
  start_at timestamp with time zone not null,
  notes text,
  reminded boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint outings_pkey PRIMARY KEY (id)
);
create table if not exists public.photo_votes (
  group_id bigint not null,
  month date not null,
  user_id uuid default auth.uid() not null,
  post_id bigint not null,
  created_at timestamp with time zone default now() not null,
  constraint photo_votes_pkey PRIMARY KEY (group_id, month, user_id)
);
create table if not exists public.poll_votes (
  poll_id bigint not null,
  user_id uuid default auth.uid() not null,
  choice text not null,
  voted_at timestamp with time zone default now() not null,
  constraint poll_votes_pkey PRIMARY KEY (poll_id, user_id)
);
create table if not exists public.polls (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  question text not null,
  place text,
  event_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint polls_pkey PRIMARY KEY (id)
);
create table if not exists public.post_shares (
  token uuid default gen_random_uuid() not null,
  post_id bigint not null,
  user_id uuid default auth.uid() not null,
  show_spot boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint post_shares_pkey PRIMARY KEY (token)
);
create table if not exists public.posts (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  caption text,
  species text,
  photo_path text,
  spot_id bigint,
  created_at timestamp with time zone default now() not null,
  length_cm numeric,
  weight_kg numeric,
  bait text,
  photo_paths text[],
  status text default 'published'::text not null,
  conditions jsonb,
  released boolean,
  constraint posts_pkey PRIMARY KEY (id)
);
create table if not exists public.profiles (
  id uuid not null,
  username text not null,
  is_admin boolean default false not null,
  created_at timestamp with time zone default now() not null,
  bio text,
  fav_species text[] default '{}'::text[] not null,
  avatar_path text,
  is_controller boolean default false not null,
  permit_end date,
  nearby_km integer default 15 not null,
  nearby_share boolean default true not null,
  pw_temp boolean default false not null,
  constraint profiles_pkey PRIMARY KEY (id)
);
create table if not exists public.push_subs (
  endpoint text not null,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now() not null,
  constraint push_subs_pkey PRIMARY KEY (endpoint)
);
create table if not exists public.reactions (
  post_id bigint not null,
  user_id uuid default auth.uid() not null,
  emoji text not null,
  created_at timestamp with time zone default now() not null,
  constraint reactions_pkey PRIMARY KEY (post_id, user_id, emoji)
);
create table if not exists public.reports (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  kind text not null,
  target_id bigint not null,
  excerpt text,
  author_id uuid,
  reason text not null,
  status text default 'open'::text not null,
  handled_by uuid,
  created_at timestamp with time zone default now() not null,
  constraint reports_pkey PRIMARY KEY (id)
);
create table if not exists public.sessions (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  species text,
  caught boolean default true not null,
  length_cm numeric,
  lure text,
  color text,
  rating smallint not null,
  water_type text,
  created_at timestamp with time zone default now() not null,
  conditions jsonb,
  track_id bigint,
  duration_min integer,
  distance_m numeric,
  bites integer,
  released boolean,
  constraint sessions_pkey PRIMARY KEY (id)
);
create table if not exists public.settings (
  id integer default 1 not null,
  admin_username text not null,
  constraint settings_pkey PRIMARY KEY (id)
);
create table if not exists public.spots (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  name text not null,
  note text,
  lat double precision not null,
  lon double precision not null,
  created_at timestamp with time zone default now() not null,
  depth_m numeric,
  distance_tours integer,
  bottom text,
  details text,
  sheet_updated_at timestamp with time zone,
  sheet_updated_by uuid,
  facing smallint,
  constraint spots_pkey PRIMARY KEY (id)
);
create table if not exists public.structures (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  kind text not null,
  lat double precision not null,
  lon double precision not null,
  note text,
  created_at timestamp with time zone default now() not null,
  constraint structures_pkey PRIMARY KEY (id)
);
create table if not exists public.tracks (
  id bigint generated always as identity not null,
  user_id uuid default auth.uid() not null,
  group_id bigint,
  title text,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone not null,
  points jsonb not null,
  bites jsonb default '[]'::jsonb not null,
  distance_m numeric,
  shared boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint tracks_pkey PRIMARY KEY (id)
);
create table if not exists public.wake_alarms (
  id bigint generated always as identity not null,
  user_id uuid default auth.uid() not null,
  fire_at timestamp with time zone not null,
  title text not null,
  body text,
  spot_id bigint,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  url text,
  constraint wake_alarms_pkey PRIMARY KEY (id)
);
create table if not exists public.water_reports (
  id bigint generated always as identity not null,
  group_id bigint not null,
  user_id uuid default auth.uid() not null,
  spot_id bigint,
  lat double precision not null,
  lon double precision not null,
  color text,
  level text,
  temp numeric,
  weeds boolean,
  note text,
  created_at timestamp with time zone default now() not null,
  constraint water_reports_pkey PRIMARY KEY (id)
);

-- ─────────────────────────── Contraintes (FK, unique, check) ───────────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'alert_prefs_lat_check' and conrelid = 'public.alert_prefs'::regclass) then
    alter table public.alert_prefs add constraint alert_prefs_lat_check CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'alert_prefs_lon_check' and conrelid = 'public.alert_prefs'::regclass) then
    alter table public.alert_prefs add constraint alert_prefs_lon_check CHECK (((lon >= ('-180'::integer)::numeric) AND (lon <= (180)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'alert_prefs_place_check' and conrelid = 'public.alert_prefs'::regclass) then
    alter table public.alert_prefs add constraint alert_prefs_place_check CHECK ((char_length(place) <= 60));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'alert_prefs_threshold_check' and conrelid = 'public.alert_prefs'::regclass) then
    alter table public.alert_prefs add constraint alert_prefs_threshold_check CHECK (((threshold >= 40) AND (threshold <= 95)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'alert_prefs_water_check' and conrelid = 'public.alert_prefs'::regclass) then
    alter table public.alert_prefs add constraint alert_prefs_water_check CHECK ((water = ANY (ARRAY['etang'::text, 'riviere'::text, 'canal'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'alert_prefs_user_id_fkey' and conrelid = 'public.alert_prefs'::regclass) then
    alter table public.alert_prefs add constraint alert_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bait_stock_low_at_check' and conrelid = 'public.bait_stock'::regclass) then
    alter table public.bait_stock add constraint bait_stock_low_at_check CHECK (((low_at >= (0)::numeric) AND (low_at <= (100000)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bait_stock_name_check' and conrelid = 'public.bait_stock'::regclass) then
    alter table public.bait_stock add constraint bait_stock_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 60)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bait_stock_qty_check' and conrelid = 'public.bait_stock'::regclass) then
    alter table public.bait_stock add constraint bait_stock_qty_check CHECK (((qty >= (0)::numeric) AND (qty <= (100000)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bait_stock_unit_check' and conrelid = 'public.bait_stock'::regclass) then
    alter table public.bait_stock add constraint bait_stock_unit_check CHECK ((unit = ANY (ARRAY['kg'::text, 'g'::text, 'L'::text, 'sachets'::text, 'boîtes'::text, 'pots'::text, 'pièces'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bait_stock_user_id_fkey' and conrelid = 'public.bait_stock'::regclass) then
    alter table public.bait_stock add constraint bait_stock_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'baitings_mix_check' and conrelid = 'public.baitings'::regclass) then
    alter table public.baitings add constraint baitings_mix_check CHECK ((cardinality(mix) <= 10));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'baitings_note_check' and conrelid = 'public.baitings'::regclass) then
    alter table public.baitings add constraint baitings_note_check CHECK ((char_length(note) <= 300));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'baitings_qty_kg_check' and conrelid = 'public.baitings'::regclass) then
    alter table public.baitings add constraint baitings_qty_kg_check CHECK (((qty_kg > (0)::numeric) AND (qty_kg <= (200)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'baitings_group_id_fkey' and conrelid = 'public.baitings'::regclass) then
    alter table public.baitings add constraint baitings_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'baitings_spot_id_fkey' and conrelid = 'public.baitings'::regclass) then
    alter table public.baitings add constraint baitings_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'baitings_user_id_fkey' and conrelid = 'public.baitings'::regclass) then
    alter table public.baitings add constraint baitings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_events_kind_check' and conrelid = 'public.carp_events'::regclass) then
    alter table public.carp_events add constraint carp_events_kind_check CHECK ((kind = ANY (ARRAY['depart'::text, 'touche'::text, 'prise'::text, 'amorcage'::text, 'relance'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_events_note_check' and conrelid = 'public.carp_events'::regclass) then
    alter table public.carp_events add constraint carp_events_note_check CHECK ((char_length(note) <= 200));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_events_rod_check' and conrelid = 'public.carp_events'::regclass) then
    alter table public.carp_events add constraint carp_events_rod_check CHECK (((rod >= 1) AND (rod <= 6)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_events_weight_kg_check' and conrelid = 'public.carp_events'::regclass) then
    alter table public.carp_events add constraint carp_events_weight_kg_check CHECK (((weight_kg > (0)::numeric) AND (weight_kg < (60)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_events_session_id_fkey' and conrelid = 'public.carp_events'::regclass) then
    alter table public.carp_events add constraint carp_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES carp_sessions(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_sessions_bait_check' and conrelid = 'public.carp_sessions'::regclass) then
    alter table public.carp_sessions add constraint carp_sessions_bait_check CHECK ((char_length(bait) <= 120));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_sessions_bait_every_min_check' and conrelid = 'public.carp_sessions'::regclass) then
    alter table public.carp_sessions add constraint carp_sessions_bait_every_min_check CHECK (((bait_every_min >= 10) AND (bait_every_min <= 600)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_sessions_groundbait_check' and conrelid = 'public.carp_sessions'::regclass) then
    alter table public.carp_sessions add constraint carp_sessions_groundbait_check CHECK ((char_length(groundbait) <= 200));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_sessions_rods_check' and conrelid = 'public.carp_sessions'::regclass) then
    alter table public.carp_sessions add constraint carp_sessions_rods_check CHECK (((rods >= 1) AND (rods <= 6)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_sessions_group_id_fkey' and conrelid = 'public.carp_sessions'::regclass) then
    alter table public.carp_sessions add constraint carp_sessions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_sessions_spot_id_fkey' and conrelid = 'public.carp_sessions'::regclass) then
    alter table public.carp_sessions add constraint carp_sessions_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'carp_sessions_user_id_fkey' and conrelid = 'public.carp_sessions'::regclass) then
    alter table public.carp_sessions add constraint carp_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'challenges_min_length_check' and conrelid = 'public.challenges'::regclass) then
    alter table public.challenges add constraint challenges_min_length_check CHECK (((min_length > (0)::numeric) AND (min_length <= (300)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'challenges_species_check' and conrelid = 'public.challenges'::regclass) then
    alter table public.challenges add constraint challenges_species_check CHECK ((char_length(species) <= 30));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'challenges_title_check' and conrelid = 'public.challenges'::regclass) then
    alter table public.challenges add constraint challenges_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 80)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'challenges_group_id_fkey' and conrelid = 'public.challenges'::regclass) then
    alter table public.challenges add constraint challenges_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'challenges_user_id_fkey' and conrelid = 'public.challenges'::regclass) then
    alter table public.challenges add constraint challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_check' and conrelid = 'public.checkins'::regclass) then
    alter table public.checkins add constraint checkins_check CHECK (((ends_at > started_at) AND (ends_at <= (started_at + '3 days'::interval))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_kind_check' and conrelid = 'public.checkins'::regclass) then
    alter table public.checkins add constraint checkins_kind_check CHECK ((kind = ANY (ARRAY['session'::text, 'trace'::text, 'live'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_lat_check' and conrelid = 'public.checkins'::regclass) then
    alter table public.checkins add constraint checkins_lat_check CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_lon_check' and conrelid = 'public.checkins'::regclass) then
    alter table public.checkins add constraint checkins_lon_check CHECK (((lon >= ('-180'::integer)::numeric) AND (lon <= (180)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_note_check' and conrelid = 'public.checkins'::regclass) then
    alter table public.checkins add constraint checkins_note_check CHECK ((char_length(note) <= 140));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_place_check' and conrelid = 'public.checkins'::regclass) then
    alter table public.checkins add constraint checkins_place_check CHECK ((char_length(place) <= 80));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_group_id_fkey' and conrelid = 'public.checkins'::regclass) then
    alter table public.checkins add constraint checkins_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_spot_id_fkey' and conrelid = 'public.checkins'::regclass) then
    alter table public.checkins add constraint checkins_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'checkins_user_id_fkey' and conrelid = 'public.checkins'::regclass) then
    alter table public.checkins add constraint checkins_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'comments_body_check' and conrelid = 'public.comments'::regclass) then
    alter table public.comments add constraint comments_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 500)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'comments_post_id_fkey' and conrelid = 'public.comments'::regclass) then
    alter table public.comments add constraint comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'comments_user_id_fkey' and conrelid = 'public.comments'::regclass) then
    alter table public.comments add constraint comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'competitions_check' and conrelid = 'public.competitions'::regclass) then
    alter table public.competitions add constraint competitions_check CHECK (((end_at > start_at) AND (end_at <= (start_at + '31 days'::interval))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'competitions_mode_check' and conrelid = 'public.competitions'::regclass) then
    alter table public.competitions add constraint competitions_mode_check CHECK ((mode = ANY (ARRAY['points'::text, 'biggest'::text, 'count'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'competitions_species_check' and conrelid = 'public.competitions'::regclass) then
    alter table public.competitions add constraint competitions_species_check CHECK ((char_length(species) <= 30));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'competitions_title_check' and conrelid = 'public.competitions'::regclass) then
    alter table public.competitions add constraint competitions_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 80)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'competitions_group_id_fkey' and conrelid = 'public.competitions'::regclass) then
    alter table public.competitions add constraint competitions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'competitions_user_id_fkey' and conrelid = 'public.competitions'::regclass) then
    alter table public.competitions add constraint competitions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'depth_points_bottom_check' and conrelid = 'public.depth_points'::regclass) then
    alter table public.depth_points add constraint depth_points_bottom_check CHECK ((char_length(bottom) <= 40));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'depth_points_check' and conrelid = 'public.depth_points'::regclass) then
    alter table public.depth_points add constraint depth_points_check CHECK (((depth_m IS NOT NULL) OR (bottom IS NOT NULL)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'depth_points_depth_m_check' and conrelid = 'public.depth_points'::regclass) then
    alter table public.depth_points add constraint depth_points_depth_m_check CHECK (((depth_m > (0)::numeric) AND (depth_m <= (200)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'depth_points_lat_check' and conrelid = 'public.depth_points'::regclass) then
    alter table public.depth_points add constraint depth_points_lat_check CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'depth_points_lon_check' and conrelid = 'public.depth_points'::regclass) then
    alter table public.depth_points add constraint depth_points_lon_check CHECK (((lon >= ('-180'::integer)::numeric) AND (lon <= (180)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'depth_points_note_check' and conrelid = 'public.depth_points'::regclass) then
    alter table public.depth_points add constraint depth_points_note_check CHECK ((char_length(note) <= 160));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'depth_points_group_id_fkey' and conrelid = 'public.depth_points'::regclass) then
    alter table public.depth_points add constraint depth_points_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'depth_points_user_id_fkey' and conrelid = 'public.depth_points'::regclass) then
    alter table public.depth_points add constraint depth_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'env_reports_details_check' and conrelid = 'public.env_reports'::regclass) then
    alter table public.env_reports add constraint env_reports_details_check CHECK ((char_length(details) <= 600));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'env_reports_kind_check' and conrelid = 'public.env_reports'::regclass) then
    alter table public.env_reports add constraint env_reports_kind_check CHECK ((kind = ANY (ARRAY['pollution'::text, 'mortalite'::text, 'niveau'::text, 'obstacle'::text, 'dechets'::text, 'autre'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'env_reports_lat_check' and conrelid = 'public.env_reports'::regclass) then
    alter table public.env_reports add constraint env_reports_lat_check CHECK (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'env_reports_lon_check' and conrelid = 'public.env_reports'::regclass) then
    alter table public.env_reports add constraint env_reports_lon_check CHECK (((lon >= ('-180'::integer)::double precision) AND (lon <= (180)::double precision)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'env_reports_photo_path_check' and conrelid = 'public.env_reports'::regclass) then
    alter table public.env_reports add constraint env_reports_photo_path_check CHECK ((char_length(photo_path) <= 200));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'env_reports_place_check' and conrelid = 'public.env_reports'::regclass) then
    alter table public.env_reports add constraint env_reports_place_check CHECK ((char_length(place) <= 80));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'env_reports_status_check' and conrelid = 'public.env_reports'::regclass) then
    alter table public.env_reports add constraint env_reports_status_check CHECK ((status = ANY (ARRAY['ouvert'::text, 'transmis'::text, 'resolu'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'env_reports_group_id_fkey' and conrelid = 'public.env_reports'::regclass) then
    alter table public.env_reports add constraint env_reports_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'env_reports_user_id_fkey' and conrelid = 'public.env_reports'::regclass) then
    alter table public.env_reports add constraint env_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fish_events_check' and conrelid = 'public.fish_events'::regclass) then
    alter table public.fish_events add constraint fish_events_check CHECK (((end_date IS NULL) OR (end_date >= start_date)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fish_events_kind_check' and conrelid = 'public.fish_events'::regclass) then
    alter table public.fish_events add constraint fish_events_kind_check CHECK ((kind = ANY (ARRAY['concours'::text, 'enduro'::text, 'salon'::text, 'ouverture'::text, 'autre'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fish_events_note_check' and conrelid = 'public.fish_events'::regclass) then
    alter table public.fish_events add constraint fish_events_note_check CHECK ((char_length(note) <= 300));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fish_events_place_check' and conrelid = 'public.fish_events'::regclass) then
    alter table public.fish_events add constraint fish_events_place_check CHECK ((char_length(place) <= 80));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fish_events_title_check' and conrelid = 'public.fish_events'::regclass) then
    alter table public.fish_events add constraint fish_events_title_check CHECK (((char_length(title) >= 2) AND (char_length(title) <= 80)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fish_events_url_check' and conrelid = 'public.fish_events'::regclass) then
    alter table public.fish_events add constraint fish_events_url_check CHECK (((char_length(url) <= 300) AND (url ~ '^https?://'::text)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fish_events_group_id_fkey' and conrelid = 'public.fish_events'::regclass) then
    alter table public.fish_events add constraint fish_events_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fish_events_user_id_fkey' and conrelid = 'public.fish_events'::regclass) then
    alter table public.fish_events add constraint fish_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'gear_items_kit_check' and conrelid = 'public.gear_items'::regclass) then
    alter table public.gear_items add constraint gear_items_kit_check CHECK (((char_length(kit) >= 1) AND (char_length(kit) <= 40)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'gear_items_name_check' and conrelid = 'public.gear_items'::regclass) then
    alter table public.gear_items add constraint gear_items_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'gear_items_user_id_fkey' and conrelid = 'public.gear_items'::regclass) then
    alter table public.gear_items add constraint gear_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_invite_code_check' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_invite_code_check CHECK ((char_length(invite_code) >= 6));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_name_check' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 40)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_region_check' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_region_check CHECK ((char_length(region) <= 40));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_invite_code_key' and conrelid = 'public.groups'::regclass) then
    alter table public.groups add constraint groups_invite_code_key UNIQUE (invite_code);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'live_positions_lat_check' and conrelid = 'public.live_positions'::regclass) then
    alter table public.live_positions add constraint live_positions_lat_check CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'live_positions_lon_check' and conrelid = 'public.live_positions'::regclass) then
    alter table public.live_positions add constraint live_positions_lon_check CHECK (((lon >= ('-180'::integer)::numeric) AND (lon <= (180)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'live_positions_group_id_fkey' and conrelid = 'public.live_positions'::regclass) then
    alter table public.live_positions add constraint live_positions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'live_positions_user_id_fkey' and conrelid = 'public.live_positions'::regclass) then
    alter table public.live_positions add constraint live_positions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lures_color_check' and conrelid = 'public.lures'::regclass) then
    alter table public.lures add constraint lures_color_check CHECK ((char_length(color) <= 40));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lures_kind_check' and conrelid = 'public.lures'::regclass) then
    alter table public.lures add constraint lures_kind_check CHECK ((char_length(kind) <= 40));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lures_name_check' and conrelid = 'public.lures'::regclass) then
    alter table public.lures add constraint lures_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 60)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lures_notes_check' and conrelid = 'public.lures'::regclass) then
    alter table public.lures add constraint lures_notes_check CHECK ((char_length(notes) <= 300));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lures_photo_path_check' and conrelid = 'public.lures'::regclass) then
    alter table public.lures add constraint lures_photo_path_check CHECK ((char_length(photo_path) <= 200));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lures_weight_g_check' and conrelid = 'public.lures'::regclass) then
    alter table public.lures add constraint lures_weight_g_check CHECK (((weight_g > (0)::numeric) AND (weight_g < (1000)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lures_user_id_fkey' and conrelid = 'public.lures'::regclass) then
    alter table public.lures add constraint lures_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'map_zones_geom_check' and conrelid = 'public.map_zones'::regclass) then
    alter table public.map_zones add constraint map_zones_geom_check CHECK (((jsonb_typeof(geom) = 'object'::text) AND ((jsonb_array_length((geom -> 'coords'::text)) >= 1) AND (jsonb_array_length((geom -> 'coords'::text)) <= 400))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'map_zones_kind_check' and conrelid = 'public.map_zones'::regclass) then
    alter table public.map_zones add constraint map_zones_kind_check CHECK ((kind = ANY (ARRAY['reserve'::text, 'nokill'::text, 'nuit'::text, 'mise_eau'::text, 'danger'::text, 'frayere'::text, 'autre'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'map_zones_name_check' and conrelid = 'public.map_zones'::regclass) then
    alter table public.map_zones add constraint map_zones_name_check CHECK ((char_length(name) <= 60));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'map_zones_note_check' and conrelid = 'public.map_zones'::regclass) then
    alter table public.map_zones add constraint map_zones_note_check CHECK ((char_length(note) <= 300));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'map_zones_group_id_fkey' and conrelid = 'public.map_zones'::regclass) then
    alter table public.map_zones add constraint map_zones_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'map_zones_user_id_fkey' and conrelid = 'public.map_zones'::regclass) then
    alter table public.map_zones add constraint map_zones_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'memberships_role_check' and conrelid = 'public.memberships'::regclass) then
    alter table public.memberships add constraint memberships_role_check CHECK ((role = ANY (ARRAY['member'::text, 'moderator'::text, 'owner'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'memberships_status_check' and conrelid = 'public.memberships'::regclass) then
    alter table public.memberships add constraint memberships_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'memberships_group_id_fkey' and conrelid = 'public.memberships'::regclass) then
    alter table public.memberships add constraint memberships_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'memberships_user_id_fkey' and conrelid = 'public.memberships'::regclass) then
    alter table public.memberships add constraint memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'memos_body_check' and conrelid = 'public.memos'::regclass) then
    alter table public.memos add constraint memos_body_check CHECK ((char_length(body) <= 2000));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'memos_link_check' and conrelid = 'public.memos'::regclass) then
    alter table public.memos add constraint memos_link_check CHECK ((char_length(link) <= 300));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'memos_title_check' and conrelid = 'public.memos'::regclass) then
    alter table public.memos add constraint memos_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 80)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'memos_group_id_fkey' and conrelid = 'public.memos'::regclass) then
    alter table public.memos add constraint memos_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'memos_user_id_fkey' and conrelid = 'public.memos'::regclass) then
    alter table public.memos add constraint memos_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_audio_path' and conrelid = 'public.messages'::regclass) then
    alter table public.messages add constraint messages_audio_path CHECK (((audio_path IS NULL) OR (audio_path ~~ ((((group_id)::text || '/'::text) || (user_id)::text) || '/%'::text))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_audio_secs' and conrelid = 'public.messages'::regclass) then
    alter table public.messages add constraint messages_audio_secs CHECK (((audio_secs IS NULL) OR ((audio_secs >= 1) AND (audio_secs <= 180))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_body_len' and conrelid = 'public.messages'::regclass) then
    alter table public.messages add constraint messages_body_len CHECK (((body IS NULL) OR ((char_length(body) >= 1) AND (char_length(body) <= 1000))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_not_empty' and conrelid = 'public.messages'::regclass) then
    alter table public.messages add constraint messages_not_empty CHECK (((body IS NOT NULL) OR (photo_path IS NOT NULL) OR (audio_path IS NOT NULL)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_photo_path' and conrelid = 'public.messages'::regclass) then
    alter table public.messages add constraint messages_photo_path CHECK (((photo_path IS NULL) OR (photo_path ~~ ((((group_id)::text || '/'::text) || (user_id)::text) || '/%'::text))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_group_id_fkey' and conrelid = 'public.messages'::regclass) then
    alter table public.messages add constraint messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_user_id_fkey' and conrelid = 'public.messages'::regclass) then
    alter table public.messages add constraint messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_body_check' and conrelid = 'public.notifications'::regclass) then
    alter table public.notifications add constraint notifications_body_check CHECK ((char_length(body) <= 500));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_tag_check' and conrelid = 'public.notifications'::regclass) then
    alter table public.notifications add constraint notifications_tag_check CHECK ((char_length(tag) <= 80));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_title_check' and conrelid = 'public.notifications'::regclass) then
    alter table public.notifications add constraint notifications_title_check CHECK ((char_length(title) <= 200));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_url_check' and conrelid = 'public.notifications'::regclass) then
    alter table public.notifications add constraint notifications_url_check CHECK ((char_length(url) <= 60));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notifications_user_id_fkey' and conrelid = 'public.notifications'::regclass) then
    alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outing_rsvps_brings_check' and conrelid = 'public.outing_rsvps'::regclass) then
    alter table public.outing_rsvps add constraint outing_rsvps_brings_check CHECK ((char_length(brings) <= 120));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outing_rsvps_seats_check' and conrelid = 'public.outing_rsvps'::regclass) then
    alter table public.outing_rsvps add constraint outing_rsvps_seats_check CHECK (((seats >= 0) AND (seats <= 8)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outing_rsvps_status_check' and conrelid = 'public.outing_rsvps'::regclass) then
    alter table public.outing_rsvps add constraint outing_rsvps_status_check CHECK ((status = ANY (ARRAY['yes'::text, 'maybe'::text, 'no'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outing_rsvps_outing_id_fkey' and conrelid = 'public.outing_rsvps'::regclass) then
    alter table public.outing_rsvps add constraint outing_rsvps_outing_id_fkey FOREIGN KEY (outing_id) REFERENCES outings(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outing_rsvps_user_id_fkey' and conrelid = 'public.outing_rsvps'::regclass) then
    alter table public.outing_rsvps add constraint outing_rsvps_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outings_notes_check' and conrelid = 'public.outings'::regclass) then
    alter table public.outings add constraint outings_notes_check CHECK ((char_length(notes) <= 500));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outings_place_check' and conrelid = 'public.outings'::regclass) then
    alter table public.outings add constraint outings_place_check CHECK ((char_length(place) <= 80));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outings_title_check' and conrelid = 'public.outings'::regclass) then
    alter table public.outings add constraint outings_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 80)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outings_group_id_fkey' and conrelid = 'public.outings'::regclass) then
    alter table public.outings add constraint outings_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outings_spot_id_fkey' and conrelid = 'public.outings'::regclass) then
    alter table public.outings add constraint outings_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'outings_user_id_fkey' and conrelid = 'public.outings'::regclass) then
    alter table public.outings add constraint outings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'photo_votes_group_id_fkey' and conrelid = 'public.photo_votes'::regclass) then
    alter table public.photo_votes add constraint photo_votes_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'photo_votes_post_id_fkey' and conrelid = 'public.photo_votes'::regclass) then
    alter table public.photo_votes add constraint photo_votes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'photo_votes_user_id_fkey' and conrelid = 'public.photo_votes'::regclass) then
    alter table public.photo_votes add constraint photo_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'poll_votes_choice_check' and conrelid = 'public.poll_votes'::regclass) then
    alter table public.poll_votes add constraint poll_votes_choice_check CHECK ((choice = ANY (ARRAY['oui'::text, 'non'::text, 'peut-etre'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'poll_votes_poll_id_fkey' and conrelid = 'public.poll_votes'::regclass) then
    alter table public.poll_votes add constraint poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'poll_votes_user_id_fkey' and conrelid = 'public.poll_votes'::regclass) then
    alter table public.poll_votes add constraint poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'polls_place_check' and conrelid = 'public.polls'::regclass) then
    alter table public.polls add constraint polls_place_check CHECK ((char_length(place) <= 80));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'polls_question_check' and conrelid = 'public.polls'::regclass) then
    alter table public.polls add constraint polls_question_check CHECK (((char_length(question) >= 3) AND (char_length(question) <= 200)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'polls_group_id_fkey' and conrelid = 'public.polls'::regclass) then
    alter table public.polls add constraint polls_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'polls_user_id_fkey' and conrelid = 'public.polls'::regclass) then
    alter table public.polls add constraint polls_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'post_shares_post_id_fkey' and conrelid = 'public.post_shares'::regclass) then
    alter table public.post_shares add constraint post_shares_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'post_shares_user_id_fkey' and conrelid = 'public.post_shares'::regclass) then
    alter table public.post_shares add constraint post_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_bait_check' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_bait_check CHECK ((char_length(bait) <= 300));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_caption_check' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_caption_check CHECK ((char_length(caption) <= 500));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_length_cm_check' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_length_cm_check CHECK (((length_cm > (0)::numeric) AND (length_cm <= (300)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_photo_paths_check' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_photo_paths_check CHECK ((cardinality(photo_paths) <= 6));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_species_check' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_species_check CHECK ((char_length(species) <= 30));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_status_check' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_status_check CHECK ((status = ANY (ARRAY['published'::text, 'pending'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_weight_kg_check' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_weight_kg_check CHECK (((weight_kg > (0)::numeric) AND (weight_kg <= (150)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_group_id_fkey' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_spot_id_fkey' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_user_id_fkey' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_path_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_avatar_path_check CHECK ((char_length(avatar_path) <= 200));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_bio_check CHECK ((char_length(bio) <= 160));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_fav_species_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_fav_species_check CHECK ((cardinality(fav_species) <= 3));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_nearby_km_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_nearby_km_check CHECK (((nearby_km >= 0) AND (nearby_km <= 60)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_username_check CHECK ((username ~ '^[A-Za-z0-9_]{3,20}$'::text));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_id_fkey' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_key' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_username_key UNIQUE (username);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'push_subs_user_id_fkey' and conrelid = 'public.push_subs'::regclass) then
    alter table public.push_subs add constraint push_subs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reactions_emoji_check' and conrelid = 'public.reactions'::regclass) then
    alter table public.reactions add constraint reactions_emoji_check CHECK ((emoji = ANY (ARRAY['fire'::text, 'clap'::text, 'fish'::text, 'heart'::text, 'wow'::text, 'lol'::text, 'muscle'::text, 'jealous'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reactions_post_id_fkey' and conrelid = 'public.reactions'::regclass) then
    alter table public.reactions add constraint reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reactions_user_id_fkey' and conrelid = 'public.reactions'::regclass) then
    alter table public.reactions add constraint reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reports_excerpt_check' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_excerpt_check CHECK ((char_length(excerpt) <= 200));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reports_kind_check' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_kind_check CHECK ((kind = ANY (ARRAY['post'::text, 'comment'::text, 'message'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reports_reason_check' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_reason_check CHECK (((char_length(reason) >= 2) AND (char_length(reason) <= 200)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reports_status_check' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'dismissed'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reports_author_id_fkey' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reports_group_id_fkey' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reports_handled_by_fkey' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_handled_by_fkey FOREIGN KEY (handled_by) REFERENCES profiles(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reports_user_id_fkey' and conrelid = 'public.reports'::regclass) then
    alter table public.reports add constraint reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_bites_check' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_bites_check CHECK (((bites >= 0) AND (bites <= 1000)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_color_check' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_color_check CHECK ((char_length(color) <= 40));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_distance_m_check' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_distance_m_check CHECK (((distance_m >= (0)::numeric) AND (distance_m <= (500000)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_duration_min_check' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_duration_min_check CHECK (((duration_min >= 0) AND (duration_min <= 10000)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_length_cm_check' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_length_cm_check CHECK (((length_cm > (0)::numeric) AND (length_cm <= (300)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_lure_check' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_lure_check CHECK ((char_length(lure) <= 60));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_rating_check' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_rating_check CHECK (((rating >= 1) AND (rating <= 4)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_species_check' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_species_check CHECK ((char_length(species) <= 30));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_water_type_check' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_water_type_check CHECK ((water_type = ANY (ARRAY['etang'::text, 'riviere'::text, 'canal'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_group_id_fkey' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_track_id_fkey' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_track_id_fkey FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sessions_user_id_fkey' and conrelid = 'public.sessions'::regclass) then
    alter table public.sessions add constraint sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'settings_id_check' and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_id_check CHECK ((id = 1));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_bottom_check' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_bottom_check CHECK ((char_length(bottom) <= 40));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_depth_m_check' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_depth_m_check CHECK (((depth_m > (0)::numeric) AND (depth_m <= (100)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_details_check' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_details_check CHECK ((char_length(details) <= 1000));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_distance_tours_check' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_distance_tours_check CHECK (((distance_tours >= 1) AND (distance_tours <= 500)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_facing_check' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_facing_check CHECK (((facing >= 0) AND (facing <= 359)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_lat_check' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_lat_check CHECK (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_lon_check' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_lon_check CHECK (((lon >= ('-180'::integer)::double precision) AND (lon <= (180)::double precision)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_name_check' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 60)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_note_check' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_note_check CHECK ((char_length(note) <= 400));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_group_id_fkey' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_sheet_updated_by_fkey' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_sheet_updated_by_fkey FOREIGN KEY (sheet_updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'spots_user_id_fkey' and conrelid = 'public.spots'::regclass) then
    alter table public.spots add constraint spots_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'structures_kind_check' and conrelid = 'public.structures'::regclass) then
    alter table public.structures add constraint structures_kind_check CHECK ((kind = ANY (ARRAY['cassure'::text, 'bois'::text, 'herbier'::text, 'obstacle'::text, 'fosse'::text, 'arrivee'::text, 'courant'::text, 'haut_fond'::text, 'ponton'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'structures_lat_check' and conrelid = 'public.structures'::regclass) then
    alter table public.structures add constraint structures_lat_check CHECK (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'structures_lon_check' and conrelid = 'public.structures'::regclass) then
    alter table public.structures add constraint structures_lon_check CHECK (((lon >= ('-180'::integer)::double precision) AND (lon <= (180)::double precision)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'structures_note_check' and conrelid = 'public.structures'::regclass) then
    alter table public.structures add constraint structures_note_check CHECK ((char_length(note) <= 200));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'structures_group_id_fkey' and conrelid = 'public.structures'::regclass) then
    alter table public.structures add constraint structures_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'structures_user_id_fkey' and conrelid = 'public.structures'::regclass) then
    alter table public.structures add constraint structures_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tracks_points_check' and conrelid = 'public.tracks'::regclass) then
    alter table public.tracks add constraint tracks_points_check CHECK (((jsonb_typeof(points) = 'array'::text) AND (jsonb_array_length(points) <= 20000)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tracks_title_check' and conrelid = 'public.tracks'::regclass) then
    alter table public.tracks add constraint tracks_title_check CHECK ((char_length(title) <= 80));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tracks_group_id_fkey' and conrelid = 'public.tracks'::regclass) then
    alter table public.tracks add constraint tracks_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tracks_user_id_fkey' and conrelid = 'public.tracks'::regclass) then
    alter table public.tracks add constraint tracks_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'wake_alarms_body_check' and conrelid = 'public.wake_alarms'::regclass) then
    alter table public.wake_alarms add constraint wake_alarms_body_check CHECK ((char_length(body) <= 200));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'wake_alarms_check' and conrelid = 'public.wake_alarms'::regclass) then
    alter table public.wake_alarms add constraint wake_alarms_check CHECK ((fire_at <= (created_at + '10 days'::interval)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'wake_alarms_title_check' and conrelid = 'public.wake_alarms'::regclass) then
    alter table public.wake_alarms add constraint wake_alarms_title_check CHECK ((char_length(title) <= 80));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'wake_alarms_url_check' and conrelid = 'public.wake_alarms'::regclass) then
    alter table public.wake_alarms add constraint wake_alarms_url_check CHECK ((url ~ '^\./#[a-z]{2,20}$'::text));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'wake_alarms_spot_id_fkey' and conrelid = 'public.wake_alarms'::regclass) then
    alter table public.wake_alarms add constraint wake_alarms_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'wake_alarms_user_id_fkey' and conrelid = 'public.wake_alarms'::regclass) then
    alter table public.wake_alarms add constraint wake_alarms_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'water_reports_color_check' and conrelid = 'public.water_reports'::regclass) then
    alter table public.water_reports add constraint water_reports_color_check CHECK ((color = ANY (ARRAY['claire'::text, 'teintee'::text, 'trouble'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'water_reports_lat_check' and conrelid = 'public.water_reports'::regclass) then
    alter table public.water_reports add constraint water_reports_lat_check CHECK (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'water_reports_level_check' and conrelid = 'public.water_reports'::regclass) then
    alter table public.water_reports add constraint water_reports_level_check CHECK ((level = ANY (ARRAY['bas'::text, 'normal'::text, 'haut'::text, 'crue'::text])));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'water_reports_lon_check' and conrelid = 'public.water_reports'::regclass) then
    alter table public.water_reports add constraint water_reports_lon_check CHECK (((lon >= ('-180'::integer)::double precision) AND (lon <= (180)::double precision)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'water_reports_note_check' and conrelid = 'public.water_reports'::regclass) then
    alter table public.water_reports add constraint water_reports_note_check CHECK ((char_length(note) <= 200));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'water_reports_temp_check' and conrelid = 'public.water_reports'::regclass) then
    alter table public.water_reports add constraint water_reports_temp_check CHECK (((temp >= (0)::numeric) AND (temp <= (35)::numeric)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'water_reports_group_id_fkey' and conrelid = 'public.water_reports'::regclass) then
    alter table public.water_reports add constraint water_reports_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'water_reports_spot_id_fkey' and conrelid = 'public.water_reports'::regclass) then
    alter table public.water_reports add constraint water_reports_spot_id_fkey FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE SET NULL;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'water_reports_user_id_fkey' and conrelid = 'public.water_reports'::regclass) then
    alter table public.water_reports add constraint water_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  end if;
end $$;

-- ─────────────────────────── Index ───────────────────────────
CREATE INDEX IF NOT EXISTS snapshots_snap ON backup.snapshots USING btree (snap, tbl);
CREATE INDEX IF NOT EXISTS bait_stock_user ON public.bait_stock USING btree (user_id);
CREATE INDEX IF NOT EXISTS baitings_user ON public.baitings USING btree (user_id, at DESC);
CREATE INDEX IF NOT EXISTS carp_events_session ON public.carp_events USING btree (session_id, at);
CREATE INDEX IF NOT EXISTS carp_sessions_bait ON public.carp_sessions USING btree (next_bait_at) WHERE (ended_at IS NULL);
CREATE INDEX IF NOT EXISTS carp_sessions_group ON public.carp_sessions USING btree (group_id, started_at DESC);
CREATE INDEX IF NOT EXISTS carp_sessions_spot ON public.carp_sessions USING btree (spot_id);
CREATE INDEX IF NOT EXISTS checkins_active ON public.checkins USING btree (group_id, ends_at) WHERE (ended_at IS NULL);
CREATE INDEX IF NOT EXISTS checkins_user ON public.checkins USING btree (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS comments_post ON public.comments USING btree (post_id, created_at);
CREATE INDEX IF NOT EXISTS competitions_group ON public.competitions USING btree (group_id, end_at);
CREATE INDEX IF NOT EXISTS depth_group ON public.depth_points USING btree (group_id);
CREATE INDEX IF NOT EXISTS env_reports_group_time ON public.env_reports USING btree (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fish_events_group ON public.fish_events USING btree (group_id, start_date);
CREATE INDEX IF NOT EXISTS gear_items_user ON public.gear_items USING btree (user_id, kit);
CREATE INDEX IF NOT EXISTS invite_attempts_who ON public.invite_attempts USING btree (who, at DESC);
CREATE INDEX IF NOT EXISTS map_zones_group ON public.map_zones USING btree (group_id);
CREATE INDEX IF NOT EXISTS messages_group_time ON public.messages USING btree (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outings_group ON public.outings USING btree (group_id, start_at);
CREATE INDEX IF NOT EXISTS photo_votes_post ON public.photo_votes USING btree (post_id);
CREATE INDEX IF NOT EXISTS reports_group ON public.reports USING btree (group_id, status);
CREATE INDEX IF NOT EXISTS structures_group ON public.structures USING btree (group_id);
CREATE INDEX IF NOT EXISTS tracks_user ON public.tracks USING btree (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS wake_due ON public.wake_alarms USING btree (fire_at) WHERE (sent_at IS NULL);
CREATE INDEX IF NOT EXISTS water_reports_group_time ON public.water_reports USING btree (group_id, created_at DESC);

-- ─────────────────────────── Fonctions ───────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin() or public.is_controller();
$function$;

CREATE OR REPLACE FUNCTION public.poll_group(p bigint)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select group_id from public.polls where id = p;
$function$;

CREATE OR REPLACE FUNCTION public.post_group(p bigint)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select group_id from public.posts where id = p;
$function$;

CREATE OR REPLACE FUNCTION public.can_manage(g bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin() or public.is_owner_of(g);
$function$;

CREATE OR REPLACE FUNCTION public.can_moderate(g bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_staff() or public.is_mod_of(g);
$function$;

CREATE OR REPLACE FUNCTION public.clear_pw_temp()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.profiles set pw_temp = false where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.outing_group(o bigint)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select group_id from public.outings where id = o;
$function$;

CREATE OR REPLACE FUNCTION public.carp_owner(s bigint)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select user_id from public.carp_sessions where id = s;
$function$;

CREATE OR REPLACE FUNCTION public.carp_group(s bigint)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select group_id from public.carp_sessions where id = s;
$function$;

CREATE OR REPLACE FUNCTION public.set_permit_end(p_date date)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.profiles set permit_end = p_date where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.group_is_full(g bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (select count(*) from public.memberships where group_id = g) >= 20;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
  $function$;

CREATE OR REPLACE FUNCTION public.photo_group(path text)
 RETURNS bigint
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case when split_part(path, '/', 1) ~ '^[0-9]+$' then split_part(path, '/', 1)::bigint end;
$function$;

CREATE OR REPLACE FUNCTION public.is_controller()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select is_controller from public.profiles where id = auth.uid()), false);
$function$;

CREATE OR REPLACE FUNCTION public.delete_push_sub(p_endpoint text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.list_controllers()
 RETURNS TABLE(username text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select username from public.profiles where is_controller order by username;
$function$;

CREATE OR REPLACE FUNCTION public.is_member_of(g bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.memberships
                 where group_id = g and user_id = auth.uid() and status = 'active');
$function$;

CREATE OR REPLACE FUNCTION public.is_pending_in(g bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.memberships
                 where group_id = g and user_id = auth.uid() and status = 'pending');
$function$;

CREATE OR REPLACE FUNCTION public.set_nearby(p_km integer, p_share boolean)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.profiles set nearby_km = greatest(0, least(60, p_km)), nearby_share = coalesce(p_share, true) where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.username_available(p_username text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$' and not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$function$;

CREATE OR REPLACE FUNCTION public.is_owner_of(g bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.memberships
                 where group_id = g and user_id = auth.uid() and status = 'active' and role = 'owner');
$function$;

CREATE OR REPLACE FUNCTION public.is_mod_of(g bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.memberships
                 where group_id = g and user_id = auth.uid() and status = 'active' and role in ('owner', 'moderator'));
$function$;

CREATE OR REPLACE FUNCTION public.shares_group(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = u and a.status = 'active' and b.status = 'active');
$function$;

CREATE OR REPLACE FUNCTION public.set_post_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  NEW.status := case
    when coalesce((select post_approval from public.groups where id = NEW.group_id), false)
         and not public.can_moderate(NEW.group_id) then 'pending'
    else 'published' end;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.approve_member(p_group bigint, p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.can_moderate(p_group) then raise exception 'non autorisé'; end if;
  update public.memberships set status = 'active', joined_at = now()
    where group_id = p_group and user_id = p_user and status = 'pending';
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_group_options(p_id bigint, p_require_approval boolean, p_post_approval boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.can_manage(p_id) then raise exception 'non autorisé'; end if;
  update public.groups set require_approval = p_require_approval, post_approval = p_post_approval where id = p_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.test_morning_alert()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or not exists (select 1 from public.alert_prefs where user_id = auth.uid()) then
    raise exception 'alerte non configurée';
  end if;
  perform public.call_notify(jsonb_build_object('table', 'morning', 'test', true, 'user_id', auth.uid()));
end;
$function$;

CREATE OR REPLACE FUNCTION public.memo_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if NEW.group_id <> OLD.group_id or NEW.user_id <> OLD.user_id then raise exception 'non autorisé'; end if;
  if NEW.pinned <> OLD.pinned and not public.can_moderate(NEW.group_id) then
    raise exception 'seuls les modérateurs peuvent épingler';
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.regen_group_code(p_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare c text;
begin
  if not public.can_manage(p_id) then raise exception 'non autorisé'; end if;
  loop c := public.random_invite_code(); exit when not exists (select 1 from public.groups where invite_code = c); end loop;
  update public.groups set invite_code = c where id = p_id;
  return c;
end $function$;

CREATE OR REPLACE FUNCTION public.set_controller(p_username text, p_on boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then raise exception 'seul l''admin peut nommer un contrôleur'; end if;
  update public.profiles set is_controller = p_on where lower(username) = lower(p_username) and not is_admin;
  if not found then raise exception 'utilisateur introuvable'; end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.approve_post(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare g bigint;
begin
  select group_id into g from public.posts where id = p_id;
  if g is null then raise exception 'post introuvable'; end if;
  if not public.can_moderate(g) then raise exception 'non autorisé'; end if;
  update public.posts set status = 'published' where id = p_id and status = 'pending';
end;
$function$;

CREATE OR REPLACE FUNCTION public.random_invite_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; b bytea; s text := ''; i int;
begin
  b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex') || decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  for i in 0..9 loop
    s := s || substr(a, 1 + (get_byte(b, i) % length(a)), 1);
    if i = 4 then s := s || '-'; end if;
  end loop;
  return s;
end $function$;

CREATE OR REPLACE FUNCTION public.check_invite(p_code text)
 RETURNS TABLE(name text, region text, require_approval boolean, full_group boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare ok boolean;
begin
  ok := exists (select 1 from public.groups g where g.invite_code = p_code);
  perform public.invite_guard(ok);
  return query select g.name, g.region, g.require_approval, public.group_is_full(g.id) from public.groups g where g.invite_code = p_code;
end $function$;

CREATE OR REPLACE FUNCTION public.create_profile(p_username text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then return; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'nom d''utilisateur manquant'; end if;
  insert into public.profiles (id, username, is_admin) values (auth.uid(), p_username, false);
end $function$;

CREATE OR REPLACE FUNCTION public.save_push_sub(p_endpoint text, p_p256dh text, p_auth text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'non connecté';
  end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth)
    values (p_endpoint, auth.uid(), p_p256dh, p_auth)
    on conflict (endpoint) do update
      set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'backup'
AS $function$
declare u text := auth.uid()::text;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  -- les sauvegardes hebdomadaires de l'appli ne doivent pas garder les données d'un compte supprimé
  if to_regclass('backup.snapshots') is not null then
    delete from backup.snapshots where data->>'user_id' = u or (tbl = 'profiles' and data->>'id' = u);
  end if;
  delete from auth.users where id = auth.uid();
end $function$;

CREATE OR REPLACE FUNCTION public.invite_key()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare h json := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json); xff text; ip text;
begin
  if auth.uid() is not null then return auth.uid()::text; end if;
  xff := coalesce(h ->> 'x-forwarded-for', '');
  ip := coalesce(nullif(h ->> 'cf-connecting-ip', ''), nullif(h ->> 'x-real-ip', ''),
                 nullif(trim(split_part(xff, ',', greatest(1, array_length(string_to_array(xff, ','), 1)))), ''), 'inconnu');
  return 'ip:' || ip;
end $function$;

CREATE OR REPLACE FUNCTION public.set_env_status(p_id bigint, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare g bigint; u uuid;
begin
  select group_id, user_id into g, u from public.env_reports where id = p_id;
  if g is null then raise exception 'signalement introuvable'; end if;
  if not (u = auth.uid() or public.can_moderate(g)) then raise exception 'non autorisé'; end if;
  if p_status not in ('ouvert', 'transmis', 'resolu') then raise exception 'statut invalide'; end if;
  update public.env_reports set status = p_status, updated_at = now() where id = p_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_spot_facing(p_id bigint, p_facing integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare g bigint;
begin
  select group_id into g from public.spots where id = p_id;
  if g is null then raise exception 'spot introuvable'; end if;
  if not (public.is_member_of(g) or public.is_admin()) then raise exception 'non autorisé'; end if;
  if p_facing is not null and (p_facing < 0 or p_facing > 359) then raise exception 'orientation invalide'; end if;
  update public.spots set facing = p_facing, sheet_updated_at = now(), sheet_updated_by = auth.uid() where id = p_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.manage_members(p_group bigint)
 RETURNS TABLE(user_id uuid, username text, is_admin boolean, role text, status text, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.can_moderate(p_group) then raise exception 'non autorisé'; end if;
  return query
    select p.id, p.username, p.is_admin, m.role, m.status, m.joined_at
    from public.memberships m join public.profiles p on p.id = m.user_id
    where m.group_id = p_group
    order by (m.status = 'pending') desc, (case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end), p.username;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_my_profile(p_bio text, p_fav text[], p_avatar text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if p_avatar is not null and p_avatar not like auth.uid()::text || '/%' then raise exception 'non autorisé'; end if;
  update public.profiles
     set bio = nullif(trim(p_bio), ''),
         fav_species = (select coalesce(array_agg(left(trim(x), 30) order by o), '{}') from unnest(coalesce(p_fav, '{}')) with ordinality t(x, o) where trim(x) <> '' and o <= 3),
         avatar_path = p_avatar
   where id = auth.uid();
end;
$function$;

CREATE OR REPLACE FUNCTION public.invite_guard(p_ok boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text := public.invite_key();
begin
  perform pg_advisory_xact_lock(hashtext('invite:' || k));
  if (select count(*) from public.invite_attempts where who = k and at > now() - interval '1 hour') >= 15 then
    raise exception 'trop de tentatives';
  end if;
  if k like 'ip:%' and (select count(*) from public.invite_attempts where who like 'ip:%' and at > now() - interval '10 minutes') >= 300 then
    raise exception 'trop de tentatives';
  end if;
  if not p_ok then insert into public.invite_attempts (who) values (k); end if;
end $function$;

CREATE OR REPLACE FUNCTION public.call_notify(payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform net.http_post(
    url := 'https://gnamfqwbzmwivjagwogy.supabase.co/functions/v1/notify',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduYW1mcXdiem13aXZqYWd3b2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjkxNDAsImV4cCI6MjEwODgwNTE0MH0.XVcLscEz9Dr87ZJVy7FLDFse4OWy5yOFFssHe-gsm7I', 'x-hook-secret', 'eb1a8fb8485ac14ba846a79a579d8a882dd4912ac6c936e2'),
    timeout_milliseconds := 60000);
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_spot_sheet(p_id bigint, p_depth numeric, p_tours integer, p_bottom text, p_details text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION backup.weekly()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'backup'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.set_member_role(p_group bigint, p_user uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.join_group(p_code text, p_username text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare g bigint; appr boolean;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  select id, require_approval into g, appr from public.groups where invite_code = p_code;
  perform public.invite_guard(g is not null);
  if g is null then return null; end if;
  if exists (select 1 from public.memberships where group_id = g and user_id = auth.uid()) then return g; end if;
  if public.group_is_full(g) and not public.is_admin() then raise exception 'groupe complet'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'nom d''utilisateur manquant'; end if;
    insert into public.profiles (id, username, is_admin) values (auth.uid(), p_username, false);
  end if;
  insert into public.memberships (group_id, user_id, status)
    values (g, auth.uid(), case when appr and not public.is_admin() then 'pending' else 'active' end)
    on conflict do nothing;
  return g;
end $function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.manage_groups()
 RETURNS TABLE(id bigint, name text, region text, invite_code text, require_approval boolean, post_approval boolean, my_role text, members bigint, pending_members bigint, posts bigint, pending_posts bigint, spots bigint, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select g.id, g.name, g.region, g.invite_code, g.require_approval, g.post_approval,
    case when public.is_admin() then 'admin' when public.is_controller() then 'controleur'
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
$function$;

CREATE OR REPLACE FUNCTION public.vote_photo(p_post bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p record; m date := date_trunc('month', now() at time zone 'Europe/Paris')::date; cur bigint;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select id, group_id, user_id, status, created_at, photo_path into p from posts where id = p_post;
  if p.id is null or p.status <> 'published' or p.photo_path is null then raise exception 'Photo introuvable'; end if;
  if not public.is_member_of(p.group_id) then raise exception 'Réservé aux membres du groupe'; end if;
  if p.user_id = auth.uid() then raise exception 'Tu ne peux pas voter pour ta propre photo'; end if;
  if date_trunc('month', p.created_at at time zone 'Europe/Paris')::date <> m then raise exception 'Seules les photos du mois en cours sont en lice'; end if;
  select post_id into cur from photo_votes where group_id = p.group_id and month = m and user_id = auth.uid();
  if cur = p_post then
    delete from photo_votes where group_id = p.group_id and month = m and user_id = auth.uid();
    return 'retire';
  end if;
  insert into photo_votes (group_id, month, user_id, post_id) values (p.group_id, m, auth.uid(), p_post)
    on conflict (group_id, month, user_id) do update set post_id = excluded.post_id, created_at = now();
  return 'ok';
end $function$;

CREATE OR REPLACE FUNCTION public.manage_save_group(p_id bigint, p_name text, p_region text, p_code text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r bigint; c text := nullif(trim(coalesce(p_code, '')), ''); old text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid()) then raise exception 'non connecté'; end if;
  if p_id is not null then select invite_code into old from public.groups where id = p_id; end if;
  if c is null then
    c := coalesce(old, public.random_invite_code());
    while exists (select 1 from public.groups where invite_code = c and id is distinct from p_id) loop c := public.random_invite_code(); end loop;
  elsif c is distinct from old and char_length(c) < 8 then
    raise exception 'code trop court';
  end if;
  if p_id is null then
    if not public.is_admin() and (select count(*) from public.memberships where user_id = auth.uid() and role = 'owner') >= 3 then
      raise exception 'limite de groupes atteinte';
    end if;
    insert into public.groups (name, region, invite_code) values (p_name, nullif(p_region, ''), c) returning id into r;
    insert into public.memberships (group_id, user_id, role) values (r, auth.uid(), 'owner')
      on conflict (group_id, user_id) do update set role = 'owner';
  else
    if not public.can_manage(p_id) then raise exception 'non autorisé'; end if;
    update public.groups set name = p_name, region = nullif(p_region, ''), invite_code = c where id = p_id returning id into r;
  end if;
  return r;
end $function$;

CREATE OR REPLACE FUNCTION public.notify_new()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare payload jsonb;
begin
  if TG_TABLE_NAME = 'posts' then
    if TG_OP = 'INSERT' then
      payload := jsonb_build_object('table', 'posts', 'id', NEW.id, 'event', case when NEW.status = 'pending' then 'pending' else 'published' end);
    elsif TG_OP = 'UPDATE' and OLD.status = 'pending' and NEW.status = 'published' then
      payload := jsonb_build_object('table', 'posts', 'id', NEW.id, 'event', 'published');
    end if;
  elsif TG_TABLE_NAME = 'memberships' then
    if TG_OP = 'INSERT' and NEW.status = 'pending' then
      payload := jsonb_build_object('table', 'memberships', 'group_id', NEW.group_id, 'user_id', NEW.user_id, 'event', 'request');
    elsif TG_OP = 'UPDATE' and OLD.status = 'pending' and NEW.status = 'active' then
      payload := jsonb_build_object('table', 'memberships', 'group_id', NEW.group_id, 'user_id', NEW.user_id, 'event', 'accepted');
    end if;
  elsif TG_OP = 'INSERT' then
    payload := jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id, 'event', 'published');
  end if;
  if payload is null then return NEW; end if;
  begin
    perform net.http_post(
      url := 'https://gnamfqwbzmwivjagwogy.supabase.co/functions/v1/notify',
      body := payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduYW1mcXdiem13aXZqYWd3b2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjkxNDAsImV4cCI6MjEwODgwNTE0MH0.XVcLscEz9Dr87ZJVy7FLDFse4OWy5yOFFssHe-gsm7I',
        'x-hook-secret', 'eb1a8fb8485ac14ba846a79a579d8a882dd4912ac6c936e2'));
  exception when others then null;
  end;
  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_members(p_group bigint)
 RETURNS TABLE(user_id uuid, username text, is_admin boolean, joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
                                                                                                                                                                       begin
                                                                                                                                                                         if not public.is_admin() then raise exception 'réservé à l''admin'; end if;
                                                                                                                                                                           return query
                                                                                                                                                                               select p.id, p.username, p.is_admin, m.joined_at
                                                                                                                                                                                   from public.memberships m join public.profiles p on p.id = m.user_id
                                                                                                                                                                                       where m.group_id = p_group order by p.username;
                                                                                                                                                                                       end;
                                                                                                                                                                                       $function$;

CREATE OR REPLACE FUNCTION public.admin_groups()
 RETURNS TABLE(id bigint, name text, region text, invite_code text, members bigint, posts bigint, spots bigint, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                                                                                                                                         $function$;

CREATE OR REPLACE FUNCTION public.admin_save_group(p_id bigint, p_name text, p_region text, p_code text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
                                                                                                                                                                       $function$;


-- ─────────────────────────── Row Level Security ───────────────────────────
alter table public.alert_prefs enable row level security;
alter table public.bait_stock enable row level security;
alter table public.baitings enable row level security;
alter table public.carp_events enable row level security;
alter table public.carp_sessions enable row level security;
alter table public.challenges enable row level security;
alter table public.checkins enable row level security;
alter table public.comments enable row level security;
alter table public.competitions enable row level security;
alter table public.depth_points enable row level security;
alter table public.env_reports enable row level security;
alter table public.fish_events enable row level security;
alter table public.gear_items enable row level security;
alter table public.groups enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.live_positions enable row level security;
alter table public.lures enable row level security;
alter table public.map_zones enable row level security;
alter table public.memberships enable row level security;
alter table public.memos enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.outing_rsvps enable row level security;
alter table public.outings enable row level security;
alter table public.photo_votes enable row level security;
alter table public.poll_votes enable row level security;
alter table public.polls enable row level security;
alter table public.post_shares enable row level security;
alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.push_subs enable row level security;
alter table public.reactions enable row level security;
alter table public.reports enable row level security;
alter table public.sessions enable row level security;
alter table public.settings enable row level security;
alter table public.spots enable row level security;
alter table public.structures enable row level security;
alter table public.tracks enable row level security;
alter table public.wake_alarms enable row level security;
alter table public.water_reports enable row level security;

-- ─────────────────────────── Policies ───────────────────────────
drop policy if exists alert_prefs_all on public.alert_prefs;
create policy alert_prefs_all on public.alert_prefs for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists stock_own on public.bait_stock;
create policy stock_own on public.bait_stock for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists baitings_own on public.baitings;
create policy baitings_own on public.baitings for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists carp_events_delete on public.carp_events;
create policy carp_events_delete on public.carp_events for delete
  using ((carp_owner(session_id) = auth.uid()));
drop policy if exists carp_events_insert on public.carp_events;
create policy carp_events_insert on public.carp_events for insert
  with check ((carp_owner(session_id) = auth.uid()));
drop policy if exists carp_events_select on public.carp_events;
create policy carp_events_select on public.carp_events for select
  using ((is_staff() OR is_member_of(carp_group(session_id))));
drop policy if exists carp_sessions_delete on public.carp_sessions;
create policy carp_sessions_delete on public.carp_sessions for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists carp_sessions_insert on public.carp_sessions;
create policy carp_sessions_insert on public.carp_sessions for insert
  with check (((user_id = auth.uid()) AND is_member_of(group_id)));
drop policy if exists carp_sessions_select on public.carp_sessions;
create policy carp_sessions_select on public.carp_sessions for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists carp_sessions_update on public.carp_sessions;
create policy carp_sessions_update on public.carp_sessions for update
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND ((group_id IS NULL) OR is_member_of(group_id))));
drop policy if exists challenges_delete on public.challenges;
create policy challenges_delete on public.challenges for delete
  using (can_moderate(group_id));
drop policy if exists challenges_insert on public.challenges;
create policy challenges_insert on public.challenges for insert
  with check (((user_id = auth.uid()) AND can_moderate(group_id)));
drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists checkins_delete on public.checkins;
create policy checkins_delete on public.checkins for delete
  using ((user_id = auth.uid()));
drop policy if exists checkins_insert on public.checkins;
create policy checkins_insert on public.checkins for insert
  with check (((user_id = auth.uid()) AND ((group_id IS NULL) OR is_member_of(group_id))));
drop policy if exists checkins_select on public.checkins;
create policy checkins_select on public.checkins for select
  using (((user_id = auth.uid()) OR ((group_id IS NOT NULL) AND announce AND (is_member_of(group_id) OR is_staff()))));
drop policy if exists checkins_update on public.checkins;
create policy checkins_update on public.checkins for update
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND ((group_id IS NULL) OR is_member_of(group_id))));
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete
  using (((user_id = auth.uid()) OR can_moderate(post_group(post_id))));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert
  with check (((user_id = auth.uid()) AND (is_member_of(post_group(post_id)) OR is_admin())));
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select
  using ((is_staff() OR is_member_of(post_group(post_id))));
drop policy if exists competitions_delete on public.competitions;
create policy competitions_delete on public.competitions for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists competitions_insert on public.competitions;
create policy competitions_insert on public.competitions for insert
  with check (((user_id = auth.uid()) AND can_moderate(group_id)));
drop policy if exists competitions_select on public.competitions;
create policy competitions_select on public.competitions for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists depth_delete on public.depth_points;
create policy depth_delete on public.depth_points for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists depth_insert on public.depth_points;
create policy depth_insert on public.depth_points for insert
  with check (((user_id = auth.uid()) AND is_member_of(group_id)));
drop policy if exists depth_select on public.depth_points;
create policy depth_select on public.depth_points for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists env_reports_delete on public.env_reports;
create policy env_reports_delete on public.env_reports for delete to authenticated
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists env_reports_insert on public.env_reports;
create policy env_reports_insert on public.env_reports for insert to authenticated
  with check (((user_id = auth.uid()) AND is_member_of(group_id) AND (status = 'ouvert'::text)));
drop policy if exists env_reports_select on public.env_reports;
create policy env_reports_select on public.env_reports for select to authenticated
  using ((is_member_of(group_id) OR is_admin()));
drop policy if exists fe_delete on public.fish_events;
create policy fe_delete on public.fish_events for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists fe_insert on public.fish_events;
create policy fe_insert on public.fish_events for insert
  with check (((user_id = auth.uid()) AND (is_member_of(group_id) OR is_staff())));
drop policy if exists fe_select on public.fish_events;
create policy fe_select on public.fish_events for select
  using ((is_member_of(group_id) OR is_staff()));
drop policy if exists fe_update on public.fish_events;
create policy fe_update on public.fish_events for update
  using (((user_id = auth.uid()) OR can_moderate(group_id)))
  with check ((((user_id = auth.uid()) OR can_moderate(group_id)) AND ((group_id IS NULL) OR is_member_of(group_id) OR can_moderate(group_id))));
drop policy if exists gear_items_all on public.gear_items;
create policy gear_items_all on public.gear_items for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select
  using ((is_staff() OR is_member_of(id) OR is_pending_in(id)));
drop policy if exists live_select on public.live_positions;
create policy live_select on public.live_positions for select
  using (((expires_at > now()) AND (is_member_of(group_id) OR is_staff())));
drop policy if exists live_write on public.live_positions;
create policy live_write on public.live_positions for all
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND is_member_of(group_id) AND (expires_at <= (now() + '08:00:00'::interval))));
drop policy if exists lures_all on public.lures;
create policy lures_all on public.lures for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists zones_delete on public.map_zones;
create policy zones_delete on public.map_zones for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists zones_insert on public.map_zones;
create policy zones_insert on public.map_zones for insert
  with check (((user_id = auth.uid()) AND (is_member_of(group_id) OR is_staff())));
drop policy if exists zones_select on public.map_zones;
create policy zones_select on public.map_zones for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists zones_update on public.map_zones;
create policy zones_update on public.map_zones for update
  using (((user_id = auth.uid()) OR can_moderate(group_id)))
  with check ((((user_id = auth.uid()) OR can_moderate(group_id)) AND ((group_id IS NULL) OR is_member_of(group_id) OR can_moderate(group_id))));
drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships for delete
  using (((user_id = auth.uid()) OR is_admin() OR (is_owner_of(group_id) AND (role <> 'owner'::text)) OR ((is_mod_of(group_id) OR is_controller()) AND (role = 'member'::text))));
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select
  using (((user_id = auth.uid()) OR is_staff() OR (is_member_of(group_id) AND ((status = 'active'::text) OR can_moderate(group_id)))));
drop policy if exists memos_delete on public.memos;
create policy memos_delete on public.memos for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists memos_insert on public.memos;
create policy memos_insert on public.memos for insert
  with check (((user_id = auth.uid()) AND is_member_of(group_id) AND ((NOT pinned) OR can_moderate(group_id))));
drop policy if exists memos_select on public.memos;
create policy memos_select on public.memos for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists memos_update on public.memos;
create policy memos_update on public.memos for update
  using (((user_id = auth.uid()) OR can_moderate(group_id)))
  with check ((is_member_of(group_id) OR is_admin()));
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (((user_id = auth.uid()) AND (is_member_of(group_id) OR is_staff())));
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists notif_delete on public.notifications;
create policy notif_delete on public.notifications for delete
  using ((user_id = auth.uid()));
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select
  using ((user_id = auth.uid()));
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists outing_rsvps_select on public.outing_rsvps;
create policy outing_rsvps_select on public.outing_rsvps for select
  using ((is_staff() OR is_member_of(outing_group(outing_id))));
drop policy if exists outing_rsvps_write on public.outing_rsvps;
create policy outing_rsvps_write on public.outing_rsvps for all
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND is_member_of(outing_group(outing_id))));
drop policy if exists outings_delete on public.outings;
create policy outings_delete on public.outings for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists outings_insert on public.outings;
create policy outings_insert on public.outings for insert
  with check (((user_id = auth.uid()) AND is_member_of(group_id)));
drop policy if exists outings_select on public.outings;
create policy outings_select on public.outings for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists outings_update on public.outings;
create policy outings_update on public.outings for update
  using (((user_id = auth.uid()) OR can_moderate(group_id)))
  with check ((((user_id = auth.uid()) OR can_moderate(group_id)) AND ((group_id IS NULL) OR is_member_of(group_id) OR can_moderate(group_id))));
drop policy if exists photo_votes_select on public.photo_votes;
create policy photo_votes_select on public.photo_votes for select
  using ((is_member_of(group_id) OR is_staff()));
drop policy if exists votes_delete on public.poll_votes;
create policy votes_delete on public.poll_votes for delete
  using ((user_id = auth.uid()));
drop policy if exists votes_insert on public.poll_votes;
create policy votes_insert on public.poll_votes for insert
  with check (((user_id = auth.uid()) AND is_member_of(poll_group(poll_id))));
drop policy if exists votes_select on public.poll_votes;
create policy votes_select on public.poll_votes for select
  using ((is_staff() OR is_member_of(poll_group(poll_id))));
drop policy if exists votes_update on public.poll_votes;
create policy votes_update on public.poll_votes for update
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND is_member_of(poll_group(poll_id))));
drop policy if exists polls_delete on public.polls;
create policy polls_delete on public.polls for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists polls_insert on public.polls;
create policy polls_insert on public.polls for insert
  with check (((user_id = auth.uid()) AND is_member_of(group_id)));
drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists shares_delete on public.post_shares;
create policy shares_delete on public.post_shares for delete
  using ((user_id = auth.uid()));
drop policy if exists shares_insert on public.post_shares;
create policy shares_insert on public.post_shares for insert
  with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM posts p
  WHERE ((p.id = post_shares.post_id) AND (p.user_id = auth.uid()) AND (p.status = 'published'::text))))));
drop policy if exists shares_select on public.post_shares;
create policy shares_select on public.post_shares for select
  using ((user_id = auth.uid()));
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert
  with check (((user_id = auth.uid()) AND (is_member_of(group_id) OR is_admin())));
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select
  using ((is_staff() OR (is_member_of(group_id) AND ((status = 'published'::text) OR (user_id = auth.uid()) OR can_moderate(group_id)))));
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (((id = auth.uid()) OR is_staff() OR shares_group(id)));
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions for delete
  using ((user_id = auth.uid()));
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert
  with check (((user_id = auth.uid()) AND (is_member_of(post_group(post_id)) OR is_admin())));
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select
  using ((is_staff() OR is_member_of(post_group(post_id))));
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (((user_id = auth.uid()) AND (is_member_of(group_id) OR is_staff())));
drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports for select
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists reports_update on public.reports;
create policy reports_update on public.reports for update
  using (can_moderate(group_id))
  with check (can_moderate(group_id));
drop policy if exists sessions_delete on public.sessions;
create policy sessions_delete on public.sessions for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions for insert
  with check (((user_id = auth.uid()) AND is_member_of(group_id)));
drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists spots_delete on public.spots;
create policy spots_delete on public.spots for delete
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists spots_insert on public.spots;
create policy spots_insert on public.spots for insert
  with check (((user_id = auth.uid()) AND (is_member_of(group_id) OR is_admin())));
drop policy if exists spots_select on public.spots;
create policy spots_select on public.spots for select
  using ((is_staff() OR is_member_of(group_id)));
drop policy if exists structures_delete on public.structures;
create policy structures_delete on public.structures for delete to authenticated
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists structures_insert on public.structures;
create policy structures_insert on public.structures for insert to authenticated
  with check (((user_id = auth.uid()) AND is_member_of(group_id)));
drop policy if exists structures_select on public.structures;
create policy structures_select on public.structures for select to authenticated
  using ((is_member_of(group_id) OR is_admin()));
drop policy if exists tracks_select on public.tracks;
create policy tracks_select on public.tracks for select
  using (((user_id = auth.uid()) OR (shared AND (group_id IS NOT NULL) AND (is_member_of(group_id) OR is_staff()))));
drop policy if exists tracks_write on public.tracks;
create policy tracks_write on public.tracks for all
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND ((group_id IS NULL) OR is_member_of(group_id) OR is_staff())));
drop policy if exists wake_own on public.wake_alarms;
create policy wake_own on public.wake_alarms for all
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
drop policy if exists water_reports_delete on public.water_reports;
create policy water_reports_delete on public.water_reports for delete to authenticated
  using (((user_id = auth.uid()) OR can_moderate(group_id)));
drop policy if exists water_reports_insert on public.water_reports;
create policy water_reports_insert on public.water_reports for insert to authenticated
  with check (((user_id = auth.uid()) AND is_member_of(group_id)));
drop policy if exists water_reports_select on public.water_reports;
create policy water_reports_select on public.water_reports for select to authenticated
  using ((is_member_of(group_id) OR is_admin()));

-- ─────────────────────────── Triggers ───────────────────────────
drop trigger if exists challenges_notify on public.challenges;
CREATE TRIGGER challenges_notify AFTER INSERT ON public.challenges FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists checkins_notify on public.checkins;
CREATE TRIGGER checkins_notify AFTER INSERT ON public.checkins FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists comments_notify on public.comments;
CREATE TRIGGER comments_notify AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists competitions_notify on public.competitions;
CREATE TRIGGER competitions_notify AFTER INSERT ON public.competitions FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists env_reports_notify on public.env_reports;
CREATE TRIGGER env_reports_notify AFTER INSERT ON public.env_reports FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists memberships_notify on public.memberships;
CREATE TRIGGER memberships_notify AFTER INSERT OR UPDATE OF status ON public.memberships FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists memos_guard on public.memos;
CREATE TRIGGER memos_guard BEFORE UPDATE ON public.memos FOR EACH ROW EXECUTE FUNCTION memo_guard();
drop trigger if exists memos_notify on public.memos;
CREATE TRIGGER memos_notify AFTER INSERT ON public.memos FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists messages_notify on public.messages;
CREATE TRIGGER messages_notify AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists outings_notify on public.outings;
CREATE TRIGGER outings_notify AFTER INSERT ON public.outings FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists polls_notify on public.polls;
CREATE TRIGGER polls_notify AFTER INSERT ON public.polls FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists posts_notify on public.posts;
CREATE TRIGGER posts_notify AFTER INSERT OR UPDATE OF status ON public.posts FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists posts_status on public.posts;
CREATE TRIGGER posts_status BEFORE INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION set_post_status();
drop trigger if exists reports_notify on public.reports;
CREATE TRIGGER reports_notify AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists sessions_notify on public.sessions;
CREATE TRIGGER sessions_notify AFTER INSERT ON public.sessions FOR EACH ROW EXECUTE FUNCTION notify_new();
drop trigger if exists spots_notify on public.spots;
CREATE TRIGGER spots_notify AFTER INSERT ON public.spots FOR EACH ROW EXECUTE FUNCTION notify_new();

-- ─────────────────────────── Buckets Storage ───────────────────────────
insert into storage.buckets (id, name, public, file_size_limit) values ('avatars', 'avatars', true, 1048576) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit) values ('photos', 'photos', false, 5242880) on conflict (id) do nothing;

-- ─────────────────────────── Tâches planifiées (pg_cron) ───────────────────────────
-- Rejoué tel quel : on retire le job de même nom avant de le replanifier.
do $$ begin
  perform cron.unschedule(1);
exception when others then null; end $$;
select cron.schedule('30 4 * * *', $cron$ select public.call_notify(''{"table":"morning"}''::jsonb) $cron$);
do $$ begin
  perform cron.unschedule(2);
exception when others then null; end $$;
select cron.schedule('0 17 * * *', $cron$ select public.call_notify(''{"table":"outing_reminders"}''::jsonb) $cron$);
do $$ begin
  perform cron.unschedule(3);
exception when others then null; end $$;
select cron.schedule('15 3 * * 0', $cron$ select backup.weekly() $cron$);
do $$ begin
  perform cron.unschedule(4);
exception when others then null; end $$;
select cron.schedule('*/2 * * * *', $cron$ select public.call_notify(''{"table":"bait_reminders"}''::jsonb) where exists (select 1 from public.carp_sessions where ended_at is null and next_bait_at <= now()) $cron$);
do $$ begin
  perform cron.unschedule(5);
exception when others then null; end $$;
select cron.schedule('20 * * * *', $cron$ select public.call_notify(''{"table":"flood_watch"}''::jsonb) where exists (select 1 from public.alert_prefs where flood and lat is not null) $cron$);
do $$ begin
  perform cron.unschedule(6);
exception when others then null; end $$;
select cron.schedule('* * * * *', $cron$ select public.call_notify(''{"table":"wake_alarms"}''::jsonb) where exists (select 1 from public.wake_alarms where sent_at is null and fire_at <= now()) $cron$);
do $$ begin
  perform cron.unschedule(7);
exception when others then null; end $$;
select cron.schedule('*/15 * * * *', $cron$ select public.call_notify(''{"table":"storm_watch"}''::jsonb) where exists (select 1 from public.checkins where ended_at is null and ends_at > now() and (storm_sent_at is null or storm_sent_at < now() - interval ''3 hours'')) or exists (select 1 from public.carp_sessions where ended_at is null and spot_id is not null and (storm_sent_at is null or storm_sent_at < now() - interval ''3 hours'') and started_at > now() - interval ''3 days'') $cron$);
do $$ begin
  perform cron.unschedule(8);
exception when others then null; end $$;
select cron.schedule('0 9 1 * *', $cron$ select public.call_notify(''{"table":"photo_month"}''::jsonb) $cron$);
do $$ begin
  perform cron.unschedule(9);
exception when others then null; end $$;
select cron.schedule('40 3 * * *', $cron$ delete from public.notifications where created_at < now() - interval ''60 days'' $cron$);
do $$ begin
  perform cron.unschedule(10);
exception when others then null; end $$;
select cron.schedule('50 3 * * *', $cron$
  delete from public.water_reports where created_at < now() - interval ''7 days'';
  delete from public.env_reports where status = ''resolu'' and coalesce(updated_at, created_at) < now() - interval ''6 months'';
$cron$);
do $$ begin
  perform cron.unschedule(11);
exception when others then null; end $$;
select cron.schedule('55 3 * * *', $cron$ delete from public.invite_attempts where at < now() - interval ''1 day''; $cron$);


insert into public.schema_migrations (version, notes)
values ('0001_baseline', 'schéma reconstruit depuis la production')
on conflict (version) do nothing;
