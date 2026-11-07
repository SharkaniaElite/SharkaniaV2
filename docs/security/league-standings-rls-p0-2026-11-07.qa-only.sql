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
   OR EXISTS (
    SELECT 1 FROM public.league_clubs lc
    WHERE lc.league_id=league_standings.league_id
      AND lc.is_primary IS TRUE
      AND (SELECT public.is_club_admin(lc.club_id))
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
   OR EXISTS (
    SELECT 1 FROM public.league_clubs lc
    WHERE lc.league_id=league_standings.league_id
      AND lc.is_primary IS TRUE
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
    WHERE lc.league_id=league_standings.league_id
      AND lc.is_primary IS TRUE
      AND (SELECT public.is_club_admin(lc.club_id))
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
   OR EXISTS (
    SELECT 1 FROM public.league_clubs lc
    WHERE lc.league_id=league_standings.league_id
      AND lc.is_primary IS TRUE
      AND (SELECT public.is_club_admin(lc.club_id))
   )
  )
 );
