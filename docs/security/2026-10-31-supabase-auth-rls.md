# Auditoría RLS de perfiles y clubes — 31 de octubre de 2026

Este documento registra **verificaciones realizadas contra producción** mediante sesiones de rol simuladas, y las restricciones aplicadas en la migración de Supabase `20261031143409`.

## Estado y hallazgos

- Supabase: proyecto `nhpjzywfzljtlqaigzed`, estado `ACTIVE_HEALTHY`, suscripción Pro.
- 188 perfiles, 10 clubes (7 aprobados) y 10 asignaciones de administradores. Las pruebas se ejecutaron en transacciones con `ROLLBACK` y se confirmó que los recuentos se conservaron.
- **Jugador autenticado:** solo puede consultar su propio perfil (1 registro), ningún registro de `club_admins` y los 7 clubes públicos aprobados.
- **Superadministrador:** puede consultar los 188 perfiles, las 10 asignaciones y los 10 clubes.
- **Administrador de club:** puede consultar su perfil y los administradores de su club, pero no crear asignaciones ni modificar el estado de aprobación; puede editar la descripción normal de su club.
- Los intentos simulados de un jugador de elevarse a `super_admin`, sumarse Shark Coins o crear un club ya aprobado fueron denegados.
- La política anterior `Clubs: insertar autenticado` permitía a cualquier cuenta iniciar una inserción directa, y `Club admins: lectura publica` exponía todas las asignaciones. Ambas se sustituyeron.
- Los endpoints normales de solicitudes de clubes (`club_registration_requests`) permanecen operativos; la aprobación y creación final corresponden al superadministrador.

## Pruebas futuras

1. Repetir con cuentas de jugador y club admin reales en una instancia de prueba, no sobre datos reales.
2. Verificar el circuito completo de registro de club, correo de confirmación y aprobación con dos sesiones distintas.
3. Auditar las restantes funciones `SECURITY DEFINER` antes de cambiar sus permisos; algunas soportan rankings públicos.
4. Activar la protección de contraseñas filtradas en **Supabase → Authentication → Sign In / Providers → Email → Prevent use of leaked passwords**. Esta configuración de Auth no se modifica por una migración SQL. Reejecutar Security Advisor para confirmar que desaparece `auth_leaked_password_protection`.

**No** copiar claves de Supabase ni credenciales a GitHub, archivos de prueba o incidencias.
