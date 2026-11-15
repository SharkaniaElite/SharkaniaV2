# SHARKANIA — Presupuesto de recursos para cambios de web y base de datos

**Fecha:** 6 de noviembre de 2026 · PR #65, solo QA. Esta es una regla de diseño para cambios futuros, no una migración ni una aprobación de producción.

## Principio obligatorio

Sharkania debe minimizar **CPU, RAM, I/O de disco, WAL, número de llamadas y bloqueos** en Supabase, manteniendo seguridad e integridad transaccional. El diagnóstico anterior de soporte atribuyó la caída a saturación de RAM/swap y agotamiento del balance I/O de la instancia Nano, NO a demasiadas conexiones. Una mejora funcional no queda lista solo porque compile: debe demostrar que su costo está acotado y que no empeora las operaciones habituales. Las cifras reales se contrastan con Observability y consultas representativas.

### Reglas de arquitectura

1. **Una petición lógica, una RPC cuando varias tablas deben quedar consistentes.** No encadenar escrituras HTTP de cada jugador. Toda publicación inicial debe guardar resultados, ELO, acumulados, perfiles, clasificación y bitácora juntos o revertirlos juntos.
2. **Sin N+1:** la versión de QA convierte el cálculo ELO de N lecturas de `players` dentro de un bucle a **una consulta por conjuntos** tras bloquear el conjunto de jugadores con orden estable. Hace **una inserción agrupada** de N checkpoints, no N INSERT independientes.
3. **Hash una vez, en servidor:** SHA-256 sobre JSON tipado y ordenado por posición. No aceptar huella de entrada construida por el navegador; el orden del array no altera el resultado de la huella. Nunca almacenar contraseñas, tokens ni información personal innecesaria en la bitácora.
4. **Evitar UPDATE sin diferencias:** la clasificación de QA solo actualiza una fila existente si cambian puntos, participaciones, mejor puesto, mesas finales o ranking. Repetir recálculo sin cambios debe producir **cero escrituras de posiciones** y conservar su `updated_at`.
5. **Índices solo cuando aporten valor medido:** cada índice también aumenta el costo de inserciones y mantenimiento. Revisar `EXPLAIN (ANALYZE, BUFFERS)` en QA, `pg_stat_statements` y uso/tamaño de índices antes de proponer altas o eliminaciones. No inventar una optimización solo por el nombre de la columna.
6. **Bloqueos de ámbito mínimo y en orden fijo.** Proteger el torneo, liga y jugadores de la operación; evitar `LOCK TABLE`, consultas largas y backfills durante peticiones web. Revisar deadlocks entre el escritor de resultados, edición de ligas y la importación masiva antes de un corte.
7. **Límites y paginación.** La RPC prototipo acepta 2–1000 participantes, pero ese máximo **no es un objetivo de carga validado**. Las lecturas públicas deben ser paginadas, filtradas y con columnas concretas. Nada de volver a calcular toda la historia ELO en cada render ni usar polling continuo.
8. **Evitar índices duplicados sin perder integridad.** Si una restricción única depende de un índice, no retirarlo. Primero estudiar dependencias, plan de consultas, bloat, estadísticas de uso y la forma de hacer el cambio sin bloqueo excesivo.

## Evidencia actual (SQL SELECT; sin alteración productiva)

La tabla pública `league_standings` presenta dos índices únicos B-tree sobre `(league_id, player_id)`:
- `league_standings_league_id_player_id_key`: **restricción UNIQUE** asociada, **~2.200 kB**, 0 lecturas indexadas en la ventana estadística observada.
- `league_standings_unique`: índice único independiente, **~552 kB**, 668 lecturas indexadas en la ventana observada.
- Otro índice `idx_league_standings_league` sobre `(league_id)`: **~392 kB**, 43 lecturas observadas.

**No se eliminó ninguno.** Los contadores dependen del reinicio de estadísticas y los tamaños reflejan datos/bloat actuales; esas cifras no justifican por sí solas retirar un índice vinculado a una constraint. La duplicidad aparente merece investigación, no DDL inmediato.

## Gates antes de publicar

- Todas las pruebas de PostgreSQL 17 y GoTrue/PostgREST aisladas en verde, más compilación y regresión de funcionalidades.
- Fallo en la bitácora, ELO o clasificación => **cero filas nuevas** y cero cambios parciales; reintentos no duplican ELO/posiciones/eventos.
- Prueba de idempotencia => recálculo de una liga intacta modifica **0 filas**.
- Medir y comparar plan de ejecución, buffers temporales/leídos/escritos, tiempo y número de filas afectadas con tamaños representativos (p. ej. 2, 100, 500 participantes) en entorno aislado. No extrapolar directamente el tiempo de GitHub Actions a la instancia de Supabase.
- Revisar carga real e índices por `pg_stat_statements`/Observability sin ejecutar `EXPLAIN ANALYZE` sobre mutaciones de producción. Identificar consultas que escalan con todos los torneos en lugar de solo con la liga/torneo.
- Preservar los 51 standings históricos sin resultados fuente, CCP, reentradas y ELO unificado. La optimización no puede alterar reglas de puntos.
- Validar serialización de concurrencia, backups y rollback que no reabra rutas vulnerables; integrar la divergencia de `main` antes de cualquier aprobación.

**Estado de este commit:** optimización propuesta en QA y pruebas automatizadas. El ledger aún no está desplegado y editar/eliminar historial sigue NO GO. No tocar producción sin autorización expresa.
