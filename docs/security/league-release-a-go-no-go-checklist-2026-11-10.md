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
| 2. SQL consolidado | Una transacción con preflight antes de DDL, RLS y revocaciones, RPC pública estable, auditoría privada, protecciones directas, sin SQL de moneda v2 | Archivo candidato preparado; **CI y revisión independiente pendientes** |
| 3. Paridad en PostgreSQL 17 | Instalar SQL único y publicar USD como organizador; negar club ajeno, duplicado, suplantación y acceso directo; denegar si falta P0 o si cambian firmas | Suite nueva creada; pendiente de resultado |
| 4. GoTrue/PostgREST sobre SQL único | JWT de propietario/club secundario/jugador/anon y superadmin, creación/duplicado, primer resultado y permisos, usando el **SQL consolidado**, no alias QA | **Pendiente**. Suites anteriores probaron piezas, no este archivo integral |
| 5. Escritores heredados completos | Auditar DML sobre `tournaments`, `tournament_results`, `elo_history`, `players`, `profiles`, `league_standings`, incl. superadmin, importadores y cualquier `SECURITY DEFINER` adicional. Cerrar escrituras arbitrarias de ELO desde clientes sin romper torneos independientes | **NO GO**, falta paridad completa |
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
