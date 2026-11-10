-- SHARKANIA QA: FULL RELEASE A + BOTH CURRENCY WRITERS + OFFICIAL FX V2
-- GENERATED REVIEW ARTIFACT. NOT a production migration; never deploy.
-- 3 source artifacts / 7 underlying candidate components / ONE transaction.
-- Configuration remains v2 OFF; no FX credentials, jobs, flags or data touched.
-- Must still test faithful production backup clone and approve costs before GO.
BEGIN;
-- ######## SECTION 1/3: docs/security/release-a-full-security-single-transaction-2026-11-10.CANDIDATE.sql ########
-- SHARKANIA RELEASE A + STANDALONE ELO + ADMIN LINK + HISTORICAL FENCES
-- CONSOLIDATED QA CANDIDATE / NOT AN APPROVED MIGRATION OR PROD SCRIPT.
-- Generated from the five committed review files on branch security/independent-elo-atomic-qa-2026-11-10.
-- Retains ALL internal checks; only removes internal BEGIN/COMMIT wrappers.
-- One outer transaction: NO partial installation if any later guard fails.
-- MUST run first on a faithful restored-production clone after cost approval.
-- CLP/EUR publication and historical replay remain BLOCKED, so GO is NO.
-- ######## SOURCE 1/5: docs/security/league-release-a-single-transaction-2026-11-10.CANDIDATE.sql ########
-- SHARKANIA RELEASE A - CONSOLIDATED SQL CANDIDATE (REVIEW ONLY, 2026-11-10)
-- NEVER apply to production prior to restored-prod clone QA and explicit owner approval.
-- This single atomic transaction combines validated branch prototypes for
-- league membership, USD-only first upload, native-currency audit, legacy
-- writer fences and private ELO/standings helpers. P0 is already live.
-- Historical edit/delete and CLP/EUR result publication intentionally blocked.
-- NO QA forwarding alias, NO v2 formula, NO temporary QA schema.
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
-- Internal standings function: never GRANT EXECUTE to client roles.

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

-- Direct Data API inserts/updates of a league's results/Elo are forbidden.
-- The only allowed writes to linked league rows must execute inside
-- reviewed SECURITY DEFINER functions, while non-league REST flows survive.
-- This SECURITY INVOKER trigger sees current_user='authenticated' for REST;
-- the guarded server RPC runs as its privileged owner, outside that role.
-- Other SECURITY DEFINER writer functions require separate review (NO GO).
CREATE OR REPLACE FUNCTION public.guard_release_a_direct_league_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $write$
DECLARE v_league uuid; v_previous uuid;
BEGIN
 IF current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME IN ('tournament_results','elo_history') THEN
   SELECT t.league_id INTO v_league
   FROM public.tournaments t WHERE t.id=NEW.tournament_id FOR SHARE;
   IF TG_OP='UPDATE' THEN
     SELECT t.league_id INTO v_previous
     FROM public.tournaments t WHERE t.id=OLD.tournament_id FOR SHARE;
   END IF;
   IF v_league IS NOT NULL OR v_previous IS NOT NULL THEN
     RAISE EXCEPTION 'Direct modification of league results/Elo is prohibited'
       USING ERRCODE='PT409';
   END IF;
 ELSIF TG_TABLE_NAME='tournaments' AND TG_OP='UPDATE' THEN
   IF (NEW.league_id IS NOT NULL OR OLD.league_id IS NOT NULL)
      AND (NEW.results_uploaded IS DISTINCT FROM OLD.results_uploaded
           OR NEW.status IS DISTINCT FROM OLD.status) THEN
     RAISE EXCEPTION 'Only guarded server writer may finalize a league tournament'
       USING ERRCODE='PT409';
   END IF;
 ELSE
   RAISE EXCEPTION 'Unexpected direct league mutation guard invocation'
     USING ERRCODE='PT422';
 END IF;
 RETURN NEW;
END;
$write$;
REVOKE ALL ON FUNCTION public.guard_release_a_direct_league_mutation()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER release_a_direct_result_insert_update
BEFORE INSERT OR UPDATE ON public.tournament_results FOR EACH ROW
EXECUTE FUNCTION public.guard_release_a_direct_league_mutation();
CREATE TRIGGER release_a_direct_elo_insert_update
BEFORE INSERT OR UPDATE ON public.elo_history FOR EACH ROW
EXECUTE FUNCTION public.guard_release_a_direct_league_mutation();
CREATE TRIGGER release_a_direct_tournament_status_update
BEFORE UPDATE OF results_uploaded,status ON public.tournaments FOR EACH ROW
EXECUTE FUNCTION public.guard_release_a_direct_league_mutation();

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
-- ######## END SOURCE 1/5 ########

-- ######## SOURCE 2/5: docs/security/independent-results-atomic-v1-2026-11-10.CANDIDATE.sql ########
-- SHARKANIA / NON-LEAGUE initial result publication (QA CANDIDATE, 2026-11-10).
-- Depends on the unmerged Release A single SQL (PR #95), never run separately.
-- NO production deployment. USD first publication only. No historical replay.
-- Standalone tournament ELO is SHARED with league ELO: do not alter the formula.
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

-- Fail closed if this file is run before the reviewed Release A schema.
DO $standalone_preflight$
BEGIN
 IF to_regnamespace('sharkania_release') IS NULL
 OR to_regclass('sharkania_release.elo_publication') IS NULL
 OR to_regclass('public.players') IS NULL
 OR to_regprocedure('public.publish_league_nickname_results_guarded(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'Release A guarded base is required' USING ERRCODE='PT409'; END IF;

 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p
  WHERE p.pronamespace='public'::regnamespace AND
  p.proname='publish_independent_nickname_results_guarded')
 OR to_regclass('sharkania_release.independent_elo_publication') IS NOT NULL
 THEN RAISE EXCEPTION 'Independent writer already installed; reconcile catalog first'
 USING ERRCODE='PT409'; END IF;

 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class ix ON ix.oid=i.indexrelid
  WHERE ix.relname='league_players_normalized_nickname_room_guarded'
  AND i.indrelid='public.players'::regclass AND i.indisunique AND i.indisvalid AND i.indisready)
 THEN RAISE EXCEPTION 'Normalized nickname UNIQUE index required'
 USING ERRCODE='PT409'; END IF;
END;
$standalone_preflight$;

-- Separate audit from league publications because league_id in the approved
-- Release A audit is NOT NULL. Do not relax its constraints or rewrite evidence.
CREATE TABLE sharkania_release.independent_elo_publication(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tournament_id uuid NOT NULL UNIQUE REFERENCES public.tournaments(id),
 actor_profile_id uuid NOT NULL,
 algorithm_version text NOT NULL CHECK(algorithm_version='legacy-js-v1'),
 input_fingerprint text NOT NULL CHECK(input_fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
CREATE TABLE sharkania_release.independent_elo_checkpoint(
 publication_id uuid NOT NULL REFERENCES sharkania_release.independent_elo_publication(id),
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
 PRIMARY KEY(publication_id,player_id)
);
CREATE TABLE sharkania_release.independent_currency_posting(
 publication_id uuid NOT NULL REFERENCES sharkania_release.independent_elo_publication(id),
 tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
 player_id uuid NOT NULL REFERENCES public.players(id),
 currency text NOT NULL CHECK(currency='USD'),
 buy_in_per_entry numeric NOT NULL CHECK(buy_in_per_entry>=0),
 buy_ins_count integer NOT NULL CHECK(buy_ins_count BETWEEN 1 AND 100),
 entry_spend numeric GENERATED ALWAYS AS (buy_in_per_entry*buy_ins_count) STORED,
 prize_won numeric NOT NULL CHECK(prize_won>=0),
 bounties_won numeric NOT NULL CHECK(bounties_won>=0),
 PRIMARY KEY(tournament_id,player_id)
);
CREATE TRIGGER independent_immutable_publication
 BEFORE UPDATE OR DELETE ON sharkania_release.independent_elo_publication
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();
CREATE TRIGGER independent_immutable_checkpoint
 BEFORE UPDATE OR DELETE ON sharkania_release.independent_elo_checkpoint
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();
CREATE TRIGGER independent_immutable_currency_posting
 BEFORE UPDATE OR DELETE ON sharkania_release.independent_currency_posting
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();

ALTER TABLE sharkania_release.independent_elo_publication ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release.independent_elo_checkpoint ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release.independent_currency_posting ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sharkania_release.independent_elo_publication,
 sharkania_release.independent_elo_checkpoint,
 sharkania_release.independent_currency_posting FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.publish_independent_nickname_results_guarded(
 p_tournament_id uuid,p_results jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $nonleague$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_club uuid;
 v_league uuid;
 v_room uuid;
 v_country text;
 v_buyin numeric;
 v_currency text;
 v_date timestamptz;
 v_uploaded boolean;
 v_status text;
 v_n int;
 v_invalid int;
 v_distinct_nick int;
 v_distinct_pos int;
 v_pos_min int;
 v_pos_max int;
 v_new int;
 v_found int;
 v_invalid_room int;
 v_ids uuid[];
 v_sum numeric;
 v_weight numeric;
 v_calculated jsonb;
 v_fingerprint text;
 v_pub uuid;
 v_count int;
 v_profile_count int;
 v_nickname text;
BEGIN
 IF v_actor IS NULL THEN
  RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_tournament_id IS NULL OR p_results IS NULL
 OR pg_catalog.jsonb_typeof(p_results)<>'array'
 OR pg_catalog.jsonb_array_length(p_results) NOT BETWEEN 2 AND 1000
 THEN RAISE EXCEPTION 'Expected 2 to 1000 results' USING ERRCODE='PT422'; END IF;

 -- Same lock order as Release A: tournament FIRST, players in UUID order.
 SELECT t.club_id,t.league_id,t.room_id,t.buy_in,t.currency,
        t.start_datetime,t.results_uploaded,t.status::text,c.country_code
 INTO v_club,v_league,v_room,v_buyin,v_currency,v_date,
      v_uploaded,v_status,v_country
 FROM public.tournaments t
 LEFT JOIN public.clubs c ON c.id=t.club_id
 WHERE t.id=p_tournament_id FOR UPDATE OF t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found' USING ERRCODE='PT404'; END IF;
 IF v_league IS NOT NULL THEN
  RAISE EXCEPTION 'League tournaments must use league writer' USING ERRCODE='PT422'; END IF;
 IF NOT ((SELECT public.is_super_admin()) OR (SELECT public.is_club_admin(v_club))) THEN
  RAISE EXCEPTION 'Only organizer or super admin may publish'
    USING ERRCODE='42501'; END IF;
 IF v_currency IS DISTINCT FROM 'USD' THEN
  RAISE EXCEPTION 'Non-USD results require a separately approved currency Elo policy'
    USING ERRCODE='PT409'; END IF;
 IF v_status='cancelled' OR v_uploaded IS TRUE
    OR EXISTS(SELECT 1 FROM public.tournament_results r WHERE r.tournament_id=p_tournament_id)
    OR EXISTS(SELECT 1 FROM public.elo_history h WHERE h.tournament_id=p_tournament_id)
    OR EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication j
              WHERE j.tournament_id=p_tournament_id)
 THEN
  RAISE EXCEPTION 'Already processed or existing historical results: replay prohibited'
    USING ERRCODE='PT409'; END IF;
 IF v_buyin IS NULL OR v_buyin<0 OR v_buyin>100000000 THEN
  RAISE EXCEPTION 'Unsupported buy-in' USING ERRCODE='PT422'; END IF;

 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_results) AS e(value)
  WHERE pg_catalog.jsonb_typeof(e.value)<>'object'
   OR pg_catalog.jsonb_typeof(e.value->'nickname')<>'string'
   OR e.value ? 'player_id'
   OR e.value ? 'profile_id'
   OR e.value ? 'elo_rating'
   OR e.value ? 'elo_before'
   OR e.value ? 'elo_after'
   OR e.value ? 'actor_id'
   OR e.value ? 'currency'
 ) THEN RAISE EXCEPTION 'Untrusted field or missing nickname' USING ERRCODE='PT422'; END IF;
 WITH input AS (
  SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
   AS x(nickname text,position integer,prize_won numeric,bounties_won numeric,
        league_points_earned numeric,ccp_club text,buy_ins_count numeric)
 )
 SELECT count(*)::int,count(DISTINCT pg_catalog.lower(pg_catalog.btrim(nickname)))::int,
   count(DISTINCT position)::int,min(position),max(position),
   count(*) FILTER (WHERE nickname IS NULL
     OR length(pg_catalog.btrim(nickname)) NOT BETWEEN 1 AND 80
     OR position IS NULL OR position<1
     OR prize_won IS NULL OR prize_won<0 OR prize_won>100000000
     OR prize_won::text IN ('NaN','Infinity','-Infinity')
     OR bounties_won IS NULL OR bounties_won<0 OR bounties_won>100000000
     OR bounties_won::text IN ('NaN','Infinity','-Infinity')
     OR buy_ins_count IS NULL OR buy_ins_count NOT BETWEEN 1 AND 100
     OR buy_ins_count<>pg_catalog.trunc(buy_ins_count)
     OR length(coalesce(ccp_club,''))>120
     OR coalesce(league_points_earned,0)<>0
   )::int
 INTO v_n,v_distinct_nick,v_distinct_pos,v_pos_min,v_pos_max,v_invalid
 FROM input;
 IF v_invalid<>0 OR v_n<>v_distinct_nick OR v_n<>v_distinct_pos
 OR v_pos_min<>1 OR v_pos_max<>v_n THEN
  RAISE EXCEPTION 'Invalid nickname/position/prize/entries or league points'
    USING ERRCODE='PT422'; END IF;

 -- Serialize a nickname within its poker room, ensuring case-folded uniqueness.
 FOR v_nickname IN
  SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(x.nickname)) AS normalized
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
  ORDER BY normalized
 LOOP
  PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('league-player:'||v_room::text||':'||v_nickname,0));
 END LOOP;

 INSERT INTO public.players(nickname,room_id,country_code,elo_rating,elo_peak)
 SELECT pg_catalog.btrim(x.nickname),v_room,v_country,1200,1200
 FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
 WHERE NOT EXISTS(
  SELECT 1 FROM public.players p WHERE p.room_id=v_room
    AND pg_catalog.lower(pg_catalog.btrim(p.nickname))=
      pg_catalog.lower(pg_catalog.btrim(x.nickname)))
 ORDER BY pg_catalog.lower(pg_catalog.btrim(x.nickname))
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_new=ROW_COUNT;

 -- We resolve IDs exclusively from database state; clients provide nicknames.
 WITH input AS (
  SELECT x.*,p.id AS player_id,p.room_id
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(
    nickname text,position integer,prize_won numeric,bounties_won numeric,
    buy_ins_count numeric)
  JOIN public.players p ON p.room_id=v_room AND
   pg_catalog.lower(pg_catalog.btrim(p.nickname))=
     pg_catalog.lower(pg_catalog.btrim(x.nickname))
 )
 SELECT count(*)::int,count(*) FILTER(WHERE room_id IS DISTINCT FROM v_room)::int,
        array_agg(player_id ORDER BY player_id)
 INTO v_found,v_invalid_room,v_ids
 FROM input;
 IF v_found<>v_n OR v_invalid_room<>0 OR
  (SELECT count(DISTINCT x) FROM unnest(v_ids) AS x)<>v_n THEN
  RAISE EXCEPTION 'Ambiguous or incomplete room nickname resolution' USING ERRCODE='PT409';
 END IF;

 -- Deterministic lock order for concurrent tournaments with shared players.
 SELECT count(*) INTO v_found FROM (
  SELECT p.id FROM public.players p
  WHERE p.id=ANY(v_ids) ORDER BY p.id FOR UPDATE
 ) locked_players;
 IF v_found<>v_n THEN RAISE EXCEPTION 'Missing locked players' USING ERRCODE='PT409'; END IF;

 -- Forbid retroactive publication if ANY affected player has a later (or
 -- same-time different) result, even if legacy Elo history is missing.
 IF EXISTS(
   SELECT 1 FROM public.tournament_results r
   JOIN public.tournaments t ON t.id=r.tournament_id
   WHERE r.player_id=ANY(v_ids) AND t.id<>p_tournament_id
    AND t.start_datetime>=v_date
 ) THEN RAISE EXCEPTION 'Later or ambiguous-time results exist for a player'
   USING ERRCODE='PT409'; END IF;

 SELECT pg_catalog.sum(p.elo_rating) INTO v_sum
 FROM public.players p WHERE p.id=ANY(v_ids);
 IF v_sum IS NULL OR v_sum<100*v_n OR v_sum>100000000*v_n
 THEN RAISE EXCEPTION 'Player Elo baseline is outside guardrail' USING ERRCODE='PT409'; END IF;
 v_weight:=(v_sum/v_n)/1200;

 -- Exact Release A algorithm legacy-js-v1: same set-snapshot, K, weight,
 -- expected and min-100 clipping. NO new formula or currency conversion.
 WITH entries AS (
  SELECT p.id AS player_id,p.elo_rating AS elo_before,p.total_tournaments,
         x.position,x.prize_won,x.bounties_won,x.buy_ins_count
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(
    nickname text,position integer,prize_won numeric,
    bounties_won numeric,buy_ins_count numeric)
  JOIN public.players p ON p.room_id=v_room AND
    pg_catalog.lower(pg_catalog.btrim(p.nickname))=
    pg_catalog.lower(pg_catalog.btrim(x.nickname))
 ), factors AS (
  SELECT e.*,(v_n-e.position)::numeric/(v_n-1) AS score,
   1/(1+pg_catalog.power(10::numeric,((v_sum-e.elo_before)/(v_n-1)-e.elo_before)/400))
     AS expected,
   (CASE WHEN e.total_tournaments<30 THEN 40 ELSE 20 END)
   *(1+pg_catalog.log(v_buyin+1)*0.1)
   *(1+pg_catalog.log(v_n::numeric)*0.15) AS k
  FROM entries e
 ), computed AS (
  SELECT f.*,f.k*v_weight*(f.score-f.expected) AS raw_change FROM factors f
 )
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'player_id',x.player_id,'position',x.position,
   'prize_won',x.prize_won,'bounties_won',x.bounties_won,
   'buy_ins_count',x.buy_ins_count,
   'elo_before',x.elo_before,
   'elo_after',pg_catalog.round(GREATEST(100::numeric,x.elo_before+x.raw_change),2),
   'elo_change',pg_catalog.round(x.raw_change,2)
 ) ORDER BY x.position),'[]'::jsonb) INTO v_calculated FROM computed x;
 IF pg_catalog.jsonb_array_length(v_calculated)<>v_n
 THEN RAISE EXCEPTION 'Elo computation failed' USING ERRCODE='PT409'; END IF;

 -- Append private immutable audit BEFORE the updates, in the same transaction.
 SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  pg_catalog.jsonb_build_object('algorithm_version','legacy-js-v1',
   'tournament_id',p_tournament_id,'room_id',v_room,
   'buy_in',v_buyin,'currency',v_currency,'results',p_results)::text,'UTF8')),'hex')
 INTO v_fingerprint;
 INSERT INTO sharkania_release.independent_elo_publication(
   tournament_id,actor_profile_id,algorithm_version,input_fingerprint
 ) VALUES(p_tournament_id,v_actor,'legacy-js-v1',v_fingerprint)
 RETURNING id INTO v_pub;

 INSERT INTO sharkania_release.independent_elo_checkpoint(
  publication_id,player_id,elo_before,elo_after,elo_peak_before,
  tournaments_before,cashes_before,wins_before,prize_won_before,
  buy_ins_before,elo_change
 )
 SELECT v_pub,p.id,p.elo_rating,x.elo_after,p.elo_peak,
  p.total_tournaments,p.total_cashes,p.total_wins,
  p.total_prize_won,p.total_buy_ins_spent,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,elo_after numeric,elo_change numeric)
 JOIN public.players p ON p.id=x.player_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete Elo checkpoints' USING ERRCODE='PT409'; END IF;

 INSERT INTO public.tournament_results(
  tournament_id,player_id,position,prize_won,bounties_won,
  league_points_earned,ccp_club,buy_ins_count,elo_before,elo_after,elo_change
 )
 SELECT p_tournament_id,x.player_id,x.position,x.prize_won,x.bounties_won,
  0,NULL,x.buy_ins_count,x.elo_before,x.elo_after,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,position integer,prize_won numeric,bounties_won numeric,
  buy_ins_count numeric,elo_before numeric,elo_after numeric,elo_change numeric);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete results' USING ERRCODE='PT409'; END IF;

 INSERT INTO public.elo_history(
  tournament_id,player_id,elo_before,elo_after,elo_change
 )
 SELECT p_tournament_id,x.player_id,x.elo_before,x.elo_after,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,elo_before numeric,elo_after numeric,elo_change numeric);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete Elo history' USING ERRCODE='PT409'; END IF;

 -- Currency ledger stores actual #reentries; old player totals must continue
 -- to add buy-in ONCE per tournament, matching the legacy-js-v1 behavior.
 INSERT INTO sharkania_release.independent_currency_posting(
  publication_id,tournament_id,player_id,currency,buy_in_per_entry,
  buy_ins_count,prize_won,bounties_won
 )
 SELECT v_pub,p_tournament_id,x.player_id,v_currency,v_buyin,
  x.buy_ins_count,x.prize_won,x.bounties_won
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,buy_ins_count integer,prize_won numeric,bounties_won numeric);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete currency journal' USING ERRCODE='PT409'; END IF;

 UPDATE public.players p SET elo_rating=x.elo_after,
  elo_peak=GREATEST(p.elo_peak,x.elo_after),
  total_tournaments=p.total_tournaments+1,
  total_cashes=p.total_cashes+
   (CASE WHEN x.prize_won+x.bounties_won>0 THEN 1 ELSE 0 END),
  total_wins=p.total_wins+(CASE WHEN x.position=1 THEN 1 ELSE 0 END),
  total_prize_won=p.total_prize_won+x.prize_won+x.bounties_won,
  total_buy_ins_spent=p.total_buy_ins_spent+v_buyin
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,position integer,prize_won numeric,
  bounties_won numeric,elo_after numeric)
 WHERE p.id=x.player_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete player updates' USING ERRCODE='PT409'; END IF;

 -- Profile Elo materialization is server-owned; preserve Release A formula.
 PERFORM u.id FROM public.profiles u
 WHERE u.id IN(
  SELECT DISTINCT p.profile_id FROM public.players p
  WHERE p.id=ANY(v_ids) AND p.profile_id IS NOT NULL
 ) ORDER BY u.id FOR UPDATE;
 WITH affected AS MATERIALIZED (
  SELECT DISTINCT p.profile_id FROM public.players p
  WHERE p.id=ANY(v_ids) AND p.profile_id IS NOT NULL
 ), aliases AS (
  SELECT p.profile_id,count(*)::int AS alias_count,
         max(p.elo_rating) AS single_alias_elo
  FROM public.players p JOIN affected a ON a.profile_id=p.profile_id
  GROUP BY p.profile_id
 ), histories AS (
  SELECT p.profile_id,coalesce(sum(h.elo_change),0) AS total_change,
    (array_agg(h.elo_after ORDER BY h.recorded_at DESC,h.id DESC)
      FILTER (WHERE h.id IS NOT NULL))[1] AS latest_elo
  FROM public.players p JOIN affected a ON a.profile_id=p.profile_id
  LEFT JOIN public.elo_history h ON h.player_id=p.id
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

 UPDATE public.tournaments
  SET results_uploaded=true,status='completed'
 WHERE id=p_tournament_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'Tournament completion missing' USING ERRCODE='PT409'; END IF;

 RETURN pg_catalog.jsonb_build_object(
  'status','published','tournament_id',p_tournament_id,
  'currency','USD','players',v_n,'new_players',v_new,
  'currency_postings',v_n,'atomic',true,'audit_recorded',true);
END;
$nonleague$;

-- Avoid default PUBLIC EXECUTE on SECURITY DEFINER. Only authenticated can
-- invoke via PostgREST. Actual authorization is also verified in the body.
REVOKE ALL ON FUNCTION public.publish_independent_nickname_results_guarded(uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_independent_nickname_results_guarded(uuid,jsonb)
 TO authenticated;

DO $post$
BEGIN
 IF pg_catalog.has_function_privilege('anon',
  'public.publish_independent_nickname_results_guarded(uuid,jsonb)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('authenticated',
  'public.publish_independent_nickname_results_guarded(uuid,jsonb)','EXECUTE')
 OR pg_catalog.has_schema_privilege('authenticated','sharkania_release','USAGE')
 OR pg_catalog.has_table_privilege('authenticated',
  'sharkania_release.independent_elo_publication','SELECT')
 THEN
  RAISE EXCEPTION 'Independent writer exposed unsafe access'
    USING ERRCODE='PT409';
 END IF;
END;
$post$;
-- ######## END SOURCE 2/5 ########

-- ######## SOURCE 3/5: docs/security/independent-elo-rest-lockdown-2026-11-10.CANDIDATE.sql ########
-- SHARKANIA / PR #96 draft ACL cutover (QA only; NOT A PRODUCTION MIGRATION).
-- Apply only after PR #95 and the independent-results candidate SQL.
-- Activation without the guarded frontend would BREAK legacy non-league uploads.
-- No deploy, no flag, no DDL on production.
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

DO $pre$
BEGIN
 IF to_regprocedure('public.publish_independent_nickname_results_guarded(uuid,jsonb)') IS NULL
 OR to_regprocedure('public.publish_league_nickname_results_guarded(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'Both guarded writers required before client lockdown'
 USING ERRCODE='PT409'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid='public.players'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid='public.elo_history'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid='public.tournament_results'::regclass)
 THEN RAISE EXCEPTION 'Critical RLS is missing' USING ERRCODE='PT409'; END IF;
END;
$pre$;

-- The API must NEVER set player ID, profile linkage, Elo or financial fields.
-- Only narrowly scoped cosmetic name/country edits survive for club admins.
-- RLS still determines which player's nickname can be changed.
REVOKE INSERT,UPDATE,DELETE ON TABLE public.players
  FROM PUBLIC,anon,authenticated;
GRANT UPDATE(nickname,country_code) ON public.players TO authenticated;

-- No browser may add or delete a legacy Elo event or tournament result.
-- Both server writers are SECURITY DEFINER with their own actor checks.
REVOKE INSERT,UPDATE,DELETE ON TABLE public.elo_history
  FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON TABLE public.tournament_results
  FROM PUBLIC,anon,authenticated;

-- A direct authenticated PATCH could otherwise mark a standalone tournament
-- completed without a result/ledger. Preserve normal unrelated edits.
CREATE FUNCTION public.guard_independent_client_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $guard$
BEGIN
 IF current_user IN ('authenticated','anon')
 AND OLD.league_id IS NULL
 AND (
    NEW.results_uploaded IS DISTINCT FROM OLD.results_uploaded
    OR (
      NEW.status IS DISTINCT FROM OLD.status
      AND (NEW.status::text='completed' OR OLD.status::text='completed')
    )
 ) THEN
    RAISE EXCEPTION 'Independent tournament completion requires guarded server writer'
    USING ERRCODE='PT409';
 END IF;
 RETURN NEW;
END;
$guard$;

REVOKE EXECUTE ON FUNCTION public.guard_independent_client_completion()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER independent_guard_direct_completion
 BEFORE UPDATE OF results_uploaded,status ON public.tournaments
 FOR EACH ROW EXECUTE FUNCTION public.guard_independent_client_completion();

DO $post$
BEGIN
 IF pg_catalog.has_column_privilege('authenticated','public.players','elo_rating','UPDATE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','elo_peak','UPDATE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','total_prize_won','UPDATE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','profile_id','UPDATE')
 OR pg_catalog.has_table_privilege('authenticated','public.players','INSERT')
 OR pg_catalog.has_table_privilege('authenticated','public.elo_history','INSERT')
 OR pg_catalog.has_table_privilege('authenticated','public.tournament_results','UPDATE')
 OR NOT pg_catalog.has_column_privilege('authenticated','public.players','nickname','UPDATE')
 OR NOT pg_catalog.has_column_privilege('authenticated','public.players','country_code','UPDATE')
 THEN RAISE EXCEPTION 'Elo/finance direct API privileges were not closed'
 USING ERRCODE='PT409'; END IF;
END;
$post$;
-- ######## END SOURCE 3/5 ########

-- ######## SOURCE 4/5: docs/security/admin-player-link-guarded-2026-11-10.CANDIDATE.sql ########
-- SHARKANIA / PR #96 / ADMIN NICKNAME LINKING (QA CANDIDATE, NOT LIVE).
-- Keep administrative linking working after revoking players.profile_id UPDATE.
-- Server validates real superadmin and writes player + claim in ONE transaction.
-- The RLS policy of nickname_claims remains unchanged for player submissions.
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
DO $link_pre$
BEGIN
 IF to_regclass('public.nickname_claims') IS NULL
 OR to_regclass('public.players') IS NULL
 OR to_regprocedure('public.publish_independent_nickname_results_guarded(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'Review current tables and guarded writer before admin link RPC'
 USING ERRCODE='PT409'; END IF;
 IF to_regprocedure('public.admin_link_player_profile_guarded(uuid,uuid,uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'Admin profile link RPC already exists; compare definition'
 USING ERRCODE='PT409'; END IF;
END;
$link_pre$;

CREATE FUNCTION public.admin_link_player_profile_guarded(
 p_player_id uuid,p_profile_id uuid,p_claim_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $admin_link$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_before uuid;
 v_claim record;
BEGIN
 IF v_actor IS NULL OR NOT (SELECT public.is_super_admin()) THEN
  RAISE EXCEPTION 'Super administrator required' USING ERRCODE='42501';
 END IF;
 IF p_player_id IS NULL THEN
  RAISE EXCEPTION 'Invalid player' USING ERRCODE='PT422'; END IF;
 IF p_claim_id IS NOT NULL AND p_profile_id IS NULL THEN
  RAISE EXCEPTION 'Cannot approve a claim when unlinking' USING ERRCODE='PT422';
 END IF;

 SELECT p.profile_id INTO v_before
 FROM public.players p WHERE p.id=p_player_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Player not found' USING ERRCODE='PT404'; END IF;

 IF p_profile_id IS NULL THEN
  UPDATE public.players SET profile_id=NULL WHERE id=p_player_id;
  RETURN pg_catalog.jsonb_build_object('status','unlinked','player_id',p_player_id);
 END IF;

 PERFORM 1 FROM public.profiles WHERE id=p_profile_id FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found' USING ERRCODE='PT404'; END IF;

 -- Never silently steal a nickname that belongs to another account.
 IF v_before IS NOT NULL AND v_before IS DISTINCT FROM p_profile_id THEN
  RAISE EXCEPTION 'Already linked to a different profile' USING ERRCODE='PT409'; END IF;

 IF p_claim_id IS NOT NULL THEN
  SELECT c.id,c.user_id,c.player_id,c.status::text AS status
   INTO v_claim
  FROM public.nickname_claims c
  WHERE c.id=p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found' USING ERRCODE='PT404'; END IF;
  IF v_claim.status<>'pending'
  OR v_claim.user_id IS DISTINCT FROM p_profile_id
  OR v_claim.player_id IS DISTINCT FROM p_player_id THEN
   RAISE EXCEPTION 'Claim does not match player/profile or is already resolved'
   USING ERRCODE='PT409';
  END IF;
 END IF;

 UPDATE public.players SET profile_id=p_profile_id WHERE id=p_player_id;
 IF p_claim_id IS NOT NULL THEN
  UPDATE public.nickname_claims
   SET status='approved',resolved_at=pg_catalog.now(),resolved_by=v_actor
   WHERE id=p_claim_id;
 ELSIF v_before IS DISTINCT FROM p_profile_id THEN
  -- Manual superadmin linking: preserve the legacy administrative evidence,
  -- but write it in the SAME transaction as the player link.
  INSERT INTO public.nickname_claims(
   user_id,player_id,screenshot_url,status,resolved_at,resolved_by
  ) VALUES(p_profile_id,p_player_id,'admin-claim','approved',
           pg_catalog.now(),v_actor);
 END IF;

 RETURN pg_catalog.jsonb_build_object(
   'status','linked','player_id',p_player_id,'profile_id',p_profile_id,
   'claim_resolved',p_claim_id IS NOT NULL,'atomic',true);
END;
$admin_link$;

REVOKE ALL ON FUNCTION public.admin_link_player_profile_guarded(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_player_profile_guarded(uuid,uuid,uuid)
 TO authenticated;

DO $post$
BEGIN
 IF pg_catalog.has_function_privilege('anon',
  'public.admin_link_player_profile_guarded(uuid,uuid,uuid)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('authenticated',
  'public.admin_link_player_profile_guarded(uuid,uuid,uuid)','EXECUTE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','profile_id','UPDATE')
 THEN RAISE EXCEPTION 'Unsafe linking privileges' USING ERRCODE='PT409'; END IF;
END;
$post$;
-- ######## END SOURCE 4/5 ########

-- ######## SOURCE 5/5: docs/security/guard-published-history-against-legacy-2026-11-10.CANDIDATE.sql ########
-- PR #96. QA ONLY. Blocking SECURITY DEFINER legacy reset/delete from
-- rewriting already-published Elo, even if an admin owns the tournament.
-- This extends PR #95's league-only trigger fence to ALL completed tournaments.
-- Review separately before any production cutover: legacy historical edits
-- deliberately return PT409 pending an approved replay algorithm.
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

DO $preflight$
BEGIN
 IF to_regprocedure('public.publish_independent_nickname_results_guarded(uuid,jsonb)') IS NULL
 OR to_regclass('sharkania_release.independent_elo_publication') IS NULL
 OR to_regclass('sharkania_release.elo_publication') IS NULL
 OR NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c
         WHERE c.oid='public.elo_history'::regclass)
 THEN
  RAISE EXCEPTION 'Published history guard requires both Release A and independent writer'
  USING ERRCODE='PT409';
 END IF;
END;
$preflight$;

-- For the existing pre-Release-A records we MUST NOT infer Elo starts at 1200
-- nor let a legacy privileged function silently overwrite real history.
-- No path exists for editing results after publication until versioned replay.
CREATE FUNCTION public.guard_published_elo_history_legacy()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $immutable$
DECLARE
 v_id uuid;
 v_uploaded boolean;
 v_has_protected_evidence boolean;
BEGIN
 v_id:=OLD.tournament_id;
 SELECT t.results_uploaded,
   (EXISTS(SELECT 1 FROM sharkania_release.elo_publication ep
           WHERE ep.tournament_id=t.id)
    OR EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication ip
           WHERE ip.tournament_id=t.id))
 INTO v_uploaded,v_has_protected_evidence
 FROM public.tournaments t WHERE t.id=v_id FOR SHARE;
 IF NOT FOUND THEN
  -- Foreign-key cascading deletes are never allowed for historical data:
  -- preserve evidence until explicit chronological replay is approved.
  RAISE EXCEPTION 'Historical Elo row lost its tournament context' USING ERRCODE='PT409';
 END IF;
 IF v_uploaded IS TRUE OR v_has_protected_evidence OR TG_OP='DELETE'
    OR TG_OP='UPDATE' THEN
  RAISE EXCEPTION 'Historic Elo is immutable until an approved chronological replay'
   USING ERRCODE='PT409';
 END IF;
 RETURN OLD;
END;
$immutable$;

-- This guard is intentionally strict: no legacy Elo row can be edited/deleted
-- without a versioned administrative correction process.
REVOKE EXECUTE ON FUNCTION public.guard_published_elo_history_legacy()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_all_historical_elo_mutations
 BEFORE UPDATE OR DELETE ON public.elo_history
 FOR EACH ROW EXECUTE FUNCTION public.guard_published_elo_history_legacy();

CREATE FUNCTION public.guard_published_result_legacy()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $immutable$
DECLARE v_uploaded boolean;
BEGIN
 SELECT t.results_uploaded INTO v_uploaded
 FROM public.tournaments t WHERE t.id=OLD.tournament_id FOR SHARE;
 IF NOT FOUND OR v_uploaded IS TRUE OR EXISTS(
  SELECT 1 FROM public.elo_history h
  WHERE h.tournament_id=OLD.tournament_id
 ) OR EXISTS(
  SELECT 1 FROM sharkania_release.independent_elo_publication ep
  WHERE ep.tournament_id=OLD.tournament_id
 ) OR EXISTS(
  SELECT 1 FROM sharkania_release.elo_publication ep
  WHERE ep.tournament_id=OLD.tournament_id
 ) THEN
  RAISE EXCEPTION 'Results already have Elo or publication evidence; replay required'
   USING ERRCODE='PT409';
 END IF;
 -- Even if a tournament's legacy status is inconsistent, existing result
 -- rows must not be edited/deleted outside a guarded correction procedure.
 RAISE EXCEPTION 'Historical tournament results cannot be edited directly'
 USING ERRCODE='PT409';
END;
$immutable$;
REVOKE EXECUTE ON FUNCTION public.guard_published_result_legacy()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_all_historical_result_mutations
 BEFORE UPDATE OR DELETE ON public.tournament_results
 FOR EACH ROW EXECUTE FUNCTION public.guard_published_result_legacy();

CREATE FUNCTION public.guard_published_tournament_deletion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $immutable$
BEGIN
 IF OLD.results_uploaded IS TRUE
 OR EXISTS(SELECT 1 FROM public.tournament_results r WHERE r.tournament_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.elo_history h WHERE h.tournament_id=OLD.id)
 OR EXISTS(SELECT 1 FROM sharkania_release.elo_publication ep WHERE ep.tournament_id=OLD.id)
 OR EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication ip WHERE ip.tournament_id=OLD.id)
 THEN
  RAISE EXCEPTION 'Deleting published or partially recorded tournament requires reviewed replay'
   USING ERRCODE='PT409';
 END IF;
 RETURN OLD;
END;
$immutable$;
REVOKE EXECUTE ON FUNCTION public.guard_published_tournament_deletion()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_any_published_tournament_deletion
 BEFORE DELETE ON public.tournaments
 FOR EACH ROW EXECUTE FUNCTION public.guard_published_tournament_deletion();

-- Do not allow any privileged legacy function to reopen a completed tournament
-- while its Elo history/checkpoints remain installed. The guarded first writer
-- updates false -> true, which remains allowed.
CREATE FUNCTION public.guard_published_tournament_reopening()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $immutable$
BEGIN
 -- Live read-only catalog has three historical uploaded tournaments with
 -- status=scheduled (all CLP/EUR leagues). Preserve no-op status updates.
 -- Do not allow transitions to cancellation or reopening; correcting those
 -- legacy rows requires separately reviewed permission and data lineage.
 IF OLD.results_uploaded IS TRUE AND
   (NEW.results_uploaded IS NOT TRUE OR
    (NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text <> 'completed'))
 THEN
  RAISE EXCEPTION 'Published tournament cannot revert status without chronological replay'
   USING ERRCODE='PT409';
 END IF;
 RETURN NEW;
END;
$immutable$;
REVOKE EXECUTE ON FUNCTION public.guard_published_tournament_reopening()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_any_published_tournament_reopening
 BEFORE UPDATE OF results_uploaded,status ON public.tournaments
 FOR EACH ROW EXECUTE FUNCTION public.guard_published_tournament_reopening();

-- ######## END SOURCE 5/5 ########

-- ######## END SECTION 1/3 ########

-- ######## SECTION 2/3: docs/security/elo-v2-usd-fx-observations-2026-11-10.CANDIDATE.sql ########
-- SHARKANIA / ELO V2 OFFICIAL USD NORMALIZATION (QA CANDIDATE ONLY).
-- Install AFTER both Release A #95 and independent #96 candidates.
-- Do NOT run on production. NO scheduled jobs or FX credentials included.
-- OFF BY DEFAULT: config.enabled remains false; no writes to legacy ELO.
-- FX source first_seen_at is minted by PostgreSQL on *actual* server receipt.
-- IMPORTANT: historical provider series dates do NOT prove when originally
-- published. A backfilled rate first seen AFTER tournament start is unusable.
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

DO $pre$
BEGIN
 IF to_regnamespace('sharkania_release') IS NULL
 OR to_regclass('sharkania_release.elo_publication') IS NULL
 OR to_regclass('sharkania_release.independent_elo_publication') IS NULL
 OR to_regprocedure('public.publish_league_nickname_results_guarded(uuid,jsonb)') IS NULL
 OR to_regprocedure('public.publish_independent_nickname_results_guarded(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'Release A and independent guarded writers are required'
 USING ERRCODE='PT409'; END IF;
END;$pre$;

-- Deliberately not exposed in PostgREST; no browser can insert quotes.
CREATE TABLE sharkania_release.fx_observation_v2 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 currency text NOT NULL CHECK(currency IN ('CLP','EUR')),
 provider text NOT NULL CHECK(provider IN ('BCCH','ECB')),
 series_key text NOT NULL CHECK(
  (currency='CLP' AND provider='BCCH' AND series_key='F073.TCO.PRE.Z.D')
  OR (currency='EUR' AND provider='ECB' AND series_key='EXR/D.USD.EUR.SP00.A')
 ),
 effective_date date NOT NULL,
 quote numeric(24,10) NOT NULL CHECK(quote>0 AND quote<=100000000),
 -- BCCH: CLP per USD; ECB: USD per EUR, never inverted.
 raw_observation_sha256 text NOT NULL
  CHECK(raw_observation_sha256~'^[a-f0-9]{64}$'),
 reference_id text NOT NULL CHECK(length(btrim(reference_id)) BETWEEN 8 AND 180),
 -- This server-generated timestamp is the only auditable proof of presence.
 first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(currency,effective_date)
);

-- Append-only PROOF OF RECENT SUCCESSFUL FEED CHECK. An old FX quote alone
-- is NOT enough: a timely upstream request might have failed or missed a
-- newer official observation.
CREATE TABLE sharkania_release.fx_feed_check_v2 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 currency text NOT NULL CHECK(currency IN ('CLP','EUR')),
 newest_effective_date date NOT NULL,
 newest_observation_id uuid NOT NULL
   REFERENCES sharkania_release.fx_observation_v2(id),
 checked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(newest_effective_date>='2000-01-01')
);
CREATE INDEX fx_feed_check_currency_time_v2
 ON sharkania_release.fx_feed_check_v2(currency,checked_at DESC);

CREATE TABLE sharkania_release.elo_v2_activation (
 id smallint PRIMARY KEY CHECK(id=1),
 enabled boolean NOT NULL DEFAULT false,
 effective_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO sharkania_release.elo_v2_activation(id,enabled,effective_at)
VALUES(1,false,'2100-01-01T00:00:00Z');

CREATE TABLE sharkania_release.elo_v2_event_fx (
 tournament_id uuid PRIMARY KEY REFERENCES public.tournaments(id),
 algorithm_version text NOT NULL DEFAULT 'elo-v2-usd-normalized'
   CHECK(algorithm_version='elo-v2-usd-normalized'),
 event_started_at timestamptz NOT NULL,
 original_currency text NOT NULL CHECK(original_currency IN ('USD','CLP','EUR')),
 original_buy_in numeric NOT NULL CHECK(original_buy_in>=0),
 rate_observation_id uuid REFERENCES sharkania_release.fx_observation_v2(id),
 quote numeric(24,10) NOT NULL CHECK(quote>0),
 buy_in_usd numeric NOT NULL CHECK(buy_in_usd>=0 AND buy_in_usd<100000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (
  (original_currency='USD' AND quote=1 AND rate_observation_id IS NULL
   AND buy_in_usd=original_buy_in)
  OR (original_currency IN ('CLP','EUR') AND rate_observation_id IS NOT NULL)
 )
);

ALTER TABLE sharkania_release.fx_observation_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release.fx_feed_check_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release.elo_v2_activation ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release.elo_v2_event_fx ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sharkania_release.fx_observation_v2,
 sharkania_release.fx_feed_check_v2,
 sharkania_release.elo_v2_activation,
 sharkania_release.elo_v2_event_fx FROM PUBLIC,anon,authenticated;

-- No updates/deletes even by a legacy elevated function; on corrected quote,
-- store a new audit version under a reviewed schema migration, not an UPDATE.
CREATE TRIGGER elo_v2_observation_immutable
 BEFORE UPDATE OR DELETE ON sharkania_release.fx_observation_v2
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();
CREATE TRIGGER elo_v2_feed_check_immutable
 BEFORE UPDATE OR DELETE ON sharkania_release.fx_feed_check_v2
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();
CREATE TRIGGER elo_v2_event_fx_immutable
 BEFORE UPDATE OR DELETE ON sharkania_release.elo_v2_event_fx
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();

-- Service-role-only endpoint for the already-parsed official data.
-- The Edge Function MUST fetch and validate BCCH/ECB; the API role cannot
-- add a source or edit the first_seen_at receipt timestamp.
CREATE FUNCTION public.sharkania_fx_ingest_official_v2(
 p_currency text,p_effective_date date,p_quote numeric,
 p_raw_sha256 text,p_reference_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $ingest$
DECLARE v_provider text; v_series text; v_id uuid; v_quote numeric;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'Only internal service-role ingestion allowed'
 USING ERRCODE='42501'; END IF;
 IF p_currency='CLP' THEN
  v_provider:='BCCH'; v_series:='F073.TCO.PRE.Z.D';
 ELSIF p_currency='EUR' THEN
  v_provider:='ECB'; v_series:='EXR/D.USD.EUR.SP00.A';
 ELSE RAISE EXCEPTION 'No provider for currency'
 USING ERRCODE='PT422'; END IF;
 IF p_quote IS NULL OR p_quote<=0 OR p_quote>100000000
 OR p_raw_sha256 IS NULL OR p_raw_sha256 !~ '^[a-f0-9]{64}$'
 OR p_reference_id IS NULL OR length(btrim(p_reference_id)) NOT BETWEEN 8 AND 180
 OR p_effective_date IS NULL
 OR p_effective_date> ((clock_timestamp() AT TIME ZONE 'UTC')::date + 1)
 OR p_effective_date < '2000-01-01'
 THEN RAISE EXCEPTION 'Invalid or unverified quote metadata'
 USING ERRCODE='PT422'; END IF;

 -- Serialize daily currency inserts to avoid mutable duplicate quoted values.
 INSERT INTO sharkania_release.fx_observation_v2(
  currency,provider,series_key,effective_date,quote,
  raw_observation_sha256,reference_id
 ) VALUES (
  p_currency,v_provider,v_series,p_effective_date,p_quote,
  p_raw_sha256,p_reference_id
 ) ON CONFLICT(currency,effective_date) DO NOTHING
 RETURNING id,quote INTO v_id,v_quote;

 IF v_id IS NULL THEN
  SELECT id,quote INTO v_id,v_quote
  FROM sharkania_release.fx_observation_v2
  WHERE currency=p_currency AND effective_date=p_effective_date;
  IF v_quote IS DISTINCT FROM p_quote
     OR NOT EXISTS (
       SELECT 1 FROM sharkania_release.fx_observation_v2
       WHERE id=v_id AND
         raw_observation_sha256=p_raw_sha256 AND reference_id=p_reference_id
     )
  THEN
   RAISE EXCEPTION 'Existing official observation differs; requires manual review'
    USING ERRCODE='PT409';
  END IF;
 END IF;
 RETURN jsonb_build_object('observation_id',v_id,
  'status','recorded','effective_date',p_effective_date,
  'currency',p_currency);
END;
$ingest$;
REVOKE ALL ON FUNCTION
 public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)
 TO service_role;

-- Only internal trusted ingestion records a completed upstream feed poll.
-- Observation MUST already be stored and genuinely minted before the check.
-- DB picks newest, no client-provided day, rate, or timestamp.
CREATE FUNCTION public.sharkania_fx_record_feed_check_v2(p_currency text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $poll$
DECLARE v_observation uuid;v_effective date;v_check uuid;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'Internal FX poll only' USING ERRCODE='42501'; END IF;
 IF p_currency NOT IN ('CLP','EUR') OR p_currency IS NULL THEN
  RAISE EXCEPTION 'Unsupported FX feed' USING ERRCODE='PT422'; END IF;
 SELECT fx.id,fx.effective_date INTO v_observation,v_effective
 FROM sharkania_release.fx_observation_v2 fx
 WHERE fx.currency=p_currency
   AND fx.effective_date<=((clock_timestamp() AT TIME ZONE 'UTC')::date)
   AND fx.first_seen_at<=clock_timestamp()
 ORDER BY fx.effective_date DESC,fx.first_seen_at DESC
 LIMIT 1;
 IF NOT FOUND OR v_effective <
      ((clock_timestamp() AT TIME ZONE 'UTC')::date - 7) THEN
  RAISE EXCEPTION 'Official FX feed has no recent accepted quote'
   USING ERRCODE='PT409'; END IF;
 INSERT INTO sharkania_release.fx_feed_check_v2(
  currency,newest_effective_date,newest_observation_id
 ) VALUES(p_currency,v_effective,v_observation) RETURNING id INTO v_check;
 RETURN pg_catalog.jsonb_build_object(
  'check_id',v_check,'currency',p_currency,
  'newest_effective_date',v_effective,'status','checked');
END;
$poll$;
REVOKE ALL ON FUNCTION public.sharkania_fx_record_feed_check_v2(text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sharkania_fx_record_feed_check_v2(text)
 TO service_role;

-- PRIVATE function called ONLY from authenticated, authorized v2 publication.
-- No browser-supplied rate/amount and no lookup based on upload time.
CREATE FUNCTION sharkania_release.reserve_usd_elo_v2(p_tournament_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $reserve$
DECLARE
 v_start timestamptz;
 v_timezone text;
 v_date date;
 v_currency text;
 v_buyin numeric;
 v_fx record;
 v_last_check record;
 v_buyin_usd numeric;
 v_enabled boolean;
 v_effective timestamptz;
BEGIN
 SELECT enabled,effective_at INTO v_enabled,v_effective
 FROM sharkania_release.elo_v2_activation
 WHERE id=1 FOR SHARE;
 IF NOT FOUND OR v_enabled IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ELO v2 still disabled' USING ERRCODE='PT409'; END IF;

 SELECT t.start_datetime,t.timezone,t.currency,t.buy_in
 INTO v_start,v_timezone,v_currency,v_buyin
 FROM public.tournaments t WHERE t.id=p_tournament_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tournament missing' USING ERRCODE='PT404'; END IF;
 IF v_start IS NULL OR v_start<v_effective THEN
  RAISE EXCEPTION 'Historical tournament is v1; replay policy required'
  USING ERRCODE='PT409'; END IF;
 IF v_start>clock_timestamp() THEN
  RAISE EXCEPTION 'Cannot publish a future tournament'
  USING ERRCODE='PT409'; END IF;
 IF v_buyin IS NULL OR v_buyin<0 OR v_buyin>100000000
  OR v_currency NOT IN ('CLP','EUR','USD') THEN
  RAISE EXCEPTION 'Invalid buy-in currency or amount' USING ERRCODE='PT422'; END IF;
 v_date:=(v_start AT TIME ZONE coalesce(nullif(v_timezone,''),'UTC'))::date;
 IF v_currency='USD' THEN
  v_buyin_usd:=v_buyin;
  INSERT INTO sharkania_release.elo_v2_event_fx(
   tournament_id,event_started_at,original_currency,original_buy_in,
   rate_observation_id,quote,buy_in_usd
  ) VALUES(p_tournament_id,v_start,'USD',v_buyin,NULL,1,v_buyin_usd);
 ELSE
  SELECT fx.* INTO v_fx
  FROM sharkania_release.fx_observation_v2 fx
  WHERE fx.currency=v_currency
   AND fx.effective_date<=v_date
   AND (v_date-fx.effective_date) BETWEEN 0 AND 7
   AND fx.first_seen_at<=v_start
  ORDER BY fx.effective_date DESC,fx.first_seen_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No official FX rate captured before tournament start'
    USING ERRCODE='PT409'; END IF;
  -- Require successful official provider poll just BEFORE the actual event.
  -- Calendar age alone (7 days) cannot prove that we did not miss an update.
  -- Proposed QA operational contract: successful poll within the last 2h.
  SELECT ch.* INTO v_last_check
  FROM sharkania_release.fx_feed_check_v2 ch
  WHERE ch.currency=v_currency
    AND ch.checked_at<=v_start
    AND ch.checked_at>=v_start-interval '2 hours'
  ORDER BY ch.checked_at DESC,ch.id DESC LIMIT 1;
  IF NOT FOUND OR v_last_check.newest_effective_date IS DISTINCT FROM
       v_fx.effective_date
     OR v_last_check.newest_observation_id IS DISTINCT FROM v_fx.id
  THEN
    RAISE EXCEPTION 'No fresh official source verification before tournament start'
      USING ERRCODE='PT409';
  END IF;
  IF v_currency='CLP' THEN
   v_buyin_usd:=v_buyin/v_fx.quote;
  ELSE
   v_buyin_usd:=v_buyin*v_fx.quote;
  END IF;
  IF v_buyin_usd>100000000 THEN
    RAISE EXCEPTION 'Normalized buy-in exceeds safe maximum'
    USING ERRCODE='PT422'; END IF;
  INSERT INTO sharkania_release.elo_v2_event_fx(
   tournament_id,event_started_at,original_currency,original_buy_in,
   rate_observation_id,quote,buy_in_usd
  ) VALUES(p_tournament_id,v_start,v_currency,v_buyin,v_fx.id,v_fx.quote,v_buyin_usd);
 END IF;
 RETURN v_buyin_usd;
END;
$reserve$;
REVOKE ALL ON FUNCTION sharkania_release.reserve_usd_elo_v2(uuid)
 FROM PUBLIC,anon,authenticated;

-- AFTER the v2 switch, v1 writers must not bypass normalization by
-- uploading USD-only results with the old RPC. The untouched historic
-- rows in production are never updated; this only checks NEW publications.
CREATE FUNCTION sharkania_release.guard_new_legacy_v1_after_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guard$
BEGIN
 IF (SELECT enabled FROM sharkania_release.elo_v2_activation WHERE id=1)
 AND NEW.algorithm_version IS DISTINCT FROM 'elo-v2-usd-normalized' THEN
   RAISE EXCEPTION 'ELO v1 first publication disabled after v2 cutover'
   USING ERRCODE='PT409';
 END IF;
 RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION sharkania_release.guard_new_legacy_v1_after_activation()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER block_new_league_v1_after_cutover
 BEFORE INSERT ON sharkania_release.elo_publication
 FOR EACH ROW EXECUTE FUNCTION
 sharkania_release.guard_new_legacy_v1_after_activation();
CREATE TRIGGER block_new_independent_v1_after_cutover
 BEFORE INSERT ON sharkania_release.independent_elo_publication
 FOR EACH ROW EXECUTE FUNCTION
 sharkania_release.guard_new_legacy_v1_after_activation();

-- The v2 version will be generated in a separate QA file; do NOT enable
-- activation or call reserve() without the full new writers deployed.
DO $check$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM sharkania_release.elo_v2_activation
   WHERE id=1 AND enabled IS FALSE)
 OR has_function_privilege('authenticated',
  'public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)',
  'EXECUTE')
 OR has_function_privilege('anon',
  'public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)',
  'EXECUTE')
 OR has_function_privilege('authenticated',
  'public.sharkania_fx_record_feed_check_v2(text)','EXECUTE')
 OR has_function_privilege('anon',
  'public.sharkania_fx_record_feed_check_v2(text)','EXECUTE')
 OR has_schema_privilege('authenticated','sharkania_release','USAGE')
 THEN RAISE EXCEPTION 'ELO v2 snapshot installation unsafe'
 USING ERRCODE='PT409'; END IF;
END;
$check$;
-- ######## END SECTION 2/3 ########

-- ######## SECTION 3/3: docs/security/elo-v2-usd-results-writers-2026-11-10.CANDIDATE.sql ########
-- SHARKANIA ELO v2 USD-normalized FIRST RESULTS (QA CANDIDATE ONLY)
-- Depends on #95/#96 and elo-v2-usd-fx-observations candidate.
-- Copies vetted initial writers, changes only K buy-in to USD equivalent,
-- immutable version evidence and currency-aware finance. No historical replay.
-- Production remains v1; policy OFF until explicit dated go-live.
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

DO $pre$
BEGIN
 IF to_regprocedure('sharkania_release.reserve_usd_elo_v2(uuid)') IS NULL
 OR to_regclass('sharkania_release.elo_v2_event_fx') IS NULL
 OR EXISTS(SELECT 1 FROM sharkania_release.elo_v2_activation WHERE enabled)
 THEN RAISE EXCEPTION 'FX observations not installed or already enabled'
 USING ERRCODE='PT409'; END IF;
END;$pre$;
-- Extend ONLY the #96 review schema CHECKS; old v1 values remain unchanged.
ALTER TABLE sharkania_release.independent_elo_publication
 DROP CONSTRAINT independent_elo_publication_algorithm_version_check;
ALTER TABLE sharkania_release.independent_elo_publication
 ADD CONSTRAINT independent_elo_publication_algorithm_version_check
 CHECK(algorithm_version IN ('legacy-js-v1','elo-v2-usd-normalized'));
ALTER TABLE sharkania_release.independent_currency_posting
 DROP CONSTRAINT independent_currency_posting_currency_check;
ALTER TABLE sharkania_release.independent_currency_posting
 ADD CONSTRAINT independent_currency_posting_currency_check
 CHECK(currency IN ('USD','CLP','EUR'));

-- League v2 internal transactional ELO and client-facing nickname wrapper.
CREATE OR REPLACE FUNCTION sharkania_release.publish_results_initial_v2(
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
 v_buyin_usd numeric;
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
 IF v_currency NOT IN ('USD','CLP','EUR') THEN
   RAISE EXCEPTION 'Unsupported Elo v2 currency' USING ERRCODE='PT422';
 END IF;
 -- Read and freeze the official USD equivalence INSIDE this publication
 -- transaction. The server must have received the observation before start.
 v_buyin_usd:=sharkania_release.reserve_usd_elo_v2(p_tournament_id);

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
       *(1+pg_catalog.log(v_buyin_usd+1)*0.1)
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
     'algorithm_version','elo-v2-usd-normalized',
     'tournament_id',p_tournament_id,'league_id',v_league,
     'buy_in',v_buyin,'currency',v_currency,
     'buy_in_usd',v_buyin_usd,
     'results',v_canonical_payload)::text,'UTF8')),'hex');

 -- Append exactly one publication and one checkpoint per player BEFORE
 -- modifying results/ELO/stats. Later failures roll everything back.
 INSERT INTO sharkania_release.elo_publication(
   tournament_id,league_id,actor_profile_id,algorithm_version,input_fingerprint
 ) VALUES (
   p_tournament_id,v_league,(SELECT auth.uid()),
   'elo-v2-usd-normalized',v_input_fingerprint
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
   -- Legacy monetary totals are NOT allowed to mix CLP/EUR with USD.
   total_prize_won=p.total_prize_won+
     (CASE WHEN v_currency='USD' THEN x.prize_won+x.bounties_won ELSE 0 END),
   total_buy_ins_spent=p.total_buy_ins_spent+
     (CASE WHEN v_currency='USD' THEN v_buyin ELSE 0 END)
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
REVOKE EXECUTE ON FUNCTION sharkania_release.publish_results_initial_v2(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
-- Private server-only: absolutely NO EXECUTE for API roles.


CREATE OR REPLACE FUNCTION public.publish_league_nickname_results_v2_guarded(
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
  IF v_currency NOT IN ('USD','CLP','EUR') THEN
    RAISE EXCEPTION 'Unsupported league currency' USING ERRCODE='PT422'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_results) AS item(value)
    WHERE pg_catalog.jsonb_typeof(item.value)<>'object'
      OR pg_catalog.jsonb_typeof(item.value->'nickname')<>'string'
      OR item.value ? 'player_id'
      OR item.value ? 'fx_rate'
      OR item.value ? 'buy_in_usd'
      OR item.value ? 'currency'
      OR item.value ? 'algorithm_version'
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
  v_result := sharkania_release.publish_results_initial_v2(
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
    'currency_postings',v_postings,'normalized_nicknames',true,
    'algorithm_version','elo-v2-usd-normalized',
    'buy_in_usd',(SELECT fx.buy_in_usd FROM sharkania_release.elo_v2_event_fx fx
                  WHERE fx.tournament_id=p_tournament_id)
  );
END;
$guarded$;
REVOKE EXECUTE ON FUNCTION public.publish_league_nickname_results_v2_guarded(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_league_nickname_results_v2_guarded(uuid,jsonb)
  TO authenticated;


-- Independent v2 transactional nickname writer.
CREATE FUNCTION public.publish_independent_nickname_results_v2_guarded(
 p_tournament_id uuid,p_results jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $nonleague$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_club uuid;
 v_league uuid;
 v_room uuid;
 v_country text;
 v_buyin numeric;
 v_buyin_usd numeric;
 v_currency text;
 v_date timestamptz;
 v_uploaded boolean;
 v_status text;
 v_n int;
 v_invalid int;
 v_distinct_nick int;
 v_distinct_pos int;
 v_pos_min int;
 v_pos_max int;
 v_new int;
 v_found int;
 v_invalid_room int;
 v_ids uuid[];
 v_sum numeric;
 v_weight numeric;
 v_calculated jsonb;
 v_fingerprint text;
 v_pub uuid;
 v_count int;
 v_profile_count int;
 v_nickname text;
BEGIN
 IF v_actor IS NULL THEN
  RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_tournament_id IS NULL OR p_results IS NULL
 OR pg_catalog.jsonb_typeof(p_results)<>'array'
 OR pg_catalog.jsonb_array_length(p_results) NOT BETWEEN 2 AND 1000
 THEN RAISE EXCEPTION 'Expected 2 to 1000 results' USING ERRCODE='PT422'; END IF;

 -- Same lock order as Release A: tournament FIRST, players in UUID order.
 SELECT t.club_id,t.league_id,t.room_id,t.buy_in,t.currency,
        t.start_datetime,t.results_uploaded,t.status::text,c.country_code
 INTO v_club,v_league,v_room,v_buyin,v_currency,v_date,
      v_uploaded,v_status,v_country
 FROM public.tournaments t
 LEFT JOIN public.clubs c ON c.id=t.club_id
 WHERE t.id=p_tournament_id FOR UPDATE OF t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found' USING ERRCODE='PT404'; END IF;
 IF v_league IS NOT NULL THEN
  RAISE EXCEPTION 'League tournaments must use league writer' USING ERRCODE='PT422'; END IF;
 IF NOT ((SELECT public.is_super_admin()) OR (SELECT public.is_club_admin(v_club))) THEN
  RAISE EXCEPTION 'Only organizer or super admin may publish'
    USING ERRCODE='42501'; END IF;
 IF v_currency NOT IN ('USD','CLP','EUR') THEN
  RAISE EXCEPTION 'Unsupported independent tournament currency'
    USING ERRCODE='PT422'; END IF;
 IF v_status='cancelled' OR v_uploaded IS TRUE
    OR EXISTS(SELECT 1 FROM public.tournament_results r WHERE r.tournament_id=p_tournament_id)
    OR EXISTS(SELECT 1 FROM public.elo_history h WHERE h.tournament_id=p_tournament_id)
    OR EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication j
              WHERE j.tournament_id=p_tournament_id)
 THEN
  RAISE EXCEPTION 'Already processed or existing historical results: replay prohibited'
    USING ERRCODE='PT409'; END IF;
 IF v_buyin IS NULL OR v_buyin<0 OR v_buyin>100000000 THEN
  RAISE EXCEPTION 'Unsupported buy-in' USING ERRCODE='PT422'; END IF;
 v_buyin_usd:=sharkania_release.reserve_usd_elo_v2(p_tournament_id);

 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_results) AS e(value)
  WHERE pg_catalog.jsonb_typeof(e.value)<>'object'
   OR pg_catalog.jsonb_typeof(e.value->'nickname')<>'string'
   OR e.value ? 'player_id'
   OR e.value ? 'profile_id'
   OR e.value ? 'elo_rating'
   OR e.value ? 'elo_before'
   OR e.value ? 'elo_after'
   OR e.value ? 'actor_id'
   OR e.value ? 'currency'
   OR e.value ? 'fx_rate'
   OR e.value ? 'buy_in_usd'
   OR e.value ? 'algorithm_version'
 ) THEN RAISE EXCEPTION 'Untrusted field or missing nickname' USING ERRCODE='PT422'; END IF;
 WITH input AS (
  SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
   AS x(nickname text,position integer,prize_won numeric,bounties_won numeric,
        league_points_earned numeric,ccp_club text,buy_ins_count numeric)
 )
 SELECT count(*)::int,count(DISTINCT pg_catalog.lower(pg_catalog.btrim(nickname)))::int,
   count(DISTINCT position)::int,min(position),max(position),
   count(*) FILTER (WHERE nickname IS NULL
     OR length(pg_catalog.btrim(nickname)) NOT BETWEEN 1 AND 80
     OR position IS NULL OR position<1
     OR prize_won IS NULL OR prize_won<0 OR prize_won>100000000
     OR prize_won::text IN ('NaN','Infinity','-Infinity')
     OR bounties_won IS NULL OR bounties_won<0 OR bounties_won>100000000
     OR bounties_won::text IN ('NaN','Infinity','-Infinity')
     OR buy_ins_count IS NULL OR buy_ins_count NOT BETWEEN 1 AND 100
     OR buy_ins_count<>pg_catalog.trunc(buy_ins_count)
     OR length(coalesce(ccp_club,''))>120
     OR coalesce(league_points_earned,0)<>0
   )::int
 INTO v_n,v_distinct_nick,v_distinct_pos,v_pos_min,v_pos_max,v_invalid
 FROM input;
 IF v_invalid<>0 OR v_n<>v_distinct_nick OR v_n<>v_distinct_pos
 OR v_pos_min<>1 OR v_pos_max<>v_n THEN
  RAISE EXCEPTION 'Invalid nickname/position/prize/entries or league points'
    USING ERRCODE='PT422'; END IF;

 -- Serialize a nickname within its poker room, ensuring case-folded uniqueness.
 FOR v_nickname IN
  SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(x.nickname)) AS normalized
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
  ORDER BY normalized
 LOOP
  PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('league-player:'||v_room::text||':'||v_nickname,0));
 END LOOP;

 INSERT INTO public.players(nickname,room_id,country_code,elo_rating,elo_peak)
 SELECT pg_catalog.btrim(x.nickname),v_room,v_country,1200,1200
 FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
 WHERE NOT EXISTS(
  SELECT 1 FROM public.players p WHERE p.room_id=v_room
    AND pg_catalog.lower(pg_catalog.btrim(p.nickname))=
      pg_catalog.lower(pg_catalog.btrim(x.nickname)))
 ORDER BY pg_catalog.lower(pg_catalog.btrim(x.nickname))
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_new=ROW_COUNT;

 -- We resolve IDs exclusively from database state; clients provide nicknames.
 WITH input AS (
  SELECT x.*,p.id AS player_id,p.room_id
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(
    nickname text,position integer,prize_won numeric,bounties_won numeric,
    buy_ins_count numeric)
  JOIN public.players p ON p.room_id=v_room AND
   pg_catalog.lower(pg_catalog.btrim(p.nickname))=
     pg_catalog.lower(pg_catalog.btrim(x.nickname))
 )
 SELECT count(*)::int,count(*) FILTER(WHERE room_id IS DISTINCT FROM v_room)::int,
        array_agg(player_id ORDER BY player_id)
 INTO v_found,v_invalid_room,v_ids
 FROM input;
 IF v_found<>v_n OR v_invalid_room<>0 OR
  (SELECT count(DISTINCT x) FROM unnest(v_ids) AS x)<>v_n THEN
  RAISE EXCEPTION 'Ambiguous or incomplete room nickname resolution' USING ERRCODE='PT409';
 END IF;

 -- Deterministic lock order for concurrent tournaments with shared players.
 SELECT count(*) INTO v_found FROM (
  SELECT p.id FROM public.players p
  WHERE p.id=ANY(v_ids) ORDER BY p.id FOR UPDATE
 ) locked_players;
 IF v_found<>v_n THEN RAISE EXCEPTION 'Missing locked players' USING ERRCODE='PT409'; END IF;

 -- Forbid retroactive publication if ANY affected player has a later (or
 -- same-time different) result, even if legacy Elo history is missing.
 IF EXISTS(
   SELECT 1 FROM public.tournament_results r
   JOIN public.tournaments t ON t.id=r.tournament_id
   WHERE r.player_id=ANY(v_ids) AND t.id<>p_tournament_id
    AND t.start_datetime>=v_date
 ) THEN RAISE EXCEPTION 'Later or ambiguous-time results exist for a player'
   USING ERRCODE='PT409'; END IF;

 SELECT pg_catalog.sum(p.elo_rating) INTO v_sum
 FROM public.players p WHERE p.id=ANY(v_ids);
 IF v_sum IS NULL OR v_sum<100*v_n OR v_sum>100000000*v_n
 THEN RAISE EXCEPTION 'Player Elo baseline is outside guardrail' USING ERRCODE='PT409'; END IF;
 v_weight:=(v_sum/v_n)/1200;

 -- Exact Release A algorithm legacy-js-v1: same set-snapshot, K, weight,
 -- expected and min-100 clipping. NO new formula or currency conversion.
 WITH entries AS (
  SELECT p.id AS player_id,p.elo_rating AS elo_before,p.total_tournaments,
         x.position,x.prize_won,x.bounties_won,x.buy_ins_count
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(
    nickname text,position integer,prize_won numeric,
    bounties_won numeric,buy_ins_count numeric)
  JOIN public.players p ON p.room_id=v_room AND
    pg_catalog.lower(pg_catalog.btrim(p.nickname))=
    pg_catalog.lower(pg_catalog.btrim(x.nickname))
 ), factors AS (
  SELECT e.*,(v_n-e.position)::numeric/(v_n-1) AS score,
   1/(1+pg_catalog.power(10::numeric,((v_sum-e.elo_before)/(v_n-1)-e.elo_before)/400))
     AS expected,
   (CASE WHEN e.total_tournaments<30 THEN 40 ELSE 20 END)
   *(1+pg_catalog.log(v_buyin_usd+1)*0.1)
   *(1+pg_catalog.log(v_n::numeric)*0.15) AS k
  FROM entries e
 ), computed AS (
  SELECT f.*,f.k*v_weight*(f.score-f.expected) AS raw_change FROM factors f
 )
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'player_id',x.player_id,'position',x.position,
   'prize_won',x.prize_won,'bounties_won',x.bounties_won,
   'buy_ins_count',x.buy_ins_count,
   'elo_before',x.elo_before,
   'elo_after',pg_catalog.round(GREATEST(100::numeric,x.elo_before+x.raw_change),2),
   'elo_change',pg_catalog.round(x.raw_change,2)
 ) ORDER BY x.position),'[]'::jsonb) INTO v_calculated FROM computed x;
 IF pg_catalog.jsonb_array_length(v_calculated)<>v_n
 THEN RAISE EXCEPTION 'Elo computation failed' USING ERRCODE='PT409'; END IF;

 -- Append private immutable audit BEFORE the updates, in the same transaction.
 SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  pg_catalog.jsonb_build_object('algorithm_version','elo-v2-usd-normalized',
   'tournament_id',p_tournament_id,'room_id',v_room,
   'buy_in',v_buyin,'buy_in_usd',v_buyin_usd,
   'currency',v_currency,'results',p_results)::text,'UTF8')),'hex')
 INTO v_fingerprint;
 INSERT INTO sharkania_release.independent_elo_publication(
   tournament_id,actor_profile_id,algorithm_version,input_fingerprint
 ) VALUES(p_tournament_id,v_actor,'elo-v2-usd-normalized',v_fingerprint)
 RETURNING id INTO v_pub;

 INSERT INTO sharkania_release.independent_elo_checkpoint(
  publication_id,player_id,elo_before,elo_after,elo_peak_before,
  tournaments_before,cashes_before,wins_before,prize_won_before,
  buy_ins_before,elo_change
 )
 SELECT v_pub,p.id,p.elo_rating,x.elo_after,p.elo_peak,
  p.total_tournaments,p.total_cashes,p.total_wins,
  p.total_prize_won,p.total_buy_ins_spent,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,elo_after numeric,elo_change numeric)
 JOIN public.players p ON p.id=x.player_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete Elo checkpoints' USING ERRCODE='PT409'; END IF;

 INSERT INTO public.tournament_results(
  tournament_id,player_id,position,prize_won,bounties_won,
  league_points_earned,ccp_club,buy_ins_count,elo_before,elo_after,elo_change
 )
 SELECT p_tournament_id,x.player_id,x.position,x.prize_won,x.bounties_won,
  0,NULL,x.buy_ins_count,x.elo_before,x.elo_after,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,position integer,prize_won numeric,bounties_won numeric,
  buy_ins_count numeric,elo_before numeric,elo_after numeric,elo_change numeric);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete results' USING ERRCODE='PT409'; END IF;

 INSERT INTO public.elo_history(
  tournament_id,player_id,elo_before,elo_after,elo_change
 )
 SELECT p_tournament_id,x.player_id,x.elo_before,x.elo_after,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,elo_before numeric,elo_after numeric,elo_change numeric);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete Elo history' USING ERRCODE='PT409'; END IF;

 -- Currency ledger stores actual #reentries; old player totals must continue
 -- to add buy-in ONCE per tournament, matching the legacy-js-v1 behavior.
 INSERT INTO sharkania_release.independent_currency_posting(
  publication_id,tournament_id,player_id,currency,buy_in_per_entry,
  buy_ins_count,prize_won,bounties_won
 )
 SELECT v_pub,p_tournament_id,x.player_id,v_currency,v_buyin,
  x.buy_ins_count,x.prize_won,x.bounties_won
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,buy_ins_count integer,prize_won numeric,bounties_won numeric);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete currency journal' USING ERRCODE='PT409'; END IF;

 UPDATE public.players p SET elo_rating=x.elo_after,
  elo_peak=GREATEST(p.elo_peak,x.elo_after),
  total_tournaments=p.total_tournaments+1,
  total_cashes=p.total_cashes+
   (CASE WHEN x.prize_won+x.bounties_won>0 THEN 1 ELSE 0 END),
  total_wins=p.total_wins+(CASE WHEN x.position=1 THEN 1 ELSE 0 END),
  -- Native-currency prizes go to the per-currency immutable journal.
  total_prize_won=p.total_prize_won+
    (CASE WHEN v_currency='USD' THEN x.prize_won+x.bounties_won ELSE 0 END),
  total_buy_ins_spent=p.total_buy_ins_spent+
    (CASE WHEN v_currency='USD' THEN v_buyin ELSE 0 END)
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,position integer,prize_won numeric,
  bounties_won numeric,elo_after numeric)
 WHERE p.id=x.player_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete player updates' USING ERRCODE='PT409'; END IF;

 -- Profile Elo materialization is server-owned; preserve Release A formula.
 PERFORM u.id FROM public.profiles u
 WHERE u.id IN(
  SELECT DISTINCT p.profile_id FROM public.players p
  WHERE p.id=ANY(v_ids) AND p.profile_id IS NOT NULL
 ) ORDER BY u.id FOR UPDATE;
 WITH affected AS MATERIALIZED (
  SELECT DISTINCT p.profile_id FROM public.players p
  WHERE p.id=ANY(v_ids) AND p.profile_id IS NOT NULL
 ), aliases AS (
  SELECT p.profile_id,count(*)::int AS alias_count,
         max(p.elo_rating) AS single_alias_elo
  FROM public.players p JOIN affected a ON a.profile_id=p.profile_id
  GROUP BY p.profile_id
 ), histories AS (
  SELECT p.profile_id,coalesce(sum(h.elo_change),0) AS total_change,
    (array_agg(h.elo_after ORDER BY h.recorded_at DESC,h.id DESC)
      FILTER (WHERE h.id IS NOT NULL))[1] AS latest_elo
  FROM public.players p JOIN affected a ON a.profile_id=p.profile_id
  LEFT JOIN public.elo_history h ON h.player_id=p.id
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

 UPDATE public.tournaments
  SET results_uploaded=true,status='completed'
 WHERE id=p_tournament_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'Tournament completion missing' USING ERRCODE='PT409'; END IF;

 RETURN pg_catalog.jsonb_build_object(
  'status','published','tournament_id',p_tournament_id,
  'currency',v_currency,'buy_in_usd',v_buyin_usd,
  'algorithm_version','elo-v2-usd-normalized','players',v_n,'new_players',v_new,
  'currency_postings',v_n,'atomic',true,'audit_recorded',true);
END;
$nonleague$;

-- Avoid default PUBLIC EXECUTE on SECURITY DEFINER. Only authenticated can
-- invoke via PostgREST. Actual authorization is also verified in the body.
REVOKE ALL ON FUNCTION public.publish_independent_nickname_results_v2_guarded(uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_independent_nickname_results_v2_guarded(uuid,jsonb)
 TO authenticated;



DO $post$
BEGIN
 IF has_function_privilege('anon',
  'public.publish_league_nickname_results_v2_guarded(uuid,jsonb)','EXECUTE')
 OR has_function_privilege('anon',
  'public.publish_independent_nickname_results_v2_guarded(uuid,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
  'public.publish_league_nickname_results_v2_guarded(uuid,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
  'public.publish_independent_nickname_results_v2_guarded(uuid,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated',
  'sharkania_release.publish_results_initial_v2(uuid,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'V2 results API privilege regression' USING ERRCODE='PT409'; END IF;
END;$post$;
-- ######## END SECTION 3/3 ########
COMMIT;
