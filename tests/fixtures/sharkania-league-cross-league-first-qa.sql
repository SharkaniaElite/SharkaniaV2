\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.publish_league_nickname_results_guarded_qa(
  '00000000-0000-0000-0000-000000000097'::uuid,
  '[
   {"nickname":"SharkHero","position":1,"prize_won":20,
     "bounties_won":2,"league_points_earned":25,"ccp_club":null,"buy_ins_count":2},
   {"nickname":"PokerQueen","position":2,"prize_won":0,
     "bounties_won":0,"league_points_earned":10,"ccp_club":null,"buy_ins_count":1}
  ]'::jsonb
) AS league_a_first_result;
\! touch /tmp/sharkania-qa-different-leagues-a-published
SELECT pg_catalog.pg_sleep(4);
COMMIT;