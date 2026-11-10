# SHARKANIA — Corte del cargador CSV y editor de resultados de liga

**10 de noviembre de 2026 — QA únicamente. NO GO producción.**

Este cambio se apila sobre los PR #86–#93. Ni el flag `VITE_LEAGUE_GUARDED_RPC` ni la RPC estable del nuevo backend están instalados/activados en producción. No fusionar en `main` sin el corte de servidor y su aprobación.

## Qué cambia al activar posteriormente el backend protegido

| Flujo | Flag apagado (Sharkania actual) | Flag encendido (futuro, solo QA) |
|---|---|---|
| CSV inicial, torneo **de liga USD** | Secuencia legacy sin cambios | Una llamada a `publish_league_nickname_results_guarded`, sin DML directo |
| Editor con liga USD **sin resultados anteriores** | Secuencia legacy sin cambios | Primera publicación vía esa misma RPC transaccional |
| CSV/editor con liga **ya publicada** | Flujo antiguo actual | **Rechazado antes de crear/borrar/editar**; el replay histórico sigue pendiente |
| CSV/editor con liga **CLP/EUR** | Flujo antiguo actual | **Rechazado** hasta aprobar fórmula ELO y política de monedas |
| CSV/editor con torneo **no liga** | Secuencia legacy | Secuencia legacy idéntica |

El frontend envía exclusivamente nickname, posición, premio, puntos, club CCP y número de entradas. **Nunca** envía `player_id`, la moneda, el ELO ni un identificador de actor. La RPC verifica identidad normalizada por sala, organizador principal, posiciones, precedencia cronológica, premios, auditoría y asientos en una transacción; su cuerpo con controles fue probado en QA en #88–#93.

## Nombre estable de la API y seguridad

- Cliente: `src/lib/api/guarded-league-results.ts` → `supabase.rpc("publish_league_nickname_results_guarded", ...)`.
- Solo en **QA descartable** la función estable delega a la función completa `publish_league_nickname_results_guarded_qa` mediante `docs/security/league-results-public-rpc-alias-2026-11-10.qa-only.sql`.
- **La función delegadora QA NO es una migración para producción.** Para el corte real se debe instalar el cuerpo auditado con el nombre estable, firmas, grants y RLS correctos en una **migración nueva, versionada y revisada**, sin depender de funciones `_qa`.
- Cualquier error (falta de RPC, permisos, resultados duplicados o conflicto ELO) devuelve error al editor; **no hay fallback** a las rutas antiguas ni creaciones de jugadores parciales.
- El backend de USD vigente en esta rama **no acepta** CLP/EUR, aunque existan candidatos de fórmula v2 en QA. El frontend los bloquea explícitamente y el servidor también.

## Pruebas de salida

- [ ] TypeScript `tsc -b` para ambos componentes.
- [ ] Contratos JS: guard de flag, ruta atómica antes de resolver/crear jugadores, historial bloqueado, no-link JSON payload, sin fallback REST, flujo no-liga preservado.
- [ ] PostgREST y GoTrue reales en Supabase efímero: el endpoint **estable** permite primera publicación del organizador, deniega a anónimo/club secundario/jugador, rechaza payload inválido y segunda publicación, preserva ELO y ledger sin duplicados.
- [ ] Regresión de ELO/concurrencia/clubs, funciones legacy y backup ficticio en GitHub Actions.
- [ ] Verificar que `main`, Cloudflare y Supabase productivo no cambien.

## Bloqueos para un GO de corte

1. Migración versionada única que cierre todas las escrituras directas asociadas a ligas (no basta un flag).
2. Revisión integrada de rutas `results-upload`, `results-editor`, `tournaments`, templates y RPC legacy, preservando torneos no liga.
3. Decidir fórmula ELO prospectiva/fecha, política de moneda y presentación de totales CLP/EUR; no reescribir el histórico.
4. Replay de edición/borrado sin supuestos falsos de inicialización ni cronología ELO, o mantener esas acciones bloqueadas como política explícita.
5. Clon independiente del respaldo real, comprobación de Auth/GRANT/OWNER/DEFAULT ACL y rollback seguro.
6. Aprobación expresa del propietario del proyecto para crear recursos con coste, fusionar o aplicar migraciones y activar flags.

**Esta fase habilita una ruta cliente preparada para una primera publicación protegida en el futuro; NO despliega ningún nuevo escritor hoy.**
