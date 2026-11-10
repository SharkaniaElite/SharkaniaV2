\set ON_ERROR_STOP on
-- Entirely synthetic data in a disposable PG17 service.
-- No fake operation is ever allowed to reach a remotely linked Supabase.
DO $qa$
BEGIN
 IF pg_catalog.has_function_privilege('anon',
   'public.publish_league_nickname_results_guarded(uuid,jsonb)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('authenticated',
   'public.publish_league_nickname_results_guarded(uuid,jsonb)','EXECUTE')
 OR pg_catalog.has_schema_privilege('authenticated','sharkania_release','USAGE')
 OR pg_catalog.has_function_privilege('authenticated',
   'sharkania_release.publish_results_initial(uuid,text,jsonb)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
   'sharkania_release.recalculate_standings_guarded(uuid)','EXECUTE')
 OR pg_catalog.has_table_privilege('authenticated',
   'public.league_standings','INSERT')
 OR pg_catalog.has_table_privilege('authenticated',
   'public.league_standings','UPDATE')
 OR pg_catalog.has_table_privilege('authenticated',
   'public.league_standings','DELETE')
 THEN RAISE EXCEPTION 'FAIL: Release A client ACL'; END IF;

 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_index i
   JOIN pg_catalog.pg_class ix ON ix.oid=i.indexrelid
   WHERE i.indrelid='public.players'::regclass
    AND ix.relname='league_players_normalized_nickname_room_guarded'
    AND i.indisunique AND i.indisvalid)
 THEN RAISE EXCEPTION 'FAIL: normalized nickname index missing'; END IF;

 IF EXISTS (SELECT 1 FROM pg_catalog.pg_proc p
   WHERE p.pronamespace='public'::regnamespace
   AND p.proname IN ('publish_league_nickname_results_guarded_qa',
                      'publish_league_results_guarded_qa'))
 THEN RAISE EXCEPTION 'FAIL: temporary QA writer exposed'; END IF;
 RAISE NOTICE 'PASS: stable public RPC, private internal API and denied league standings DML';
END;
$qa$;

-- Call the real public name, not the old QA alias; the JWT identity is a
-- test-only current_setting backed by synthetic auth.uid().
INSERT INTO public.tournaments
 (id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES
 ('00000000-0000-0000-0000-000000000093',
  '00000000-0000-0000-0000-000000000021',3.30,
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031','USD',
  '2026-11-20T20:00:00Z'),
 ('00000000-0000-0000-0000-000000000094',
  '00000000-0000-0000-0000-000000000021',3.30,
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031','USD',
  '2026-11-21T20:00:00Z');

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.publish_league_nickname_results_guarded(
    '00000000-0000-0000-0000-000000000093'::uuid,
    '[{"nickname":"SharkHero","position":1,"prize_won":10,"bounties_won":0,"league_points_earned":20,"buy_ins_count":1},
      {"nickname":"CutoverNew","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":10,"buy_ins_count":1}]'::jsonb);
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: secondary club published results'; END IF;
END;
$qa$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE response jsonb;
BEGIN
 response:=public.publish_league_nickname_results_guarded(
    '00000000-0000-0000-0000-000000000093'::uuid,
    '[{"nickname":"SharkHero","position":1,"prize_won":10,"bounties_won":0,"league_points_earned":20,"buy_ins_count":2},
      {"nickname":"CutoverNew","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":10,"buy_ins_count":1}]'::jsonb);
 IF response->>'status'<>'published' OR response->>'currency'<>'USD'
 OR response->>'new_players'<>'1' OR response->>'currency_postings'<>'2'
 THEN RAISE EXCEPTION 'FAIL: first USD publication response %',response; END IF;
 RAISE NOTICE 'PASS: authorized first league USD upload published atomically';
END;
$qa$;
RESET ROLE;
COMMIT;

DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.tournament_results
   WHERE tournament_id='00000000-0000-0000-0000-000000000093')<>2
 OR (SELECT count(*) FROM public.elo_history
   WHERE tournament_id='00000000-0000-0000-0000-000000000093')<>2
 OR (SELECT count(*) FROM sharkania_release.elo_publication
   WHERE tournament_id='00000000-0000-0000-0000-000000000093')<>1
 OR (SELECT count(*) FROM sharkania_release.elo_player_checkpoint cp
   JOIN sharkania_release.elo_publication ep ON ep.id=cp.publication_id
   WHERE ep.tournament_id='00000000-0000-0000-0000-000000000093')<>2
 OR (SELECT count(*) FROM sharkania_release.currency_posting
   WHERE tournament_id='00000000-0000-0000-0000-000000000093')<>2
 OR NOT EXISTS (SELECT 1 FROM sharkania_release.currency_posting j
   JOIN public.players p ON p.id=j.player_id
   WHERE j.tournament_id='00000000-0000-0000-0000-000000000093'
   AND p.nickname='SharkHero' AND j.buy_ins_count=2 AND j.entry_spend=6.60)
 OR NOT EXISTS (SELECT 1 FROM public.players WHERE nickname='CutoverNew'
   AND profile_id IS NULL AND country_code='CL')
 THEN RAISE EXCEPTION 'FAIL: atomic results, Elo or currency evidence incomplete'; END IF;
 RAISE NOTICE 'PASS: one audit, two Elo checkpoints, two results and native entry ledger';
END;
$qa$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.publish_league_nickname_results_guarded(
    '00000000-0000-0000-0000-000000000093'::uuid,
    '[{"nickname":"SharkHero","position":1,"prize_won":10,"bounties_won":0,"league_points_earned":20,"buy_ins_count":2},
      {"nickname":"CutoverNew","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":10,"buy_ins_count":1}]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: duplicate publication accepted'; END IF;
END;
$qa$;
RESET ROLE;
COMMIT;

DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.elo_history
   WHERE tournament_id='00000000-0000-0000-0000-000000000093')<>2
 THEN RAISE EXCEPTION 'FAIL: duplicate Elo'; END IF;
END;
$qa$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.publish_league_nickname_results_guarded(
    '00000000-0000-0000-0000-000000000094'::uuid,
    '[{"nickname":"SharkHero","position":1,"prize_won":10,"bounties_won":0,"league_points_earned":20,"buy_ins_count":1},
      {"nickname":"CutoverNew","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":10,"buy_ins_count":1,"player_id":"00000000-0000-0000-0000-000000000051"}]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT422' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: forged player_id accepted'; END IF;
END;
$qa$;
RESET ROLE;
COMMIT;

DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM sharkania_release.elo_publication
   WHERE tournament_id='00000000-0000-0000-0000-000000000094')
 OR EXISTS(SELECT 1 FROM public.tournament_results
   WHERE tournament_id='00000000-0000-0000-0000-000000000094')
 THEN RAISE EXCEPTION 'FAIL: rejected forged request wrote data'; END IF;
END;
$qa$;
SELECT 'PASS FINAL: single SQL Release A candidate installed with guarded USD writer' AS qa_status;
