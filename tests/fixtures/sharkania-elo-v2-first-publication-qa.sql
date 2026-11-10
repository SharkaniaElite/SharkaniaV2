\set ON_ERROR_STOP on
-- Real v2 RPCs from release-candidate SQL, synthetic PG17 and fake auth.
-- FX observation fixture has been installed, source timestamps pre-event
-- (with separate injected late quote) and v2 activated ONLY in this fake DB.
INSERT INTO public.tournaments(
 id,club_id,buy_in,league_id,room_id,currency,start_datetime,timezone
) VALUES (
 '00000000-0000-0000-0000-000000000140',
 '00000000-0000-0000-0000-000000000021',9500,
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031','CLP',
 '2026-11-08T20:00:00Z','America/Santiago');

-- A synthetic successful CLP poll shortly BEFORE the league's start,
-- required even though the market was closed over the weekend.
INSERT INTO sharkania_release.fx_feed_check_v2(
 currency,newest_effective_date,newest_observation_id,checked_at)
SELECT fx.currency,fx.effective_date,fx.id,'2026-11-08T19:30:00Z'
FROM sharkania_release.fx_observation_v2 fx
WHERE fx.currency='CLP' AND fx.effective_date='2026-11-04';

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $wrong$
DECLARE denied bool:=false;
BEGIN
 BEGIN
  PERFORM public.publish_independent_nickname_results_v2_guarded(
   '00000000-0000-0000-0000-000000000131',
   '[{"nickname":"FXBad1","position":1,"prize_won":0,"bounties_won":0,"buy_ins_count":1},{"nickname":"FXBad2","position":2,"prize_won":0,"bounties_won":0,"buy_ins_count":1}]');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: foreign organizer minted v2 results'; END IF;
END;$wrong$;
RESET ROLE;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $publish$
DECLARE r jsonb;
BEGIN
 r:=public.publish_independent_nickname_results_v2_guarded(
   '00000000-0000-0000-0000-000000000131',
   '[{"nickname":"FXCLPFirst","position":1,"prize_won":12000,"bounties_won":0,"league_points_earned":0,"buy_ins_count":2},{"nickname":"FXCLPSecond","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":0,"buy_ins_count":1}]');
 IF r->>'status'<>'published' OR r->>'currency'<>'CLP'
    OR abs((r->>'buy_in_usd')::numeric-10)>0.0000001
 THEN RAISE EXCEPTION 'FAIL: independent CLP publication missing USD normalized receipt %',r; END IF;

 r:=public.publish_independent_nickname_results_v2_guarded(
   '00000000-0000-0000-0000-000000000132',
   '[{"nickname":"FXEURFirst","position":1,"prize_won":15,"bounties_won":0,"league_points_earned":0,"buy_ins_count":1},{"nickname":"FXEURSecond","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":0,"buy_ins_count":1}]');
 IF r->>'status'<>'published' OR r->>'currency'<>'EUR' THEN
  RAISE EXCEPTION 'FAIL: independent EUR writer %',r; END IF;
 r:=public.publish_independent_nickname_results_v2_guarded(
   '00000000-0000-0000-0000-000000000133',
   '[{"nickname":"FXUSDFirst","position":1,"prize_won":12,"bounties_won":0,"league_points_earned":0,"buy_ins_count":1},{"nickname":"FXUSDSecond","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":0,"buy_ins_count":1}]');
 IF r->>'status'<>'published' OR r->>'currency'<>'USD' THEN
  RAISE EXCEPTION 'FAIL: independent USD writer %',r; END IF;

 r:=public.publish_league_nickname_results_v2_guarded(
   '00000000-0000-0000-0000-000000000140',
   '[{"nickname":"FXLeagueFirst","position":1,"prize_won":30000,"bounties_won":0,"league_points_earned":50,"buy_ins_count":1},{"nickname":"FXLeagueSecond","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":10,"buy_ins_count":1}]');
 IF r->>'status'<>'published' OR r->>'currency'<>'CLP' THEN
  RAISE EXCEPTION 'FAIL: league CLP v2 writer %',r; END IF;
 RAISE NOTICE 'PASS: v2 first publication supports independent CLP/EUR/USD + primary-organizer league CLP';
END;$publish$;
RESET ROLE;
COMMIT;

DO $assert$
DECLARE
 a numeric;b numeric;c numeric;
BEGIN
 IF (SELECT count(*) FROM public.tournament_results
 WHERE tournament_id IN(
  '00000000-0000-0000-0000-000000000131',
  '00000000-0000-0000-0000-000000000132',
  '00000000-0000-0000-0000-000000000133',
  '00000000-0000-0000-0000-000000000140'))<>8
 OR (SELECT count(*) FROM sharkania_release.elo_v2_event_fx)<>4
 OR (SELECT count(*) FROM sharkania_release.independent_elo_publication
  WHERE algorithm_version='elo-v2-usd-normalized')<>3
 OR (SELECT count(*) FROM sharkania_release.elo_publication
  WHERE algorithm_version='elo-v2-usd-normalized')<>1
 THEN RAISE EXCEPTION 'FAIL: incomplete v2 result/Elo/fx audit or double publication'; END IF;

 SELECT elo_change INTO a FROM public.tournament_results r
 JOIN public.players p ON p.id=r.player_id
 WHERE p.nickname='FXCLPFirst' AND r.tournament_id='00000000-0000-0000-0000-000000000131';
 SELECT elo_change INTO b FROM public.tournament_results r
 JOIN public.players p ON p.id=r.player_id
 WHERE p.nickname='FXEURFirst' AND r.tournament_id='00000000-0000-0000-0000-000000000132';
 SELECT elo_change INTO c FROM public.tournament_results r
 JOIN public.players p ON p.id=r.player_id
 WHERE p.nickname='FXUSDFirst' AND r.tournament_id='00000000-0000-0000-0000-000000000133';
 IF a IS NULL OR b IS NULL OR c IS NULL OR
 abs(a-b)>0.01 OR abs(a-c)>0.01 THEN
  RAISE EXCEPTION 'FAIL: equivalent currency K produced different ELO CLP/EUR/USD % % %',a,b,c;
 END IF;

 IF NOT EXISTS(SELECT 1 FROM sharkania_release.independent_currency_posting j
 JOIN public.players p ON p.id=j.player_id
 WHERE p.nickname='FXCLPFirst' AND j.currency='CLP'
   AND j.buy_ins_count=2 AND j.entry_spend=19000 AND j.prize_won=12000)
 OR NOT EXISTS(SELECT 1 FROM sharkania_release.currency_posting j
 JOIN public.players p ON p.id=j.player_id
 WHERE p.nickname='FXLeagueFirst' AND j.currency='CLP' AND j.prize_won=30000)
 OR NOT EXISTS(SELECT 1 FROM public.players WHERE nickname='FXCLPFirst'
 AND total_prize_won=0 AND total_buy_ins_spent=0 AND total_tournaments=1)
 OR NOT EXISTS(SELECT 1 FROM public.players WHERE nickname='FXUSDFirst'
 AND total_prize_won=12 AND total_buy_ins_spent=10)
 THEN RAISE EXCEPTION 'FAIL: cross-currency financial totals mixed or native ledgers incomplete'; END IF;

 IF NOT EXISTS(SELECT 1 FROM sharkania_release.elo_v2_event_fx
 WHERE tournament_id='00000000-0000-0000-0000-000000000131'
 AND original_currency='CLP' AND original_buy_in=9500
 AND quote=950 AND abs(buy_in_usd-10)<0.0000001)
 THEN RAISE EXCEPTION 'FAIL: event-scoped USD exchange snapshot missing'; END IF;
 RAISE NOTICE 'PASS: v2 weighted Elo equal for 10 USD, 9500 CLP, 9.09 EUR; finance stays native';
END;$assert$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $repeat$
DECLARE denied bool:=false;
BEGIN
 BEGIN
  PERFORM public.publish_independent_nickname_results_v2_guarded(
   '00000000-0000-0000-0000-000000000131',
   '[{"nickname":"FXCLPFirst","position":1,"prize_won":12000,"bounties_won":0,"buy_ins_count":2},{"nickname":"FXCLPSecond","position":2,"prize_won":0,"bounties_won":0,"buy_ins_count":1}]');
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: duplicate v2 publication accepted'; END IF;
END;$repeat$;
RESET ROLE;
ROLLBACK;

DO $final$
BEGIN
 IF (SELECT count(*) FROM sharkania_release.elo_v2_event_fx)<>4 OR
 (SELECT count(*) FROM public.tournament_results
 WHERE tournament_id='00000000-0000-0000-0000-000000000131')<>2
 THEN RAISE EXCEPTION 'FAIL: v2 idempotency broken'; END IF;
 RAISE NOTICE 'PASS FINAL: v2 USD normalized first publication CLP/EUR/USD and league, atomic receipts and no replay';
END;$final$;
