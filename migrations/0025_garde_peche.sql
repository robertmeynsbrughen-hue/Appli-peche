-- 0025 — Garde-pêche : fonctions de lecture pour le site d'administration sur PC
--
-- Le site d'administration (fichier local, hors du dépôt) se connecte avec le
-- compte du développeur. Ces fonctions lui donnent une vue d'ensemble que les
-- règles d'accès ne permettent pas en lecture directe (e-mails, dernières
-- connexions, stockage). Toutes vérifient que l'appelant est administrateur.
-- Aucune ne modifie de données. Rejouable sans erreur.

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
      'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'role', ms.role, 'status', ms.status, 'joined_at', ms.joined_at) order by g.name)
                            from public.memberships ms join public.groups g on g.id = ms.group_id
                           where ms.user_id = p.id), '[]'::jsonb)
    ) m
    from public.profiles p left join auth.users u on u.id = p.id) s), '[]'::jsonb);
end $function$;

create or replace function public.garde_groups()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'non autorisé'; end if;
  return coalesce((select jsonb_agg(x order by x->>'name') from (
    select jsonb_build_object(
      'id', g.id, 'name', g.name, 'region', g.region, 'created_at', g.created_at,
      'require_approval', g.require_approval, 'post_approval', g.post_approval, 'is_welcome', g.is_welcome,
      'owner', (select pr.username from public.memberships ms join public.profiles pr on pr.id = ms.user_id
                 where ms.group_id = g.id and ms.role = 'owner' limit 1),
      'members', (select count(*) from public.memberships ms where ms.group_id = g.id and ms.status = 'active'),
      'pending_members', (select count(*) from public.memberships ms where ms.group_id = g.id and ms.status = 'pending'),
      'posts', (select count(*) from public.posts p where p.group_id = g.id),
      'pending_posts', (select count(*) from public.posts p where p.group_id = g.id and p.status = 'pending'),
      'posts_7d', (select count(*) from public.posts p where p.group_id = g.id and p.created_at > now() - interval '7 days'),
      'messages_7d', (select count(*) from public.messages m where m.group_id = g.id and m.created_at > now() - interval '7 days'),
      'spots', (select count(*) from public.spots s where s.group_id = g.id),
      'open_reports', (select count(*) from public.reports r where r.group_id = g.id and r.status = 'open'),
      'last_activity', greatest(
          (select max(created_at) from public.posts p where p.group_id = g.id),
          (select max(created_at) from public.messages m where m.group_id = g.id),
          g.created_at)
    ) x from public.groups g) s), '[]'::jsonb);
end $function$;

create or replace function public.garde_storage()
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'non autorisé'; end if;
  return jsonb_build_object(
    'buckets', coalesce((select jsonb_agg(jsonb_build_object('bucket', b.id, 'files', coalesce(s.n, 0), 'bytes', coalesce(s.bytes, 0)) order by b.id)
                           from storage.buckets b
                           left join (select bucket_id, count(*) n, sum(coalesce((metadata->>'size')::bigint, 0)) bytes
                                        from storage.objects group by bucket_id) s on s.bucket_id = b.id), '[]'::jsonb),
    'purge_waiting', (select count(*) from public.storage_purge where done_at is null),
    'purge_errors', (select count(*) from public.storage_purge where done_at is null and error is not null),
    'purge_done_30d', (select count(*) from public.storage_purge where done_at > now() - interval '30 days'),
    'db_bytes', pg_database_size(current_database())
  );
end $function$;

revoke all on function public.garde_members() from public, anon;
revoke all on function public.garde_groups() from public, anon;
revoke all on function public.garde_storage() from public, anon;
grant execute on function public.garde_members() to authenticated;
grant execute on function public.garde_groups() to authenticated;
grant execute on function public.garde_storage() to authenticated;

insert into public.schema_migrations (version, notes)
values ('0025_garde_peche', 'fonctions de lecture pour le site d''administration sur PC (membres, groupes, stockage)')
on conflict (version) do nothing;
