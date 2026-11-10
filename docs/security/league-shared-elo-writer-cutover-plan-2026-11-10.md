# Sharkania — cierre de escritores ELO compartidos antes de Release A

**10 noviembre 2026 · Documento de diseño / QA exclusivamente · NO GO a producción.**

No se modificaron datos reales, flags, migraciones productivas ni la fórmula deportiva. Este documento delimita el bloqueo confirmado de `players` y `elo_history` en el candidato del [PR #95](https://github.com/SharkaniaElite/SharkaniaV2/pull/95). Su existencia **no** constituye aprobación funcional ni de despliegue.

## 1. Diagnóstico sustentado

Revisión de lectura del catálogo Supabase productivo y de la rama del PR #95:

| Superficie | Escritura actual / evidencia | Condición para cerrar |
|---|---|---|
| `src/lib/api/elo-engine.ts::calculateElo` | El navegador calcula ELO y actualiza `players`, inserta `elo_history`, modifica `tournament_results`, sincroniza `profiles.unified_elo` y finalmente marca `tournaments.results_uploaded`. Varias promesas Supabase esperan respuesta pero **no comprueban `error`**: el método podría devolver éxito tras fallos individuales. | Mover todas las mutaciones del resultado a **una transacción autorizada en servidor**, con errores propagados y comprobación de filas afectadas. |
| `src/lib/api/elo-engine.ts::reverseElo` | Borrado de ELO y reversión de estado desde el cliente; no reconstruye el historial de todos los jugadores compartidos. | Bloquear la edición/reversión sin replay verificable y una política de cambios históricos explícita. |
| `src/components/admin/results-upload.tsx` y `results-editor.tsx` | El flujo protegido de liga USD ya invoca `publish_league_nickname_results_guarded` con flag; los torneos sin liga siguen por carga/edición/recálculo legado desde el navegador. | Preservar el uso actual con flag **apagado**; antes del corte, sustituir el recorrido no-liga por una RPC equivalente y probar CSV/editor. |
| `src/lib/api/players.ts::updatePlayer` | `updates: Partial<Player>` acepta cualquier campo, incluidos ratings y acumulados, y llama `.from("players").update(updates)`. | Reducir la superficie de parámetros a campos administrativos legítimos (ej. nickname/país), **pero también** restringir columnas y permisos en la DB; TypeScript no protege PostgREST. |
| `src/components/admin/club-players-tab.tsx` | Uso legítimo de `players` UPDATE para corregir nickname y país. | Conservar operaciones de identidad/cosméticas mediante permisos específicos o RPC propia; impedir que se altere ELO. |
| Supabase `public.players` | RLS activo; UPDATE permitido sobre fila propia por `profile_id=auth.uid()` y sobre filas de clubes administrados. Privilegio de columna UPDATE en ELO y acumulados; triggers actuales no los protegen. | Revocar UPDATE general y conceder solo columnas expresamente aprobadas **después** de migrar los escritores y verificar clientes. |
| Supabase `public.elo_history` | Política INSERT para cualquier `auth.uid()` no nulo, sin validar titularidad de torneo; tabla sin trigger usuario productivo. | Revocar INSERT de `authenticated` y hacer que la única escritura sea servidor seguro; conservar SELECT público conforme a la política vigente. |
| Supabase `public.profiles` | `guard_profile_privileged_mutations` protege `role`, `unified_elo`, XP y saldo frente a usuario normal. | Preservar el trigger existente; probar la integración de la sincronización de perfil desde el escritor autorizado. |
| Funciones `SECURITY DEFINER` | `reset_tournament_impact` y `delete_tournament_god_mode` escriben ELO/resultados/jugadores, y `create_tournament_from_template` crea torneos. | Inventariar llamadas y autorizaciones reales de cada función, incluidas rutas no-liga y funciones invocadas indirectamente. |

**Prueba negativa automatizada:** `tests/fixtures/sharkania-release-a-untrusted-elo-write-negative-qa.sql`, ejecutada exclusivamente sobre PostgreSQL 17 descartable en `qa-league-release-a-single-cutover.yml`. Reproduce permisos heredados con un usuario ficticio, y **siempre hace ROLLBACK**. Que esa prueba pase significa que el riesgo se reprodujo correctamente y que el candidato **continúa NO GO**: no se debe presentar como cobertura de seguridad conseguida.

## 2. Contrato propuesto para el nuevo escritor no-liga

**Diseño no implementado / pendiente de aprobación funcional y de QA:**

1. Crear una RPC de servidor para **primera publicación** de un torneo sin liga. Resolver la identidad del actor mediante `auth.uid()` y confirmar propiedad del club del torneo o privilegio de superadministrador; no aceptar `actor_id`, `player_id`, rating ni divisa arbitrarios del navegador.
2. Validar torneo, fecha, sala, participantes únicos, posiciones, premios, entradas y estado de publicación. Rechazar edición y doble envío. Los valores no deben cruzar divisas al sumar importes.
3. En la **misma transacción**, bloquear el torneo, jugadores y secuencia ELO en orden consistente; aplicar la fórmula histórica acordada, registrar resultados e historial ELO, actualizar acumulados, sincronizar perfiles, finalizar torneo y registrar comprobante idempotente. Ante cualquier error, revertir todo.
4. Tomar `legacy-js-v1` como referencia para compatibilidad; cualquier ajuste de fórmula o política CLP/EUR es **una decisión separada**. Los torneos de liga USD seguirán utilizando su RPC ya probada, evitando dos implementaciones divergentes de ELO.
5. Cambiar CSV/editor no-liga a la nueva RPC solo tras paridad comprobada; ningún fallback a DML navegador si falla. El cliente `updatePlayer` quedará limitado a campos de identidad autorizados.
6. Después de que *todos* los escritores estén migrados y ensayados, cerrar `players` UPDATE sensible y `elo_history` INSERT desde API, sin revocar la lectura pública. Añadir una aserción post-corte: `authenticated` carece de estos privilegios de escritura.
7. Auditar procedimientos `SECURITY DEFINER` remanentes y evitar derivar autorización de metadatos editables por el usuario. La excepción `service_role` jamás llega al navegador.

## 3. Condiciones obligatorias antes de permitir GO

- [ ] Función servidor no-liga transaccional instalada sobre SQL sintético con tipos/permisos idénticos a producción.
- [ ] QA real local GoTrue/PostgREST **sobre SQL candidato completo**, sin alias `_qa`, validando anon, propietario del club, secundario, jugador externo y superadmin.
- [ ] QA de fraude con un propietario de jugador: PATCH de `players.elo_rating`, `elo_peak`, premios y INSERT directo `elo_history` devuelve denegación.
- [ ] QA positiva: CSV/editor no-liga, cambios de nickname y país, y torneos de diferentes clubes funcionan sin ampliar permisos.
- [ ] QA de idempotencia, fallos a mitad de escritura, carreras de torneos con jugadores compartidos, sincronización de perfiles y no-doble-ELO.
- [ ] Mantener bloqueada edición/borrado histórico: existen 3.576 discontinuidades detectadas de ELO antiguo y no puede asumirse rating inicial 1200 ni replay arbitrario.
- [ ] Auditoría completa de funciones privilegiadas, triggers, FK y políticas, incluida comprobación de invocadores y dependencias indirectas.
- [ ] Backup productivo restaurado en **proyecto independiente con autorización de costo previa**; ensayo de rollback sin reabrir las políticas inseguras.
- [ ] Revalidar producción de forma **solo lectura** antes de corte; aprobación expresa de migración y otra de despliegue/flag.

**Regla final:** la CI del SQL actual acredita su coherencia transaccional en liga USD y el bloqueo directo de resultados vinculados; **no valida** la integridad del ELO compartido ni la recuperación real. No fusionar #95, no aplicar cambios a `nhpjzywfzljtlqaigzed`, no habilitar `VITE_LEAGUE_GUARDED_RPC`.

