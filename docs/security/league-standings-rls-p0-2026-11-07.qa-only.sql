-- P0 SHARKANIA — QA-only reviewable RLS POLICY PROPOSAL, Nov 7 2026.
-- NOT A MIGRATION. DO NOT EXECUTE ON PRODUCTION WITHOUT APPROVAL.
-- Requires public.is_super_admin(),public.is_club_admin(uuid),
-- public.league_clubs(league_id,club_id,is_primary),auth.uid().
-- Old policies are PERMISSIVE (OR): adding stricter policies without
-- DROPPING the three broad authenticated policies DOES NOT restrict access.
--
-- This is an EMERGENCY COMPATIBILITY PROPOSAL: existing primary club admins
-- retain standings DML while ordinary player accounts are excluded.
-- Long-term guarded RPC cutover should revoke direct DML entirely.
-- All SQL runs inside the caller's transaction in the isolated QA fixture.

-- Defense in depth against a legacy secondary club self-promoting to
-- primary via an unrelated permissive league_clubs policy. A league must not
-- acquire two primary clubs. Uses the same index name as PR #65 to avoid a
-- duplicate index (and its redundant disk/WAL costs) on future integration.
-- Compatibility and current unique-primary data were checked SELECT-only.
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
