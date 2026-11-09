# SHARKANIA — Validación real Auth/REST y concurrencia entre torneos

**Fecha:** 9 de noviembre de 2026. **Estado:** PR QA en borrador, **NO GO producción**. Depende de #89 → #88 → #87 → #86.

## Alcance
1. Reutilizar el workflow de Supabase local que ya pasó en la antigua rama #65; `npm ci` mantiene la versión 2 del Supabase CLI bloqueada en `package-lock.json`. El 4 de noviembre de 2026 apareció una versión 3 del CLI con cambios de comportamiento; **no actualizarlo de forma implícita en esta prueba**.
2. Arrancar servicios **GoTrue + PostgREST reales** mediante Docker en GitHub Actions, accesibles **solo en loopback** `127.0.0.1:25421` API y `127.0.0.1:25422` PostgreSQL, sin enlazar a proyectos remotos. Datos y credenciales de prueba se generan dentro del runner.
3. Verificar con JWT emitidos por GoTrue que `anon`, jugador y club secundario no pueden ejecutar el escritor `publish_league_nickname_results_guarded_qa`, y que el organizador principal puede publicar una vez, creando exactamente un nickname y un asiento por participante.
4. Ejecutar además una carrera SQL entre **dos torneos distintos** en la misma liga que comparten dos jugadores. El primero publica con una transacción abierta mientras el segundo llega; exigir observar espera real de bloqueo de PostgreSQL y luego confirmar **los dos** torneos, encadenando `ELO final del primero = ELO inicial del segundo` por jugador.
5. Validar auditorías, resultados, ELO histórico, `total_tournaments` y bitácora USD nativa, sin duplicados ni reentradas perdidas.

## Lo que estas pruebas NO demuestran
- No contienen usuarios reales, datos reales, ni navegador conectado a `sharkania.com`; no prueban todos los permisos que tiene la instancia productiva.
- Una carrera entre torneos de una misma liga, con dos jugadores compartidos, **no reemplaza** la prueba pendiente de dos ligas distintas que comparten jugadores y diferentes organizadores.
- No sustituyen pruebas de colisión real del trigger `auto_slug_players` productivo, ni un respaldo restaurado y auditado, ni pruebas de edición/eliminación histórica con replay.
- No implican aprobación de `currency-neutral-v2-PROPOSAL`; ninguna publicación CLP/EUR se habilita ni se recalcula el histórico ELO.

## Acceso y seguridad
- Cualquier consulta HTTP queda forzada a `http://127.0.0.1:25421`, y las llamadas `psql` a `127.0.0.1:25422`.
- Las claves solo se extraen del Supabase **local** después de validar la URL y se enmascaran en CI. No se usan ni solicitan credenciales productivas.
- No hay acciones de deploy/merge, `db push`, ni escrituras en Supabase remoto. Todas las filas de prueba desaparecen al finalizar el runner.
- **Flag `VITE_LEAGUE_GUARDED_RPC` apagado**. Estos SQL tienen sufijo `qa-only` y no son migraciones productivas.

## Criterios para publicar después (sin autorización todavía)
- [ ] Elegir la versión ELO y política multimoneda con su efecto sobre resultados futuros.
- [ ] Validar escrituras de CSV y ediciones/borrados con reproducción cronológica de ELO.
- [ ] Probar condiciones de carrera entre distintas ligas y en autenticación real con adversarios.
- [ ] Retirar simultáneamente escritores/RPC heredados con controles `SECURITY DEFINER`.
- [ ] Demostrar backup/restore del esquema real y un rollback que no reabra políticas vulnerables.
- [ ] Aprobación expresa del propietario para migración y activación.
