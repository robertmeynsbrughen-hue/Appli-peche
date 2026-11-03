-- 0026 — Annonces programmées avec notification
--
-- Avant : la notification d'une annonce partait seulement si l'annonce
-- commençait tout de suite. Maintenant, une annonce programmée pour plus tard
-- envoie sa notification à l'heure prévue (vérification toutes les 5 minutes),
-- une seule fois. Rejouable sans erreur.

alter table public.announcements add column if not exists pushed_at timestamptz;
-- les annonces déjà commencées ont déjà été notifiées : pas de second envoi
update public.announcements set pushed_at = starts_at where push and pushed_at is null and starts_at <= now();

-- une annonce immédiate est notifiée par le déclencheur existant : on la marque
create or replace function public.announcements_mark_pushed()
returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $function$
begin
  if new.push and new.starts_at <= now() then new.pushed_at := now(); end if;
  return new;
end $function$;
revoke all on function public.announcements_mark_pushed() from public, anon, authenticated;

drop trigger if exists announcements_mark_pushed on public.announcements;
create trigger announcements_mark_pushed before insert on public.announcements
  for each row execute function public.announcements_mark_pushed();

-- les annonces programmées arrivées à l'heure
create or replace function public.announcements_due()
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare a record;
begin
  for a in select id from public.announcements
            where push and pushed_at is null and starts_at <= now()
              and starts_at > now() - interval '1 day'
              and (ends_at is null or ends_at > now())
            for update skip locked loop
    update public.announcements set pushed_at = now() where id = a.id;
    perform public.call_notify(jsonb_build_object('table', 'announcements', 'id', a.id));
  end loop;
end $function$;
revoke all on function public.announcements_due() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cdj-annonces';
    perform cron.schedule('cdj-annonces', '*/5 * * * *',
      $c$ select public.announcements_due() where exists (select 1 from public.announcements where push and pushed_at is null and starts_at <= now()) $c$);
  end if;
end $$;

insert into public.schema_migrations (version, notes)
values ('0026_annonces_programmees', 'notification des annonces programmées à leur heure de début')
on conflict (version) do nothing;
