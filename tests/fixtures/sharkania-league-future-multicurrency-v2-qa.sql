\set ON_ERROR_STOP on
-- QA ONLY, disposable synthetic PostgreSQL. ELO policy v2 is NOT approved.
-- This proves an isolated future writer could publish CLP/EUR without FX
-- mixing, while leaving existing USD legacy writer and histories untouched.
BEGIN;

INSERT INTO public.leagues(id,name,slug) VALUES
 ('00000000-0000-0000-0000-000000000046','QA New CLP League','qa-v2-clp'),
 ('00000000-0000-0000-0000-000000000047','QA New EUR League','qa-v2-eur'),
 ('00000000-0000-0000-0000-000000000048','QA Mixed Currency Block','qa-v2-mixed');
INSERT INTO public.league_clubs(league_id,club_id,is_primary) VALUES
 ('00000000-0000-0000-0000-000000000046','00000000-0000-0000-0000-000000000021',true),
 ('00000000-0000-0000-0000-000000000047','00000000-0000-0000-0000-000000000022',true),
 ('00000000-0000-0000-0000-000000000048','00000000-0000-0000-0000-000000000021',true);
INSERT INTO public.league_rooms(league_id,room_id) VALUES
 ('00000000-0000-0000-0000-000000000046','00000000-0000-0000-0000-000000000031'),
 ('00000000-0000-0000-0000-000000000047','00000000-0000-0000-0000-000000000031'),
 ('00000000-0000-0000-0000-000000000048','00000000-0000-0000-0000-000000000031');
INSERT INTO public.tournaments
 (id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES
 ('00000000-0000-0000-0000-000000000112',
  '00000000-0000-0000-0000-000000000021',3300,
  '00000000-0000-0000-0000-000000000046',
  '00000000-0000-0000-0000-000000000031','CLP','2026-11-20T20:00:00Z'),
 ('00000000-0000-0000-0000-000000000113',
  '00000000-0000-0000-0000-000000000022',12,
  '00000000-0000-0000-0000-000000000047',
  '00000000-0000-0000-0000-000000000031','EUR','2026-11-21T20:00:00Z'),
 ('00000000-0000-0000-0000-000000000114',
  '00000000-0000-0000-0000-000000000021',3300,
  '00000000-0000-0000-0000-000000000048',
  '00000000-0000-0000-0000-000000000031','CLP','2026-11-22T20:00:00Z'),
 ('00000000-0000-0000-0000-000000000115',
  '00000000-0000-0000-0000-000000000021',3.30,
  '00000000-0000-0000-0000-000000000048',
  '00000000-0000-0000-0000-000000000031','USD','2026-11-23T20:00:00Z');

-- Strictly preserve old writer: it must reject CLP without any new players.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.publish_league_nickname_results_guarded_qa(
   '00000000-0000-0000-0000-000000000112','[
    {"nickname":"V2CLPA","position":1,"prize_won":7000,"bounties_won":0,"league_points_earned":20,"buy_ins_count":2},
    {"nickname":"V2CLPB","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":10,"buy_ins_count":1}
   ]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: old legacy v1 writer accepted CLP'; END IF;
END;
$qa$;

DO $qa$
DECLARE done jsonb;
BEGIN
 done:=public.publish_league_nickname_results_v2_qa(
 '00000000-0000-0000-0000-000000000112','[
  {"nickname":"V2CLPA","position":1,"prize_won":7000,"bounties_won":0,
   "league_points_earned":20,"buy_ins_count":2},
  {"nickname":"V2CLPB","position":2,"prize_won":0,"bounties_won":0,
   "league_points_earned":10,"buy_ins_count":1}
 ]'::jsonb);
 IF done->>'status'<>'published' OR done->>'currency'<>'CLP'
 OR done->>'new_players'<>'2' OR done->>'currency_postings'<>'2' THEN
  RAISE EXCEPTION 'FAIL: future CLP writer returned unexpected status %',done;
 END IF;
END;
$qa$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE done jsonb;
BEGIN
 done:=public.publish_league_nickname_results_v2_qa(
 '00000000-0000-0000-0000-000000000113','[
  {"nickname":"V2EURA","position":1,"prize_won":30,"bounties_won":0,
   "league_points_earned":20,"buy_ins_count":3},
  {"nickname":"V2EURB","position":2,"prize_won":0,"bounties_won":0,
   "league_points_earned":10,"buy_ins_count":1}
 ]'::jsonb);
 IF done->>'status'<>'published' OR done->>'currency'<>'EUR'
 OR done->>'new_players'<>'2' OR done->>'currency_postings'<>'2' THEN
  RAISE EXCEPTION 'FAIL: future EUR writer returned unexpected status %',done;
 END IF;
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
 IF (SELECT count(*) FROM sharkania_release_qa.elo_publication ep
   WHERE ep.tournament_id IN (
    '00000000-0000-0000-0000-000000000112'::uuid,
    '00000000-0000-0000-0000-000000000113'::uuid)
   AND ep.algorithm_version='currency-neutral-v2-PROPOSAL')<>2
 OR (SELECT count(*) FROM public.tournament_results
   WHERE tournament_id IN (
    '00000000-0000-0000-0000-000000000112'::uuid,
    '00000000-0000-0000-0000-000000000113'::uuid))<>4
 OR (SELECT count(*) FROM public.elo_history
   WHERE tournament_id IN (
    '00000000-0000-0000-0000-000000000112'::uuid,
    '00000000-0000-0000-0000-000000000113'::uuid))<>4
 OR (SELECT count(*) FROM sharkania_release_qa.currency_posting
   WHERE tournament_id IN (
    '00000000-0000-0000-0000-000000000112'::uuid,
    '00000000-0000-0000-0000-000000000113'::uuid))<>4
 OR (SELECT count(*) FROM public.players
   WHERE nickname IN ('V2CLPA','V2EURA')
     AND elo_rating=1220.90 AND elo_peak=1220.90
     AND total_tournaments=1 AND total_wins=1
     AND total_prize_won=0 AND total_buy_ins_spent=0)<>2
 OR (SELECT count(*) FROM public.players
   WHERE nickname IN ('V2CLPB','V2EURB')
     AND elo_rating=1179.10 AND total_tournaments=1
     AND total_prize_won=0 AND total_buy_ins_spent=0)<>2
 OR (SELECT count(*) FROM sharkania_release_qa.currency_posting cp
     JOIN public.players p ON p.id=cp.player_id
     WHERE (p.nickname='V2CLPA' AND cp.currency='CLP'
       AND cp.entry_spend=6600 AND cp.prize_won=7000)
       OR (p.nickname='V2EURA' AND cp.currency='EUR'
       AND cp.entry_spend=36 AND cp.prize_won=30))<>2
 THEN RAISE EXCEPTION 'FAIL: candidate v2 Elo, audit, historical money separation or reentries diverged'; END IF;

 IF (SELECT count(*) FROM public.league_standings s
   WHERE s.league_id IN (
   '00000000-0000-0000-0000-000000000046'::uuid,
   '00000000-0000-0000-0000-000000000047'::uuid))<>4 THEN
   RAISE EXCEPTION 'FAIL: candidate new league standings were not published'; END IF;
 RAISE NOTICE 'PASS: proposed CLP and EUR v2 publish with identical neutral Elo, native money separate and full audit';
END;
$qa$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE denied boolean:=false; cause text;
BEGIN
 BEGIN
  PERFORM public.publish_league_nickname_results_v2_qa(
   '00000000-0000-0000-0000-000000000114','[
    {"nickname":"MixedLeagueA","position":1,"prize_won":8000,"bounties_won":0,"league_points_earned":20,"buy_ins_count":1},
    {"nickname":"MixedLeagueB","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":10,"buy_ins_count":1}
   ]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
   GET STACKED DIAGNOSTICS cause=MESSAGE_TEXT;
   IF cause LIKE 'Mixed-currency league requires%' THEN denied:=true; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: prospective writer permitted mixed-currency league'; END IF;
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
 IF EXISTS (SELECT 1 FROM public.players WHERE nickname IN ('MixedLeagueA','MixedLeagueB'))
 OR EXISTS (SELECT 1 FROM sharkania_release_qa.elo_publication
    WHERE tournament_id='00000000-0000-0000-0000-000000000114'::uuid)
 OR EXISTS (SELECT 1 FROM public.tournament_results
    WHERE tournament_id='00000000-0000-0000-0000-000000000114'::uuid)
 THEN RAISE EXCEPTION 'FAIL: refused mixed-currency league created partial data'; END IF;
 RAISE NOTICE 'PASS: mixed-currency league denied, without creating aliases or results';
END;
$qa$;

ROLLBACK;
DO $qa$
BEGIN
 IF EXISTS (SELECT 1 FROM public.leagues
  WHERE id IN ('00000000-0000-0000-0000-000000000046'::uuid,
               '00000000-0000-0000-0000-000000000047'::uuid,
               '00000000-0000-0000-0000-000000000048'::uuid))
 OR EXISTS (SELECT 1 FROM public.players
  WHERE nickname IN ('V2CLPA','V2CLPB','V2EURA','V2EURB'))
 THEN RAISE EXCEPTION 'FAIL: prospective v2 QA fixture did not roll back'; END IF;
 RAISE NOTICE 'PASS: all candidate ELO v2 test data was discarded';
END;
$qa$;
