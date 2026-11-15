# SHARKANIA — Release A: conciliación obligatoria de clasificaciones

**Estado: NO GO. Documento de diagnóstico y diseño; NO ES UNA MIGRACIÓN.**  
**Fecha:** 4 de noviembre de 2026.  
**Alcance:** exclusivamente clasificaciones de ligas; no modificar ELO ni mezclar Release B.

## Hechos comprobados en solo lectura

Se inspeccionó el catálogo SQL de Supabase **productivo sin realizar DML/DDL**. Este documento registra hechos observados, no autorizaciones para desplegar.

1. `public.recalculate_league_standings(uuid)` es `SECURITY INVOKER`; `anon` y `authenticated` tienen EXECUTE. Ejecuta DELETE/INSERT de las filas de clasificación de la liga y recalcula puntos/mejores fechas/puestos/mesas finales, pero no repuebla `ccp_club` ni `total_buy_ins_spent`.
2. `src/lib/api/leagues.ts` ejecuta una serie posterior de UPDATE desde navegador para restituir CCP y reentradas. Ese parche incluye únicamente resultados cuyo `ccp_club IS NOT NULL`; por tanto no cuenta reentradas de resultados sin CCP. Las actualizaciones no forman una transacción con el recálculo SQL.
3. `public.league_standings` tiene permisos de INSERT/UPDATE/DELETE para `authenticated` y políticas permisivas que solo comprueban `auth.role() = 'authenticated'`, sin validar liga/organizador. Las políticas de superadministrador adicionales no anulan las anteriores: las políticas permisivas se combinan con OR. Esto **no estaba cubierto** por el control 6D, que verificó solo `leagues`, `league_clubs`, `league_rooms`.
4. `league_standings` tiene índice único `(league_id,player_id)`, 5.731 filas, cero duplicados de esa clave; 1.624 filas con CCP y ninguna fila con `last_tournament_id` informado al momento de la consulta.
5. Conciliación agregada contra `tournament_results JOIN tournaments`:
   - **51 filas** de `league_standings` no tienen resultados de origen asociados bajo su liga/jugador actual.
   - **24 filas** tienen CCP distinto del primer CCP no vacío de los resultados en orden de fecha/ID.
   - **106 filas** con CCP difieren del conteo de buy-ins reconstruido siguiendo el filtro del parche heredado.
   - **4.080 filas** obtienen otro conteo si se suman también los buy-ins de resultados sin CCP.
   - **4.162 filas** con resultados difieren entre el contador actual y la suma completa de buy-ins.
   Son **cantidades de filas/pares liga-jugador**, no montos ni número total de reentradas. Las discrepancias requieren investigación; no implican automáticamente que el dato guardado o el dato reconstruido sea el correcto.

## Decisión de seguridad / integridad

**No ejecutar una sustitución masiva DELETE + INSERT, ni habilitar carga/edición de resultados en modo guarded, ni fusionar el PR #65.** Antes deben determinarse las reglas de negocio e investigar las 51 filas sin origen.

El commit `e1f3edb7661e6c5bb2127ce4893f967c39391fa4` ya mantiene una barrera preventiva *fail-closed* en `results-upload.tsx` y `results-editor.tsx` cuando `VITE_LEAGUE_GUARDED_RPC=true` para torneos asociados a ligas, antes de crear jugadores, resetear, reemplazar resultados o recalcular ELO. La prueba de contrato existente comprueba su posición en el código; **no es un test E2E de atomicidad**.

## Contrato propuesto para `recalculate_league_standings_guarded`

Antes de implementarlo/aplicarlo:

- Autorizar con `auth.uid()` y permisos del **club organizador principal** de esa liga, o superadministrador; rechazar anónimo, jugador corriente y administrador de club solo participante. No confiar en un club_id enviado por el cliente.
- Operar en **una única transacción de base de datos**, con bloqueo por liga para evitar cálculos concurrentes. Usar `SECURITY DEFINER SET search_path = ''` solo con comprobación de autorizaciones interna y referencias SQL calificadas. Revocar EXECUTE de PUBLIC y anon; concederlo a authenticated con control interno estricto.
- Rechazar una liga inexistente y configurar errores explícitos. No actualizar ELO, `elo_history`, perfiles, jugadores, resultados ni torneos durante el recálculo autónomo.
- Mantener `total_points` como suma de las mejores `best_dates_to_count` fechas (o todas si NULL), `tournaments_played` como total de fechas con resultado, `best_position` como mínima posición histórica, `final_tables_count` para puestos 1–9 y los desempates existentes en el orden puntos/participaciones/mejor posición/mesas finales. Determinar y probar un desempate final estable para iguales.
- Reconciliar y preservar semántica de CCP **primero válido por fecha**, incluso si existen resultados antiguos incompletos, sin sobrescribir un club bloqueado salvo regla aprobada.
- Definir si `total_buy_ins_spent` representa cantidad de inscripciones y reentradas (como hace hoy el código), y si hay que contar los registros sin CCP. **No reinterpretarlo como gasto monetario**, ni normalizar CLP/USD/EUR durante Release A.
- Preservar los identificadores existentes `league_standings.id` mediante UPSERT por `(league_id,player_id)` si se aprueba la conciliación. **No eliminar automáticamente** las 51 filas sin fuente: diagnosticarlas por liga y decidir cómo migrar/corregirlas.
- Cerrar INSERT/UPDATE/DELETE directo a `public.league_standings` para clientes y revocar EXECUTE de la RPC heredada **en el mismo corte** que habilita la vía protegida. Revisar todas las rutas consumidoras y disparadores antes: ningún cambio aislado debe interrumpir el cálculo actual de producción.
- La RPC de recálculo **por sí sola no vuelve seguras** las pantallas de subir/editar resultados: estas realizan varios pasos con `reset_tournament_impact`, resultados y ELO. Mantenerlas bloqueadas bajo el flag hasta disponer de una orquestación segura y pruebas de ausencia de escrituras parciales, sin alterar el algoritmo ELO de Release B.

## Gates para el próximo trabajo

1. Agrupar por liga las discrepancias usando el preflight `league-standings-release-a-reconciliation-2026-11-04.readonly.sql` y explicar si las 51 filas son huérfanas, históricas legítimas o materialización antigua.
2. Establecer invariantes aprobadas de CCP, buy-ins/reentradas y conservación de filas existentes.
3. Crear la **propuesta SQL versionada y aislada** de recálculo guarded + cierre coordinado de grants/RLS (no aplicar a producción).
4. QA con datos sintéticos y casos de diferencias: mejores N fechas, empate, CCP de primera fecha, reentrada con/sin CCP, filas huérfanas, rechazo de club B/jugador/anon y superadmin permitido. Confirmar rollback ante fallos y concurrentes.
5. Revisar compatibilidad de las rutas de carga/edición sin mezclar cambios de fórmula ELO. Si no hay solución transaccional verificable, mantener bloqueo y NO GO.
6. Solo después: revisión de migración, respaldo/rollback defensivo, aprobación explícita del propietario y CI verde.

**Regla permanente:** PR #65 permanece draft, sin merge, sin flags de producción, sin SQL productivo y sin escribir en previews Cloudflare asociados al Supabase real.
