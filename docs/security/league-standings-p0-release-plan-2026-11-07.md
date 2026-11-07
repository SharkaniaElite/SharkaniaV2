# SHARKANIA · Plan de mitigación P0 de RLS de clasificaciones

**Corte de verificación:** 7 de noviembre de 2026. **PR #79: DRAFT, NO DESPLEGADO.** Este documento prepara una intervención revisable. **No autoriza ejecutar DDL en Supabase productivo.**

## Riesgo comprobado

La tabla `public.league_standings` tiene RLS activado, pero conserva tres políticas **PERMISSIVE** de INSERT/UPDATE/DELETE con `auth.role() = 'authenticated'`, además de políticas que solo autorizan superadministradores. Las políticas permisivas se combinan con `OR`; por tanto, la existencia de la segunda política restrictiva NO cierra el acceso general. El rol `authenticated` tiene grants DML sobre esta tabla. Bajo una réplica aislada de esos grants/políticas, un jugador ficticio pudo sobrescribir puntos de una liga ajena. No se intentaron escrituras contra producción.

El catálogo también confirmó una debilidad relacionada en `league_clubs`: la política UPDATE permite a un administrador secundario modificar `is_primary` de su propia fila. Sin unicidad por liga, puede quedar una liga con DOS clubes principales. La QA reprodujo ese intento.

## Compatibilidad comprobada en producción con SELECT solamente

- **34** ligas; **todas** tienen un club principal; ninguna tiene dos o más.
- **7** ligas tienen más de un club relacionado, pero el club principal sigue siendo único.
- **5.789** filas de `league_standings`; ninguna pertenece a una liga sin un administrador de su club principal.
- **295** torneos vinculados a ligas y **254** con resultados del club principal; **0** torneos son de un club distinto del principal.

Estos conteos son una fotografía de la consulta, no una restricción permanente. El control previo a cualquier despliegue debe **repetirlos con un SQL de lectura ligero**, comparando invariantes y no confiando en cifras antiguas.

Se inspeccionó `main`: `applyLeaguePoints` hace SELECT/INSERT/UPDATE por jugador desde navegador; `forceRecalculateStandings` llama `recalculate_league_standings` (`SECURITY INVOKER`) y después restaura campos CCP y buy-ins con UPDATE por jugador. El admin principal debe retener DML sobre sus posiciones o este flujo fallará.

## Propuesta QA mínima, separada de PR #65

`docs/security/league-standings-rls-p0-2026-11-07.qa-only.sql`:

1. Crea `league_clubs_one_primary_per_league_guarded`, un **solo índice único parcial** sobre `league_clubs(league_id) WHERE is_primary`. Bloquea la autopromoción de un club secundario si la liga ya tiene organizador principal. Se usa el mismo nombre que la propuesta de PR #65 para evitar construir índices duplicados. No cambia el orden habitual de creación de nuevas ligas, pero **cualquier flujo de transferencia de organizador principal debe validarse antes de aplicar el índice**.
2. **Elimina** las tres políticas de posiciones que aceptan a cualquier usuario autenticado. No basta crear otra política más restrictiva.
3. Crea políticas INSERT, UPDATE (USING + WITH CHECK) y DELETE solo para `authenticated`, permitiendo superadmin o club principal legítimo. La autorización calcula el conjunto de ligas permitidas a partir de `league_clubs` y exige **exactamente un club principal**, como defensa adicional ante datos anómalos.
4. Mantiene SELECT público y no modifica los nombres de las RPC heredadas, sus grants, las clasificaciones existentes ni ELO.

**Eficiencia:** el predicado de permiso se basa en un conjunto pequeño de `league_clubs`, no en consultar membresía para cada una de las 5.789 filas de `league_standings` de forma individual. La API web debe seguir filtrando `league_id` / `player_id`. La prueba usa `EXPLAIN` sin `ANALYZE` para compilar un UPDATE protegido, de modo que no ejecuta escrituras en la prueba de plan.

## Pruebas aisladas — PR #79

`tests/fixtures/sharkania-p0-league-standings-rls-qa.sql` y `tests/fixtures/sharkania-p0-standings-legacy-compat-qa.sql` con PostgreSQL 17 y UUID ficticios:

- Reproducen el fallo de la política antigua y la autopromoción del secundario antes de la propuesta.
- Confirman que el índice único impide la autopromoción y que las políticas nuevas eliminan la escritura desde el jugador.
- Verifican SELECT público anónimo, denegación de INSERT/UPDATE/DELETE al jugador, de escritura cruzada al secundario, retención CRUD para admin principal y superadmin, y bloqueo de traslado de una posición a otra liga.
- Prueban un *modelo reducido* de `recalculate_league_standings` (DELETE, INSERT y UPDATE en llamada invoker), suficiente para validar la interacción de roles/RLS con el orden heredado; **no reproduce toda la función real**, ni puntos CCP, top-N o desempates.
- Rechazan el uso del modelo de recálculo para otra liga; ejecutan `ROLLBACK` completo.
- **5/5 workflows aprobados** en PR #79 antes de este documento (última revisión de código sin aplicación productiva).

## Secuencia propuesta para producción — exclusivamente tras autorización explícita

1. Confirmar backup/restauración viable, estado de Auth y disponibilidad de la instancia Micro, ausencia de incidentes de recursos y acceso de superadmin. Elegir horario sin importaciones ni recálculos concurrentes.
2. Ejecutar preflight **solo lectura**: existencia de 1 primary por liga, permisos/rutinas correctos, 0 conflictos con índice parcial, metadatos DML/políticas vigentes, administradores de todas las ligas con posiciones y carga real de imports/editores. Si cambia el esquema desde este PR, detener.
3. Preparar una **única transacción corta** con `lock_timeout` y `statement_timeout` modestos. Crear el único índice parcial, eliminar las 3 políticas amplias y crear los 3 predicados de acceso en esa **misma transacción**, con todo o nada. No ejecutar scripts QA por accidente; generar un archivo de migración revisado y respaldado en una fase posterior.
4. Validar metadatos RLS/grants por SELECT, abrir lectura pública anónima y probar en interfaz real, con autorización, el permiso y recálculo de una liga de prueba administrada por organizador principal. **Nunca intentar una modificación de puntos de un jugador real para probar seguridad.**
5. Vigilar errores RLS, latencia y número de consultas mediante observabilidad. No habilitar comprobaciones/EXPLAIN ANALYZE de escritura a través de la API productiva. Si aparecen errores, **rollback seguro sin restablecer las tres políticas amplias**: congelar escrituras de standings temporalmente y trabajar con admins autorizados mientras se corrige la compatibilidad.
6. Mantener PR #65 aparte: sus vallas para `league_clubs` impiden autoinscripción y cambios de liga no autorizados. El índice propuesto aquí **no cierra todas** las vulnerabilidades de `league_clubs`, `leagues`, RPC viejas ni resultados CSV.

## GO / NO GO

**GO QA únicamente.** Aunque los controles de PostgreSQL aprobaron, faltan una prueba de compatibilidad completa en un clon de infraestructura con Auth/PostgREST, evaluación de políticas de administración compartida en casos especiales, aprobación del usuario y un procedimiento operativo respaldado. Hasta entonces: **no merge, no apply_migration, no cambios en base, no release.**

**Prioridad:** atender esta mitigación P0 antes de ampliar la refactorización ELO. El sistema de rankings actual permanece funcionando sin cambios.
