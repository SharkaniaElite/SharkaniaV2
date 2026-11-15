# SHARKANIA — Plan operativo de instalación ELO v2 y reversión

**Preparado:** 15 de noviembre de 2026. **Estado: PLAN PROPUESTO / NO GO / NO MERGE.**  
**Propietario:** aprobación separada requerida para cada mutación productiva.  
**Fuente de continuidad:** Issue #98, rama integrada ELO v2, reconciliación histórica del 14/11 y QA 05–09 ya terminada.  
**Este archivo NO es un script de instalación, una autorización, ni una orden para ejecutar comandos.**

## 1. Objetivo y alcance cerrado

Lanzar ELO v2 **solo para torneos futuros elegibles**, normalizando el buy-in USD/CLP/EUR mediante observaciones oficiales capturadas antes del comienzo, preservando sin reescritura ELO v1, resultados, premios y reentradas históricos.

Solo cuatro puertas del Issue #98: seguridad/motor aprobados; FX oficial operativa pendiente; prueba final aislada sobre datos representativos históricamente aprobada para el motor pero sin equivalencia de clon completo; y autorización de corte productivo todavía ausente. No reabrir QA 05–09, GoTrue/PostgREST local ya aprobado ni auditorías genéricas.

### Bases versionadas y resultados comprobados

| Objeto | Evidencia | Estado |
|---|---|---|
| Git \`main\` al momento del análisis | \`026d02fc29661a8d2d531f1d6e319cf6c35d7ad9\` | Sin modificación |
| Integración de revisión | \`release/elo-v2-integrated-review-2026-11-15\` | NO MERGE |
| Último commit de código validado | \`59dc04454f44d3a052382fa2b851b565b4b4cb1b\` | CI PASS |
| CI focalizado | [GitHub Actions #43746735388](https://github.com/SharkaniaElite/SharkaniaV2/actions/runs/43746735388) | Contratos + integridad + TS/Vite PASS |
| Migración nueva ELO v2 | \`supabase/migrations/20261113182000_release_a_elo_v2_usd_official_fx.sql\` | NO aplicada |
| Git blob del SQL ELO v2 | \`45241f142dba4894fa349215fa938ea220d4c1ba\` | Contenido íntegro |
| Historial remoto \`supabase_migrations.schema_migrations\` | 54 versiones | Ninguna coincide con \`20261113182000\` |
| Archivos de la rama \`supabase/migrations\` | 54 históricos + 1 nuevo | Paridad exacta por **versión**, no necesariamente por SQL |
| Esquema \`sharkania_release\` | Ausente en producción | NO instalado |
| \`elo-fx-capture\` Edge Function | No desplegada; config Git \`enabled=false\` | No operativa |
| Flags Cloudflare Pages | Los tres \`VITE_*_RPC\` no están activos en producción/preview | ELO v2 OFF |

Estado operacional de solo lectura al corte: PostgreSQL 17; cron productivos activos a preservar \`sharkania_ignition_auto_welcome_2026_11\` (cada cinco minutos) y \`update_dolar_diario\` (cada seis horas). Presencia de pg_cron, pg_net y Vault. No se inspeccionaron valores de secretos ni datos personales.

**Fotografía temporal:** los estados anteriores deben reconfirmarse inmediatamente antes de cualquier GO, sin realizar cambios.

## 2. Decisión sobre las 11 diferencias históricas SQL

**Decisión propuesta: conservar las 54 migraciones históricas con sus versiones reconciliadas y NO reejecutar, sobrescribir ni “reparar” las 11 diferencias.** Supabase controla aplicación de migraciones por **ID de versión**; el código que contiene un archivo antiguo no se compara como un nuevo despliegue si su ID ya figura aplicado. No confundir **paridad de IDs** con **reproducción demostrada de una base vacía**.

### A. Cuatro diferencias cuyo texto coincide al quitar comentarios/espacios (evidencia preliminar del 14/11)

| Versión | Área | Disposición |
|---|---|---|
| \`20261031151554\` | RLS del contador interno de vistas de manos | Conservar; no volver a aplicar |
| \`20261031153006\` | Autoría y privilegios de manos compartidas | Conservar; no volver a aplicar |
| \`20261031154647\` | IDs fuertes para manos compartidas | Conservar; no volver a aplicar |
| \`20261031155504\` | Lectura privada de manos compartidas | Conservar; no volver a aplicar |

La coincidencia tras normalización textual **no demuestra por sí sola equivalencia semántica**.

### B. Siete diferencias que requieren cautela

| Versión | Diferencia previamente analizada | Riesgo y regla |
|---|---|---|
| \`20261031143409\` | Git suma cuatro \`DROP POLICY IF EXISTS\` para \`club_admins\`; el histórico productivo usa \`BEGIN/COMMIT\`. | No reejecutar ni asumir que el orden transaccional es equivalente. |
| \`20261031145349\` | El histórico ajusta \`claim_auto_mission(uuid)\` con \`DO\`; Git conserva la función completa. | Se comparó antes con definición final actual; conservar y revalidar solo si afecta dependencia. |
| \`20261031145511\` | Orden de \`AND\`, delimitador de función y \`SECURITY INVOKER\` explícito/implícito. | Conservar RLS/INVOCADOR final; no ampliar privilegios. |
| \`20261031145750\` | Git define tres funciones de academia completas; Supabase efectuó modificaciones dinámicas. | Mayor diferencia. **Mantener la corrección posterior** \`20261031160943\` de \`academy_unlock_module\`; nunca sustituirla. |
| \`20261031145859\` | Git añade cinco \`DROP POLICY IF EXISTS\`, cambia delimitador y omite invocador explícito. | Conservar guardas/restricciones de academia; comprobar solo metadatos vigentes antes de GO. |
| \`20261031151248\` | Git usa \`ON CONFLICT ON CONSTRAINT\`; la versión histórica usaba columnas. | El ajuste posterior \`20261031151446\` fue el que corrigió la ruta; preservar ambos IDs. |
| \`20261031151446\` | Comentarios/formato y secuencia normalizada equivalente. | Conservar; no reejecutar. |

Las comparaciones de funciones y políticas finales señaladas se hicieron en el trabajo de reconciliación del 14/11; **no se repitieron contra una base desechable al escribir este plan**.

La copia de referencia \`docs/security/reference-only/20261031_secure_batch_blog_views.LEGACY_MIRROR.sql\` está correctamente **fuera** de \`supabase/migrations\`; **NO es migración a ejecutar**. El historial real PostHog son \`20261031135830\` y \`20261031135902\`.

### C. Puerta de historial previa al GO

1. Comparar **solo lectura** la lista remota \`supabase_migrations.schema_migrations\` con las 54 versiones históricas y comprobar que \`20261113182000\` aún no aparece.
2. Congelar herramienta/versión: Supabase CLI v3 (desde 04/11/2026) apunta por defecto a la base **local**; los comandos remotos requieren \`--remote\`. Confirmar \`supabase --version\` y ayuda de cada comando antes de usarlo. No reutilizar automáticamente scripts de CLI v2.
3. Examinar, **sin ejecutar SQL**, la salida de \`supabase migration list --remote\` y la previsualización \`supabase db push --remote --dry-run\` una vez configurado un contexto seguro. **Criterio exacto: se propone UNA migración pendiente, la \`20261113182000\`; cualquier otra o advertencia de reparación = STOP**.
4. No ejecutar \`db push\`, \`migration repair\`, \`db reset\`, \`db pull\` que escriba archivos no revisados, ni pegar el SQL en el editor productivo por improvisación. El mecanismo definitivo de aplicación y registro de una sola versión necesita aprobación específica.
5. Para reconstrucción desde cero o recuperación de desastre, todavía existe riesgo de dependencias anteriores al primer registro de marzo y de divergencias históricas. Planear una prueba de **reproducibilidad de esquema dirigida**, aislada y aprobada, si la estrategia de respaldo/reversión la requiere; **no repetir la batería de ELO ya aprobada**.

Fuentes: [reconciliación WIP](./migration-reconciliation-2026-11-14.WIP.md), [Supabase migraciones](https://supabase.com/docs/guides/deployment/database-migrations) y [cambio CLI v3 04/11/2026](https://supabase.com/changelog/supabase-cli-v3).

## 3. Matriz de impacto real de la migración

El candidato contiene \`BEGIN\`/\`COMMIT\` únicos (la reversión automática solo cubre errores **antes de COMMIT**). Su contenido **no es inocuo solo porque ELO v2 siga apagado**.

| Superficie | Cambio SQL del candidato | Consecuencia antes del corte de frontend |
|---|---|---|
| Administración de ligas | \`DROP POLICY\` y \`REVOKE\` DML de \`leagues\`, \`league_clubs\`, \`league_rooms\`; nuevas RPC protegidas | La interfaz antigua aún puede intentar escrituras REST directas; pueden fallar legítimamente. |
| Carga y edición de resultados | Revoca escrituras de navegador sobre \`tournament_results\`, \`elo_history\` y \`league_standings\`; crea triggers de protección histórica | No habilitar publicación por rutas antiguas entre migración y frontend coordinado. |
| Jugadores / nicknames | Reduce DML de \`players\`; nuevas asociaciones protegidas | Ciertas vinculaciones administrativas directas pueden fallar hasta que se habiliten las rutas RPC. |
| Torneos y borrados | Reemplaza funciones legacy y añade triggers para evitar borrado/reapertura de torneos con publicación | No probar borrar o reabrir datos reales como test. Cambiar flujo de mantenimiento únicamente con autorización. |
| ELO nuevo y FX | Nuevo esquema privado \`sharkania_release\`, journals, observaciones oficiales, guardas y activación OFF | No puede ponerse en uso sin migración, backend/FX y corte deportivo. |
| Automatizaciones existentes | No se pretende modificar \`sharkania_ignition_auto_welcome_2026_11\` ni \`update_dolar_diario\` | Deben mantenerse intactos; cualquier interacción inesperada con RPC nuevas es STOP. |

**Evidencia de dependencia frontend:** \`src/components/admin/league-form.tsx\` conserva inserciones/actualizaciones REST directas mientras \`VITE_LEAGUE_GUARDED_RPC\` es false; \`results-upload.tsx\` y \`results-editor.tsx\` eligen entre rutas legadas y RPC protegidas. \`super-admin.tsx\` conserva vínculos directos de jugadores cuando el flag independiente es false. Por eso **NO planear “migrar SQL con flags OFF y seguir administrando sin interrupción”**. Hace falta congelar las escrituras afectadas durante un corte coordinado.

## 4. Respaldo, privacidad, entorno aislado y costo

### Respaldo anterior al corte (condición innegociable)

- Comprobar en Supabase Dashboard > Database > Backups la **existencia y fecha verificable** del último respaldo; la herramienta disponible no certifica hoy su punto de restauración ni si PITR está habilitado.
- Planificar **copia lógica cifrada actual y verificable**, con inventario de esquemas, roles, extensiones, triggers y las tablas/filas afectadas. Mantener los archivos en dispositivo privado, NO en chat, GitHub, CI, repositorio público, OneDrive o Storage sin controles. No pedir contraseñas/tokens en conversación.
- Preservar una instantánea de metadatos de catálogo y de integridad de ELO v1 (huella calculada **en el propio preflight**, no reutilizar como garantía la huella QA de noviembre), conteos de jugadores, torneos, resultados y journals; revisar paridad de restore con alcance real.
- El respaldo de **base de datos no incluye los objetos** del Storage API (solo metadatos). Cubrir explícitamente esos archivos si una restauración integral los requiere.
- Acordar RPO y RTO antes del GO. Una copia de la mañana no garantiza revertir sin perder altas/resultados posteriores; con PITR la restauración también elimina los cambios posteriores al punto elegido.
- **No usar “Restore to a New Project” físico como ensayo directo**: Supabase indica que replica pg_cron/pg_net y los trabajos externos pueden arrancar automáticamente, sin oportunidad de deshabilitarlos antes. Usar restauración **lógica** en PostgreSQL 17 aislado con salida a Internet bloqueada de antemano, credenciales ficticias y extensiones externas deshabilitadas. Exige permiso separado para copiar datos reales.
- La restauración de QA 05–09 fue exitosa para su alcance (18 tablas ELO y datos representativos), pero **no constituye** una restauración integral garantizada de Auth/Storage/Vault/cron. No presentarla como plan de disaster recovery.

### Costos antes del GO

- Este documento **no crea recursos facturables**. Las acciones GitHub de preparación ya ejecutadas no constituyen por sí solas instalación.
- Documentación Supabase: proyectos Pro disponen de respaldos diarios (últimos siete días), pero la **disponibilidad efectiva** del respaldo concreto debe comprobarse. PITR es complemento con precio publicado de aprox. **USD 100/mes para siete días** (\`USD 0,137/h\`), según [documentación consultada 15/11/2026](https://supabase.com/docs/guides/platform/backups). **No habilitarlo sin costo y permiso aceptados**.
- Una rama/proyecto Supabase adicional puede generar cargo por cómputo. No crear uno para repetir QA ya terminado. Si el plan de copia aislada requiere servicio nuevo, solicitar **cotización actual del proyecto/organización** y aprobación del valor antes de crearlo.
- Revisar las cuotas reales del plan vigente para invocaciones Edge, pg_cron/pg_net, BCCh, transferencia y eventuales aumentos. No afirmar “costo cero” en producción sin comprobar consumo y límites.

## 5. Preflight de producción permitido solo en modo lectura

**Momento:** inmediatamente antes de la ventana aprobada y después de verificar \`main\` y el candidato exactos.

- [ ] Código y PR: congelar SHA de \`main\` y rama de entrega; comparar diffs y decidir **una sola** vía de integración. No fusionar #95→#96→#97 además del mismo contenido integrado, porque se solaparían cambios.
- [ ] CI actual: comprobar ejecución verde de contratos, TypeScript y build para la versión que realmente se instalaría (última ejecutada: #43746735388 sobre \`59dc044...\`). Commit documental posterior no cambia código.
- [ ] Supabase: 54 versiones históricas, ninguna \`20261113182000\`, ningún esquema \`sharkania_release\`, versión PG, extensiones disponibles; metadatos de políticas/triggers críticos, privilegios actuales \`anon\`/\`authenticated\`/\`service_role\`, funciones de administración y acceso a históricos.
- [ ] Integridad: registrar ELO v1, conteos ELO/resultados/tournaments/league standings y checksum bajo una consulta determinista de solo lectura; no publicar PII ni hashes calculados desde identificadores personales sin necesidad.
- [ ] Cron: exactamente los dos trabajos actuales con sus horarios; no leer ni divulgar cuerpos de comandos con potenciales secretos.
- [ ] API/Edge: \`elo-fx-capture\` aún ausente, BCCh preview existente separado; BCCh token ya se probó en otro módulo y **no** acredita todavía el capturador ELO.
- [ ] Cloudflare: snapshot de despliegue y tres \`VITE_*\` OFF; configuración de preview ligada a todas las ramas. Cualquier push debe usar \`[CF-Pages-Skip]\` mientras no se autorice vista previa.
- [ ] Respaldo: fecha/alcance reales, prueba de restauración o método de recuperación validado, cifrado, encargados, RPO/RTO aceptados y veto de efectos externos.
- [ ] Negocio: ventana **sin torneos ni publicaciones en curso**; congelar escrituras de ligas/resultados/identidades afectadas, establecer responsable de decisión GO y canal de reporte, anunciar mantenimiento si fuese necesario.
- [ ] Gatilho “STOP”: cualquier divergencia nueva de versiones, SQL hash distinto, políticas cambiadas, backup no verificable, cron extra, conflicto en \`main\`, operaciones de usuarios que no puedan congelarse o permisos incompatibles.

## 6. Secuencia de instalación propuesta, tras aprobaciones futuras y separadas

### Fase A — preparar la ventana y congelar escrituras afectadas

1. Aprobación y responsable operativo expresos. No activar ELO v2 ni tocar producción fuera de ventana.
2. Publicar aviso, congelar **solo las escrituras incompatibles** (administración/creación de ligas, carga de resultados, vinculaciones pertinentes), preservando accesos de lectura y flujos no afectados; medir actividad en curso.
3. Verificar backup actual y procedimientos de recuperación; anotar punto de corte y checklists firmados.
4. Comprobar que el mecanismo elegido aplicará **solo** la migración \`20261113182000\`. **Nunca** ejecutar las otras 54 migraciones en producción.

### Fase B — backend transaccional, guardado por mantenimiento

5. Bajo GO **específico para migración** y sin cron FX activo, ejecutar exclusivamente el archivo exacto con blob \`45241f...\`, usando método versionado auditado y supervisado. No ejecutar un “push general” sin previsualización inequívoca.
6. Si falla **antes de COMMIT**, comprobar el rollback de la transacción, catálogo/ACL y funciones legadas; detener la ventana sin intentar reparaciones automáticas.
7. Si COMMIT prospera, verificar esquema, RLS/ACL, RPC, guardas históricos, inmutabilidad v1, relaciones, registros y cron preexistente. **NO levantar la congelación de escrituras antiguas todavía.**

### Fase C — frontend protegido y prueba de compatibilidad

8. Con GO **independiente para merge/deploy web y flags de rutas protegidas**, preparar el frontend que usa las RPC y poner \`VITE_LEAGUE_GUARDED_RPC=true\`, \`VITE_INDEPENDENT_RESULTS_GUARDED_RPC=true\`, mientras \`VITE_ELO_USD_V2_RPC=false\` y la activación de base ELO v2 sigue OFF.
9. Verificar una vez las rutas reales de administración bajo cuentas/roles autorizados **sin crear resultados ficticios en producción**; comprobar que no queda fallback a REST inseguro, que la lectura pública sigue disponible y que los flujos de correo/registro no se afectan. Mantener escritura congelada si alguna ruta falla.
10. Solo si ambos lados son compatibles, restaurar las escrituras existentes autorizadas. Si FX todavía no está lista, **ELO v2 sigue OFF**; no forzar torneos nuevos a usar v2.

### Fase D — captura FX oficial, primero controlada

11. Con GO separado: crear clave **dedicada** \`elo-fx-scheduler\` con permisos mínimos admitidos, desplegar \`elo-fx-capture\`, y almacenar URL/clave en Vault como \`sharkania_elo_fx_url\` y \`sharkania_elo_fx_scheduler_key\`; no publicar valores en chat, SQL, GitHub o logs.
12. Validar el endpoint con autenticación secreta; comprobar ingestión **real** de CLP/USD (BCCh) y USD/EUR (BCE), recibos \`fx_observation_v2\` y \`fx_feed_check_v2\` sin fallos, integridad de fecha/hora y frescura **antes** del torneo. La API de previsualización Jackpot no reemplaza este paso.
13. Con GO **independiente de cron**, activar el candidato de programación horaria \`sharkania-elo-v2-fx-hourly\` solo si los dos cron previos continúan idénticos, Vault existe, Edge responde y el interruptor v2 está OFF. Verificar registros operativos y una alerta explícita de falta de tasas; no programar consultas extra no autorizadas.

### Fase E — activación deportiva sin retroactividad

14. Acordar evento/fecha de corte: **primer torneo futuro que comience después de que FX oficial esté operativa y validada y después del GO propietario**. No usar fecha histórica ni recalcular resultados previos.
15. Verificar observación oficial y control de feed dentro del margen anterior al inicio establecido por la política v2; sin ambos, no publicar y mostrar error comprensible.
16. Con GO **específico del interruptor backend ELO v2 y de \`VITE_ELO_USD_V2_RPC=true\`**, efectuar corte coordinado; impedir que rutas legadas vuelvan a escribir ELO v1 para torneos afectados.
17. Usar la **primera publicación real, consentida y legítima** para smoke operativo: registro una sola vez, divisa original preservada, equivalente USD trazable, ELO histórico no alterado, lectura de ranking y journal inmutable. No fabricar jugadores, premios ni resultados.

## 7. Reversión: escenarios y límites reales

| Momento | Acción ante fallo | Limitación |
|---|---|---|
| Antes de ejecutar SQL | Abortar sin cambiar producción; mantener versión actual. | Sin pérdida ni cambio de ACL. |
| Durante la única transacción, antes de COMMIT | Abortar/ROLLBACK; verificar catálogo, permisos y que la versión no quede marcada aplicada. | El efecto de operaciones externas, si hubiera, no se revierte por PostgreSQL; asegurar que no se iniciaron. |
| Después de COMMIT pero **antes** del corte frontend | **STOP, mantener congelación**, evaluar parche hacia delante versionado que restaure compatibilidad o restauración controlada según respaldo probado. | **Apagar flags NO restaura GRANT, políticas, funciones ni triggers anteriores.** No existe down-migration probado. |
| Después del corte frontend, antes de publicar torneos v2 | Mantener v2 OFF, revertir deploy web solo si compatible con ACL nuevas; parche correctivo revisado si se precisa. | Revertir solo frontend a la versión vieja puede romper administración por las revocaciones. |
| Tras primeras publicaciones ELO v2 | Pausar publicaciones nuevas, preservar journals y eventos, aislar fallo; preferir corrección hacia adelante específica con aprobación. | **No** restaurar automáticamente estado antiguo ni reabrir escrituras v1: podría perder resultados válidos y violar inmutabilidad. |
| Fallo de BCCh/BCE o cron | Mantener v2 inactivo/pausar publicación v2, investigar feed y alertas; preservar ambos cron preexistentes. | Nunca inventar tasas ni reusar cotización manual del Jackpot como evidencia oficial. |

**GO de restauración separado**: nunca ejecutar restore destructivo a una fecha anterior sin estimación de filas/eventos posteriores a perder, verificación de backups/Storage, bloqueo de escrituras y aprobación explícita de esa pérdida/RPO. Antes de iniciar el despliegue debe existir un responsable y procedimiento reversible probado *para el alcance concreto*. Si no existe: **NO GO**.

## 8. Aprobaciones necesarias (todas pendientes)

| Identificador | Acción | Decisión actual |
|---|---|---|
| G1 | Aprobar solo la **vía GitHub de integración/PR y merge** final | PENDIENTE |
| G2 | Aprobar **extracción/uso de datos reales** en copia aislada y su retención, si es necesaria | PENDIENTE |
| G3 | Aceptar costo adicional de clon/branch/PITR si se propone y cotiza | PENDIENTE |
| G4 | Aprobar **ventana de mantenimiento** y congelación de escrituras | PENDIENTE |
| G5 | Aprobar **aplicar solo migración ELO v2** en Supabase producción | PENDIENTE |
| G6 | Aprobar **deploy frontend** y habilitar flags de rutas protegidas | PENDIENTE |
| G7 | Aprobar **Edge FX + clave dedicada + secretos Vault** | PENDIENTE |
| G8 | Aprobar **nuevo cron horario FX** | PENDIENTE |
| G9 | Aprobar **activación ELO v2 y evento/fecha de inicio** | PENDIENTE |
| G10 | Aprobar **restauración destructiva** si ocurre un incidente, con pérdidas cuantificadas | NO PREAUTORIZADA |

No agrupar estas aprobaciones en un “ok” genérico. La autorización del propietario del 15/11 únicamente permite preparar documentación/integración GitHub, no ninguno de estos cambios productivos.

## 9. Condiciones finales GO / NO GO

**GO** solo cuando:
- La rama final está revisada, CI verde sobre **código exacto a desplegar**, revisión de GitHub PR apilados resuelta sin duplicar instalación.
- La previsualización de migraciones remotas produce **exactamente una** versión pendiente; hash SQL exacto, catálogo preflight sin nuevos cambios y plan de reversión viable.
- Respaldo actualizado/recuperable, RPO/RTO y privacidad aprobados; mantenimiento elegido fuera de torneos.
- Compatible el orden backend → frontend protegido (sin lag de escrituras antiguas), FX oficial → cron → interruptor ELO v2; Edge y secreto todavía sin exponer.
- El propietario da aprobaciones específicas y se define la fecha/evento de corte futuro.

**NO GO** ante cualquiera de: migraciones antiguas adicionales propuestas, migraciones históricas reescritas, rollback no comprobable, ausencia de backup fresco, cambio inesperado de cron o ACL, publicación previa al feed, faltas de permisos o ambiente Cloudflare que despliegue involuntariamente.

## 10. Próximo trabajo permitido bajo la autorización actual

1. Mantener este plan en la **rama de revisión**, con commit \`[CF-Pages-Skip]\` y sin apertura de PR ni despliegue.
2. Contrastar **solo lectura** la paridad de versiones y verificar que Issue #98 refleja el estado. Ya realizado parcialmente (54/54 versiones y CI).
3. Una vez solicitado, preparar el checklist de preflight (SQL **SELECT** exclusivamente), evidencias sin PII y matriz de compatibilidad del corte. No ejecutar copia de datos ni instalar Edge/cron/flags.
4. Mostrar el plan al propietario para elegir permisos de mantenimiento, tolerancia de pérdida de datos y presupuesto **antes** de dar GO.

### Referencias directas

- [Issue #98 — único tablero](https://github.com/SharkaniaElite/SharkaniaV2/issues/98).
- [Migración candidata versionada](../../supabase/migrations/20261113182000_release_a_elo_v2_usd_official_fx.sql).
- [Reconciliación histórica](./migration-reconciliation-2026-11-14.WIP.md).
- [Release gates previos](./elo-v2-versioned-migration-release-gates-2026-11-13.md).
- [Plan de clon seguro ya existente](./sharkania-isolated-clone-restoration-go-no-go-2026-11-10.md).
- [Guía FX ya existente](./elo-v2-usd-fx-cutover-readiness-2026-11-10.md).
- [Supabase — Database Backups](https://supabase.com/docs/guides/platform/backups).
- [Supabase — Restore to New Project (advertencia sobre cron/pg_net)](https://supabase.com/docs/guides/platform/clone-project).
- [Supabase — CLI v3 (04/11/2026)](https://supabase.com/changelog/supabase-cli-v3).

**NO MERGE. NO EXECUTE. NO GO.**
