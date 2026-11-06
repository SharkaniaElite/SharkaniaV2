# SHARKANIA — publicación inicial transaccional de resultados de liga (QA)

**Fecha:** 6 de noviembre de 2026. **Estado: prototipo probado exclusivamente en entornos ficticios; NO ES MIGRACIÓN, NO GO para producción.**

## Resultado técnico implementado

`docs/security/league-atomic-first-upload-2026-11-06.qa-only.sql` crea en QA la RPC `public.publish_league_results_guarded_qa(p_tournament_id uuid,p_operation text,p_results jsonb)`, `SECURITY DEFINER` con `search_path=''` y ejecución limitada a `authenticated`, con autorización dentro de la función.

Para `p_operation='upload'`, en **una transacción PostgreSQL**:

1. Bloquea el torneo, la liga y los jugadores afectados en orden; exige que el club del torneo sea el único organizador principal de la liga y que el solicitante sea administrador principal o superadministrador.
2. Rechaza resultados existentes, `results_uploaded=true`, torneo cancelado, liga con posiciones sin fuente, moneda diferente de USD, jugadores de otra sala, duplicados de jugador o posición, resultados no consecutivos y publicación fuera de orden respecto a resultados posteriores de los jugadores.
3. Resuelve únicamente **IDs de jugadores existentes** (no crea usuarios/nicknames). Calcula una foto única del ELO anterior y aplica la fórmula y redondeos del cliente `src/lib/api/elo-engine.ts` para el caso de publicación inicial.
4. Inserta `tournament_results` y `elo_history`, actualiza estadísticas y ELO en `players`, materializa `profiles.unified_elo` (uno o varios alias), marca el torneo `completed/results_uploaded`, y llama al recálculo protegido de la clasificación.
5. Si algún paso falla, PostgreSQL **revierte todos los cambios** de la invocación. Repetir un torneo publicado rechaza la operación y evita duplicar ELO y premios.

`p_operation='edit'` y `'delete'` responden **PT409 sin modificar datos**, porque corregir/eliminar resultados ya contabilizados exige recalcular el ELO histórico posterior y todas las clasificaciones dependientes. No debe habilitarse una edición parcial.

## Evidencia QA y alcance

- `tests/fixtures/sharkania-league-atomic-setup.sql`: base de datos sintética independiente, basada en el esquema de ligas/roles ya probado.
- `tests/fixtures/sharkania-league-atomic-first-upload-qa.sql`: verifica autorización, duplicados, bloqueo de edición/eliminación, protección de posiciones sin fuente, doble publicación y éxito.
- Se provocan **dos fallos distintos** mediante triggers de QA: uno durante inserción de ELO y otro en el recálculo final de las clasificaciones. Ambos deben demostrar que no quedan cambios parciales en resultados, ELO, jugadores, perfiles ni posiciones.
- Verificación numérica para dos participantes de ELO inicial 1200, USD 3,30: **1222,23 / 1177,77**, con preservación del `id`, CCP y reentradas históricos de la posición existente.
- Caso de **dos nicknames asociados al mismo perfil** y materialización de su ELO unificado, contrastado con los criterios de `get_unified_elo_history` verificados en la definición SQL productiva (solo lectura).
- `.github/workflows/qa-league-security-release.yml` ejecuta PostgreSQL 17 descartable y un `ROLLBACK` final; sin datos reales.
- `tests/fixtures/sharkania-league-atomic-real-auth-{setup.sql,qa.mjs}` y `.github/workflows/qa-league-real-auth.yml` comprueban API PostgREST con **GoTrue real aislado** en Docker y cuentas ficticias. Es una verificación adicional al runner SQL.

## Bloqueos reales antes de producción

1. **Edición y eliminación:** definir y validar un replay determinista de ELO de todos los torneos posteriores de cada jugador, su `elo_peak`, perfiles con alias, estadísticas globales y ligas afectadas. Actualmente `elo_history.recorded_at` y el orden de torneo no garantizan reconstruir inequívocamente toda la historia; no inferir el orden de UUID.
2. **Creación de nicknames:** el formulario crea jugadores fuera de la transacción. Debe migrarse la resolución/alta de IDs a un único escritor servidor autorizado o a una fase previa que no provoque cambios parciales.
3. **Reglas comerciales:** validar CCP inicial, reentradas, `total_buy_ins_spent` y la conversión multimoneda (USD/CLP); no replicar ciegamente sumas de dinero entre monedas. El prototipo bloquea monedas distintas de USD para no inventar conversiones.
4. **Clasificación histórica:** conservar las 51 posiciones sin resultados fuente. El recálculo está bloqueado cuando detecta una excepción; la nueva clasificación aún requiere reconciliación de criterios de desempate y diferencias con ligas reales.
5. **Concurrencia e infraestructura:** cerrar los escritores heredados de navegador, los privilegios RLS/GRANT y RPC antiguas en un corte transaccional, validar orden de locks para operaciones cruzadas, ensayar paralelismo con GoTrue, integrar el último `main` y verificar backup/restore con dueños y ACL.
6. **Paridad de cálculo:** el ensayo prueba escenarios representativos, no todos los torneos reales ni todas las modalidades. Antes de activar, contrastar salida contra el motor anterior con fixtures adicionales para 3+ jugadores, K antes/después de 30 torneos, ELO mínimo, bounties, alias simultáneos y torneos fuera de orden.
7. **UI:** `results-upload.tsx` / `results-editor.tsx` continúan bloqueando ligas al encender `VITE_LEAGUE_GUARDED_RPC`. No habilitar el flag sin integrar todos los flujos (inclusive eliminación, importación CSV, auditoría y recuperación).
8. **Operación productiva:** no se aplicará ningún SQL QA-only en Supabase real, ni se fusionará el PR #65, sin autorización expresa y plan de reversión seguro.

## Decisión

**APTO PARA CONTINUAR QA — NO GO PRODUCCIÓN.** Publicación inicial transaccional preparada en backend ficticio. Falta completar un escritor de correcciones y eliminaciones con replay cronológico antes de reemplazar los caminos heredados. PR #76 de resiliencia de autenticación sigue independiente.
