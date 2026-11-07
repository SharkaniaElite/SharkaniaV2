# SHARKANIA — Registro de aplicación productiva de seguridad P0

**Fecha:** 7 de noviembre de 2026. **Estado: APLICADO Y VERIFICADO EN SUPABASE PRODUCTIVO.** No ejecutar otra vez este procedimiento por el hecho de fusionar PR #79.

## Autorización y respaldo

El propietario autorizó el arreglo prioritario de RLS y aportó una captura de Supabase Dashboard > Database > Backups > Scheduled backups. En esa captura aparece un respaldo físico de **2026-11-07 06:29:19 UTC**, además de varios anteriores. No se ejecutó una restauración ni se garantiza un punto en el tiempo posterior a ese respaldo.

Proyecto Supabase **`nhpjzywfzljtlqaigzed`**, PostgreSQL 17.6, en estado `ACTIVE_HEALTHY` durante el preflight.

## Migración ejecutada

- **Versión en el historial de Supabase:** `20261107191558`.
- **Nombre:** `p0_restrict_league_standings_rls_20261107`.
- **SQL exacto ya ejecutado**, recuperado de `supabase_migrations.schema_migrations.statements[1]`:
  `supabase/migrations/20261107191558_p0_restrict_league_standings_rls_20261107.sql`.
- Se aplicó mediante la capacidad de migraciones de Supabase: **`success: true`**. El historial se consultó después y contiene la versión y nombre esperados.
- **Una transacción** con `BEGIN/COMMIT`, `lock_timeout=2000ms`, `statement_timeout=15000ms`, preflight y postcheck que detienen la transacción ante anomalías.
- Antes de mutar DDL se comprobó: RLS activa; 34 ligas sin organizador ambiguo, 41 vínculos de club; 5.789 posiciones; exactamente 3 políticas de escritura amplias conocidas, 0 políticas nuevas desconocidas y 0 índices parciales previos.
- El cambio crea **un único índice único parcial** `league_clubs_one_primary_per_league_guarded` en `(league_id) WHERE is_primary IS TRUE`. Quita las tres políticas `Permitir insertar/actualizar/eliminar a usuarios autenticados`. Crea `standings_primary_guarded_insert_p0`, `standings_primary_guarded_update_p0` (USING + WITH CHECK), y `standings_primary_guarded_delete_p0`, limitadas al superadministrador o administrador del organizador principal legítimo.
- **No se actualizaron registros** `players`, `tournament_results`, `elo_history`, `league_standings` ni se ejecutó ningún despliegue web. No se revocaron las RPC heredadas del PR #65.

## Verificación posterior — efectuada sobre la base real

| Control | Resultado |
|---|---|
| Políticas de escritura amplias antiguas en `league_standings` | **0** |
| Nuevas políticas restringidas | **3** |
| Políticas de lectura pública vigentes | **3** |
| RLS de clasificaciones | **Activada** |
| Posiciones antes y después | **5.789 / 5.789** |
| Membresías de clubes antes y después | **41 / 41** |
| Ligas sin un único organizador principal | **0** |
| Índice único parcial propuesto | **1** |
| Consulta de lectura como rol real `anon` (sin escritura) | **Visible / PASS** |
| Migración en historial de Supabase | **Versión 20261107191558 / PASS** |

Las suites anteriores del PR #79 pasaron **6/6**, incluyendo JWT de GoTrue y solicitudes HTTP reales a un PostgREST local con cuentas ficticias. La producción solo se verificó con consultas de lectura a catálogos, conteos y lectura pública, **sin hacer ataques de escritura ni cambios a puntos reales**.

## Riesgos residuales y seguimiento

- La migración cierra específicamente las escrituras directas indiscriminadas de `league_standings` por cuentas autenticadas. **No** resuelve todas las políticas/RPC antiguas de `league_clubs`, `leagues`, edición/importación CSV o ELO (véanse Issue #78 y PR #65).
- El índice impide **dos organizadores principales simultáneos**, pero no impide por sí solo que un administrador autorizado elimine o desmarque el organizador actual. Es necesario revisar la política de integridad de membresías por separado.
- No se ha probado desde la interfaz administrativa productiva iniciar una importación o recálculo real tras el cambio. Se mantienen pendientes las comprobaciones funcionales con un administrador real cuando exista una operación legítima autorizada (evitar modificar puntos por el solo hecho de probar).
- Si se detectan errores al publicar, **no restaurar las políticas abiertas**. Mantener lectura pública y restringir temporalmente las operaciones de escritura hasta instalar una solución segura, con investigación basada en logs y procedimiento de recuperación.
- No fusionar PR #65 automáticamente. El PR #79 permanece abierto para revisión de código/documentación; su migración **YA está registrada en Supabase** y no debe reejecutarse manualmente.

## Eficiencia

El nuevo índice se crea sobre **41 membresías**, con costo limitado. No hay procesos de recálculo ni backfill. El conjunto de ligas autorizadas se calcula contra `league_clubs`, no por cada fila de posiciones. La auditoría de performance futura debe analizar tiempos, CPU y WAL mediante estadísticas sin ejecutar `EXPLAIN ANALYZE` de mutaciones en producción.

**Conclusión: P0 de escritura indiscriminada de standings remediado en producción; auditoría global de permisos continúa abierta.**
