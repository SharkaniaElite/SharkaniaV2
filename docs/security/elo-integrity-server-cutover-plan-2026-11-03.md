# SHARKANIA — protección del cálculo ELO sin interrumpir resultados

**3 noviembre de 2026 · Solo diagnóstico y diseño. NO aplicado. Sin cambios en Supabase ni en cálculo productivo.**

## Evidencia en la rama Preview

- `src/lib/api/elo-engine.ts::calculateElo(tournamentId)` consulta el torneo, los resultados y los jugadores desde el navegador.
- Luego calcula ELO en TypeScript y ejecuta por separado `players.update` (ELO, pico, torneos, cashes, victorias, premios y buy-ins), `elo_history.insert` y `tournament_results.update` para cada participante.
- Tras el bucle sincroniza perfiles y marca `tournaments.results_uploaded=true` y `status='completed'` mediante otra petición.
- **No comprueba la propiedad `error`** en cada una de esas escrituras; puede responder `success:true` incluso si una o varias actualizaciones son rechazadas por RLS, se corta la conexión o fallan dependencias. No existe transacción general que revierta todas las modificaciones.
- `reverseElo` borra el historial por otra petición independiente; requiere análisis del flujo completo antes de cambiar permisos.
- `src/components/admin/results-upload.tsx` y `src/components/admin/results-editor.tsx` crean nuevos `players` inicialmente con ELO 1200, y `src/components/admin/club-players-tab.tsx` edita legítimamente `nickname` y `country_code`.
- En producción, `authenticated` tiene privilegios de columna `UPDATE` sobre `players.elo_rating`, `elo_peak`, contadores y premios. La RLS `Players: editar propio` deja actualizar cualquier columna de su fila, sin trigger de integridad para valores derivados.

## Objetivo de seguridad / continuidad

Convertir el cálculo en una **operación transaccional server-side**, invocable solo por `super_admin` o administrador del club del torneo, nunca por jugadores corrientes. Se calculará el ELO exclusivamente desde los resultados almacenados, no desde valores propuestos por el navegador. No se cambia el criterio competitivo sin validación del propietario.

### Contrato propuesto

`calculate_tournament_elo_guarded(p_tournament_id uuid)` → devuelve éxito/idempotencia/recuento de jugadores o error tipificado; no recibe ELO, dinero ni UUID de jugadores suministrados por el cliente, salvo el torneo autorizado.

1. Rechazar anónimo y usuarios sin autorización; resolver club del torneo desde la base. No usar `user_metadata` para permisos.
2. Bloquear la fila del torneo y las filas afectadas de jugadores y resultados en orden estable; comprobar mínimo dos jugadores, posiciones válidas y que ninguno falte.
3. Garantizar idempotencia: no otorgar dos veces puntos/premios si el torneo ya fue procesado.
4. Calcular exactamente la fórmula actual (score normalizado por posición, expectativa por diferencia ELO, K dependiente de número de torneos, buy-in y participantes, peso por ELO medio), comparar resultados con tests de referencia TypeScript.
5. Actualizar jugadores, historial, resultado individual y estado del torneo en **una sola transacción**; si falla cualquier operación, revertir todas.
6. Sincronizar ELO unificado respetando múltiples nicknames sin sobrescribir otros perfiles y sin mezclar monedas para métricas financieras.
7. Tras probar la función en Supabase QA, cambiar la UI a RPC y retirar el bucle de escritura client-side. Entonces restringir columnas ELO/premios y la política INSERT de `players`, conservando edición legítima de nickname y país por el administrador autorizado.
8. Añadir pruebas por rol, concurrencia, doble clic/doble ejecución, errores parciales, reversión y repetición sobre el mismo torneo; comparar ELO histórico de casos sintéticos con algoritmo anterior.

## Riesgos de una corrección apresurada

- Revocar `UPDATE` sobre las estadísticas de `players` antes del corte a RPC rompería el cálculo vigente del frontend.
- Permitir al cliente invocar un RPC privilegiado con estadísticas calculadas por él permitiría falsificar ELO; el servidor debe ser la autoridad.
- Ignorar que `calculateElo` usa múltiples peticiones puede duplicar conteos o dejar tornos procesados a medias, incluso si se añadió un control de errores.
- SQL de prueba en PostgreSQL mínimo **no prueba** funciones de Supabase Auth ni todos los triggers actuales; se necesita un entorno Supabase aislado antes de publicar.

## Estado

- [x] Riesgos en cliente y permisos de columnas identificados con lectura del código y catálogo de producción.
- [x] Pruebas reales de políticas de otras 7 tablas superadas con PostgreSQL 17 aislado (workflow `core-supabase-rls-qa.yml`).
- [ ] RPC de ELO implementada y comparada contra fórmula anterior.
- [ ] Simulación en Supabase QA con Auth/RLS y dependencias completas.
- [ ] UI migrada al RPC sin regresiones de torneos/rankings.
- [ ] Columnas y políticas de jugador restringidas después del cambio.
- [ ] Revisión de logs y aprobación para despliegue productivo.

**NO-GO en producción mientras estas pruebas no pasen. Sin trabajo sobre módulos que se retirarán.**
## Avance: RPC transaccional propuesta y verificada con PostgreSQL sintético

Implementación propuesta, **no aplicada**: [elo-transactional-guarded-rpc-2026-11-03.proposal.sql](elo-transactional-guarded-rpc-2026-11-03.proposal.sql). Declara `calculate_tournament_elo_guarded(uuid)` como `SECURITY DEFINER`, con `search_path` fijado, autorización por `auth.uid()` + club/superadmin, revocación `EXECUTE` a `PUBLIC`/`anon`, y concesión explícita a `authenticated`. No recibe ELO ni ganancias desde el navegador.

Una única llamada PostgreSQL bloquea torneo/jugadores/resultados, valida posiciones, comprueba historial y evita reprocesar `results_uploaded=true`; actualiza estadísticas, historial, ELO unificado y estado del torneo, revirtiendo todo ante errores de la transacción. La ecuación reproduce el TypeScript existente, sin cambiar sus factores.

**Pruebas de ejecución real PostgreSQL 17 aislado:** `tests/fixtures/sharkania-elo-qa-setup.sql`, `tests/fixtures/sharkania-elo-qa-assert.sql`, integradas en `.github/workflows/core-supabase-rls-qa.yml`. Escenarios: anónimo, jugador normal, admin de club ajeno, admin dueño, doble procesamiento, cálculo numérico (2 jugadores ELO 1200, buy-in 10: ELO final 1223,08 y 1176,92), premios y contadores, historial y perfiles, historial anterior parcial.

El paso de ejecución del RPC en CI terminó `success` en el run `41712846518`, commit `645536f80b86c2b49447a03977886e389f9c86b4`. Es una **prueba de PostgreSQL con roles ficticios**, no Supabase QA completo. La UI sigue usando el motor anterior porque la RPC no ha sido publicada: mantener ese estado hasta autorizar el cambio.

**Pendiente crítico:** probar conflictos entre torneos concurrentes, todos los tipos de perfiles/alias, moneda/cálculo financiero, triggers productivos, `reverseElo` y el flujo de cargas reales. En particular, no publicar la RPC sin haber probado previamente el esquema completo de Supabase; no activar un flag de cliente o revocar `players.UPDATE` antes de cutover validado.

## Segunda batería de QA adversarial — 3 de noviembre de 2026

- **Hallazgo corregido en la propuesta SQL (no en producción):** un torneo con dos filas de resultados pertenecientes al **mismo jugador** y posiciones distintas superaba la validación inicial de posiciones, con riesgo de incrementar dos veces ELO, premios y contadores. La propuesta ahora requiere `count(DISTINCT tr.player_id) = count(*)` además de las posiciones únicas.
- **Nueva prueba ejecutada:** `tests/fixtures/sharkania-elo-qa-adversarial.sql`, añadida al workflow aislado de PostgreSQL 17.
- **Casos negativos confirmados:** jugador duplicado, identificador de jugador inexistente, posición duplicada y posición fuera del rango permitido. Ninguno cambia el estado del torneo ni el historial de ELO.
- **Atomicidad comprobada:** un trigger exclusivamente ficticio provoca un error al insertar el historial del segundo jugador; el RPC revierte los cambios que ya había intentado efectuar sobre el primer jugador. Se comprueban tablas de jugadores, perfiles, resultados, torneos e historial.
- **Evidencia:** GitHub Actions run [41714223441](https://github.com/SharkaniaElite/SharkaniaV2/actions/runs/41714223441), job `rls` concluido con `success`. Estas pruebas **no modificaron Supabase**.
- **Bloqueos aún abiertos:** concurrencia entre torneos que comparten jugadores, reentradas/buy-ins efectivos, compatibilidad con varios nicknames, reversión del ELO, cifras multimoneda, permisos y triggers reales de Supabase, y comparación completa con el frontend. La propuesta sigue **NO-GO para producción**.


## Continuación — reentradas, compatibilidad y cliente protegido (3 nov 2026)

### Evidencia agregada SOLO lectura en Supabase productivo

- `public.tournament_results`: 20.432 resultados, 1.576 con `buy_ins_count > 1` y 2.527 entradas adicionales a la primera. Hay un máximo de 13 entradas y **ningún conteo nulo, no positivo o fraccionario** en los resultados presentes.
- Los datos pertenecen a **tres monedas distintas** (EUR, CLP y USD). No sumar ingresos, pérdidas ni gasto histórico en un único número sin conversión verificable ni recalcular una columna agregada mixta automáticamente.
- El motor anterior cargaba `total_buy_ins_spent += buy_in` por fila, sin multiplicar por `buy_ins_count`. El desfase es una **inconsistencia de modelado**, no una medición contable auditada. La propuesta protegida ahora calcula `buy_in * buy_ins_count` y rechaza entradas nulas, fraccionarias o menores a 1. **Ninguna fila productiva ha sido corregida** y la puntuación ELO/K no cambió.
- Las firmas actuales de `is_super_admin()`, `is_club_admin(uuid)` y `get_unified_elo(uuid)` coinciden con las referencias de la propuesta SQL. Falta validarlas junto con triggers y permisos reales en una base QA aislada.

### Avances exclusivamente en el PR en borrador

- `tests/fixtures/sharkania-elo-qa-reentries.sql`: usa PostgreSQL 17 aislado y premios ficticios para probar tres entradas, importes, contadores e invalidación atómica de entradas 0, nulas y fraccionarias.
- `tests/fixtures/sharkania-elo-qa-concurrency-assert.sql` y el workflow comprueban procesamiento simultáneo de dos torneos con jugadores comunes.
- `src/lib/api/guarded-elo.ts` introduce `VITE_ELO_GUARDED_RPC === "true"` **apagado por defecto**. En ese modo el navegador solo invoca `calculate_tournament_elo_guarded` y nunca reintenta el cálculo de cliente si el servidor rechaza la petición. La nueva RPC **NO está instalada**, por lo que activar hoy el flag detendría cálculos.
- `calculateElo` delega a la RPC protegida únicamente si está habilitada. `reverseElo` y `prepareTournamentForReedit` bloquean los caminos de reset antiguos bajo ese mismo modo hasta reemplazarlos por un servicio transaccional autorizado. **Los resultados-upload/editor todavía contienen escrituras directas**, por lo que no declarar terminado el cutover.
- `tests/elo-guarded-cutover-contract.test.mjs` protege el flag, la ausencia de fallback y el bloqueo de reversión.

### Bloqueos de lanzamiento

1. Preparar una base Supabase QA aislada con esquema completo, Auth y roles. Los dumps privados de `public`/`private` que se recuperaron el 3 de noviembre representan el **estado actual posterior** a las 50 migraciones y carecen de ACL/owners. No sirven directamente como migración inicial: faltan grants, dependencias de `auth` y reconstrucción reproducible. No modificar el historial productivo ni crear una rama con coste sin aprobación.
2. Probar upload, edición y reversión como **una sola operación server-side autorizada**. Hasta entonces el flag permanece en `false`. Comprobar también que los perfiles con alias múltiples actualicen `unified_elo` sin inconsistencias.
3. Diseñar la contabilidad monetaria por divisa y reentradas, luego reconciliar sumatorias históricas sin alterar ELO ni asignaciones de premios no verificadas.
4. En el corte final, restringir columnas ELO/financieras a clientes no autorizados **solo después** de comprobar la sustitución de las escrituras administrativas. Integrar autorización de clubes y Stats Espía.

**Estado: progreso de implementación y QA sintética, pero NO-GO para producción.**


## Vulnerabilidad de escritura directa en historial ELO — reproducción local con FK válidas (4 nov 2026)

**Estado: reproducida en Supabase local, SIN ejecutar contra producción. Severidad sugerida: ALTA para la integridad de datos competitivos.**

En el entorno Supabase CLI local con snapshot actual de `public/private`, Auth real, RLS, grants de funciones reproducidos y dos usuarios ficticios confirmados, el propietario ejecutó una transacción con los siguientes pasos:

1. Como `postgres`, creó dentro de `BEGIN` una sala, club, jugador y torneo totalmente sintéticos, guardando sus UUID locales.
2. Adoptó `SET LOCAL ROLE authenticated` y `request.jwt.claim.sub` del usuario ficticio normal, sin pertenencia administrativa al club.
3. Ejecutó `INSERT INTO public.elo_history(player_id,tournament_id,elo_before,elo_after,elo_change)` con referencias válidas y `elo_change=1000`.
4. El bloque retornó `NOTICE: ALERTA CONFIRMADA: jugador autenticado pudo insertar historial ELO arbitrario`, seguido de `ROLLBACK`.

**Alcance probado:** el rol autenticado puede insertar arbitrariamente un evento ELO **con claves foráneas válidas**, sin RLS que lo ligue a una autorización de club/torneo. No se guardaron datos y ningún recurso productivo fue modificado. Esto confirma un bypass de autorización en el estado actual del esquema local. Los metadatos productivos consultados en modo solo lectura coinciden: `elo_history` tiene permiso `INSERT` para `authenticated`, y la policy `Elo history: sistema` dispone `WITH CHECK (auth.uid() IS NOT NULL)`, sin disparadores que autoricen la inserción. La reproducción remota con datos productivos NO se realizó.

**Efecto verificado en código:** `public.get_unified_elo(uuid)` agrega `elo_history.elo_change` si el perfil tiene múltiples nicknames; `get_unified_elo_history(text)` usa ese historial para reconstruir la serie. La inserción ficticia no ejecutó una consulta posterior de ranking real; describir contaminación potencial de métricas/historial, NO declarar que el ranking principal fue alterado.

**Por qué no aplicar un REVOKE inmediato en producción:** `src/lib/api/elo-engine.ts` todavía escribe `elo_history.insert` desde el navegador durante cálculo legítimo de resultados. Revocar `INSERT` ahora rompería el flujo legado. Ya existe `docs/security/elo-transactional-guarded-rpc-2026-11-03.proposal.sql`, aún NO instalada, y el flag `VITE_ELO_GUARDED_RPC` está apagado. Una protección viable requiere **cutover atómico y coordinado**: verificar RPC transaccional y todos los uploads/reversión/edición en Supabase QA, migrar el código, revocar `INSERT` directo a `PUBLIC` / `anon` / `authenticated` y comprobar que el RPC `SECURITY DEFINER` autorizado conserva el cálculo. Restringir también las escrituras directas de estadísticas derivadas de `players` y accesos premium Stats Espía según su plan específico.

**Próximo gate en QA:** comprobar en transacción reversible que `REVOKE INSERT ON public.elo_history FROM PUBLIC, anon, authenticated` deja `has_table_privilege('authenticated', 'public.elo_history','INSERT')=false`, terminando en `ROLLBACK`, y luego instalar/ejercitar la RPC de propuesta solo en la copia local. Sin despliegue en producción ni merge de PR #64 hasta cierre integral con aprobación del propietario. **NO-GO**.


### Simulación reversible de permisos ELO: PASS y paquete de QA protegido preparado (4 nov 2026)

El operador realizó `BEGIN; REVOKE INSERT ON public.elo_history FROM PUBLIC, anon, authenticated;` y consultó permisos efectivos: `jugador_puede_insertar=f`, `servicio_puede_insertar=t`. Cerró con `ROLLBACK`. Esto prueba que la propuesta de reducción de GRANT bloquea INSERT directo **sin bloquear el servicio** y que la prueba no deja cambios persistentes. **No prueba todavía compatibilidad con los cálculos productivos actuales**.

Se preparó un paquete privado `SHARKANIA_QA_ELO_guarded_local_v1.zip` (script + README), **no ejecutado en el equipo del operador**. Preflight verifica contenedor local fijo, puerto loopback, 64 tablas, 2 cuentas sintéticas confirmadas y ausencia de RPC previa. Descarga el SQL original del commit fijo `b059bf388a2088a3c2a2807e3262e27454e4089e`, compara su SHA de blob `5e079fa06005d3aaf8e1be1053961857edf7ddea`, y ejecuta **una sola transacción con ROLLBACK**: datos ficticios válidos, revocación local temporal del INSERT, CREATE FUNCTION de RPC transaccional, rechazo de usuario normal, cálculo y repetición idempotente como admin ficticio del club, ELO 1223.08/1176.92, historial, premios, reentradas de 1 y perfil sincronizado. Tras rollback exige que la RPC siga ausente y que el GRANT original se restaure. El ZIP pasó `bash -n` y `unzip -t`, pero **no la prueba de ejecución PostgreSQL real**.

Mantener **NO-GO** y no instalar permanente el motor protegido ni activar su flag hasta comprobar todos los flujos admin de resultados/edición/reversión, datos multimoneda y Stats Espía. El paquete no toca Supabase remoto.


## Ejecución de RPC protegida sobre Supabase completo local — PASS (4 nov 2026)

**Evidencia proporcionada por el operador:** desde Ubuntu, carpeta `~/sharkania-qa`, ejecutó `SHARKANIA_QA_ELO_guarded_local_v1.sh` contra el contenedor local `supabase_db_sharkania-qa`; el reporte fue:

```text
PASS: contenedor/puertos locales, 64 tablas, 2 usuarios sintéticos confirmados y RPC ausente.
PASS: SQL original identificado por SHA de GitHub; versión fija, sin cambios.
NOTICE: PASS: club, torneo, resultados y administrador de club ficticios creados temporalmente
NOTICE: PASS: jugador no puede INSERT directo ELO, pero puede invocar RPC; anon no puede RPC
NOTICE: PASS: usuario normal rechazado por RPC
NOTICE: PASS: admin de club calculó ELO transaccionalmente
NOTICE: PASS: segundo cálculo es idempotente
NOTICE: PASS: ELO final 1223.08 y 1176.92; historial, premio, buy-in, perfil y torneo consistentes
ROLLBACK
PASS FINAL: RPC ELO probada y restauración local completa por ROLLBACK; ningún cambio persistente.
```

Esta batería supera el alcance del antiguo PostgreSQL sintético: aquí la RPC propuesta se creó **solo temporalmente en una transacción** sobre el Supabase CLI local real con 64 tablas, Auth y RLS existentes. El script verificó procedencia SQL por SHA y revirtió tanto función como grants y fixture mediante `ROLLBACK`. **No se instaló la RPC en ningún entorno persistente; no se cambiaron producción, main ni la configuración de flags.**

**Gate aprobado (local):** autorización de jugador normal/administrador de club, permiso INSERT directo revocado, rechazo `anon`, fórmula determinista de dos jugadores (1223,08 / 1176,92), idempotencia, consistencia básica de historial y acumulados, rollback local.

**Gates aún pendientes antes de publicación:** ejecución desde API Supabase/PostgREST con JWT reales; permisos adversariales con administradores de clubes ajenos; carga y edición de torneos con la UI; reversión y reapertura transaccionales; sincronización de alias múltiples; reentradas/comprobación por moneda y comparación histórica; concurrencia en esquema completo; controles de Stats Espía. En particular, `src/components/admin/results-upload.tsx` / `results-editor.tsx` todavía escriben resultados desde el navegador y `reverseElo` / `prepareTournamentForReedit` se bloquean al activar el flag. **NO-GO.**


## Hallazgo adicional: UPDATE directo de métricas en `players` con identidad propia — confirmado en QA (4 nov 2026)

El operador ejecutó la prueba sintética local sobre Supabase CLI con un `player` recién creado y vinculado a un usuario ficticio confirmado de `auth.users`. Después de `SET LOCAL ROLE authenticated` con `request.jwt.claim.sub` de ese usuario, `UPDATE public.players SET elo_rating=9999, total_prize_won=123456 WHERE id=<jugador ficticio>` afectó una fila. Evidencia textual reportada:

```text
NOTICE: PASS: jugador ficticio vinculado a su cuenta
NOTICE: ALERTA: jugador pudo falsificar ELO y premios
ROLLBACK
```

**Confirmado en QA:** la política UPDATE `Players: editar propio` y privilegios existentes permiten a un usuario autenticado alterar directamente estadísticas derivadas de su jugador vinculado, no solo insertar ELO en `elo_history`. Ninguna modificación persistente: el test y su fixture cerraron con `ROLLBACK`.

**Corroboración solamente de catálogo productivo** (sin ejecutar DML): `information_schema.role_table_grants` muestra `UPDATE` a `anon` y `authenticated` sobre toda `public.players`; `has_column_privilege('authenticated','public.players','elo_rating','UPDATE')=true`, igualmente `total_prize_won`. Las políticas UPDATE incluyen `Players: editar propio` (`profile_id=auth.uid()`), y otras para administradores de club/super. Los triggers existentes son slug, sincronización de país y `updated_at`, sin guardia de métricas ELO. **El alcance concreto probado fue la escritura directa local con datos válidos; no se realizó ataque sobre producción.**

**Implicación de migración:** un GRANT de tabla `UPDATE` concede UPDATE sobre todas las columnas; no basta revocar una columna individual si persiste el permiso de tabla. Probar exclusivamente en transacción QA `REVOKE UPDATE ON public.players FROM PUBLIC, anon, authenticated` y `GRANT UPDATE (nickname,country_code) ... TO authenticated`, verificando que datos editables sigan funcionando y que ELO/premios sean denegados. Esto es **solo experimento**, NO una migración apta para producción: los admins y el motor ELO legado requieren escrituras, hay otras columnas y rutas que deben inventariarse y migrarse a RPC/servicio transaccional con cobertura de tests de regresión.

**Prioridad ALTA**, pendiente de mitigación completa y aprobación de publicación. **NO-GO**.


## Simulación reversible de UPDATE por columnas: PASS; nueva prueba INSERT player pendiente (4 nov 2026)

Operador confirmó en `supabase_db_sharkania-qa` el resultado de `BEGIN; REVOKE UPDATE ON public.players FROM PUBLIC,anon,authenticated; GRANT UPDATE(nickname,country_code) ... TO authenticated; SELECT has_column_privilege(...); ROLLBACK`:

```text
editar_nickname=t
editar_pais=t
modificar_elo=f
modificar_premios=f
ROLLBACK
```

El diseño de privilegios finos es factible en local, **pero la prueba solo examinó GRANT efectivos y no ejecutó aún UPDATE real del administrador o la interfaz**. No aplicar esta revocación a producción antes del corte transaccional de administración, uploads/edición/reversión ELO y consultas por roles.

Nueva superficie detectada por inspección de código + catálogo productivo de solo lectura: `src/components/admin/results-upload.tsx` y `results-editor.tsx` insertan directamente en `players` con el navegador, inicialmente fijando `elo_rating=1200`. La policy `Players: club admin crear` tiene `WITH CHECK (auth.uid() IS NOT NULL)`, sin validación de administrador de club, y rol `authenticated` posee INSERT de tabla y columnas ELO/premios. **Riesgo no reproducido todavía:** usuario autenticado normal podría crear jugadores con ELO/premios arbitrarios y sin aprobación de club. Preparar prueba local reversible con sala sintética y cuenta ficticia, concluyendo `ROLLBACK` antes de establecer hallazgo. Se necesita diseñar mecanismo seguro de alta de jugadores sin perder la autonomía de clubes. **NO-GO**.
