-- Disposable PostgreSQL only. No production data or connection.
CREATE TABLE leagues(id int PRIMARY KEY,end_date date NOT NULL);
CREATE TABLE players(id int PRIMARY KEY,nickname text NOT NULL);
CREATE TABLE league_standings(league_id int REFERENCES leagues,player_id int REFERENCES players,rank_position int NOT NULL,PRIMARY KEY(league_id,player_id));
INSERT INTO leagues SELECT n,DATE '2026-11-22'-(n-1) FROM generate_series(1,34)n;
INSERT INTO players SELECT n,'qa-'||n FROM generate_series(1,1844)n;
INSERT INTO league_standings SELECT l.id,((l.id*71+p-1)%1844)+1,p FROM leagues l CROSS JOIN generate_series(1,177)p;
INSERT INTO league_standings SELECT l.id,((l.id*71+177)%1844)+1,178 FROM leagues l WHERE l.id<=20;
ANALYZE;
CREATE ROLE qa_reader NOLOGIN;
GRANT USAGE ON SCHEMA public TO qa_reader;
GRANT SELECT ON leagues,players,league_standings TO qa_reader;
ALTER TABLE league_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_standings ON league_standings FOR SELECT TO qa_reader USING(true);
CREATE TEMP TABLE qa_reference AS SELECT s.league_id,p.nickname,l.end_date FROM league_standings s JOIN leagues l ON l.id=s.league_id JOIN players p ON p.id=s.player_id WHERE rank_position=1 AND l.end_date BETWEEN DATE '2026-11-18' AND DATE '2026-11-22';
GRANT SELECT ON qa_reference TO qa_reader;
\echo BASELINE
SET ROLE qa_reader;
PREPARE champion(int,date,date) AS SELECT s.league_id,p.nickname,l.end_date FROM league_standings s JOIN leagues l ON l.id=s.league_id JOIN players p ON p.id=s.player_id WHERE s.rank_position=$1 AND l.end_date BETWEEN $2 AND $3;
SET plan_cache_mode=force_custom_plan;
EXPLAIN (ANALYZE,BUFFERS) EXECUTE champion(1,'2026-11-18','2026-11-22');
SET plan_cache_mode=force_generic_plan;
EXPLAIN (ANALYZE,BUFFERS) EXECUTE champion(1,'2026-11-18','2026-11-22');
DEALLOCATE champion;
RESET ROLE;
CREATE INDEX qa_partial ON league_standings(league_id,player_id) WHERE rank_position=1;
ANALYZE league_standings;
\echo PARTIAL
SET ROLE qa_reader;
PREPARE champion(int,date,date) AS SELECT s.league_id,p.nickname,l.end_date FROM league_standings s JOIN leagues l ON l.id=s.league_id JOIN players p ON p.id=s.player_id WHERE s.rank_position=$1 AND l.end_date BETWEEN $2 AND $3;
SET plan_cache_mode=force_custom_plan;
EXPLAIN (ANALYZE,BUFFERS) EXECUTE champion(1,'2026-11-18','2026-11-22');
SET plan_cache_mode=force_generic_plan;
EXPLAIN (ANALYZE,BUFFERS) EXECUTE champion(1,'2026-11-18','2026-11-22');
DEALLOCATE champion;
RESET ROLE;
SELECT pg_relation_size('qa_partial') AS partial_bytes;
DROP INDEX qa_partial;
CREATE INDEX qa_composite ON league_standings(rank_position,league_id,player_id);
ANALYZE league_standings;
\echo COMPOSITE
SET ROLE qa_reader;
PREPARE champion(int,date,date) AS SELECT s.league_id,p.nickname,l.end_date FROM league_standings s JOIN leagues l ON l.id=s.league_id JOIN players p ON p.id=s.player_id WHERE s.rank_position=$1 AND l.end_date BETWEEN $2 AND $3;
SET plan_cache_mode=force_custom_plan;
EXPLAIN (ANALYZE,BUFFERS) EXECUTE champion(1,'2026-11-18','2026-11-22');
SET plan_cache_mode=force_generic_plan;
EXPLAIN (ANALYZE,BUFFERS) EXECUTE champion(1,'2026-11-18','2026-11-22');
DEALLOCATE champion;
DO $$BEGIN IF EXISTS(SELECT * FROM qa_reference EXCEPT SELECT s.league_id,p.nickname,l.end_date FROM league_standings s JOIN leagues l ON l.id=s.league_id JOIN players p ON p.id=s.player_id WHERE rank_position=1 AND l.end_date BETWEEN DATE '2026-11-18' AND DATE '2026-11-22') OR (SELECT count(*) FROM qa_reference)<>5 THEN RAISE EXCEPTION 'champion mismatch'; END IF; END$$;
RESET ROLE;
SELECT pg_relation_size('qa_composite') AS composite_bytes;
\echo PASS: synthetic champion result preserved. No production index created.
