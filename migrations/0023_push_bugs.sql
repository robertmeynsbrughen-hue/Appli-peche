-- 0023 — Notification push aux administrateurs quand un bug est signalé
--
-- Avant : le signalement créait seulement une entrée dans le centre de
-- notifications des administrateurs. Maintenant, la fonction Supabase
-- « alerte » envoie aussi une notification sur leur téléphone.
-- Rejouable sans erreur.

create or replace function public.bug_reports_alert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  insert into public.notifications (user_id, title, body, url, tag)
  select p.id, '🐞 Bug signalé par @' || coalesce((select username from public.profiles where id = new.user_id), '?'),
         left(new.body, 300), './#profil?mod=bugs', 'bug-' || new.id
    from public.profiles p where p.is_admin;
  perform public.call_notify(jsonb_build_object('table', 'bug_reports', 'id', new.id, 'fn', 'alerte'));
  return new;
end $function$;

revoke all on function public.bug_reports_alert() from public, anon, authenticated;

insert into public.schema_migrations (version, notes)
values ('0023_push_bugs', 'notification push aux administrateurs pour chaque bug signalé')
on conflict (version) do nothing;
