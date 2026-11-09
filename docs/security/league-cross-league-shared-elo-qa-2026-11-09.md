# SHARKANIA — Dos ligas independientes con jugadores compartidos

**Fecha:** 9 de noviembre de 2026. **Alcance:** QA en PostgreSQL 17 desechable. **NO GO producción.**
**Dependencias:** PR #90 → #89 → #88 → #87 → #86. Ningún cambio en `main`.

## Riesgo específico

Las ligas A y B pueden tener distintos clubes organizadores, pero compartir una sala y jugadores. Un bloqueo sobre la fila `leagues` de A **no bloquea** la fila de B. Por lo tanto, demostrar concurrencia dentro de una sola liga no basta para garantizar la integridad del ELO global.

El escritor propuesto hace bloqueos sobre la fila del torneo, liga y luego identidades de jugadores por UUID. Además, el resolver de nicknames aplica `pg_advisory_xact_lock` por sala y nickname normalizado, en orden estable. Este ejercicio verifica el efecto real de esos bloqueos entre **dos ligas independientes** sin modificar el ELO histórico.

## Escenarios nuevos

1. Dos ligas reales *solo en el esquema sintético*: A organizada por club 21, B organizada por club 22. Ambas admiten sala 31; comparten `SharkHero` y `PokerQueen`.
2. El organizador A no puede publicar en B y el organizador B no puede publicar en A. Ambos rechazos deben ocurrir sin escribir jugadores, resultados ni bitácoras.
3. Una publicación A (torneo 97, primero cronológicamente) inicia con rol autenticado de club A, escribe resultados/ELO y mantiene abierta su transacción unos segundos. Simultáneamente, club B intenta publicar el torneo 98 de liga B y jugadores idénticos. La prueba observa espera real de bloqueo en PostgreSQL.
4. Después ambos commits deben ser exitosos, con un solo evento por torneo, dos resultados y dos asientos por torneo. Para cada jugador, el ELO final del torneo A debe coincidir exactamente con el ELO inicial del torneo B. Los rankings de liga A y B deben contener las filas correctas por separado.
5. Una carga anterior a ambos torneos, registrada *después* de ellos, se rechaza por cronología. Si la carga incluía un nickname nuevo, también debe desaparecer con el rollback.
6. Se vuelve a probar la carrera del mismo torneo y las pruebas de GoTrue/PostgREST local del PR #90, sin tocar una instancia Supabase compartida.

## ¿Qué NO significa esta prueba?

- No certifica todas las combinaciones de agendas, divisas o torneos con varios cientos de jugadores.
- Los roles autenticados de PostgreSQL simulan los claims, mientras que la validación con **JWT reales de GoTrue** ya fue aprobada en el PR #90 para los controles HTTP de una liga. Esta prueba entre dos ligas es a nivel de PostgreSQL descartable, no una nueva suite JWT entre clubes.
- El código actual no permite publicar CLP/EUR; la versión ELO `currency-neutral-v2-PROPOSAL` está solo en comparación. **No tiene aprobación deportiva o comercial**.
- No resuelve replay para ediciones y borrados históricos, cierre de operaciones legacy, backup/restore ni migración versionada.

## Criterio de salida

- [ ] CI de concurrencia entre ligas y denegación cruzada PASS con espera real de lock.
- [ ] QA HTTP/GoTrue anterior continúa PASS.
- [ ] GitHub `main`, Cloudflare y Supabase productivo permanecen sin cambios.
- [ ] Checklist #81 actualizado con evidencia verificable y bloqueos restantes.

**Condición de publicación:** aprobación específica para cutover tras resolver los pendientes. Nada aquí es autorización para aplicar SQL productivo ni activar `VITE_LEAGUE_GUARDED_RPC`.
