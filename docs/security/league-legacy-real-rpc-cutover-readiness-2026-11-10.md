# SHARKANIA — Cortar los escritores históricos sin romper torneos ajenos a ligas

**10 de noviembre de 2026 · QA exclusivamente · NO GO producción.**

## Fuente y objetivo

Las cinco definiciones usadas aquí proceden de consultas **solo lectura** sobre `pg_get_functiondef` del esquema productivo, no de mocks. Se conservaron íntegramente en `tests/fixtures/sharkania-production-legacy-rpc-source-2026-11-10.qa-only.sql`.

Funciones cuyo comportamiento debe auditarse:
- `delete_tournament_god_mode(uuid)`, `SECURITY DEFINER`, ejecutable por `authenticated`. Permite borrar resultados e historial y reconstruye ELO desde 1200 en orden por ID; no es un replay histórico fiable.
- `reset_tournament_impact(uuid)`, `SECURITY DEFINER`, ejecutable por `authenticated`, también reconstruye ELO desde 1200.
- `bulk_delete_scheduled_tournaments(uuid[])`, `SECURITY DEFINER`, ejecutable por `authenticated`; borra torneos programados elegibles y controla administración de clubes.
- `recalculate_league_standings(uuid)` y `update_league_standings(uuid)`, `SECURITY INVOKER`, ejecutables por `anon` y `authenticated` a nivel de grant; RLS puede impedir su escritura. Su lógica no conserva todos los campos de la clasificación avanzada.

## Diseño de candidato (NO aplicar al proyecto real)

`docs/security/league-legacy-rpc-guards-2026-11-10.qa-only.sql`:
1. Transacción con **preflight de huellas MD5** de las cinco funciones actuales. Ante cambios externos o distinta firma, error `PT409` **antes de cambiar SQL o permisos**. Comparar también permisos existentes.
2. Dentro de los cuerpos **reales** de las tres funciones destructivas, añadir una sola verificación interna **después de la autorización original y antes de cualquier DELETE, reinicio o reconstrucción**. Un `FOR UPDATE` sobre el torneo y una segunda autorización cierran cambios concurrentes de afiliación/club.
3. Si `tournaments.league_id` existe, rechazar con `PT409`; en lote, revisar IDs y bloquear filas en orden estable. Los torneos no pertenecientes a ligas mantienen sus procedimientos heredados para los administradores respectivos.
4. Revocar `EXECUTE` cliente sobre `recalculate_league_standings` y `update_league_standings`, que no sustituyen a la nueva RPC de ranking.
5. Los helpers son privados a nivel de `EXECUTE`, con `SECURITY DEFINER` y `search_path` vacío. Esto no autoriza escrituras de ninguna ruta alternativa.

**Limitación:** no equivale a cerrar todas las operaciones directas de `results-upload.tsx`, `results-editor.tsx`, `league_standings`, `players` y `elo_history`. Las políticas y grants REST deben cortarse junto al nuevo frontend. El SQL no es una migración productiva lista para ejecutar; incluye expresamente nombres `_qa` y no se ha cotejado todavía en un clon restaurado del proyecto real.

## Pruebas previstas en PostgreSQL 17 aislado

- Cargar definiciones auténticas archivadas, aplicar un esquema QA y comprobar que el preflight coincide.
- Simular un club administrador que intenta borrar, reiniciar y eliminar en lote un torneo de liga: tres rechazos PT409, sin cambios en torneo, resultados o ranking.
- Probar que el otro organizador no puede saltar su control original (42501).
- Ejecutar las mismas tres funciones **con un torneo no asociado a una liga**, verificando comportamiento exitoso sin efectos sobre una liga.
- Verificar la revocación de ambos recálculos para `anon` y `authenticated` y que los helpers privados no pueden ser llamados por clientes.
- **Negativa de integridad:** reemplazar el cuerpo de una función por otra versión en una base ficticia independiente; el corte debe fallar **antes de cualquier DDL**, sin crear helpers.

## Qué sigue bloqueando la publicación

- Regla deportiva y fecha de entrada de `currency-neutral-v2` aún sin aprobar.
- Editor/carga CSV y otras escrituras heredadas pendientes de migrar de forma conjunta.
- El replay de edición o eliminación histórica no puede certificarse con las discontinuidades ELO registradas. Continuar bloqueando esas operaciones para ligas.
- Respaldo **real** restaurado en entorno independiente y cotejo de esquema/autorización antes de aplicar migraciones (el ensayo ficticio anterior no lo sustituye).
- Aprobación expresa de la migración, deployment y flags. **No se efectuaron cambios de producción.**

Seguimiento: [issue #81](https://github.com/SharkaniaElite/SharkaniaV2/issues/81), QA anterior en [PR #92](https://github.com/SharkaniaElite/SharkaniaV2/pull/92).
