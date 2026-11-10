# SHARKANIA — Release A: checklist de corte único y criterios GO/NO-GO

**10 de noviembre de 2026. Estado: candidato consolidado, exclusivamente QA; NO AUTORIZADO para producción.**

Archivo SQL único: `docs/security/league-release-a-single-transaction-2026-11-10.CANDIDATE.sql`. Una transacción `BEGIN … COMMIT`. Se construyó a partir de los componentes QA probados en PR #86–#94, **sin sumar la propuesta P1 del PR #80** ni volver a ejecutar la migración P0 ya aplicada.

## Alcance cerrado de la Release A

**Incluye:** alta/edición/duplicación de liga con único club principal y validación de membresías; RLS y privilegios conservando SELECT público; primer resultado de torneo de liga **USD** por `public.publish_league_nickname_results_guarded`; resolución de nickname por `(room_id, lower(btrim(nickname)))`; ELO `legacy-js-v1` y standings en una transacción, auditados con checkpoints y ledger USD; guardas de las tres funciones destructivas heredadas, denegación de los dos recálculos viejos desde la API; disparadores defensivos frente a borrados y escrituras directas de resultados de liga. Los torneos independientes deben conservar sus operaciones actuales.

**Excluye por diseño:** publicación CLP/EUR, fórmula `currency-neutral-v2-PROPOSAL`, recalcular / reescribir el pasado, edición o eliminación de resultados de ligas, modificación de perfiles al margen del flujo protegido y cualquier restauración de producción. No ofrece fallback REST al fallar una RPC.

**Decisiones de arquitectura:** esquema `sharkania_release` privado sin USAGE a `anon` o `authenticated`; **solo la RPC de publicación pública expone EXECUTE a `authenticated`**. Funciones internas `publish_results_initial` y `recalculate_standings_guarded` carecen de permisos de invocación para roles de API. El nombre estable del cliente coincide con la única función pública. No se despliega ningún alias temporal `_qa`. Contrato `legacy-js-v1` sin cambios y monto de entradas en divisa nativa.

## Checklist operativo verificable

| Paso | Criterio GO antes de activar | Estado |
|---|---|---|
| 1. Inventario de producción | P0 válido, políticas originales exactas, cero ligas sin principal, cero nicknames duplicados por sala y snapshot MD5 de cinco RPC heredadas | Comprobado por SELECT el 10/nov, **volver a comparar antes del corte** |
| 2. SQL consolidado | Una transacción con preflight antes de DDL, RLS y revocaciones, RPC pública estable, auditoría privada, protecciones directas, sin SQL de moneda v2 | **7/7 workflows PASS** en commit `bb35d4463443495f863351590072a5b3da007838` (incluido JWT real contra SQL único en Supabase local); revisión independiente y paridad con clon restaurado pendientes |
| 3. Paridad en PostgreSQL 17 | Instalar SQL único y publicar USD como organizador; negar club ajeno, duplicado, suplantación y acceso directo; denegar si falta P0 o si cambian firmas | **PASS** en PG17 aislado: instalación íntegra del SQL candidato, DML liga/no-liga y P0 negativo; falta clon real |
| 4. GoTrue/PostgREST sobre SQL único | JWT de propietario/club secundario/jugador/anon y superadmin, creación/duplicado, primer resultado y permisos, usando el **SQL consolidado**, no alias QA | **Avance verificado (QA local)**: instalación integral del SQL, 4 cuentas GoTrue ficticias autenticadas, JWT de organizador/club ajeno/jugador y denegación anónima, publicación USD e idempotencia sobre PostgREST con nombre estable; workflow PASS. **Aún faltan** CRUD/duplicación bajo todas las identidades, paridad completa de roles y repetir sobre clon fiel restaurado |
| 5. Escritores heredados completos | Auditar DML sobre `tournaments`, `tournament_results`, `elo_history`, `players`, `profiles`, `league_standings`, incl. superadmin, importadores y cualquier `SECURITY DEFINER` adicional. Cerrar escrituras arbitrarias de ELO desde clientes sin romper torneos independientes | **NO GO confirmado con pruebas negativas**: usuario ficticio autenticado consiguió PATCH de ELO sobre fila propia e INSERT de historial ELO para torneo no-liga en Supabase local con permisos heredados simulados. Se conservaron los bloqueos sobre torneos de liga; falta cerrar escritores compartidos antes de GO |
| 6. Respaldo real | Restaurar **una copia productiva** en proyecto independiente y cotejar índices, RLS, funciones, permisos, Auth, relaciones, ELO, rankings, jugadores y fechas. Probar una reversión sin reabrir RLS | **NO GO**; copia ficticia ya probada, restauración productiva no |
| 7. Frontend y PR | Revisión final de cambios apilados #86–#94, CI completos, flag apagado antes del corte; preparar commit inmutable de despliegue | **Pendiente** |
| 8. Aprobación | Autorización expresa de costos de clon (si corresponde), de migración, y **separadamente** de despliegue/flag | **No concedida** |
| 9. Ventana de corte | Congelar temporalmente escrituras de ligas, registrar métricas/snapshot, aplicar migración versionada sobre producción **solo tras GO**, probar read-only e identidades reales sin crear datos reales, desplegar frontend compatible, retirar mantenimiento | **No ejecutada** |

### Pruebas que bloquean una publicación prematura

1. **ELO global:** `players` tiene políticas UPDATE heredadas para administradores y perfiles. Un jugador puede disputar torneos de liga y **no liga**, ambos afectando ELO. La protección de resultados por liga **no garantiza** por sí sola que una modificación directa de `players.elo_rating` sea imposible sin romper el flujo no liga. Es necesario auditar/migrar ese escritor y validar el límite real en una copia de producción.
2. **Funciones privilegiadas:** los cinco procedimientos heredados se copiaron desde el catálogo el 10/nov. El MD5 estricto detiene drift antes de DDL, pero **otros** procedimientos `SECURITY DEFINER` podrían escribir ELO, torneos o jugadores. Comprobar inventario completo; los permisos EXECUTE no constituyen evidencia suficiente de explotación.
3. **Datos históricos:** se registraron **3.576 discontinuidades ELO** en consulta de diagnóstico. No prometer replay de 1200 ni borrar historial. Edición/borrado permanece prohibido, con proceso manual posterior si faltan checkpoints.
4. **Fechas:** solo tres torneos de liga USD estaban pendientes al corte de lectura; 34 CLP/EUR pendientes quedan fuera de Release A. Los valores pueden variar; volver a contar antes de migrar.
5. **Uso real de directos:** al revocar DML en `league_standings` podría romper otras pantallas/funciones no inventariadas; auditoría de dependencias y pruebas de negocio obligatorias antes de permitir GO.

## Hallazgo nuevo — controles de escritura ELO (catálogo productivo, 10 noviembre 2026)

**Verificación exclusivamente de solo lectura:** consultas `SELECT` a `pg_policies`, `pg_proc`, `pg_trigger`, `pg_attribute` y `has_column_privilege` en el proyecto `nhpjzywfzljtlqaigzed`; sin DML, sin llamadas RPC, sin modificar datos, permisos o producción.

- **P0, `public.players`:** RLS habilitado, 7 políticas de escritura; cuatro de UPDATE (dos para administradores vinculados a torneos, una para el perfil propietario `profile_id=auth.uid()`, y una de superadmin). El rol `authenticated` conserva UPDATE efectivo de `elo_rating`, `elo_peak`, `total_prize_won`, `total_buy_ins_spent` y el resto de columnas. Sus 3 triggers existentes (`on_player_linked_sync_country`, `trg_players_auto_slug`, `update_players_timestamp`) no validan mutaciones de ELO. **Existe un camino de autorización de fila y columna potencialmente inseguro**; no se hizo un ataque ni una escritura de prueba en producción.
- **P0, `public.elo_history`:** RLS habilitado y una política INSERT `auth.uid() IS NOT NULL` sin comprobación de club/torneo; `authenticated` dispone de INSERT y no hay triggers de usuario en la tabla productiva. El candidato Release A protege DML de ligas con triggers, pero no resuelve todos los caminos no-liga ni la modificación directa de `players`.
- **Control comprobado que NO es un hallazgo:** aunque `public.profiles.role` tiene privilegio nominal de UPDATE, el trigger real `guard_profile_privileged_mutations` impide a usuarios normales cambiar `role`, XP, saldo y `unified_elo`. No proponer una escalada de rol a partir del GRANT aislado.
- **Rutas privilegiadas:** `delete_tournament_god_mode` y `reset_tournament_impact` escriben jugadores/ELO/resultados y `create_tournament_from_template` crea torneos; es imprescindible probar también las operaciones independientes de liga antes de retirar privilegios genéricos.

**GO exigido:** inventariar todos los escritores de ELO (cliente, funciones y triggers), proteger también las columnas compartidas de `players` mediante un escritor transaccional validado, verificar `elo_history` y ejecutar QA negativa con roles distintos, sin romper torneos no-liga. No hacer un REVOKE indiscriminado en producción. La revisión estática no sustituye pruebas funcionales sobre un clon fiel. Referencia: [Supabase Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security).

**Resultado:** Release A continúa **NO GO** y el flag `VITE_LEAGUE_GUARDED_RPC` debe permanecer apagado.

### Evidencia integrada adicional — suite de Auth real local (10 noviembre)

- **7 de 7 workflows PASS en `bb35d4463443495f863351590072a5b3da007838`**, incluyendo [instalación completa en GoTrue/PostgREST real local](https://github.com/SharkaniaElite/SharkaniaV2/actions/runs/42830082335). Es el SQL candidato integral, no el alias `_qa`. Los JWT son de usuarios inventados en un Supabase CLI sin enlace a producción.
- La suite creó **cuatro cuentas reales de GoTrue local** (organizador, club secundario, jugador y superadmin), verificó sesiones, rechazó anon/jugador/club ajeno para publicación inicial, rechazó posición duplicada y suplantación de `player_id`, aceptó USD del organizador y rechazó segunda publicación. El rol superadmin solo quedó autenticado en esta suite: todavía falta cubrir su autorización específica sobre las RPC de administración y publicación.
- **NO GO confirmado también por HTTP real:** al recrear las políticas heredadas en la misma base ficticia, el JWT del jugador modificó `players.elo_rating` y agregó `elo_history` de un torneo no-liga. El intento equivalente sobre torneo de liga sí fue bloqueado. En PostgreSQL aislado existe adicionalmente una [prueba negativa con ROLLBACK](https://github.com/SharkaniaElite/SharkaniaV2/blob/security/league-release-a-consolidated-candidate-2026-11-10/tests/fixtures/sharkania-release-a-untrusted-elo-write-negative-qa.sql).
- La **integridad global de ELO permanece incompleta**. Ver [plan de cierre de escritores compartidos](https://github.com/SharkaniaElite/SharkaniaV2/blob/security/league-release-a-consolidated-candidate-2026-11-10/docs/security/league-shared-elo-writer-cutover-plan-2026-11-10.md). Ninguna de estas pruebas realiza backup, clon restaurado de producción ni validación de costes, históricos y permisos reales al 100%.

## Estrategia de migración y rollback

El SQL único permanece **en docs, con sufijo `.CANDIDATE.sql`**, no dentro de `supabase/migrations`. Cuando pase las validaciones y haya autorización de preparar un artefacto desplegable, generar su fichero mediante la versión de CLI fijada (`supabase migration new …`), comprobar hash y probarlo sin cambios sobre el clon restaurado.

**No restaurar a ciegas políticas antiguas** ante un fallo. La secuencia segura de reversión es: desactivar escritura de ligas, mantener restricciones de RLS, volver al frontend/flag anterior con lectura disponible, diagnosticar y reparar en una nueva migración o restauración aprobada que reconcilie las escrituras posteriores. La reversión de frontend no deshace datos ya comprometidos.

## Evidencia y enlaces

- [Checklist maestro #81](https://github.com/SharkaniaElite/SharkaniaV2/issues/81).
- [PR #94 — cliente protegido](https://github.com/SharkaniaElite/SharkaniaV2/pull/94).
- [Runbook previo](https://github.com/SharkaniaElite/SharkaniaV2/blob/security/league-release-final-cutover-readiness-qa-2026-11-09/docs/security/league-final-cutover-runbook-2026-11-09.md).
- SQL: `docs/security/league-release-a-single-transaction-2026-11-10.CANDIDATE.sql`.
- QA: `.github/workflows/qa-league-release-a-single-cutover.yml`.

**GO actual: NO.** No se autoriza aplicar este SQL a `nhpjzywfzljtlqaigzed`, fusionar ramas ni activar `VITE_LEAGUE_GUARDED_RPC`.
