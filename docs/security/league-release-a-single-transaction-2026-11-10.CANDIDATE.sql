-- SHARKANIA RELEASE A - CONSOLIDATED SQL CANDIDATE (REVIEW ONLY, 2026-11-10)
-- NEVER apply to production prior to restored-prod clone QA and explicit owner approval.
-- This single atomic transaction combines validated branch prototypes for
-- league membership, USD-only first upload, native-currency audit, legacy
-- writer fences and private ELO/standings helpers. P0 is already live.
-- Historical edit/delete and CLP/EUR result publication intentionally blocked.
-- NO QA forwarding alias, NO v2 formula, NO temporary QA schema.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- 1. PRE-EXISTING production fingerprints checked BEFORE any DDL.
DO $source_preflight$
DECLARE v record; v_current text; v_exec bool;
BEGIN
 FOR v IN SELECT * FROM (VALUES
    ('bulk_delete_scheduled_tournaments','p_tournament_ids uuid[]','98217e0c3792f81349d63428dd0b37ac'),
    ('delete_tournament_god_mode','tournament_id_to_delete uuid','bcfbc09bd9a8c1726afabb36135b2bb7'),
    ('recalculate_league_standings','p_league_id uuid','b1cef8db810f7ab06b3cffe06daf0f0a'),
    ('reset_tournament_impact','tournament_id_to_reset uuid','c3f34919450f15b5c92fe8e14bef7bb8'),
    ('update_league_standings','p_league_id uuid','28f8c81f6d7bec6a62486428d89a9052')
 ) AS expected(function_name,identity_arguments,hash_md5)
 LOOP
   SELECT pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)),
          pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
     INTO v_current,v_exec
   FROM pg_catalog.pg_proc p
   WHERE p.pronamespace='public'::regnamespace
     AND p.proname=v.function_name
     AND pg_catalog.pg_get_function_identity_arguments(p.oid)=v.identity_arguments;
   IF v_current IS DISTINCT FROM v.hash_md5 OR v_exec IS DISTINCT FROM true THEN
     RAISE EXCEPTION 'Legacy RPC catalog drift: % (%)',v.function_name,v.identity_arguments USING ERRCODE='PT409';
   END IF;
 END LOOP;
END;
$source_preflight$;

-- 2. Assert no unreviewed players/audit/policy catalog drift before writes.
DO $release_a_extra_preflight$
DECLARE v_collision integer;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='sharkania_release')
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace
      AND proname='publish_league_nickname_results_guarded') THEN
    RAISE EXCEPTION 'Release A ledger or stable writer already exists; stop and reconcile' USING ERRCODE='PT409';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='public.tournament_results'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='public.elo_history'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='public.players'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='public.league_standings'::regclass)
  THEN RAISE EXCEPTION 'RLS missing from critical write tables' USING ERRCODE='PT409'; END IF;
  SELECT count(*) INTO v_collision FROM (
     SELECT room_id,pg_catalog.lower(pg_catalog.btrim(nickname))
     FROM public.players
     WHERE room_id IS NOT NULL AND nickname IS NOT NULL
     GROUP BY room_id,pg_catalog.lower(pg_catalog.btrim(nickname))
     HAVING count(*)>1
  ) collisions;
  IF v_collision<>0 THEN
    RAISE EXCEPTION 'Existing player nickname normalized collisions: %',v_collision USING ERRCODE='PT409';
  END IF;
  IF EXISTS(SELECT 1 FROM public.players WHERE room_id IS NULL OR nickname IS NULL
            OR length(pg_catalog.btrim(nickname))=0) THEN
    RAISE EXCEPTION 'Player room or nickname gaps require reconciliation' USING ERRCODE='PT409';
  END IF;
END;
$release_a_extra_preflight$;

-- 3. Reuse guarded membership preflight, privileges and RPCs.
DO $league_cutover_preflight$
DECLARE
  v_expected integer;
  v_unreviewed text;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class
          WHERE oid='public.leagues'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class
            WHERE oid='public.league_clubs'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class
            WHERE oid='public.league_rooms'::regclass)
  THEN
    RAISE EXCEPTION 'STOP: league RLS must be enabled before Release A'
      USING ERRCODE='PT409';
  END IF;

  -- P0 was deployed separately: a same-name replacement index that is
  -- not UNIQUE or has another predicate must NEVER be silently accepted.
  -- CREATE INDEX IF NOT EXISTS below only checks the name, not its definition.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class ix ON ix.oid=i.indexrelid
    WHERE i.indrelid='public.league_clubs'::regclass
      AND ix.relname='league_clubs_one_primary_per_league_guarded'
      AND i.indisunique AND i.indisvalid AND i.indisready
      AND i.indnkeyatts=1 AND i.indnatts=1
      AND pg_catalog.pg_get_indexdef(i.indexrelid,1,true)='league_id'
      AND pg_catalog.pg_get_expr(i.indpred,i.indrelid)
          ILIKE '%is_primary IS TRUE%'
  ) THEN
    RAISE EXCEPTION 'STOP: P0 unique primary index has changed or is missing'
      USING ERRCODE='PT409';
  END IF;

  SELECT count(*) INTO v_expected
  FROM pg_policies
  WHERE schemaname='public'
    AND (
      (tablename='league_clubs' AND policyname IN
        ('League clubs: admin insert','League clubs: admin update',
         'League clubs: admin delete'))
      OR (tablename='leagues' AND policyname IN
        ('Leagues: admin puede crear','Leagues: admin o super editar',
         'Leagues: admin o super eliminar'))
      OR (tablename='league_rooms' AND policyname IN
        ('Permitir insertar league_rooms','Permitir borrar league_rooms'))
    );
  IF v_expected <> 8 THEN
    RAISE EXCEPTION 'STOP: legacy league policies changed; reconcile P1 and Release A before cutover'
      USING ERRCODE='PT409';
  END IF;

  SELECT string_agg(format('%I.%I (%s)',tablename,policyname,cmd), ', ')
  INTO v_unreviewed
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN ('league_clubs','leagues','league_rooms')
    AND cmd IN ('ALL','INSERT','UPDATE','DELETE')
    AND NOT (
      (tablename='league_clubs' AND policyname IN
        ('League clubs: admin insert','League clubs: admin update',
         'League clubs: admin delete'))
      OR (tablename='leagues' AND policyname IN
        ('Leagues: admin puede crear','Leagues: admin o super editar',
         'Leagues: admin o super eliminar'))
      OR (tablename='league_rooms' AND policyname IN
        ('Permitir insertar league_rooms','Permitir borrar league_rooms',
         'League rooms: super admin insert','League rooms: super admin update',
         'League rooms: super admin delete'))
    );
  IF v_unreviewed IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: unreviewed league write policy exists: %',
      v_unreviewed USING ERRCODE='PT409';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.leagues l
    LEFT JOIN public.league_clubs lc
      ON lc.league_id=l.id AND lc.is_primary IS TRUE
    GROUP BY l.id
    HAVING count(lc.id) <> 1
  ) THEN
    RAISE EXCEPTION 'STOP: league has missing or multiple primary clubs'
      USING ERRCODE='PT409';
  END IF;
END;
$league_cutover_preflight$;

-- The existing leagues were inspected read-only: no league has zero or
-- multiple primary clubs. Enforce AT MOST one organizer at the DB layer.
-- Combined with the guarded creation RPC, this also guarantees a primary
-- for every league created by the new flow.
-- The emergency RLS QA proposal in PR #79 can create the same index first.
-- Reuse it instead of building a second identical index (disk/WAL overhead).
CREATE UNIQUE INDEX IF NOT EXISTS league_clubs_one_primary_per_league_guarded
ON public.league_clubs (league_id) WHERE is_primary;

-- Remove exactly the policy names independently verified from production.
DROP POLICY IF EXISTS "League clubs: admin insert" ON public.league_clubs;
DROP POLICY IF EXISTS "League clubs: admin update" ON public.league_clubs;
DROP POLICY IF EXISTS "League clubs: admin delete" ON public.league_clubs;

DROP POLICY IF EXISTS "Permitir insertar league_rooms" ON public.league_rooms;
DROP POLICY IF EXISTS "Permitir borrar league_rooms" ON public.league_rooms;

DROP POLICY IF EXISTS "Leagues: admin o super editar" ON public.leagues;
DROP POLICY IF EXISTS "Leagues: admin o super eliminar" ON public.leagues;
DROP POLICY IF EXISTS "Leagues: admin puede crear" ON public.leagues;

-- Fail-closed even when any leftover permissive policy exists: no INSERT /
-- UPDATE / DELETE privilege for anon or authenticated on these tables.
REVOKE INSERT,UPDATE,DELETE ON TABLE public.league_clubs
  FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON TABLE public.league_rooms
  FROM PUBLIC,anon,authenticated;
REVOKE INSERT,DELETE ON TABLE public.leagues
  FROM PUBLIC,anon,authenticated;

CREATE POLICY "leagues_primary_owner_update"
ON public.leagues FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.league_clubs lc
      WHERE lc.league_id=leagues.id AND lc.is_primary
        AND (SELECT public.is_club_admin(lc.club_id))
    )
  )
)
WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
    (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1 FROM public.league_clubs lc
      WHERE lc.league_id=leagues.id AND lc.is_primary
        AND (SELECT public.is_club_admin(lc.club_id))
    )
  )
);


CREATE OR REPLACE FUNCTION public.create_league_guarded(
  p_primary_club_id uuid,
  p_name text,
  p_slug text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  v_name text := nullif(pg_catalog.btrim(p_name),'');
  v_slug text := nullif(pg_catalog.btrim(p_slug),'');
  v_league_id uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(p_primary_club_id))) THEN
    RAISE EXCEPTION 'Primary club administration required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=p_primary_club_id) THEN
    RAISE EXCEPTION 'Primary club missing' USING ERRCODE='PT422';
  END IF;
  IF v_name IS NULL OR pg_catalog.length(v_name) NOT BETWEEN 3 AND 150
     OR v_slug IS NULL OR pg_catalog.length(v_slug)>160
     OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid league name or slug' USING ERRCODE='PT422';
  END IF;
  -- Production already has a UNIQUE idx_leagues_slug index. The advisory
  -- lock makes concurrent guarded clients fail with a controlled PT409;
  -- the existing database index protects other writers as a final guard.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('league_slug:'||v_slug,0)
  );
  IF EXISTS (SELECT 1 FROM public.leagues WHERE slug=v_slug) THEN
    RAISE EXCEPTION 'League slug already used' USING ERRCODE='PT409';
  END IF;

  INSERT INTO public.leagues(name,slug)
  VALUES (v_name,v_slug)
  RETURNING id INTO v_league_id;

  INSERT INTO public.league_clubs(league_id,club_id,is_primary)
  VALUES (v_league_id,p_primary_club_id,true);

  RETURN v_league_id;
END;
$func$;

CREATE OR REPLACE FUNCTION public.add_league_club_guarded(
  p_league_id uuid,
  p_club_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  v_primary uuid;
  v_is_super boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  -- Serialize all membership operations on a single league.
  PERFORM l.id FROM public.leagues l WHERE l.id=p_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'League missing' USING ERRCODE='PT404';
  END IF;
  SELECT lc.club_id INTO v_primary
  FROM public.league_clubs lc
  WHERE lc.league_id=p_league_id AND lc.is_primary
  ORDER BY lc.id LIMIT 1;
  IF v_primary IS NULL OR
     (SELECT count(*) FROM public.league_clubs lc
      WHERE lc.league_id=p_league_id AND lc.is_primary)<>1 THEN
    RAISE EXCEPTION 'Primary ownership ambiguous or missing'
      USING ERRCODE='PT409';
  END IF;
  v_is_super := (SELECT public.is_super_admin());
  IF NOT v_is_super AND NOT (
    (SELECT public.is_club_admin(v_primary))
    AND (SELECT public.is_club_admin(p_club_id))
  ) THEN
    RAISE EXCEPTION 'Both clubs must authorize league membership'
      USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.id=p_club_id) THEN
    RAISE EXCEPTION 'Participating club missing' USING ERRCODE='PT422';
  END IF;
  -- A second call is a no-op; NEVER promote a secondary to primary.
  IF EXISTS (SELECT 1 FROM public.league_clubs lc
             WHERE lc.league_id=p_league_id AND lc.club_id=p_club_id) THEN
    RETURN false;
  END IF;
  INSERT INTO public.league_clubs(league_id,club_id,is_primary)
  VALUES (p_league_id,p_club_id,false);
  RETURN true;
END;
$func$;

CREATE OR REPLACE FUNCTION public.set_league_rooms_guarded(
  p_league_id uuid,
  p_room_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  v_primary uuid;
  v_rooms uuid[] := coalesce(p_room_ids, ARRAY[]::uuid[]);
  v_n integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  PERFORM l.id FROM public.leagues l WHERE l.id=p_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'League missing' USING ERRCODE='PT404';
  END IF;
  SELECT lc.club_id INTO v_primary
  FROM public.league_clubs lc
  WHERE lc.league_id=p_league_id AND lc.is_primary
  ORDER BY lc.id LIMIT 1;
  IF v_primary IS NULL OR
     (SELECT count(*) FROM public.league_clubs lc
      WHERE lc.league_id=p_league_id AND lc.is_primary)<>1 THEN
    RAISE EXCEPTION 'Primary ownership ambiguous or missing'
      USING ERRCODE='PT409';
  END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(v_primary))) THEN
    RAISE EXCEPTION 'Primary club administration required' USING ERRCODE='42501';
  END IF;
  v_n := pg_catalog.cardinality(v_rooms);
  IF v_n>32 OR pg_catalog.array_position(v_rooms,NULL) IS NOT NULL OR
    (SELECT count(DISTINCT x.id) FROM pg_catalog.unnest(v_rooms) AS x(id))<>v_n
  THEN
    RAISE EXCEPTION 'Invalid or duplicate room list' USING ERRCODE='PT422';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.unnest(v_rooms) AS x(id)
             WHERE NOT EXISTS (SELECT 1 FROM public.poker_rooms r WHERE r.id=x.id)) THEN
    RAISE EXCEPTION 'Unknown poker room' USING ERRCODE='PT422';
  END IF;
  -- Set difference avoids row churn, WAL and new relationship UUIDs
  -- when the administrator submits an unchanged room selection.
  DELETE FROM public.league_rooms lr
  WHERE lr.league_id=p_league_id
    AND NOT (lr.room_id = ANY(v_rooms));
  INSERT INTO public.league_rooms(league_id,room_id)
  SELECT p_league_id,x.id FROM pg_catalog.unnest(v_rooms) AS x(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.league_rooms lr
    WHERE lr.league_id=p_league_id AND lr.room_id=x.id
  );
  RETURN v_n;
END;
$func$;

-- A league duplicate cannot inherit arbitrary member clubs. Only the
-- SOURCE primary club is attached to the NEW league. Existing room selection
-- and scoring/schedule configuration are retained. Historic tournaments,
-- standing entries, participants, payments and results are NOT cloned.
CREATE OR REPLACE FUNCTION public.duplicate_league_guarded(
  p_source_league_id uuid,
  p_new_name text,
  p_new_slug text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $func$
DECLARE
  v_name text := nullif(pg_catalog.btrim(p_new_name),'');
  v_slug text := nullif(pg_catalog.btrim(p_new_slug),'');
  v_primary uuid;
  v_new uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  -- Serialize operations against the source before copying relationships.
  PERFORM l.id FROM public.leagues l
  WHERE l.id=p_source_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'League not found' USING ERRCODE='PT404';
  END IF;
  SELECT lc.club_id INTO v_primary FROM public.league_clubs lc
  WHERE lc.league_id=p_source_league_id AND lc.is_primary
  ORDER BY lc.id LIMIT 1;
  IF v_primary IS NULL OR
     (SELECT count(*) FROM public.league_clubs lc
      WHERE lc.league_id=p_source_league_id AND lc.is_primary)<>1 THEN
    RAISE EXCEPTION 'Source league primary ownership is ambiguous'
      USING ERRCODE='PT409';
  END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(v_primary))) THEN
    RAISE EXCEPTION 'Only primary club admin may duplicate this league'
      USING ERRCODE='42501';
  END IF;
  IF v_name IS NULL OR pg_catalog.length(v_name) NOT BETWEEN 3 AND 150
     OR v_slug IS NULL OR pg_catalog.length(v_slug)>160
     OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid cloned league name or slug'
      USING ERRCODE='PT422';
  END IF;
  IF (SELECT count(*) FROM public.league_rooms lr
      WHERE lr.league_id=p_source_league_id)>32 THEN
    RAISE EXCEPTION 'Source league has too many rooms for this flow'
      USING ERRCODE='PT422';
  END IF;

  -- Production already enforces UNIQUE slug with idx_leagues_slug.
  -- Guarded create/duplicate share this advisory lock for stable PT409
  -- responses. Legacy direct writers must still be revoked at cutover.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('league_slug:'||v_slug,0)
  );
  IF EXISTS (SELECT 1 FROM public.leagues WHERE slug=v_slug) THEN
    RAISE EXCEPTION 'League slug already used' USING ERRCODE='PT409';
  END IF;

  INSERT INTO public.leagues(
    name,description,rules_url,start_date,end_date,status,
    scoring_system_id,total_dates,best_dates_to_count,slug,is_demo
  )
  SELECT v_name,l.description,l.rules_url,l.start_date,l.end_date,
         'upcoming',l.scoring_system_id,l.total_dates,
         l.best_dates_to_count,v_slug,l.is_demo
  FROM public.leagues l WHERE l.id=p_source_league_id
  RETURNING id INTO v_new;

  INSERT INTO public.league_clubs(league_id,club_id,is_primary)
  VALUES(v_new,v_primary,true);

  INSERT INTO public.league_rooms(league_id,room_id)
  SELECT v_new,lr.room_id FROM public.league_rooms lr
  WHERE lr.league_id=p_source_league_id;
  RETURN v_new;
END;
$func$;

-- Atomic replacement for LeagueForm: both create and edit are server-side.
-- Prevent the browser's historical 2-4 separate writes from leaving a
-- league without its organizer or with a partially updated room list.
CREATE OR REPLACE FUNCTION public.save_league_guarded(
  p_league_id uuid,
  p_primary_club_id uuid,
  p_name text,
  p_slug text,
  p_fields jsonb,
  p_room_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE
  v_name text := nullif(pg_catalog.btrim(p_name),'');
  v_slug text := nullif(pg_catalog.btrim(p_slug),'');
  v_fields jsonb := coalesce(p_fields,'{}'::jsonb);
  v_rooms uuid[] := coalesce(p_room_ids,ARRAY[]::uuid[]);
  v_total integer;
  v_best integer;
  v_league uuid;
  v_primary uuid;
  v_actor uuid := (SELECT auth.uid());
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF v_name IS NULL OR pg_catalog.length(v_name) NOT BETWEEN 3 AND 150 THEN
    RAISE EXCEPTION 'Invalid league name' USING ERRCODE='PT422';
  END IF;
  IF pg_catalog.jsonb_typeof(v_fields)<>'object' OR EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_object_keys(v_fields) AS k(name)
    WHERE k.name NOT IN (
      'description','start_date','end_date','rules_url','status',
      'total_dates','best_dates_to_count'
    )
  ) THEN
    RAISE EXCEPTION 'Invalid league field names' USING ERRCODE='PT422';
  END IF;
  IF (v_fields->>'status') IS NULL OR
     (v_fields->>'status') NOT IN ('upcoming','active','finished') THEN
    RAISE EXCEPTION 'Invalid league status' USING ERRCODE='PT422';
  END IF;
  IF pg_catalog.length(coalesce(v_fields->>'description',''))>5000 OR
     pg_catalog.length(coalesce(v_fields->>'rules_url',''))>2000 OR
     (v_fields->>'rules_url' IS NOT NULL AND v_fields->>'rules_url' !~ '^https?://')
  THEN
    RAISE EXCEPTION 'Description or rules URL invalid' USING ERRCODE='PT422';
  END IF;
  IF (v_fields->>'start_date' IS NOT NULL AND
      v_fields->>'start_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
     OR (v_fields->>'end_date' IS NOT NULL AND
      v_fields->>'end_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
  THEN
    RAISE EXCEPTION 'Invalid date format' USING ERRCODE='PT422';
  END IF;
  IF (v_fields->>'total_dates' IS NOT NULL AND
      v_fields->>'total_dates' !~ '^[1-9][0-9]{0,2}$')
     OR (v_fields->>'best_dates_to_count' IS NOT NULL AND
      v_fields->>'best_dates_to_count' !~ '^[1-9][0-9]{0,2}$')
  THEN
    RAISE EXCEPTION 'Invalid league date counts' USING ERRCODE='PT422';
  END IF;
  v_total := (v_fields->>'total_dates')::integer;
  v_best := (v_fields->>'best_dates_to_count')::integer;
  IF (v_total IS NOT NULL AND v_total>365)
     OR (v_best IS NOT NULL AND v_best>365)
     OR (v_best IS NOT NULL AND v_total IS NOT NULL AND v_best>v_total)
     OR (v_fields->>'start_date' IS NOT NULL
          AND v_fields->>'end_date' IS NOT NULL
          AND (v_fields->>'start_date')::date>(v_fields->>'end_date')::date)
  THEN
    RAISE EXCEPTION 'Inconsistent league dates' USING ERRCODE='PT422';
  END IF;
  IF pg_catalog.cardinality(v_rooms)>32 OR
     pg_catalog.array_position(v_rooms,NULL) IS NOT NULL OR
     (SELECT count(DISTINCT x.id) FROM pg_catalog.unnest(v_rooms) AS x(id))
      <>pg_catalog.cardinality(v_rooms)
     OR EXISTS (SELECT 1 FROM pg_catalog.unnest(v_rooms) AS x(id)
       WHERE NOT EXISTS (SELECT 1 FROM public.poker_rooms r WHERE r.id=x.id))
  THEN
    RAISE EXCEPTION 'Invalid league rooms' USING ERRCODE='PT422';
  END IF;

  IF p_league_id IS NULL THEN
    IF v_slug IS NULL OR pg_catalog.length(v_slug)>160
       OR v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
      RAISE EXCEPTION 'Invalid league slug' USING ERRCODE='PT422';
    END IF;
    IF NOT ((SELECT public.is_super_admin())
       OR (SELECT public.is_club_admin(p_primary_club_id)))
       OR NOT EXISTS (SELECT 1 FROM public.clubs c
                      WHERE c.id=p_primary_club_id) THEN
      RAISE EXCEPTION 'Primary club administration required'
        USING ERRCODE='42501';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('league_slug:'||v_slug,0)
    );
    IF EXISTS (SELECT 1 FROM public.leagues WHERE slug=v_slug) THEN
      RAISE EXCEPTION 'League slug already exists' USING ERRCODE='PT409';
    END IF;
    INSERT INTO public.leagues (
      name,slug,description,start_date,end_date,rules_url,
      total_dates,best_dates_to_count,status
    ) VALUES (
      v_name,v_slug,nullif(v_fields->>'description',''),
      (v_fields->>'start_date')::date,(v_fields->>'end_date')::date,
      nullif(v_fields->>'rules_url',''),v_total,v_best,
      (v_fields->>'status')::public.league_status
    ) RETURNING id INTO v_league;
    INSERT INTO public.league_clubs(league_id,club_id,is_primary)
    VALUES (v_league,p_primary_club_id,true);
  ELSE
    SELECT l.id INTO v_league FROM public.leagues l
    WHERE l.id=p_league_id FOR UPDATE;
    IF v_league IS NULL THEN
      RAISE EXCEPTION 'League not found' USING ERRCODE='PT404';
    END IF;
    SELECT lc.club_id INTO v_primary FROM public.league_clubs lc
    WHERE lc.league_id=v_league AND lc.is_primary;
    IF v_primary IS NULL OR
       (SELECT count(*) FROM public.league_clubs lc
        WHERE lc.league_id=v_league AND lc.is_primary)<>1 THEN
      RAISE EXCEPTION 'League ownership incomplete' USING ERRCODE='PT409';
    END IF;
    IF p_primary_club_id IS DISTINCT FROM v_primary THEN
      RAISE EXCEPTION 'Cannot reassign primary ownership' USING ERRCODE='42501';
    END IF;
    IF NOT ((SELECT public.is_super_admin()) OR
       (SELECT public.is_club_admin(v_primary))) THEN
      RAISE EXCEPTION 'Primary club administration required'
        USING ERRCODE='42501';
    END IF;
    -- Do not permit client changes to league slug, membership or score
    -- system IDs during the form edit. The UI uses original slug.
    IF v_slug IS DISTINCT FROM (SELECT l.slug FROM public.leagues l WHERE l.id=v_league) THEN
      RAISE EXCEPTION 'Slug changes require a separate authorized flow'
        USING ERRCODE='PT422';
    END IF;
    -- Do not generate UPDATE/WAL for an unchanged form submission.
    -- This also avoids firing updated_at triggers unnecessarily.
    UPDATE public.leagues l SET
      name=v_name,description=nullif(v_fields->>'description',''),
      start_date=(v_fields->>'start_date')::date,
      end_date=(v_fields->>'end_date')::date,
      rules_url=nullif(v_fields->>'rules_url',''),
      total_dates=v_total,best_dates_to_count=v_best,
      status=(v_fields->>'status')::public.league_status
    WHERE l.id=v_league
      AND (l.name,l.description,l.start_date,l.end_date,l.rules_url,
           l.total_dates,l.best_dates_to_count,l.status)
      IS DISTINCT FROM
          (v_name,nullif(v_fields->>'description',''),
           (v_fields->>'start_date')::date,
           (v_fields->>'end_date')::date,
           nullif(v_fields->>'rules_url',''),
           v_total,v_best,(v_fields->>'status')::public.league_status);
  END IF;

  -- Delta-only room writes: existing rows keep their IDs and no WAL is
  -- generated merely by submitting the same room list again.
  DELETE FROM public.league_rooms lr
  WHERE lr.league_id=v_league AND NOT (lr.room_id = ANY(v_rooms));
  INSERT INTO public.league_rooms(league_id,room_id)
  SELECT v_league,x.id FROM pg_catalog.unnest(v_rooms) AS x(id)
  WHERE NOT EXISTS(
    SELECT 1 FROM public.league_rooms lr
    WHERE lr.league_id=v_league AND lr.room_id=x.id
  );
  RETURN v_league;
END;
$func$;

-- Never allow direct DELETE on leagues. Production FKs have ON DELETE
-- SET NULL for tournaments.league_id and ON DELETE CASCADE for standings,
-- membership and rooms. A simple DELETE could silently orphan tournament
-- league relations and erase standings. Only *empty* leagues can be removed.
CREATE OR REPLACE FUNCTION public.delete_empty_league_guarded(
  p_league_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $func$
DECLARE v_primary uuid;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  -- Exclusive row lock serializes membership and FK-related concurrent writes.
  PERFORM l.id FROM public.leagues l
  WHERE l.id=p_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'League not found' USING ERRCODE='PT404';
  END IF;

  SELECT lc.club_id INTO v_primary
  FROM public.league_clubs lc
  WHERE lc.league_id=p_league_id AND lc.is_primary
  ORDER BY lc.id LIMIT 1;
  IF v_primary IS NULL OR
     (SELECT count(*) FROM public.league_clubs lc
      WHERE lc.league_id=p_league_id AND lc.is_primary)<>1 THEN
    RAISE EXCEPTION 'Primary club ownership ambiguous'
      USING ERRCODE='PT409';
  END IF;
  IF NOT ((SELECT public.is_super_admin())
      OR (SELECT public.is_club_admin(v_primary))) THEN
    RAISE EXCEPTION 'Primary organizer authorization required'
      USING ERRCODE='42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tournaments t
             WHERE t.league_id=p_league_id)
     OR EXISTS (SELECT 1 FROM public.tournament_templates tt
                WHERE tt.league_id=p_league_id)
     OR EXISTS (SELECT 1 FROM public.league_standings ls
                WHERE ls.league_id=p_league_id)
     OR EXISTS (SELECT 1 FROM public.current_league_champion cc
                WHERE cc.league_id=p_league_id)
  THEN
    RAISE EXCEPTION 'League has tournaments, templates, standings or champions'
      USING ERRCODE='PT409';
  END IF;

  DELETE FROM public.leagues l WHERE l.id=p_league_id;
  RETURN true;
END;
$func$;

-- New SECURITY DEFINER functions grant EXECUTE to PUBLIC by default:
-- close the opening in the SAME TRANSACTION and grant authenticated only.
REVOKE ALL ON FUNCTION public.create_league_guarded(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_league_guarded(uuid,text,text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.add_league_club_guarded(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.add_league_club_guarded(uuid,uuid)
  TO authenticated;
REVOKE ALL ON FUNCTION public.set_league_rooms_guarded(uuid,uuid[])
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_league_rooms_guarded(uuid,uuid[])
  TO authenticated;

REVOKE ALL ON FUNCTION public.duplicate_league_guarded(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_league_guarded(uuid,text,text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.delete_empty_league_guarded(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_empty_league_guarded(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.save_league_guarded(uuid,uuid,text,text,jsonb,uuid[])
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_league_guarded(uuid,uuid,text,text,jsonb,uuid[])
  TO authenticated;

-- 4. Private append-only evidence, plus index for room+normalized nickname.
CREATE UNIQUE INDEX league_players_normalized_nickname_room_guarded
 ON public.players(room_id,pg_catalog.lower(pg_catalog.btrim(nickname)));

CREATE SCHEMA IF NOT EXISTS sharkania_release;
REVOKE ALL ON SCHEMA sharkania_release FROM PUBLIC, anon, authenticated;

CREATE TABLE sharkania_release.elo_publication (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
 league_id uuid NOT NULL REFERENCES public.leagues(id),
 actor_profile_id uuid NOT NULL,
 algorithm_version text NOT NULL CHECK (length(algorithm_version) BETWEEN 3 AND 80),
 input_fingerprint text NOT NULL CHECK(input_fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(tournament_id)
);
CREATE TABLE sharkania_release.elo_player_checkpoint (
 publication_id uuid NOT NULL REFERENCES sharkania_release.elo_publication(id),
 player_id uuid NOT NULL REFERENCES public.players(id),
 elo_before numeric NOT NULL CHECK(elo_before>=100),
 elo_after numeric NOT NULL CHECK(elo_after>=100),
 elo_peak_before numeric NOT NULL CHECK(elo_peak_before>=elo_before),
 tournaments_before integer NOT NULL CHECK(tournaments_before>=0),
 cashes_before integer NOT NULL CHECK(cashes_before>=0),
 wins_before integer NOT NULL CHECK(wins_before>=0),
 prize_won_before numeric NOT NULL CHECK(prize_won_before>=0),
 buy_ins_before numeric NOT NULL CHECK(buy_ins_before>=0),
 elo_change numeric NOT NULL,
 PRIMARY KEY (publication_id,player_id),
 CHECK (cashes_before<=tournaments_before),
 CHECK (wins_before<=tournaments_before)
);
-- Immutable records: corrections must append a new explicitly versioned
-- event to a redesigned ledger, never overwrite an old checkpoint.
CREATE OR REPLACE FUNCTION sharkania_release.reject_publication_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $reject$
BEGIN
 RAISE EXCEPTION 'Publication evidence is immutable; append correction evidence'
   USING ERRCODE='PT409';
END;
$reject$;
REVOKE ALL ON FUNCTION sharkania_release.reject_publication_mutation()
FROM PUBLIC,anon,authenticated;

CREATE TRIGGER release_a_immutable_elo_publication
BEFORE UPDATE OR DELETE ON sharkania_release.elo_publication
FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();

CREATE TRIGGER release_a_immutable_elo_checkpoint
BEFORE UPDATE OR DELETE ON sharkania_release.elo_player_checkpoint
FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();

ALTER TABLE sharkania_release.elo_publication ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release.elo_player_checkpoint ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sharkania_release FROM PUBLIC,anon,authenticated;
-- No grants and NO data API exposure for client roles in this QA prototype.


CREATE TABLE sharkania_release.currency_posting (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 publication_id uuid NOT NULL
   REFERENCES sharkania_release.elo_publication(id),
 tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
 player_id uuid NOT NULL REFERENCES public.players(id),
 currency text NOT NULL CHECK (currency IN ('USD','EUR','CLP')),
 buy_in_per_entry numeric NOT NULL CHECK (buy_in_per_entry>=0),
 buy_ins_count integer NOT NULL CHECK (buy_ins_count BETWEEN 1 AND 100),
 entry_spend numeric GENERATED ALWAYS AS (buy_in_per_entry * buy_ins_count) STORED,
 prize_won numeric NOT NULL CHECK (prize_won>=0),
 bounties_won numeric NOT NULL CHECK (bounties_won>=0),
 UNIQUE(tournament_id,player_id)
);
ALTER TABLE sharkania_release.currency_posting ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sharkania_release.currency_posting FROM PUBLIC,anon,authenticated;
CREATE TRIGGER release_a_immutable_currency_posting
 BEFORE UPDATE OR DELETE ON sharkania_release.currency_posting
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();

-- Materialize no mixed-currency total: every aggregate is keyed by currency.
-- This PG17 security-invoker view resides in the private schema; API roles
-- have neither schema USAGE nor SELECT on the underlying posting table.
CREATE VIEW sharkania_release.currency_totals_by_player
WITH (security_invoker = true) AS
SELECT j.player_id,j.currency,
       count(*)::integer AS published_tournaments,
       sum(j.buy_ins_count)::integer AS total_entries,
       sum(j.entry_spend) AS total_entry_spend,
       sum(j.prize_won) AS total_prize_won,
       sum(j.bounties_won) AS total_bounties_won
FROM sharkania_release.currency_posting j
GROUP BY j.player_id,j.currency;
REVOKE ALL ON sharkania_release.currency_totals_by_player
  FROM PUBLIC,anon,authenticated;



-- 5. Private guarded standings calculation (no direct PostgREST EXECUTE).
CREATE OR REPLACE FUNCTION sharkania_release.recalculate_standings_guarded(p_league_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guarded$
DECLARE
  v_best integer;
  v_primary uuid;
  v_primary_count integer;
  v_written integer := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  -- Lock the league to serialize calls to THIS function. A later release
  -- must also coordinate writers of tournament results with the same lock.
  SELECT l.best_dates_to_count INTO v_best
  FROM public.leagues l WHERE l.id=p_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'League not found' USING ERRCODE='PT404';
  END IF;
  IF v_best IS NOT NULL AND v_best < 1 THEN
    RAISE EXCEPTION 'Invalid best dates setting' USING ERRCODE='PT422';
  END IF;
  SELECT count(*)::integer, (array_agg(lc.club_id))[1] INTO v_primary_count,v_primary
  FROM public.league_clubs lc
  WHERE lc.league_id=p_league_id AND lc.is_primary IS TRUE;
  IF v_primary_count<>1 THEN
    RAISE EXCEPTION 'Primary organizer missing or ambiguous' USING ERRCODE='PT409';
  END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(v_primary))) THEN
    RAISE EXCEPTION 'Primary organizer authorization required' USING ERRCODE='42501';
  END IF;
  -- Fail closed on historical positions lacking a source. Never delete or
  -- silently overwrite the 51 known production exceptions.
  IF EXISTS (
    SELECT 1 FROM public.league_standings s
    WHERE s.league_id=p_league_id AND NOT EXISTS (
      SELECT 1 FROM public.tournament_results tr
      JOIN public.tournaments t ON t.id=tr.tournament_id
      WHERE t.league_id=p_league_id AND tr.player_id=s.player_id
    )
  ) THEN
    RAISE EXCEPTION 'Historical standings without source: reconciliation required'
      USING ERRCODE='PT409';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tournament_results tr
    JOIN public.tournaments t ON t.id=tr.tournament_id
    WHERE t.league_id=p_league_id
  ) THEN
    RAISE EXCEPTION 'No tournament results to recalculate' USING ERRCODE='PT409';
  END IF;
  -- One atomic materialization; IDs, locked CCP, reentries, and
  -- last_tournament_id are preserved on existing standings.
  -- First nonblank CCP/all registrations for NEW rows are QA candidates only,
  -- NOT an approved business rule for historical reconciliation.
  WITH inputs AS (
    SELECT tr.player_id,tr.id AS result_id,tr.tournament_id,tr.position,
           tr.league_points_earned,tr.ccp_club,tr.buy_ins_count,t.start_datetime,
      row_number() OVER (
        PARTITION BY tr.player_id
        ORDER BY tr.league_points_earned DESC,tr.position ASC,
                 t.start_datetime ASC,t.id ASC,tr.id ASC
      ) AS score_rank
    FROM public.tournament_results tr
    JOIN public.tournaments t ON t.id=tr.tournament_id
    WHERE t.league_id=p_league_id
  ), aggregated AS (
    SELECT i.player_id,
      coalesce(sum(i.league_points_earned) FILTER (
        WHERE v_best IS NULL OR i.score_rank<=v_best
      ),0) AS points,
      count(*)::integer AS played,
      min(i.position) AS best_position,
      count(*) FILTER (WHERE i.position BETWEEN 1 AND 9)::integer AS final_tables,
      (array_agg(nullif(pg_catalog.btrim(i.ccp_club),'')
        ORDER BY i.start_datetime,i.tournament_id,i.result_id)
        FILTER (WHERE nullif(pg_catalog.btrim(i.ccp_club),'') IS NOT NULL))[1]
        AS first_ccp,
      sum(coalesce(nullif(i.buy_ins_count,0),1)) AS all_registrations
    FROM inputs i
    GROUP BY i.player_id
  ), ranked AS (
    SELECT a.*,
      row_number() OVER (
        ORDER BY a.points DESC,a.played DESC,
                 a.best_position ASC NULLS LAST,a.final_tables DESC,
                 a.player_id ASC
      )::integer AS proposed_rank
    FROM aggregated a
  )
  INSERT INTO public.league_standings AS existing (
    league_id,player_id,total_points,tournaments_played,best_position,
    final_tables_count,rank_position,ccp_club,total_buy_ins_spent
  )
  SELECT p_league_id,r.player_id,r.points,r.played,r.best_position,
    r.final_tables,r.proposed_rank,r.first_ccp,r.all_registrations
  FROM ranked r
  LEFT JOIN public.league_standings prior
    ON prior.league_id=p_league_id AND prior.player_id=r.player_id
  -- Filter BEFORE entering INSERT/ON CONFLICT. A no-op conflict may still
  -- lock all matching rows and write WAL even when DO UPDATE WHERE is false.
  -- This saves per-row conflict tuple locks for unchanged 200+ player leagues.
  WHERE prior.player_id IS NULL OR
        (prior.total_points,prior.tournaments_played,
         prior.best_position,prior.final_tables_count,prior.rank_position)
     IS DISTINCT FROM
        (r.points,r.played,r.best_position,r.final_tables,r.proposed_rank)
  ON CONFLICT (league_id,player_id)
  DO UPDATE SET
    total_points=EXCLUDED.total_points,
    tournaments_played=EXCLUDED.tournaments_played,
    best_position=EXCLUDED.best_position,
    final_tables_count=EXCLUDED.final_tables_count,
    rank_position=EXCLUDED.rank_position,
    updated_at=pg_catalog.now()
  -- Avoid no-op updates to unrelated ranking rows. These generate WAL,
  -- bloat and extra disk I/O on Micro even when the final rank is unchanged.
  WHERE (existing.total_points,existing.tournaments_played,
         existing.best_position,existing.final_tables_count,
         existing.rank_position)
    IS DISTINCT FROM
        (EXCLUDED.total_points,EXCLUDED.tournaments_played,
         EXCLUDED.best_position,EXCLUDED.final_tables_count,
         EXCLUDED.rank_position);
  GET DIAGNOSTICS v_written = ROW_COUNT;
  RETURN v_written;
END;
$guarded$;
REVOKE ALL ON FUNCTION sharkania_release.recalculate_standings_guarded(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sharkania_release.recalculate_standings_guarded(uuid)
  TO authenticated;

-- 6. Private USD-only initial writer; ledger and Elo checkpoints in same commit.
CREATE OR REPLACE FUNCTION sharkania_release.publish_results_initial(
  p_tournament_id uuid,
  p_operation text,
  p_results jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $guarded$
DECLARE
 v_club uuid;
 v_league uuid;
 v_room uuid;
 v_buyin numeric;
 v_currency text;
 v_date timestamptz;
 v_uploaded boolean;
 v_status text;
 v_primary uuid;
 v_primary_count integer;
 v_n int;
 v_distinct_players int;
 v_distinct_positions int;
 v_min_pos int;
 v_max_pos int;
 v_invalid int;
 v_players_found int;
 v_invalid_room_count integer;
 v_player_ids uuid[];
 v_sum_elo numeric;
 v_weight numeric;
 v_avg_opp numeric;
 v_score numeric;
 v_expect numeric;
 v_k numeric;
 v_raw_change numeric;
 v_before numeric;
 v_after numeric;
 v_delta numeric;
 v_rank_written integer;
 v_result jsonb;
 v_calculated jsonb := '[]'::jsonb;
 v_canonical_payload jsonb;
 v_input_fingerprint text;
 v_publication_id uuid;
 v_checkpoint_rows integer;
 v_row record;
 v_player record;
 v_profile record;
 v_alias_count int;
 v_unified numeric;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN
   RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
 END IF;
 IF p_tournament_id IS NULL
    OR p_operation NOT IN ('upload','edit','delete') OR p_operation IS NULL THEN
   RAISE EXCEPTION 'Invalid tournament or operation' USING ERRCODE='PT422';
 END IF;

 -- Tournament row first; serialize the link guard and result deletion fence.
 -- All authorized result writers must adopt the SAME lock order at cutover.
 SELECT t.club_id,t.league_id,t.room_id,t.buy_in,t.currency,t.start_datetime,
        t.results_uploaded,t.status::text
  INTO v_club,v_league,v_room,v_buyin,v_currency,v_date,v_uploaded,v_status
 FROM public.tournaments t WHERE t.id=p_tournament_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found' USING ERRCODE='PT404'; END IF;
 IF v_league IS NULL THEN
   RAISE EXCEPTION 'This guarded writer only operates on league tournaments'
     USING ERRCODE='PT422';
 END IF;
 PERFORM 1 FROM public.leagues l WHERE l.id=v_league FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'League not found' USING ERRCODE='PT404'; END IF;
 SELECT count(*)::integer,(array_agg(lc.club_id))[1]
  INTO v_primary_count,v_primary
 FROM public.league_clubs lc
 WHERE lc.league_id=v_league AND lc.is_primary IS TRUE;
 IF v_primary_count<>1 OR v_primary IS DISTINCT FROM v_club THEN
   RAISE EXCEPTION 'League primary organizer is missing or mismatched'
     USING ERRCODE='PT409';
 END IF;
 IF NOT ((SELECT public.is_super_admin()) OR
         (SELECT public.is_club_admin(v_primary))) THEN
   RAISE EXCEPTION 'Only the primary organizer may modify league tournament results'
     USING ERRCODE='42501';
 END IF;

 -- No partial rollback of prior Elo at this stage. The old editor's SQL
 -- reversal is not equivalent to recalculating later Elo in chronological order.
 IF p_operation IN ('edit','delete') THEN
   RAISE EXCEPTION 'Editing/deleting historical league results requires full Elo replay'
     USING ERRCODE='PT409';
 END IF;
 IF v_status='cancelled' OR v_uploaded IS TRUE
    OR EXISTS(SELECT 1 FROM public.tournament_results r
              WHERE r.tournament_id=p_tournament_id)
    OR EXISTS(SELECT 1 FROM public.elo_history h
              WHERE h.tournament_id=p_tournament_id) THEN
   RAISE EXCEPTION 'Tournament already processed, cancelled or contains prior results'
     USING ERRCODE='PT409';
 END IF;
 IF v_currency IS DISTINCT FROM 'USD' THEN
   RAISE EXCEPTION 'Currency conversion rules must be approved before publishing non-USD Elo'
     USING ERRCODE='PT409';
 END IF;

 -- Protect every ranking entry with no result source; the 51 historical
 -- production exceptions are never removed or silently overwritten.
 IF EXISTS(
   SELECT 1 FROM public.league_standings s
   WHERE s.league_id=v_league
     AND NOT EXISTS(
       SELECT 1 FROM public.tournament_results tr
       JOIN public.tournaments t ON t.id=tr.tournament_id
       WHERE t.league_id=v_league AND tr.player_id=s.player_id
     )
 ) THEN
   RAISE EXCEPTION 'Historical orphan standings require reconciliation'
     USING ERRCODE='PT409';
 END IF;

 IF p_results IS NULL OR pg_catalog.jsonb_typeof(p_results)<>'array'
   OR pg_catalog.jsonb_array_length(p_results) NOT BETWEEN 2 AND 1000 THEN
   RAISE EXCEPTION 'Expected 2 to 1000 players in an array'
     USING ERRCODE='PT422';
 END IF;
 WITH payload AS (
   SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
   AS x(player_id uuid,position integer,prize_won numeric,
        bounties_won numeric,league_points_earned numeric,
        ccp_club text,buy_ins_count numeric)
 )
 SELECT count(*)::integer, count(DISTINCT player_id)::integer,
        count(DISTINCT position)::integer,
        min(position),max(position),
        count(*) FILTER (
           WHERE player_id IS NULL OR position IS NULL OR position<1
           OR prize_won IS NULL OR prize_won<0
           OR bounties_won IS NULL OR bounties_won<0
           OR league_points_earned IS NULL OR league_points_earned<0
           OR buy_ins_count IS NULL OR buy_ins_count<1 OR buy_ins_count>100
           OR buy_ins_count<>trunc(buy_ins_count)
           OR length(coalesce(ccp_club,''))>120
        )::integer,
        array_agg(DISTINCT player_id)
 INTO v_n,v_distinct_players,v_distinct_positions,
      v_min_pos,v_max_pos,v_invalid,v_player_ids
 FROM payload;
 IF v_invalid<>0 OR v_n<>v_distinct_players
    OR v_n<>v_distinct_positions OR v_min_pos<>1 OR v_max_pos<>v_n THEN
   RAISE EXCEPTION 'Invalid/duplicate players or noncontiguous finishing positions'
     USING ERRCODE='PT422';
 END IF;

 -- Lock only the affected player rows in deterministic UUID order.
 -- Aggregate validations ONCE instead of iterating N times in PL/pgSQL.
 SELECT count(*)::integer,
        count(*) FILTER (WHERE q.room_id IS DISTINCT FROM v_room)::integer
 INTO v_players_found,v_invalid_room_count
 FROM (
   SELECT p.id,p.room_id FROM public.players p
   WHERE p.id=ANY(v_player_ids) ORDER BY p.id FOR UPDATE
 ) q;
 IF v_invalid_room_count<>0 THEN
   RAISE EXCEPTION 'Player nickname does not belong to tournament room'
     USING ERRCODE='PT422';
 END IF;
 IF v_players_found<>v_n THEN
   RAISE EXCEPTION 'Unknown players: resolve nicknames before publishing'
     USING ERRCODE='PT422';
 END IF;

 -- Existing Elo engine has no deterministic historical replay. Refuse an
 -- out-of-order upload affecting a player with a later completed result,
 -- including those with missing Elo history.
 IF EXISTS(
   SELECT 1 FROM public.tournament_results tr
   JOIN public.tournaments t ON t.id=tr.tournament_id
   WHERE tr.player_id=ANY(v_player_ids)
      AND t.id<>p_tournament_id AND t.start_datetime>v_date
 ) THEN
   RAISE EXCEPTION 'Later tournament results exist for an affected player'
     USING ERRCODE='PT409';
 END IF;

 SELECT sum(p.elo_rating) INTO v_sum_elo
 FROM public.players p WHERE p.id=ANY(v_player_ids);
 v_weight:=(v_sum_elo/v_n)/1200;

 -- Compute all players from ONE locked snapshot, in one set-oriented SELECT.
 -- No per-player SELECT or JSON array concatenation loop (avoids N+1).
 WITH entries AS (
   SELECT p.id AS player_id,p.elo_rating AS elo_before,
          p.total_tournaments,x.position,x.prize_won,x.bounties_won,
          x.league_points_earned,x.ccp_club,x.buy_ins_count
   FROM pg_catalog.jsonb_to_recordset(p_results) AS x(
     player_id uuid,position integer,prize_won numeric,
     bounties_won numeric,league_points_earned numeric,
     ccp_club text,buy_ins_count numeric)
   JOIN public.players p ON p.id=x.player_id
 ), factors AS (
   SELECT e.*,
     (v_n-e.position)::numeric/(v_n-1) AS score,
     1/(1+pg_catalog.power(10::numeric,
       ((v_sum_elo-e.elo_before)/(v_n-1)-e.elo_before)/400)) AS expected,
     (CASE WHEN e.total_tournaments<30 THEN 40 ELSE 20 END)
       *(1+pg_catalog.log(v_buyin+1)*0.1)
       *(1+pg_catalog.log(v_n::numeric)*0.15) AS k
   FROM entries e
 ), changes AS (
   SELECT f.*, f.k*v_weight*(f.score-f.expected) AS raw_change
   FROM factors f
 )
 SELECT COALESCE(pg_catalog.jsonb_agg(
   pg_catalog.jsonb_build_object(
     'player_id',q.player_id,'position',q.position,
     'prize_won',q.prize_won,'bounties_won',q.bounties_won,
     'league_points_earned',q.league_points_earned,
     'ccp_club',q.ccp_club,'buy_ins_count',q.buy_ins_count,
     'elo_before',q.elo_before,
     'elo_after',pg_catalog.round(GREATEST(100::numeric,
       q.elo_before+q.raw_change),2),
     'elo_change',pg_catalog.round(q.raw_change,2)
   ) ORDER BY q.position), '[]'::jsonb)
 INTO v_calculated FROM changes q;
 IF pg_catalog.jsonb_array_length(v_calculated)<>v_n THEN
   RAISE EXCEPTION 'Elo calculation missed a participant' USING ERRCODE='PT409';
 END IF;

 -- SHA-256 computed on the SERVER from typed, position-sorted inputs.
 -- Reordering the request array does not change the fingerprint. Only a
 -- single bounded aggregate is needed, not N individual hashes.
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    ORDER BY x.position),'[]'::jsonb)
 INTO v_canonical_payload
 FROM pg_catalog.jsonb_to_recordset(p_results) AS x(
   player_id uuid,position integer,prize_won numeric,
   bounties_won numeric,league_points_earned numeric,
   ccp_club text,buy_ins_count numeric);
 v_input_fingerprint:=pg_catalog.encode(pg_catalog.sha256(
   pg_catalog.convert_to(pg_catalog.jsonb_build_object(
     'algorithm_version','legacy-js-v1',
     'tournament_id',p_tournament_id,'league_id',v_league,
     'buy_in',v_buyin,'currency',v_currency,
     'results',v_canonical_payload)::text,'UTF8')),'hex');

 -- Append exactly one publication and one checkpoint per player BEFORE
 -- modifying results/ELO/stats. Later failures roll everything back.
 INSERT INTO sharkania_release.elo_publication(
   tournament_id,league_id,actor_profile_id,algorithm_version,input_fingerprint
 ) VALUES (
   p_tournament_id,v_league,(SELECT auth.uid()),
   'legacy-js-v1',v_input_fingerprint
 ) RETURNING id INTO v_publication_id;

 INSERT INTO sharkania_release.elo_player_checkpoint(
   publication_id,player_id,elo_before,elo_after,elo_peak_before,
   tournaments_before,cashes_before,wins_before,prize_won_before,
   buy_ins_before,elo_change
 )
 SELECT v_publication_id,p.id,p.elo_rating,x.elo_after,p.elo_peak,
   p.total_tournaments,p.total_cashes,p.total_wins,
   p.total_prize_won,p.total_buy_ins_spent,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,elo_after numeric,elo_change numeric)
 JOIN public.players p ON p.id=x.player_id;
 GET DIAGNOSTICS v_checkpoint_rows = ROW_COUNT;
 IF v_checkpoint_rows<>v_n THEN
   RAISE EXCEPTION 'Incomplete audit checkpoint coverage' USING ERRCODE='PT409';
 END IF;

 INSERT INTO public.tournament_results (
   tournament_id,player_id,position,prize_won,bounties_won,
   league_points_earned,ccp_club,buy_ins_count,
   elo_before,elo_after,elo_change
 )
 SELECT p_tournament_id,x.player_id,x.position,x.prize_won,x.bounties_won,
        x.league_points_earned,x.ccp_club,x.buy_ins_count,
        x.elo_before,x.elo_after,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,position integer,prize_won numeric,
   bounties_won numeric,league_points_earned numeric,
   ccp_club text,buy_ins_count numeric,
   elo_before numeric,elo_after numeric,elo_change numeric
 );

 INSERT INTO public.elo_history(tournament_id,player_id,elo_before,elo_after,elo_change)
 SELECT p_tournament_id,x.player_id,x.elo_before,x.elo_after,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,elo_before numeric,elo_after numeric,elo_change numeric
 );

 UPDATE public.players p SET
   elo_rating=x.elo_after,
   elo_peak=GREATEST(p.elo_peak,x.elo_after),
   total_tournaments=p.total_tournaments+1,
   total_cashes=p.total_cashes+(CASE WHEN x.prize_won+x.bounties_won>0 THEN 1 ELSE 0 END),
   total_wins=p.total_wins+(CASE WHEN x.position=1 THEN 1 ELSE 0 END),
   total_prize_won=p.total_prize_won+x.prize_won+x.bounties_won,
   total_buy_ins_spent=p.total_buy_ins_spent+v_buyin
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,position integer,prize_won numeric,
   bounties_won numeric,elo_after numeric
 ) WHERE p.id=x.player_id;

 -- Lock only affected profile rows in UUID order, then materialize their
 -- unified Elo using ONE set-based UPDATE. No per-profile SELECT/UPDATE loop.
 -- Semantics match the legacy code: one alias uses latest historical Elo,
 -- multiple aliases use 1200+the sum of Elo history deltas.
 PERFORM u.id FROM public.profiles u
 WHERE u.id IN (
   SELECT DISTINCT p.profile_id FROM public.players p
   WHERE p.id=ANY(v_player_ids) AND p.profile_id IS NOT NULL
 ) ORDER BY u.id FOR UPDATE;
 WITH affected_profiles AS MATERIALIZED (
   SELECT DISTINCT p.profile_id FROM public.players p
   WHERE p.id=ANY(v_player_ids) AND p.profile_id IS NOT NULL
 ), aliases AS (
   SELECT p.profile_id,count(*)::integer AS alias_count,
          max(p.elo_rating) AS single_alias_elo
   FROM public.players p
   JOIN affected_profiles a ON a.profile_id=p.profile_id
   GROUP BY p.profile_id
 ), histories AS (
   SELECT p.profile_id,coalesce(sum(eh.elo_change),0) AS total_change,
     (array_agg(eh.elo_after ORDER BY eh.recorded_at DESC,eh.id DESC)
       FILTER (WHERE eh.id IS NOT NULL))[1] AS latest_elo
   FROM public.players p
   JOIN affected_profiles a ON a.profile_id=p.profile_id
   LEFT JOIN public.elo_history eh ON eh.player_id=p.id
   GROUP BY p.profile_id
 ), projected AS (
   SELECT a.profile_id,
     CASE WHEN a.alias_count=1
       THEN coalesce(h.latest_elo,a.single_alias_elo)
       ELSE GREATEST(100::numeric,1200::numeric+h.total_change)
     END AS unified_elo
   FROM aliases a JOIN histories h ON h.profile_id=a.profile_id
 )
 UPDATE public.profiles prof SET unified_elo=x.unified_elo
 FROM projected x WHERE prof.id=x.profile_id
   AND prof.unified_elo IS DISTINCT FROM x.unified_elo;

 UPDATE public.tournaments SET results_uploaded=true,status='completed'
 WHERE id=p_tournament_id;

 -- This guarded function preserves standings row IDs, locked CCP and other
 -- historical columns; it refuses to run if source-less rows exist.
 v_rank_written:=sharkania_release.recalculate_standings_guarded(v_league);
 v_result:=pg_catalog.jsonb_build_object(
   'status','published','tournament_id',p_tournament_id,
   'league_id',v_league,'players',v_n,
   'standings_updated',v_rank_written,'atomic',true,
   'audit_recorded',true);
 RETURN v_result;
END;
$guarded$;
REVOKE EXECUTE ON FUNCTION sharkania_release.publish_results_initial(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
-- Private server-only: absolutely NO EXECUTE for API roles.

-- 7. Only externally exposed results writer, verified against primary organizer.
CREATE OR REPLACE FUNCTION public.publish_league_nickname_results_guarded(
  p_tournament_id uuid,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guarded$
DECLARE
  v_club uuid;
  v_league uuid;
  v_room uuid;
  v_currency text;
  v_buyin numeric;
  v_country text;
  v_primary uuid;
  v_primary_count integer;
  v_rows integer;
  v_invalid integer;
  v_distinct_nicks integer;
  v_distinct_positions integer;
  v_min_position integer;
  v_max_position integer;
  v_nick text;
  v_new_players integer;
  v_resolved_count integer;
  v_resolved jsonb;
  v_pub_id uuid;
  v_postings integer;
  v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;

  IF p_tournament_id IS NULL
    OR p_results IS NULL OR pg_catalog.jsonb_typeof(p_results)<>'array'
    OR pg_catalog.jsonb_array_length(p_results) NOT BETWEEN 2 AND 1000
  THEN RAISE EXCEPTION 'Expected 2 to 1000 nickname results'
    USING ERRCODE='PT422'; END IF;

  -- Lock order agrees with the inner guarded writer: tournament then league.
  SELECT t.club_id,t.league_id,t.room_id,t.currency,t.buy_in,
         c.country_code
    INTO v_club,v_league,v_room,v_currency,v_buyin,v_country
  FROM public.tournaments t
  LEFT JOIN public.clubs c ON c.id=t.club_id
  WHERE t.id=p_tournament_id FOR UPDATE OF t;

  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'
    USING ERRCODE='PT404'; END IF;
  IF v_league IS NULL THEN
    RAISE EXCEPTION 'Only league tournaments are supported'
      USING ERRCODE='PT422'; END IF;

  PERFORM 1 FROM public.leagues WHERE id=v_league FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'League not found'
    USING ERRCODE='PT404'; END IF;

  SELECT count(*)::int,(array_agg(lc.club_id))[1]
    INTO v_primary_count,v_primary
  FROM public.league_clubs lc
  WHERE lc.league_id=v_league AND lc.is_primary IS TRUE;
  IF v_primary_count<>1 OR v_primary IS DISTINCT FROM v_club THEN
    RAISE EXCEPTION 'Only the primary organizer tournament may publish'
      USING ERRCODE='42501'; END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(v_primary))) THEN
    RAISE EXCEPTION 'Only the primary organizer may publish'
      USING ERRCODE='42501'; END IF;

  -- Currency is a SERVER-side tournament attribute. Do not accept an
  -- untrusted currency or conversion rate from the CSV.
  -- Multi-currency postings are modeled below, but *publishing* non-USD
  -- remains blocked until currency/Elo semantics are approved and tested.
  IF v_currency IS DISTINCT FROM 'USD' THEN
    RAISE EXCEPTION 'Non-USD league publication needs an approved Elo/amount policy'
      USING ERRCODE='PT409'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_results) AS item(value)
    WHERE pg_catalog.jsonb_typeof(item.value)<>'object'
      OR pg_catalog.jsonb_typeof(item.value->'nickname')<>'string'
      OR item.value ? 'player_id'
  ) THEN RAISE EXCEPTION 'Expected nickname objects without client player IDs'
    USING ERRCODE='PT422'; END IF;

  WITH input AS (
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
      AS x(nickname text,position integer,prize_won numeric,
           bounties_won numeric,league_points_earned numeric,
           ccp_club text,buy_ins_count numeric)
  )
  SELECT count(*)::int,
         count(DISTINCT pg_catalog.lower(pg_catalog.btrim(nickname)))::int,
         count(DISTINCT position)::int,min(position),max(position),
         count(*) FILTER (
           WHERE nickname IS NULL
              OR length(pg_catalog.btrim(nickname)) NOT BETWEEN 1 AND 80
              OR position IS NULL OR position<=0
              OR prize_won IS NULL OR prize_won<0
              OR bounties_won IS NULL OR bounties_won<0
              OR league_points_earned IS NULL OR league_points_earned<0
              OR buy_ins_count IS NULL OR buy_ins_count NOT BETWEEN 1 AND 100
              OR buy_ins_count<>trunc(buy_ins_count)
              OR length(coalesce(ccp_club,''))>120
         )::int
  INTO v_rows,v_distinct_nicks,v_distinct_positions,
       v_min_position,v_max_position,v_invalid
  FROM input;
  IF v_invalid<>0 OR v_distinct_nicks<>v_rows OR
     v_distinct_positions<>v_rows OR v_min_position<>1 OR
     v_max_position<>v_rows THEN
    RAISE EXCEPTION 'Invalid, duplicate or nonconsecutive nickname results'
      USING ERRCODE='PT422'; END IF;

  -- Contract: this unique expression index is mandatory. A legacy
  -- case-sensitive UNIQUE(nickname,room_id) alone is NOT sufficient.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class ix ON ix.oid=i.indexrelid
    WHERE i.indrelid='public.players'::regclass
      AND ix.relname='league_players_normalized_nickname_room_guarded'
      AND i.indisunique AND i.indisvalid AND i.indisready
  ) THEN
    RAISE EXCEPTION 'Normalized player identity uniqueness is not enforced'
      USING ERRCODE='PT409'; END IF;

  -- Serialise normalized nicknames per room, acquired in stable order to
  -- avoid in-RPC slug/alias races; the unique expression index is final
  -- integrity enforcement. All old direct player writers must be closed
  -- or subject to the same index at production cutover.
  FOR v_nick IN
    SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(x.nickname)) AS normalized
    FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
    ORDER BY normalized
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('league-player:'||v_room::text||':'||v_nick,0)
    );
  END LOOP;

  INSERT INTO public.players(nickname,room_id,country_code,elo_rating,elo_peak)
  SELECT pg_catalog.btrim(x.nickname),v_room,v_country,1200,1200
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.room_id=v_room
      AND pg_catalog.lower(pg_catalog.btrim(p.nickname))=
          pg_catalog.lower(pg_catalog.btrim(x.nickname))
  )
  ORDER BY pg_catalog.lower(pg_catalog.btrim(x.nickname))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new_players = ROW_COUNT;

  -- Construct a trusted, typed payload from the DB player IDs; never
  -- trust an incoming player_id or allow CSV nickname to link a profile.
  WITH input AS (
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
      AS x(nickname text,position integer,prize_won numeric,
           bounties_won numeric,league_points_earned numeric,
           ccp_club text,buy_ins_count numeric)
  ), resolved AS (
    SELECT x.*, p.id AS resolved_id
    FROM input x
    JOIN public.players p ON p.room_id=v_room
      AND pg_catalog.lower(pg_catalog.btrim(p.nickname))=
          pg_catalog.lower(pg_catalog.btrim(x.nickname))
  )
  SELECT count(*)::int,
         pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'player_id',resolved_id,'position',position,
           'prize_won',prize_won,'bounties_won',bounties_won,
           'league_points_earned',league_points_earned,
           'ccp_club',ccp_club,'buy_ins_count',buy_ins_count
         ) ORDER BY position)
    INTO v_resolved_count,v_resolved
  FROM resolved;
  IF v_resolved_count<>v_rows OR
     (SELECT count(DISTINCT x.player_id)
      FROM pg_catalog.jsonb_to_recordset(v_resolved)
        AS x(player_id uuid))<>v_rows THEN
    RAISE EXCEPTION 'Nickname resolution incomplete or ambiguous'
      USING ERRCODE='PT409'; END IF;

  -- The inner writer stores results, Elo, standings and audit in this same
  -- PostgREST transaction. Any error below rolls back new players too.
  v_result := sharkania_release.publish_results_initial(
    p_tournament_id,'upload',v_resolved
  );

  SELECT p.id INTO v_pub_id
  FROM sharkania_release.elo_publication p
  WHERE p.tournament_id=p_tournament_id;
  IF v_pub_id IS NULL THEN
    RAISE EXCEPTION 'Required publication audit missing'
      USING ERRCODE='PT409'; END IF;

  -- Per-player native-currency facts, with true buy-in count.
  -- Never aggregate distinct currencies into players' legacy totals.
  INSERT INTO sharkania_release.currency_posting(
    publication_id,tournament_id,player_id,currency,
    buy_in_per_entry,buy_ins_count,prize_won,bounties_won
  )
  SELECT v_pub_id,p_tournament_id,x.player_id,v_currency,
         v_buyin,x.buy_ins_count::integer,x.prize_won,x.bounties_won
  FROM pg_catalog.jsonb_to_recordset(v_resolved) AS x(
    player_id uuid,buy_ins_count numeric,prize_won numeric,bounties_won numeric
  );
  GET DIAGNOSTICS v_postings = ROW_COUNT;
  IF v_postings<>v_rows THEN
    RAISE EXCEPTION 'Incomplete currency journal coverage'
      USING ERRCODE='PT409'; END IF;

  RETURN v_result || pg_catalog.jsonb_build_object(
    'new_players',v_new_players,'currency',v_currency,
    'currency_postings',v_postings,'normalized_nicknames',true
  );
END;
$guarded$;
REVOKE EXECUTE ON FUNCTION public.publish_league_nickname_results_guarded(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_league_nickname_results_guarded(uuid,jsonb)
  TO authenticated;

-- 8. Live legacy function bodies preserved with per-league protected guards.
-- Old RPCs keep their existing auth checks. These internal helpers are
-- called immediately AFTER that check and BEFORE any DELETE or ELO rebuild.
CREATE OR REPLACE FUNCTION sharkania_release.guard_legacy_single_nonleague(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guard$
DECLARE v_league uuid; v_club uuid;
BEGIN
 SELECT t.league_id,t.club_id INTO v_league,v_club
 FROM public.tournaments t WHERE t.id=p_tournament_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF NOT ((SELECT public.is_super_admin()) OR (SELECT public.is_club_admin(v_club))) THEN
   RAISE EXCEPTION 'Not authorized for tournament' USING ERRCODE='42501';
 END IF;
 IF v_league IS NOT NULL THEN
   RAISE EXCEPTION 'Legacy mutation of linked league tournament forbidden' USING ERRCODE='PT409';
 END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION sharkania_release.guard_legacy_bulk_nonleague(p_tournament_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guard$
DECLARE r record;
BEGIN
 FOR r IN
  SELECT t.id,t.league_id,t.club_id FROM public.tournaments t
  WHERE t.id=ANY(p_tournament_ids) ORDER BY t.id FOR UPDATE
 LOOP
  IF NOT ((SELECT public.is_super_admin()) OR (SELECT public.is_club_admin(r.club_id))) THEN
    RAISE EXCEPTION 'Not authorized for tournament' USING ERRCODE='42501';
  END IF;
  IF r.league_id IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy bulk mutation of linked league tournaments forbidden' USING ERRCODE='PT409';
  END IF;
 END LOOP;
END;
$guard$;
REVOKE ALL ON FUNCTION sharkania_release.guard_legacy_single_nonleague(uuid),
 sharkania_release.guard_legacy_bulk_nonleague(uuid[]) FROM PUBLIC,anon,authenticated;

-- bulk_delete_scheduled_tournaments: preserve production body + one fail-closed invocation.
CREATE OR REPLACE FUNCTION public.bulk_delete_scheduled_tournaments(p_tournament_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = ANY(p_tournament_ids) AND NOT (public.is_super_admin() OR public.is_club_admin(t.club_id))) THEN RAISE EXCEPTION 'Acceso denegado a eliminar torneos' USING ERRCODE='42501'; END IF;
  PERFORM sharkania_release.guard_legacy_bulk_nonleague(p_tournament_ids);
  DELETE FROM tournaments
  WHERE id = ANY(p_tournament_ids)
  AND status = 'scheduled'
  AND results_uploaded = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- delete_tournament_god_mode: preserve production body + one fail-closed invocation.
CREATE OR REPLACE FUNCTION public.delete_tournament_god_mode(tournament_id_to_delete uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    affected_player_ids UUID[];
    league_id_affected UUID;
    v_player_id UUID;
    v_club_id UUID;
    v_current_elo DECIMAL;
    v_peak_elo DECIMAL;
    h RECORD;
    v_t INTEGER; v_c INTEGER; v_w INTEGER; v_prize DECIMAL; v_buyin DECIMAL;
BEGIN
  IF NOT COALESCE((SELECT public.is_super_admin() OR public.is_club_admin(club_id) FROM public.tournaments WHERE id = tournament_id_to_delete), false) THEN RAISE EXCEPTION 'Acceso denegado a eliminar torneo' USING ERRCODE='42501'; END IF;
    PERFORM sharkania_release.guard_legacy_single_nonleague(tournament_id_to_delete);
    RAISE NOTICE '🧨 INICIANDO ELIMINACIÓN SQL GOD MODE: %', tournament_id_to_delete;

    -- 1. Capturar info del torneo antes de borrarlo
    SELECT league_id, club_id INTO league_id_affected, v_club_id
    FROM tournaments WHERE id = tournament_id_to_delete;

    IF v_club_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Torneo no encontrado');
    END IF;

    -- 2. CAPTURAR JUGADORES AFECTADOS
    SELECT ARRAY_AGG(DISTINCT player_id) INTO affected_player_ids
    FROM tournament_results
    WHERE tournament_id = tournament_id_to_delete AND player_id IS NOT NULL;

    -- 3. LIMPIEZA TOTAL (Bypass de RLS)
    DELETE FROM elo_history WHERE tournament_id = tournament_id_to_delete;
    DELETE FROM tournament_results WHERE tournament_id = tournament_id_to_delete;
    DELETE FROM tournaments WHERE id = tournament_id_to_delete;

    -- 4. RECONSTRUCCIÓN DE LA REALIDAD PARA CADA JUGADOR
    IF affected_player_ids IS NOT NULL THEN
        FOREACH v_player_id IN ARRAY affected_player_ids
        LOOP
            -- A) Recalcular contadores (Wins, Cashes, Profit REALES restantes)
            SELECT 
                COUNT(tr.id),
                COUNT(CASE WHEN tr.prize_won > 0 THEN 1 END),
                COUNT(CASE WHEN tr.position = 1 THEN 1 END),
                SUM(COALESCE(tr.prize_won, 0) + COALESCE(tr.bounties_won, 0)),
                SUM(COALESCE(t.buy_in, 0))
            INTO v_t, v_c, v_w, v_prize, v_buyin
            FROM tournament_results tr
            JOIN tournaments t ON tr.tournament_id = t.id
            WHERE tr.player_id = v_player_id AND t.status = 'completed';

            -- B) RECONSTRUIR CADENA DE ELO (CRONOLÓGICA)
            v_current_elo := 1200;
            v_peak_elo := 1200;

            -- Usamos id como fallback ya que created_at no existe
            FOR h IN 
                SELECT id, tournament_id, elo_change
                FROM elo_history
                WHERE player_id = v_player_id
                ORDER BY id ASC 
            LOOP
                UPDATE elo_history
                SET elo_before = v_current_elo, 
                    elo_after = v_current_elo + h.elo_change
                WHERE id = h.id;

                UPDATE tournament_results
                SET elo_before = v_current_elo, 
                    elo_after = v_current_elo + h.elo_change
                WHERE tournament_id = h.tournament_id AND player_id = v_player_id;

                v_current_elo := v_current_elo + h.elo_change;
                v_peak_elo := GREATEST(v_peak_elo, v_current_elo);
            END LOOP;

            -- C) Sincronizar tabla 'players' (Ceros garantizados si stats es NULL)
            UPDATE players
            SET 
                total_tournaments = COALESCE(v_t, 0),
                total_cashes = COALESCE(v_c, 0),
                total_wins = COALESCE(v_w, 0),
                total_prize_won = COALESCE(v_prize, 0),
                total_buy_ins_spent = COALESCE(v_buyin, 0),
                elo_rating = v_current_elo,
                elo_peak = v_peak_elo
            WHERE id = v_player_id;
        END LOOP;
    END IF;

    -- 5. RECALCULAR LIGA (Ranking y Best Position)
    IF league_id_affected IS NOT NULL THEN
        DELETE FROM league_standings WHERE league_id = league_id_affected;

        INSERT INTO league_standings (league_id, player_id, total_points, tournaments_played, best_position, rank_position)
        SELECT 
            league_id_affected,
            tr.player_id,
            SUM(COALESCE(tr.league_points_earned, 0)),
            COUNT(tr.id),
            MIN(tr.position),
            ROW_NUMBER() OVER (ORDER BY SUM(COALESCE(tr.league_points_earned, 0)) DESC)
        FROM tournament_results tr
        JOIN tournaments t ON tr.tournament_id = t.id
        WHERE t.league_id = league_id_affected AND t.status = 'completed'
        GROUP BY tr.player_id;
    END IF;

    RETURN json_build_object('success', true, 'message', 'Torneo eliminado y sistema reconstruido');
END;
$function$;

-- reset_tournament_impact: preserve production body + one fail-closed invocation.
CREATE OR REPLACE FUNCTION public.reset_tournament_impact(tournament_id_to_reset uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    affected_player_ids UUID[];
    v_player_id UUID;
    v_current_elo DECIMAL;
    v_peak_elo DECIMAL;
    h RECORD;
    stats RECORD;
BEGIN
  IF NOT COALESCE((SELECT public.is_super_admin() OR public.is_club_admin(club_id) FROM public.tournaments WHERE id = tournament_id_to_reset), false) THEN RAISE EXCEPTION 'Acceso denegado a reiniciar torneo' USING ERRCODE='42501'; END IF;
    PERFORM sharkania_release.guard_legacy_single_nonleague(tournament_id_to_reset);
    -- 1. Identificar a los jugadores afectados
    SELECT ARRAY_AGG(DISTINCT player_id) INTO affected_player_ids
    FROM tournament_results WHERE tournament_id = tournament_id_to_reset;

    -- 2. Limpiar historial y resultados SOLO de este torneo
    DELETE FROM elo_history WHERE tournament_id = tournament_id_to_reset;
    DELETE FROM tournament_results WHERE tournament_id = tournament_id_to_reset;

    -- 3. Reconstruir las estadísticas cronológicamente
    IF affected_player_ids IS NOT NULL THEN
        FOREACH v_player_id IN ARRAY affected_player_ids
        LOOP
            SELECT 
                COUNT(tr.id) as t, COUNT(CASE WHEN tr.prize_won > 0 THEN 1 END) as c,
                COUNT(CASE WHEN tr.position = 1 THEN 1 END) as w,
                SUM(COALESCE(tr.prize_won, 0) + COALESCE(tr.bounties_won, 0)) as prize,
                SUM(COALESCE(t.buy_in, 0)) as buyin
            INTO stats
            FROM tournament_results tr
            JOIN tournaments t ON tr.tournament_id = t.id
            WHERE tr.player_id = v_player_id AND t.status = 'completed';

            v_current_elo := 1200;
            v_peak_elo := 1200;

            FOR h IN SELECT elo_change FROM elo_history WHERE player_id = v_player_id ORDER BY id ASC 
            LOOP
                v_current_elo := v_current_elo + h.elo_change;
                v_peak_elo := GREATEST(v_peak_elo, v_current_elo);
            END LOOP;

            UPDATE players SET 
                total_tournaments = COALESCE(stats.t, 0),
                total_cashes = COALESCE(stats.c, 0),
                total_wins = COALESCE(stats.w, 0),
                total_prize_won = COALESCE(stats.prize, 0),
                total_buy_ins_spent = COALESCE(stats.buyin, 0),
                elo_rating = v_current_elo,
                elo_peak = v_peak_elo
            WHERE id = v_player_id;
        END LOOP;
    END IF;

    -- HEMOS ELIMINADO EL RECOLECTOR DE BASURA (evita el error de Foreign Key con React)
    -- HEMOS ELIMINADO EL CAMBIO A results_uploaded = false (evita que el modal se cierre)

    RETURN json_build_object('success', true);
END;
$function$;

-- Legacy ranking entry points are replaced by guarded standings RPCs;
-- do not let PostgREST clients call mutable, currency-unaware recalc.
REVOKE EXECUTE ON FUNCTION public.recalculate_league_standings(uuid),
 public.update_league_standings(uuid) FROM PUBLIC,anon,authenticated;
-- 9. Defense-in-depth delete fences for linked tournament rows.
CREATE OR REPLACE FUNCTION public.guard_release_a_linked_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $guard$
DECLARE
  v_league_id uuid;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    RAISE EXCEPTION 'Unsafe trigger invocation' USING ERRCODE='PT422';
  END IF;

  IF TG_TABLE_NAME='league_standings' THEN
    -- Existing production functions delete/recreate standings and silently
    -- lose CCP, buy-ins and last_tournament_id; block even privileged RPCs.
    RAISE EXCEPTION 'League standings cannot be deleted by legacy operations'
      USING ERRCODE='PT409';
  ELSIF TG_TABLE_NAME='tournaments' THEN
    v_league_id:=OLD.league_id;
  ELSIF TG_TABLE_NAME='tournament_results'
     OR TG_TABLE_NAME='elo_history' THEN
    -- Serialize against relinking or detaching a tournament. Its UPDATE owns
    -- a row lock; a parallel DELETE cannot check stale league affiliation.
    SELECT t.league_id INTO v_league_id
      FROM public.tournaments t
      WHERE t.id=OLD.tournament_id
      FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unexpected protected table'
      USING ERRCODE='PT422';
  END IF;

  IF v_league_id IS NOT NULL THEN
    RAISE EXCEPTION 'Protected league tournament history cannot be deleted by legacy operations'
      USING ERRCODE='PT409';
  END IF;
  RETURN OLD;
END;
$guard$;

REVOKE EXECUTE ON FUNCTION public.guard_release_a_linked_delete()
 FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS release_a_prevent_legacy_tournament_delete ON public.tournaments;
CREATE TRIGGER release_a_prevent_legacy_tournament_delete
BEFORE DELETE ON public.tournaments FOR EACH ROW
EXECUTE FUNCTION public.guard_release_a_linked_delete();

DROP TRIGGER IF EXISTS release_a_prevent_legacy_results_delete ON public.tournament_results;
CREATE TRIGGER release_a_prevent_legacy_results_delete
BEFORE DELETE ON public.tournament_results FOR EACH ROW
EXECUTE FUNCTION public.guard_release_a_linked_delete();

DROP TRIGGER IF EXISTS release_a_prevent_legacy_elo_delete ON public.elo_history;
CREATE TRIGGER release_a_prevent_legacy_elo_delete
BEFORE DELETE ON public.elo_history FOR EACH ROW
EXECUTE FUNCTION public.guard_release_a_linked_delete();

DROP TRIGGER IF EXISTS release_a_prevent_legacy_standings_delete ON public.league_standings;
CREATE TRIGGER release_a_prevent_legacy_standings_delete
BEFORE DELETE ON public.league_standings FOR EACH ROW
EXECUTE FUNCTION public.guard_release_a_linked_delete();

-- 10. No direct DML on league standings: only SECURITY DEFINER
-- publication recalculation may update them. SELECT stays public.
REVOKE INSERT,UPDATE,DELETE ON TABLE public.league_standings FROM PUBLIC,anon,authenticated;

-- 11. Final atomic security assertions, before single commit.
DO $release_a_postcondition$
BEGIN
 IF pg_catalog.has_function_privilege('anon',
      'public.publish_league_nickname_results_guarded(uuid,jsonb)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('authenticated',
      'public.publish_league_nickname_results_guarded(uuid,jsonb)','EXECUTE')
 OR pg_catalog.has_schema_privilege('authenticated','sharkania_release','USAGE')
 OR pg_catalog.has_function_privilege('authenticated',
      'sharkania_release.publish_results_initial(uuid,text,jsonb)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
      'sharkania_release.recalculate_standings_guarded(uuid)','EXECUTE')
 OR pg_catalog.has_table_privilege('authenticated',
      'public.league_standings','UPDATE')
 OR pg_catalog.has_table_privilege('authenticated',
      'public.league_standings','INSERT')
 OR pg_catalog.has_table_privilege('authenticated',
      'public.league_standings','DELETE') THEN
    RAISE EXCEPTION 'Release A client surface is not locked down' USING ERRCODE='PT409';
 END IF;
END;
$release_a_postcondition$;
COMMIT;
