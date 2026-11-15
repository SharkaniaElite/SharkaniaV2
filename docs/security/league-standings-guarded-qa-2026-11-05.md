# Release A — prototipo de recálculo autorizado (QA, 5 noviembre 2026)

**Estado: SOLO PRUEBAS, NO GO PARA PRODUCCIÓN.** No es una migración, no se instala en Supabase productivo, no se enciende `VITE_LEAGUE_GUARDED_RPC` ni se sustituye el motor de ELO.

## Alcance implementado en el PR #65

- Función `public.recalculate_league_standings_guarded(uuid)` propuesta en `docs/security/league-standings-guarded-2026-11-05.qa-only.sql`.
- Usa `auth.uid()`, exige un club organizador principal único y autoriza únicamente a su administrador o al superadministrador. Rechaza anónimos y administradores de clubes solamente participantes. Revoca EXECUTE público en el prototipo.
- Serializa invocaciones contra una misma liga mediante `FOR UPDATE` sobre `leagues`. Los futuros escritores de resultados deberán obedecer el mismo protocolo: el bloqueo aislado **no garantiza** que otros procesos heredados no cambien los datos a la vez.
- **No emplea DELETE sobre `league_standings`.** Si encuentra alguna posición histórica sin resultados fuente, rechaza toda la operación de la liga antes de escribir (error PT409). Protege las 51 filas históricas de las dos ligas identificadas, sin atribuirles automáticamente un origen.
- Calcula las mejores N fechas (o todas si NULL), todas las participaciones, mejor posición, mesas finales y orden determinista con `player_id` como último desempate.
- Inserta nuevas posiciones o actualiza mediante `ON CONFLICT(league_id,player_id)`. En filas existentes preserva el `id`, el CCP bloqueado, el contador de inscripciones y `last_tournament_id`. El CCP inicial y los registros de una nueva posición son una **hipótesis de QA**, no una política de negocio validada para producción.
- Los cambios a resultado/estadísticas de jugador, premios, `elo_history` y ELO quedan completamente fuera del prototipo.

## Pruebas integradas

`tests/fixtures/sharkania-league-standings-guarded-setup.sql` instala un esquema mínimo totalmente ficticio, solo dentro de una base PostgreSQL 17 efímera del GitHub Actions existente. Se prueban:

1. Rechazo de admin B (club participante), jugador ordinario y permiso EXECUTE anónimo.
2. Recálculo por admin A, conservación de identificador y valores CCP/inscripciones bloqueados, e inclusión de nuevo participante.
3. Rechazo fail-closed de una liga con posición huérfana incluso para superadministrador, sin pérdida de filas.
4. Segunda ejecución autorizada: sin duplicados ni modificación de datos históricos bloqueados.
5. Contratos de código y revocaciones, sin conexión a recursos productivos.

Las afirmaciones de PASS deben esperar el resultado de CI del **último HEAD** del PR. Estos ensayos usan un `auth.uid()` sintético respaldado por GUC de prueba; **NO** equivalen todavía a un E2E real con GoTrue/PostgREST, aunque el PR #65 sí tiene otra suite aislada de Auth para administración de ligas.

## Bloqueos de publicación

- La línea base es dinámica: 34 ligas, 5.752 posiciones y 20.646 resultados en la lectura del 5/11. La comparación sombra detectó 51 posiciones sin fuente (27 Luxowin septiembre, 24 CCP agosto), 1.447 diferencias de rango candidato y decisiones no resueltas sobre CCP/reentradas.
- La función de QA todavía no cierra escrituras directas del navegador ni desactiva la antigua RPC `recalculate_league_standings`; eso debe coordinarse en una migración versionada y transacción con rutas frontend, permisos/RLS y plan de rollback.
- El procesamiento de cargas/ediciones de torneos incluye pasos relacionados con ELO, por lo que **no debe habilitarse automáticamente** al terminar estas pruebas.
- Faltan tests de concurrencia con escritores de resultados, paridad completa de ACL/propietarios, backups y restauración productivos, compatibilidad de todas las rutas legacy y revisión de seguridad de SECURITY DEFINER.
- El preview de Cloudflare para el PR puede estar conectado a Supabase real: **no hacer pruebas de escritura allí**.

Siguiente etapa: revisar resultados de QA, resolver fallos, documentar qué política de liga se aplica a las excepciones históricas y solo entonces preparar una migración coordinada para aprobación expresa del propietario.
