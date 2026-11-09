\set ON_ERROR_STOP on
-- QA-only reproduction of live tournaments ownership RLS:
-- a participant club admin can move OWN tournament into organizer A league by league_id.
-- Requires prior synthetic 64-table league fixture + guarded league membership SQL.
-- This is a ROLLBACK diagnostic, NOT a production migration nor a fix.
BEGIN;
GRANT SELECT,UPDATE ON TABLE public.tournaments TO authenticated;
CREATE POLICY qa_tournament_public_select ON public.tournaments
 FOR SELECT USING (true);
CREATE POLICY qa_tournament_club_owner_update ON public.tournaments
 FOR UPDATE TO authenticated
 USING ((SELECT public.is_super_admin()) OR (SELECT public.is_club_admin(club_id)))
 WITH CHECK ((SELECT public.is_super_admin()) OR (SELECT public.is_club_admin(club_id)));
-- Synthetic club B admin 005 owns tournament 012, club A is sole primary
-- organizer of league 041. Club B is only a secondary participant (not owner).
DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM public.league_clubs
  WHERE league_id='00000000-0000-0000-0000-000000000041'
    AND club_id='00000000-0000-0000-0000-000000000022' AND is_primary)
 THEN RAISE EXCEPTION 'STOP: fixture unexpectedly sets club B as primary organizer'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tournaments
  WHERE id='00000000-0000-0000-0000-000000000012'
    AND club_id='00000000-0000-0000-0000-000000000022'
    AND league_id IS NULL)
 THEN RAISE EXCEPTION 'STOP: synthetic tournament B is not unlinked'; END IF;
END $qa$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
UPDATE public.tournaments SET league_id='00000000-0000-0000-0000-000000000041'
 WHERE id='00000000-0000-0000-0000-000000000012';
DO $qa$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.tournaments
 WHERE id='00000000-0000-0000-0000-000000000012'
   AND league_id='00000000-0000-0000-0000-000000000041')
 THEN RAISE EXCEPTION 'STOP: expected current-policy link bypass not reproduced'; END IF;
 RAISE NOTICE 'QA FINDING: admin B linked B-owned tournament to league A while only a secondary participant under current tournament owner-only policy';
END $qa$;
ROLLBACK;
DO $qa$
BEGIN
 IF EXISTS (SELECT 1 FROM public.tournaments
 WHERE id='00000000-0000-0000-0000-000000000012'
   AND league_id='00000000-0000-0000-0000-000000000041')
 THEN RAISE EXCEPTION 'FAIL: reproduction did not roll back'; END IF;
 RAISE NOTICE 'PASS: secondary participant linked tournament to organizer league and fully rolled back in isolated QA';
END $qa$;
