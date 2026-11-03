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
