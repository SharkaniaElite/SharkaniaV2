-- QA ONLY: synthetic 34 leagues, 6038 standings, PostgreSQL 17.
\set ON_ERROR_STOP on
CREATE TABLE public.qa_league_standings(league_id integer NOT NULL,player_id integer NOT NULL,rank_position integer NOT NULL, total_points numeric, UNIQUE(league_id,player_id));
CREATE INDEX qa_league_duplicate ON public.qa_league_standings(league_id,player_id);
CREATE INDEX qa_league_lookup ON public.qa_league_standings(league_id);
INSERT INTO public.qa_league_standings SELECT l,p,p,1000-p FROM generate_series(1,34) l CROSS JOIN LATERAL generate_series(1, CASE WHEN l<=20 THEN 178 ELSE 177 END) p;
ANALYZE public.qa_league_standings;
CREATE TEMP TABLE qa_before AS SELECT league_id,player_id FROM public.qa_league_standings WHERE rank_position=1;
\echo baseline
EXPLAIN (ANALYZE,BUFFERS,TIMING OFF) SELECT league_id,player_id FROM public.qa_league_standings WHERE rank_position=1;
CREATE INDEX qa_league_champion_partial ON public.qa_league_standings(league_id,player_id) WHERE rank_position=1;
DROP INDEX public.qa_league_duplicate;
ANALYZE public.qa_league_standings;
\echo candidate
EXPLAIN (ANALYZE,BUFFERS,TIMING OFF) SELECT league_id,player_id FROM public.qa_league_standings WHERE rank_position=1;
DO $$BEGIN
 IF EXISTS ((SELECT league_id,player_id FROM public.qa_league_standings WHERE rank_position=1 EXCEPT SELECT * FROM qa_before) UNION ALL (SELECT * FROM qa_before EXCEPT SELECT league_id,player_id FROM public.qa_league_standings WHERE rank_position=1)) THEN RAISE EXCEPTION 'result drift'; END IF;
 BEGIN INSERT INTO public.qa_league_standings VALUES(1,1,2,0); RAISE EXCEPTION 'duplicate standing accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
END$$;
SELECT pg_relation_size('public.qa_league_champion_partial') AS candidate_bytes;
\echo PASS: synthetic champion results and uniqueness preserved.
