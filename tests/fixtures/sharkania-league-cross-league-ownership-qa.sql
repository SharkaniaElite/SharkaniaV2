\set ON_ERROR_STOP on
-- Every failed request must be wholly rolled back; no cross-tenant write.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE v_denied boolean:=false;
BEGIN
 BEGIN
   PERFORM public.publish_league_nickname_results_guarded_qa(
     '00000000-0000-0000-0000-000000000098'::uuid, '[
 {"nickname":"SharkHero","position":1,"prize_won":10,
  "bounties_won":0,"league_points_earned":20,"ccp_club":null,"buy_ins_count":1},
 {"nickname":"PokerQueen","position":2,"prize_won":0,
  "bounties_won":0,"league_points_earned":10,"ccp_club":null,"buy_ins_count":1}
]'::jsonb
   );
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: club A organizer modified club B league'; END IF;
END;
$qa$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE v_denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.publish_league_nickname_results_guarded_qa(
    '00000000-0000-0000-0000-000000000097'::uuid, '[
 {"nickname":"SharkHero","position":1,"prize_won":10,
  "bounties_won":0,"league_points_earned":20,"ccp_club":null,"buy_ins_count":1},
 {"nickname":"PokerQueen","position":2,"prize_won":0,
  "bounties_won":0,"league_points_earned":10,"ccp_club":null,"buy_ins_count":1}
]'::jsonb
  );
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true;
 END;
 IF NOT v_denied THEN RAISE EXCEPTION 'FAIL: club B organizer modified club A league'; END IF;
END;
$qa$;
RESET ROLE;
DO $qa$
BEGIN
 IF EXISTS (SELECT 1 FROM public.tournaments
   WHERE id IN ('00000000-0000-0000-0000-000000000097'::uuid,
                '00000000-0000-0000-0000-000000000098'::uuid)
   AND results_uploaded)
 OR EXISTS (SELECT 1 FROM sharkania_release_qa.elo_publication
   WHERE tournament_id IN ('00000000-0000-0000-0000-000000000097'::uuid,
                           '00000000-0000-0000-0000-000000000098'::uuid))
 THEN RAISE EXCEPTION 'FAIL: cross-organizer denial wrote data'; END IF;
END;
$qa$;
COMMIT;
SELECT 'PASS: both distinct primary organizers denied from one another leagues without business writes' AS qa_status;