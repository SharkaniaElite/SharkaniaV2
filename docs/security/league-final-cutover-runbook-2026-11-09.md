# SHARKANIA — Plan verificable del corte final de seguridad

**Fecha:** 9 de noviembre de 2026. **Situación:** QA / **NO GO productivo**.

El frontend de PR #84 y #85 está en `main`, con `VITE_LEAGUE_GUARDED_RPC` apagado. El backend experimental está apilado en #86 → #87 → #88 → #89 → #90 → #91 → **#92**; son PR en borrador, nunca aprobados para migrar.

## Diagnóstico de solo lectura — Supabase real, 9 nov

El fichero `docs/security/league-cutover-production-catalog-readonly-2026-11-09.sql` contiene una consulta **solo SELECT** verificada contra Supabase productivo. Resultados observados:

| Control | Valor |
|---|---:|
| Migración P0 registrada | 1 |
| Índice único de club principal válido | Sí |
| Políticas legacy de escritura de liga | 8 |
| Ligas sin exactamente un club principal | 0 |
| Ligas con varias monedas | 0 |
| Discontinuidades de ELO registradas (orden por `recorded_at,id`) | 3.576 |
| Tablas críticas con grants directos DML a `authenticated` | 8 |
| RPC `SECURITY DEFINER` destructivas ejecutables por `authenticated` | 3 |
| Nuevas RPC experimentales v2 en producción | 0 |

**Estos grants no demuestran por sí solos explotación**: RLS, `SECURITY INVOKER` y controles internos pueden bloquear operaciones. Pero no se pueden ignorar al planificar un corte con `SECURITY DEFINER` y múltiples escritores.

`delete_tournament_god_mode` y `reset_tournament_impact` están activos para usuarios autenticados y recalculan con lógica heredada, incluyendo el supuesto de ELO inicial 1200 en el reinicio. `bulk_delete_scheduled_tournaments` permite eliminar torneos programados de clubes autorizados. No revocar funciones globalmente sin proteger su comportamiento en torneos **no** vinculados a ligas.

## Qué se ha implementado en QA, sin ningún cambio productivo

- **Permisos y membresía**: RPC de ligas atómicas, RLS, restricciones de torneo↔liga, índices y denegación a clubes ajenos (#86).
- **Escritor nuevo**: primera publicación transaccional USD, sin edit/delete históricos; auditoría y checkpoints inmutables (#87).
- **Nicknames y moneda**: alta dentro del mismo COMMIT, identidad por sala, ledger privado e inmutable, reentradas y montos separados por moneda (#88).
- **ELO candidato v2**: fórmula prospectiva de K sin multiplicador de buy-in nominal; motor `legacy-js-v1` no modificado. El modo experimental está **exclusivamente en QA** (#89, #92).
- **Auth y concurrencia**: JWT genuinos en GoTrue/PostgREST local, pruebas del mismo torneo, de dos torneos de una liga y de dos ligas diferentes con jugadores compartidos; ELO continuo y controles horizontales (#90–#91).
- **Correcciones históricas**: planificador de clausura transitiva y simulación exacta del ELO heredado en memoria, con `readonlyOnly:true` y `safeToApply:false`; rechaza registros faltantes, orden ambiguo, cambios de jugadores y discontinuidades (#92, recuperado de #65).
- **Frenos de borrado**: triggers simulados y pruebas QA contra `DELETE` de ligas/resultados/historia/standings, con ROLLBACK y sin deshabilitar operaciones no liga (#92).
- **Recuperación**: ejercicio `pg_dump` de base QA con eventos publicados, `pg_restore` a una segunda base separada, comparación de huellas de 12 tablas, políticas y permisos ejecutables. **No contiene datos reales ni demuestra recuperación de producción** (#92).

## Riesgos que bloquean un corte productivo hoy

**1. Política ELO y contabilidad.** Acordar `currency-neutral-v2` para torneos nuevos, a partir de una fecha futura y una versión auditable, sin rehacer el pasado. La prueba QA solo muestra que es ejecutable técnicamente y que preserva el ELO numérico entre USD/EUR/CLP. Quedan 37 torneos de liga sin resultados en el último inventario: 27 CLP, 7 EUR y 3 USD. Un torneo antiguo cargado tarde **no debe recibir** la fórmula nueva arbitrariamente sin decisión sobre fecha de *evento* versus *publicación*.

**2. Compatibilidad de pantallas.** El modo propuesto no suma CLP/EUR en los campos históricos `players.total_prize_won` ni `players.total_buy_ins_spent` sin moneda; usa una bitácora nativa separada. Hay que actualizar los informes/perfiles para mostrar totales por divisa antes de activarlo, y decidir la semántica de las reentradas.

**3. Edición y borrado de resultados.** No existe una reconstrucción histórica autoritativa porque se registraron **3.576 discontinuidades** entre ELO previo/final. El planificador QA solo permite previsualizar **casos que tengan todos los checkpoints de origen y orden no ambiguo**. No cambiar ELO, CCP, standings, premios ni perfiles históricos hasta tener una transacción de replay íntegra con pruebas de paridad. Para eventos antiguos sin evidencia suficiente, mantener `edit/delete` bloqueado y resolver con revisión manual documentada, no inventar 1200.

**4. Escritores heredados.** `results-upload.tsx`, `results-editor.tsx`, `tournaments.ts`, templates, helpers de league_points y tres RPC `SECURITY DEFINER` siguen siendo rutas de escritura. Una bandera Vite NO es límite de permisos. Antes de activar el backend, migrar el 100% de rutas a RPC y **cerrar INSERT/UPDATE/DELETE heredados de forma coordinada**, sin romper operaciones no liga. Conservar cierre si se revierte frontend.

**5. Restauración real.** Supabase Pro ofrece respaldos diarios (hasta siete días), pero la retención **no garantiza** un punto inmediatamente anterior al corte. Para recuperabilidad con un punto más fino, la opción oficial es PITR (add-on con coste). Antes de producción:
   - Verificar existencia y hora del backup más reciente en **Database → Backups**.
   - Restaurarlo **en un proyecto nuevo y aislado**, revisar fidelidad de RLS, funciones, roles, Auth, cuentas y datos, y medir tiempo, costo y dependencias de Storage. Esta operación puede generar cargos adicionales y **requiere consentimiento antes de crear un proyecto o activar PITR**.
   - Probar en ese clon la migración y la vuelta atrás SIN reabrir permisos peligrosos.
   - Nunca restaurar encima de producción para una prueba. Una restauración del proyecto activo reemplaza datos posteriores y produce indisponibilidad.

## Secuencia única de publicación (NO autorizada aún)

1. Congelar brevemente la escritura de **resultados de ligas** durante la ventana del corte, no la lectura pública. No asumir que se pueden encolar eventos sin un mecanismo construido.
2. Registrar con `SELECT` el catálogo productivo actual y comparar con el manifiesto de SQL esperado (la migración P0 **ya existe**; no repetirla).
3. Ejecutar una **migración nueva versionada** en un clon sobre el esquema restaurado, con permiso mínimo, transacciones, abortos antes de DDL ante cualquier política desconocida y verificaciones de integridad; generar la migración mediante el CLI fijado cuando el diseño esté cerrado, no inventar ahora un fichero desplegable.
4. Cambiar cliente a RPC + nueva UX, desplegar Cloudflare después de probar GoTrue/RLS y asociar un identificador de commit. Para Vite, flag de compilación implica **nuevo deploy**; no confiar en poner la variable después sin reconstruir.
5. Comprobar en roles reales: jugador, organizador A/B, superadmin y visitante. Validar creación/duplicado de liga, primer resultado, moneda, reentrada, clasificación, nickname por sala, historial e idempotencia. No hacer pruebas que alteren jugadores reales.
6. Quitar el bloqueo temporal solo después de completar checks de acceso y resultados. Observar incidencias y limitar cargas inesperadas.
7. Ante fallos: **apagar el frontend nuevo**, mantener RLS y revocaciones nuevas, activar mantenimiento de escritura afectada y reconciliar cambios. No restaurar ocho políticas abiertas como `rollback`. Cualquier restauración de base real debe preservar cambios posteriores mediante plan de reconciliación y aprobación específica.

## Para dar GO de producción

- [ ] Regla ELO v2/fecha y tratamiento de partidos antiguos aprobados
- [ ] Pantallas y reportes con importes por moneda; semántica de reentrada aprobada
- [ ] Replay íntegro con checkpoints verificables o política de mantenimiento/manual para los casos no recuperables
- [ ] Cierre probado de todos los writers legacy y ACL/RLS, manteniendo torneos no liga
- [ ] Respaldo productivo realmente restaurado en un entorno independiente (no solo simulación)
- [ ] PR QA final y regresión Auth/REST aprobados sobre una única rama de migración
- [ ] **Aprobación expresa y específica** para ejecutar la migración productiva y activar el flag

**NO GO mientras quede cualquier casilla crítica sin validar.**
