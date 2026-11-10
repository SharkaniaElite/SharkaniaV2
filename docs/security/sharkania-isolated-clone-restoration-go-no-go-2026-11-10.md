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
