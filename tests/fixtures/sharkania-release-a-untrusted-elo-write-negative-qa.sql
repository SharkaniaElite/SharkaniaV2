\set ON_ERROR_STOP on
-- SHARKANIA RELEASE A / NEGATIVE SECURITY TEST - PostgreSQL 17 DISPOSABLE ONLY
-- Reproduce the production-like legacy permissions that remain outside the
-- consolidated Release A writer. This is EVIDENCE OF A NO-GO, not a fix.
-- Use ONLY the self-contained GitHub Actions postgres:17 synthetic database.
-- No credentials, external hosts, real accounts or production data.
--
-- The test intentionally demonstrates that a user owning a player row may
-- change Elo and prize totals, and any authenticated JWT can insert a
-- non-league Elo ledger row. Roll back EVERY test change.
BEGIN;

-- Minimal parity with live observed RLS and grants. The fixture intentionally
-- keeps no other permanent changes. A SELECT policy is required for UPDATE.
GRANT SELECT, UPDATE ON public.players TO authenticated;
GRANT SELECT, INSERT ON public.elo_history TO authenticated;
GRANT SELECT ON public.tournaments TO authenticated;

CREATE POLICY qa_legacy_players_read_all
  ON public.players FOR SELECT TO authenticated USING (true);
CREATE POLICY qa_legacy_players_owner_update
  ON public.players FOR UPDATE TO authenticated
  USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (profile_id = (SELECT auth.uid()));
CREATE POLICY qa_legacy_elo_history_authenticated_insert
  ON public.elo_history FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY qa_legacy_tournaments_read_all
  ON public.tournaments FOR SELECT TO authenticated USING (true);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000061';

DO $qa$
DECLARE v_count integer;
BEGIN
  -- This fake JWT user owns player ...051 in the existing synthetic fixture.
  UPDATE public.players
  SET elo_rating=4321, elo_peak=4321, total_prize_won=98765
  WHERE id='00000000-0000-0000-0000-000000000051';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Unexpected QA baseline: direct Elo update was NOT reproduced (check fixture/policies)';
  END IF;

  -- Tournament ...012 has NO league. The Release A league-only trigger
  -- intentionally allows this, which means its ledger is client-writable.
  INSERT INTO public.elo_history
     (tournament_id,player_id,elo_before,elo_after,elo_change)
  VALUES
     ('00000000-0000-0000-0000-000000000012',
      '00000000-0000-0000-0000-000000000051',
      1200,4321,3121);
  RAISE WARNING 'RELEASE A NO GO: synthetic authenticated owner can update shared player Elo/finance and insert independent-tournament Elo';
END;
$qa$;

RESET ROLE;
DO $qa$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.players
   WHERE id='00000000-0000-0000-0000-000000000051'
     AND elo_rating=4321 AND total_prize_won=98765
 ) OR NOT EXISTS (
  SELECT 1 FROM public.elo_history
   WHERE tournament_id='00000000-0000-0000-0000-000000000012'
     AND player_id='00000000-0000-0000-0000-000000000051'
     AND elo_change=3121
 ) THEN
   RAISE EXCEPTION 'FAIL: expected QA evidence not reproduced';
 END IF;
 RAISE NOTICE 'REPRODUCED IN QA: current candidate still permits synthetic untrusted Elo mutation';
END;
$qa$;

-- Absolutely nothing persists. The workflow must NOT treat a reproduction
-- as a security PASS or as authorization to merge or apply Release A.
ROLLBACK;

DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM public.players
   WHERE id='00000000-0000-0000-0000-000000000051' AND elo_rating=4321)
 OR EXISTS(SELECT 1 FROM public.elo_history
   WHERE tournament_id='00000000-0000-0000-0000-000000000012'
     AND player_id='00000000-0000-0000-0000-000000000051'
     AND elo_change=3121)
 THEN
   RAISE EXCEPTION 'FAIL: synthetic Elo negative test contaminated QA baseline';
 END IF;
 RAISE NOTICE 'PASS: negative QA reproduction rolled back without persistent records';
END;
$qa$;
