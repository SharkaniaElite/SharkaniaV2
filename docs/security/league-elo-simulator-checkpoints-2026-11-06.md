# SHARKANIA · Simulador histórico ELO de solo lectura

**Fecha: 6 noviembre 2026.** Fase de investigación y QA del PR #65. **NO es una migración, no escribe datos y no habilita edición/eliminación de torneos de producción.**

## Evidencia agregada comprobada con SQL SELECT

- La auditoría anterior encontró **3.486** transiciones ELO discontinuas de **19.021** pares consecutivos comparables.
- Análisis adicional: afectan a **605 jugadores** y **112 torneos** (IDs no publicados). Hay **22** saltos de hasta 0,10 puntos, **175** de más de 0,10 hasta 1, **1.276** de más de 1 hasta 10 y **2.013** de más de 10 hasta 100. Diferencia absoluta media **14,52**; máxima **99,31**.
- Las magnitudes descartan atribuir todos los saltos simplemente al redondeo. **La causa específica aún no se demostró.** No se corrigieron datos, no se cambió el orden histórico y no se asignaron ELO nuevos.
- Los eventos de publicación no equivalen necesariamente a la fecha programada de cada torneo. En el estudio anterior se identificaron **72 inversiones de fecha** en el orden histórico de carga.

## Foco de investigación de noviembre — confirmado por SQL SELECT

Se compararon las discontinuidades por mes y día sin acceder a identificadores personales:

- Octubre: **0 saltos / 2.934** enlaces ELO comparables.
- Noviembre (hasta 6 nov): **165 saltos / 606** enlaces comparables. Los días 2, 4 y 5 de noviembre no tenían saltos; **los 165 ocurrieron el 6 de noviembre**, en solo dos torneos.
- Los dos torneos son `22K LIGA CCP NOVIEMBRE 2026 - FECHA 2 - 1M GTD` (prefijo de torneo `05a8c00a`, **78** saltos entre 100 historias comparables, 111 resultados) y `22K LIGA CCP NOVIEMBRE 2026 - FECHA 1 - 1M GTD` (prefijo `03470545`, **87** saltos entre 129 historias comparables, 133 resultados).
- **Orden efectivo de grabación ELO: Fecha 2 a las 11:29:44 UTC y Fecha 1 a las 11:30:43 UTC del 6 nov**, pese a que la Fecha 1 estaba programada antes que la Fecha 2. Es una inversión cronológica comprobada.
- Los 165 saltos corresponden a la misma sala que el registro anterior del jugador; 87 también pertenecen a la misma liga y figuran en el torneo programado antes de su evento ELO anterior. **Ninguno de los 165 es un reinicio exacto del ELO anterior o nuevo a 1200**, en la muestra.
- Los otros dos torneos del 6 nov, `Liga Clausura PokerAustral` y `MSOP Noviembre`, no mostraron discontinuidades ELO. **No hay evidencia suficiente** para atribuir el problema a CLP, al motor ELO, a una importación o a una carrera de escritura específicos. No se cambió ningún resultado.

**Control de correspondencia adicional, también SELECT-only:**

- Las **244** filas de `elo_history` de ambos torneos tienen una fila de `tournament_results` asociada y **0 diferencias** en `elo_before`, `elo_after` y `elo_change` entre ambas tablas.
- Para los **157 nicknames distintos** de esos dos torneos, todos conservan una fila de `players` y el `players.elo_rating` actual coincide con el **último `elo_history.elo_after`** de su historial; **0 diferencias** superiores a 0,011 en ese control.
- **Interpretación limitada:** existe coherencia entre tablas del evento y del ELO materializado actual, pero todavía se detectan 165 discontinuidades entre eventos consecutivos. No declarar el histórico global íntegro ni alterar el historial a partir de esta coincidencia.

**Hipótesis pendiente de verificar:** la publicación masiva/invertida de fechas de CCP y la falta de transacciones coordinadas podrían influir, pero NO son explicación demostrada de los saltos. Hay que correlacionar los logs del uploader y el estado previo de `players.elo_rating`, cuando exista evidencia fiable, antes de corregir nada.

## Nuevo módulo QA

`src/lib/elo-replay-simulator.ts` exporta `simulateHistoricalEloScenario(...)`, simulador **puro**, sin API ni operaciones SQL. Recibe:

1. Un `ReplayPlan` ya validado por `planHistoricalEloReplay`. Si hay historial ambiguo, filas ELO faltantes o discontinuidades, **rechaza el cálculo**.
2. Los eventos afectados en el mismo orden revisado por el plan y sus resultados originales.
3. Un **checkpoint explícito por jugador**, inmediatamente ANTES de su primera participación en la clausura de torneos afectados. Incluye ELO, pico ELO, torneos anteriores, ITM, victorias, premios y buy-ins históricos. No se infiere un ELO inicial de 1200.
4. Una operación hipotética: `unchanged` para comparar paridad contra `elo_history`, `edit` para reordenar posiciones/premios con **los mismos jugadores**, o `delete` para omitir el torneo objetivo. Cambiar los IDs de participantes exige reconstruir el análisis de impacto.

El simulador reproduce las fórmulas de `src/lib/api/elo-engine.ts`: promedio ELO del field y rivales, resultado normalizado según posición, factor K antes/después de 30 torneos, ponderación del buy-in y del número de participantes, mínimo ELO 100, redondeo JavaScript a dos decimales, ELO pico, participación, ITM, victorias y premios. Conserva el comportamiento heredado de **un buy-in por torneo**, sin interpretar automáticamente reentradas. Solo acepta USD normalizado y no propone conversiones.

**Salida:** valores hipotéticos por torneo/jugador, proyecciones agregadas por jugador, diferencias contra `elo_history` en el caso sin cambios y alertas; devuelve siempre `safeToApply:false` y `readonlyOnly:true`.

## Límites explícitos

- Un checkpoint suministrado por el llamador puede estar equivocado; el módulo comprueba estructura y coherencia, **no su procedencia externa**. La aprobación de líneas base debe hacerse por revisión auditada independiente.
- El resultado no calcula ELO unificado de perfiles con varios aliases, la puntuación CCP, posiciones de liga, monedas distintas de USD ni nuevos jugadores. No puede escribir ni autorizar un cambio en esas entidades.
- Tampoco resuelve qué registros antiguos son fuente de verdad cuando el historial ELO se interrumpe. Un `ReplayPlan` bloqueado debe conservarse bloqueado.
- Un torneo puede propagar cambios a rivales de otras salas, clubes y ligas. No basta reconstruir el torneo objetivo ni solo los torneos de su club.
- El cálculo no debe ejecutarse como una transacción larga contra Supabase Micro sin un análisis de costo, concurrencia, control de versiones de eventos, lock ordering, puntos de control y recuperación.

## QA automatizado

`tests/elo-replay-simulator.test.mjs` comprueba:
- Repetición del ELO heredado con snapshot original y detección de divergencias contra valores almacenados.
- Cambio de una posición en un torneo y propagación transitiva de efectos sobre rivales posteriores.
- Eliminación hipotética que revierte la participación del objetivo y reconstruye los eventos sucesivos.
- Umbral K de 30 torneos y suelo ELO 100 sin falsificar el delta bruto.
- Rechazo de línea base incompleta, nuevas identidades no previstas, posiciones repetidas, secuencia errónea, historial bloqueado o moneda CLP no normalizada.
- Determinismo, inmutabilidad de datos de entrada y ausencia de llamadas a Supabase/archivos de escritura.

`.github/workflows/qa-league-security-release.yml` ejecuta las pruebas junto con el preflight y el resto de QA existente.

## Siguiente trabajo para permitir edición/eliminación en producción

Diseñar una bitácora de publicaciones versionada y líneas base verificables. Investigar las diferencias ELO por categorías y periodos antes de elegir política de conciliación. Añadir paridad histórica de ELO unificado, estadísticas y rankings con fixtures reales **anonimizados** y aprobados; probar volumen de 20.821 eventos de forma aislada y estrictamente read-only; después construir RPC autorizada con aislamiento/rollback y revocación simultánea de escritores heredados.

**NO GO para despliegue.** No se fusiona PR #65, no se modifica Supabase, no se activa `VITE_LEAGUE_GUARDED_RPC`. El PR #76 de resiliencia de Auth sigue independiente.
