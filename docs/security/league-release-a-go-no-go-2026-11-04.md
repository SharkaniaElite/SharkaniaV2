# SHARKANIA — Release A: seguridad de ligas (plan de corte independiente)

**Estado:** PR draft, flag `VITE_LEAGUE_GUARDED_RPC` desactivado. **NO GO** para producción. Esta rama nace de `main` y SOLO contiene seguridad/administración de ligas, sus fixtures y tests. No incluye la publicación ELO multimoneda, ranking ni interfaz Arena del PR #64.

## Confirmado a 4 nov 2026

- Vulnerabilidad reproducida: club secundario podía autovincularse a una liga ajena, marcarse `is_primary` y editarla; políticas de `league_rooms` tenían INSERT/DELETE amplio.
- El usuario ejecutó suites locales sobre 64 tablas Supabase QA con `BEGIN ... ROLLBACK`: mitigación de membresías, clonación sin herencia de clubes, formulario de creación/edición transaccional, controles de fechas, sala inválida, protección del club principal y recuperación sin cambios parciales: **PASS**.
- Suite sintética PostgreSQL 17 + PostgREST HTTP/JWT: PASS en PR #64 para ligas, clonación y guardado integral; se añadieron ahora controles nuevos de eliminación segura que **deben superar CI propia y prueba de 64 tablas**.
- Supabase producción se ha consultado SOLO en lectura. Las 32 ligas actuales tienen exactamente un organizador principal. `idx_leagues_slug` ya garantiza la unicidad del slug.
- Detectada vía FK de solo lectura una consecuencia peligrosa de `DELETE public.leagues`: `tournaments.league_id` queda NULL por `ON DELETE SET NULL`; `league_standings`, `league_clubs` y `league_rooms` se eliminan por `ON DELETE CASCADE`. Por esto Release A **revoca DELETE directo** y ofrece `delete_empty_league_guarded`, que rechaza ligas con torneos, plantillas, standings o campeón.

## Alcance de esta rama

1. `docs/security/league-membership-guarded-cutover-2026-11-04.proposal.sql` es **una propuesta SQL, NO una migración lista para ejecutar**. Define revocación coordinada de escrituras directas, policies de `leagues` por organizador principal, índice parcial `is_primary` y funciones creadas con permisos mínimos.
2. Cliente `src/lib/api/guarded-leagues.ts`, rutas de `src/lib/api/leagues.ts`, formulario `src/components/admin/league-form.tsx` y panel `src/pages/club-admin.tsx`. Todas las rutas nuevas quedan detrás del flag `VITE_LEAGUE_GUARDED_RPC === 'true'`; no activar sin completar el corte backend.
3. Fixtures sintéticos y GitHub Actions `.github/workflows/qa-league-security-release.yml`: PostgreSQL 17, autenticación JWT simulada por HTTP/PostgREST, roles A/B y superadmin, bloqueos y concurrencia de slug, guardado integral, borrado seguro.

## Gates obligatorios ANTES de aprobar producción

- [ ] CI de este PR independiente en PASS (TypeScript + SQL PG17 + HTTP PostgREST + contratos).
- [ ] Ejecutar **nueva** prueba de borrado seguro sobre esquema local Supabase QA con `ROLLBACK` y sin persistencia, además de los casos de creación/edición ya aprobados; revisar las políticas efectivas del esquema actualizado.
- [ ] Comprobar en una **instancia no productiva completa** que el frontend con Auth REAL permite crear, editar, duplicar, administrar salas, ver ligas compartidas y borrar solo ligas vacías; que jugador, B ajeno y B secundario no pueden modificar las ligas de A; que el superadmin funciona desde la vista de club participante.
- [ ] Definir política de invitación entre **administradores de distintos clubes**. Por ahora `add_league_club_guarded` solo permite superadmin o un usuario que administre ambos clubes; no existe un flujo de aceptación diferida. Mantener esa función restringida y no fingir compatibilidad con invitaciones aún no implementadas.
- [ ] Revisar todas las rutas legacy de `league_clubs`, `league_rooms`, `leagues`, `recalculate_league_standings` y acciones de backoffice; comprobar que no hay dependencias no cubiertas con revocación de DML.
- [ ] Preparar **migración real versionada** específica al estado actual del catálogo Supabase, revisar dueño/EXECUTE de SECURITY DEFINER y esquemas expuestos. Revisar advisory checker de Supabase. No aplicar el SQL de prueba `BEGIN/COMMIT` tal cual.
- [ ] Preparar respaldo RESTAURABLE, snapshot de GRANT/policies, rollback defensivo (no reabrir DML vulnerables), comprobación de despliegue de frontend y estado de flags.
- [ ] Aprobación explícita del propietario para desplegar y habilitar el flag; comprobar monitoreo posterior de permisos y alta/edición de ligas.

## Orden del corte

(1) Preflight de backups, recuentos, permissions, `is_primary`, índices y FKs con solo SELECT.  
(2) Instalar migración integrada y REVOKE de rutas vulnerables con control de transacción.  
(3) Habilitar nueva administración de ligas bajo flag en el frontend **solo tras verificar backend**, despliegue de prueba y comprobación de derechos.  
(4) Smoke test de lectura pública, torneos, resultados, 4 roles admin y write-denials.  
(5) Ante fallo, dejar la administración temporalmente **solo lectura** y preservar los grants restringidos; revertir frontend sin reabrir la vulnerabilidad.

## División de releases

**Release A** protege ligas y no requiere cambiar el ranking ni el ELO.

**Release B**, ELO/publicación segura, queda en **NO-GO**: `publish_tournament_results_guarded` solo admite USD; 221 de 247 torneos publicados son CLP/EUR; 263 jugadores tienen resultados multimoneda. La fórmula actual altera K según el buy-in numérico sin conversión ni normalización y suma acumulados monetarios incompatibles. Requiere decisión de negocio, modo sombra, backtest, nuevas agregaciones por divisa y QA independiente. Ver PR #64.

**En ningún momento ejecutar migraciones ni modificar producción sin autorización.**
