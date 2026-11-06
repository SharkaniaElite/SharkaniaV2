\set ON_ERROR_STOP on
-- Participant B (non-primary club) and ordinary player cannot recalculate A.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DO $t$ BEGIN
 PERFORM public.recalculate_league_standings_guarded('00000000-0000-0000-0000-000000000011');
 RAISE EXCEPTION 'FAIL: secondary club B was permitted';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
END $t$;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
DO $t$ BEGIN
 PERFORM public.recalculate_league_standings_guarded('00000000-0000-0000-0000-000000000011');
 RAISE EXCEPTION 'FAIL: ordinary player was permitted';
EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
END $t$;
RESET ROLE;
DO $t$ BEGIN
 IF has_function_privilege('anon','public.recalculate_league_standings_guarded(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'FAIL: anonymous execute permission';
 END IF;
 IF has_table_privilege('authenticated','public.league_standings','UPDATE') THEN
   RAISE EXCEPTION 'FAIL: authenticated direct UPDATE still available in QA';
 END IF;
END $t$;
-- Club A owner: update existing row and insert a newcomer, preserving locked fields.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DO $t$ DECLARE n integer; BEGIN
 SELECT public.recalculate_league_standings_guarded('00000000-0000-0000-0000-000000000011') INTO n;
 IF n <> 2 THEN RAISE EXCEPTION 'FAIL: expected two standings; got %',n; END IF;
END $t$;
RESET ROLE;
DO $t$ BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.league_standings
  WHERE id='00000000-0000-0000-0000-000000000061'
    AND total_points=30 AND tournaments_played=2 AND best_position=1
    AND final_tables_count=2 AND rank_position=1
    AND ccp_club='CCP-LOCKED' AND total_buy_ins_spent=99
    AND last_tournament_id='00000000-0000-0000-0000-000000000041'
 ) THEN RAISE EXCEPTION 'FAIL: history or existing row identity modified'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.league_standings
  WHERE league_id='00000000-0000-0000-0000-000000000011'
    AND player_id='00000000-0000-0000-0000-000000000032'
    AND total_points=20 AND tournaments_played=1 AND rank_position=2
    AND ccp_club='CCP-B' AND total_buy_ins_spent=3
 ) THEN RAISE EXCEPTION 'FAIL: new entrant candidate incorrect'; END IF;
 IF (SELECT count(*) FROM public.league_standings
   WHERE league_id='00000000-0000-0000-0000-000000000011')<>2
 THEN RAISE EXCEPTION 'FAIL: duplicate rows created'; END IF;
END $t$;
-- An otherwise permitted superadmin must fail closed for a historic orphan.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
DO $t$ BEGIN
 PERFORM public.recalculate_league_standings_guarded('00000000-0000-0000-0000-000000000012');
 RAISE EXCEPTION 'FAIL: orphan did not block recalc';
EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
END $t$;
RESET ROLE;
DO $t$ BEGIN
 IF (SELECT count(*) FROM public.league_standings
     WHERE league_id='00000000-0000-0000-0000-000000000012')<>2
 OR NOT EXISTS (
  SELECT 1 FROM public.league_standings
  WHERE id='00000000-0000-0000-0000-000000000063'
    AND total_points=5
 ) THEN RAISE EXCEPTION 'FAIL: orphan history was modified'; END IF;
END $t$;
-- A second no-change recalc must not write already-correct standings.
-- The return count counts inserts/real updates, not every computed row.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
DO $t$
DECLARE n integer;
BEGIN
 SELECT public.recalculate_league_standings_guarded(
  '00000000-0000-0000-0000-000000000011') INTO n;
 IF n<>0 THEN
   RAISE EXCEPTION 'FAIL: no-op recalc wrote % unchanged ranking rows',n;
 END IF;
 RAISE NOTICE 'PASS: repeated unchanged recalc writes ZERO rows';
END $t$;
RESET ROLE;
DO $t$ BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM public.league_standings
  WHERE id='00000000-0000-0000-0000-000000000061'
    AND ccp_club='CCP-LOCKED' AND total_buy_ins_spent=99
 ) THEN RAISE EXCEPTION 'FAIL: idempotency mutated locked fields'; END IF;
END $t$;
\echo 'PASS: guarded standings isolated QA roles, history, idempotency'
