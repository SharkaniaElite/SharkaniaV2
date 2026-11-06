# SHARKANIA — Evidencia verificable ELO y bitácora futura (QA)

**6 de noviembre de 2026.** PR #65, rama de desarrollo. **NO MIGRACIÓN. NO GO PRODUCCIÓN.**

## Problema: continuidad numérica no es una fotografía completa

La base pública actual contiene `elo_history` con `elo_before`, `elo_after`, `elo_change` y `recorded_at`, mientras `players` conserva los acumulados **actuales**. No hay evidencia identificada de una tabla independiente de snapshots históricos de `elo_peak`, `total_tournaments`, `total_cashes`, `total_wins`, premios y buy-ins previos a **cada** publicación.

Una coincidencia entre `previous.elo_after` y `next.elo_before` **solo acredita continuidad entre dos registros de ELO**. No prueba que todos los acumulados previos sean correctos o que no existan ajustes externos. Aun cuando el valor sea 1200, no debe asumirse que sea el inicio de la historia del nickname.

### Observaciones de solo lectura que motivan el control

- **20.821** registros de resultados y **20.821** registros ELO, 256 torneos con historial.
- **3.486** discontinuidades (tolerancia 0,011), **605 nicknames** y **112 torneos** afectados. Diferencia absoluta media 14,52 puntos y máxima 99,31.
- Octubre: ninguna discontinuidad en 2.934 transiciones; noviembre: 165 en 606, localizadas en dos fechas CCP registradas el 6 de noviembre en orden de publicación inverso a la programación.
- En esas fechas CCP, **244/244 pares de resultados e historial ELO coinciden**, **244/244** registros concuerdan con la fórmula ELO histórica con K=20/40 y para **157 nicknames** el ELO materializado coincide con el último registro. Esto **no** resuelve las discontinuidades ENTRE eventos ni demuestra su origen.
- Consulta de metadatos de solo lectura no identificó tablas públicas de snapshots/bitácoras anteriores para recuperar los acumulados pretorneo. No equivale a afirmar que no existan respaldos externos o WAL.

## 1. Auditor de evidencia, sin inferir valores

`src/lib/elo-checkpoint-evidence.ts` añade `auditEloCheckpointEvidence(plan, tournaments)`, **función pura** que usa el `ReplayPlan` ya calculado para examinar el historial completo y clasificar el primer evento afectado de cada jugador:

| Estado | Evidencia | Decisión |
| --- | --- | --- |
| `continuous_recorded_elo` | `elo_before` del evento coincide con `elo_after` previo | Solo enlace ELO numérico, **NO** checkpoint completo |
| `recorded_elo_gap` | Los dos valores difieren > tolerancia | Bloqueado; investigar procedencia |
| `first_recorded_event` | No existe un evento previo de ese nickname en la fuente aportada | No inferir ELO inicial ni acumulados |
| `missing_event_history` | Falta el evento afectado para ese nickname | Bloqueado; no inventar registros |

**Todos** los estados devuelven `completeCheckpointVerified=false`, `requiresManualReview=true`, y el informe `safeToApply=false`. No conectan con Supabase ni generan SQL de escritura. Las pruebas `tests/elo-checkpoint-evidence.test.mjs` reproducen continuidad, discontinuidad, primeras observaciones, fuente faltante, fechas superpuestas, duplicados y determinismo.

**Punto de control humano necesario:** evidencia independiente de la misma fecha de publicación, antes de aplicar ELO: estado inicial de estadísticas, ELO y pico, torneos jugados, premios y buy-ins, versión del algoritmo y confirmación de que no hubo cambios externos. No declarar una línea base verificada sin ella.

## 2. Bitácora inmutable para evitar repetir la deuda histórica

`docs/security/league-elo-publication-evidence-2026-11-06.qa-only.sql` es un **modelo SQL de pruebas**: crea un esquema privado `sharkania_release_qa`, con tablas de evento y snapshot de jugador. Contiene torneo, liga, actor, versión del cálculo, huella hexadecimal de entrada y los acumulados previos; impide cambios por `UPDATE/DELETE` mediante triggers y no concede acceso a roles navegador `anon`/`authenticated`. Su finalidad es probar un contrato de auditoría para publicaciones **futuras**, no recrear las antiguas.

`tests/fixtures/sharkania-elo-publication-evidence-qa.sql` verifica en PostgreSQL desechable:
- Inserción de evento y snapshot ficticios.
- Rechazo de modificaciones y eliminación de evidencia existente.
- Rechazo de permisos API directos.
- Si falla un checkpoint, su evento se revierte en la misma subtransacción, sin fila huérfana.
- `ROLLBACK` completo al terminar.

**Advertencias de arquitectura, aún bloqueantes:**
- La bitácora QA **no está conectada** al escritor transaccional de resultados y no valida aún que cada publicación tenga exactamente N checkpoints. El futuro escritor debe guardar ambos **en la misma transacción**, con rollback único.
- La huella de entrada debe calcularse **en servidor sobre una representación canónica**, no confiar en una huella aportada por el navegador. En este fixture solo se exige formato de 64 caracteres, no prueba criptográfica.
- `created_at` y el identificador UUID por sí solos **no garantizan orden causal de commit** cuando existan escritores paralelos. Deben cerrarse los escritores heredados e introducir secuenciación transaccional con un protocolo de bloqueo probado; no inferir orden autoritativo de una secuencia PostgreSQL aislada.
- No se permiten cambios retroactivos silenciosos. Cualquier corrección futura deberá generar evidencia adicional versionada; el formato final de eventos de corrección no está implementado.
- El prototipo no valida equivalencia entre propietarios/ACL, procedimientos de backup, experiencia UI, el costo de recálculo ni ELO/CCP multimoneda. No publicarlo solo.

## Próximo bloque

1. Confirmar con pruebas la paridad entre las publicaciones existentes y las futuras líneas base con versión de algoritmo.
2. Diseñar secuencia serializada y operación de corrección aditiva que **registre** motivo y actor, sin borrar el historial anterior.
3. Integrar bitácora y cálculo a un escritor completo, incluida gestión de nicknames y ligas. Bloquear cambios ambiguos y mantener la edición histórica original **sin habilitar** hasta que funcione un replay determinista y seguro.
4. Probar datos ficticios con carreras concurrentes, recuperación y volumen representativo antes de fusionar PR #65 y ejecutar cualquier SQL fuera de QA.

**Producción intacta; PR #65 DRAFT, feature flag apagada; PR #76 Auth separado.**
