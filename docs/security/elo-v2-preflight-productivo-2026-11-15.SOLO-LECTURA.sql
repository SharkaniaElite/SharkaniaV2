-- SHARKANIA ELO v2 | PREFLIGHT DE CATÁLOGO EN MODO SOLO LECTURA
-- Fecha de preparación 2026-11-15 | No altera datos, roles, tablas, cron, Vault ni configuraciones.
-- Prohibido modificar estas SELECT por sentencias DDL/DML.
-- No ejecuta backups, restauraciones, pruebas de negocio ni exporta registros personales.
-- Ejecutar únicamente tras reconfirmar la identidad del proyecto y la autorización de lectura.

-- 1. Versiones registradas vs candidato propuesto (la comparación con las 54 rutas Git se hace fuera del SQL).
SELECT count(*)::int AS versiones_aplicadas,
       max(version) AS ultima_version,
       count(*) FILTER (WHERE version='20261113182000')::int AS elo_v2_aplicada
FROM supabase_migrations.schema_migrations;

-- 2. Estado de esquema/activación; ausencia esperada antes del GO.
SELECT current_setting('server_version') AS version_postgresql,
       to_regnamespace('sharkania_release') IS NOT NULL AS esquema_elo_release_existe,
       to_regclass('sharkania_release.elo_v2_activation') IS NOT NULL AS tabla_activacion_existe,
       to_regclass('sharkania_release.fx_observation_v2') IS NOT NULL AS tabla_fx_existe;

-- 3. Extensiones relevantes; solo nombres, nunca secretos ni configuraciones sensibles.
SELECT extname FROM pg_extension
WHERE extname IN ('pg_cron','pg_net','supabase_vault')
ORDER BY extname;

-- 4. Preservar nombre y cadencia de cron activos. NO consultar job.command ni Vault.
SELECT jobname, schedule, active FROM cron.job WHERE active ORDER BY jobname;

-- 5. Catálogo de ACL y RLS: tener privilegio a nivel tabla no omite políticas RLS.
SELECT c.relname AS tabla, c.relrowsecurity AS rls,
       count(DISTINCT pol.polname)::int AS numero_politicas,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_lectura,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS autenticado_lectura,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS autenticado_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') AS autenticado_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') AS autenticado_delete
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policy pol ON pol.polrelid=c.oid
WHERE n.nspname='public' AND c.relkind IN ('r','p')
AND c.relname IN ('players','leagues','league_clubs','league_rooms','tournaments',
                  'tournament_results','elo_history','league_standings','nickname_claims')
GROUP BY c.oid,c.relname,c.relrowsecurity ORDER BY c.relname;

-- 6. RPC críticas; firmas y permisos, sin cuerpos de funciones, tokens ni PII.
SELECT p.proname AS funcion, pg_get_function_identity_arguments(p.oid) AS firma,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS autenticado_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
AND p.proname IN (
 'create_league_guarded','save_league_guarded',
 'publish_league_nickname_results_guarded','publish_independent_nickname_results_guarded',
 'admin_link_player_profile_guarded','sharkania_fx_ingest_official_v2',
 'sharkania_fx_record_feed_check_v2','bulk_delete_scheduled_tournaments',
 'delete_tournament_god_mode','reset_tournament_impact','recalculate_league_standings',
 'verify_ignition_pending_player','request_my_ignition_link'
) ORDER BY p.proname;

-- 7. Lista de triggers de tablas afectadas; no extrae código ejecutable.
SELECT c.relname AS tabla,t.tgname AS trigger,t.tgenabled AS habilitado
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal
AND c.relname IN ('players','leagues','league_clubs','league_rooms','tournaments',
                  'tournament_results','elo_history','league_standings')
ORDER BY c.relname,t.tgname;

-- 8. Conteos agregados; nunca seleccionar filas de jugadores, usuarios o historial individual.
SELECT (SELECT count(*)::int FROM public.players) AS jugadores,
       (SELECT count(*)::int FROM public.tournaments) AS torneos,
       (SELECT count(*)::int FROM public.tournament_results) AS resultados,
       (SELECT count(*)::int FROM public.elo_history) AS registros_elo,
       (SELECT count(*)::int FROM public.league_standings) AS posiciones_liga,
       (SELECT count(*)::int FROM public.leagues) AS ligas,
       (SELECT count(*)::int FROM public.league_clubs) AS ligas_clubes,
       (SELECT count(*)::int FROM public.league_rooms) AS ligas_salas;

-- 9. Storage: cuenta metadatos, NO confirma recuperabilidad de objetos físicos.
SELECT (SELECT count(*)::int FROM storage.buckets) AS buckets,
       (SELECT count(*)::int FROM storage.objects) AS objetos_registrados;

-- FIN. ESTA ES UNA INSPECCION; NO ES BACKUP NI INSTRUCCION DE DESPLIEGUE.
