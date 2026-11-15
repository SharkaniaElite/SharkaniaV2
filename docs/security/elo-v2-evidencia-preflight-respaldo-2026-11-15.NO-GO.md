# SHARKANIA — Evidencia del preflight productivo y puerta de respaldo (15/11/2026)

**Estado:** comprobaciones de SOLO LECTURA terminadas, **respaldo/restore NO CERTIFICADO, NO GO para cualquier despliegue**.

## Alcance, evidencia y límites

Se consultaron exclusivamente el proyecto Supabase de Sharkania, el repositorio GitHub de SharkaniaV2 y la configuración de Cloudflare Pages; no se ejecutó SQL de modificación, migración, merge, despliegue, lectura de secretos, clonación, descarga de usuarios ni publicación de torneos. La fuente exacta del SQL reproducible de inspección está en [preflight SOLO LECTURA](./elo-v2-preflight-productivo-2026-11-15.SOLO-LECTURA.sql). Este informe registra una **fotografía temporal**, no un respaldo ni un contrato de integridad posterior.

Última integración verificada: `release/elo-v2-integrated-review-2026-11-15`, commit base de revisión `10a06f7551e44de78cfdc3124cd99e4acbb21ee5`. El cambio de este informe es exclusivamente documental y está protegido por prefijo `[CF-Pages-Skip]`.

## Comprobaciones técnicas efectivamente realizadas

| Prueba | Resultado observado | Interpretación |
|---|---|---|
| Salud del proyecto Supabase | `ACTIVE_HEALTHY`, PostgreSQL 17 | No acredita backup |
| Historial remoto | **54 versiones** | Coinciden por ID con 54 migraciones Git existentes |
| Candidato `20261113182000` | **No aplicado** | Único SQL adicional en Git |
| Contenido candidato | Git blob `45241f142dba4894fa349215fa938ea220d4c1ba` | Igual al artefacto QA, no equivale a GO |
| `sharkania_release` | Ausente | Sin activación ELO v2 |
| Edge `elo-fx-capture` | Ausente de funciones desplegadas | La versión de Git permanece OFF |
| Edge existentes | `posthog-stats`, `admin-email-confirmations`, `bcch-dollar-preview` | Deben preservarse |
| Cron de producción | Exactamente **2 activos** | No leer comandos con secretos |
| Cloudflare producción | Rama `main`, mismo SHA `026d02fc...` | Sin despliegue ELO |
| Flags ELO / ligas / independientes | Tres variables `VITE_*` no configuradas ni activadas | Frontend protegido NO habilitado |
| CI de integración | [Run #43746735388](https://github.com/SharkaniaElite/SharkaniaV2/actions/runs/43746735388) PASS | Contratos focalizados + TS/Vite, no certifica DR ni replay completo |

Cron a preservar: `sharkania_ignition_auto_welcome_2026_11` cada cinco minutos y `update_dolar_diario` cada seis horas. Extensiones presentes: `pg_cron`, `pg_net`, `supabase_vault`.

### Baseline agregado sin datos personales

| Dato | Conteo |
|---|---:|
| Jugadores en `public.players` | 1.842 |
| Torneos | 1.329 |
| Resultados | 21.764 |
| Entradas ELO | 21.764 |
| Posiciones de liga | 5.963 |
| Ligas | 34 |
| Relaciones liga–club | 41 |
| Relaciones liga–sala | 34 |
| Buckets Storage | 7 |
| Objetos registrados en metadatos de Storage | 350 |

**Advertencia:** los 350 objetos son **metadatos**, no verificación de existencia/descarga del contenido físico del Storage. Las cifras de hoy difieren de la instantánea QA histórica; esto es esperado en una plataforma activa y no indica por sí solo una regresión. Para el GO deben actualizarse antes de congelar escrituras y comparar después del corte.

### ACL, RLS, RPC y triggers

- **9/9 tablas críticas** inspeccionadas tienen RLS activada: `players`, `leagues`, `league_clubs`, `league_rooms`, `tournaments`, `tournament_results`, `elo_history`, `league_standings`, `nickname_claims`.
- A nivel de privilegios de TABLA, el rol `authenticated` conserva `INSERT`, `UPDATE` y `DELETE` sobre esas tablas. Esto **no significa** que todas las filas sean escribibles: políticas RLS aplican filtros adicionales. La migración propuesta restringe varias de estas operaciones y cambia RPC/guardas.
- Se revisaron nombres/firma/atributo SECURITY DEFINER y permisos de funciones legacy relacionadas con torneo, ELO y vinculación de cuentas. Las nuevas RPC `create_league_guarded`, `publish_*_guarded` y `sharkania_fx_*` **no existen todavía** como superficie productiva.
- Se registraron nombres y estado de triggers existentes de `players`, `leagues` y `tournaments`; no se reprodujeron contenidos de funciones ni registros de usuarios.
- En el cliente ELO de la rama integrada, los flujos de administración utilizan rutas REST legadas **cuando los flags están OFF**. El SQL candidato restringe algunas de esas escrituras. Por tanto, **es obligatorio coordinar la ventana de mantenimiento, instalación SQL y habilitación del frontend protegido**, antes de reabrir esas escrituras.

**No se ejecutó prueba de operación real de edición, borrado o publicación.** Ningún registro productivo fue alterado para probar restricciones.

## Puerta de respaldo / recuperación: NO APROBADA

**Lo que sí se puede afirmar:** la documentación oficial de Supabase dice que los proyectos Pro cuentan con respaldos automáticos diarios y siete días de retención habitual; las copias de la base **no incluyen los archivos físicos del Storage API**.

**Lo que NO pudimos verificar mediante el conector:** fecha y estado del último backup **real** de Sharkania, si PITR está efectivamente habilitado, qué punto es recuperable, integridad de un backup, la restauración de ejemplo, roles personalizados, Storage físico ni los tiempos RPO/RTO.

Esta ausencia de evidencia **es bloqueo del GO**, no una recomendación de contratar algo. Ningún backup fue creado, descargado, cifrado, clonado o restaurado en esta revisión.

### Verificación necesaria en el Dashboard (SIN ejecutar restore)

1. Abrir [Supabase → Sharkania → Database → Backups](https://supabase.com/dashboard/project/nhpjzywfzljtlqaigzed/database/backups/scheduled).
2. Confirmar **último respaldo disponible**, fecha y hora, estado completado y retención visible; comprobar por separado si la sección PITR está habilitada o no.
3. Registrar evidencia de la pantalla sin secretos, sin iniciar ninguna restauración ni habilitar facturación adicional. Si las opciones son distintas de las descritas en la documentación, prevalece lo visible en el proyecto.
4. Antes de aprobar GO, verificar una estrategia operativa de **restauración lógica aislada** y cifrada para datos necesarios, con red bloqueada, cron y conexiones externas deshabilitadas desde antes de importar. Reutilizar lo aprendido en QA05–09 en vez de repetir la simulación ELO.
5. Definir **RPO** (pérdida máxima admisible) y **RTO** (tiempo máximo de recuperación) con decisión del propietario. Para nuevos resultados registrados, recomendar pérdida máxima cero como objetivo deseado, pero **no prometerla** sin tecnología y verificación que la sustenten.
6. Incluir un plan separado para los **7 buckets y 350 metadatos de objetos**; respaldo SQL no restaura necesariamente los objetos que hayan sido eliminados.
7. No usar automáticamente `Restore to a New Project` para probar: la copia física podría activar pg_cron/pg_net inmediatamente, con efectos sobre correos, webhooks o servicios externos.
8. No habilitar PITR, crear ramas o proyectos pagos sin cotización actual y aceptación explícita del usuario.

Referencia oficial: [Supabase — Backups](https://supabase.com/docs/guides/platform/backups), [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project).

## Historial y estrategia de instalación

Las **11 discrepancias históricas de texto SQL** siguen documentadas en [reconciliación WIP](./migration-reconciliation-2026-11-14.WIP.md). Al comparar versiones remotas y archivos Git, **54/54 coinciden** y solo el candidato `20261113182000` figura adicional en Git. La paridad de versiones **no equivale** a que el replay de las 54 migraciones funcione en una base vacía, ni demuestra igualdad SQL por versión.

- No ejecutar `migration repair`, no renombrar ni reescribir migraciones históricas, no reejecutarlas.
- Antes de un GO productivo: un operador autorizado debe confirmar el mecanismo real de migración en la versión vigente de la CLI. En Supabase CLI v3, comandos remotos requieren **`--remote`**, y la previsualización `db push --remote --dry-run` debe identificar **solo una migración pendiente**; si aparece otra, STOP. No ejecutar el push en esta preparación.
- El SQL de ELO v2 incluye nuevas tablas, triggers, funciones, `DROP POLICY`, `REVOKE` y `GRANT`, por lo que el rollback automático antes de COMMIT es distinto de una reversión después de COMMIT. **No existe down-migration verificada ni prueba de restauración íntegra productiva**.

Referencia oficial: [Supabase CLI v3](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3).

## Checklist y decisiones pendientes

| Control | Estado |
|---|---|
| Conteos y catálogos críticos de producción recopilados en lectura | HECHO |
| ELO v2 OFF, FX Edge ausente, cron existentes intactos | HECHO |
| Paridad de 54 versiones y candidato SQL original | HECHO |
| CI focalizado de integración en GitHub | PASS |
| Identificar backup real más reciente y PITR vigente | **BACKUP FÍSICO VISIBLE CONFIRMADO; PITR DESACTIVADO** |
| Comprobar estrategia de recuperación compatible con Storage, cron y permisos | **PENDIENTE / BLOQUEANTE** |
| Acordar RPO/RTO y mantenimiento fuera de torneos | PENDIENTE / propietario |
| Preflight de SQL remoto de solo lectura + `--dry-run` inequívoco | PENDIENTE / fase pre-GO |
| Decidir merge, migración SQL, frontend, Edge/Vault, cron y ELO v2 | **NINGUNA APROBACIÓN PRODUCTIVA** |

## Conclusión ejecutiva

**El preflight técnico limitado ha pasado; el plan de recuperación no.** No realizar merge, push SQL, activar frontend, desplegar Edge, crear secretos ni cron. La siguiente acción concreta para cerrar la puerta de respaldo es aportar únicamente **evidencia de la pantalla de Backups** y acordar el alcance de recuperación; no se piden contraseñas, tokens ni datos personales.

**NO MERGE. NO DEPLOY. NO RESTORE. NO GO.**

## Evidencia adicional de Backups aportada por el propietario — 15/11/2026

**Fuente:** captura de Supabase Database > Backups > Scheduled backups aportada por el propietario en ChatGPT. Evidencia visual, no consulta de API ni ensayo de restauración. La imagen no se añadió a GitHub.

- Proyecto visible: SharkaniaV2, plan PRO; base sharkania; rama main de producción.
- Ocho respaldos PHYSICAL listados entre el 08/11 y el 15/11/2026 (inclusive), con botón Restore visible.
- Respaldo físico más reciente: **15/11/2026 06:33:17 (+00:00)**, equivalente a **15/11/2026 03:33:17 en Chile continental UTC-3**.
- Respaldo físico previo: **14/11/2026 06:33:29 (+00:00)**.
- Advertencia en el Dashboard: el backup de base de datos no incluye los archivos físicos de Storage API.
- La pestaña Point in time aparece, pero **no fue abierta**. Su presencia no demuestra que PITR esté habilitado.
- El botón Restore y la fecha indican un punto disponible en la interfaz, **no** una restauración comprobada, un RPO/RTO garantizado ni que la copia proteja las escrituras posteriores.

### Actualización de la puerta de recuperación

| Condición | Estado |
|---|---|
| Existencia y fecha del último respaldo visible | **CONFIRMADO por captura** |
| Ocho puntos físicos diarios 08–15 noviembre | **CONFIRMADO por captura** |
| PITR habilitado / rango disponible | **DESACTIVADO según segunda captura** |
| Copia realmente restaurable e integridad | **NO PROBADA** |
| Copia física de los objetos Storage (7 buckets, 350 metadatos en baseline) | **NO CUBIERTA por backup de DB** |
| RPO/RTO, pérdidas posteriores al punto de restauración | **SIN DECIDIR** |
| Nueva migración / merge / Edge / cron / flags ELO v2 | **NO AUTORIZADOS** |

### Próximo control sin modificar producción

En Supabase, abrir únicamente la pestaña Point in time y registrar lo que muestra, sin pulsar Restore, Enable, Upgrade, crear un proyecto nuevo o contratar PITR. Mantener el GO bloqueado hasta definir y validar la recuperación segura, las condiciones de aislamiento de cron/pg_net, la protección de objetos Storage y el RPO/RTO.

Una restauración al backup diario más reciente perdería, por sí sola, los cambios posteriores a las 06:33:17 UTC del 15/11/2026; no prometer pérdida cero sin otro mecanismo efectivo.

**Estado: respaldos diarios confirmados visualmente; recuperación aún NO certificada; ELO v2 NO GO.**

## Comprobación PITR — captura de la pestaña Point in time (15/11/2026)

**Fuente:** segunda captura del mismo Dashboard Supabase, pestaña **Database Backups > Point in time**, aportada por el propietario en el chat. No se adjuntó imagen a GitHub ni se compartieron credenciales.

- La página muestra literalmente: **“Point in Time Recovery is available as an add-on”** y **“Enable the add-on to add point-in-time recovery to your project.”**
- Está visible el botón **Enable add-on**. Interpretación: **PITR no está habilitado** en el proyecto al momento de la captura.
- Se mantienen visibles los ocho puntos **Scheduled backups** ya documentados, con el más reciente del **15/11/2026 06:33:17 UTC**; la segunda captura no demuestra una prueba de restauración.
- No se presionó ningún botón de activación ni se habilitó o contrató PITR. No hay tarifa aprobada.

### Implicaciones para el GO

| Control | Evidencia |
|---|---|
| Backups diarios físicos | **CONFIRMADOS VISUALMENTE** |
| PITR / recuperación entre respaldos | **NO DISPONIBLE, ADD-ON NO ACTIVADO** |
| Copia de Storage físico | **NO CUBIERTA por backups DB** |
| Restauración íntegra y aislamiento de cron/pg_net | **NO PROBADOS** |
| RPO/RTO y posible pérdida de actividad reciente | **SIN ACUERDO** |
| GO para instalación ELO v2 | **DENEGADO por puerta de recuperación aún abierta** |

**Decisión recomendada:** No habilitar PITR automáticamente. Primero acordar RPO/RTO, comprobar recuperación segura del esquema y datos con efectos externos aislados y cubrir archivos Storage por separado. Si el RPO acordado requiere PITR, obtener cotización específica y consentimiento de costo antes de activarlo. No se debe confundir tener backups con haber verificado una restauración.

**NO MERGE, NO RESTORE, NO PITR ENABLE, ELO v2 NO GO.**

## Criterio de recuperación propuesto por el asistente — 15/11/2026

**Naturaleza:** decisión técnica de planificación delegada por el propietario, **no** autorización contractual ni GO productivo. Ningún costo, restauración, clon, migración ni activación se aprueba mediante esta propuesta.

### Prioridades y objetivos

1. **RPO objetivo en la ventana de lanzamiento: CERO pérdida de operaciones críticas confirmadas** (altas de jugadores, resultados de torneos, registros ELO, premios, movimientos económicos y cambios de cuenta). Como no hay PITR y los respaldos diarios son antiguos respecto del tráfico continuo, este objetivo **NO está garantizado** con el estado actual. Para que sea demostrable en un corte planificado, detener y drenar **todas** las escrituras críticas, no solo el módulo de ligas; capturar un estado recuperable y verificarlo antes del COMMIT, sin permitir nuevas confirmaciones hasta pasar las pruebas y confirmar una vía fiable de recuperación. No afirmar RPO=0 si queda alguna escritura crítica en vuelo o si la copia/replay no está comprobada.
2. **RTO objetivo operativo: hasta 4 horas** para decidir continuar o abortar un corte planificado. No es SLA demostrado ni tiempo de restauración prometido. Si el corte no puede completarse con garantías dentro de la ventana, mantener mantenimiento y aplicar plan de contingencia autorizado; jamás recuperar una base perdiendo datos automáticamente por intentar cumplir el plazo.
3. **Fuera de la ventana**, no prometer RPO=0. Los backups diarios y PITR desactivado pueden perder muchas horas de datos ante una recuperación destructiva. Si se pretende una pérdida máxima baja de forma permanente, analizar PITR (u otro mecanismo continuo y probado), costos, registros de transacciones y los 7 buckets de Storage con sus objetos reales.
4. **Estrategia de fallos preferida:** transacción SQL atómica + bloqueo de escrituras críticas y verificación del punto de partida; si falla antes del COMMIT, ROLLBACK. Si falla después, conservar snapshots, datos nuevos y journals, evaluar corrección hacia delante; NO revertir solo flags ni hacer restore a respaldo diario sin cuantificar pérdidas y autorización independiente.
5. **PITR: no contratar por defecto.** Es una mejora posible para recuperar a instantes más cercanos; **no garantiza pérdida de datos cero** ni repone los objetos físicos de Storage. Cotización concreta y aprobación del costo antes de activarlo.

### Bloqueos antes de autorizar producción

- Evidencia de un punto de recuperación **fresco y restaurable**, con integridad y acceso comprobados; evaluación de alcance de roles, Auth y Storage físico. La captura de los 8 backups confirma existencia visible, **no restaura probada**.
- Procedimiento de aislamiento de correo, cron (`sharkania_ignition_auto_welcome_2026_11`, `update_dolar_diario`), `pg_net` y Vault, validado antes de cualquier ensayo con datos reales. No usar clon físico automático con trabajos activándose.
- Inventario de flujos críticos que deben pausarse de manera verificable (login/registro, pagos/recompensas, torneos/resultados, identidad/vinculación), responsable de mantenimiento y mecanismo para drenar transacciones. Una ventana con torneo activo = STOP.
- Prueba limitada de restauración/compatibilidad **en entorno autorizado y aislado**, sin repetir QA05–09 y sin extraer identidades/secretos al chat o CI público.
- Confirmación del propietario para gastos y acciones productivas **por separado**. Si no se puede sostener el objetivo cero para operaciones confirmadas, mantener **NO GO** y no reinterpretar el silencio como tolerancia a pérdidas.

**DECISIÓN DE SEGURIDAD: conservar respaldos diarios activos, mantener PITR desactivado y ELO v2 NO GO mientras no exista una vía validada para un corte sin pérdida de operaciones críticas confirmadas.**
