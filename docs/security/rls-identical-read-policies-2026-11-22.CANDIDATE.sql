-- CANDIDATE ONLY, NOT AUTHORIZED FOR PRODUCTION.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.league_standings'::regclass AND polname='Standings: lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.league_standings'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.league_standings'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.league_standings','SELECT') OR NOT has_table_privilege('authenticated','public.league_standings','SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.league_standings'::regclass AND polname='Permitir lectura publica de posiciones' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.league_standings'::regclass AND polname='Permitir lectura publica de posiciones de liga' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) THEN
    RAISE EXCEPTION 'Policy precondition failed: league_standings';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.current_league_champion'::regclass AND polname='Permitir lectura publica de campeones' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.current_league_champion'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.current_league_champion'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.current_league_champion','SELECT') OR NOT has_table_privilege('authenticated','public.current_league_champion','SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.current_league_champion'::regclass AND polname='Permitir lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) THEN
    RAISE EXCEPTION 'Policy precondition failed: current_league_champion';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.league_rooms'::regclass AND polname='League rooms: lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.league_rooms'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.league_rooms'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.league_rooms','SELECT') OR NOT has_table_privilege('authenticated','public.league_rooms','SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.league_rooms'::regclass AND polname='Permitir leer league_rooms' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) THEN
    RAISE EXCEPTION 'Policy precondition failed: league_rooms';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.leagues'::regclass AND polname='Leagues: lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.leagues'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.leagues'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.leagues','SELECT') OR NOT has_table_privilege('authenticated','public.leagues','SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.leagues'::regclass AND polname='Permitir lectura publica de ligas' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) THEN
    RAISE EXCEPTION 'Policy precondition failed: leagues';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.players'::regclass AND polname='Players: lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.players'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.players'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.players','SELECT') OR NOT has_table_privilege('authenticated','public.players','SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.players'::regclass AND polname='Permitir lectura publica de jugadores' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) THEN
    RAISE EXCEPTION 'Policy precondition failed: players';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.site_settings'::regclass AND polname='Public read site_settings' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.site_settings'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.site_settings'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.site_settings','SELECT') OR NOT has_table_privilege('authenticated','public.site_settings','SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.site_settings'::regclass AND polname='Permitir lectura de site_settings' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) THEN
    RAISE EXCEPTION 'Policy precondition failed: site_settings';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.tournament_results'::regclass AND polname='Results: lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.tournament_results'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.tournament_results'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.tournament_results','SELECT') OR NOT has_table_privilege('authenticated','public.tournament_results','SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.tournament_results'::regclass AND polname='Permitir lectura publica de resultados de torneos' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) THEN
    RAISE EXCEPTION 'Policy precondition failed: tournament_results';
  END IF;
END;
$guard$;
DROP POLICY "Permitir lectura publica de posiciones" ON public.league_standings;
DROP POLICY "Permitir lectura publica de posiciones de liga" ON public.league_standings;
DROP POLICY "Permitir lectura publica" ON public.current_league_champion;
DROP POLICY "Permitir leer league_rooms" ON public.league_rooms;
DROP POLICY "Permitir lectura publica de ligas" ON public.leagues;
DROP POLICY "Permitir lectura publica de jugadores" ON public.players;
DROP POLICY "Permitir lectura de site_settings" ON public.site_settings;
DROP POLICY "Permitir lectura publica de resultados de torneos" ON public.tournament_results;
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.league_standings'::regclass AND polname='Standings: lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.league_standings'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.league_standings'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.league_standings','SELECT') OR NOT has_table_privilege('authenticated','public.league_standings','SELECT')
     OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.league_standings'::regclass AND polname='Permitir lectura publica de posiciones') OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.league_standings'::regclass AND polname='Permitir lectura publica de posiciones de liga') THEN
    RAISE EXCEPTION 'Policy precondition failed: league_standings';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.current_league_champion'::regclass AND polname='Permitir lectura publica de campeones' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.current_league_champion'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.current_league_champion'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.current_league_champion','SELECT') OR NOT has_table_privilege('authenticated','public.current_league_champion','SELECT')
     OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.current_league_champion'::regclass AND polname='Permitir lectura publica') THEN
    RAISE EXCEPTION 'Policy precondition failed: current_league_champion';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.league_rooms'::regclass AND polname='League rooms: lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.league_rooms'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.league_rooms'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.league_rooms','SELECT') OR NOT has_table_privilege('authenticated','public.league_rooms','SELECT')
     OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.league_rooms'::regclass AND polname='Permitir leer league_rooms') THEN
    RAISE EXCEPTION 'Policy precondition failed: league_rooms';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.leagues'::regclass AND polname='Leagues: lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.leagues'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.leagues'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.leagues','SELECT') OR NOT has_table_privilege('authenticated','public.leagues','SELECT')
     OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.leagues'::regclass AND polname='Permitir lectura publica de ligas') THEN
    RAISE EXCEPTION 'Policy precondition failed: leagues';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.players'::regclass AND polname='Players: lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.players'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.players'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.players','SELECT') OR NOT has_table_privilege('authenticated','public.players','SELECT')
     OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.players'::regclass AND polname='Permitir lectura publica de jugadores') THEN
    RAISE EXCEPTION 'Policy precondition failed: players';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.site_settings'::regclass AND polname='Public read site_settings' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.site_settings'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.site_settings'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.site_settings','SELECT') OR NOT has_table_privilege('authenticated','public.site_settings','SELECT')
     OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.site_settings'::regclass AND polname='Permitir lectura de site_settings') THEN
    RAISE EXCEPTION 'Policy precondition failed: site_settings';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.tournament_results'::regclass AND polname='Results: lectura publica' AND polcmd='r' AND polpermissive AND polroles=ARRAY[0::oid] AND pg_get_expr(polqual,polrelid)='true' AND polwithcheck IS NULL) OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.tournament_results'::regclass AND relrowsecurity AND NOT relforcerowsecurity) OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.tournament_results'::regclass AND NOT polpermissive) OR NOT has_table_privilege('anon','public.tournament_results','SELECT') OR NOT has_table_privilege('authenticated','public.tournament_results','SELECT')
     OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.tournament_results'::regclass AND polname='Permitir lectura publica de resultados de torneos') THEN
    RAISE EXCEPTION 'Policy precondition failed: tournament_results';
  END IF;
END;
$guard$;
COMMIT;
