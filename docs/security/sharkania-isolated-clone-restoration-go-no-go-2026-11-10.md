# Sharkania — restauración de QA sin efectos externos (NO GO)

**10 noviembre 2026 · únicamente investigación y consultas SELECT. Sin copiar respaldos, crear proyectos, modificar cron, descargar identidades ni iniciar restauraciones.**

## Riesgo productivo verificado

El proyecto Supabase de Sharkania tiene en producción **dos trabajos pg_cron activos**, y las extensiones pg_cron, pg_net y supabase_vault instaladas. La consulta de lectura confirmó también 34 triggers no internos repartidos entre los esquemas public, auth y storage; esa cifra **no significa** que los 34 envíen notificaciones o actúen externamente. No se leyeron comandos de cron ni secretos.

Supabase advierte explícitamente que **Restore to a New Project** (copia física) replica toda la base y **los trabajos pg_cron, pg_net y otros mecanismos externos empiezan a ejecutarse en el proyecto nuevo tan pronto concluye la restauración**, sin posibilidad de excluirlos o pausarlos antes. Referencia oficial: https://supabase.com/docs/guides/platform/clone-project . Por tanto **no crear un clon físico automático** de Sharkania sin una garantía independiente de aislamiento de ejecución y red desde el inicio. Evitar el riesgo de emails, webhooks, cobros o escrituras ajenas no intencionadas.

## Opción preferida para la primera validación: restauración lógica aislada

1. Obtener aprobación explícita sobre extracción de copia, acceso a datos reales, tratamiento privado y almacenamiento; no exportar nada todavía. Consultar instrucciones oficiales de Supabase para backup/restauración lógica: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore .
2. Preparar un Postgres 17 / stack Supabase completamente independiente, con salida a Internet bloqueada **antes** de importar datos. No configurar claves live, SMTP, OAuth, servicios Cloudflare ni endpoints de producción.
3. Obtener respaldo lógico mediante credenciales y transporte protegidos, nunca compartir archivos con registros de usuarios, contraseñas cifradas, claves, URL privadas o PII en un chat, repositorio GitHub o artefactos públicos de CI. Cifrar en reposo, minimizar permisos y documentar eliminación segura.
4. Excluir de ejecución programada pg_cron/pg_net, triggers de efecto externo, webhooks, secrets de Vault, email queues y cualquier función que pueda contactar recursos productivos **antes de ejecutar un solo comando del candidato**. No asumir que `pg_dump`/`pg_restore` puedan restaurar todos los objetos o claves de Vault de manera fiel.
5. Comparar catálogos, extensiones, grants, ENUM, funciones SECURITY DEFINER, políticas RLS y métricas de filas con la línea de base productiva de solo lectura. Usar `tests/fixtures/sharkania-restored-clone-readonly-parity-2026-11-10.sql`, adaptando temporalmente solo el entorno aislado. Identificar divergencias sin reescribir el historial.
6. Instalar y ensayar **exclusivamente en el clon** `docs/security/release-a-v2-all-in-one-atomic-2026-11-10.CANDIDATE.sql`, que incluye siete componentes con un único BEGIN/COMMIT y pruebas de reversión en PostgreSQL sintético. No ejecutar la migración productiva ni habilitar ELO v2 sin aprobación posterior.
7. Volver a ejecutar casos de GoTrue/PostgREST real local con cuentas ficticias, pruebas de moneda CLP/EUR/USD, bloqueos de carga retroactiva, RLS, auditoría FX, fallos inducidos y concurrencia de jugadores compartidos. Al terminar, destruir la copia y verificar que ningún trabajo se ejecutó externamente.

**Limitación:** un clon lógico con secretos/identidades simulados no reproduce exactamente todas las funciones que dependen de claves cifradas en Vault o ajustes de Auth. Esa brecha debe registrarse como NO GO para dichas rutas, no declararse resuelta por la prueba de esquema.

## Precio: no comprometer recursos sin cotización

- Una rama preview Supabase está **sin datos productivos por defecto**; el coste comienza desde USD 0,01344/h en Micro, más otros consumos, y los créditos de Compute no cubren Branching Compute. **No sustituye una copia fiel de producción**. https://supabase.com/docs/guides/platform/manage-your-usage/branching
- Una restauración física a nuevo proyecto tiene **coste adicional por recursos replicados** y Supabase muestra el precio estimado antes de crearla. Ese precio depende del compute y disco reales; no hay una tarifa única justificable sin la pantalla de cotización. https://supabase.com/docs/guides/platform/clone-project
- El prototipo no requiere habilitar PITR de pago. No asumir que PITR ya está habilitado ni contratarlo sin autorización.

## Autorizaciones que siguen faltando

**A)** permiso de copiar datos reales, con estrategia segura de exportación/cifrado/aislamiento y retención; **B)** presupuesto exacto si se decide pagar un nuevo entorno; **C)** autorización independiente para aplicar SQL al clon; **D)** posterior revisión GO, con fecha ELO v2 aprobada, cierre de rutas legacy, tasa BCCh/ECB operativa y vigilancia. **Nada de esto autoriza producción.**

**Estado: NO GO para restauración física automática; copia lógica aislada solamente después de autorización explícita.**

## Actualización operativa — 15 de noviembre de 2026

**Tipo de trabajo:** solo planificación documental y SELECT de inventario. No autoriza copia de datos, creación de clon, infraestructura, exportación, SQL en clones, tráfico externo ni cambios productivos. Issue de referencia: #98. RPO propuesto para el corte: cero pérdida de operaciones críticas confirmadas, **aún no demostrado**. RTO de planificación: cuatro horas, sin promesa de cumplirlo.

### Datos de dimensionamiento observados (consulta SQL agregada)

| Indicador | Observado |
|---|---:|
| Tamaño de PostgreSQL | 49 MB (51.432.595 bytes) |
| Triggers no internos entre public/auth/storage | 34 |
| Cron activos | 2 |
| Buckets Storage | 7 |
| Metadatos de objetos Storage | 350 |

Estos valores no incluyen necesariamente los bytes de archivos físicos guardados en Storage; 49 MB no es una estimación del tamaño total del servicio, ni determina precio o tiempo reales de backup/restore.

### Evidencia de respaldo

- La captura del propietario confirma ocho puntos de **backups físicos diarios** entre el 08 y el 15/11/2026, último **15/11/2026 06:33:17 UTC**.
- La pestaña **Point in time** muestra 'available as an add-on' y 'Enable add-on': **PITR no habilitado**.
- La existencia de esas entradas **no prueba la restaurabilidad** ni cubre los bytes físicos de Storage. No usar el botón de Restore ni activar PITR como parte de esta preparación.

### Selección técnica para un ensayo futuro, sujeto a autorización

1. **NO** usar 'Restore to a New Project' físico: la propia documentación de Supabase advierte riesgo de reactivar cron y conexiones externas inmediatamente. En producción hay dos cron; no comprobar ni mover sus comandos o secretos.
2. Preparar primero PostgreSQL 17 local **descartable y con egreso de red denegado por un control externo al contenedor**, probado antes de cargar SQL. No montar volúmenes de secretos ni configurar SMTP, OAuth, keys live, Edge externa, Vault real ni URL de producción. Un contenedor simplemente 'no expuesto' no equivale a red aislada: probar bloqueo de tráfico saliente.
3. **Definir y aprobar antes de descargar** qué objetos se extraerán, por quién, medio cifrado, retención y eliminación. No extraer `auth.users`/identidades reales sin justificación y consentimiento específico; preferir identidades ficticias para el ensayo ELO. Nunca publicar un volcado ni un archivo con usuarios en GitHub o CI.
4. **Advertencia verificable de la CLI:** `supabase db dump` ejecuta pg_dump con filtros: **excluye por defecto los esquemas gestionados `auth`, `storage` y extensiones**, y el dump predeterminado no incluye registros ni roles personalizados. El modo `--data-only`/`--role-only` cubre partes distintas y **no convierte automáticamente el dump en una copia completa de Auth, Storage físico o Vault**. Para prueba de esquema y ACL, registrar explícitamente qué quedó fuera; no afirmar recuperación total.
5. En el sandbox, cargar únicamente el esquema/datos sintéticos o los datos expresamente autorizados, sin conexiones salientes y con trabajos de cron desactivados **antes** de permitir ejecución. Verificar existencia de extensiones necesarias y acciones no deseadas de triggers. Si no es posible garantizar ausencia de efectos externos, **ABORTAR**.
6. **No reaplicar las 54 migraciones históricas sobre un volcado del esquema actual.** Se preserva su registro por versión, incluidos los once SQL cuyo texto difiere; un `db reset` no es un sustituto de reconstrucción fiel. La prueba dirigida parte del esquema restaurado y ensaya **solo** la candidata ELO v2 versionada `20261113182000` con blob `45241f142dba4894fa349215fa938ea220d4c1ba`, únicamente después de autorizar SQL en el clon.
7. Antes/después del ensayo, ejecutar el fichero **ya existente** `tests/fixtures/sharkania-restored-clone-readonly-parity-2026-11-10.sql` en la base aislada y cotejar metadatos (funciones, RLS, privilegios, triggers, recuentos); validar que no altera ELO v1. No duplicar QA05–09 que ya fue aprobada. Una comprobación de esquema tampoco valida Auth/Storage/Vault reales si fueron omitidos.
8. Si la restauración aislada falla o no cubre un componente crítico, registrar el vacío en Issue #98 como **NO GO**. No corregirlo improvisadamente en producción y no atribuirle un SLA de cuatro horas.

### Puertas separadas antes de cualquier ejecución

- **Aprobación de datos:** extracción y tratamiento protegido de información real, si se juzga imprescindible; responsable de exportación, lugar, plazo de retención y borrado.
- **Aprobación de entorno:** dónde se ejecutará, cómo se probará aislamiento de salida y quién custodiará el volumen cifrado; cualquier recurso de pago requiere cotización y aceptación previa.
- **Aprobación de SQL en clon:** solo candidato de ELO v2 y pruebas puntuales, después de comprobar aislamiento. Nunca producción.
- **Aprobación de lanzamiento:** sigue separada del ensayo y exige respaldos verificables, compatibilidad SQL/frontend, FX, cron, flags y GO del propietario.

**Resultado actual:** diseño de ensayo aislado preparado en GitHub; **cero restauraciones ejecutadas**. ELO v2 NO GO.

Referencias oficiales: https://supabase.com/docs/reference/cli/supabase-db-dump ; https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore ; https://supabase.com/docs/guides/platform/clone-project ; https://supabase.com/docs/guides/platform/backups.


## Rectificación de continuidad — restauraciones ya aprobadas (15/11/2026)

**Esta sección prevalece sobre la interpretación de que nunca se ha ensayado una restauración aislada.** Revisadas las conversaciones originales del archivo exportado, el registro maestro y el PR #65, **ya existen dos ensayos reales exitosos**. No repetir sus preparaciones, la instalación de Docker, PostgreSQL 17 ni QA05–09.

### Evidencia primaria 1: Release A / Etapa 6C, 04/11/2026

- Conversación exportada: \`2026-11-04_Continuar_pruebas_ELO_6aebc5ef-1.md\`, mensaje del usuario 375, con salida completa \`PASS FINAL ETAPA 6C\`.
- Corroboración en GitHub: [PR #65](https://github.com/SharkaniaElite/SharkaniaV2/pull/65) y archivo [\`league-release-a-local-e2e-evidence-2026-11-04.md\`](https://github.com/SharkaniaElite/SharkaniaV2/blob/security/league-guarded-release-a-2026-11-04/docs/security/league-release-a-local-e2e-evidence-2026-11-04.md).
- Se restauró un dump local de QA de **1.650 objetos** en **tercer clúster PostgreSQL 17.11**; \`network none\`, cero puertos publicados, cero bind mounts. Se recuperaron **64 tablas**, cuentas ficticias, RLS, torneos, ligas y funciones Realtime. Se eliminó el clúster temporal. 
- **Límite exacto:** se usó \`--no-owner/--no-acl\`; no se validaron permisos/propietarios equivalentes a producción ni los 24 \`ALTER DEFAULT PRIVILEGES\` discrepantes. **NO** demuestra restauración de un backup de producción.

### Evidencia primaria 2: ELO v2 / QA05 y posteriores, 10/11/2026

- Conversación exportada: \`2026-11-10_Continuar_revision_de_seguridad_6af31d0d-c.md\`, salida de la restauración QA alrededor del mensaje 129 y confirmaciones en mensajes 130–131. 
- El usuario informó \`RESULTADO: QA DE DATOS ELO RESTAURADO EN CONTENEDOR SIN RED\` con conteos **1.826 jugadores, 1.329 torneos, 21.377 resultados y 21.377 filas ELO** y huella histórica \`b1f510063c695d107301e722b86991a4\`.
- **Límite exacto:** sustituye referencias \`auth.users\` mediante identidades simuladas, no prueba la restauración completa de Auth/Storage/Vault, ACL de todos los esquemas ni de los dos cron reales. El motor/FX/concurrencia continuó con QA06–09 aprobados; **NO repetir**.
- Comparación con corte solo lectura del **15/11/2026**: **1.842 jugadores, 1.329 torneos, 21.764 resultados y 21.764 filas ELO**. El conjunto QA histórico ya no es un respaldo actual; hay **16 jugadores** y **387 resultados/ELO** más en los conteos recientes. No se infiere qué operaciones individuales ocurrieron ni su causa.

### Qué falta de verdad para la recuperación previa al lanzamiento

1. **NO repetir** ninguno de los dos ensayos, ni la descarga/instalación de Docker/PG17, ni el circuito QA de ELO. Los archivos temporales de ambas restauraciones fueron borrados; la evidencia se conserva en el chat exportado y GitHub.
2. Se debe demostrar que existe un **punto recuperable actualizado** cerca de la futura congelación de escrituras, no volver a restaurar la fotografía del 10/11. Los backups físicos 08–15/11 están visibles, con PITR apagado. Nunca tratar la captura de backup como prueba de restauración.
3. Precisar la **brecha de recuperación** de ese punto actualizado: firmas de roles y ACL, componentes Auth, objetos físicos Storage y mecanismos con efectos externos (cron, pg_net, correos), sin reproducir la batería ELO.
4. Para el objetivo de cero pérdida de operaciones críticas confirmadas **dentro de una ventana de corte**, congelar/drenar escrituras, garantizar que el punto actual y el punto restaurable se corresponden y obtener aprobación explícita para tratamiento cifrado de datos reales si resulta indispensable. No prometer RPO=0 a partir de un backup diario antiguo.
5. El siguiente trabajo local **no es reinstalar herramientas**. Solo si se decide usar un respaldo privado actual, utilizar el procedimiento de aislamiento previamente aprobado y verificar sus parámetros como parte del ensayo específico; antes se requiere aprobación para extracción/custodia de datos, sin mostrar contraseñas, tokens ni dumps en ChatGPT o GitHub.

**Estado:** aislamiento y restauraciones QA históricas **HECHAS**; ensayo de recuperabilidad de un punto **actualizado y completo** **PENDIENTE**. Plan documental; cero exportaciones/restauraciones nuevas autorizadas; ELO v2 NO GO.

