# SHARKANIA — contrato de publicación transaccional y corte API/UI (borrador, 4 nov 2026)

> **NO-GO. Especificación para desarrollo y QA, no migración ni autorización de producción.** No activar `VITE_ELO_GUARDED_RPC`, no aplicar revocaciones sueltas, no fusionar PR #64. Las pruebas anteriores se ejecutaron con usuarios ficticios sobre Supabase local o PostgreSQL sintético; ninguna de las RPC de QA está instalada permanentemente.

## 1. Estado de verificación

| Capacidad | Evidencia confirmada | Limitaciones |
| --- | --- | --- |
| ELO, premios y reentradas server-side | SQL ELO con QA local PASS | No confirma procesamiento de torneos en orden temporal |
| Autorización y alta protegida de jugador | QA local PASS | Falta API/HTTP con JWT real y cobertura de todos los casos |
| Revocar último torneo + ELO/CCP/standings | QA local PASS | Solo USD y liga simple; torneos intermedios se rechazan |
| Republicación de último torneo, rollback inyectado, repetición | QA local PASS | Prototipo temporal; no despliegue ni llamada UI |
| Republicación con perfiles multialias | QA local PASS | Dos alias de perfil ficticio |
| Republicación con alta nueva | QA local PASS | Un nuevo nickname, USD, fixture simple |
| Clubes múltiples y moneda | QA local PASS | Políticas ficticias; mezcla CLP/USD se rechaza sin convertir |
| Dos sesiones simultáneas para cálculo ELO | QA PostgreSQL temporal PASS con lock observado | **No equivale a concurrencia de republicación** |
| API PostgREST, cliente y sesiones reales | **Pendiente** | Todavía se utilizan escrituras independientes en navegador |
| Reconciliación histórica y plan de deploy/rollback | **Pendiente** | No tocar datos históricos sin respaldo y aprobación |

### Riesgo detectado al cerrar QA de concurrencia

El test de ELO en dos sesiones admite cualquier orden serializado de los dos torneos y comprueba continuidad entre `elo_after` y `elo_before`. **No comprueba que dicho orden corresponda a `start_datetime`.** El código de `calculate_tournament_elo_guarded` no consulta torneos posteriores ya procesados para impedir publicación tardía de una fecha antigua. El motor podría quedar serializado en orden de llegada, pero cronológicamente incorrecto. Antes de la API final, establecer regla explícita: rechazar publicación/republicación de una fecha anterior si alguno de sus jugadores ya tiene una fecha posterior procesada, o implementar replay cronológico completo demostrado en QA. Opción conservadora para primera versión: **rechazo sin mutación**.

## 2. Superficie de escritura heredada que debe retirarse EN BLOQUE

- `src/components/admin/results-upload.tsx`: resuelve/crea jugadores, escribe directamente `tournament_results`, llama `applyLeaguePoints`, `forceRecalculateStandings` y `calculateElo` con solicitudes separadas. En errores, algunas escrituras anteriores pueden persistir.
- `src/components/admin/results-editor.tsx`: `prepareTournamentForReedit`, DELETE e INSERT de `tournament_results`, luego cálculo ELO y league standings por múltiples requests.
- `src/lib/api/tournaments.ts`: `prepareTournamentForReedit` implementa comprobación temporal **solo en cliente** y termina llamando `reset_tournament_impact`; `applyLeaguePoints` inserta/actualiza standings desde navegador.
- `src/lib/api/leagues.ts`: `forceRecalculateStandings` invoca `recalculate_league_standings` sin autorización interna adecuada y restaura CCP/entradas mediante UPDATE directo no atómico (el filtro de resultados con CCP no-null puede omitir entradas).
- `src/lib/api/elo-engine.ts`: motor legacy escribe `players`, `elo_history` y ELO en `tournament_results`; `reverseElo` borra historial con solicitud separada.
- `src/lib/api/players.ts`: `updatePlayer(id, updates: Partial<Player>)` acepta cargas amplias; el servidor deberá impedir que los clientes cambien campos calculados aunque pasen objetos con propiedades extras.
- `public.league_clubs`: QA confirmó alta unilateral, promoción a `is_primary` y edición de liga ajena; cerrar JOIN/UPDATE directo para cualquier admin de club no designado organizador.

La variable de entorno `VITE_ELO_GUARDED_RPC` permanece apagada y actualmente bloquea rutas de admin. **No basta con cambiarla a true** para completar la operación.

## 3. Propuesta de contrato para una única operación HTTP

Una solicitud autenticada al endpoint de API/RPC, concepto `publish_tournament_results_guarded`:

```json
{
  "p_tournament_id": "uuid",
  "p_expected_revision": 3,
  "p_idempotency_key": "uuid-generated-in-browser",
  "p_results": [
    {
      "player_id": "uuid-or-null",
      "nickname": "alias only if new",
      "country_code": "CL",
      "position": 1,
      "prize_won": 100,
      "bounties_won": 0,
      "league_points_earned": 100,
      "ccp_club": "CLUB",
      "buy_ins_count": 2
    }
  ]
}
```

Este payload es **ilustrativo y no está implementado**. Los importes deben validarse según precisión, moneda y esquema real; rechazar claves desconocidas de `p_results` especialmente `elo_before`, `elo_after`, `elo_change`, `elo_rating`, premios calculados o IDs de otro torneo. `p_expected_revision` y `p_idempotency_key` exigirían diseñar control de versión/tabla de deduplicación; **no presumir que existen hoy**.

Respuesta: estado explícito `success`, `tournament_id`, `revision` aplicada, `already_applied`, cantidad de jugadores y fecha de confirmación, más errores tipados: `NOT_AUTHORIZED`, `STALE_REVISION`, `OUT_OF_ORDER_HISTORY`, `MIXED_CURRENCY`, `INVALID_RESULT`, `CONCURRENT_EDIT`. No incluir datos de otros clubes.

### Seguridad de la RPC

La API expuesta tendrá una envoltura mínima; operación privilegiada atómica en una función interna con `SECURITY DEFINER SET search_path=''`, SQL totalmente cualificado, `auth.uid()` comprobado adentro, y `EXECUTE` restrictivo. Prohibir uso de `service_role` en frontend; asegurar USAGE/EXECUTE mínimos, RLS y columna por columna. Revisar las recomendaciones actuales de Supabase para esquema no expuesto en funciones privilegiadas.

La operación de servidor debe:
1. Revalidar JWT y autorización sobre el club del torneo. Para cambios de liga global, comprobar club `is_primary`; una invitación a liga entre clubes requiere flujo/autorización explícitos.
2. Fijar orden de bloqueos de torneo, jugadores y standings que evite deadlocks; tomar locks antes de comprobaciones de historial/concurrencia y de modificaciones.
3. Validar estado, revisión, integrantes, sala/nicknames, posiciones únicas y consecutivas, entradas enteras positivas, importes no negativos, liga y moneda. Rechazar solicitudes JSON con atributos calculados por cliente.
4. Verificar que NO se procesan torneos fuera de orden de `start_datetime` para ningún jugador afectado. Re-editar/republicar únicamente el torneo que realmente sea último para los afectados hasta tener replay histórico validado.
5. Resolver/crear jugadores con ELO inicial fijo controlado por servidor y sin duplicados, solo dentro de la transacción.
6. Si sustituye resultados, revertir efectos antiguos y reemplazarlos dentro de **la misma transacción**; nunca dejar `results_uploaded=true` con resultados borrados.
7. Recalcular ELO, estadísticas, ingresos por premios, reentradas, perfiles `unified_elo`, `league_standings` (CCP, fechas, participaciones, último torneo y puntos) con las reglas reales; validar `currency` antes de sumar valores monetarios de diferentes divisas.
8. Establecer estado final, revisión e idempotencia; ante CUALQUIER fallo, abortar transacción para preservar el estado antiguo.
9. Registrar auditoría mínima del actor y solicitud, evitando exposición de información privada y sin depender de cambios por navegador.

## 4. Condiciones previas para habilitar en la interfaz

- Sustituir completamente secuencias legacy de carga/edición por **una sola llamada** al contrato protegido, con indicadores de carga, errores recuperables y refresco posterior de información desde el servidor.
- Cortar **simultáneamente** escritura directa de métricas ELO y tablas auxiliares, privilegios de `league_clubs` y la ejecución directa de `reset_tournament_impact`/`recalculate_league_standings`; preservar solo escrituras legítimas por columnas y RPC autorizadas. No cortar accesos antes de que exista flujo equivalente funcional.
- No activar flag mientras el usuario pueda quedar a mitad de publicación o edición por permisos denegados.
- Mantener la consulta pública de resultados/ranking sin filtrar columnas privadas o información premium.
- Preparar procedimiento de rollback que NO reabra vulnerabilidades de direct-DML; si falla, desactivar operaciones de edición y mantener lectura, no restaurar permisos inseguros.

## 5. Matriz mínima de aprobación E2E (no sustituir por tests estáticos)

1. HTTP/PostgREST: usuario normal, admin de otro club, admin del club, superadmin; JWT de cada uno y control por ligas organizadoras/participantes. No compartir tokens por chat.
2. Carga inicial: 2+ jugadores, nueva ficha, multi-valor CCP, diferentes reentradas y premios; comparar API, tablas y web.
3. Republicación final: cambio de posición, premios, alias nuevo y resultados; ELO, perfil unificado, rankings, datos monetarios y estado coherentes.
4. Rechazo de torneo intermedio y de publicación inicial FUERA de orden con fechas futuras ya procesadas.
5. Inyección de fallo después del reset y después de recalcular ELO: todo revertido, sin filas huérfanas.
6. Doble solicitud simultánea e idempotency key, y dos administradores intentando reeditar el **mismo torneo**; verificar espera real, sin lost updates ni doble incremento.
7. Liga multiclub: B no puede autovincularse ni hacerse organizador; B sí administra sus torneos; A puede administrar liga; invitación y duplicación/clonación según regla de negocio final.
8. CLP sola, USD sola, mezcla en liga/usuario: regla explícita sin sumar montos incompatibles; moneda histórica visible.
9. Reconciliación pre-despliegue: cotejar estados `results_uploaded` vs `tournament_results`/`elo_history`, premios y CCP reales, monedas, `total_buy_ins_spent` y jugadores duplicados; **solo lectura y sin corregir producción sin aprobación**.
10. CI con esquema completo y prueba manual por panel administrador; respaldo/restauración y reversión de release simulada.

## 6. Próxima tarea práctica

La siguiente implementación en **rama draft** debe ser el SQL integrado, versionado y revisable, más la llamada de cliente detrás de flag apagada; después se conecta solo a una instancia Supabase QA separada. No convertir el SQL de los scripts de prueba temporal en migración productiva: los nombres `*_qa`, los valores sintéticos y los `GRANT/REVOKE` transaccionales son experimentos, no la política definitiva.

**Decisiones de negocio pendientes:** quién acepta/vincula clubes a liga y qué acciones exactas corresponden a organizador principal; qué significa `total_buy_ins_spent` en standings (cantidad de entradas vs gasto monetario); y si se permiten ligas/torneos multi-moneda (y su tratamiento). Ante ausencia de decisión, usar **fail closed** y no inventar conversión.
