-- SHARKANIA: READ-ONLY production cutover catalog review.
-- Safe to SELECT, NEVER use this file as a migration.
-- This intentionally returns only counts/flags, no emails, passwords or rows.
WITH
p0 AS (
 SELECT count(*) AS migrations FROM supabase_migrations.schema_migrations
 WHERE version='20261107191558'
),
primary_index AS (
 SELECT bool_or(
  i.indisunique AND i.indisvalid AND i.indisready
  AND pg_catalog.pg_get_indexdef(i.indexrelid,1,true)='league_id'
  AND pg_catalog.pg_get_expr(i.indpred,i.indrelid) ILIKE '%is_primary IS TRUE%'
 ) AS valid
 FROM pg_catalog.pg_index i
 JOIN pg_catalog.pg_class idx ON idx.oid=i.indexrelid
 WHERE i.indrelid='public.league_clubs'::regclass
  AND idx.relname='league_clubs_one_primary_per_league_guarded'
),
policy_count AS (
 SELECT count(*) AS n FROM pg_catalog.pg_policies
 WHERE schemaname='public'
 AND ((tablename='leagues' AND policyname IN
 ('Leagues: admin puede crear','Leagues: admin o super editar','Leagues: admin o super eliminar'))
 OR (tablename='league_clubs' AND policyname IN
 ('League clubs: admin insert','League clubs: admin update','League clubs: admin delete'))
 OR (tablename='league_rooms' AND policyname IN
 ('Permitir insertar league_rooms','Permitir borrar league_rooms')))
),
orphan AS (
 SELECT count(*) AS bad FROM (
 SELECT l.id FROM public.leagues l
 LEFT JOIN public.league_clubs c ON c.league_id=l.id AND c.is_primary IS TRUE
 GROUP BY l.id HAVING count(c.id)<>1
 ) q
),
mixed AS (
 SELECT count(*) AS bad FROM (
 SELECT league_id FROM public.tournaments
 WHERE league_id IS NOT NULL
 GROUP BY league_id HAVING count(DISTINCT currency)>1
 ) q
),
elo_chain AS (
 SELECT count(*) AS discontinuities FROM (
  SELECT h.player_id,h.elo_before,
   pg_catalog.lag(h.elo_after) OVER(PARTITION BY h.player_id ORDER BY h.recorded_at,h.id) AS previous
  FROM public.elo_history h
 ) e WHERE previous IS NOT NULL AND abs(elo_before-previous)>0.011
),
exposure AS (
 SELECT count(*) AS auth_dml_tables
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON c.relnamespace=n.oid
 WHERE n.nspname='public'
 AND c.relname IN ('tournaments','tournament_results','elo_history','players',
                    'league_standings','leagues','league_rooms','league_clubs')
 AND (pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT')
   OR pg_catalog.has_table_privilege('authenticated',c.oid,'UPDATE')
   OR pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE'))
),
legacy_rpc AS (
 SELECT count(*) AS executable_legacy_definer FROM pg_catalog.pg_proc p
 WHERE p.pronamespace='public'::regnamespace AND p.prosecdef
 AND p.proname IN ('delete_tournament_god_mode','reset_tournament_impact',
  'bulk_delete_scheduled_tournaments')
 AND pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
)
SELECT (SELECT migrations FROM p0) AS p0_migration_records,
       (SELECT coalesce(valid,false) FROM primary_index) AS p0_unique_index_valid,
       (SELECT n FROM policy_count) AS legacy_league_write_policy_count,
       (SELECT bad FROM orphan) AS leagues_without_one_primary,
       (SELECT bad FROM mixed) AS leagues_with_mixed_currencies,
       (SELECT discontinuities FROM elo_chain) AS historical_elo_chain_breaks,
       (SELECT auth_dml_tables FROM exposure) AS authenticated_direct_dml_table_count,
       (SELECT executable_legacy_definer FROM legacy_rpc) AS authenticated_legacy_definer_count,
       (SELECT count(*) FROM pg_catalog.pg_proc p
        WHERE p.pronamespace='public'::regnamespace
          AND p.proname IN ('publish_league_results_v2_qa',
             'publish_league_nickname_results_v2_qa')) AS v2_qa_rpcs_in_production;
