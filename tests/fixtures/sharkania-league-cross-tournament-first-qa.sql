\set ON_ERROR_STOP on
-- Disposable PG17 only; first of TWO different league tournaments sharing
-- two players. Keep transaction open AFTER publication to prove lock waiting.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.publish_league_nickname_results_guarded_qa(
 '00000000-0000-0000-0000-000000000094'::uuid,
 '[
  {"nickname":"SharkHero","position":1,"prize_won":20,
   "bounties_won":2,"league_points_earned":25,"ccp_club":null,"buy_ins_count":2},
  {"nickname":"PokerQueen","position":2,"prize_won":0,
   "bounties_won":0,"league_points_earned":10,"ccp_club":null,"buy_ins_count":1}
 ]'::jsonb
) AS first_early_tournament;
-- The marker is created ONLY after the first result writer completed
-- inside this still-uncommitted transaction.
\! touch /tmp/sharkania-qa-cross-first-locked
SELECT pg_catalog.pg_sleep(4);
COMMIT;
