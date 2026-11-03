# Recuperación del esquema inicial de Supabase — SHARKANIA

**Estado:** esquema inicial pendiente. Historial de 50 migraciones completamente recuperado y protegido por hash, pero la reconstrucción de una base vacía **NO** está validada.

**Restricciones:** ningún SQL sobre producción, ninguna rama con cobro recurrente, ningún dump con datos personales ni contraseñas en GitHub o por chat.

## Evidencia concreta — 3 de noviembre de 2026

- Se recuperaron **29 migraciones históricas** leyendo `supabase_migrations.schema_migrations.statements`, se alinearon **11 archivos SQL** con las sentencias realmente registradas y se eliminó un archivo duplicado con fecha de ocho dígitos.
- `supabase/migration-history.lock.json` conserva las **50 versiones aplicadas** y los hashes de cada SQL. Comprobar localmente con `npm run qa:migrations:history` (sin conexión a Supabase).
- En el catálogo PostgreSQL de producción existen **64 tablas públicas**; las 50 migraciones contienen SQL `CREATE TABLE` para **10** de ellas. Las otras **54** están registradas en `supabase/schema-baseline-requirements.json`. Esta es una comprobación estática de tablas; además faltará comprobar tipos, vistas, funciones, triggers, índices, RLS, permisos, esquemas y extensiones.
- La migración más antigua, `20260320132525_allow_club_admin_update_players.sql`, empieza con `CREATE POLICY ... ON players`. **No crea `players`**, ni `tournament_results` o `club_admins` de las que depende.
- El árbol histórico del repositorio consultado en un commit anterior al 20 de marzo de 2026 tampoco contenía archivos SQL de esquema.
- La rama QA temporal fallida ya fue eliminada. **No** hay resultados de tests SQL de esa rama.

## Inventario de esquema recuperado (3 de noviembre, inspección adicional)

La conexión autorizada de Supabase permitió extraer, con consultas de solo lectura al catálogo PostgreSQL, una fotografía técnica de la estructura **actual**, sin filas, compradores, correos ni saldos.

- [Catálogo estructural protegido](supabase-schema-catalog-2026-11-03.json): **64 tablas, 567 columnas, 184 restricciones, 138 índices, 194 firmas de funciones, 22 triggers, 185 políticas, 2 vistas, 77 etiquetas de enumerados y 9 extensiones**.
- El catálogo **no incluye los cuerpos SQL de funciones, triggers ni las expresiones de políticas**: solo sus identidades y hashes. Esto limita la exposición de información técnica en GitHub público.
- Una expresión de valor por defecto fue excluida de la captura pública por cautela. Debe recuperarse únicamente mediante una exportación de confianza, en privado.
- `tests/supabase-schema-catalog.test.mjs` verifica la coherencia del catálogo con las 64 tablas inventariadas, las reglas de minimización de información y el bloqueo de nuevos intentos QA.
- `scripts/export-supabase-schema-only.ps1` automatiza un **dump de DDL sin datos** en un equipo Windows de confianza; guarda fuera del repositorio y no acepta contraseñas como parámetros.

**Límite técnico:** este inventario describe el esquema **después** de todas las migraciones. No contiene el estado anterior al 20 de marzo de 2026 y no reemplaza una exportación íntegra de DDL con las dependencias del esquema personalizadas. Insertarlo como migración antes de las 50 versiones provocaría posibles conflictos de tablas, columnas, funciones y políticas.

## Diagnóstico

Supabase Branching creado desde el Dashboard vuelve a ejecutar las migraciones del proyecto principal contra una base nueva. Si se crearon objetos manualmente antes de registrar migraciones, el historial no puede reproducirlos y la rama puede terminar en `MIGRATIONS_FAILED`. Es consistente con el fallo observado, pero sin el mensaje de la sentencia concreta no está probado como causa exclusiva.

Fuente oficial: https://supabase.com/kb/troubleshooting/branch-in-migrations-failed-status

## Procedimiento para completar el baseline (sin datos ni modificaciones remotas)

**A. Recuperar la estructura original, si existe una copia anterior al 20 de marzo.**

Revisar backups históricos o exportaciones del esquema (no respaldos con datos de usuarios). Lo ideal es recuperar las definiciones previas a la migración `20260320132525`, incluyendo dependencias de `public.players`, `public.tournaments`, `public.club_admins` y sus funciones. No guardar un respaldo con datos reales en el repositorio.

**B. Si no existe esa copia, obtener un dump exclusivamente de la estructura actual como material de reconstrucción.**

Desde un equipo de confianza con Supabase CLI y Docker, usando la sesión del propietario sin compartir claves:

```powershell
# Ejecutar en el repositorio local; supabase db dump es SOLO lectura.
supabase --version
supabase db dump --help
supabase login
supabase link --project-ref nhpjzywfzljtlqaigzed
supabase db dump --schema public --file .\sharkania-schema-actual-SOLO-LOCAL.sql
# Alternativamente, desde Windows, usa el script auditado que guarda fuera de Git:
# powershell -ExecutionPolicy Bypass -File .\scripts\export-supabase-schema-only.ps1 -IncludePrivateSchema
```

El dump por defecto **no incluye datos de filas**; tampoco debe incluir el estado `auth.users` ni los datos de `storage`. **NO subir este archivo a GitHub automáticamente**: examinarlo localmente por si hubiera literales, definiciones con secretos o configuraciones que no deben publicarse. No se solicita contraseña ni token por el chat.

El esquema **actual** no debe insertarse sin más como migración anterior a las otras 50: puede repetir `CREATE TABLE`, `ALTER TABLE` y `CREATE POLICY`. Primero diseñar y revisar una estrategia de baseline o squash para que una base nueva se reconstruya sin duplicados ni pérdida de reglas de seguridad.

Referencia CLI: https://supabase.com/docs/reference/cli/supabase-db-dump

**C. Ensayar completamente en una base local o desechable antes de tocar el historial productivo.**

Validar el baseline estructural y ejecutar las 50 migraciones en orden. Comprobar columnas, funciones con `SECURITY DEFINER`, grants, esquemas privados, RLS, índices, triggers, vistas y claves foráneas. Verificar como mínimo `anon`, autenticado sin licencia, caducado, comprador activo y `super_admin` para Stats Espía. El resultado debe quedar en logs reproducibles.

```powershell
# Las comprobaciones de archivos no consumen recursos remotos:
npm run qa:migrations:history

# El preflight COMPLETO está diseñado para rechazar la rama hasta que haya baseline:
npm run qa:migrations
```

**D. Solo cuando el reset local sea reproducible:**

Evaluar el mecanismo documentado por Supabase para incorporar el baseline a su historial de Branching, después de respaldo revisado, plan de reversión y aprobación específica del propietario para **cualquier modificación de metadatos de migraciones de producción**. No ejecutar `supabase migration repair` a ciegas: cambia el registro de versiones aplicadas, y un error puede afectar futuras migraciones.

## Criterios de aceptación

- [x] Versiones remotas/archivos SQL originales reconciliados: 50/50.
- [x] Hashes de migraciones históricas vigilados por tests y CI.
- [x] Duplicado con fecha incorrecta eliminado.
- [x] Inventario de tablas preexistentes elaborado sin datos privados.
- [ ] Definiciones iniciales completas recuperadas y revisadas.
- [ ] Reset desde base vacía satisfactorio con resultados documentados.
- [ ] Autorización y prueba de cualquier cambio futuro al historial productivo.
- [ ] Nueva rama Supabase temporal inicializa sin `MIGRATIONS_FAILED`.
- [ ] Pruebas de permisos y transacciones de Sharkania superadas.

**Estado de publicación:** `NO-GO` de Stats Espía y de pruebas autenticadas hasta completar estas verificaciones.


## Actualización: exportaciones de public y private recibidas y verificadas (3 noviembre)

La exportación se completó mediante **PostgreSQL 18.6 / pg_dump**, conectado por **Session pooler IPv4** a la base PostgreSQL 17.6. No fue necesario instalar Docker Desktop ni crear recursos adicionales.

Los archivos originales **quedaron fuera de GitHub**: son material privado de la auditoría. Nunca subir los cuerpos de funciones, contenidos JSON por defecto ni SQL de producción sin revisión de seguridad.

| Snapshot local, solo DDL | Tamaño bytes | SHA-256 |
| --- | ---: | --- |
| `sharkania-public-2026-11-03.sql` | 228355 | `9315c5b57e539af6b49d4ce7d473702dc4bec220cdb42d56261de2c4ecd32c36` |
| `sharkania-private-2026-11-03.sql` | 2062 | `d2a0c986738329e0e6d341fdf38ba571570219847e9a5ebafa84a9ec0fb4860f` |

**Comprobación independiente:** 64 tablas públicas, 2 vistas, 57 funciones SQL definidas expresamente en el dump, 18 tipos enumerados, 22 triggers, 185 políticas RLS y 64 habilitaciones RLS; 1 tabla privada con RLS y dos FK a `auth.users` / `public.shared_hands`. Hay además referencias a `auth.uid()`, `public.vector` y `extensions.uuid_generate_v4`. Las 194 firmas de funciones del catálogo original incluyen funciones de extensiones; no confundirlas con las 57 `CREATE FUNCTION` explícitas exportadas.

**Validador seguro:** `scripts/verify-supabase-schema-snapshots.mjs` acepta las rutas de dos archivos SQL privados y únicamente muestra conteos, hashes y advertencias (no contenidos ni credenciales). Verificado contra ambos archivos. No prueba ausencia completa de secretos ni reemplaza restauración real.

**Bloqueos pendientes que ningún dump resuelve:** (1) los archivos incluyen `CREATE SCHEMA public` y corresponden al estado *posterior* a las 50 migraciones, por lo que no son el baseline histórico; (2) se exportaron con `--no-owner --no-acl` y NO incluyen permisos `GRANT/REVOKE` ni propietarios, que deberán reconstruirse y probarse; (3) el destino QA necesita `auth`, roles Supabase, extensiones y funciones relacionadas. Conservar la separación entre reconstruir un snapshot actualizado y reproducir cronológicamente las 50 migraciones.

**Hallazgos P0 adicionales** (solo lectura de `pg_policies` y privilegios efectivos en producción): `tournament_clubs` concede `ALL` con RLS `true` a `PUBLIC`; `shark_tv_videos`, `acc_payouts`, `acc_player_promo_config`, `acc_player_promo_payouts`, `site_configs`, `live_polls`, `blog_embeddings` y `current_league_champion` contienen políticas de escritura para autenticados sin validación administrativa suficiente. Se suman a la exposición económica de Stats Espía. Preparar cambios de menor privilegio y pruebas con roles **solo en QA**, sin afectar producción ni derechos de compradores antiguos.

**Estado:** exportaciones recuperadas y verificadas; restauración y permisos de QA no probados; reconstrucción histórica no resuelta; lanzamiento NO-GO. No crear rama facturable ni reparar historial en producción sin autorización específica.
