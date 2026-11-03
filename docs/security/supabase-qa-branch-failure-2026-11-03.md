# Supabase branching QA — diagnóstico reproducible

**Fecha:** 2026-11-03 (Chile). **Proyecto principal:** `nhpjzywfzljtlqaigzed`. **Resultado:** historial SQL recuperado; **bloqueo de esquema inicial todavía pendiente**, sin rama QA activa.

## Ejecución autorizada, delimitada y cerrada

- Autorización del propietario: crear una rama QA temporal al precio previamente presupuestado de **USD 0,01344/h** de cómputo, por debajo de USD 5/mes, con eliminación al finalizar.
- Costo confirmado inmediatamente antes de crear: `get_cost(branch)` = **USD 0,01344/h**.
- Se creó `qa-stats-spy-20261103-temporal`, rama id `5aa2c323-0ffd-4764-9ebd-56d0fa8a92ca`, proyecto QA esperado `odnuvloavurkxgxasndp`, `with_data=false`.
- `list_branches` devolvió **MIGRATIONS_FAILED**; `get_project` para el ref QA respondió `Project not found`; `list_tables` no listó tablas públicas.
- **No se ejecutaron las RPC propuestas, datos ficticios, tests de licencias o cambios SQL**, puesto que la base nunca estuvo disponible.
- Se ejecutó `delete_branch` y devolvió `success: true`. Verificación posterior: `list_branches` solo muestra rama `main`; no queda ninguna rama QA temporal activa.
- No se fusionó PR #64, no se modificaron producción, RLS, datos, usuarios, claves ni Cloudflare.
- No es posible verificar el cargo final de facturación desde estos resultados; el costo indicado es tarifa de cómputo, no factura.

## Hallazgo de causa probable (por confirmar con logs de migración)

La lista de migraciones aplicada a producción de Supabase tiene **50 registros**, desde `20260320132525_allow_club_admin_update_players`, `20260321120051_fix_club_admin_update_players_via_tournaments`, hasta noviembre de 2026.

**Situación al producirse el error (histórica):** GitHub conservaba solamente 22 SQL y el primero comenzaba en `20261031143409`, con dependencias de tablas y funciones preexistentes. **Ya no es el estado actual del repositorio.**

**Discrepancias iniciales (RESUELTAS EN CÓDIGO):** 29 versiones no tenían archivo; 11 archivos preexistentes no coincidían exactamente con el SQL ejecutado; había una copia no versionada correctamente, `20261031_secure_batch_blog_views.sql`. Se recuperaron las 29 versiones desde `schema_migrations.statements[1]`, se alinearon los 11 archivos y se retiró el duplicado, conservando los cambios anteriores en Git.

El conjunto de migraciones históricas está ahora recuperado **sin modificar la base de datos**. Sin embargo, no es reproducible desde cero: las 50 migraciones registradas crean solo **10 de las 64 tablas públicas** existentes hoy. Las otras 54 incluyen `players`, `profiles`, `tournaments`, `tournament_results`, `clubs`, `club_admins`, `leagues` y `user_purchases`, ya presentes antes del inicio del historial. La primera migración registrada (`20260320132525`) comienza creando una política sobre `players`, sin crear primero esa tabla.

Supabase confirma que al crear una rama desde el Dashboard reproduce el historial desde una base vacía: https://supabase.com/kb/troubleshooting/branch-in-migrations-failed-status. La ausencia del esquema inicial es una **explicación técnica fundada** del fallo, aunque todavía falta el log exacto de la sentencia que lo provocó.

### Reparación ya aplicada en GitHub

- 29 archivos SQL originales recuperados desde el registro de producción mediante consultas **de solo lectura**.
- 11 espejos SQL existentes alineados exactamente con las sentencias originales; Git conserva las versiones previas para auditoría.
- Eliminada la migración duplicada de ocho dígitos; las versiones legítimas `20261031135830` y `20261031135902` ya cubren esa función.
- `supabase/migration-history.lock.json` registra las 50 versiones y el hash Git del SQL original. `tests/supabase-migration-history.test.mjs` y `npm run qa:migrations:history` verifican esos archivos automáticamente.
- `npm run qa:migrations` se mantiene deliberadamente en **NO-GO** mientras no exista un esquema inicial auténtico; no crea proyectos ni incurre en costos.
- La rama QA anterior está **eliminada** y producción no recibió cambios SQL.

**Importante:** no basta con copiar el esquema **actual** tal cual delante de las 50 migraciones: las operaciones posteriores de `CREATE TABLE`, `ALTER TABLE`, políticas y funciones podrían entrar en conflicto. Hay que recuperar el esquema anterior al primer cambio registrado, o diseñar un procedimiento de baseline/squash validado contra un dump de esquema sin datos y probado primero fuera de producción.

## Plan seguro de reparación sin alterar el histórico

1. **Historial SQL COMPLETADO.** Recuperadas las 50 versiones originales. **Pendiente:** consultar el error real de ejecución de la rama fallida en Supabase si permanece disponible.
2. **Dependencias iniciales identificadas.** La primera migración requiere `players` y otras tablas anteriores. No alterar versiones aplicadas ni su registro en producción.
3. Preparar un **baseline de esquema sin datos privados** de una fuente autorizada, en una rama de código separada o con procedimiento de restauración a QA, que incluya estructura, permisos, funciones y extensiones necesarias.
4. Validar en PostgreSQL local gratuito (si está disponible) el orden de migraciones y la ausencia de dependencias inexistentes; comparar después contra el esquema productivo **solo con lectura de metadatos**.
5. Reintentar Supabase Branching **solo cuando haya pruebas de migraciones reproducibles**, con nuevo consentimiento explícito sobre cualquier cobro. Mantener la ejecución acotada y eliminar inmediatamente la rama al terminar.
6. Ejecutar la propuesta `stats-spy-guarded-rpcs-2026-11-03.proposal.sql` primero en QA, validar `anon`, sin licencia, caducada, activa y superadmin, y ensayar revocación segura de permisos antiguos y regresiones del ranking.
7. Solo si todos los tests resultan satisfactorios, documentar rollback y solicitar aprobación para cambios SQL de producción en una ventana de publicación.

## Estado y decisión

**NO-GO** de Stats Espía. Ninguna de las pruebas SQL planeadas puede considerarse aprobada por haber creado una rama que falló durante el aprovisionamiento.

Referencias:
- [Checklist general de salida](../release/sharkania-arena-go-live-checklist-2026-11-03.md)
- [Runbook de protección Stats Espía](stats-spy-cutover-runbook-2026-11-03.md)
- [Migraciones versionadas en GitHub](https://github.com/SharkaniaElite/SharkaniaV2/tree/feature/sharkania-arena-experience-preview/supabase/migrations)
