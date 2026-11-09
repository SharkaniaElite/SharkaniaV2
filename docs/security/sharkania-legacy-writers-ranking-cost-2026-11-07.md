# SHARKANIA · Integración de escritores heredados y costo real de recálculo de liga

**Fecha:** 7 de noviembre de 2026. **Ámbito:** rama DRAFT del PR #65. **Solo lectura en producción** y pruebas ficticias en PostgreSQL 17 aislado. **No es una migración.**

## 1. Inventario de operaciones heredadas confirmado

Se revisaron `src/components/admin/results-upload.tsx`, `src/components/admin/results-editor.tsx`, `src/lib/api/tournaments.ts` y los permisos de funciones públicas de Supabase mediante consultas de catálogo, sin cambiar datos.

El importador CSV original puede **crear nicknames en una operación separada**, hacer `DELETE` de resultados antiguos, insertar filas, actualizar clasificaciones y ejecutar el cálculo ELO en pasos sucesivos. El editor también reinicia el impacto de resultados y luego vuelve a insertar y recalcular. Estas rutas **no son atómicas**; un error intermedio puede dejar registros parciales.

Permisos de `EXECUTE` verificados en producción:

| RPC heredada | SECURITY DEFINER | authenticated | anon |
|---|---|---|---|
| `delete_tournament_god_mode(uuid)` | Sí | Sí | No |
| `reset_tournament_impact(uuid)` | Sí | Sí | No |
| `bulk_delete_scheduled_tournaments(uuid[])` | Sí | Sí | No |
| `recalculate_league_standings(uuid)` | No | Sí | Sí |
| `update_league_standings(uuid)` | No | Sí | Sí |

**Importante:** el privilegio de ejecución no prueba que cualquier usuario pueda alterar tablas, porque cada función puede comprobar permisos internos o depender de RLS. Sí confirma que **hay que auditar y coordinar las antiguas RPC antes del corte**. Revocarlas de inmediato interrumpiría funciones productivas; ninguna autorización se modificó.

## 2. Interacción real entre escritor protegido y antiguos flujos, exclusivamente QA

- `tests/fixtures/sharkania-league-legacy-writer-integration-qa.sql` instala **simulaciones reducidas del orden de llamadas** de edición, eliminación, recálculo destructivo e importación CSV (no las RPC completas de producción) en `qa_league_race`.
- Las vallas de `docs/security/league-legacy-destructive-delete-fence-2026-11-06.qa-only.sql` rechazan reinicio ELO, eliminación de un torneo de liga y borrado/recreación de standings; resultados, historia ELO, CCP y auditoría permanecen intactos.
- `tests/fixtures/sharkania-league-atomic-concurrency-qa.mjs` hace un ensayo de **bloqueo genuino entre dos conexiones**: una transacción mantiene bloqueado un torneo ya publicado; un editor heredado intenta borrar resultados, **espera un lock PostgreSQL** y, al liberarse, es rechazado con `PT409`. No pierde resultados.
- Un escenario adversarial reproduce una **importación CSV privilegiada parcial en un torneo todavía vacío**. El escritor nuevo detecta la fila heredada y evita una segunda publicación de ELO, pero **no puede revertir la inserción antigua ya ejecutada por separado**. Es un riesgo demostrado en el *modelo de QA*, no una afirmación de que el mismo incidente haya ocurrido en producción.
- Todo el ensayo ejecuta `ROLLBACK` en el componente de integración y no instala controles en Sharkania real.

**No levantar la restricción `VITE_LEAGUE_GUARDED_RPC` hasta reemplazar TODOS los flujos de importación/edición y revocar DML/RPC antiguas mediante un procedimiento de corte probado y con reversión.** No instalar una valla de `BEFORE INSERT` indiscriminada por jugador: podría añadir N bloqueos/consultas por torneo y bloquear al escritor legítimo. Priorizar **una RPC autorizada y revocación de escritores alternativos** en la misma puesta en marcha.

## 3. Medición completa de clasificaciones (ficticia, PostgreSQL 17)

Se añadió `tests/fixtures/sharkania-league-standings-volume-explain-qa.sql`, con 200 jugadores ficticios, hasta 40 torneos y 8.000 filas de resultados. Se replican los índices principales sobre `tournament_results(tournament_id)` y `tournaments(league_id)`. Todas las escrituras se revierten con `ROLLBACK`.

`EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON)` mide el recálculo **con modificaciones** y luego una segunda ejecución **sin cambios**. La primera implementación evitaba el UPDATE final, pero seguía intentando entrar al conflicto `INSERT ... ON CONFLICT` para cada fila sin cambios, generando WAL por las cerraduras de fila.

### Antes de filtrar filas iguales, ejecución del 7 nov

| Filas de resultados | Recalcular con cambios | Segunda ejecución sin cambios | WAL de segunda ejecución |
|---:|---:|---:|---:|
| 1.000 | 7,094 ms | 3,442 ms | 200 |
| 4.000 | 9,842 ms | 7,380 ms | 200 |
| 8.000 | 16,632 ms | 13,109 ms | 200 |

### Después de filtrar ANTES de `ON CONFLICT`, ejecución del 7 nov

| Filas de resultados | Recalcular con cambios | Segunda ejecución sin cambios | WAL de segunda ejecución |
|---:|---:|---:|---:|
| 1.000 | 7,232 ms | 2,814 ms | **0** |
| 4.000 | 10,339 ms | 6,696 ms | **0** |
| 8.000 | 16,901 ms | 12,549 ms | **0** |

`docs/security/league-standings-guarded-2026-11-05.qa-only.sql` ahora hace `LEFT JOIN` a la posición existente y filtra filas sin diferencias **antes de intentar INSERT/ON CONFLICT**, manteniendo una condición adicional `DO UPDATE WHERE IS DISTINCT FROM` como protección ante cambios concurrentes.

**Interpretación correcta:**
- Se midieron **0 WAL records atribuibles a cada segundo recálculo** en los planes `EXPLAIN` de esta ejecución QA, sin cambiar los valores ni las 200 posiciones.
- Eso **no equivale a 0 WAL general de PostgreSQL** ni a 0 uso de recursos. La función sigue leyendo/ordenando los resultados y tomando el bloqueo de liga.
- Son muestras individuales de un runner GitHub, no medianas, no p95, sin concurrencia intensa ni métricas de CPU/swap/IOPS de Supabase Micro. Las pequeñas diferencias en milisegundos no son causalidad demostrada.
- Al crecer los resultados de la liga, aumenta el costo de lectura de cada recálculo. No reemplazar la lógica de `best_dates_to_count`, puntos ni desempates por un cálculo incremental sin probar paridad con ligas reales.

### Gate de regresión incorporado

- `tests/league-db-resource-contract.test.mjs` comprueba que exista el prefiltro antes del conflicto.
- `sharkania-league-standings-volume-explain-qa.sql` falla la suite si alguna segunda ejecución no modificada genera registros WAL en las 3 cargas ficticias ensayadas.
- `tests/fixtures/sharkania-league-standings-guarded-assert.sql` exige 0 filas reescritas si no hubo cambios.
- `tests/fixtures/sharkania-league-atomic-concurrency-qa.mjs` garantiza orden y ausencia de duplicaciones bajo la carrera probada.

## 4. Trabajo pendiente y decisión

1. Sustituir toda importación CSV, resolución de nuevos nicknames, edición y eliminación por flujos atómicos completos y auditados, sin destruir el ELO histórico.
2. Preparar revocación **coordinada** de permisos de escritura directos y funciones heredadas; testear actor, ACL, propietarios, RLS y compatibilidad del frontend actualizado en un entorno cercano al real.
3. Contrastar las consultas en un clon seguro con datos representativos y planes/índices reales; no ejecutar `EXPLAIN ANALYZE` de escrituras sobre Supabase productivo.
4. Probar bloqueos adversariales entre **todos** los escritores aún activos, con reintentos controlados, fallos, backup/restore y límites de tiempo; un test favorable no demuestra ausencia universal de interbloqueos.
5. Conciliar posiciones históricas sin fuente (51), reglas CCP, reentradas, multimoneda y diferencias con `main` antes de retirar un escritor de producción.

**NO GO para desplegar PR #65.** No hay cambios productivos, ni revocación de permisos, ni borrado de índices, ni aplicación de scripts QA en Supabase.
