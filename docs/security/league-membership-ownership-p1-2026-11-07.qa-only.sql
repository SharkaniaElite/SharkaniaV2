-- SHARKANIA P1 · QA-ONLY league ownership/membership RLS proposal.
-- NOT A PRODUCTION MIGRATION; DO NOT APPLY WITHOUT NEW USER APPROVAL.
-- Stacked on PR #79 whose P0 unique primary index is already live in
-- Supabase production. PostgreSQL tests apply this inside BEGIN/ROLLBACK.
-- This is an interim compatibility fix; PR #65 replaces multistep
-- league creation with a single guarded RPC and disables direct DML.

DO $preflight$
DECLARE n integer;
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class
     WHERE oid='public.league_clubs'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_class
     WHERE oid='public.leagues'::regclass) THEN
  RAISE EXCEPTION 'STOP: league RLS disabled' USING ERRCODE='PT409';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname='public'
   AND tablename='league_clubs'
   AND indexname='league_clubs_one_primary_per_league_guarded'
   AND indexdef ILIKE '%UNIQUE%'
   AND indexdef ILIKE '%WHERE (is_primary IS TRUE)%'
 ) THEN
  RAISE EXCEPTION 'STOP: P0 unique primary index missing' USING ERRCODE='PT409';
 END IF;
 SELECT count(*) INTO n FROM pg_policies
 WHERE schemaname='public' AND (
  tablename='league_clubs' AND policyname IN (
    'League clubs: admin insert','League clubs: admin update',
    'League clubs: admin delete')
  OR tablename='leagues' AND policyname IN (
    'Leagues: admin puede crear','Leagues: admin o super editar',
    'Leagues: admin o super eliminar'));
 IF n<>6 THEN
  RAISE EXCEPTION 'STOP: old league membership/ownership policies have changed'
   USING ERRCODE='PT409';
 END IF;
 IF EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND (
   (tablename='league_clubs' AND cmd IN ('INSERT','UPDATE','DELETE')
     AND policyname NOT IN ('League clubs: admin insert',
       'League clubs: admin update','League clubs: admin delete'))
   OR
   (tablename='leagues' AND cmd IN ('INSERT','UPDATE','DELETE')
     AND policyname NOT IN ('Leagues: admin puede crear',
       'Leagues: admin o super editar','Leagues: admin o super eliminar'))
  )
 ) THEN
  RAISE EXCEPTION 'STOP: unreviewed league write policy exists'
   USING ERRCODE='PT409';
 END IF;
END;
$preflight$;

-- Critical: all old broad policies must be removed, not supplemented.
-- Existing read policies remain untouched; no extra index is added.
DROP POLICY "League clubs: admin insert" ON public.league_clubs;
DROP POLICY "League clubs: admin update" ON public.league_clubs;
DROP POLICY "League clubs: admin delete" ON public.league_clubs;
DROP POLICY "Leagues: admin puede crear" ON public.leagues;
DROP POLICY "Leagues: admin o super editar" ON public.leagues;
DROP POLICY "Leagues: admin o super eliminar" ON public.leagues;

-- For existing frontend: creating a new league still inserts the leagues
-- row first and its primary club link second. Only recognized club admins
-- and superadmins may initiate that flow. A two-request creation CAN leave
-- a temporary orphan and must be replaced by PR #65's atomic RPC.
CREATE POLICY leagues_admin_create_p1
 ON public.leagues FOR INSERT TO authenticated
 WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
   (SELECT public.is_super_admin())
   OR EXISTS(
    SELECT 1 FROM public.club_admins ca
    WHERE ca.user_id=(SELECT auth.uid())
   )
  )
 );

-- Only the primary club's admin may edit/delete league metadata.
-- Secondary club membership can no longer authorize editing a foreign
-- league. Generate the allowed league-id set against a small table instead
-- of checking a club-admin RPC for every league row.
CREATE POLICY leagues_primary_update_p1
 ON public.leagues FOR UPDATE TO authenticated
 USING (
  (SELECT auth.uid()) IS NOT NULL
  AND ((SELECT public.is_super_admin()) OR id IN (
   SELECT lc.league_id FROM public.league_clubs lc
   WHERE lc.is_primary IS TRUE GROUP BY lc.league_id
   HAVING count(*)=1 AND bool_or(public.is_club_admin(lc.club_id))
  ))
 )
 WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND ((SELECT public.is_super_admin()) OR id IN (
   SELECT lc.league_id FROM public.league_clubs lc
   WHERE lc.is_primary IS TRUE GROUP BY lc.league_id
   HAVING count(*)=1 AND bool_or(public.is_club_admin(lc.club_id))
  ))
 );

CREATE POLICY leagues_primary_delete_p1
 ON public.leagues FOR DELETE TO authenticated
 USING (
  (SELECT auth.uid()) IS NOT NULL
  AND ((SELECT public.is_super_admin()) OR id IN (
   SELECT lc.league_id FROM public.league_clubs lc
   WHERE lc.is_primary IS TRUE GROUP BY lc.league_id
   HAVING count(*)=1 AND bool_or(public.is_club_admin(lc.club_id))
  ))
 );

-- Existing direct primary-club insertion remains allowed for the web form.
-- Secondary additions are superadmin-only until the guarded two-party
-- approval RPC in PR #65 is deployed.
CREATE POLICY league_clubs_primary_insert_p1
 ON public.league_clubs FOR INSERT TO authenticated
 WITH CHECK (
  (SELECT auth.uid()) IS NOT NULL
  AND (
   (SELECT public.is_super_admin())
   OR (is_primary IS TRUE AND public.is_club_admin(club_id))
  )
 );

-- Direct reassignment of league_id / club_id / is_primary and deletion of
-- primary/secondary membership are restricted to superadmins for now.
-- They cannot remove an existing primary silently through a client role.
-- A superadmin could still leave a league without primary; PR #65 needs
-- atomic transfer/approval before fully closing that administrative path.
CREATE POLICY league_clubs_super_update_p1
 ON public.league_clubs FOR UPDATE TO authenticated
 USING ((SELECT auth.uid()) IS NOT NULL AND
        (SELECT public.is_super_admin()))
 WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND
             (SELECT public.is_super_admin()));

CREATE POLICY league_clubs_super_delete_p1
 ON public.league_clubs FOR DELETE TO authenticated
 USING ((SELECT auth.uid()) IS NOT NULL AND
        (SELECT public.is_super_admin()));
