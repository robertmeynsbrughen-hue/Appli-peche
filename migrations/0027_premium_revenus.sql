-- 0027 — Préparation du freemium : abonnements Google Play et revenus
--
-- Les abonnements Premium seront vendus par Google Play. Google prévient le
-- serveur à chaque achat, renouvellement, annulation ou remboursement ; une
-- fonction Supabase (à venir) recopiera ces informations ici. Rien n'est écrit
-- par l'appli : les membres peuvent seulement lire leur propre abonnement.
-- Le site d'administration lit les chiffres avec garde_revenue().
-- garde_usage() donne les statistiques d'usage, garde_members() indique en
-- plus si le membre est Premium. Rejouable sans erreur.

create table if not exists public.subscriptions (
  purchase_token text primary key,                 -- identifiant d'achat Google Play
  user_id uuid references auth.users (id) on delete set null,
  product_id text not null,                        -- ex. rivio_premium
  base_plan text not null default 'mensuel',       -- mensuel, annuel
  status text not null default 'active'
    check (status in ('pending', 'active', 'grace', 'on_hold', 'paused', 'canceled', 'expired', 'refunded')),
  trial boolean not null default false,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  auto_renew boolean not null default true,
  price_micros bigint not null default 0,          -- prix payé par le client, en millionièmes
  currency text not null default 'EUR',
  country text,
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status, expires_at);

create table if not exists public.revenue_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  purchase_token text,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('purchase', 'renewal', 'trial_start', 'trial_convert', 'cancel', 'restart', 'grace', 'on_hold', 'recover', 'pause', 'expire', 'refund')),
  product_id text,
  base_plan text,
  gross_micros bigint not null default 0,          -- payé par le client (négatif pour un remboursement)
  net_micros bigint not null default 0,            -- reversé après la commission Google
  currency text not null default 'EUR'
);
create index if not exists revenue_events_at_idx on public.revenue_events (at desc);
create index if not exists revenue_events_user_id_idx on public.revenue_events (user_id);

alter table public.subscriptions enable row level security;
alter table public.revenue_events enable row level security;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.revenue_events from anon, authenticated;
grant select on public.subscriptions to authenticated;
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
-- revenue_events : aucune règle, donc aucun accès client (serveur uniquement)

-- l'appli pourra s'en servir pour débloquer les fonctions Premium
create or replace function public.is_premium()
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select exists (select 1 from public.subscriptions
                  where user_id = auth.uid()
                    and status in ('active', 'grace', 'canceled')
                    and (expires_at is null or expires_at > now()));
$function$;
revoke all on function public.is_premium() from public, anon;
grant execute on function public.is_premium() to authenticated;

-- ---------- Site d'administration ----------
create or replace function public.garde_revenue()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
declare live text[] := array['active', 'grace', 'canceled'];
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'non autorisé'; end if;
  return jsonb_build_object(
    'premium', (select count(distinct user_id) from public.subscriptions where status = any (live) and (expires_at is null or expires_at > now())),
    'trials', (select count(*) from public.subscriptions where trial and status = any (live) and (expires_at is null or expires_at > now())),
    'users', (select count(*) from public.profiles),
    'mrr_micros', coalesce((select sum(case when base_plan = 'annuel' then price_micros / 12 else price_micros end)
                              from public.subscriptions where not trial and status in ('active', 'grace') and (expires_at is null or expires_at > now())), 0),
    'plans', coalesce((select jsonb_agg(jsonb_build_object('plan', base_plan, 'n', n, 'micros', m)) from (
                 select base_plan, count(*) n, sum(price_micros) m from public.subscriptions
                  where status = any (live) and (expires_at is null or expires_at > now()) group by base_plan) p), '[]'::jsonb),
    'canceling', (select count(*) from public.subscriptions where status = 'canceled' and expires_at > now()),
    'renewals_7d', (select count(*) from public.subscriptions where status = 'active' and auto_renew and expires_at between now() and now() + interval '7 days'),
    'lost_30d', (select count(*) from public.revenue_events where kind in ('expire', 'refund') and at > now() - interval '30 days'),
    'new_30d', (select count(*) from public.revenue_events where kind in ('purchase', 'trial_convert') and at > now() - interval '30 days'),
    'months', (select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                       'gross', coalesce((select sum(gross_micros) from public.revenue_events e where date_trunc('month', e.at) = m), 0),
                       'net', coalesce((select sum(net_micros) from public.revenue_events e where date_trunc('month', e.at) = m), 0),
                       'subs', (select count(*) from public.revenue_events e where date_trunc('month', e.at) = m and kind in ('purchase', 'trial_convert'))) order by m)
                 from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m),
    'events', coalesce((select jsonb_agg(x order by x->>'at' desc) from (
                 select jsonb_build_object('at', e.at, 'kind', e.kind, 'plan', e.base_plan, 'gross', e.gross_micros, 'net', e.net_micros, 'currency', e.currency,
                        'user_id', e.user_id, 'username', p.username) x
                   from public.revenue_events e left join public.profiles p on p.id = e.user_id
                  order by e.at desc limit 30) s), '[]'::jsonb)
  );
end $function$;

create or replace function public.garde_usage()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
declare today date := (now() at time zone 'Europe/Paris')::date;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'non autorisé'; end if;
  return jsonb_build_object(
    'daily', (select jsonb_agg(jsonb_build_object('day', d::date, 'n', (select count(*) from public.usage_days u where u.day = d::date)) order by d)
                from generate_series(today - 89, today, interval '1 day') d),
    'screens', coalesce((select jsonb_agg(jsonb_build_object('screen', k, 'views', v, 'users', n) order by v desc) from (
                 select k, sum(val::int) v, count(distinct user_id) n from public.usage_days, jsonb_each_text(screens) e(k, val)
                  where day > today - 30 group by k order by 2 desc limit 16) s), '[]'::jsonb),
    'signups', (select jsonb_agg(jsonb_build_object('week', w::date, 'n', (select count(*) from public.profiles p where p.created_at >= w and p.created_at < w + interval '7 days')) order by w)
                  from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w),
    'cohorts', (select jsonb_agg(jsonb_build_object('week', w::date, 'size', size, 'weeks', weeks) order by w) from (
                  select w, (select count(*) from public.profiles p where p.created_at >= w and p.created_at < w + interval '7 days') size,
                         (select jsonb_agg((select count(distinct u.user_id) from public.usage_days u join public.profiles p on p.id = u.user_id
                                             where p.created_at >= w and p.created_at < w + interval '7 days'
                                               and u.day >= (w + make_interval(weeks => k))::date and u.day < (w + make_interval(weeks => k + 1))::date) order by k)
                            from generate_series(1, 4) k where w + make_interval(weeks => k) <= now()) weeks
                    from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()) - interval '1 week', interval '1 week') w) c),
    'regions', coalesce((select jsonb_agg(jsonb_build_object('region', r, 'members', n) order by n desc) from (
                  select coalesce(nullif(g.region, ''), 'Sans région') r, count(distinct m.user_id) n
                    from public.memberships m join public.groups g on g.id = m.group_id
                   where m.status = 'active' and not g.is_welcome group by 1) s), '[]'::jsonb),
    'push_users', (select count(distinct user_id) from public.push_subs),
    'users', (select count(*) from public.profiles)
  );
end $function$;

revoke all on function public.garde_revenue() from public, anon;
revoke all on function public.garde_usage() from public, anon;
grant execute on function public.garde_revenue() to authenticated;
grant execute on function public.garde_usage() to authenticated;

-- garde_members : on ajoute l'abonnement Premium du membre
create or replace function public.garde_members()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'non autorisé'; end if;
  return coalesce((select jsonb_agg(m order by m->>'created_at' desc) from (
    select jsonb_build_object(
      'id', p.id, 'username', p.username, 'avatar_path', p.avatar_path, 'bio', p.bio,
      'email', case when u.email like '%@coupdujour.app' then null else u.email end,
      'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at,
      'last_seen', public.last_activity(p.id),
      'is_admin', p.is_admin, 'is_controller', p.is_controller, 'pw_temp', p.pw_temp,
      'fav_species', p.fav_species, 'permit_end', p.permit_end,
      'push', exists (select 1 from public.push_subs s where s.user_id = p.id),
      'posts', (select count(*) from public.posts x where x.user_id = p.id),
      'messages', (select count(*) from public.messages x where x.user_id = p.id),
      'spots', (select count(*) from public.spots x where x.user_id = p.id),
      'days_30', (select count(*) from public.usage_days d where d.user_id = p.id and d.day > current_date - 30),
      'warnings', (select count(*) from public.moderation_log l where l.target_user = p.id and l.action = 'warning' and l.at > now() - interval '180 days'),
      'timeout', (select jsonb_build_object('id', t.id, 'ends_at', t.ends_at, 'reason', t.reason)
                    from public.moderation_timeouts t
                   where t.user_id = p.id and t.lifted_at is null and t.ends_at > now()
                   order by t.ends_at desc limit 1),
      'premium', (select jsonb_build_object('plan', s.base_plan, 'status', s.status, 'trial', s.trial, 'expires_at', s.expires_at)
                    from public.subscriptions s
                   where s.user_id = p.id and s.status in ('active', 'grace', 'canceled') and (s.expires_at is null or s.expires_at > now())
                   order by s.expires_at desc nulls first limit 1),
      'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'role', ms.role, 'status', ms.status, 'joined_at', ms.joined_at) order by g.name)
                            from public.memberships ms join public.groups g on g.id = ms.group_id
                           where ms.user_id = p.id), '[]'::jsonb)
    ) m
    from public.profiles p left join auth.users u on u.id = p.id) s), '[]'::jsonb);
end $function$;

insert into public.schema_migrations (version, notes)
values ('0027_premium_revenus', 'abonnements Google Play, revenus et statistiques d''usage pour le site d''administration')
on conflict (version) do nothing;
