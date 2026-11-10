# SHARKANIA — Auditoría de continuidad ELO y plan de replay seguro
**Fecha:** 6 nov 2026. **Solo lectura y QA; NO migración ni cambios a producción.**

## Evidencia concreta de producción (consulta SELECT, agregada, sin datos personales)

En el proyecto Sharkania, revisado contra el esquema real:
- **20.821 filas** en \`public.elo_history\` y **20.821 filas** en \`public.tournament_results\`.
- **256 torneos distintos** con historial ELO y **256 con resultados**. Los totales coinciden globalmente; no prueban una correspondencia completa en cada torneo.
- Los **256 torneos** tienen distintos valores \`recorded_at\` entre sus jugadores; la hora de una publicación no es necesariamente un único timestamp.
- Los intervalos \`min(recorded_at)\`–\`max(recorded_at)\` de torneos distintos no se solapaban en esta muestra: **0 intervalos de publicación superpuestos**. Eso permite proponer un orden de publicación; no equivale a una bitácora transaccional fiable.
- **72 inversiones de fecha:** siguiendo el orden de primera escritura ELO, el siguiente torneo había sido programado para una fecha anterior a la del torneo publicado inmediatamente antes. Por ello \`start_datetime\` NO puede utilizarse como única secuencia de replay histórico.
- De **19.021 transiciones comparables** de historiales por jugador (ordenadas por \`recorded_at,id\`), **3.486** presentan una diferencia absoluta superior a 0,011 entre \`lag(elo_after)\` y \`elo_before\`. No se atribuye una causa sin pruebas: podrían coexistir recalculaciones parciales, ajustes manuales, otros escritores o datos históricos.
- **0 grupos duplicados de \`(tournament_id,player_id)\`** en \`elo_history\`. Los eventos no están íntegramente garantizados solo por este conteo.

Estas cifras pertenecen a un corte de observación, **no** a una migración; deben contrastarse nuevamente al planificar una publicación futura.

## Consecuencia lógica: la corrección afecta una red de jugadores

El motor ELO actual (\`src/lib/api/elo-engine.ts\`) calcula un \`avgOpp\` con la suma de ELO de TODOS los jugadores que participaron en un torneo, y el factor \`K\` usa el número de torneos previos del jugador. Si cambia un resultado pasado, cambia el ELO de sus jugadores. En el siguiente torneo en que participe uno de ellos, el promedio de rivales cambia el resultado de todo el grupo; cada adversario puede transmitir después ese cambio a otros torneos.

**Por eso no basta recalcular torneos del jugador editado o solo su liga.** Hay que reconstruir la clausura transitiva de torneos posteriores por orden de publicación, no solo fechas anunciadas.

## Código nuevo en el PR #65

\`src/lib/elo-replay-preflight.ts\` exporta \`planHistoricalEloReplay(targetTournamentId,tournaments)\`, una función **pura, sin red, archivos ni escrituras SQL**:

1. Valida nombres de torneo, fechas, playerIds de resultados y de Elo, y números finitos.
2. Ordena eventos por el menor \`recorded_at\` de sus filas y **rechaza ventanas solapadas o ambiguas**.
3. Detecta torneos publicados fuera del orden de sus fechas programadas (advertencia, no cambio automático).
4. Construye la **clausura transitiva de participantes y torneos** afectados a partir del torneo objetivo.
5. Comprueba la continuidad ELO \`elo_before\` contra \`elo_after\` previo para todos los jugadores de esa clausura; emite bloqueos explícitos ante diferencias, duplicados o historial faltante.
6. Devuelve torneos/jugadores potencialmente afectados, primeros valores ELO registrados, bloqueos y advertencias. \`historicalDataCandidate\` significa únicamente que pasan esos controles de calidad del *snapshot*; **NO significa que exista aprobación para escribir ni que los valores finales se puedan reconstruir con fidelidad**.

Las pruebas unitarias \`tests/elo-replay-preflight.test.mjs\` simulan cadenas propagadas de A→B→C→D, torneos ajenos, publicación fuera de orden, discontinuidades, falta de datos y empates de publicación. El módulo es el **primer componente**, no el motor que mutará historial.

## Lo que NO podemos inferir ni modificar automáticamente

- El ELO inicial del jugador y su estado previo de \`total_tournaments\` no están necesariamente certificados por el primer \`elo_before\` observado. Las estadísticas anteriores podrían incluir eventos ausentes o ajustes administrativos.
- Una diferencia histórica de Elo **no se debe corregir automáticamente** a partir de 1200. Requiere investigar su procedencia y decidir qué fuente prevalece.
- La antigua \`get_unified_elo_history(p_slug)\` agrupa alias y usa \`recorded_at\`; hay que reconstruir correctamente perfiles y preservar los materiales históricos, sin inventar un orden cuando haya empates.
- Las clasificaciones tienen **51 posiciones sin resultados de fuente** detectadas previamente. El sistema no debe borrarlas ni reescribir su CCP o reentradas.
- Todavía no existe un libro de publicaciones versionado para registrar el orden causal, la versión del cálculo, el identificador de operación, los metadatos del actor y snapshots de ELO/estadísticas anteriores.
- Publicar un replay dentro de un RPC largo en la instancia Micro podría volver a agotar recursos. Necesita estimaciones de alcance, límites, pruebas de carga en ambiente aislado y un protocolo de reintentos seguro, respaldos y control de concurrencia.

## Ruta de implementación restante

1. **Identificar fuente de las 3.486 transiciones ELO discontinuas**, de forma agrupada y priorizando anomalías en los eventos de un candidato de edición (no editar registros reales). Seleccionar una estrategia explícita de conciliación, con revisión humana para historias ambiguas.
2. Diseñar un **registro de publicaciones y línea base auditada** con número de secuencia, estado anterior, cálculo versionado y pares torneo/jugador. Todo nuevo torneo debe publicar y registrar orden de forma atómica.
3. Construir el **simulador determinista** que reproduzca K, rival promedio, suelo de ELO, picos, total jugado, premios, múltiples nicknames y varias ligas con la misma semántica que el motor actual; verificar paridad frente a escenarios conocidos y datos de sombra.
4. Modelar operación atómica de corregir/eliminar con autorización, identificación transitiva, bloqueo seguro y rollback completo; no exponer ninguna mutación mientras no exista una línea base fiable.
5. Ejecutar QA completo real GoTrue/PostgREST, concurrencia, carga, UI y restauración de backup/dueños/ACL, integrar divergencias con \`main\`, cerrar funciones heredadas vulnerables en migración coordinada, habilitar por fases solo tras aprobación expresa.

**Estado:** investigación de continuidad y planeador de impacto en DRAFT. El motor anterior sigue vigente en producción, y \`VITE_LEAGUE_GUARDED_RPC\` permanece apagado. **NO GO para editar/eliminar resultados históricos.**
