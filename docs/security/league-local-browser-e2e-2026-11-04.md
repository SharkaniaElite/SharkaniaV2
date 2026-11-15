# Sharkania — prueba del formulario real en navegador (solo localhost)

**Estado: herramienta de QA preparada, NO ejecutada aún.** El objetivo es probar el `LeagueForm` real de React con Supabase Auth/REST y las 64 tablas en una instancia **local separada** de producción. Esto no es un permiso para activar el flag en Cloudflare.

## Guardas

- El ensayo se encuentra en `tests/e2e/league-form-local.html` y solo se sirve desde **Vite dev**. No forma parte del build `index.html` publicado por Pages.
- `tests/e2e/league-form-local.tsx` se niega a funcionar si la página no es `localhost/127.0.0.1`, si Vite no está en modo DEV, si falta `VITE_LEAGUE_GUARDED_RPC=true` o si `VITE_SUPABASE_URL` no es **HTTP localhost/127.0.0.1**.
- Usa exclusivamente la clave **publishable/anon** de Supabase local en el navegador; **nunca** secret/service_role.
- No poner cuentas reales, datos productivos, ni publicar el puerto local en Internet.
- El preview Cloudflare de PR #65 contiene en su JavaScript compilado la **referencia Supabase de producción**, confirmada por lectura de artefacto público. No se debe utilizar para pruebas con escritura.

## Prerrequisitos aún por cerrar

1. Instancia Supabase **completa e independiente de la QA habitual**: PostgreSQL de pruebas con las 64 tablas, Auth/REST funcionales, RLS/grants/trigger real y migración Release A instalada solo allí.
2. Cuatro cuentas ficticias y dos clubes ficticios; el usuario de pruebas debe administrar un club organizador. No se copian registros productivos.
3. Checkout separado de la rama `security/league-guarded-release-a-2026-11-04` y `npm ci`.
4. Configuración `.env.local` **solo dentro de ese checkout**, `VITE_SUPABASE_URL=http://127.0.0.1:<PUERTO_LOCAL_API>`, `VITE_SUPABASE_ANON_KEY=<PUBLICABLE_LOCAL>`, `VITE_LEAGUE_GUARDED_RPC=true`. Nunca subir `.env.local` a Git.
5. Al probar **el login completo** del panel (no el harness), utilizar la **sitekey de test de Cloudflare Turnstile** `1x00000000000000000000AA` **solo en localhost**, con configuración de captcha local adecuada; no cambiar Turnstile productivo.

## Uso cuando se cumplan los prerrequisitos

Desde el checkout de **pruebas**, ejecutar `npm run dev -- --host 127.0.0.1` y abrir en el navegador:

`http://127.0.0.1:5173/tests/e2e/league-form-local.html`

El puerto de Vite puede variar; usar el puerto mostrado por el comando. El harness pide únicamente credenciales ficticias locales y carga las ligas/clubes del usuario autenticado. Probar: (a) creación con fechas y salas; (b) edición y reemplazo de salas; (c) lectura y denegación en club participante; (d) rechazo de datos inválidos y permanencia del estado. Comparar con el resultado en PostgreSQL QA.

Para completar el **E2E del panel entero**, abrir la ruta `/club-admin` en el mismo servidor Vite, comprobar login local con Turnstile de prueba, estados de pantalla, enlaces y errores; usar el checklist de `league-release-a-go-no-go-2026-11-04.md`.

**No basta con que la herramienta abra**: se debe guardar evidencia HTTP/RLS, capturas visuales y confirmación de que el backend es efectivamente QA antes de cerrar el gate.

**No aplicar a producción ni actualizar flags de Cloudflare hasta aprobación expresa.**
