-- 0024 — Performances de la base (correctifs de l'audit Supabase du 3 novembre 2026)
--
-- 1. Chaque clé étrangère sans index en reçoit un : les suppressions en
--    cascade (compte, groupe) et les jointures ne parcourent plus toute la table.
-- 2. Dans les règles d'accès (RLS), auth.uid(), auth.role() et auth.jwt() sont
--    entourés d'un (select …) : la valeur est calculée une fois par requête au
--    lieu d'une fois par ligne. Le sens des règles ne change pas (les tests de
--    permissions le vérifient).
-- 3. Un index en double est supprimé dans backup.snapshots.
-- Rejouable sans erreur.

-- 1. Index des clés étrangères
do $$
declare fk record; idx text;
begin
  for fk in
    select c.conrelid::regclass as tbl, c.conrelid, c.conkey,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
           (select string_agg(a.attname, '_' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as colnames,
           (select relname from pg_class where oid = c.conrelid) as relname
      from pg_constraint c
     where c.contype = 'f'
       and c.connamespace = 'public'::regnamespace
       and not exists (
         select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey)
  loop
    idx := left(fk.relname || '_' || fk.colnames, 54) || '_fk_idx';
    execute format('create index if not exists %I on %s (%s)', idx, fk.tbl, fk.cols);
  end loop;
end $$;

-- 2. auth.uid() & co. évalués une fois par requête dans les règles RLS
do $$
declare p record; q text; c text; cmd text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ 'auth\.(uid|role|jwt)\(\)' or coalesce(with_check, '') ~ 'auth\.(uid|role|jwt)\(\)')
  loop
    q := p.qual; c := p.with_check;
    -- les appels déjà entourés sont mis de côté, les autres sont entourés
    q := regexp_replace(q, '\( SELECT auth\.(uid|role|jwt)\(\) AS (uid|role|jwt)\)', '§\1§', 'g');
    q := regexp_replace(q, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
    q := regexp_replace(q, '§(uid|role|jwt)§', '(select auth.\1())', 'g');
    c := regexp_replace(c, '\( SELECT auth\.(uid|role|jwt)\(\) AS (uid|role|jwt)\)', '§\1§', 'g');
    c := regexp_replace(c, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
    c := regexp_replace(c, '§(uid|role|jwt)§', '(select auth.\1())', 'g');
    if q is not distinct from p.qual and c is not distinct from p.with_check then continue; end if;
    cmd := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if q is not null then cmd := cmd || format(' using (%s)', q); end if;
    if c is not null then cmd := cmd || format(' with check (%s)', c); end if;
    execute cmd;
  end loop;
end $$;

-- 3. Index en double
do $$ begin
  if exists (select 1 from pg_indexes where schemaname = 'backup' and indexname = 'snapshots_snap')
     and exists (select 1 from pg_indexes where schemaname = 'backup' and indexname = 'snapshots_snap_idx') then
    drop index backup.snapshots_snap_idx;
  end if;
end $$;

insert into public.schema_migrations (version, notes)
values ('0024_performances_base', 'index des clés étrangères, auth.uid() évalué une fois par requête dans les règles RLS')
on conflict (version) do nothing;
