\set ON_ERROR_STOP on
-- SHARKANIA synthetic index comparison, disposable QA database ONLY.
-- Mimic the two unique (league_id,player_id) indexes seen on production.
-- Proves uniqueness survives removing an independent duplicate IN QA,
-- NOT that removing production indexes is authorized or performance neutral.
BEGIN;
CREATE TABLE public.qa_index_probe(
 id uuid PRIMARY KEY,
 league_id uuid NOT NULL,
 player_id uuid NOT NULL,
 total_points numeric NOT NULL DEFAULT 0
);
INSERT INTO public.qa_index_probe(id,league_id,player_id,total_points)
SELECT md5('standing-'||g::text)::uuid,
       md5('league-'||((g-1)/250)::text)::uuid,
       md5('player-'||((g-1)%250)::text)::uuid,
       (g%900)::numeric
FROM generate_series(1,25000) AS g;
ALTER TABLE public.qa_index_probe
 ADD CONSTRAINT qa_standings_league_player_key UNIQUE (league_id,player_id);
CREATE UNIQUE INDEX qa_standings_duplicate_unique
 ON public.qa_index_probe(league_id,player_id);
CREATE INDEX qa_standings_by_league ON public.qa_index_probe(league_id);
ANALYZE public.qa_index_probe;

DO $qa$
DECLARE
 p jsonb;
 plan_type text;
 hits integer;
BEGIN
 EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,total_points FROM public.qa_index_probe WHERE league_id=md5(''league-41'')::uuid AND player_id=md5(''player-90'')::uuid' INTO p;
 plan_type:=p->0->'Plan'->>'Node Type';
 hits:=COALESCE((p->0->'Plan'->>'Shared Hit Blocks')::integer,0);
 IF plan_type NOT IN ('Index Scan','Index Only Scan') THEN
  RAISE EXCEPTION 'FAIL: synthetic equality lookup not index-backed: %',plan_type;
 END IF;
 RAISE NOTICE 'QA both unique indexes present: plan=%; shared hits=%; execution=%ms',
   plan_type,hits,(p->0->>'Execution Time');
END $qa$;

-- Only a disposable, independent duplicate is removed. Production's
-- constraint-backed unique index remains untouched by this test.
DROP INDEX public.qa_standings_duplicate_unique;
ANALYZE public.qa_index_probe;
DO $qa$
DECLARE
 p jsonb;
 plan_type text;
 hits integer;
 found integer;
BEGIN
 EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,total_points FROM public.qa_index_probe WHERE league_id=md5(''league-41'')::uuid AND player_id=md5(''player-90'')::uuid' INTO p;
 plan_type:=p->0->'Plan'->>'Node Type';
 hits:=COALESCE((p->0->'Plan'->>'Shared Hit Blocks')::integer,0);
 IF plan_type NOT IN ('Index Scan','Index Only Scan') THEN
  RAISE EXCEPTION 'FAIL: indexed access lost after dropping only duplicate in QA';
 END IF;
 SELECT count(*) INTO found FROM public.qa_index_probe
 WHERE league_id=md5('league-41')::uuid AND player_id=md5('player-90')::uuid;
 IF found<>1 THEN RAISE EXCEPTION 'FAIL: lookup changed after removing QA duplicate'; END IF;
 BEGIN
  INSERT INTO public.qa_index_probe(id,league_id,player_id,total_points)
  VALUES (gen_random_uuid(),md5('league-41')::uuid,md5('player-90')::uuid,100);
  RAISE EXCEPTION 'FAIL: uniqueness constraint bypassed after QA duplicate removal';
 EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: constraint-backed UNIQUE still prevents duplicates';
 END;
 RAISE NOTICE 'QA duplicate index removed: plan=%; shared hits=%; execution=%ms',
  plan_type,hits,(p->0->>'Execution Time');
END $qa$;
ROLLBACK;
DO $qa$
BEGIN
 IF to_regclass('public.qa_index_probe') IS NOT NULL
 THEN RAISE EXCEPTION 'FAIL: synthetic index probe table persisted'; END IF;
 RAISE NOTICE 'PASS FINAL: index plan and constraint comparison fully rolled back';
END $qa$;
