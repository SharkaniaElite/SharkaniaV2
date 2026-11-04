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

1. Probar **backup RESTAURABLE** en una tercera base aislada, con verificación de recuentos, Auth, funciones, RLS/grants; un `pg_restore --list` no basta.
2. Comparar **preflight de producción SOLO LECTURA** (tablas/FK, organización primaria, roles, índices, políticas, dependencias de todas las rutas legacy) contra el SQL definitivo.
3. Preparar migración **versionada** (la propuesta del PR no es una migración), sincronizar backend y frontend, verificar SECURITY DEFINER, search_path y permisos efectivos.
4. Comprobar que ninguna ruta de creación/edición/duplicación legacy depende de DML revocado; resolver invitación entre administradores de clubes si se requiere flujo multipartes.
5. Definir rollback seguro sin reabrir los privilegios vulnerables, smoke tests post-corte y monitoreo. Obtener **aprobación explícita** antes de producción.
6. Mantener Release B (ELO/publicación) totalmente fuera de este corte.

**Aviso:** `VITE_LEAGUE_GUARDED_RPC` permanece apagado en producción; el preview Cloudflare identificado previamente no está aislado de Supabase productivo y NO debe utilizarse para escribir datos de QA.
