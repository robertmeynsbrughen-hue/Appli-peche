-- 0018 — Resynchronisation des droits d'accès dépôt ↔ production
--
-- Constat (test de reconstruction du 2 novembre 2026 sur un projet Supabase vide) :
-- les migrations 0001 à 0017 reconstruisent bien les tables, les policies RLS,
-- les triggers et le code des fonctions, mais pas les droits durcis à la main en
-- production. Une base reconstruite depuis le dépôt aurait été trop ouverte :
--   - 59 fonctions appelables sans compte (anon) au lieu de 9, dont call_notify ;
--   - groups lisible en entier, y compris invite_code ;
--   - invite_attempts, push_subs et settings accessibles aux rôles du client ;
--   - insertion directe de notifications par le client.
-- Il manquait aussi la colonne staff_messages.group_id (et un index), la RLS de
-- schema_migrations et la liste des types de fichiers acceptés par les buckets
-- avatars et photos (n'importe quel fichier aurait pu être envoyé).
--
-- Cette migration recopie exactement l'état de la production.
-- Sur la production elle ne change rien ; sur une base neuve elle referme ces accès.
-- Rejouable sans erreur.

-- ---------- Fonctions : personne par défaut, puis droits explicites ----------
do $$
declare f record;
  -- appelables sans compte (et par tous)
  open_all text[] := array['bug_reports_limit','dm_allowed','message_group','photo_group','qa_group'];
  -- appelables sans compte (anon + authenticated)
  open_anon text[] := array['check_invite','log_client_error','peek_invite','username_available'];
  -- internes : triggers, tâches planifiées, appels serveur uniquement
  internal text[] := array['bug_reports_alert','call_notify','check_reply_to','checkin_timeout_quiet',
    'group_month_stats','guard_owner_leave','invite_guard','invite_key','join_welcome_group',
    'last_activity','memo_guard','modlog','modlog_trigger','notify_new','random_invite_code',
    'referral_first_post','rls_auto_enable','set_post_status','warn_inactive'];
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname = any(internal) then continue; end if;
    execute format('grant execute on function %s to authenticated', f.sig);
    if f.proname = any(open_all) or f.proname = any(open_anon) then
      execute format('grant execute on function %s to anon', f.sig);
    end if;
    if f.proname = any(open_all) then
      execute format('grant execute on function %s to public', f.sig);
    end if;
  end loop;
end $$;

-- ---------- Tables ----------
-- groups : lecture par colonnes, invite_code jamais lisible côté client
revoke all on table public.groups from anon, authenticated;
grant select (id, name, region, created_at, require_approval, post_approval, is_welcome) on table public.groups to authenticated;

-- uniquement via les fonctions serveur
revoke all on table public.invite_attempts from anon, authenticated;
revoke all on table public.push_subs from anon, authenticated;
revoke all on table public.settings from anon, authenticated;

-- les notifications sont créées par le serveur, jamais par le client
revoke insert on table public.notifications from anon, authenticated;

-- historique des migrations : RLS active comme en production
alter table public.schema_migrations enable row level security;

-- ---------- Colonne présente en production, absente du dépôt ----------
alter table public.staff_messages add column if not exists group_id bigint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'staff_messages_group_id_fkey') then
    alter table public.staff_messages add constraint staff_messages_group_id_fkey
      foreign key (group_id) references public.groups(id) on delete cascade;
  end if;
end $$;

create index if not exists staff_messages_created_idx on public.staff_messages using btree (created_at);

-- ---------- Stockage : types de fichiers acceptés, comme en production ----------
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id = 'avatars';
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac']
 where id = 'photos';

insert into public.schema_migrations(version, notes)
values ('0018_resync_droits', 'droits d''accès de la production recopiés dans le dépôt ; reconstruction à blanc validée')
on conflict (version) do nothing;
