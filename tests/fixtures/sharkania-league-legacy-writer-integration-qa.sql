\set ON_ERROR_STOP on
-- QA only: run AFTER the two-connection writer race has published 071/072/073.
-- The legacy delete fence must already be installed in the disposable DB.
-- This reproduces old reset, delete, ranking rebuild and CSV import write
-- order through SECURITY DEFINER call-order mocks; NOT the real RPC bodies.
BEGIN;
SET LOCAL statement_timeout='6s';
SET LOCAL lock_timeout='2s';
CREATE OR REPLACE FUNCTION public.qa_old_result_reset(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $old$
BEGIN
 DELETE FROM public.elo_history WHERE tournament_id=p_tournament_id;
 DELETE FROM public.tournament_results WHERE tournament_id=p_tournament_id;
END;
$old$;
CREATE OR REPLACE FUNCTION public.qa_old_result_delete(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $old$
BEGIN
 DELETE FROM public.elo_history WHERE tournament_id=p_tournament_id;
 DELETE FROM public.tournament_results WHERE tournament_id=p_tournament_id;
 DELETE FROM public.tournaments WHERE id=p_tournament_id;
END;
$old$;
CREATE OR REPLACE FUNCTION public.qa_old_standings_rebuild(p_league_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $old$
BEGIN
 DELETE FROM public.league_standings WHERE league_id=p_league_id;
END;
$old$;
CREATE OR REPLACE FUNCTION public.qa_old_csv_result_insert(p_tournament_id uuid,p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $old$
BEGIN
 INSERT INTO public.tournament_results(tournament_id,player_id,position,
   prize_won,league_points_earned)
 VALUES(p_tournament_id,p_player_id,1,10,8);
END;
$old$;
REVOKE ALL ON FUNCTION public.qa_old_result_reset(uuid),
 public.qa_old_result_delete(uuid),public.qa_old_standings_rebuild(uuid),
 public.qa_old_csv_result_insert(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qa_old_result_reset(uuid),
 public.qa_old_result_delete(uuid),public.qa_old_standings_rebuild(uuid),
 public.qa_old_csv_result_insert(uuid,uuid) TO authenticated;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
BEGIN
 BEGIN
  PERFORM public.qa_old_result_reset(
    '00000000-0000-0000-0000-000000000071');
  RAISE EXCEPTION 'FAIL: old editor reset destroyed a published event';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: legacy editor reset rejects protected published league ELO';
 END;
 BEGIN
  PERFORM public.qa_old_result_delete(
    '00000000-0000-0000-0000-000000000072');
  RAISE EXCEPTION 'FAIL: old deletion destroyed a published event';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: legacy destructive tournament delete rejects league history';
 END;
 BEGIN
  PERFORM public.qa_old_standings_rebuild(
    '00000000-0000-0000-0000-000000000041');
  RAISE EXCEPTION 'FAIL: old standings rebuild deleted prior ranking';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: legacy DELETE + rebuild blocked before losing standings';
 END;
END $qa$;
RESET ROLE;

-- A legacy privileged CSV writer can still insert into an EMPTY league
-- tournament. The guard protects the NEW writer from double publishing,
-- but does NOT retroactively roll back the old multi-step workflow.
-- This is an explicit release blocker requiring coordinated RPC revocation.
INSERT INTO public.tournaments(
 id,club_id,buy_in,league_id,room_id,currency,start_datetime
) VALUES (
 '00000000-0000-0000-0000-000000000074',
 '00000000-0000-0000-0000-000000000021',
 3.30,'00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031',
 'USD','2026-11-12T20:00:00Z'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE v_payload jsonb := '[
  {"player_id":"00000000-0000-0000-0000-000000000051","position":1,
   "prize_won":22,"bounties_won":0,"league_points_earned":20,
   "ccp_club":"QA","buy_ins_count":1},
  {"player_id":"00000000-0000-0000-0000-000000000052","position":2,
   "prize_won":0,"bounties_won":0,"league_points_earned":10,
   "ccp_club":"QA","buy_ins_count":1}
]'::jsonb;
BEGIN
 -- Simulates the old CSV import's privileged INSERT before Elo publication.
 PERFORM public.qa_old_csv_result_insert(
   '00000000-0000-0000-0000-000000000074',
   '00000000-0000-0000-0000-000000000051');
 BEGIN
  PERFORM public.publish_league_results_guarded_qa(
   '00000000-0000-0000-0000-000000000074','upload',v_payload);
  RAISE EXCEPTION 'FAIL: new writer accepted partial legacy CSV rows';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: guarded publication detects incomplete legacy import, refuses ELO duplication';
 END;
END $qa$;
RESET ROLE;
DO $qa$
BEGIN
 IF (SELECT count(*) FROM sharkania_release_qa.elo_publication
      WHERE tournament_id IN (
        '00000000-0000-0000-0000-000000000071',
        '00000000-0000-0000-0000-000000000072',
        '00000000-0000-0000-0000-000000000073'))<>3
 OR (SELECT count(*) FROM public.elo_history
      WHERE tournament_id IN (
        '00000000-0000-0000-0000-000000000071',
        '00000000-0000-0000-0000-000000000072',
        '00000000-0000-0000-0000-000000000073'))<>6
 OR EXISTS(SELECT 1 FROM public.elo_history
      WHERE tournament_id='00000000-0000-0000-0000-000000000074')
 OR EXISTS(SELECT 1 FROM sharkania_release_qa.elo_publication
      WHERE tournament_id='00000000-0000-0000-0000-000000000074')
 OR (SELECT count(*) FROM public.league_standings
     WHERE league_id='00000000-0000-0000-0000-000000000041')<>2
 THEN RAISE EXCEPTION 'FAIL: prior protected data changed during legacy integration'; END IF;
 IF (SELECT count(*) FROM public.tournament_results
      WHERE tournament_id='00000000-0000-0000-0000-000000000074')<>1
 THEN RAISE EXCEPTION 'FAIL: test did not reproduce the lingering legacy CSV partial insert'; END IF;
 RAISE NOTICE 'PASS: prior events remain intact; old CSV partial insert is a VERIFIED CUTOVER BLOCKER';
END $qa$;
ROLLBACK;
DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tournaments WHERE
     id='00000000-0000-0000-0000-000000000074')
 OR to_regprocedure('public.qa_old_result_reset(uuid)') IS NOT NULL
 THEN RAISE EXCEPTION 'FAIL: old writer interaction mocks not rolled back';END IF;
 RAISE NOTICE 'PASS FINAL: legacy writer integration QA fully rolled back';
END $qa$;
