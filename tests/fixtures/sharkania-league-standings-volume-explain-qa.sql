\set ON_ERROR_STOP on
-- Synthetic full-league ranking cost, isolated qa_league_atomic only.
-- EXPLAIN ANALYZE executes data writes: never point this at Supabase cloud.
-- All fixture data/functions/indexes are rolled back at the end.
BEGIN;
SET LOCAL statement_timeout='12s';
SET LOCAL lock_timeout='3s';
INSERT INTO public.leagues(id,name,slug,best_dates_to_count)
VALUES ('00000000-0000-0000-0000-000000000044','QA ranking volume','qa-ranking-volume',5);
INSERT INTO public.league_clubs(league_id,club_id,is_primary)
VALUES ('00000000-0000-0000-0000-000000000044',
        '00000000-0000-0000-0000-000000000021',true);
-- Production-like join indexes on these two foreign-key columns.
CREATE INDEX qa_rank_bench_tournament_id ON public.tournament_results(tournament_id);
CREATE INDEX qa_rank_bench_league_id ON public.tournaments(league_id);
CREATE OR REPLACE FUNCTION public.qa_rank_seed_events(p_first int,p_last int)
RETURNS void LANGUAGE plpgsql
SET search_path TO ''
AS $seed$
BEGIN
  INSERT INTO public.tournaments(
    id,club_id,buy_in,league_id,room_id,currency,start_datetime)
  SELECT md5('qa-rank-tournament-'||g::text)::uuid,
    '00000000-0000-0000-0000-000000000021'::uuid,3.30,
    '00000000-0000-0000-0000-000000000044'::uuid,
    '00000000-0000-0000-0000-000000000031'::uuid,'USD',
    '2026-09-01T20:00:00Z'::timestamptz+g*interval '1 day'
  FROM pg_catalog.generate_series(p_first,p_last) g;
  INSERT INTO public.tournament_results(
    tournament_id,player_id,position,league_points_earned,
    ccp_club,buy_ins_count)
  SELECT md5('qa-rank-tournament-'||g::text)::uuid,
    md5('qa-rank-player-'||p::text)::uuid,
    ((p+g-2)%200)+1,
    ((201-(((p+g-2)%200)+1))::numeric/10),
    NULL,1
  FROM pg_catalog.generate_series(p_first,p_last) g
  CROSS JOIN pg_catalog.generate_series(1,200) p;
END;
$seed$;
-- Use three footprints: 5,20,40 rounds x 200 participants.
SELECT public.qa_rank_seed_events(1,5);
ANALYZE public.tournaments;
ANALYZE public.tournament_results;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $bench$
DECLARE initial jsonb; again jsonb; unchanged_rows integer;
        initial_ms numeric; again_ms numeric;
        initial_wal int; again_wal int; initial_reads int; again_reads int;
        initial_temp int; again_temp int;
BEGIN
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT public.recalculate_league_standings_guarded(''00000000-0000-0000-0000-000000000044''::uuid)' INTO initial;
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT public.recalculate_league_standings_guarded(''00000000-0000-0000-0000-000000000044''::uuid)' INTO again;
  SELECT public.recalculate_league_standings_guarded(
    '00000000-0000-0000-0000-000000000044') INTO unchanged_rows;
  IF unchanged_rows<>0 THEN
    RAISE EXCEPTION 'FAIL: idempotent recalc rewrote % unchanged rankings',unchanged_rows;
  END IF;
  initial_ms:=(initial->0->>'Execution Time')::numeric;
  again_ms:=(again->0->>'Execution Time')::numeric;
  initial_wal:=COALESCE((initial->0->'Plan'->>'WAL Records')::int,0);
  again_wal:=COALESCE((again->0->'Plan'->>'WAL Records')::int,0);
  initial_reads:=COALESCE((initial->0->'Plan'->>'Shared Read Blocks')::int,0);
  again_reads:=COALESCE((again->0->'Plan'->>'Shared Read Blocks')::int,0);
  initial_temp:=COALESCE((initial->0->'Plan'->>'Temp Written Blocks')::int,0);
  again_temp:=COALESCE((again->0->'Plan'->>'Temp Written Blocks')::int,0);
  IF initial_ms IS NULL OR again_ms IS NULL THEN RAISE EXCEPTION 'Missing EXPLAIN metrics'; END IF;
  IF again_wal<>0 THEN RAISE EXCEPTION 'FAIL: 1000-row unchanged ranking emitted % WAL records',again_wal; END IF;
  RAISE NOTICE 'QA ranking 5 rounds/1000 rows: initial=%ms WAL=% shared_reads=% temp_writes=%; repeated=%ms WAL=% shared_reads=% temp_writes=%; changed_rows_on_third=0',
    initial_ms,initial_wal,initial_reads,initial_temp,
    again_ms,again_wal,again_reads,again_temp;
END $bench$;
RESET ROLE;
SELECT public.qa_rank_seed_events(6,20);
ANALYZE public.tournaments;
ANALYZE public.tournament_results;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $bench$
DECLARE initial jsonb; again jsonb; unchanged_rows integer;
BEGIN
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT public.recalculate_league_standings_guarded(''00000000-0000-0000-0000-000000000044''::uuid)' INTO initial;
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT public.recalculate_league_standings_guarded(''00000000-0000-0000-0000-000000000044''::uuid)' INTO again;
  SELECT public.recalculate_league_standings_guarded(
    '00000000-0000-0000-0000-000000000044') INTO unchanged_rows;
  IF unchanged_rows<>0 THEN RAISE EXCEPTION 'FAIL: ranking 4000 no-op rewrote rows'; END IF;
  IF COALESCE((again->0->'Plan'->>'WAL Records')::int,0)<>0 THEN
    RAISE EXCEPTION 'FAIL: 4000-row unchanged ranking generated WAL';
  END IF;
  RAISE NOTICE 'QA ranking 20 rounds/4000 rows: initial=%ms WAL=% shared_reads=% temp_writes=%; repeated=%ms WAL=% shared_reads=% temp_writes=%',
    (initial->0->>'Execution Time'),
    (initial->0->'Plan'->>'WAL Records'),(initial->0->'Plan'->>'Shared Read Blocks'),
    (initial->0->'Plan'->>'Temp Written Blocks'),
    (again->0->>'Execution Time'),
    (again->0->'Plan'->>'WAL Records'),(again->0->'Plan'->>'Shared Read Blocks'),
    (again->0->'Plan'->>'Temp Written Blocks');
END $bench$;
RESET ROLE;
SELECT public.qa_rank_seed_events(21,40);
ANALYZE public.tournaments;
ANALYZE public.tournament_results;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $bench$
DECLARE initial jsonb; again jsonb; unchanged_rows integer;
BEGIN
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT public.recalculate_league_standings_guarded(''00000000-0000-0000-0000-000000000044''::uuid)' INTO initial;
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) SELECT public.recalculate_league_standings_guarded(''00000000-0000-0000-0000-000000000044''::uuid)' INTO again;
  SELECT public.recalculate_league_standings_guarded(
    '00000000-0000-0000-0000-000000000044') INTO unchanged_rows;
  IF unchanged_rows<>0 THEN RAISE EXCEPTION 'FAIL: ranking 8000 no-op rewrote rows'; END IF;
  IF COALESCE((again->0->'Plan'->>'WAL Records')::int,0)<>0 THEN
    RAISE EXCEPTION 'FAIL: 8000-row unchanged ranking generated WAL';
  END IF;
  RAISE NOTICE 'QA ranking 40 rounds/8000 rows: initial=%ms WAL=% shared_reads=% temp_writes=%; repeated=%ms WAL=% shared_reads=% temp_writes=%',
    (initial->0->>'Execution Time'),
    (initial->0->'Plan'->>'WAL Records'),(initial->0->'Plan'->>'Shared Read Blocks'),
    (initial->0->'Plan'->>'Temp Written Blocks'),
    (again->0->>'Execution Time'),
    (again->0->'Plan'->>'WAL Records'),(again->0->'Plan'->>'Shared Read Blocks'),
    (again->0->'Plan'->>'Temp Written Blocks');
END $bench$;
RESET ROLE;
DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.tournament_results r
 JOIN public.tournaments t ON t.id=r.tournament_id
 WHERE t.league_id='00000000-0000-0000-0000-000000000044')<>8000
 OR (SELECT count(*) FROM public.league_standings
 WHERE league_id='00000000-0000-0000-0000-000000000044')<>200
 OR (SELECT count(*) FROM public.league_standings
 WHERE league_id='00000000-0000-0000-0000-000000000044'
 AND tournaments_played=40)<>200
 THEN RAISE EXCEPTION 'FAIL: full league ranking lost or duplicated results'; END IF;
 RAISE NOTICE 'PASS: 40 rounds / 8000 inputs / 200 standings, deterministic full result coverage';
END $qa$;
ROLLBACK;
DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM public.leagues
 WHERE id='00000000-0000-0000-0000-000000000044')
 OR to_regprocedure('public.qa_rank_seed_events(integer,integer)') IS NOT NULL
 THEN RAISE EXCEPTION 'FAIL: ranking benchmark fixture persisted'; END IF;
 RAISE NOTICE 'PASS FINAL: benchmark changes fully reverted';
END $qa$;
