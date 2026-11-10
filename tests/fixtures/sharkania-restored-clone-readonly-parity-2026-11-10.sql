\set ON_ERROR_STOP on
-- SHARKANIA: READ-ONLY cloned-production parity survey. No writes, no DDL.
-- Run AFTER restoring an explicitly approved isolated backup, with psql.
-- Never conclude GO just because this SELECT survey succeeds; compare with
-- the separately collected 2026-11-10 production aggregate baseline.
\echo === PostgreSQL and database identity (do not display credentials) ===
SELECT pg_catalog.current_database() AS database_name,
       pg_catalog.current_setting('server_version_num') AS postgres_server_version;

\echo === Schema presence and function presence (before/after planned cutover) ===
SELECT
 to_regclass('public.players') IS NOT NULL AS has_players,
 to_regclass('public.elo_history') IS NOT NULL AS has_elo_history,
 to_regclass('public.tournament_results') IS NOT NULL AS has_results,
 to_regclass('public.tournaments') IS NOT NULL AS has_tournaments,
 to_regclass('public.nickname_claims') IS NOT NULL AS has_claims,
 to_regclass('public.league_standings') IS NOT NULL AS has_standings,
 to_regprocedure('public.publish_league_nickname_results_guarded(uuid,jsonb)')
  IS NOT NULL AS league_writer_installed,
 to_regprocedure('public.publish_independent_nickname_results_guarded(uuid,jsonb)')
  IS NOT NULL AS independent_writer_installed,
 to_regprocedure('public.admin_link_player_profile_guarded(uuid,uuid,uuid)')
  IS NOT NULL AS admin_link_installed;

\echo === Aggregate statistics, no rows or personal IDs returned ===
SELECT (SELECT count(*) FROM public.tournaments) AS tournaments,
 (SELECT count(*) FROM public.players) AS players,
 (SELECT count(*) FROM public.tournament_results) AS results,
 (SELECT count(*) FROM public.elo_history) AS elo_events,
 (SELECT count(*) FROM public.tournaments WHERE results_uploaded) AS uploaded,
 (SELECT count(*) FROM public.tournaments
  WHERE results_uploaded AND status::text='scheduled') AS uploaded_but_scheduled,
 (SELECT count(*) FROM public.tournaments
  WHERE results_uploaded AND NOT EXISTS
   (SELECT 1 FROM public.tournament_results r WHERE r.tournament_id=tournaments.id))
   AS uploaded_without_results,
 (SELECT count(*) FROM public.tournament_results r WHERE NOT EXISTS
   (SELECT 1 FROM public.elo_history h
     WHERE h.player_id=r.player_id AND h.tournament_id=r.tournament_id))
   AS results_without_elo,
 (SELECT count(*) FROM public.elo_history h WHERE NOT EXISTS
   (SELECT 1 FROM public.tournament_results r
     WHERE r.player_id=h.player_id AND r.tournament_id=h.tournament_id))
   AS elo_without_results;

\echo === Currency, league affiliation, published and pending counts ===
SELECT currency,league_id IS NOT NULL AS is_league,
 count(*) AS tournaments,
 count(*) FILTER(WHERE results_uploaded) AS uploaded,
 count(*) FILTER(WHERE NOT results_uploaded) AS unpublished
FROM public.tournaments GROUP BY currency,league_id IS NOT NULL
ORDER BY currency,is_league DESC;

\echo === Normalized nickname collisions, duplicate Elo events and league owners ===
SELECT
 (SELECT count(*) FROM (
  SELECT room_id,pg_catalog.lower(pg_catalog.btrim(nickname))
  FROM public.players GROUP BY room_id,pg_catalog.lower(pg_catalog.btrim(nickname))
  HAVING count(*)>1
 ) x) AS normalized_nickname_collisions,
 (SELECT count(*) FROM (
  SELECT player_id,tournament_id FROM public.elo_history
  GROUP BY player_id,tournament_id HAVING count(*)>1
 ) x) AS duplicated_elo_player_tournament,
 (SELECT count(*) FROM public.leagues l WHERE NOT EXISTS(
  SELECT 1 FROM public.league_clubs lc
  WHERE lc.league_id=l.id AND lc.is_primary IS TRUE
 )) AS leagues_without_primary;

\echo === Shared-Elo historical continuity (advisory diagnostic, not a correction) ===
WITH chain AS (
 SELECT eh.player_id,eh.elo_before,
 lag(eh.elo_after) OVER (
   PARTITION BY eh.player_id
   ORDER BY t.start_datetime,eh.recorded_at,eh.id
 ) AS prev_after
 FROM public.elo_history eh
 JOIN public.tournaments t ON t.id=eh.tournament_id
)
SELECT count(*) FILTER(WHERE prev_after IS NOT NULL) AS compared_pairs,
 count(*) FILTER(WHERE prev_after IS NOT NULL AND
   abs(elo_before-prev_after)>0.01) AS historical_discontinuities,
 count(DISTINCT player_id) FILTER(WHERE prev_after IS NOT NULL AND
   abs(elo_before-prev_after)>0.01) AS players_with_discontinuity
FROM chain;

\echo === Critical RLS, privileges and triggers: compare before/after candidate ===
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
 pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT') AS client_can_insert,
 pg_catalog.has_table_privilege('authenticated',c.oid,'DELETE') AS client_can_delete,
 pg_catalog.has_table_privilege('authenticated',c.oid,'UPDATE') AS client_can_table_update
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public'
 AND c.relname IN ('players','elo_history','tournament_results',
  'tournaments','nickname_claims','league_standings')
ORDER BY c.relname;

SELECT
 pg_catalog.has_column_privilege('authenticated','public.players',
   'elo_rating','UPDATE') AS browser_can_update_elo_rating,
 pg_catalog.has_column_privilege('authenticated','public.players',
   'elo_peak','UPDATE') AS browser_can_update_peak,
 pg_catalog.has_column_privilege('authenticated','public.players',
   'total_prize_won','UPDATE') AS browser_can_update_prize,
 pg_catalog.has_column_privilege('authenticated','public.players',
   'profile_id','UPDATE') AS browser_can_reassign_identity,
 pg_catalog.has_column_privilege('authenticated','public.players',
   'nickname','UPDATE') AS browser_can_update_nickname;

SELECT c.relname AS table_name,t.tgname AS trigger_name,
 pg_catalog.pg_get_triggerdef(t.oid,true) AS definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal
 AND c.relname IN ('tournaments','tournament_results','elo_history',
   'players','profiles')
ORDER BY c.relname,t.tgname;

\echo === Privileged writer function signatures: manual security review required ===
SELECT p.proname AS function_name,
 pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
 p.prosecdef AS security_definer,
 pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_can_execute,
 pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') AS signed_in_can_execute
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
 AND p.proname IN ('delete_tournament_god_mode','reset_tournament_impact',
 'bulk_delete_scheduled_tournaments','create_tournament_from_template',
 'publish_league_nickname_results_guarded',
 'publish_independent_nickname_results_guarded','admin_link_player_profile_guarded')
ORDER BY p.proname;

\echo === End: SELECT only. Never run non-read-only SQL against production without authorization. ===
