# Protección de manos compartidas — 31/10/2026

## Corrección aplicada a Supabase Pro

- Las dos políticas de inserción permisivas y redundantes se reemplazaron por una única política `INSERT TO authenticated WITH CHECK (created_by=auth.uid())`.
- `created_by` recibe por defecto `auth.uid()` en PostgreSQL. El frontend actual en `src/lib/replayer-engine.ts` **ya inserta solamente** `hand_data` y `hand_summary`, por lo que no requiere un cambio de interfaz. La identidad se asigna y valida en la base de datos, no en el navegador.
- Se retiraron privilegios excesivos de `shared_hands`: los usuarios solo pueden insertar `hand_data` y `hand_summary`; no pueden introducir ID, autor, visitas o fecha arbitrarios ni ejecutar UPDATE/DELETE/TRUNCATE.
- El SELECT público se conserva para enlaces compartidos. **Consideración de privacidad pendiente:** el Data API permite obtener el contenido de las manos a cualquier visitante, aunque la ruta React de replayer compartido pida iniciar sesión; decidir explícitamente si deben seguir siendo públicas o limitarse a enlaces de acceso controlado.
- No se modificó la FK `shared_hands_created_by_fkey`: utiliza `ON DELETE SET NULL`, por lo que `created_by` continúa siendo nullable para registros cuyo propietario sea eliminado.

## Validaciones realizadas — transacciones revertidas

- Inserción normal desde una sesión `authenticated`, con las mismas columnas que envía React: éxito, ID generado y `created_by` del usuario firmado.
- Intento de falsificar `created_by` y de insertar `views=999999`: ambos rechazados.
- Intento de inserción `anon`: rechazado.
- La misma sesión puede leer la mano recién creada e incrementar el contador con `increment_hand_views` una vez, sin inflarlo con una recarga inmediata.
- `shared_hands` tenía 0 registros de producción, y las pruebas no dejaron filas persistidas.

La migración replica el estado aplicado bajo el número de versión Supabase `20261031153006`; **no volver a ejecutarla contra producción** desde un CI automático.
