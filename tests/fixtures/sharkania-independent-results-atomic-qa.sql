\set ON_ERROR_STOP on
-- QA ONLY: fake PostgreSQL 17 database after PR #95 + PR #96 candidate SQL.
-- All IDs are fictional; never run against remote or linked Supabase.
DO $pre$
BEGIN
 IF to_regprocedure('public.publish_independent_nickname_results_guarded(uuid,jsonb)') IS NULL
 OR pg_catalog.has_function_privilege('anon',
      'public.publish_independent_nickname_results_guarded(uuid,jsonb)','EXECUTE')
 OR pg_catalog.has_schema_privilege('authenticated','sharkania_release','USAGE')
 THEN RAISE EXCEPTION 'FAIL: missing/unsafe guarded independent RPC'; END IF;
END;
$pre$;

-- Mock two isolated tournaments: one nonleague and one non-USD, plus an
-- out-of-order tournament with existing later results for SharkHero.
INSERT INTO public.tournaments(id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES
 ('00000000-0000-0000-0000-000000000098',
  '00000000-0000-0000-0000-000000000021',3.30,NULL,
  '00000000-0000-0000-0000-000000000031','USD','2026-11-26T20:00:00Z'),
 ('00000000-0000-0000-0000-000000000099',
  '00000000-0000-0000-0000-000000000021',3300,NULL,
  '00000000-0000-0000-0000-000000000031','CLP','2026-11-26T20:00:00Z'),
 ('00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000021',3.30,NULL,
  '00000000-0000-0000-0000-000000000031','USD','2026-11-02T20:00:00Z');

-- Reject all unauthorized writers and invalid payloads without side effects.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $neg$
DECLARE blocked bool:=false;
BEGIN
 BEGIN
  PERFORM public.publish_independent_nickname_results_guarded(
   '00000000-0000-0000-0000-000000000098',
   '[{"nickname":"SharkHero","position":1,"prize_won":10,"bounties_won":0,"buy_ins_count":1},{"nickname":"PokerQueen","position":2,"prize_won":0,"bounties_won":0,"buy_ins_count":1}]'::jsonb);
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: wrong club admin allowed'; END IF;
END;
$neg$;
RESET ROLE;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $negative_cases$
DECLARE
 blocked bool;
 payload jsonb:='[{"nickname":"SharkHero","position":1,"prize_won":10,"bounties_won":0,"league_points_earned":0,"buy_ins_count":2},{"nickname":"NewIndependentQA","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":0,"buy_ins_count":1}]';
BEGIN
 blocked:=false;
 BEGIN
  PERFORM public.publish_independent_nickname_results_guarded(
   '00000000-0000-0000-0000-000000000099',payload);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: CLP published without currency policy'; END IF;

 blocked:=false;
 BEGIN
  PERFORM public.publish_independent_nickname_results_guarded(
   '00000000-0000-0000-0000-000000000100',payload);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: out-of-order tournament accepted'; END IF;

 blocked:=false;
 BEGIN
  PERFORM public.publish_independent_nickname_results_guarded(
   '00000000-0000-0000-0000-000000000098',
    '[{"nickname":"SharkHero","position":1,"prize_won":10,"bounties_won":0,"buy_ins_count":1,"player_id":"00000000-0000-0000-0000-000000000051"},{"nickname":"PokerQueen","position":2,"prize_won":0,"bounties_won":0,"buy_ins_count":1}]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT422' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: forged player ID accepted'; END IF;

 blocked:=false;
 BEGIN
  PERFORM public.publish_independent_nickname_results_guarded(
   '00000000-0000-0000-0000-000000000098',
    '[{"nickname":"SharkHero","position":1,"prize_won":10,"bounties_won":0,"buy_ins_count":1},{"nickname":"PokerQueen","position":1,"prize_won":0,"bounties_won":0,"buy_ins_count":1}]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT422' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: duplicate positions accepted'; END IF;
END;
$negative_cases$;
RESET ROLE;
ROLLBACK;

DO $clean$
BEGIN
 IF EXISTS(SELECT 1 FROM public.players WHERE nickname='NewIndependentQA')
 OR EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication)
 OR EXISTS(SELECT 1 FROM public.tournament_results
   WHERE tournament_id='00000000-0000-0000-0000-000000000098')
 THEN RAISE EXCEPTION 'FAIL: rejected publication changed data'; END IF;
END;
$clean$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $valid$
DECLARE r jsonb;
BEGIN
 r:=public.publish_independent_nickname_results_guarded(
  '00000000-0000-0000-0000-000000000098',
  '[{"nickname":"  sHaRkHeRo ","position":1,"prize_won":10,"bounties_won":2,"league_points_earned":0,"buy_ins_count":2},{"nickname":"NewIndependentQA","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":0,"buy_ins_count":1}]'::jsonb);
 IF r->>'status'<>'published' OR r->>'new_players'<>'1'
 OR r->>'currency'<>'USD' OR r->>'players'<>'2'
 THEN RAISE EXCEPTION 'FAIL: unexpected independent publication %',r; END IF;
 RAISE NOTICE 'PASS: atomic independent USD writer accepted legitimate club admin';
END;
$valid$;
RESET ROLE;
COMMIT;

DO $assert$
DECLARE v_new uuid;
BEGIN
 SELECT id INTO v_new FROM public.players WHERE nickname='NewIndependentQA';
 IF v_new IS NULL
 OR (SELECT count(*) FROM public.players
   WHERE room_id='00000000-0000-0000-0000-000000000031'
   AND lower(btrim(nickname))='sharkhero')<>1
 OR (SELECT count(*) FROM public.tournament_results
   WHERE tournament_id='00000000-0000-0000-0000-000000000098')<>2
 OR (SELECT count(*) FROM public.elo_history
   WHERE tournament_id='00000000-0000-0000-0000-000000000098')<>2
 OR (SELECT count(*) FROM sharkania_release.independent_elo_publication
   WHERE tournament_id='00000000-0000-0000-0000-000000000098')<>1
 OR (SELECT count(*) FROM sharkania_release.independent_elo_checkpoint)<>2
 OR (SELECT count(*) FROM sharkania_release.independent_currency_posting
   WHERE tournament_id='00000000-0000-0000-0000-000000000098'
   AND currency='USD')<>2
 OR NOT EXISTS(SELECT 1 FROM sharkania_release.independent_currency_posting j
   WHERE j.player_id='00000000-0000-0000-0000-000000000051'
    AND j.buy_ins_count=2 AND j.entry_spend=6.60)
 OR NOT EXISTS(SELECT 1 FROM public.tournaments
   WHERE id='00000000-0000-0000-0000-000000000098' AND results_uploaded)
 THEN RAISE EXCEPTION 'FAIL: missing atomic independent publication evidence'; END IF;

 -- Existing league's standings and results must not be modified by independent upload.
 IF (SELECT count(*) FROM public.league_standings
    WHERE league_id='00000000-0000-0000-0000-000000000041')<>1
 OR (SELECT count(*) FROM public.tournament_results
    WHERE tournament_id='00000000-0000-0000-0000-000000000011')<>2
 THEN RAISE EXCEPTION 'FAIL: shared Elo writer unexpectedly mutated league history'; END IF;
 RAISE NOTICE 'PASS: initial USD publication, normalized nickname, Elo, immutable audit, native USD ledger and league data preserved';
END;
$assert$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $repeat$
DECLARE blocked bool:=false;
BEGIN
 BEGIN
  PERFORM public.publish_independent_nickname_results_guarded(
   '00000000-0000-0000-0000-000000000098',
   '[{"nickname":"SharkHero","position":1,"prize_won":10,"bounties_won":2,"buy_ins_count":2},{"nickname":"NewIndependentQA","position":2,"prize_won":0,"bounties_won":0,"buy_ins_count":1}]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: repeat publication accepted'; END IF;
END;
$repeat$;
RESET ROLE;
ROLLBACK;

DO $last$
BEGIN
 IF (SELECT count(*) FROM sharkania_release.independent_elo_publication)<>1
 OR (SELECT count(*) FROM public.elo_history
    WHERE tournament_id='00000000-0000-0000-0000-000000000098')<>2
 THEN RAISE EXCEPTION 'FAIL: duplicate Elo or audit after retry'; END IF;
 RAISE NOTICE 'PASS FINAL: independent writer atomic USD, authorization, chronology and no duplicate Elo';
END;
$last$;
