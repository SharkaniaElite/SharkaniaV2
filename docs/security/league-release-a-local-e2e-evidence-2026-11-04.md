# SHARKANIA Release A — Evidencia de QA visual local (4 de noviembre de 2026)

**Entorno:** segunda pila Supabase PostgreSQL/GoTrue/REST en Docker/WSL, aislada de producción. Aplicación Vite en `http://127.0.0.1:5173`, API local observada en `http://127.0.0.1:21326`. Cuenta y datos **exclusivamente ficticios**. Estas observaciones provienen de las salidas de terminal y capturas compartidas por el operador; aún no se ha realizado auditoría independiente posterior al ensayo de todos los registros SQL.

## Prerrequisitos confirmados por la terminal

- Restauración de 64 tablas en un clúster local distinto del QA original; 0 usuarios al inicializar. Los `DEFAULT ACL` ajenos (24) no se reprodujeron en la copia local; se conservó el recuento de políticas RLS, pero **eso no demuestra paridad completa de privilegios con producción**.
- Proposal SQL Release A del PR #65 instalado **solo** en el segundo clúster local; verificación de funciones protegidas.
- Cuatro cuentas sintéticas (organizador A, admin B, jugador, superadmin), dos clubes, dos salas y dos ligas iniciales. GoTrue real y RPC/JWT locales: PASS.
- El QA original permaneció intacto según los preflights de los instaladores. Ningún paso descrito aquí autoriza cambios productivos.

## Casos visuales observados en el panel real `/admin/club`

| Caso | Evidencia aportada | Resultado |
| --- | --- | --- |
| Iniciar sesión admin A | Captura de `/admin/club`: club A como `owner`, `Aprobado` y pestaña Ligas (2) | PASS observado |
| Crear liga A | Nueva `Liga QA Visual Sharkania` visible después de crear | PASS observado |
| Editar liga A y salas | Persistencia de nombre editado, 7 fechas, 6 mejores, sala Beta | PASS observado |
| Admin B ve liga compartida A | Panel muestra `Club participante · sin permisos de edición`, sin iconos de editar/duplicar/borrar | PASS observado |
| Admin B intenta editar liga A | Mensaje `No tienes autorización sobre el club organizador de esta liga.`; nombre A permanece | PASS observado |
| Admin B edita liga propia | `Edición autorizada por Club B - QA` persiste al reabrir | PASS observado |
| Superadmin edita A desde la vista B | Se corrigió harness local para enviar ID del club principal real; usuario informó edición correcta desde B y prueba posterior B normal rechazada | PASS reportado; conservar evidencia SQL/HTTP antes del corte |
| Duplicación de liga B | Aparece copia con fechas, mejores, sala y descripción conservadas | PASS observado |
| Eliminación de copia vacía | Pestaña Ligas 3 -> 2; original conservada | PASS observado |
| Eliminación liga con torneo | Fixture ficticio creó 1 torneo y 1 liga adicional; `/admin/club` mostró: `Esta liga tiene torneos, plantillas o resultados vinculados. No puede eliminarse.` y mantuvo Ligas (3) / Torneos (1) | PASS observado |

## Pendientes de liberación — NO GO

1. **Parcialmente cumplido:** backup de QA restaurado íntegramente en un tercer clúster temporal sin red (ver Etapas 6A–6C más abajo). **Pendiente:** comprobar propietarios, roles, GRANT/ACL efectivos, `ALTER DEFAULT PRIVILEGES` y permisos en un ensayo representativo de producción; la restauración actual usa `--no-owner/--no-acl`.
2. Comparar **preflight de producción SOLO LECTURA** (tablas/FK, organización primaria, roles, índices, políticas, dependencias de todas las rutas legacy) contra el SQL definitivo.
3. Preparar migración **versionada** (la propuesta del PR no es una migración), sincronizar backend y frontend, verificar SECURITY DEFINER, search_path y permisos efectivos.
4. Comprobar que ninguna ruta de creación/edición/duplicación legacy depende de DML revocado; resolver invitación entre administradores de clubes si se requiere flujo multipartes.
5. Definir rollback seguro sin reabrir los privilegios vulnerables, smoke tests post-corte y monitoreo. Obtener **aprobación explícita** antes de producción.
6. Mantener Release B (ELO/publicación) totalmente fuera de este corte.

**Aviso:** `VITE_LEAGUE_GUARDED_RPC` permanece apagado en producción; el preview Cloudflare identificado previamente no está aislado de Supabase productivo y NO debe utilizarse para escribir datos de QA.


## Respaldo local y recuperación aislada — Etapas 6A–6C (4 nov 2026)

**Fuente de evidencia:** salidas de terminal aportadas por el operador en la sesión de QA; resultados documentados como observados, **no reejecutados independientemente** por el asistente. Todas estas operaciones usaron datos ficticios, no producción.

- **6A — PASS reportado:** `pg_dump` 18.6 contra PostgreSQL 17.11 de la **segunda** preproducción local. Archivo custom privado de **902.286 bytes**, con **1.650 objetos** en el índice y SHA-256 `c69b1131f6a07f75fbe2d438726953ab85d8ccf7212f86c91f78a1c77752cc6c`. Se validó el índice con `pg_restore`. No publicar el dump ni los usuarios ficticios con credenciales.
- **6B — STOP con limpieza:** restauración en una tercera *base* del segundo clúster falló por `permission denied to set parameter "log_min_messages"` en funciones internas `realtime.list_changes` y `realtime.list_changes_sync`, cuyo SQL incluye `SET log_min_messages TO 'fatal'`. La base temporal se eliminó; el dump quedó intacto.
- **6C v1 — STOP seguro:** comprobación demasiado estricta de puertos Docker causó falso bloqueo; contenedor de ensayo eliminado.
- **6C v2 — PASS reportado:** restauración del **dump original** en un **tercer clúster PostgreSQL 17.11** temporal, `--network none`, sin puertos publicados ni bind mounts. Se verificaron checksum, independencia del clúster, `pg_restore` completo sin errores SQL y recuperación de **64 tablas**, cuentas ficticias, ligas, torneos, RLS y funciones de Realtime. Contenedor y datos desechables eliminados tras el ensayo.

**Límite de esta validación:** la restauración 6C usó `--no-owner/--no-acl`, por lo que **NO** demuestra equivalencia de propietarios ni permisos efectivos del origen, especialmente los **24 `ALTER DEFAULT PRIVILEGES`** ajenos que no pudieron reproducirse en el esquema inicial de QA. Tampoco demuestra que exista un **respaldo productivo recuperable** o un procedimiento de rollback del corte. Registrar evidencia de roles/grants/policies/SECURITY DEFINER, revisar esquema de producción solo en lectura y preparar migración versionada antes de GO. Mantener **NO GO** y separación estricta de Release B.
