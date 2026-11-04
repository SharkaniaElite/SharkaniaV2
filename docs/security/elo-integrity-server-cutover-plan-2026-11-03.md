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


## Vulnerabilidad adicional: INSERT arbitrario en `players` confirmado (4 nov 2026)

**Evidencia reportada por el operador en Supabase CLI QA local (Auth real, sin afectar producción):**

```text
PASS: usuario normal sin permisos de club preparado
ALERTA: usuario normal pudo crear jugador con ELO y premios falsificados
ROLLBACK
```

El ensayo creó una sala temporal y, bajo `SET LOCAL ROLE authenticated` y un `request.jwt.claim.sub` de usuario de prueba sin `club_admins`, efectuó `INSERT INTO public.players(nickname,room_id,elo_rating,elo_peak,total_prize_won)` con valores ficticios `9999,9999,123456`; la inserción fue aceptada. **Hallazgo confirmado en esquema local:** la policy `Players: club admin crear` solo comprueba `auth.uid() IS NOT NULL`, sin condición de club, y el rol `authenticated` tiene INSERT completo en la tabla, incluidas métricas derivadas. La prueba terminó en `ROLLBACK`.

**Mitigación propuesta, no aplicada:** sustituir escritura directa desde el navegador por RPC `ensure_tournament_player_guarded(tournament_id,nickname,country_code)`, `SECURITY DEFINER` con `search_path=''`, autenticar por `auth.uid()`, verificar `is_super_admin()` o `is_club_admin(tournament.club_id)`, obtener `room_id` del torneo, deduplicar por nickname/sala, e insertar exclusivamente `nickname,room_id,country_code` con defaults de ELO/premios. Rechazar intento anónimo, usuario normal y admin de club ajeno. En el cutover revocar INSERT directo de `anon/authenticated/PUBLIC`, eliminar la policy demasiado amplia, sustituir `resolvePlayer` en `results-upload.tsx` y `results-editor.tsx`, conservar la edición legítima nickname/país de administradores mediante permisos precisos y ejecutar exclusivamente cálculo ELO transaccional autorizado. Todos los privilegios deben ensayarse contra la carga/edición/reversión antes de deploy.

Preparado un **kit de QA reproducible** `SHARKANIA_QA_PLAYER_GUARDED_2026-11-04.zip` que incluye SQL de propuesta y shell con preflight estricto para el contenedor local `supabase_db_sharkania-qa`. Ejecuta DDL/DML y revocaciones solo en **BEGIN ... ROLLBACK**, revisa cuenta sintética y 64 tablas, y comprueba autorización/falsificación/deduplicación. **Se validaron Bash con `bash -n` y estructura ZIP, no se ejecutó todavía el SQL sobre la instancia local del operador.** Si falla el ensayo, analizar y corregir en QA, no aplicar a producción.

Estado: tres vulnerabilidades de escritura confirmadas en QA; ELO RPC protegida pasó pruebas de cálculo; alta protegida aún pendiente de ejecución; **NO-GO**.


## QA local: alta protegida de jugadores PASS — 4 nov 2026

El operador ejecutó el script `SHARKANIA_QA_player_creation_guarded_local_v1.sh` contra su contenedor Supabase CLI local y compartió la salida completa. La transacción instaló temporalmente `ensure_tournament_player_guarded(uuid,text,text)`, revocó INSERT directo de `players` y retiró la policy amplia, y comprobó estas condiciones:

```text
PASS: Supabase local, 64 tablas, cuentas QA y RPC nueva ausente.
PASS: clubes, torneos y usuarios ficticios preparados
PASS: permisos de columna/tabla y EXECUTE adecuados
PASS: INSERT directo prohibido incluso con estadisticas falsas
PASS: jugador normal sin club rechazado por RPC
PASS: administrador no puede operar club ajeno
PASS: admin legitimo crea ficha con ELO 1200, premios 0, sin duplicado
PASS: tambien admin debe usar RPC protegida
ROLLBACK
PASS FINAL: RPC y autorizaciones de creacion aprobadas. ROLLBACK restauro todo.
```

**Resultado:** validado en el clon local real de Supabase con dos identidades ficticias y permisos RLS. No hay RPC instalada permanentemente; datos y permisos previos restaurados. Copia de la misma propuesta SQL, **no es migración ejecutable sin autorización**, disponible en `docs/security/player-creation-guarded-rpc-2026-11-04.proposal.sql`.

**Bloqueo para el corte:** `src/components/admin/results-upload.tsx` y `results-editor.tsx` continúan resolviendo/creando jugadores con escrituras directas; además, la carga/edición está intencionadamente bloqueada cuando `VITE_ELO_GUARDED_RPC=true` hasta tener un flujo de resultados completamente transaccional. NO activar la nueva RPC o retirar GRANT en producción de forma aislada. Próximo gate: comprobar edición legítima de `nickname`/`country_code` por admin de club bajo permisos de columna restringidos, más denegación de ELO y de edición por usuario ajeno; después diseñar carga/edición/reversión seguras en servidor. **NO-GO**.


## QA local: edición legítima de jugadores y permiso de columnas — PASS (4 nov 2026)

El operador ejecutó `SHARKANIA_QA_admin_edicion_columnas_local_v2_REGENERADO.sh` en Supabase CLI local. La salida fue:

```text
PASS: contenedor local y cuentas de prueba verificados.
PASS: club, torneo, jugador y administrador de club ficticios preparados
PASS: administrador del club puede editar nickname y pais
PASS: administrador no puede falsificar ELO ni premios por UPDATE directo
PASS: usuario ajeno no puede editar el jugador del club
ROLLBACK
PASS FINAL: edicion legitima y prohibicion de ELO comprobadas. ROLLBACK restauro los datos y permisos.
```

**Gate local aprobado:** se puede restringir el UPDATE a `nickname` y `country_code` manteniendo la edición por un administrador autorizado y denegando ELO, premios y modificaciones por extraños. No quedó ninguna política/grant alterado permanentemente. El script inicial v1 se detuvo en un preflight por un error de interpretación del booleano `true` frente a `t`; v2 corrigió esa prueba, sin requerir reinicio ni reimportación.

**Nuevo riesgo separado detectado mediante catálogo productivo SOLO LECTURA, AÚN NO probado por DML:** `public.league_standings` tiene RLS habilitado pero policies "Permitir insertar/actualizar/eliminar a usuarios autenticados" con predicado `auth.role()='authenticated'`, y grants INSERT/UPDATE/DELETE a `authenticated`; no tiene triggers no internos. Con FK válidas, un usuario autenticado podría manipular posiciones. Antes de declarar vulnerabilidad confirmada, reproducir en Supabase local con dos jugadores y una liga ficticia, `SET LOCAL ROLE authenticated`, `request.jwt.claim.role='authenticated'`, JWT subject ficticio sin club, INSERT/UPDATE/DELETE, `ROLLBACK`. Luego proponer tratamiento server-side transaccional del cálculo de standings que no rompa el algoritmo vigente `applyLeaguePoints` / `forceRecalculateStandings`. **NO-GO**.


## Vulnerabilidad confirmada en `public.league_standings` (4 nov 2026)

**Evidencia suministrada por el propietario:** la prueba local en Supabase CLI PostgreSQL con `BEGIN` / `ROLLBACK`, liga y jugadores sintéticos, una cuenta `authenticated` confirmada **sin clubes administrados** y `request.jwt.claim.role='authenticated'`, produjo exactamente:

```text
NOTICE: PASS: liga y jugadores ficticios preparados
NOTICE: ALERTA: jugador pudo falsificar puntos de liga
NOTICE: ALERTA: jugador pudo insertar posiciones falsas
NOTICE: ALERTA: jugador pudo borrar posiciones de liga
ROLLBACK
```

**Resultado:** usuario normal pudo `UPDATE league_standings.total_points=777777`, `INSERT league_standings.total_points=888888` y `DELETE` una clasificación existente con FK válidas. Todo revertido por `ROLLBACK`; no se modificó producción ni hubo datos guardados. Es la **cuarta superficie confirmada** en QA local, junto a escritura `elo_history`, UPDATE ELO/premios en `players` y alta de jugador arbitrario.

**Sustento de metadatos productivos, obtenido antes del ensayo y solo lectura:** tabla con RLS habilitada, grants INSERT/UPDATE/DELETE a `authenticated`, policies permisivas «Permitir [insertar/actualizar/eliminar] a usuarios autenticados» con `auth.role()='authenticated'`, sin triggers específicos. Esto no autoriza escribir datos productivos para validar el problema: la reproducción local es suficiente para requerir corrección.

**Aislamiento de reparación:** NO revocar estos permisos en producción hasta auditar `recalculate_league_standings` y `src/lib/api/leagues.ts`/flujos de liga (código actual invoca la RPC y también hace `.from("league_standings").update(...)` para `ccp_club,total_buy_ins_spent`). Una revocación abrupta podría dejar posiciones y rankings desactualizados. Próximo paso: introspección **solo lectura en Supabase local** del atributo `SECURITY DEFINER`, grants `EXECUTE` de `recalculate_league_standings`; luego diseñar reemplazo transaccional autorizado por club para todos los campos derivados, incluyendo las actualizaciones directas del cliente. Ensayar `REVOKE INSERT,UPDATE,DELETE FROM PUBLIC,anon,authenticated` solo en transacción local con `ROLLBACK`, comprobar continuidad con llamadas autorizadas y rechazos anónimos/sin club/club ajeno. Si la RPC actual corre como invocador o permite invocación abierta, será necesario reemplazarla por otra protegida ANTES del corte. **NO-GO**.


## Consulta local de superficie de RPC de recálculo de liga — 4 nov 2026

Salida del operador en `supabase_db_sharkania-qa`, consulta **solo lectura** `pg_proc` + `has_function_privilege`:

```text
funcion                      argumentos        usa_security_definer   anon_puede_ejecutar   jugador_puede_ejecutar
recalculate_league_standings p_league_id uuid   f                     t                     t
```

Interpretación precisa: la función es `SECURITY INVOKER` (no definer), y los roles `anon` y `authenticated` tienen `EXECUTE`. **No prueba ejecución exitosa por anon ni modificación:** faltan análisis del cuerpo, roles, RLS y ensayos. El catálogo y la QA ya prueban que `authenticated` puede efectuar INSERT/UPDATE/DELETE arbitrarios en `league_standings`; potencialmente puede activar un recálculo de una liga ajena. Siguiente paso: obtener `pg_get_functiondef` **solo en local** y revisar validación de autorización/algoritmo; diseñar RPC protegida y migrar escrituras del navegador antes de revocar permisos en producción. No ejecutar `SECURITY DEFINER` sin guardas internas o solo como cambio cosmético. **NO-GO**.


## Inspección de `recalculate_league_standings(uuid)`: sin autorización y recálculo destructivo — 4 nov 2026

El operador recuperó `pg_get_functiondef` en Supabase CLI local (solo lectura). Código observado:

- `LANGUAGE plpgsql`, `SECURITY INVOKER`, `search_path='pg_catalog','public','extensions'`, parámetro `p_league_id uuid`.
- Consulta `leagues.best_dates_to_count` sin `auth.uid()` ni verificación `is_super_admin()`/club.
- Ejecuta `DELETE FROM league_standings WHERE league_id=p_league_id` y `INSERT INTO league_standings (...) SELECT ... FROM tournament_results JOIN tournaments ... WHERE t.league_id=p_league_id`; después recalcula `rank_position`.
- Reconstituye `total_points` con suma de fechas TOP-N por `league_points_earned`, `tournaments_played`, mejor posición y número de mesas finales. El SQL no incluye `ccp_club`, `total_buy_ins_spent` ni `last_tournament_id`, por lo que esos valores se pierden por DELETE/INSERT.
- Concedido `EXECUTE` a `anon` y `authenticated` según prueba de catálogo local. El alcance práctico anónimo sigue sin validarse; los INSERT/UPDATE/DELETE de `authenticated` a `league_standings` **ya fueron confirmados vulnerables en QA**.

**Cruce con frontend del PR #64**: `src/lib/api/leagues.ts` `forceRecalculateStandings()` llama a la RPC y después restaura parcialmente `ccp_club` y `total_buy_ins_spent` mediante múltiples `UPDATE` a `league_standings` **desde el navegador** (`lines ~132–185`). Los campos no forman parte de una sola transacción; cualquier error/concurrencia puede dejar resultados incompletos. Peor, la lectura para esa reparación filtra `tournament_results.ccp_club IS NOT NULL`, así que algunas reentradas sin club CCP pueden quedar fuera de los conteos. `last_tournament_id` no se restaura ahí. `src/lib/api/tournaments.ts` `applyLeaguePoints()` también hace INSERT/UPDATE directo en `league_standings`.

**Modelo multi-club**: el frontend clona relaciones `league_clubs(club_id,is_primary)` y `league_rooms(room_id)`, de modo que **no se debe asumir que `leagues` contiene un `club_id` único**. La autorización del futuro motor tendrá que mapear exactamente administrador de liga principal, superadmin y/o administradores de clubes participantes de acuerdo a reglas verificadas; nunca derivarla solo del parámetro de cliente.

**Plan de corrección (no aplicado):** prueba sintética local de invocación por usuario sin clubes, comprobar que una función autorizada lo rechaza; generar nueva versión segura con firma apropiada, permisos `REVOKE EXECUTE FROM PUBLIC,anon`, validación de club autorizante, `search_path` endurecido y recálculo íntegramente transaccional incluyendo campos complementarios y consistencia de `league_standings`. Revisar preservación de fórmula, claves y bloqueos concurrentes. NO limitarse a revocar DML antes de sustituir `applyLeaguePoints()` y reparación posterior de `forceRecalculateStandings()`, porque se romperían rankings actuales. **NO-GO**.


## Explotación confirmada: invocación no autorizada de recálculo destruye clasificación ajena (4 nov 2026)

El propietario ejecutó en Supabase CLI local un ensayo SQL con `BEGIN`, dos cuentas Auth `@example.test`, una liga, una ficha de jugador y una fila en `league_standings` (sin resultados de torneos), seguido por `SET LOCAL ROLE authenticated` con `request.jwt.claim.sub` de usuario normal sin administrar clubes. Invocó `public.recalculate_league_standings(league_id)`.

**Salida real:**
```text
NOTICE: PASS: liga ficticia preparada sin administrador
NOTICE: ALERTA: usuario normal ejecuto RPC y elimino posicion ficticia
ROLLBACK
```

**Conclusión:** no solo hay INSERT/UPDATE/DELETE directos sobre `league_standings`; el usuario sin club puede invocar el RPC invoker sin guardias y causar un recálculo destructivo de una liga ajena. La función borró una fila sintética porque no había resultados de torneos (comportamiento normal del algoritmo con ese conjunto de datos), pero ese recálculo debió ser denegado por autorización. La prueba terminó en `ROLLBACK`, no modificó producción.

**Quinta superficie de integridad confirmada.** Corrección coordinada requerida: restringir `EXECUTE` del RPC actual, quitar DML arbitrario de `league_standings`, y sustituir por recálculo transaccional con validación de asociación `league_clubs`/administración, preservación de datos CCP/buy-ins y compatibilidad con carga/edición/reversión. No hacer revocaciones aisladas en producción. **NO-GO**.


## Kit QA preparado: recálculo protegido por asociación club–liga (4 nov 2026)

Se creó localmente `SHARKANIA_QA_recalculo_ligas_autorizado_local_v1.zip` con un `.sh` y README para **Supabase local exclusivo**. Se verificó `bash -n` y la integridad del ZIP; **el SQL todavía no se ha ejecutado contra el contenedor del operador**.

El script hace preflight estricto (loopback, nombre del contenedor, 64 tablas, 2 usuarios `@example.test` confirmados, 0 administradores), crea dentro de **BEGIN...ROLLBACK** un prototipo `recalculate_league_standings_guarded_qa(uuid)` `SECURITY DEFINER` `search_path=''`, exige `auth.uid()`, requiere administración de **al menos un club asociado por `league_clubs`** (o superadmin), y llama la función legada con bloqueo advisory de liga. En la misma transacción revoca acceso anónimo, `EXECUTE` directo de función legada y escrituras directas INSERT/UPDATE/DELETE en `league_standings`. Con dos usuarios QA y dos clubes/ligas ficticios comprueba denegación de usuario normal, denegación de admin ajeno, autorización legítima de cada admin, denegación de viejo RPC y DML, restaura todo con `ROLLBACK` y confirma recuentos/grants de vuelta.

**ALCANCE LIMITADO: sólo ensayo de autorización**. El wrapper de QA NO resuelve el defecto de `DELETE/INSERT` destruyendo campos complementarios ni transacción de cargas/ediciones reales. NO desplegar el wrapper ni sustituir la función actual todavía. Antes de producción se deberá decidir explícitamente si **cualquier admin de club participante** puede recalcular toda liga compartida, o solo la entidad coordinadora (ver `is_primary`), y asegurar commit atómico de resultados + ELO + standings + datos financieros. **NO-GO**.


## QA local PASS: recálculo de ligas con autorización de clubes — 4 nov 2026

Operador ejecutó `SHARKANIA_QA_recalculo_ligas_autorizado_local_v1.sh` en `supabase_db_sharkania-qa`. Evidencia textual:
```text
PASS: contenedor, puertos locales y cuentas QA comprobados.
PASS: dos clubes y dos ligas sinteticas; solo admin A habilitado
PASS: ruta antigua y escrituras directas revocadas; anon sin nueva RPC
PASS: usuario normal sin club rechazado
PASS: RPC antigua cerrada a usuario autenticado
PASS: UPDATE directo bloqueado
PASS: admin A recalculo su liga A
PASS: admin A rechazado al recalcular liga B ajena
PASS: admin B no puede recalcular liga A ajena
PASS: admin B recalculo liga B asociada a su club
ROLLBACK
PASS FINAL: autorizacion de recalc y prohibicion de escrituras arbitrarias probadas en local; nada persistente.
```

Este ensayo instala temporalmente wrapper `recalculate_league_standings_guarded_qa(uuid)`, rechaza a no administradores y a clubs ajenos en las fixtures, revoca EXECUTE de la RPC legacy y DML directo sobre standings; restaura todo con `ROLLBACK`. **Solo valida autorización y revocaciones**, no corrige pérdida de datos CCP/buy-ins/last_tournament, ni autoriza su uso en producción. La lógica permisiva de acceso para un admin de CUALQUIER club asociado (vs. solo primaria) necesita decisión de negocio. El código existente `forceRecalculateStandings` recompone datos en el cliente con múltiples UPDATE fuera de transacción y `applyLeaguePoints` también escribe directo; ambas rutas requieren corte conjunto.

**Siguiente gate:** reproducir con liga sintética con resultados reales, probar que el recálculo legado borra metadata complementaria, después diseñar y ensayar el recálculo protegido íntegramente atómico que reconstituye CCP y todas las reentradas. **NO-GO**.


## Kit preparado: QA transaccional de metadata de ligas (4 nov 2026)

Se creó `SHARKANIA_QA_ligas_metadata_transaccional_local_v1.zip` para el Supabase local del operador. ZIP validado, `bash -n` aprobado, **sin ejecución SQL todavía**.

Prueba propuesta: dos torneos/fechas y dos jugadores ficticios con puntos 200/130, 2 participaciones cada uno, CCP original y 5/3 buy-ins. Antes de aplicar el prototipo, ejecuta una sola vez la `recalculate_league_standings` legada **dentro de BEGIN...ROLLBACK** y verifica la pérdida de los tres metadatos (`ccp_club`, `total_buy_ins_spent` y `last_tournament_id`). Después crea una wrapper temporal `recalculate_league_standings_metadata_guarded_qa(uuid)` SECURITY DEFINER con `search_path=''`, validación de `auth.uid()` y club asociado, advisory lock, y llamada al algoritmo de puntos legada, **reconstituyendo dentro de la misma transacción** CCP histórico primero no nulo, suma de todas las `buy_ins_count` y última fecha por `start_datetime` de resultados. Simula revocaciones de EXECUTE legada y INSERT/UPDATE/DELETE directo; exige denegación de usuario sin club, autorización del admin, metadata consistente en ejecución y repetición idempotente. ROLLBACK y verificación de restauración final.

**No es migración de producción, ni cubre carga/edición/reversión de resultados**, y hay decisiones por aprobar: regla de autorización de ligas compartidas y `total_buy_ins_spent` se usa actualmente como número de reentradas, NO gasto monetario. La función QA demuestra viabilidad y riesgos de semántica, sin publicar. Estado **NO-GO**.


## QA local PASS: integridad transaccional de metadatos de ligas (4 nov 2026)

Operador ejecutó `SHARKANIA_QA_ligas_metadata_transaccional_local_v1.sh` en el contenedor `supabase_db_sharkania-qa`. Evidencia textual íntegra de los controles principales:

```text
PASS: Docker local, 64 tablas, dos usuarios QA y funcion de recalc disponibles.
PASS: dos fechas, dos jugadores, buy-ins 5/3 y clubes CCP ficticios preparados
CONFIRMADO: recalculo antiguo pierde CCP, buy-ins y ultimo torneo aun con resultados validos
PASS: EXECUTE antiguo y escrituras directas bloqueados; anon sin RPC nueva
PASS: usuario normal no administra liga
PASS: admin recalcula total_points 200/130, CCP, buy-ins 5/3 y ultimo torneo, en una transaccion
PASS: segundo recalc no duplica ni pierde datos (idempotencia)
PASS: UPDATE directo denegado incluso a club admin
ROLLBACK
PASS FINAL: perdida legacy demostrada y prototipo de recalc con CCP/buy-ins/ultimo torneo verificado; ROLLBACK completo.
```

**Gate de integridad aprobado en QA local**: reprodujo pérdida destructiva de metadatos con función legacy **incluso con resultados de torneo válidos**; wrapper provisional autorizada por club asociado reconstruyó metadata dentro de la misma transacción, preservó puntos y fue idempotente con dos ejecuciones. Rechazó usuario sin club y UPDATE directo. `ROLLBACK` revirtió todos los cambios. **No significa que la función provisional esté desplegada o apta para producción**: falta probar formalmente concurrentes, seguridad de ligas multiclub, reglas de propietario de CCP, diferencias buy-ins vs gasto monetario, reentradas y extremo a extremo de carga/edición/reversión con ELO.

**Siguiente gate de publicación:** flujo protegido y atómico de resultados `tournament_results` + ELO `players`/`elo_history` + `league_standings` con permisos adecuados de administrador del club; ensayar re-subida, re-edición, reversión y consecuencias de torneos posteriores, además de escenarios de fallos. Mantener bandera del ELO nuevo apagada y PR sin fusionar; **NO-GO**.


## Preparada QA de blindaje de columnas ELO en `tournament_results` — 4 nov 2026

Tras PASS en conservación transaccional de liga, siguiente componente priorizado: `public.tournament_results` sigue concediendo INSERT/UPDATE completos a `authenticated` y los admins de club pueden operar resultados de sus torneos (policy bien acotada a ownership). Esto permite por estructura enviar `elo_before`, `elo_after`, `elo_change` desde cliente al guardar resultados, aunque su cálculo debe pertenecer solo al motor ELO servidor. **Hallazgo todavía PENDIENTE de reproducción local y NO contado como sexta vulnerabilidad confirmada.**

Se preparó `SHARKANIA_QA_resultados_campos_ELO_local_v1.zip` (`.sh` + README), se verificó `bash -n` y estructura ZIP; SQL **aún sin ejecutar**. El script hace preflight Docker loopback, 64 tablas, dos identidades sintéticas confirmadas, cero admins, verifica grants originales. En `BEGIN...` crea club, torneo, tres jugadores, admin y resultado ficticios, comprueba si admin puede forjar ELO vía UPDATE e INSERT; simula `REVOKE INSERT, UPDATE` de tabla y `GRANT` por columnas de resultados legítimos excluyendo ELO, comprueba rechazo de escrituras ELO, permanencia de INSERT y UPDATE de premio autorizado, denegación de usuario no admin, concluye `ROLLBACK` con verificación de recuentos/grants. **No apto como migración de producción**: las operaciones de admin actuales y ELO legacy requieren un corte coordinado.

El paso posterior será construir/ensayar RPC de guardado transaccional de resultados, ELO y posiciones que no dependa de múltiples escrituras del navegador, incorpore edit/reversión y manejo seguro de torneos posteriores; mantener `VITE_ELO_GUARDED_RPC=false` y PR #64 draft hasta gate integral. **NO-GO**.


## QA local PASS: bloqueo de columnas ELO dentro de `tournament_results` — 4 nov 2026

El operador ejecutó `SHARKANIA_QA_resultados_campos_ELO_local_v1.sh` contra Supabase local con 64 tablas, dos cuentas QA y permisos originales, un club, un torneo, tres jugadores y admin sintéticos. Salida textual:

```text
PASS: contenedor local, 64 tablas, dos cuentas ficticias y permisos originales verificados.
PASS: un club, un torneo, tres jugadores y un admin sinteticos creados
CONFIRMADO: admin podia falsificar los campos ELO del resultado por UPDATE e INSERT directos
PASS: ELO pasa a exclusivo del servidor; columnas de resultados permitidas al admin
PASS: UPDATE de elo_after denegado
PASS: INSERT con elo_change denegado
PASS: admin conserva INSERT resultado y UPDATE premio de su propio torneo
PASS: usuario sin club no edita resultados ajenos
ROLLBACK
PASS FINAL: escritura ELO bloqueada por columnas en QA, resultados legitimos conservados; ROLLBACK completo.
```

**Sexta superficie de integridad confirmada en QA**: incluso admin autorizado de club podía alterar arbitrariamente `elo_before`, `elo_after`, `elo_change` mediante `INSERT/UPDATE` completos a `public.tournament_results`. La simulación de `REVOKE` de tabla y `GRANT` por columnas bloquea esos campos, conserva operaciones legítimas y políticas de pertenencia. Todo dentro de transacción `ROLLBACK`, sin modificación de producción. No desplegar permisos restringidos aisladamente, pues cálculo legacy desde cliente necesita escribir ELO en `tournament_results`.

**Estado release:** permisos/fórmula ELO, alta de players, edición simple, recálculo de standings y metadatos todos ensayados por separado; **no existe todavía un flujo transaccional único publicado**. El frontend `src/components/admin/results-upload.tsx` y `results-editor.tsx` realizan muchas escrituras separadas (crean players, reset, borran/insertan tournament_results, aplican liga, calculan ELO) y el modo `GUARDED_ELO_RPC_ENABLED` bloquea esas rutas deliberadamente. Primero revisar la función legacy `reset_tournament_impact(uuid)` y `reverseElo` para identificar semántica y dependencias históricas; diseñar RPC atómica de publicación y RPC de re-edición/reversión con protección a torneos posteriores, recalcular ELO/standings bajo mismas cerraduras y sin fallback a cliente. **NO-GO, PR permanece draft.**


## Auditoría de `reset_tournament_impact(uuid)`: riesgos de reversión — 4 nov 2026

El operador facilitó la definición SQL íntegra recuperada mediante `pg_get_functiondef` de su **Supabase local**. La función es `SECURITY DEFINER`, `SET search_path TO 'public','extensions'` y **sí valida autorización**: `is_super_admin() OR is_club_admin(tournaments.club_id)` para el torneo objetivo. No confundir este control existente con los RPC de liga sin autorización previamente demostrados.

**Riesgos del cuerpo SQL identificado (pendientes de reproducción):**

1. Borra `elo_history` y `tournament_results` del torneo, luego recalcula columnas de `players` desde los resultados restantes, sin bloquear ni verificar existencia de ELO de otros torneos cronológicamente posteriores. El preflight en `src/lib/api/tournaments.ts` **bloquea desde el cliente** una re-edición si detecta historiales posteriores, pero esa barrera no existe dentro del RPC: una invocación directa por un admin autorizado la omite. Por tanto, el RPC puede conservar deltas ELO posteriores basados en ratings previos que ya cambiaron.
2. Reconstruye ELO como `1200 + SUM(elo_history.elo_change)` y el peak recorriendo `ORDER BY id ASC`; el campo `elo_history.id` es UUID con `DEFAULT gen_random_uuid()`, por lo que dicho orden no es cronológico; `elo_peak` puede ser incorrecto.
3. Los buy-ins se reconstruyen como `SUM(t.buy_in)` por fila de resultados, ignorando `tr.buy_ins_count`; se infravalora el gasto/entradas de torneos con reentradas. Falta además regla explícita de monedas.
4. No recalcula `league_standings`, `profiles.unified_elo` ni repara automáticamente los derivados tras borrado de resultados.
5. Por comentario explícito, evita modificar `tournaments.results_uploaded` y deja `status` sin cambiar. Puede quedar `results_uploaded=true` con los resultados borrados; la RPC ELO protegida propuesta considera `results_uploaded=true` como `already_processed`, lo que bloquearía la reconstrucción de un torneo parcial.
6. La función RPC **sí es atómica para sus propios DELETE/UPDATE dentro de una invocación**. El riesgo de resultados parcialmente guardados está en el **flujo frontend repartido entre múltiples requests**: `results-editor.tsx` llama reset, después realiza DELETE/INSERT, `calculateElo`, `applyLeaguePoints` y recalc; `results-upload.tsx` hace una secuencia similar. Una llamada posterior fallida no revierte las solicitudes anteriores.
7. `SECURITY DEFINER` con `search_path` no vacío (`public, extensions`) requiere revisión de seguridad de objetos y privilegios. Una nueva RPC debe endurecerlo y controlar `EXECUTE`.

**Kit de reproducción creado, no ejecutado:** `SHARKANIA_QA_reversion_torneo_legacy_integridad_local_v1.zip` (`.sh` + README), chequeado por `bash -n` e integridad ZIP. Con dos usuarios ficticios, club/ligas y tres torneos ficticios, la fecha intermedia es objetivo; el script ensaya RPC legacy como admin autorizado con resultados e historial posterior, UUID ordenados al revés, reentradas y standings. Espera demostrar estado `results_uploaded=true` sin resultados, subcuenta de buy-ins, peak ELO por orden UUID, no replay de ELO posterior y puntos de liga desactualizados. Toda prueba es `BEGIN...ROLLBACK`, preflight local estricto, **pendiente de ejecutar**.

**Siguiente diseño:** reemplazar `reset_tournament_impact` y `reverseElo` solo dentro del cutover de publicación/reedición de resultados de servidor; asegurar transacción, control de ligas multi-club, ELO posterior (rechazar explícitamente o replay total validado), periodo y currency y efectos secundarios antes de activar `VITE_ELO_GUARDED_RPC`. No cambiar producción, mantener PR draft **NO-GO**.


## QA local: cinco anomalías de reversión legacy reproducidas — 4 nov 2026

El operador ejecutó `SHARKANIA_QA_reversion_torneo_legacy_integridad_local_v1.sh` sobre el contenedor Supabase QA (dos usuarios `@example.test`, 64 tablas, 0 `club_admins` iniciales), creó 3 torneos sintéticos con resultados e historia ELO posterior y llamó la RPC legacy `reset_tournament_impact(uuid)` como administrador autorizado. La prueba confirmó:

```text
PASS: tres torneos sinteticos (uno intermedio), resultados, ELO y standings preparados
CONFIRMADO: se borran resultados pero results_uploaded continua true
CONFIRMADO: buy-in total tras reset = 40.00 (correcto por 2+3 entradas a 20: 100)
CONFIRMADO: ORDER BY elo_history.id (UUID) produce peak 1200.00 aunque fecha anterior alcanzo 1300
CONFIRMADO: torneo posterior conserva elo_before=1320 tras borrar el intermedio; no hubo replay ELO
CONFIRMADO: liga conserva 300 puntos pese a eliminar 150 del torneo intermedio
ROLLBACK
PASS FINAL: anomalías legacy reproducidas solo en transaccion local; ningun cambio persistente.
```

**Conclusión:** la llamada a la función SQL existente es atómica por sí misma, pero sus operaciones dejan estado de negocio inconsistente si se revierte un torneo intermedio. En particular, no limpia `results_uploaded` ni recompone ELO posterior, suma `t.buy_in` en vez de `buy_in * tr.buy_ins_count`, calcula `elo_peak` recorriendo UUID en lugar de línea temporal y no actualiza standings. El frontend `prepareTournamentForReedit` contiene un preflight de ELO posterior (hasta 1.000 filas por consulta) pero está fuera de la RPC y puede ser omitido al llamarla directamente. **Autorización club/superadmin sí está presente en RPC legacy**; el fallo no es que usuarios normales puedan ejecutarla con éxito.

**Ruta segura prioritaria:** bloquear dentro de la misma transacción del servidor re-edición/reversión de un torneo con ELO posterior de jugadores afectados hasta que exista replay cronológico integrado, sin confiar en preflight de frontend. Migrar todas las rutas de edición a una operación de servidor que haga atomically borrar/reemplazar resultados, recalcular métricas ELO/estadísticas, standings CCP y buy-ins, ELO unificado, estado del torneo y validaciones financieras, con locking/idempotencia/errores. No desplegar cambios de permisos solos.

**Nuevo kit preparado, pero AÚN NO ejecutado por operador:** `SHARKANIA_QA_guardia_reversion_cronologica_local_v1.zip` probado con `bash -n` e integridad ZIP. Crea temporalmente una función `assert_tournament_reedit_chronology_guarded_qa(uuid)` (solo verificación, no hace reset), simula revocar EXECUTE de ruta legacy, valida rechazo al no-admin, rechazo a admin sobre torneo intermedio con histórico posterior, permite SOLO inspección preliminar de último torneo, verifica no mutación de datos y restaura todo por `ROLLBACK`. No constituye solución total ni cubre concurrencia/currency/multiclub. **NO-GO**.


## QA local PASS: guardia de reversión cronológica en el servidor (4 nov 2026)

El operador ejecutó `SHARKANIA_QA_guardia_reversion_cronologica_local_v1.sh` con 64 tablas públicas, dos usuarios QA confirmados y cero administradores iniciales. Salida:

```text
PASS: Docker local, 64 tablas, dos cuentas ficticias, cero club admins y funciones esperadas.
PASS: fixtures sinteticas con historia ELO completa y torneo posterior
PASS: anon sin guardia y authenticated sin EXECUTE a reset legacy
PASS: usuario normal sin club rechazado desde servidor
PASS: admin LEGITIMO rechazado al intentar revertir torneo intermedio con ELO posterior
PASS: ultimo torneo cumple la guardia de cronologia (solo plan; NO se ejecuta reset)
PASS: rechazos no borraron resultados, historial, estado ni posiciones
ROLLBACK
PASS FINAL: guardia cronologica en servidor ensayada; ROLLBACK total; ninguna reversion ejecutada.
```

La función QA propuesta verifica Auth, pertenencia al club, estado processed, historia ELO completa y ausencia de partidas/historial posterior con bloqueos de filas. El preflight pasó para el último torneo de los dos jugadores, pero **no se hizo ninguna reversión real**. Todos los cambios temporales fueron revertidos. El cliente puede omitir su propio preflight; estos controles deben residir dentro de la transacción de la RPC protegida de edición o reversión.

## Preparado siguiente ensayo local: reversión atómica de ÚLTIMO torneo

Se generó en la conversación `SHARKANIA_QA_reversion_ultimo_torneo_atomica_local_v1.zip` (script Bash + README). Archivo verificado con `bash -n` y prueba de integridad ZIP; **SQL todavía NO ejecutado por operador**.

Características y límites: simula una RPC `reset_latest_tournament_atomic_guarded_qa(uuid)` con Auth y permisos de club; rechaza históricos posteriores; solo fixtures USD, usuarios sin profile_id vinculado, sin ligas compartidas; ejecuta en una única transacción borrado de historia y resultados del último torneo, marca `results_uploaded=false`/estado programado, recompone ELO rating/peak por historia temporal, premios y buy-ins por número real de entradas, y recalc de liga con CCP/reentradas/último torneo. Valida usuario no admin rechazado, admin rechazado en torneo intermedio, éxito en último, segundo intento rechazado, preservación de otros torneos. Finaliza en `ROLLBACK`, restaura funciones y grants. **Es un prototipo QA, no migración ni solución completa**: faltan perfiles con ELO unificado, otros currencies, reglas de ligas multiclub, edición/republicación de resultados completa, fallas concurrentes y pruebas de frontend/PostgREST. Cualquier fallo de QA debe examinarse antes de ampliar alcance. PR sigue draft, **NO-GO**, nada en producción.


## QA local PASS: reversión atómica de último torneo — 4 nov 2026

El operador ejecutó `SHARKANIA_QA_reversion_ultimo_torneo_atomica_local_v1.sh` en Supabase CLI local, con dos usuarios ficticios, un club, tres fechas y dos jugadores sin perfiles vinculados. Salida:

```text
PASS: contenedor aislado, estructura y dos cuentas QA verificadas.
PASS: tres fechas sinteticas, historia completa y 2 jugadores sin perfil vinculado
PASS: usuario sin club no puede revertir
PASS: admin no puede revertir torneo con ELO posterior
PASS: rechazo cronologico mantiene torneo intermedio intacto
PASS: ultimo torneo revertido atomica y coherentemente; ELO 1320/1170, buy-ins 100/40, liga 230/30
PASS: CCP, reentradas, ultimo torneo e indicadores results_uploaded/status coherentes
PASS: segundo reset denegado sin doble descuento
PASS: el historial ELO de otros torneos permanece intacto
ROLLBACK
PASS FINAL: reversión atomica de ultimo torneo probada SOLO en QA; ROLLBACK restaura el entorno.
```

Esta prueba valida un prototipo de **reset total** del último torneo, no su edición ni republicación. El RPC provisional no está instalado en producción; todas las operaciones QA fueron revertidas.

**Nuevo prototipo preparado y AÚN NO probado contra Supabase CLI:** archivo generado `SHARKANIA_QA_republicacion_ultimo_torneo_atomica_local_v1.zip` con Bash y README. Se verificó sintaxis `bash -n` e integridad ZIP. Incluye el reset QA ya probado, importa `calculate_tournament_elo_guarded` desde commit GitHub FIJO `b059bf388a2088a3c2a2807e3262e27454e4089e` con validación de hash Git y ensaya una `republish_latest_tournament_guarded_qa(uuid,jsonb)` transaccional. QA: solo dos jugadores existentes, USD, sin perfiles vinculados, liga simple; rechaza rol extraño, torneo intermedio e intentos cliente de escribir ELO; simula error después del reset para comprobar reversión de toda la llamada; publica nuevos resultados, recalcula ELO y standings CCP/buy-ins y comprueba repetición sin doble acumulación. Ejecuta todo bajo `BEGIN...ROLLBACK`. **Pendiente de ejecución y corrección según resultados reales de PostgreSQL.** No migración de producción, no activa feature flags, no resuelve clubes múltiples, monedas distintas, nuevos jugadores, perfiles enlazados ni pruebas concurrentes.

**Release sigue NO-GO**. Se requiere después validar flujo completo por UI/PostgREST, historial/ELO unificado, multiclub/multimoneda, locking concurrente y procedimiento de corte con rollback/backup antes de autorizar PR.
