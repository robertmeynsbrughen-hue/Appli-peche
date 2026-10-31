-- 2026-10-31_01 — Confinement des policies UPDATE au groupe du propriétaire
--
-- Problème : cinq policies d'UPDATE ne vérifiaient que `user_id = auth.uid()`
-- (ou `can_moderate(group_id)`), jamais l'appartenance au groupe de la ligne
-- APRÈS modification. Un membre pouvait donc créer une ligne personnelle
-- (group_id NULL), puis la déplacer dans un groupe dont il n'est pas membre :
-- fausse annonce « je pars pêcher », position inventée, zone ou événement poison
-- visibles par un autre groupe.
--
-- Les policies d'INSERT équivalentes vérifiaient déjà le groupe ; on aligne
-- l'UPDATE sur l'INSERT. WITH CHECK s'applique à la NOUVELLE ligne, USING à
-- l'ancienne : on garde USING identique, on durcit WITH CHECK.
--
-- Rejouable : drop policy if exists avant chaque create.

begin;

-- checkins (annonces « je pars pêcher »)
drop policy if exists checkins_update on public.checkins;
create policy checkins_update on public.checkins for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (group_id is null or public.is_member_of(group_id))
  );

-- carp_sessions (sessions carpe)
drop policy if exists carp_sessions_update on public.carp_sessions;
create policy carp_sessions_update on public.carp_sessions for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (group_id is null or public.is_member_of(group_id))
  );

-- outings (sorties planifiées)
drop policy if exists outings_update on public.outings;
create policy outings_update on public.outings for update
  using (user_id = auth.uid() or public.can_moderate(group_id))
  with check (
    (user_id = auth.uid() or public.can_moderate(group_id))
    and (group_id is null or public.is_member_of(group_id) or public.can_moderate(group_id))
  );

-- map_zones (zones de la carte)
drop policy if exists zones_update on public.map_zones;
create policy zones_update on public.map_zones for update
  using (user_id = auth.uid() or public.can_moderate(group_id))
  with check (
    (user_id = auth.uid() or public.can_moderate(group_id))
    and (group_id is null or public.is_member_of(group_id) or public.can_moderate(group_id))
  );

-- fish_events (événements poisson)
drop policy if exists fe_update on public.fish_events;
create policy fe_update on public.fish_events for update
  using (user_id = auth.uid() or public.can_moderate(group_id))
  with check (
    (user_id = auth.uid() or public.can_moderate(group_id))
    and (group_id is null or public.is_member_of(group_id) or public.can_moderate(group_id))
  );

commit;

-- ---------------------------------------------------------------------------
-- ROLLBACK (remet exactement l'état d'avant) :
--
-- begin;
-- drop policy if exists checkins_update on public.checkins;
-- create policy checkins_update on public.checkins for update
--   using (user_id = auth.uid()) with check (user_id = auth.uid());
-- drop policy if exists carp_sessions_update on public.carp_sessions;
-- create policy carp_sessions_update on public.carp_sessions for update
--   using (user_id = auth.uid()) with check (user_id = auth.uid());
-- drop policy if exists outings_update on public.outings;
-- create policy outings_update on public.outings for update
--   using ((user_id = auth.uid()) or can_moderate(group_id))
--   with check ((user_id = auth.uid()) or can_moderate(group_id));
-- drop policy if exists zones_update on public.map_zones;
-- create policy zones_update on public.map_zones for update
--   using ((user_id = auth.uid()) or can_moderate(group_id))
--   with check ((user_id = auth.uid()) or can_moderate(group_id));
-- drop policy if exists fe_update on public.fish_events;
-- create policy fe_update on public.fish_events for update
--   using ((user_id = auth.uid()) or can_moderate(group_id))
--   with check ((user_id = auth.uid()) or can_moderate(group_id));
-- commit;
-- ---------------------------------------------------------------------------
