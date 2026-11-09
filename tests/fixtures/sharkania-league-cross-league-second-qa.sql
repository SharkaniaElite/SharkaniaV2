\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
SELECT public.publish_league_nickname_results_guarded_qa(
  '00000000-0000-0000-0000-000000000098'::uuid,
  '[
   {"nickname":"PokerQueen","position":1,"prize_won":15,
     "bounties_won":1,"league_points_earned":25,"ccp_club":null,"buy_ins_count":1},
   {"nickname":"SharkHero","position":2,"prize_won":0,
     "bounties_won":0,"league_points_earned":10,"ccp_club":null,"buy_ins_count":1}
  ]'::jsonb
) AS league_b_later_result;
COMMIT;