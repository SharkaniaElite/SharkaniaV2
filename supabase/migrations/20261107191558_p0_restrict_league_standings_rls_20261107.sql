BEGIN;
SET LOCAL lock_timeout='2000ms';
SET LOCAL statement_timeout='15000ms';
DO $precheck$
DECLARE invalid bigint; cnt bigint; n bigint;
BEGIN
 IF (SELECT NOT relrowsecurity FROM pg_class WHERE oid='public.league_standings'::regclass) THEN
   RAISE EXCEPTION 'STOP: standings RLS disabled';
 END IF;
 SELECT count(*) INTO invalid FROM (
   SELECT l.id FROM public.leagues l LEFT JOIN public.league_clubs lc ON lc.league_id=l.id
   GROUP BY l.id HAVING count(lc.club_id) FILTER (WHERE lc.is_primary IS TRUE)<>1
 ) q;
 IF invalid<>0 THEN RAISE EXCEPTION 'STOP: ambiguous or absent league primary'; END IF;
 SELECT count(*) INTO cnt FROM public.league_standings;
 IF cnt<>5789 THEN RAISE EXCEPTION 'STOP: standings row count changed; review again'; END IF;
 SELECT count(*) INTO n FROM public.league_clubs;
 IF n<>41 THEN RAISE EXCEPTION 'STOP: league membership changed; review again'; END IF;
 IF EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND
   indexname='league_clubs_one_primary_per_league_guarded') THEN
   RAISE EXCEPTION 'STOP: index preexists, review its exact definition'; END IF;
END $precheck$;

DO $audit$
DECLARE v_expected integer;
BEGIN
 SELECT count(*) INTO v_expected FROM pg_catalog.pg_policies
 WHERE schemaname='public' AND tablename='league_standings'
   AND policyname IN (
     'Permitir actualizar a usuarios autenticados',
     'Permitir eliminar a usuarios autenticados',
     'Permitir insertar a usuarios autenticados');
 IF v_expected<>3 THEN
  RAISE EXCEPTION 'STOP: legacy standings policy landscape changed'
   USING ERRCODE='PT409';
 END IF;
 IF EXISTS (
  SELECT 1 FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='league_standings'
    AND cmd IN ('INSERT','UPDATE','DELETE')
    AND policyname NOT IN (
      'Permitir actualizar a usuarios autenticados',
      'Permitir eliminar a usuarios autenticados',
      'Permitir insertar a usuarios autenticados',
      'Standings: super admin insert',
      'Standings: super admin update',
      'Standings: super admin delete')
 ) THEN
  RAISE EXCEPTION 'STOP: unreviewed standings write policy detected'
   USING ERRCODE='PT409';
 END IF;
END;
$audit$;

CREATE UNIQUE INDEX IF NOT EXISTS league_clubs_one_primary_per_league_guarded
 ON public.league_clubs(league_id) WHERE is_primary IS TRUE;

DROP POLICY IF EXISTS "Permitir actualizar a usuarios autenticados"
 ON public.league_standings;
DROP POLICY IF EXISTS "Permitir eliminar a usuarios autenticados"
 ON public.league_standings;
DROP POLICY IF EXISTS "Permitir insertar a usuarios autenticados"
 ON public.league_standings;

DROP POLICY IF EXISTS standings_primary_guarded_insert_p0
 ON public.league_standings;
CREATE POLICY standings_primary_guarded_insert_p0
 ON public.league_standings FOR INSERT TO authenticated
 WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
   (SELECT public.is_super_admin())
   OR league_standings.league_id IN (
    -- Independent primary-club authorization set is built once per
    -- statement when PostgreSQL chooses a hashed SubPlan. Do not evaluate
    -- is_club_admin() once per standings row.
    SELECT lc.league_id FROM public.league_clubs lc
    WHERE lc.is_primary IS TRUE
    GROUP BY lc.league_id
    HAVING count(*)=1
       AND pg_catalog.bool_or(public.is_club_admin(lc.club_id))
   )
  )
 );

DROP POLICY IF EXISTS standings_primary_guarded_update_p0
 ON public.league_standings;
CREATE POLICY standings_primary_guarded_update_p0
 ON public.league_standings FOR UPDATE TO authenticated
 USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
   (SELECT public.is_super_admin())
   OR league_standings.league_id IN (
    -- Independent primary-club authorization set is built once per
    -- statement when PostgreSQL chooses a hashed SubPlan. Do not evaluate
    -- is_club_admin() once per standings row.
    SELECT lc.league_id FROM public.league_clubs lc
    WHERE lc.is_primary IS TRUE
    GROUP BY lc.league_id
    HAVING count(*)=1
       AND pg_catalog.bool_or(public.is_club_admin(lc.club_id))
   )
  )
 )
 WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
   (SELECT public.is_super_admin())
   OR league_standings.league_id IN (
    -- Independent primary-club authorization set is built once per
    -- statement when PostgreSQL chooses a hashed SubPlan. Do not evaluate
    -- is_club_admin() once per standings row.
    SELECT lc.league_id FROM public.league_clubs lc
    WHERE lc.is_primary IS TRUE
    GROUP BY lc.league_id
    HAVING count(*)=1
       AND pg_catalog.bool_or(public.is_club_admin(lc.club_id))
   )
  )
 );

DROP POLICY IF EXISTS standings_primary_guarded_delete_p0
 ON public.league_standings;
CREATE POLICY standings_primary_guarded_delete_p0
 ON public.league_standings FOR DELETE TO authenticated
 USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
   (SELECT public.is_super_admin())
   OR league_standings.league_id IN (
    -- Independent primary-club authorization set is built once per
    -- statement when PostgreSQL chooses a hashed SubPlan. Do not evaluate
    -- is_club_admin() once per standings row.
    SELECT lc.league_id FROM public.league_clubs lc
    WHERE lc.is_primary IS TRUE
    GROUP BY lc.league_id
    HAVING count(*)=1
       AND pg_catalog.bool_or(public.is_club_admin(lc.club_id))
   )
  )
 );


DO $postcheck$
DECLARE old_n integer;new_n integer; idx_n integer; count_n integer; rls_ok boolean;
BEGIN
 SELECT count(*) INTO old_n FROM pg_policies WHERE schemaname='public'
  AND tablename='league_standings' AND policyname IN (
   'Permitir actualizar a usuarios autenticados',
   'Permitir eliminar a usuarios autenticados',
   'Permitir insertar a usuarios autenticados');
 IF old_n<>0 THEN RAISE EXCEPTION 'STOP: old wide standings policies still exist'; END IF;
 SELECT count(*) INTO new_n FROM pg_policies WHERE schemaname='public'
  AND tablename='league_standings' AND policyname IN (
   'standings_primary_guarded_insert_p0',
   'standings_primary_guarded_update_p0',
   'standings_primary_guarded_delete_p0')
  AND roles::text LIKE '%authenticated%';
 IF new_n<>3 THEN RAISE EXCEPTION 'STOP: new restricted policies incomplete'; END IF;
 SELECT count(*) INTO idx_n FROM pg_indexes WHERE schemaname='public'
  AND tablename='league_clubs'
  AND indexname='league_clubs_one_primary_per_league_guarded'
  AND indexdef ILIKE '%UNIQUE INDEX%'
  AND indexdef ILIKE '%WHERE (is_primary IS TRUE)%';
 IF idx_n<>1 THEN RAISE EXCEPTION 'STOP: primary uniqueness invariant missing'; END IF;
 SELECT count(*) INTO count_n FROM public.league_standings;
 IF count_n<>5789 THEN RAISE EXCEPTION 'STOP: standings count changed by DDL'; END IF;
 SELECT relrowsecurity INTO rls_ok FROM pg_class WHERE oid='public.league_standings'::regclass;
 IF rls_ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'STOP: RLS unexpectedly disabled'; END IF;
END $postcheck$;
COMMIT;