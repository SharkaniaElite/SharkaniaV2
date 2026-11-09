# Sharkania — Corte servidor de ligas, estado real y criterios GO/NO-GO

**Fecha:** 9 de noviembre de 2026. **Estado: QA-ONLY / NO GO producción.**
**Seguimiento:** Issue #81, frontend ya integrado PR #85, backend QA PR #86.

## Qué se comprobó directamente sin escribir en producción

- Proyecto Supabase productivo: `nhpjzywfzljtlqaigzed`. Solo consultas `SELECT` de metadatos y agregados.
- **34 ligas, 41 asociaciones liga-club y 5.863 posiciones** en la consulta de corte.
- Exactamente **8 políticas heredadas de escritura** en `leagues`, `league_clubs` y `league_rooms`, junto con otras políticas de SELECT y 3 reglas de salas superadmin. La propuesta exige esos ocho nombres exactos y rechaza reglas DML desconocidas, incluso `FOR ALL`.
- **0 ligas sin exactamente un organizador principal**; el índice P0 `league_clubs_one_primary_per_league_guarded` es único, válido y opera sobre `league_id` con `is_primary IS TRUE`; la migración P0 ya está en historial y GitHub mediante PR #84. **Nunca repetir P0.**
- `recalculate_league_standings` y `update_league_standings` aún son `SECURITY INVOKER` ejecutables por `anon` y `authenticated`; su efecto depende de RLS, no inferir explotación por el permiso de invocación.
- `delete_tournament_god_mode`, `reset_tournament_impact` y `bulk_delete_scheduled_tournaments` siguen `SECURITY DEFINER`, propiedad de `postgres`, ejecutables por `authenticated` y no por `anon`. Revisar sus cuerpos/autorización y sustituir/limitar su acceso de forma coordinada, nunca revocarlos como cambio aislado.

## Ya implementado en QA — PR #86

- Propuesta SQL de seis RPC protegidas y RLS de ligas, sin convertirla aún en migración versionada.
- PostgreSQL 17 efímero: creación, edición, salas, clonación, borrado solo vacío, rol organizador/secundario/jugador/superadmin, grants reales y lectura pública; tests con identidades ficticias.
- Preflight fail-closed ante política de escritura desconocida, ausencia de política legacy, liga sin organizador o índice P0 con el nombre correcto pero definición insegura.
- El cliente PR #85 ya está publicado con `VITE_LEAGUE_GUARDED_RPC` OFF. Las funciones backend todavía no están instaladas.

## Bloqueos para activar o aplicar el corte en Supabase

1. **Torneos y resultados:** probar una transición de escritores heredados de CSV, edición, borrado, reinicio de ELO y recálculo de clasificación sin resultados parciales. Con el flag en ON, el cliente actual bloquea intencionalmente operaciones de resultados en torneos vinculados a ligas. No sacrificar esa función de negocio en silencio.
2. **Integridad de ligas en torneos:** cerrar la asociación arbitraria `tournaments.league_id` y sus accesos alternativos; aprobar las reglas de ligas multi-club antes de publicar los grants nuevos.
3. **Paridad con PostgREST y Auth reales:** los escenarios PG17 aislados verifican permisos SQL; falta una instancia QA con el frontend, GoTrue/REST y pruebas con sesión, sin vincular a la base productiva. Las vistas previas `.pages.dev` existentes pueden incrustar Supabase productivo.
4. **Catálogo y recuperación:** inventariar ACL de propietarios/funciones/default privileges, respaldar con restauración verificada, preflight a la hora del corte y política de rollback que **nunca vuelva a abrir** las ocho rutas vulnerables.
5. **Migración única y autorización:** generar migración versionada desde el estado actual, demostrar las pruebas finales y solicitar aprobación específica antes de cualquier ejecución productiva o activación del flag.

**Decisión:** mantener la web actual funcionando, evitar superponer la alternativa PR #80 y no fusionar el SQL de propuesta a una rama de publicación automática.

## Próximo trabajo, cerrado y verificable

- [ ] QA de `tournaments.league_id` y de todas las RPC heredadas con datos ficticios y prueba de rollback.
- [ ] Escritor de resultados compatible con las monedas y operaciones históricas, o plan de mantenimiento aceptado explícitamente sin pérdida de datos.
- [ ] Ejercicio de Auth/REST y permisos integrado sobre instancia separada.
- [ ] Versión productiva de migración + snapshot/reversión y autorización para cutover.
