# SHARKANIA — Release A: seguridad de ligas (plan de corte independiente)

**Estado:** PR draft, flag `VITE_LEAGUE_GUARDED_RPC` desactivado. **NO GO** para producción. Esta rama nace de `main` y SOLO contiene seguridad/administración de ligas, sus fixtures y tests. No incluye la publicación ELO multimoneda, ranking ni interfaz Arena del PR #64.

## Confirmado a 4 nov 2026

- Vulnerabilidad reproducida: club secundario podía autovincularse a una liga ajena, marcarse `is_primary` y editarla; políticas de `league_rooms` tenían INSERT/DELETE amplio.
- El usuario ejecutó suites locales sobre 64 tablas Supabase QA con `BEGIN ... ROLLBACK`: mitigación de membresías, clonación sin herencia de clubes, formulario de creación/edición transaccional, controles de fechas, sala inválida, protección del club principal y recuperación sin cambios parciales: **PASS**.
- CI del PR #65 independiente: **5/5 SUCCESS** en el commit `e5255efe135e353c52b3b17c6171188f0546051d`, incluyendo PostgreSQL 17, PostgREST HTTP/JWT sintético y eliminación segura. El operador completó también QA local con **64 tablas reales** para borrado de ligas vacías versus ligas con torneos, comprobando `ROLLBACK` total y preservación de FK `tournaments.league_id`.
- Supabase producción se ha consultado SOLO en lectura. Las 32 ligas actuales tienen exactamente un organizador principal. `idx_leagues_slug` ya garantiza la unicidad del slug.
- Detectada vía FK de solo lectura una consecuencia peligrosa de `DELETE public.leagues`: `tournaments.league_id` queda NULL por `ON DELETE SET NULL`; `league_standings`, `league_clubs` y `league_rooms` se eliminan por `ON DELETE CASCADE`. Por esto Release A **revoca DELETE directo** y ofrece `delete_empty_league_guarded`, que rechaza ligas con torneos, plantillas, standings o campeón.

## Alcance de esta rama

1. `docs/security/league-membership-guarded-cutover-2026-11-04.proposal.sql` es **una propuesta SQL, NO una migración lista para ejecutar**. Define revocación coordinada de escrituras directas, policies de `leagues` por organizador principal, índice parcial `is_primary` y funciones creadas con permisos mínimos.
2. Cliente `src/lib/api/guarded-leagues.ts`, rutas de `src/lib/api/leagues.ts`, formulario `src/components/admin/league-form.tsx` y panel `src/pages/club-admin.tsx`. Todas las rutas nuevas quedan detrás del flag `VITE_LEAGUE_GUARDED_RPC === 'true'`; no activar sin completar el corte backend.
3. Fixtures sintéticos y GitHub Actions `.github/workflows/qa-league-security-release.yml`: PostgreSQL 17, autenticación JWT simulada por HTTP/PostgREST, roles A/B y superadmin, bloqueos y concurrencia de slug, guardado integral, borrado seguro.

## Gates obligatorios ANTES de aprobar producción

- [x] CI de este PR independiente en PASS (TypeScript + SQL PG17 + HTTP PostgREST + contratos) — commit `e5255efe135e353c52b3b17c6171188f0546051d`, 5/5 SUCCESS.
- [x] Ejecutar prueba específica de borrado seguro sobre esquema local Supabase QA: PASS `SHARKANIA_QA_eliminacion_segura_ligas_64tablas_v1.sh`, ROLLBACK completo. Se mantienen pendientes las verificaciones sobre la instancia preproducción completamente integrada y el preflight definitivo del esquema de producción justo antes de migrar.
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

## Plan de aceptación E2E del panel — aún SIN EJECUTAR

En una instancia **NO productiva** con aplicación y Supabase Auth completos, preparar cuentas ficticias de (A) admin de club organizador, (B) admin de club secundario, (C) jugador corriente y (D) superadmin; sin copiar datos personales productivos. Ejecutar y registrar URL del preview, SHA frontend/backend, momento de cada prueba y resultado HTTP:

| Actor / ruta | Acción esperada | Criterio PASS |
|---|---|---|
| Anónimo / directorio | Consultar ligas, clubes asociados y salas | HTTP 200; sin escritura |
| A / panel del club A | Crear liga con fechas, reglamento y dos salas | 1 liga, 1 principal A, 2 salas, sin escrituras parciales |
| A / panel del club A | Editar y reemplazar salas | 1 operación; cambios coherentes |
| A / panel del club A | Duplicar liga con B como participante | Replica configuración y salas, **no** copia B automáticamente |
| B / panel del club B | Ver liga compartida A | Solo lectura; Editar/Duplicar/Eliminar ocultos |
| B / API autenticada | Intentar alterar membresía, propietario o salas de liga A | HTTP 403; snapshot inalterado |
| C / API autenticada | Intentar crear/modificar liga ajena | HTTP 403; snapshot inalterado |
| D / panel desde club B | Editar liga compartida con principal A | Usa ID principal A real y persiste el cambio autorizado |
| A / panel del club A | Borrar liga con torneos o clasificaciones | HTTP 409, muestra explicación, conserva `tournaments.league_id` |
| A / panel del club A | Borrar liga nueva vacía | HTTP 200; desaparecen solo liga/club principal/salas de la nueva liga |
| Todos / pantallas existentes | Consultar torneos/rankings/ligas | Sin regresiones ni pérdida de relaciones |

**Diferencia crítica:** los tests PostgREST en CI crean JWT sintéticos; esta fase E2E exige Auth real de Supabase y navegador, no se considera cumplida por CI. El borrador SQL no debe aplicarse a producción antes de superar esta tabla y documentar respaldo/restauración. Si no hay entorno de preproducción completo, ese es el bloqueo a resolver primero.

## Estado del preview y backend de pruebas (comprobado 4 nov 2026)

- **Preview Cloudflare Pages existente y desplegado correctamente**: `https://cdabfdf3.sharkaniav2.pages.dev`, rama `security/league-guarded-release-a-2026-11-04`, commit `e5cf6f1d811169ccdc30e00b965695ff629bf880`, estado `success`. Es un artefacto de frontend, **no evidencia E2E**.
- **ALERTA CONFIRMADA — preview no aislado:** las variables de entorno de Cloudflare están cifradas (`secret_text`), pero el JavaScript compilado públicamente del preview inmutable `https://bdbaab66.sharkaniav2.pages.dev/` contiene la referencia del **Supabase productivo** (`nhpjzywfzljtlqaigzed`). Se comprobó mediante lectura de HTML y el recurso JS publicado, **sin iniciar sesión, sin extraer claves y sin enviar escrituras**. El frontend Vite embebe `VITE_SUPABASE_URL` en el bundle; el hecho de que el secreto no aparezca en la API de Cloudflare no demuestra aislamiento. **NO HACER PRUEBAS DE ESCRITURA EN PREVIEWS `.pages.dev` DE ESTE PROYECTO**, salvo que se haya vuelto a compilar con un proyecto Supabase QA distinto y se haya verificado en el artefacto resultante. `VITE_LEAGUE_GUARDED_RPC` no consta habilitado explícitamente en preview.
- **Supabase conectado**: `list_branches` de la cuenta solo muestra rama `main` del proyecto productivo; **no hay rama QA remota verificable**. El contenedor local `supabase_db_sharkania-qa` ya validó SQL reversible de 64 tablas, pero esas transacciones terminan con `ROLLBACK` y no permiten pruebas reales multi-sesión Auth/browser de cambios persistentes.
- **Regla de seguridad**: el preview inspeccionado **sí apunta a producción**. NO abrir sesiones de escritura ni probar Crear/Editar/Eliminar en él. Primero hay que configurar y verificar un endpoint Supabase **separado de producción**, con usuarios e inventario ficticios y backend configurado según la migración propuesta. No reemplazar las variables de Pages con referencias productivas ni habilitar el flag.
- **Próximo paso**: establecer una pila Supabase local completa (Postgres + Auth + REST y frontend local), aprovechando Docker/WSL, o una rama Supabase QA remota independiente con costo autorizado; instrumentar los casos E2E del bloque anterior. Elegir la modalidad más segura/costeable antes de crear recursos y no copiar credenciales al chat.


## GoTrue real en CI — seguimiento

Se añadieron `tests/fixtures/sharkania-league-real-auth-qa.mjs` y `.github/workflows/qa-league-real-auth.yml`, con Supabase local efímero, 4 usuarios QA y pruebas de roles/RPC vía PostgREST. **PASS VERIFICADO**: ejecución GitHub Actions [41878300128](https://github.com/SharkaniaElite/SharkaniaV2/actions/runs/41878300128), trabajo `real-auth-local` completo, incluidos inicialización GoTrue, fixture SQL local, inicio de sesión y RPC Auth/REST, limpieza. La prueba Auth/API **no sustituye** el E2E visual del panel sobre preproducción con 64 tablas.
