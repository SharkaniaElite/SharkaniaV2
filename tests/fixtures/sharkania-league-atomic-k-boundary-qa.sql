\set ON_ERROR_STOP on
-- QA-only independent parity oracle: JS Elo engine values frozen for a
-- three-player USD result set, mixing total_tournaments=29/30/31.
-- No historical data, no production users and full ROLLBACK at the end.
BEGIN;
INSERT INTO public.players(id,profile_id,room_id,elo_rating,elo_peak,total_tournaments)
VALUES
('00000000-0000-0000-0000-000000000081',NULL,'00000000-0000-0000-0000-000000000031',1200,1200,29),
('00000000-0000-0000-0000-000000000082',NULL,'00000000-0000-0000-0000-000000000031',1400,1400,30),
('00000000-0000-0000-0000-000000000083',NULL,'00000000-0000-0000-0000-000000000031',1000,1000,31);

INSERT INTO public.tournaments(id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES (
 '00000000-0000-0000-0000-000000000076',
 '00000000-0000-0000-0000-000000000021',3.30,
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031','USD',
 '2026-11-05T23:00:00Z'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE result jsonb;
BEGIN
 result := public.publish_league_results_guarded_qa(
 '00000000-0000-0000-0000-000000000076','upload',
 '[
  {"player_id":"00000000-0000-0000-0000-000000000081","position":1,
   "prize_won":20,"bounties_won":0,"league_points_earned":30,
   "ccp_club":null,"buy_ins_count":2},
  {"player_id":"00000000-0000-0000-0000-000000000082","position":2,
   "prize_won":0,"bounties_won":4,"league_points_earned":18,
   "ccp_club":null,"buy_ins_count":1},
  {"player_id":"00000000-0000-0000-0000-000000000083","position":3,
   "prize_won":0,"bounties_won":0,"league_points_earned":10,
   "ccp_club":null,"buy_ins_count":1}
 ]'::jsonb
 );
 IF result->>'status' IS DISTINCT FROM 'published'
    OR result->>'players' <> '3'
 THEN RAISE EXCEPTION 'FAIL: 3-player USD initial publication not accepted'; END IF;
 RAISE NOTICE 'PASS: 3-player initial league publication succeeded';
END;
$qa$;
RESET ROLE;

-- Expected JS legacy source formula (from src/lib/api/elo-engine.ts):
-- sumElo=3600, avg=1200, weight=1, buyIn=3.30, N=3;
-- K for tournament count 29 = 45.577946109..., for 30/31 = 22.788973054...
-- calculated: P81 +22.79, P82 -7.95, P83 -3.44.
DO $qa$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.players
    WHERE id='00000000-0000-0000-0000-000000000081'
      AND elo_rating=1222.79 AND elo_peak=1222.79
      AND total_tournaments=30 AND total_wins=1
      AND total_cashes=1 AND total_prize_won=20)
  OR NOT EXISTS (SELECT 1 FROM public.players
    WHERE id='00000000-0000-0000-0000-000000000082'
      AND elo_rating=1392.05 AND elo_peak=1400
      AND total_tournaments=31 AND total_wins=0
      AND total_cashes=1 AND total_prize_won=4)
  OR NOT EXISTS (SELECT 1 FROM public.players
    WHERE id='00000000-0000-0000-0000-000000000083'
      AND elo_rating=996.56 AND elo_peak=1000
      AND total_tournaments=32 AND total_wins=0
      AND total_cashes=0 AND total_prize_won=0)
 THEN RAISE EXCEPTION 'FAIL: 3-player, K threshold, bounty or player stats diverged from JS'; END IF;

 IF (SELECT count(*) FROM public.tournament_results r
     WHERE r.tournament_id='00000000-0000-0000-0000-000000000076'
       AND (r.player_id,r.elo_before,r.elo_after,r.elo_change)
       IN (
        ('00000000-0000-0000-0000-000000000081'::uuid,1200,1222.79,22.79),
        ('00000000-0000-0000-0000-000000000082'::uuid,1400,1392.05,-7.95),
        ('00000000-0000-0000-0000-000000000083'::uuid,1000,996.56,-3.44)
       )
   ) <> 3
 OR (SELECT count(*) FROM public.elo_history h
     WHERE h.tournament_id='00000000-0000-0000-0000-000000000076') <> 3
 OR (SELECT count(*) FROM sharkania_release_qa.elo_player_checkpoint cp
     JOIN sharkania_release_qa.elo_publication ep ON ep.id=cp.publication_id
     WHERE ep.tournament_id='00000000-0000-0000-0000-000000000076') <> 3
 OR (SELECT count(*) FROM sharkania_release_qa.elo_publication ep
     WHERE ep.tournament_id='00000000-0000-0000-0000-000000000076') <> 1
 THEN RAISE EXCEPTION 'FAIL: row/elo/checkpoint count or results math mismatched'; END IF;
 RAISE NOTICE 'PASS: 3-player Elo matches JS including K=40/20 boundary and bounties';
END;
$qa$;
ROLLBACK;
DO $qa$
BEGIN
 IF EXISTS (SELECT 1 FROM public.tournaments WHERE id='00000000-0000-0000-0000-000000000076')
 OR EXISTS (SELECT 1 FROM public.players WHERE id IN (
  '00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082',
  '00000000-0000-0000-0000-000000000083'))
 OR EXISTS (SELECT 1 FROM sharkania_release_qa.elo_publication WHERE
    tournament_id='00000000-0000-0000-0000-000000000076')
 THEN RAISE EXCEPTION 'FAIL: parity QA did not completely roll back'; END IF;
 RAISE NOTICE 'PASS: 3-player K-boundary fixture fully rolled back';
END;
$qa$;
