# Cierre de privacidad de manos compartidas — 31/10/2026

La aplicación anterior protegía la página `/tools/replayer/h/:id` con inicio de sesión, pero Supabase exponía por REST todo el contenido de `shared_hands` a visitantes anónimos y usuarios registrados. Tener una ruta React protegida no protege la API.

## Decisión implementada

- **Compartir por enlace, no publicar una lista:** la mano completa se obtiene mediante `public.get_shared_hand(p_hand_id)` para usuarios autenticados que conocen el ID.
- El RPC está protegido con `auth.uid()`, tiene `search_path=''` y `EXECUTE` restringido a `authenticated` y `service_role`.
- Nuevas manos usan IDs UUID de 128 bits; el RPC sigue aceptando los IDs históricos de 8 caracteres. No existían manos antiguas almacenadas al realizar el cambio.
- `shared_hands` permite SELECT directo solamente sobre filas propias. `anon` pierde SELECT sobre la tabla.
- Se mantiene la inserción limitada a `hand_data, hand_summary` con propietario asignado por Supabase, y el contador una vez cada 24h para usuarios autenticados.

## Secuencia de publicación

1. Supabase versión `20261031154647`: instalar el RPC y IDs fuertes sin tocar lectura anterior.
2. PR #20: sustituir la lectura directa por el RPC en React; **cuatro checks GitHub y Cloudflare Preview exitosos**, merge a `main`, Cloudflare Production correcto.
3. Supabase versión `20261031155504`: cerrar SELECT anónimo y limitar SELECT autenticado a propietarios.

## Verificación (transacciones revertidas)

- Inserción con sesión autenticada: id aleatorio de 36 caracteres, propietario correcto y lectura propia.
- Segundo usuario autenticado: SELECT directo no muestra la mano de otro; RPC devuelve el contenido al presentar su identificador exacto.
- Usuario anónimo: no puede ejecutar el RPC ni leer la tabla.
- No había datos de manos previos; las pruebas no dejaron manos guardadas.

## Próximos temas

- Probar el botón «Compartir mano» con un navegador real y otro usuario registrado, especialmente después de que caducan las sesiones.
- Reducir errores TypeScript de `src/lib/hand-parsers` y `src/lib/replayer-engine.ts`.
- Considerar una política de privacidad/retención del contenido, porque jugadores que conocen un enlace pueden seguir consultándolo; la opción de revocar enlaces requeriría gestión del autor desde su panel.
