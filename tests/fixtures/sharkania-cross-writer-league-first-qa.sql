\set ON_ERROR_STOP on
-- Only disposable PG17. Release A stable league RPC, no _qa alias.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.publish_league_nickname_results_guarded(
 '00000000-0000-0000-0000-000000000111',
 '[
  {"nickname":"SharkHero","position":1,"prize_won":18,
   "bounties_won":1,"league_points_earned":30,"ccp_club":null,"buy_ins_count":2},
  {"nickname":"PokerQueen","position":2,"prize_won":0,
   "bounties_won":0,"league_points_earned":10,"ccp_club":null,"buy_ins_count":1}
 ]'::jsonb
) AS publication_receipt;
\! touch /tmp/sharkania-qa-cross-writer-league-held
SELECT pg_catalog.pg_sleep(4);
COMMIT;
