# SHARKANIA — protección del cálculo ELO sin interrumpir resultados

**3 noviembre de 2026 · Solo diagnóstico y diseño. NO aplicado. Sin cambios en Supabase ni en cálculo productivo.**

## Evidencia en la rama Preview

- `src/lib/api/elo-engine.ts::calculateElo(tournamentId)` consulta el torneo, los resultados y los jugadores desde el navegador.
- Luego calcula ELO en TypeScript y ejecuta por separado `players.update` (ELO, pico, torneos, cashes, victorias, premios y buy-ins), `elo_history.insert` y `tournament_results.update` para cada participante.
- Tras el bucle sincroniza perfiles y marca `tournaments.results_uploaded=true` y `status='completed'` mediante otra petición.
- **No comprueba la propiedad `error`** en cada una de esas escrituras; puede responder `success:true` incluso si una o varias actualizaciones son rechazadas por RLS, se corta la conexión o fallan dependencias. No existe transacción general que revierta todas las modificaciones.
- `reverseElo` borra el historial por otra petición independiente; requiere análisis del flujo completo antes de cambiar permisos.
- `src/components/admin/results-upload.tsx` y `src/components/admin/results-editor.tsx` crean nuevos `players` inicialmente con ELO 1200, y `src/components/admin/club-players-tab.tsx` edita legítimamente `nickname` y `country_code`.
- En producción, `authenticated` tiene privilegios de columna `UPDATE` sobre `players.elo_rating`, `elo_peak`, contadores y premios. La RLS `Players: editar propio` deja actualizar cualquier columna de su fila, sin trigger de integridad para valores derivados.

## Objetivo de seguridad / continuidad

Convertir el cálculo en una **operación transaccional server-side**, invocable solo por `super_admin` o administrador del club del torneo, nunca por jugadores corrientes. Se calculará el ELO exclusivamente desde los resultados almacenados, no desde valores propuestos por el navegador. No se cambia el criterio competitivo sin validación del propietario.

### Contrato propuesto

`calculate_tournament_elo_guarded(p_tournament_id uuid)` → devuelve éxito/idempotencia/recuento de jugadores o error tipificado; no recibe ELO, dinero ni UUID de jugadores suministrados por el cliente, salvo el torneo autorizado.

1. Rechazar anónimo y usuarios sin autorización; resolver club del torneo desde la base. No usar `user_metadata` para permisos.
2. Bloquear la fila del torneo y las filas afectadas de jugadores y resultados en orden estable; comprobar mínimo dos jugadores, posiciones válidas y que ninguno falte.
3. Garantizar idempotencia: no otorgar dos veces puntos/premios si el torneo ya fue procesado.
4. Calcular exactamente la fórmula actual (score normalizado por posición, expectativa por diferencia ELO, K dependiente de número de torneos, buy-in y participantes, peso por ELO medio), comparar resultados con tests de referencia TypeScript.
5. Actualizar jugadores, historial, resultado individual y estado del torneo en **una sola transacción**; si falla cualquier operación, revertir todas.
6. Sincronizar ELO unificado respetando múltiples nicknames sin sobrescribir otros perfiles y sin mezclar monedas para métricas financieras.
7. Tras probar la función en Supabase QA, cambiar la UI a RPC y retirar el bucle de escritura client-side. Entonces restringir columnas ELO/premios y la política INSERT de `players`, conservando edición legítima de nickname y país por el administrador autorizado.
8. Añadir pruebas por rol, concurrencia, doble clic/doble ejecución, errores parciales, reversión y repetición sobre el mismo torneo; comparar ELO histórico de casos sintéticos con algoritmo anterior.

## Riesgos de una corrección apresurada

- Revocar `UPDATE` sobre las estadísticas de `players` antes del corte a RPC rompería el cálculo vigente del frontend.
- Permitir al cliente invocar un RPC privilegiado con estadísticas calculadas por él permitiría falsificar ELO; el servidor debe ser la autoridad.
- Ignorar que `calculateElo` usa múltiples peticiones puede duplicar conteos o dejar tornos procesados a medias, incluso si se añadió un control de errores.
- SQL de prueba en PostgreSQL mínimo **no prueba** funciones de Supabase Auth ni todos los triggers actuales; se necesita un entorno Supabase aislado antes de publicar.

## Estado

- [x] Riesgos en cliente y permisos de columnas identificados con lectura del código y catálogo de producción.
- [x] Pruebas reales de políticas de otras 7 tablas superadas con PostgreSQL 17 aislado (workflow `core-supabase-rls-qa.yml`).
- [ ] RPC de ELO implementada y comparada contra fórmula anterior.
- [ ] Simulación en Supabase QA con Auth/RLS y dependencias completas.
- [ ] UI migrada al RPC sin regresiones de torneos/rankings.
- [ ] Columnas y políticas de jugador restringidas después del cambio.
- [ ] Revisión de logs y aprobación para despliegue productivo.

**NO-GO en producción mientras estas pruebas no pasen. Sin trabajo sobre módulos que se retirarán.**