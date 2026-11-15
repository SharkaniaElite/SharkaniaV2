# SHARKANIA — Integración P0 / P1 / Release A: control contra cortes incompatibles

**7 de noviembre de 2026.** Trabajo de QA exclusivamente en el PR #65, sin migración ni cambio en Supabase productivo. No habilitar `VITE_LEAGUE_GUARDED_RPC`.

## Estado de partida verificado

- **PR #79 / P0:** RLS de `league_standings` ya fue aplicada a Supabase el 7 de noviembre. Su índice parcial `league_clubs_one_primary_per_league_guarded` es una dependencia del corte futuro. **No ejecutar otra vez esa migración.**
- **PR #80 / P1:** política de compatibilidad transitoria, solo QA. Restringe membresías, propietarios y salas, pero mantiene operaciones REST separadas para no romper el formulario legado. **No está desplegada.**
- **PR #65 / Release A:** propone creación/edición/clonación/salas vía RPC transaccionales y revocación de DML directos. Es una estrategia de corte distinta, no una extensión ciega de P1. Sigue en borrador.

## Riesgo confirmado de integrar los SQL sin reconciliación

La propuesta P1 reemplaza ocho políticas originales por ocho nuevas con nombres `*_p1`. La propuesta Release A originalmente eliminaba solo los ocho nombres antiguos con `DROP POLICY IF EXISTS`, revocaba escrituras directas y creaba `leagues_primary_owner_update`.

Si P1 se aplicase antes, las políticas `*_p1` podrían permanecer en el catálogo al ejecutar Release A. Las revocaciones de DML impedirían las escrituras directas bajo los roles revisados, pero dejar políticas heredadas sin reconciliar es un riesgo de permisos futuros y dificulta razonar sobre los privilegios. Además, los dos cortes tienen flujos de cliente distintos y una implementación no sustituye a la otra de forma automática.

**Decisión:** no aplicar P1 y Release A de forma consecutiva, ni aprobar su merge, sin elegir una sola estrategia y regenerar el procedimiento desde el estado real de producción.

## Mitigación nueva en PR #65 (solo SQL de propuesta y CI)

La propuesta `docs/security/league-membership-guarded-cutover-2026-11-04.proposal.sql` ahora empieza con `DO $league_cutover_preflight$`, que detiene el corte antes de todo DDL si:

1. Falta RLS en `leagues`, `league_clubs` o `league_rooms`.
2. No están exactamente las ocho políticas legacy esperadas, incluidas las que P1 sustituiría.
3. Existe cualquier política adicional de escritura (`ALL`, `INSERT`, `UPDATE`, `DELETE`) en esas tablas, excepto las tres políticas superadmin de salas observadas en el catálogo.
4. Existe alguna liga sin exactamente un organizador principal.

El índice único parcial ya instalado por P0 se mantiene y la propuesta lo reutiliza mediante `CREATE UNIQUE INDEX IF NOT EXISTS`. La propuesta sigue **NO apta para ejecutar en producción**: este preflight protege contra desvíos del catálogo, pero no sustituye la migración versionada, auditoría de funciones/grants, sincronización de frontend y plan de rollback.

### Prueba negativa incorporada

El workflow `.github/workflows/qa-league-security-release.yml` crea una base PostgreSQL 17 descartable con identidades ficticias, conserva las ocho políticas legacy, instala una política extra con el mismo nombre que P1 (`leagues_primary_update_p1`), y exige que Release A falle con `STOP: unreviewed league write policy exists` sin instalar funciones. Después elimina uno de los nombres legacy y exige el error `STOP: legacy league policies changed`. La QA normal sigue ejecutando la propuesta contra el inventario legacy esperado.

**Hasta la ejecución de GitHub Actions no considerar las nuevas pruebas como PASS.** La prueba modela el catálogo; todavía no equivale a una integración con P1 completa ni a un despliegue seguro.

## Ruta de salida

1. Reconciliar el registro P0 de Supabase con la rama de integración GitHub sin reejecutar la migración en la base.
2. Elegir un corte integrado único; Release A con RPC completas deberá reemplazar los permisos transitorios P1, no conservar ambas generaciones de políticas.
3. Completar cierre de editores, cargas CSV y RPC destructivas legacy, y proteger los resultados/ELO históricos y multimoneda.
4. Verificar creación, edición, clonación de liga compartida, salas, restricciones de secundarios y administración superadmin con GoTrue y PostgREST reales en QA aislada.
5. Validar restauración, permisos efectivos, preflight final, costes y regresión visual del frontend; documentar rollback **sin reabrir DML vulnerable**.
6. Obtener aprobación expresa del propietario antes de migrar, fusionar o activar el flag.

**Producción permanece fuera del alcance.** Este documento no autoriza ejecución de `*.proposal.sql` ni `*.qa-only.sql` contra Supabase real.
