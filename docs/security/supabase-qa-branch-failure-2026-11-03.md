# Supabase branching QA — diagnóstico reproducible

**Fecha:** 2026-11-03 (Chile). **Proyecto principal:** `nhpjzywfzljtlqaigzed`. **Resultado:** BLOQUEADO por fallas de migraciones durante el aprovisionamiento.

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

La lista de migraciones aplicada a producción de Supabase tiene **más de 50 registros**, desde `20260320132525_allow_club_admin_update_players`, `20260321120051_fix_club_admin_update_players_via_tournaments`, hasta noviembre de 2026.

En cambio, **el repositorio de GitHub conserva solo 22 archivos SQL en `supabase/migrations`**, y el más antiguo es `20261031143409_restrict_club_management_and_directory_policies.sql`. Este archivo inicial intenta crear políticas y triggers en tablas preexistentes `public.clubs` y `public.club_admins`, usa `public.is_super_admin` e `public.is_club_admin`, y **no incluye el DDL de creación de dichas tablas/funciones**.

Esto demuestra que el conjunto de archivos SQL bajo control de versiones **no es autónomo ni reproducible desde una base vacía**. Es una explicación probable del estado `MIGRATIONS_FAILED`, pero **no hay un log de error preciso de la migración que falló**; no atribuirle causalidad confirmada sin obtenerlo.

## Plan seguro de reparación sin alterar el histórico

1. Recuperar los registros completos de migración y el error real de la rama fallida desde el panel o soporte Supabase (si existen). Conservar nombre, versión, sentencia y error sin incluir datos sensibles.
2. Identificar exactamente cuál es la primera migración necesaria y qué objetos básicos faltan. No modificar ni renombrar archivos ya aplicados en producción para disimular el drift.
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
