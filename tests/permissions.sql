-- Tests de permissions sur une vraie base Supabase (plan de reprise, étape 6).
--
-- Exécuté par .github/workflows/permissions.yml sur le projet de test isolé,
-- APRÈS les migrations en attente, dans la même transaction, qui est ANNULÉE à
-- la fin : la base de test n'est jamais modifiée par ces tests.
-- Chaque vérification lève une erreur explicite (« ÉCHEC … ») si elle échoue.
-- Les comptes et groupes créés ici sont fictifs.

-- ---------- Données fictives ----------
set local session_replication_role = replica;   -- pas de déclencheurs pendant la mise en place
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'membre-a@test.invalid'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'membre-b@test.invalid'),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sans-groupe@test.invalid');
insert into public.profiles (id, username) values
  ('00000000-0000-4000-8000-0000000000a1', 'test_membre_a'),
  ('00000000-0000-4000-8000-0000000000b2', 'test_membre_b'),
  ('00000000-0000-4000-8000-0000000000c3', 'test_sans_groupe');
insert into public.groups (id, name, invite_code) overriding system value values
  (900001, 'Groupe test A', 'TEST-CODE-A'),
  (900002, 'Groupe test B', 'TEST-CODE-B');
insert into public.memberships (group_id, user_id, role, status) values
  (900001, '00000000-0000-4000-8000-0000000000a1', 'owner', 'active'),
  (900002, '00000000-0000-4000-8000-0000000000b2', 'owner', 'active');
insert into public.messages (group_id, user_id, body) values
  (900001, '00000000-0000-4000-8000-0000000000a1', 'message du groupe A'),
  (900002, '00000000-0000-4000-8000-0000000000b2', 'message du groupe B');
insert into public.posts (group_id, user_id, species, status, conditions) values
  (900001, '00000000-0000-4000-8000-0000000000a1', 'Carpe', 'published', '{"water":12,"dp":0,"wind":10,"cloud":50}'),
  (900002, '00000000-0000-4000-8000-0000000000b2', 'Brochet', 'published', '{"water":12,"dp":0,"wind":10,"cloud":50}');
with t as (
  insert into public.tracks (user_id, group_id, started_at, ended_at, points)
  values ('00000000-0000-4000-8000-0000000000a1', 900001, now(), now() + interval '1 hour', '[ [46.5, 1.5], [46.6, 1.6] ]'::jsonb)
  returning id
)
insert into public.sessions (group_id, user_id, species, caught, rating, track_id)
select 900001, '00000000-0000-4000-8000-0000000000a1', 'Carpe', true, 3, id from t;
with t as (
  insert into public.tracks (user_id, group_id, started_at, ended_at, points)
  values ('00000000-0000-4000-8000-0000000000b2', 900002, now(), now() + interval '1 hour', '[ [47.5, 2.5] ]'::jsonb)
  returning id
)
insert into public.sessions (group_id, user_id, species, caught, rating, track_id)
select 900002, '00000000-0000-4000-8000-0000000000b2', 'Brochet', true, 3, id from t;
insert into public.subscriptions (purchase_token, user_id, product_id, status, expires_at) values
  ('test-token-b', '00000000-0000-4000-8000-0000000000b2', 'rivio_premium', 'active', now() + interval '30 days');
set local session_replication_role = origin;

-- ---------- 1. Droits déclarés (vus par postgres) ----------
do $$
declare got text; expected text :=
  'bug_reports_limit,check_invite,dm_allowed,log_client_error,message_group,peek_invite,photo_group,qa_group,username_available';
begin
  select string_agg(distinct p.proname, ',' order by p.proname) into got
    from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute');
  if got is distinct from expected then
    raise exception 'ÉCHEC fonctions appelables sans compte : % (attendu : %)', got, expected;
  end if;

  if has_column_privilege('authenticated', 'public.groups', 'invite_code', 'select')
     or has_column_privilege('anon', 'public.groups', 'invite_code', 'select') then
    raise exception 'ÉCHEC groups.invite_code est lisible côté client';
  end if;
  if not has_column_privilege('authenticated', 'public.groups', 'is_welcome', 'select') then
    raise exception 'ÉCHEC groups.is_welcome n''est plus lisible : la liste des groupes serait vide (incident 0.73)';
  end if;

  if has_table_privilege('anon', 'public.push_subs', 'select') or has_table_privilege('authenticated', 'public.push_subs', 'select')
     or has_table_privilege('authenticated', 'public.settings', 'select')
     or has_table_privilege('authenticated', 'public.invite_attempts', 'select')
     or has_table_privilege('authenticated', 'public.storage_purge', 'select')
     or has_table_privilege('authenticated', 'public.revenue_events', 'select')
     or has_table_privilege('anon', 'public.subscriptions', 'select') then
    raise exception 'ÉCHEC une table réservée au serveur est accessible au client (push_subs, settings, invite_attempts, storage_purge, revenue_events ou subscriptions)';
  end if;
  if has_table_privilege('authenticated', 'public.subscriptions', 'insert') or has_table_privilege('authenticated', 'public.subscriptions', 'update') then
    raise exception 'ÉCHEC le client peut écrire un abonnement Premium';
  end if;
  if has_table_privilege('authenticated', 'public.notifications', 'insert') then
    raise exception 'ÉCHEC le client peut créer des notifications';
  end if;
  if has_function_privilege('authenticated', 'public.call_notify(jsonb)', 'execute') then
    raise exception 'ÉCHEC le client peut appeler call_notify';
  end if;
  if has_function_privilege('anon', 'public.heatmap_track_starts(bigint)', 'execute') then
    raise exception 'ÉCHEC un visiteur sans compte peut appeler heatmap_track_starts';
  end if;
  if not has_function_privilege('authenticated', 'public.heatmap_track_starts(bigint)', 'execute') then
    raise exception 'ÉCHEC un membre ne peut pas charger les points de départ de la carte de chaleur';
  end if;
  if exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity) then
    raise exception 'ÉCHEC table sans RLS : %', (select string_agg(relname, ', ') from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity);
  end if;
end $$;

-- ---------- 2. Membre du groupe A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare n int;
begin
  -- la requête de la liste des groupes, telle que l'appli la fait
  begin
    perform id, name, region, created_at, require_approval, post_approval, is_welcome from public.groups;
  exception when others then
    raise exception 'ÉCHEC un membre ne peut pas lire la liste des groupes : %', sqlerrm;
  end;
  select count(*) into n from public.groups where id in (900001, 900002);
  if n <> 1 then raise exception 'ÉCHEC le membre A voit % groupe(s) de test au lieu de 1', n; end if;
  select count(*) into n from public.messages where group_id = 900001;
  if n <> 1 then raise exception 'ÉCHEC le membre A ne voit pas le message de son groupe'; end if;
  select count(*) into n from public.messages where group_id = 900002;
  if n <> 0 then raise exception 'ÉCHEC le membre A voit les messages du groupe B'; end if;
  select count(*) into n from public.posts where group_id = 900002;
  if n <> 0 then raise exception 'ÉCHEC le membre A voit les prises du groupe B'; end if;
  select count(*) into n from public.heatmap_track_starts(900001);
  if n <> 1 then raise exception 'ÉCHEC la carte de chaleur ne renvoie pas la trace du groupe A'; end if;
  if not exists (select 1 from public.heatmap_track_starts(900001) where lat = 46.5 and lon = 1.5) then
    raise exception 'ÉCHEC la carte de chaleur ne renvoie pas le premier point de la trace';
  end if;
  select count(*) into n from public.heatmap_track_starts(900002);
  if n <> 0 then raise exception 'ÉCHEC le membre A voit les points de départ des traces du groupe B'; end if;

  update public.profiles set bio = 'piraté' where id = '00000000-0000-4000-8000-0000000000b2';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ÉCHEC le membre A peut modifier le profil du membre B'; end if;

  begin
    insert into public.messages (group_id, user_id, body) values (900002, '00000000-0000-4000-8000-0000000000a1', 'intrusion');
    raise exception 'ÉCHEC le membre A peut écrire dans le groupe B';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;
reset role;

-- ---------- 3. Compte sans groupe ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.groups where id in (900001, 900002);
  if n <> 0 then raise exception 'ÉCHEC un compte sans groupe voit % groupe(s) privé(s)', n; end if;
  select count(*) into n from public.messages where group_id in (900001, 900002);
  if n <> 0 then raise exception 'ÉCHEC un compte sans groupe voit des messages privés'; end if;
end $$;
reset role;

-- ---------- 4. Visiteur sans compte ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.messages;
  if n <> 0 then raise exception 'ÉCHEC un visiteur sans compte voit des messages'; end if;
  select count(*) into n from public.posts;
  if n <> 0 then raise exception 'ÉCHEC un visiteur sans compte voit des prises'; end if;
exception when insufficient_privilege then null;
end $$;
reset role;

-- ---------- 5. Fonctions du site d'administration (Garde-pêche) ----------
-- Réservées au développeur : un membre ordinaire est refusé.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare f text; ok boolean;
begin
  foreach f in array array['garde_members', 'garde_groups', 'garde_storage', 'garde_revenue', 'garde_usage'] loop
    ok := false;
    begin
      execute format('select public.%I()', f);
    exception when others then ok := sqlerrm like '%non autorisé%';
    end;
    if not ok then raise exception 'ÉCHEC un membre ordinaire peut appeler %', f; end if;
  end loop;
  if exists (select 1 from public.subscriptions where purchase_token = 'test-token-b') then
    raise exception 'ÉCHEC le membre A voit l''abonnement Premium du membre B';
  end if;
  if public.is_premium() then raise exception 'ÉCHEC le membre A est vu Premium sans abonnement'; end if;
  -- 0029 : les bilans « conditions proches » ne lisent que les groupes du membre
  if not exists (select 1 from public.advice_history(12, 0, 10, 50) where species = 'carpe') then
    raise exception 'ÉCHEC advice_history ne voit pas les prises du groupe du membre A';
  end if;
  if exists (select 1 from public.advice_history(12, 0, 10, 50) where species = 'brochet') then
    raise exception 'ÉCHEC advice_history révèle les prises du groupe B au membre A';
  end if;
end $$;
reset role;

select 'OK : toutes les vérifications de permissions sont passées' as resultat;
