# SHARKANIA — Política ELO versionada y concurrencia, solo QA

**Fecha:** 9 de noviembre de 2026. **Estado: NO GO para producción.**
**Dependencias:** PR #86 (permisos), #87 (escritor inicial), #88 (nicknames + bitácora nativa).

## Decisiones que NO se han tomado

No existe aprobación de una nueva fórmula ELO ni de conversión monetaria.
La consulta de ELO de `main` sigue aplicando `K=K_base × (1+log10(buy_in+1)×0,1) × (1+log10(N)×0,15)` sin inspeccionar la moneda.
Por eso el mismo buy-in *numérico* produce el mismo cálculo incluso si cambia la divisa; números nominales distintos producen K distintos. El historial no se modifica.

## Dos versiones explícitas evaluadas

- **`legacy-js-v1`**: emula el algoritmo vigente (incluye multiplicador numérico del buy-in y cambio K de 40 a 20 después de 29 torneos). Sirve de referencia de paridad para escenarios históricos, **no** como mecanismo de replay de historiales incompletos.
- **`currency-neutral-v2-PROPOSAL`**: candidato que mantiene el resto del cálculo, incluido factor de cantidad de participantes, pero elimina solamente `(1+log10(buy_in+1)×0,1)`. La moneda se conserva en los asientos privados de finanzas, **pero el nominal no afecta ELO**. Esta fórmula es una **propuesta** y **no está publicada ni autorizada**.

Ejemplo ficticio, dos jugadores ELO 1200 / 1200, ganador con 0 torneos previos:

| Versión | Entrada nominal | ELO del ganador |
|---|---:|---:|
| `legacy-js-v1` | 3,30 | 1222,23 |
| `legacy-js-v1` | 3.300 | 1228,26 |
| `currency-neutral-v2-PROPOSAL` | 3,30 USD | 1220,90 |
| `currency-neutral-v2-PROPOSAL` | 12 EUR | 1220,90 |
| `currency-neutral-v2-PROPOSAL` | 3.300 CLP | 1220,90 |

La propuesta produciría cambios ELO diferentes incluso en torneos USD, por lo que **no se debe activar implícitamente ni mezclar dos versiones sin un corte y registro de fecha/versionado aprobado**. No convertimos divisas ni aplicamos una equivalencia de valor.

## Pruebas de QA incluidas

1. `sharkania_release_qa.quote_elo_policy_qa`: función `IMMUTABLE SECURITY INVOKER` exclusivamente de consulta; schema privado, EXECUTE revocado a `PUBLIC`, `anon` y `authenticated`; acepta solo dos versiones explícitas y los códigos `USD/EUR/CLP` conocidos, y marca v2 como `QA_PROPOSAL_NOT_ACTIVE`.
2. Compara fórmulas de JS y PostgreSQL para 2 y 3 jugadores, ELO anteriores 1000/1200/1400, 29/30/31 torneos, ganadores y perdedores. Rechaza versiones o monedas no conocidas.
3. Carrera concurrente: dos sesiones PostgreSQL simulando un `authenticated` con la misma identidad sintética intentan publicar **el mismo torneo**. Debe confirmar exactamente una, denegar la segunda sin duplicar jugador, resultado, asiento de moneda ni evento ELO.
4. Todos los datos ficticios viven en PostgreSQL 17 descartable en GitHub Actions. Las pruebas con rol PG autenticado **NO sustituyen** una prueba real de GoTrue/PostgREST o JWT.

## Bloqueos y siguiente decisión

- [ ] Solicitar aprobación de la política v2 (o una alternativa) antes de cualquier cambio al K y de cualquier publicación CLP/EUR. Historial ELO inmutable.
- [ ] Implementar versionado explícito del algoritmo en el escritor final y en su ledger antes de permitir publicaciones multimoneda, con pruebas integradas de 34 torneos CLP/EUR pendientes.
- [ ] Ampliar carreras a dos torneos diferentes que comparten jugador y sala, comprobando orden de lock y cronología; probar usuarios con GoTrue/PostgREST QA real.
- [ ] Reemplazar escritores heredados, diseñar edición/borrado mediante replay seguro y ejecutar prueba de backup/restauración.
- [ ] Aprobación independiente para migración y activación de funciones en producción.

**No aplicar el SQL de este documento al Supabase productivo.** El proyecto público mantiene el flag `VITE_LEAGUE_GUARDED_RPC` OFF.
