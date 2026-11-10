\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.publish_league_nickname_results_guarded(
 '00000000-0000-0000-0000-000000000115',
 '[
  {"nickname":"PokerQueen","position":1,"prize_won":9,
   "bounties_won":1,"league_points_earned":22,"ccp_club":null,"buy_ins_count":1},
  {"nickname":"SharkHero","position":2,"prize_won":0,
   "bounties_won":0,"league_points_earned":7,"ccp_club":null,"buy_ins_count":1}
 ]'::jsonb
);
COMMIT;
