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
