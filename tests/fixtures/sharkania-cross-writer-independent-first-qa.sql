\set ON_ERROR_STOP on
-- Opposite direction: independent first, later league, shared players.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.publish_independent_nickname_results_guarded(
 '00000000-0000-0000-0000-000000000114',
 '[
  {"nickname":"SharkHero","position":1,"prize_won":18,
   "bounties_won":0,"league_points_earned":0,"buy_ins_count":2},
  {"nickname":"PokerQueen","position":2,"prize_won":0,
   "bounties_won":0,"league_points_earned":0,"buy_ins_count":1}
 ]'::jsonb
);
\! touch /tmp/sharkania-qa-cross-writer-independent-held
SELECT pg_catalog.pg_sleep(4);
COMMIT;
