# Funciones privilegiadas públicas — revisión 31/10/2026

| Función | Acceso anónimo | Decisión |
|---|---|---|
| `increment_hand_views(text)` | Retirado | Antes modificaba vistas arbitrariamente. Contador por usuario autenticado/mano, máximo una vez cada 24 horas, en tabla interna `private` con RLS. |
| `get_unified_elo(uuid)` | Se conserva | Consultas públicas del ELO unificado; no escribe datos. |
| `get_unified_elo_history(text)` | Se conserva | Historial público de ELO; no escribe datos. |
| `get_unified_player_stats(text)` | Se conserva | Estadísticas públicas de jugadores vinculados; no escribe datos. |
| `is_club_admin(uuid)` | Se conserva | Función auxiliar de RLS basada en `auth.uid()`; no escribe datos; anon devuelve false. |
| `is_super_admin()` | Se conserva | Función auxiliar de RLS basada en `auth.uid()`; no escribe datos; anon devuelve false. |

## Verificación

- El frontend de `/tools/replayer/h/:id` está bajo `ProtectedRoute`, que exige autenticación.
- `shared_hands` tenía 0 filas de producción cuando se realizó el cambio.
- Sesión anon simulada: la función de incremento devuelve permiso denegado.
- Sesión autenticada simulada, en transacción revertida: primera vista incrementa; segunda vista inmediata no; una nueva visita después de 25 horas vuelve a incrementar; mano inexistente no modifica registros.
- La tabla `private.hand_view_cooldowns` no ofrece permisos a `anon` ni `authenticated` y tiene RLS habilitado.
- El Security Advisor bajó de 6 a 5 funciones SECURITY DEFINER ejecutables por anon, **sin bloquear las funciones públicas de ELO ni los auxiliares RLS**.

## Pendientes

- Pruebas con sesión real de replayer en navegador al empezar a publicarse manos.
- Revisar `shared_hands` INSERT: hay políticas permisivas superpuestas para `authenticated` que permitirían `created_by` NULL; corregir junto a frontend al validar compartir manos.
- Revisar las funciones SECURITY DEFINER de usuarios autenticados individualmente; no revocar permisos masivamente.
- Evitar revelar otros datos de estadísticas o claims sensibles en funciones públicas.
