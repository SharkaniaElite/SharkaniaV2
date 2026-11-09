\set ON_ERROR_STOP on
-- QA-only: executed simultaneously in two separate psql sessions against
-- ONE disposable synthetic tournament. There must be exactly one success.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.publish_league_nickname_results_guarded_qa(
 '00000000-0000-0000-0000-000000000093'::uuid,
 '[
  {"nickname":"RaceSharkOne","position":1,"prize_won":10,
   "bounties_won":1,"league_points_earned":20,
   "buy_ins_count":2},
  {"nickname":"RaceSharkTwo","position":2,"prize_won":0,
   "bounties_won":0,"league_points_earned":10,
   "buy_ins_count":1}
 ]'::jsonb
) AS guarded_result;
COMMIT;
