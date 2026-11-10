\set ON_ERROR_STOP on
-- Reject an earlier league result, even when the new nickname would otherwise
-- be inserted. The new table + audit + player row must all roll back.
INSERT INTO public.tournaments(id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES(
 '00000000-0000-0000-0000-000000000113',
 '00000000-0000-0000-0000-000000000021',3.30,
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031','USD','2026-11-26T21:00:00Z');
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $block$
DECLARE denied bool:=false;
BEGIN
 BEGIN
  PERFORM public.publish_league_nickname_results_guarded(
   '00000000-0000-0000-0000-000000000113',
   '[
    {"nickname":"SharkHero","position":1,"prize_won":3,
     "bounties_won":0,"league_points_earned":10,"buy_ins_count":1},
    {"nickname":"CrossWriterRollbackQA","position":2,"prize_won":0,
     "bounties_won":0,"league_points_earned":0,"buy_ins_count":1}
   ]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: league historical backfill skipped shared nonleague result'; END IF;
END;
$block$;
RESET ROLE;
ROLLBACK;
DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM public.players WHERE nickname='CrossWriterRollbackQA')
 OR EXISTS(SELECT 1 FROM public.tournament_results
  WHERE tournament_id='00000000-0000-0000-0000-000000000113')
 OR EXISTS(SELECT 1 FROM sharkania_release.elo_publication
  WHERE tournament_id='00000000-0000-0000-0000-000000000113')
 THEN RAISE EXCEPTION 'FAIL: rejected historical league publish left data'; END IF;
 RAISE NOTICE 'PASS: rejected out-of-order league first publication without partial player/audit creation';
END;
$qa$;
