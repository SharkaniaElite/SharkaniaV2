# SHARKANIA — Migración ELO v2 versionada para revisión (NO GO)

**Fecha de preparación:** 13 de noviembre de 2026. **Estado:** solo rama de GitHub; NO instalada, NO fusionada, NO autorizada para producción.

## Fuente y trazabilidad
- Rama de preparación: `release/elo-v2-versioned-migration-review-2026-11-13`.
- Base inalterada: commit `fdb2233e412c958f08662aee6830bf9adedf1682` (PR #97, apilado sobre #96 y #95).
- Fuente revisada y ensayada en QA: `docs/security/release-a-v2-all-in-one-atomic-2026-11-10.CANDIDATE.sql`.
- **Git blob SHA fuente**: `45241f142dba4894fa349215fa938ea220d4c1ba`.
- **Migración versionada**: `supabase/migrations/20261113182000_release_a_elo_v2_usd_official_fx.sql`.
- La migración es una **copia byte a byte del SQL del candidato**, incluidos sus avisos QA; se conserva la identidad del contenido y la transacción única. El hecho de estar en `supabase/migrations/` **NO constituye aprobación de despliegue**. Si se fusiona o despliega una rama que la incluya, la CLI podría aplicarla: mantener la rama aislada hasta GO.

## Evidencia QA y limitaciones
- Ensayos locales del propietario 05 a 09: restauración lógica cifrada aislada y 18 tablas de datos; 1.826 jugadores, 1.329 torneos y 21.377 registros de resultados/ELO; huella ELO v1 `b1f510063c695d107301e722b86991a4` preservada; publicaciones USD/CLP/EUR, controles negativos y competencia de sesiones aprobados sin datos ficticios persistentes.
- Ejecución GitHub Actions `42904945827` (GoTrue y PostgREST auténticos **locales** sobre datos sintéticos): aprobada; no significa que Auth/RLS de producción haya sido clonado.
- No existe un ensayo completo de restauración física de Supabase con Auth, Storage y los cron, ni integración productiva del capturador con recibos FX reales; NO utilizar un clon físico conectado sin garantizar aislamiento de red, credenciales y cron.

## Condiciones de solo lectura verificadas el 13-11-2026
- 5/5 huellas de funciones legadas conformes con el preflight SQL.
- 4/4 tablas críticas con RLS; 0 colisiones normalizadas de nickname; 0 jugadores sin sala/nickname.
- `sharkania_release` no existe todavía en producción. PostgreSQL 17; `pg_cron`, `pg_net` y Vault disponibles.
- Dos trabajos cron productivos existentes **a preservar**, sin modificar su configuración:
  - `sharkania_ignition_auto_welcome_2026_11` (cada cinco minutos).
  - `update_dolar_diario` (cada seis horas).
- La función Edge `elo-fx-capture` **no está desplegada**. El bloque de configuración mantiene `enabled = false`.
- Estas condiciones son una fotografía temporal: repetir preflight con solo SELECT antes de cualquier GO.

## Riesgos y puertas GO
1. **Migración SQL + ACL/RLS:** la migración realiza `CREATE OR REPLACE FUNCTION`, `REVOKE`, `GRANT`, `DROP POLICY` y nuevos triggers. No es solo crear tablas: puede interrumpir escritorios/rutas antiguas. Requiere ventana de mantenimiento, respaldo íntegro verificable, plan de reversión, versión final comprobada y autorización específica. Su transacción interna revierte ante fallos **durante** la aplicación, pero no constituye un down-migration seguro tras COMMIT.
2. **Captura FX:** diseñar y autorizar por separado despliegue `elo-fx-capture`, clave **dedicada** `elo-fx-scheduler`, secretos Vault nombrados `sharkania_elo_fx_url` y `sharkania_elo_fx_scheduler_key`, comprobación de los feeds BCCh y BCE reales y alertas de frescura. No exponer tokens en el chat, SQL, GitHub ni logs. Proteger la cola de `pg_net`.
3. **Cron:** **no forma parte** de esta migración. El cron candidato horario está separado y protegido por aprobación explícita; conservar los dos cron actuales. Nunca programarlo antes de validar secretos, función y salud del feed.
4. **Corte deportivo:** mantener ELO v1 histórico inalterado, ELO v2 apagado hasta GO, fecha efectiva sin retroactividad (primer evento futuro iniciado después de tener fuente oficial operativa). Los eventos históricos sin captura previa quedan bloqueados, sin inventar cotizaciones.
5. **Código web:** mantener flags ELO v2 apagados, revisar los escritores antiguos afectados y coordinar el orden de los PR #95 → #96 → #97 con migración backend. Sin fallback a escrituras de navegador inseguras.
6. **Costos y aprobaciones:** calcular consumo/costo real antes de crear recursos adicionales; aprobación independiente para cada acción productiva (migración, Edge, clave/Vault, cron, merge, Cloudflare y flags).

## Preparación y comprobación sin ejecutar SQL
- El artefacto SQL versionado usa una sola envoltura `BEGIN;` / `COMMIT;` y preserva la versión de SQL que superó las pruebas de QA.
- Comprobar que los dos archivos tengan idéntico Git blob SHA, sin inserciones, pérdidas de líneas ni normalización de contenidos.
- Comprobar que la rama partió del commit de PR #97 y que el diff únicamente incluye este SQL y este documento.
- **No ejecutar** `supabase db push`, `supabase migration up`, SQL Editor productivo, despliegues Edge, `cron.schedule`, cambios de secretos o flags para realizar esta preparación.
- En la ventana GO autorizada: primero respaldo verificado y paridad de catálogos; luego aplicación supervisada de la migración con flags apagados, verificaciones de salud y auditoría de ACL; después autorizar en fases la captura FX y por último el corte del frontend con prueba real segura.

**Tablero único de salida:** https://github.com/SharkaniaElite/SharkaniaV2/issues/98

**DECISIÓN ACTUAL: NO GO.** Preparación GitHub solamente, sin ejecutarse en producción.
