# SHARKANIA — Integración controlada ELO v2 (SOLO GITHUB · NO MERGE / NO GO)

Fecha: 2026-11-15. **Preparación bajo autorización limitada del propietario.** Ningún componente productivo queda autorizado.

## Tres fuentes existentes, sin reescritura de historial

- Base de la integración (candidato ELO completo y migración versionada): `release/elo-v2-versioned-migration-review-2026-11-13` @ `4e30d155fb4c7c2c072b9393789f6220001f1943`.
- Actualidad de `main` conservada mediante integración de cambios no solapados: `026d02fc29661a8d2d531f1d6e319cf6c35d7ad9`.
- Reconciliación histórica ya preparada: `chore/reconcile-supabase-migration-history-2026-11-14` @ `d241bc33fdf997848afbee53b5bf35124102ee56`.
- La nueva rama **no fusiona PR ni crea un commit merge**: es una composición verificable de árboles de Git, con un único commit hijo de la rama candidata ELO. `main`, PR #95–#97 y las dos ramas fuente permanecen intactos.
- Se conserva literalmente la migración ELO v2 `20261113182000_release_a_elo_v2_usd_official_fx.sql` con blob SHA `45241f142dba4894fa349215fa938ea220d4c1ba` (mismo candidato QA).

## Incorporaciones de `main` que no estaban en la rama candidata (8 archivos)
- `.github/workflows/qa-bcch-admin-dollar-release.yml`
- `functions/_middleware.ts`
- `src/App.tsx`
- `src/pages/decision-tree.tsx`
- `src/pages/tools.tsx`
- `tests/bcch-official-response-parser-qa.mjs`
- `workers/sitemap.mjs`
- `workers/sitemap.test.mjs`

## Tres archivos tocados por ambas historias

- `src/pages/super-admin.tsx`: conservar la versión de la rama ELO; contiene las funciones actuales de previsualización BCCh y además añade la vía protegida para vincular nicknames. La comparación 3-vías localizó los cambios recientes de BCCh ya presentes en la variante ELO.
- `supabase/config.toml`: conservar la versión ELO. El capturador `elo-fx-capture` está **enabled = false**; el `bcch-dollar-preview` existente está **enabled = true**. No confundir esta mera configuración versionada con desplegar una Edge Function.
- `tests/bcch-admin-quote-contract-qa.mjs`: conservar la variante ELO, porque la prueba de `main` exige ausencia total del bloque `elo-fx-capture`, incompatible con preparar el bloque desactivado en el candidato. La variante ELO exige explícitamente `enabled = false` y mantiene los controles BCCh.
- **Ninguno de esos tres archivos fue sobrescrito con `main` ni modificado en esta composición.**

## Reconciliación incorporada sin ejecutar SQL

- Se trasladaron solo los 38 cambios Git comparados con la base real de la rama de reconciliación (29 archivos históricos nuevos, tres correcciones de versiones mediante añadir/eliminar rutas, la copia archivada y el informe WIP). Ninguno presentó un conflicto de contenido con la rama ELO.
- `supabase/migrations/` contiene **55 SQL con versión de 14 dígitos**, de los cuales **54 pertenecen al historial ya registrado** y **uno es el candidato nuevo ELO v2 todavía NO aplicado**.
- Se conservaron las 11 divergencias históricas de SQL ya documentadas, sin sustituir su contenido. El SQL archivado con fecha de ocho dígitos está fuera de `supabase/migrations` y sigue disponible como referencia.
- **No ejecutar** `supabase db push`, `migration repair`, ni reproducción automática de las 54 migraciones históricas: su registro en la base productiva no autoriza volver a ejecutarlas.

## Pruebas y limitaciones

- **Ya aprobadas históricamente:** QA 05–09 del motor y concurrencia ELO, pruebas locales GoTrue/PostgREST y CI de #95/#96/#97; no repetir por defecto.
- **Controles nuevos pendientes:** comprobar CI de la rama integrada (sin accesos a producción), compatibilidad de esquema/migraciones en una base aislada autorizada y los permisos de roles tras eventual corte. La composición de árboles no certifica compatibilidad funcional ni reproducibilidad de toda la base desde cero.
- El candidato sigue acumulando cambios de varios PR apilados y difiere ampliamente de `main`. No declarar listo para merge por la sola coincidencia de archivos.
- Esta rama incorpora también cambios recientes de `main` en sitemap, middleware, navegación, tests y decisiones postflop: no reemplazar esas áreas con versiones antiguas cuando se planifique el corte.

## Despliegues y responsabilidades

- **No se autorizó ningún despliegue.** El commit de preparación usa el prefijo documentado por Cloudflare `[CF-Pages-Skip]` para evitar un preview automático (Pages integra todas las ramas). Verificar el estado de Cloudflare tras la creación.
- **Ningún secreto** BCCh, Vault, service_role, contraseña o dato personal debe integrarse en GitHub o logs.
- ELO v1 histórico permanece inmutable. ELO v2 mantiene flags apagados y el capturador FX sin instalar; la fecha efectiva se fijará después de capturas oficiales válidas.
- No fusionar los PR #95–#97 ni esta rama. No ejecutar SQL, desplegar Edge/cron, modificar Cloudflare ni activar flags sin aprobaciones separadas.

## Puertas restantes del Issue #98

1. Cerrar de forma limitada la compatibilidad de la integración y las discrepancias que pudieran bloquear el corte, sin otra auditoría general.
2. Presentar secuencia de release, efectos ACL/RLS, costos, ventana y reversión verificable al propietario.
3. Con GO específico: incorporar backend con ELO apagado; autorizar captura FX oficial CLP/EUR (función, clave dedicada Vault y cron por fases), verificar salud; luego aprobar flags web y torneos futuros elegibles.

**ESTADO: GitHub preparado para revisión; NO MERGE / NO GO productivo.**
