# SHARKANIA — Compatibilidad de resultados de ligas y monedas (preflight de corte)

**9 de noviembre de 2026 — Estado: QA, sin migración ni cambios de producción.**
Este documento acompaña el [PR #87](https://github.com/SharkaniaElite/SharkaniaV2/pull/87), apilado exclusivamente sobre el backend QA [PR #86](https://github.com/SharkaniaElite/SharkaniaV2/pull/86). Ninguno está autorizado para migración productiva.

## Inventario real, consulta SELECT agregada

| Moneda | Torneos asociados a ligas | Con resultados publicados | Pendientes de resultados |
|---|---:|---:|---:|
| CLP | 186 | 159 | 27 |
| EUR | 81 | 74 | 7 |
| USD | 28 | 25 | 3 |
| **Total** | **295** | **258** | **37** |

Los **37 torneos pendientes** pertenecen a ligas donde la consulta actual no detectó posiciones sin resultados de origen. Esto NO los habilita automáticamente: falta identificar jugadores, comprobar torneos posteriores, duplicados, calendarios y permisos de administración.

**Consecuencia:** el escritor QA del PR #87 acepta únicamente carga inicial USD y, por tanto, **no sustituye a los flujos de producción** de 34 de los 37 torneos pendientes. Mantener `VITE_LEAGUE_GUARDED_RPC` OFF.

## Fórmula real del ELO heredado y dilema multimoneda

La fuente actual `src/lib/api/elo-engine.ts` calcula:

- `kBase = total_tournaments < 30 ? 40 : 20`.
- `K = kBase × (1 + log10(Number(buy_in) + 1) × 0.1) × (1 + log10(N) × 0.15)`.
- **No consulta `tournaments.currency` antes de calcular K**. Por ello el mismo número nominal CLP/EUR/USD se trata igual, y dos importes económicamente equivalentes pero con distinto número nominal no producen necesariamente la misma variación ELO.
- En la lógica actual, `players.total_prize_won` y `players.total_buy_ins_spent` se incrementan con números sin una dimensión monetaria. No interpretar esos acumulados como totales comparables entre monedas hasta auditarlos.
- El motor actual incrementa `total_buy_ins_spent` en `buy_in` una sola vez por jugador, aunque `tournament_results.buy_ins_count` pueda superar 1. La modificación de esta regla también requiere decisión, paridad y recalculo controlado: no alterarla inadvertidamente durante el corte.

**Ejemplo técnico de K para tres participantes, kBase=40** (misma fórmula heredada): buy-in nominal 3,30 => **45,5779**; nominal 3.300 => **57,9446**. No son conversiones de moneda ni recomendaciones de equivalencia económica.

## Alternativas que requieren decisión comercial antes de publicar

1. **Compatibilidad estricta y versionada:** preservar el ELO calculado antes con su valor nominal, documentando `legacy-js-v1` y la divisa original; segregar el registro monetario por divisa. Conserva la continuidad numérica respecto del algoritmo antiguo, **no corrige** su falta de normalización.
2. **Nueva versión normalizada para publicaciones futuras:** diseñar una unidad y metodología explícita para el factor K, fecha y tipo de cambio o nivel competitivo que no dependa de montos nominales; usar una nueva versión del algoritmo con bitácora. No recalcular silenciosamente los resultados históricos.
3. **Replay histórico:** cualquier corrección de torneos publicados requiere reconstruir la clausura transitiva de torneos posteriores, demostrar checkpoints completos y resolver discontinuidades históricas. No asumir inicio ELO 1200 ni ordenar por UUID.

**Recomendación de ingeniería para QA:** mantener el histórico inmutable, validar un modo `legacy-js-v1` separado de una posible `v2` y registrar de forma inequívoca moneda, entradas, premios y versión de cálculo en una bitácora por publicación. **No habilitar escrituras multimoneda en producción hasta aceptar explícitamente una de las políticas.**

## Avance QA comprobable

El escritor original de carga inicial, aislado en esta rama y respaldado por un PostgreSQL 17 descartable:
- Inserta resultados, historial ELO, estadísticas, ELO unificado, clasificaciones y checkpoints **en una sola transacción** para USD.
- Rechaza CLP/EUR y jugadores no registrados antes de modificar resultados o perfiles, verificando snapshots completos y `ROLLBACK`.
- Bloquea `edit` y `delete` históricos con PT409, en lugar de simular una reconstrucción incompleta.
- Comprueba con fórmulas independientes del cliente JS casos de dos y tres jugadores, cambio K en 29/30 torneos, bounties, pico ELO, auditoría, doble publicación y errores inyectados.
- Ensaya 200 jugadores ficticios, sin deducir rendimiento de la instancia Supabase real.

### Condiciones concretas de salida

- [x] Clasificar cartera de torneos por moneda con lectura agregada.
- [x] Aislar SQL de publicación inicial y probar atomicidad en una base desechable.
- [x] Rechazo fail-closed USD/CLP/EUR/ID desconocido y regresión numérica 2-3 jugadores.
- [ ] Elegir política ELO y gastos por divisa, y probar paridad/consistencia para CLP y EUR (34 torneos pendientes).
- [ ] Resolver nicknames nuevos **dentro** de un escritor autorizado; el frontend heredado puede crearlos antes de comenzar la carga.
- [ ] Corregir/retirar resultados históricos mediante snapshots verificables y replay de eventos posteriores, sin destruir ELO o CCP.
- [ ] Integración real GoTrue/PostgREST, permisos/grants, concurrencia y cierre simultáneo de escritores legacy.
- [ ] Clon/backup restaurable, migración versionada, aprobación del propietario, activación controlada y rollback restrictivo.

**NO GO de producción.** Ninguna ejecución de los scripts `qa-only` sobre Supabase real está permitida.
