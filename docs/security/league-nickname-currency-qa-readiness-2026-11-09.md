# SHARKANIA — Nicknames y contabilidad por moneda, corte QA

**Fecha:** 9 de noviembre de 2026. **Estado:** QA probado en PostgreSQL 17 aislado. **NO MIGRACIÓN PRODUCTIVA.**

## Resultado nuevo en PR #88

- `public.publish_league_nickname_results_guarded_qa(uuid,jsonb)`: operación `SECURITY DEFINER` con `search_path=''`, revocada para `PUBLIC/anon` y concedida únicamente a `authenticated` (además requiere autorización real dentro del cuerpo por organizador principal o superadministrador).
- El servidor obtiene `league_id`, `club_id`, `room_id`, `currency` y `buy_in` del torneo. **No acepta `player_id` del CSV**. Resuelve nicknames por la pareja `(room_id,lower(btrim(nickname)))`, impide duplicados de payload y crea un alias nuevo sin vincularlo arbitrariamente a ningún perfil (`profile_id=NULL`).
- Los bloqueos son `tournament` → `league` → locks transaccionales por nickname ordenado → filas de jugadores. El índice único QA por sala + nickname normalizado es obligatorio: el índice productivo actual `UNIQUE(nickname,room_id)` es **sensible a mayúsculas**, por lo que NO garantiza por sí solo la misma propiedad. No habilitar esta RPC sin crear y probar el índice de producción, coordinar escritores heredados y validar carreras entre ligas.
- La nueva RPC llama al escritor inicial QA de resultados del PR #87 **dentro de la misma transacción**. Si falla ELO, clasificaciones, auditoría o el registro de moneda posterior, PostgreSQL revierte tanto la carga como los jugadores recién creados.
- `sharkania_release_qa.currency_posting`: asiento por torneo/jugador con `currency`, `buy_in_per_entry`, `buy_ins_count`, `entry_spend = buy_in_per_entry * buy_ins_count`, premios y bounties en su moneda nativa. Privado y **sin UPDATE/DELETE**, sin permisos REST. Vista `currency_totals_by_player` con `security_invoker=true` agrupa **siempre por jugador y moneda**; no calcula tipos de cambio ni falsos totales multimoneda.

## Evidencia real (solo lectura, sin datos personales)

El 9 de noviembre, `public.players` contenía **1.820 registros, 0 colisiones normalizadas por sala, 0 nicknames vacíos y 0 con espacios sobrantes**. Schema productivo confirmado con trigger `auto_slug_players`, constraint `UNIQUE(nickname,room_id)`, índice único de slug y valores ELO predeterminados 1200. El fixture local emula lo necesario para verificar identidad/atomicidad; **no reproduce byte a byte la generación real de slug**.

La cartera de resultados: 295 torneos ligados a ligas, 258 publicados, 37 pendientes (27 CLP / 7 EUR / 3 USD), según consulta anterior. La RPC se mantiene **USD ONLY** para no introducir una política no aprobada de factor K o cifras financieras. Las pruebas sintéticas con CLP/EUR demuestran el **reporte segregado**, no que se puedan publicar torneos reales de esas monedas.

## Validación QA

- [x] Reconocer el mismo nickname con variaciones de caja y espacios en la misma sala.
- [x] Mantener independientes nicknames homónimos de salas diferentes.
- [x] Rechazar club secundario, datos mal formados, colisiones casefold y suplantación de `player_id`.
- [x] Crear un alias y registrar ELO, resultados, standings, moneda y país de origen **en una sola invocación**.
- [x] Provocar falla tardía en el asiento de moneda y verificar la restauración íntegra de jugadores, perfiles, ELO, resultados, posiciones, auditoría y asientos.
- [x] Calcular USD 3,30 x 2 = 6,60 en la moneda nativa sin cambiar el acumulado heredado por reentradas.
- [x] Aislar importes USD/EUR/CLP en tres grupos y negar mutaciones o lectura de los asientos a roles de la API.

## Condiciones pendientes para pasar a producción

1. **Monedas:** decidir y aprobar reglas ELO v1/v2 con CLP/EUR, gastos y premios sin conversión implícita. Actualmente 34 de 37 torneos pendientes no pueden publicarse por este escritor.
2. **Identidad real:** probar el trigger productivo de slug y creación con datos ficticios en entorno QA de Supabase con PostgREST y GoTrue, más concurrencia entre ligas; nunca ejecutar esa carga de prueba en producción.
3. **Permisos:** instalar índice único normalizado, cerrar escrituras legacy de `players`, `tournament_results`, `elo_history` y RPC `SECURITY DEFINER` en la misma ventana reversible; respaldar y probar restauración.
4. **Ediciones/eliminaciones:** algoritmo replay cronológico con checkpoints certificados o ventana de mantenimiento explícita; no sobrescribir ELO histórico.
5. **Aplicación:** integrar el uploader y editor con la RPC solo después del backend y las reglas comerciales, con flag controlado y aprobación propia.

**Decisión:** PR #88 sigue en borrador apilado sobre #87 y #86. No fusionar a `main` ni ejecutar SQL QA en el proyecto productivo, y mantener `VITE_LEAGUE_GUARDED_RPC` apagado.
