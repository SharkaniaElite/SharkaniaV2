# SHARKANIA ARENA — control de salida a producción

**Fecha de control:** 3 de noviembre de 2026  
**Base:** PR #64 (`feature/sharkania-arena-experience-preview`), todavía en borrador.  
**Decisión actual:** **NO FUSIONAR NI PUBLICAR TODAVÍA.** Este documento separa hallazgos comprobados de pruebas pendientes; no autoriza cambios sobre producción.

## 1. Alcance y decisiones de producto verificadas

- La identidad Arena (póker competitivo, ranking ELO, torneos, clubes, ligas, noticias, herramientas, promociones, SharkTV y tienda) ya está implementada en la rama Preview.
- El propietario decidió **retirar el Replayer de manos del catálogo público**. El catálogo `/tools` y La Bóveda no ofrecen nuevas compras del Replayer. La demostración Preview ya no lo anuncia.
- **Compatibilidad:** las rutas antiguas `/tools/replayer` y `/tools/replayer/h/:id` permanecen protegidas. Consulta SQL agregada de solo lectura confirmó **2 productos configurados y 1 compra activa** relacionados con `tool_replayer` a la fecha de revisión. No borrar el código, compras ni historiales sin plan de migración y tratamiento de derechos de quien ya compró.
- La navegación Arena ya no asegura que existe un directo activo: en lugar del indicador rojo intermitente, el enlace de Arena se llama «TV» en móviles y «Transmisiones» en pantallas mayores. `/live` ahora conserva `PageShell variant="arena" showMarketing` y los banners previamente disponibles.
- La página `/live` ya no crea un iframe vacío si falta el video configurado y ofrece acceso a SharkTV; tampoco emplea una etiqueta SEO «EN VIVO» sin verificar. La información comercial fija de esa página (premio de liga, enlaces de inscripción y condiciones) **todavía necesita confirmación editorial de vigencia antes de publicar**.
- Revisado lenguaje del catálogo para distinguir simulaciones, estimaciones y resultados orientativos de afirmaciones de precisión o rentabilidad garantizada.

## 2. Bloqueos reales de lanzamiento

### P0 — Protección de Stats Espía en el servidor (NO SUPERADO)

Control directo y solo lectura sobre Supabase `sharkania`:

- El rol `anon` aún puede leer columnas financieras en `players` y `tournament_results` mediante permisos SQL actuales.
- La función heredada `get_unified_player_stats(text)` todavía admite ejecución anónima mediante un RPC `SECURITY DEFINER`.
- La nueva función `stats_spy_get_summary_v1` no figura instalada en la base revisada.
- El interruptor cliente `VITE_STATS_SPY_SECURE_RPC` está diseñado como opt-in; **no protege la base de datos ni sustituye los permisos SQL**.

**Salida exigida:** aplicar el plan `docs/security/stats-spy-cutover-runbook-2026-11-03.md` primero en una base aislada; corregir consultas `SELECT *` y RPC antiguas, diferenciar datos públicos de métricas premium y ejecutar pruebas `anon`, autenticado sin licencia, con licencia, caducado y administrador. Revisar regresiones del ranking, comparador, perfiles, resultados, historial y compra de funcionalidades. No aplicar directamente la propuesta SQL sin comprobar sus dependencias.

### P0 — QA de autenticación, transacciones y cuentas (NO SUPERADO)

- Cloudflare Pages Preview no define `VITE_TURNSTILE_SITE_KEY` y el widget actual de Turnstile no autoriza hostnames `*.sharkaniav2.pages.dev`. La configuración de autenticación de Preview **no está demostrada como aislada** de producción.
- Por eso el login, registro, recuperación y operaciones privadas están deliberadamente bloqueados en esos hosts. La ruta `/__arena-qa` muestra **solo datos ficticios** y sirve para revisar diseño; no acredita un flujo real. Un único flag de habilitación no basta: el guardián Preview también exige referencia explícita de proyecto QA **distinta** de la de producción y una sitekey Turnstile definida.
- Falta validar con usuarios de prueba en un backend separado: alta y confirmación de correo, inicio/cierre de sesión, recuperación, edición del perfil, nickname y club, estado Ignition, permisos de admin, Shark Coins, compra, caducidad y controles premium.

**Salida exigida:** construir entorno de QA aislado, usar Turnstile propio de prueba y dominios permitidos, callbacks de Auth autorizados, correos de prueba separados y auditoría de escrituras para evitar afectar cuentas reales. No se requieren contraseñas ni secretos enviados por chat.

### P1 — Revisión funcional y SEO de publicación (PENDIENTE)

- Confirmar desde 320/390/1440 px y teclado los directorios, menús, filtros, paginaciones, búsqueda, clases responsive, formularios y mensajes de error en `/`, `/ranking`, `/calendar`, `/clubs`, `/leagues`, `/tools`, `/shop`, `/promociones`, `/ignition`, `/tv`, `/live` y páginas de detalle.
- Validar enlaces de socios: las páginas de Ignition deben presentar solo el banner Ignition, y el resto conservar los espacios aprobados. Verificar fechas y condiciones comerciales antes de promocionarlas.
- Comprobar que canonical, etiquetas `noindex` y metadatos de producción apunten a `https://sharkania.com` y que preview no genere duplicados en buscadores. Verificar respuestas 200/3xx/404, `robots.txt`, sitemap, navegación, datos estructurados y redirecciones tras la fusión.
- Confirmar que la publicación no cambie ni destruya URLs históricamente indexadas, resultados, referidos existentes, datos de usuario ni políticas de acceso. Cualquier exclusión de una URL deberá tener tratamiento SEO y enlaces entrantes.
- CI verde no equivale a una prueba de extremo a extremo. Documentar capturas, escenarios, errores y medidas correctivas para cada grupo de páginas.

### P1 — Disponibilidad y retroceso (PENDIENTE)

- Mantener PR en DRAFT hasta superar P0 y el QA crítico P1.
- Obtener aprobación explícita para fusionar en `main` y permitir que Cloudflare despliegue producción.
- Registrar commit de producción anterior y disponer de rollback verificable a la última versión sana.
- Después del despliegue: prueba de inicio/cierre de sesión, registro, ranking, liga Ignition, tienda, páginas SEO críticas y monitoreo inmediato de errores y métricas. Revertir si falla seguridad, autenticación o transacciones.

## 3. Situación de infraestructura y costo

- No se creó otra base de datos ni se modificaron políticas o secretos en esta revisión.
- La consulta a `list_branches` mostró únicamente la rama principal de Supabase (sin una rama QA aislada utilizable).
- La rama de desarrollo de Supabase puede cobrar cómputo **por hora**. La autorización de gasto previo del propietario fue con tope inferior a USD 5 al mes: **no asumir que dejar una rama abierta todo el mes cumple ese tope**. Cotizar costo actual antes de crearla, limitar su duración y eliminarla después de las pruebas, o utilizar una alternativa local de cero costo. La configuración de Turnstile para pruebas también requiere gestión separada y controles de acceso.

## 4. Matriz de lanzamiento — no confundir estado

| Área | Estado | Criterio |
| --- | --- | --- |
| Identidad Arena y páginas públicas | Implementada en Preview | Revisión visual completa y aprobaciones editoriales |
| Replayer retirado del catálogo | Implementado en PR | Mantener compatibilidad para la compra activa |
| Build TypeScript, tests de contratos, sitemap | Verificar en el último commit | Todos verdes antes de merge |
| Stats Espía protegido en DB | **Bloqueado** | Validaciones de roles, RLS/RPC, sin rutas alternativas |
| Auth y Turnstile en QA aislado | **Bloqueado** | Flujos E2E con test users y datos inventados |
| Compra y Shark Coins en QA | **Pendiente** | Compras, saldo y expiración sin tocar personas reales |
| SEO / canónicas / sitemap tras despliegue | **Pendiente** | Rutas de producción, robots y rastreo correctos |
| Aprobación de publicación y rollback | **Pendiente** | Autorización expresa + plan verificable |

## 5. Orden recomendado

1. Cerrar la prueba de retiro del Replayer y verificar la experiencia actualizada en Preview.
2. Preparar la migración segura de Stats Espía; probarla solo en un entorno aislado.
3. Habilitar un entorno de autenticación/correo/Turnstile independiente y ejecutar los flujos funcionales críticos.
4. Pasar el QA público, los enlaces comerciales, SEO y responsive; corregir las regresiones.
5. Presentar un reporte final **GO / NO-GO** y solicitar aprobación para merge y despliegue. Sin atajos en permisos o reCAPTCHA/Turnstile.

**Nota:** no existe una fecha de salida comprometida; la decisión se basa en criterios de calidad verificables, no solo en el aspecto de las páginas.


## Actualización QA — rama temporal fallida y eliminada (3 noviembre 2026)

Con autorización para cómputo **USD 0,01344/h**, se creó una sola rama temporal Supabase `qa-stats-spy-20261103-temporal`, pero falló con `MIGRATIONS_FAILED`. El proyecto asociado no fue accesible; no se desplegaron las nuevas RPC ni se ejecutaron tests de seguridad. Se eliminó la rama con `success=true` y se verificó que `list_branches` vuelve a mostrar **solo main**.

**Corrección posterior:** las 29 versiones faltantes se recuperaron desde las sentencias históricas registradas por Supabase; 11 espejos antiguos fueron alineados y el archivo duplicado inválido fue retirado. El repositorio cuenta ahora con **50 migraciones SQL preservadas y bloqueadas por hash**. El bloqueo persiste porque solo **10 de las 64 tablas públicas** tienen una creación registrada en esas migraciones; 54 pertenecen a un esquema inicial anterior no recuperado. No se ha confirmado la sentencia exacta que hizo fallar el aprovisionamiento.

**Estado del gate P0:** BLOQUEADO por **baseline inicial faltante**, no por archivos históricos ausentes. El chequeo `npm run qa:migrations:history` comprueba los 50 SQL; el preflight completo `npm run qa:migrations` continúa rechazando nuevas ramas hasta recuperar el esquema de origen. No repetir creación de rama con cargo hasta validar la reproducibilidad y los logs del fallo. No modificar el historial remoto con `migration repair` ni generar un baseline ficticio en producción.

Detalles y trazabilidad: [Supabase QA branch failure](../security/supabase-qa-branch-failure-2026-11-03.md).

**Procedimiento de recuperación del baseline (solo esquema, sin datos):** [Supabase initial schema recovery](../security/supabase-initial-schema-recovery-2026-11-03.md).


## Actualización del catálogo estructural y obtención del esquema (3 noviembre 2026)

Se recuperó una **fotografía de solo metadatos del estado actual** de PostgreSQL, no una copia de filas: 64 tablas, 567 columnas, 184 restricciones, 138 índices, 194 firmas de funciones (sin cuerpos), 22 triggers, 185 políticas (sin predicados), 2 vistas, 77 etiquetas de enumerados y 9 extensiones. Una expresión de default potencialmente sensible se excluyó de la captura pública.

- Archivo de referencia: [Catálogo actual del esquema](../security/supabase-schema-catalog-2026-11-03.json).
- Test de integridad: `tests/supabase-schema-catalog.test.mjs`; incluye pruebas del preflight que debe rechazar una nueva rama cobrada sin baseline histórico.
- Extracción DDL completa y **sin datos** preparada para ejecución autenticada local en Windows: `scripts/export-supabase-schema-only.ps1`. El SQL no se sube automáticamente a GitHub y se revisará antes de usarlo.

**Estado del P0 de base de datos:** NO-GO; las definiciones exactas del esquema anteriores a `20260320132525` aún no están disponibles en el acceso conectado. La foto actual no equivale al baseline histórico y no debe insertarse delante de las 50 migraciones. Requiere exportación DDL y reconstrucción/validación aislada. No se creó otra rama QA ni se aplicaron cambios SQL en producción.


## Actualización: dos dumps SQL privados completos (3 noviembre 2026)

El propietario exportó en Ubuntu/WSL 2 con `pg_dump 18.6` **solo el esquema** de PostgreSQL 17.6, usando conexión Session pooler IPv4. Se verificaron `public` (64 tablas, 185 políticas RLS, 22 triggers) y `private` (1 tabla `hand_view_cooldowns`, FK a `public.shared_hands` y `auth.users`). Ambos dumps permanecen fuera del repositorio; se añadieron únicamente **hashes, recuentos, documentación y un validador offline** `scripts/verify-supabase-schema-snapshots.mjs`.

**Persisten los gates de NO-GO:** snapshot es posterior a las 50 migraciones, sin historial inicial; falta ensayar restauración en QA Supabase y recomponer permisos/roles/extensiones, porque los dumps tienen `--no-acl --no-owner`. Además de Stats Espía, se identificaron políticas RLS demasiado abiertas en `tournament_clubs`, SharkTV, tablas ACC de pagos y varias tablas de administración. No se aplicó SQL ni se creó una rama con cobro.


## Actualización de prioridades — SharkTV fuera de alcance (3 noviembre 2026)

Por decisión del propietario, **no invertir más tiempo en auditoría/remediación individual de SharkTV**: se retirará por un proyecto de limpieza posterior, sin tocar datos ni derechos históricos sin evaluación. No confundir esta decisión con autorización para borrar objetos de producción ahora.

**Prioridad técnica nueva:** permisos P0 de `tournament_clubs`, tablas ACC de pagos, `site_configs`, `live_polls` y `blog_embeddings`; Stats Espía mantiene bloqueo P0. La propuesta RLS **no aplicada** y la matriz de roles están en [Plan RLS sin SharkTV](../security/non-sharktv-rls-hardening-plan-2026-11-03.md). El modelo de permisos de `current_league_champion`, `players` y `leagues` requiere revisión funcional antes de cambiarlo.

**Estado:** solo documentación, tests estáticos y propuesta de SQL en rama Preview. CI de frontend no certifica RLS en producción. Faltan pruebas reales en ambiente aislado y aprobación para cambios SQL. NO-GO.
