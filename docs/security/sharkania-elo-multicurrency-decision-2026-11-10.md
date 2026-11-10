# Decisión pendiente: ELO multimoneda y edición de resultados — Sharkania

**Estado: propuesta, NO aprobado. No se modifica algoritmo, calendario ni historial en producción.**

## Contexto verificado

El motor `legacy-js-v1` actual en `src/lib/api/elo-engine.ts` calcula:

`K = (total_tournaments < 30 ? 40 : 20) * (1 + log10(buy_in + 1)*0.1) * (1 + log10(número_jugadores)*0.15)`.

El `buy_in` se toma directamente de `tournaments.buy_in` sin normalización de moneda. Por tanto, usar el mismo número económico expresado en CLP, EUR o USD produce factores K diferentes. Las SQL candidatas de Release A preservan la fórmula existente para no reescribir la historia y **solo permiten primera publicación USD**.

A 10-11-2026, en producción hay 3 ligas USD pendientes, 27 ligas CLP, 7 ligas EUR y 1.009 torneos independientes CLP sin resultados; estos últimos son anteriores a esa fecha según su `start_datetime`. La continuidad ELO sigue siendo compartida por sala/jugador entre ligas e independientes.

**No activar globalmente la revocación de `players`/`elo_history`/`tournament_results` hasta ofrecer una ruta protegida para todas las monedas que se deseen admitir.** No se admiten conversiones implícitas ni asignación de una moneda falsa.

## Opciones de producto para el nuevo algoritmo a futuro

| Opción | Cómo funciona | Ventaja | Coste / riesgo |
|---|---|---|---|
| **A — ELO v2 neutral por moneda** (recomendada para evaluación) | Elimina del factor K la influencia del valor monetario nominal del buy-in, manteniendo rivales, puntuación y antigüedad del jugador. | Comparabilidad deportiva entre USD, CLP y EUR sin FX ni mezclar premios. | Cambia el peso del buy-in respecto de v1. Definir fecha exacta de vigencia y probar paridad/calibración. |
| **B — ELO v2 con buy-in convertido a unidad común** | Usa tasa fijada por fecha/regla oficial aprobada, registrada en ledger por evento. | Conserva la intención deportiva de premiar buy-ins mayores en una misma escala. | Depende de fuente/tasa, redondeo, fin de semana, histórica/retroactiva, registros de auditoría; mayor complejidad. |
| **C — continuar v1 con buy-in nominal sin conversión** | Conserva `log10(buy_in+1)` por moneda de origen. | Misma fórmula JS sin adaptación. | Diferencias matemáticas no comparables entre monedas y cambios de poder adquisitivo; no recomendado para una tabla global compartida. |

**Recomendación técnica pendiente de aprobación:** conservar **intactos** eventos y ELO `legacy-js-v1`, introducir `elo-v2` con reglas explícitas solo para publicaciones futuras, y guardar `algorithm_version`, divisa, buy-in original y entrada(s) real(es) por jugador. En la tabla de dinero, **solo agrupar por moneda** o por conversiones verificadas; nunca sumar CLP + USD + EUR en columnas genéricas. La opción A es una base deportiva más transparente cuando la plataforma busca comparabilidad internacional, pero la decisión es del propietario.

## Edición o borrado históricos

No hay replay aprobado. Las funciones heredadas `reset_tournament_impact` y `delete_tournament_god_mode` reconstruyen desde 1200 y podrían alterar jugadores compartidos de ligas posteriores. Hasta implementar corrección versionada y secuencial, el candidato `guard-published-history-against-legacy-2026-11-10.CANDIDATE.sql` impide ediciones/borrados de resultados ya registrados. Debe preservarse la posibilidad de borrar torneos **programados sin resultados**.

Diseño futuro sugerido, sujeto a decisión separada: registrar una propuesta de corrección, calcular el impacto sobre todos los torneos posteriores del jugador, simular valores antes/después, solicitar aprobación explícita, y confirmar un evento de compensación versionado/atómico conservando un rastro auditable, no editar la evidencia original.

## Decisiones explícitas necesarias para una futura autorización

1. ¿La tabla ELO común ponderará buy-ins o no? Si los pondera, ¿con qué tipo de cambio/origen/regla histórica?
2. ¿Desde qué fecha o evento comienza v2? El pasado v1 no se reescribe.
3. ¿Qué monedas estarán habilitadas para primera publicación y cuál es el tratamiento de las 34 ligas CLP/EUR pendientes y torneos CLP antiguos?
4. ¿Cuál es la política de edición histórica, quién la aprueba y cómo se registran correcciones sin destruir evidencias?

Hasta que haya decisión, la cobertura USD probada en QA **no es GO productivo**.

[PR #95 — Release A](https://github.com/SharkaniaElite/SharkaniaV2/pull/95) · [PR #96 — ELO protegido](https://github.com/SharkaniaElite/SharkaniaV2/pull/96).
