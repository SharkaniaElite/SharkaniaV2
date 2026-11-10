# Auditoría de paridad productiva — solo lectura (10 noviembre 2026)

**Proyecto consultado:** `nhpjzywfzljtlqaigzed` (PostgreSQL 17, estado activo). Se ejecutaron exclusivamente consultas `SELECT` de agregados/catálogo y consultas de asesores sin modificar permisos, datos, Cloudflare o GitHub main.

## Estado observado

| Indicador | Resultado |
|---|---:|
| Torneos en producción | 1.329 |
| Torneos con `results_uploaded=true` | 260 |
| Jugadores / alias | 1.820 |
| Filas `tournament_results` | 21.080 |
| Filas `elo_history` | 21.080 |
| Resultado sin historia ELO correspondiente | 0 |
| Historia ELO sin resultado correspondiente | 0 |
| Grupos de historia duplicada para un par jugador/torneo | 0 |
| Colisiones de nickname normalizado por sala | 0 |
| Torneos marcados publicados pero sin resultados | 0 |
| Torneos publicados con estado `scheduled` (inconsistencia histórica) | 3 — 2 ligas CLP y 1 liga EUR |
| Torneos con resultados pero no marcados publicados | 0 |
| Ligas sin club primario | 0 |

Las 3 filas con `results_uploaded=true` y estado `scheduled` requieren revisión de datos histórica: el guard adicional no debe impedir una actualización sin cambio del estado; sí rechaza transiciones hacia cancelación/reapertura que harían perder evidencia.

**Distribución por moneda y modalidad (total / publicados / no publicados):**

| Moneda | Liga | Independiente |
|---|---|---|
| USD | 28 / 25 / 3 | 25 / 2 / 23 |
| CLP | 186 / 159 / 27 | 1.009 / 0 / 1.009 |
| EUR | 81 / 74 / 7 | 0 / 0 / 0 |

La consulta adicional de fechas halló **0 torneos independientes CLP no publicados con comienzo desde el 10-11-2026**, es decir, los 1.009 son previos a ese corte de fecha, pero su publicación retroactiva o nuevos torneos CLP requieren una política segura. No concluir que se trata de 1.009 eventos futuros o que nunca se cargarán.

### Alerta: continuidad de cadena ELO histórica

Se ordenaron las 21.080 entradas por `tournaments.start_datetime`, `elo_history.recorded_at`, `elo_history.id` dentro de cada jugador. Entre **19.274 pares consecutivos**, la comparación `abs(elo_before - lag(elo_after))>0.01` marcó **5.799 discontinuidades en 665 jugadores**. Esa métrica **no es un diagnóstico causal** ni reemplaza el conteo histórico previo de 3.576 calculado bajo otra definición/orden: fechas iguales, edición antigua, aliases y cronología administrativa pueden explicar divergencias. Prohibido reconstituir desde 1200 o declarar «ELO corregido» sin determinación histórica con criterios explícitos.

El `get_unified_elo` productivo suma deltas de todos los aliases cuando un perfil tiene múltiples nicknames; el cliente legacy también usa `get_unified_elo_history` para perfiles sencillos. La política de materialización en #95 y #96 necesita verificación sobre clon real con alias, fechas y valores históricos.

### Rama, migraciones y revisiones automáticas

- Solo figura la rama Supabase `main`; **no existe clon independiente restaurado**.
- Última migración listada en productivo: `20261107191558_p0_restrict_league_standings_rls_20261107`; el código candidato #95/#96 **no figura como migración ejecutada**.
- El asesor de seguridad detectó **5 funciones `SECURITY DEFINER` ejecutables por `anon`**, y **36 ejecutables por `authenticated`**. Es un inventario de superficie de ataque, **no 41 vulnerabilidades confirmadas**. Algunas funciones públicas `get_unified_elo` y `is_super_admin` son consultas y pueden tener exposición deliberada. Revisar especialmente `reset_tournament_impact` y `delete_tournament_god_mode` que reescriben historial/estadísticas.
- Algunos otros avisos de Supabase (extensiones en `public`, RLS sin políticas en tablas internas) requieren análisis independiente; **no modificar sin revisar uso real y dependencias**. Documentación del linter: https://supabase.com/docs/guides/database/database-linter

## Implicaciones de corte

1. **No activar aún el ACL global del PR #96**: revoca INSERT/UPDATE/DELETE a las rutas REST de resultados y jugadores. Como el nuevo escritor solo admite USD, la modalidad independiente CLP quedaría sin ruta aprobada de publicación o edición. Requiere decisión explícita de política deportiva multimoneda.
2. **No editar ni borrar ELO histórico** por `reset_tournament_impact`, `delete_tournament_god_mode` o vías REST: el nuevo guard de QA rechaza modificaciones en torneos ya publicados, incluidos los independientes. Esto conserva evidencia, pero cambia deliberadamente el comportamiento del editor. La corrección histórica seguirá bloqueada hasta replay autorizado.
3. **No crear proyecto/branch de clon** sin conocer coste y autorización. Branch Supabase normal no incluye datos productivos por sí sola y **no sustituye** una restauración fiel.
4. Para preparar GO, repetir en copia restaurada todos los SELECT de paridad, triggers, tipos de enum, extensiones, permisos por columna, funciones `SECURITY DEFINER`, `auth.uid()`, FK y políticas; anotar diferencias antes de instalar SQL.
5. Probar ambos órdenes de concurrencia (liga → independiente e independiente → liga) con jugadores compartidos y validación numérica; el CI de PostgreSQL ficticio no representa concurrencia de todo el sitio.
6. Antes de activar flags, asegurar migración backend y frontend en un corte coordinado, rollback *sin* restaurar permisos inseguros y un documento formal de aprobación de moneda, premios/reentradas y acceso histórico.

**Estado:** #95 y #96 siguen **DRAFT / NO GO**. No se autorizan despliegues, merges, restauraciones con costo ni cambios a Supabase productivo.
