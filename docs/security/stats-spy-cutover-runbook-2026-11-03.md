# Sharkania — Stats Espía: migración controlada y regresiones

**Fecha:** 2026-11-03  
**Estado:** plan técnico e implementación parcial en PR #64, sin ejecutar SQL ni alterar producción.  
**Proyecto:** Supabase `nhpjzywfzljtlqaigzed` / React-Vite / Cloudflare Pages.

## Diagnóstico comprobado

1. `public.players`, `public.tournament_results` y `public.elo_history` tienen RLS habilitado **y políticas SELECT a PUBLIC con `USING (true)`**. RLS no limita una lectura cuando hay una política permisiva aplicable.
2. Los permisos de columnas actuales incluyen `anon SELECT` sobre `players.total_prize_won`, `players.total_buy_ins_spent`, `tournament_results.prize_won`, `tournament_results.buy_ins_count`.
3. `public.get_unified_player_stats(p_slug)` es `SECURITY DEFINER`, ejecutable por `anon`, devuelve premios y gastos; no valida la compra premium.
4. `public.get_unified_elo_history(p_slug)` es `SECURITY DEFINER` y ejecutable por `anon`, aunque el historial ELO parece formar parte del ranking público.
5. **`public.get_unified_ranking` también devuelve `total_cashes`, `total_wins` y `total_prize_won` como información de la clasificación pública.** El SELECT interno usa `SELECT * FROM players`, por lo que revocar columnas de `players` sin modificar esta función provocaría errores.
6. `src/lib/api/players.ts` usa `select(BASE_PLAYER_SELECT)` con `*`, y las consultas históricas también usan `*`. Las columnas públicas y premium requieren separación expresa.
7. La interfaz muestra Cashes/ITM/Victorias como premium aunque la clasificación los presenta públicamente; debe definirse un contrato de producto honesto y consistente.
8. La RPC `public.check_feature_access(user, feature)` **sí valida `auth.uid() = p_user_id`**. Está permitida a autenticados y denegada a anónimos. El nuevo acceso premium reutiliza el esquema `user_purchases`, pero deriva el usuario de `auth.uid()` sin parámetros de usuario controlables.

Fuente: consultas de solo lectura `pg_policies`, `pg_proc`, `has_column_privilege` y código vigente del repositorio. La revisión no equivale a una prueba de penetración completa.

## Cambios que ya pueden validarse sin SQL

- 13 páginas no críticas separadas en chunks dinámicos (`src/App.tsx`), sin cambiar las rutas.
- Consulta gratuita del historial reducida a **dos filas**; acceso comprado conserva historial completo; caché segregada por usuario y estado de compra. **Esto disminuye la descarga, pero no impide el acceso directo por API pública.**
- Consultas del carrito, compras, créditos y derechos de acceso con claves de caché aisladas por cuenta para no reutilizar resultados tras cambiar de usuario.
- Imagen principal de Arena marcada `fetchPriority=high`; fondos inferiores siguen diferidos.
- La propuesta SQL `docs/security/stats-spy-guarded-rpcs-2026-11-03.proposal.sql` aporta dos RPC con autorización de licencia o superadministrador, parámetro slug y paginación de historial. **No está ejecutada ni garantiza exclusividad mientras los datos base sigan públicos.**

## Activación en fases (sin cortar el ranking)

**Fase 0 — inventario de datos.** Definir explícitamente qué se vende. Recomendación: conservar público ELO, torneos, resultados deportivos y cifras ya mostradas en el ranking; reservar para Stats Espía cálculos financieros, series comparativas e informes que no proceden directamente de campos públicos. Si los premios por torneo deben ser públicos, el ROI será inferible; vender su análisis/visualización, no una supuesta exclusividad absoluta.

**Fase 1 — servicios en entorno aislado.** Aplicar solo RPC nuevas de propuesta; verificar mediante sesiones de prueba: `anon` sin permiso EXECUTE, usuario autenticado sin licencia devuelve 42501, licencia caducada falla, licencia activa recibe únicamente el jugador solicitado y superadmin accede. Comprobar que `search_path` y sus objetos están cualificados. No utilizar credenciales ni tokens por chat.

**Fase 2 — clientes públicos.** Sustituir `SELECT *` por listas explícitas; sustituir o ajustar `get_unified_ranking` (invoker, suma premios) y `get_unified_player_stats` para no enviar datos financieros a anónimos. Auditar `compare`, administración, dashboard, ligas, exportaciones CSV y endpoints RPC relacionados.

**Fase 3 — datos privados.** Revocar privilegios de tabla completa y conceder solo columnas públicas necesarias para `anon` y `authenticated`, manteniendo políticas RLS y permisos de administradores. Si una vista presenta información pública, usar `security_invoker=true`. Para métricas sensibles, utilizar la función autorizada o tablas `private` segregadas del API público. Se requiere revisar y ajustar todos los clientes antes de hacer `REVOKE` para evitar errores de consulta.

**Fase 4 — desactivar vías antiguas.** Revocar EXECUTE de RPC heredadas que exponen datos premium; migrar su funcionalidad pública a versiones minimizadas. No retirar `get_unified_elo_history` antes de verificar su uso en perfiles públicos.

**Fase 5 — despliegue.** Migración compatible + cambios de código sobre rama y base de datos de prueba. Probar alta/baja de suscripción, caducidad, cambio de cuenta, cierre de sesión y enlaces directos REST. Verificar posicionamiento SEO, rutas, índices, resultados públicos, compras y cargos. Revertir migración de acceso si hay regresión; conservar respaldo de grants y cuerpos RPC previos.

## Condiciones de aceptación

| Caso | Resultado esperado |
|---|---|
| Anónimo invoca `stats_spy_get_summary_v1` | Permiso denegado, sin datos |
| Autenticado sin licencia invoca RPC | 42501, sin datos |
| Licencia vencida o desactivada | 42501, sin datos |
| Usuario con licencia activa | Resumen e historial solo mediante RPC autorizada |
| Superadmin autenticado | Acceso administrativo explícito |
| Cambio de cuenta en mismo navegador | No mostrar caché premium de la sesión anterior |
| `/ranking`, `/calendar`, `/clubs`, `/leagues` en anónimo | Sin fallos de permisos |
| Al menos 49 torneos SEO prioritarios | URL/metadata sin cambios por política de datos |
| Exportaciones de liga y consultas admin | Funcionan con permisos y consultas ajustados |
| Desglose de Stats Espía | No accesible mediante tabla/RPC/vista pública alternativa |

## Restricciones

**Ninguna política, grant, tabla, función ni dato de producción fue modificado.** La aplicación de la fase de permisos requiere autorización y pruebas con cuentas de ensayo en un entorno de base de datos aislado. Un `REVOKE` directo en producción antes de adaptar `get_unified_ranking` rompería la clasificación y está expresamente descartado.

Referencia: [Supabase — Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security) y [Supabase — Security Definer Advisor](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable).


## Costo real del entorno aislado — comprobado 3 noviembre de 2026

El proyecto `nhpjzywfzljtlqaigzed` pertenece a la organización `SharkaniaV2` (`dhlmdmgqejjrtozibqrg`). `get_cost(type=branch)` confirmó **US$0.01344 por hora** de Compute Micro.

- Sin cargo fijo inicial de rama; se cobra mientras existe.
- Otros consumos potencialmente facturables: disco, tráfico/egress y Storage; depende de la utilización.
- Los créditos de Compute del plan Pro **no se aplican a Branching Compute**; Branches **no están protegidas por el Spend Cap**.
- La inspección de `list_branches` confirmó cero ramas abiertas antes de este trabajo.
- **No se creó ninguna rama**, ni se aprobó un gasto. El coste solo empezaría al crearla.
- La rama de prueba no copia automáticamente los datos reales de producción. Preparar fixtures sanitizados para las pruebas de permisos.

Referencia oficial: https://supabase.com/docs/guides/platform/manage-your-usage/branching

## Mejoras sin costos de infraestructura

- Historial premium preparado para solicitar **30 resultados por página** mediante `useInfiniteQuery`; botón «Ver 30 resultados más» con carga bajo demanda y separación de caché por usuario. No hay consultas a la RPC protegida mientras `VITE_STATS_SPY_SECURE_RPC` esté desactivado.
- `src/main.tsx`: PostHog y Clarity solo arrancan en `sharkania.com` y `www.sharkania.com`; las vistas previas Pages ya no contaminan las métricas de producción. Clarity usa importación dinámica tras el evento de carga.
- `tests/stats-spy-contract.test.mjs` añade validación automática de contrato de los RPC, paginación y semántica de autorización; expone explícitamente tres tareas pendientes como `test.todo`.
- `tests/analytics-preview-isolation.test.mjs` protege el aislamiento de la analítica y la carga diferida en el pipeline existente.
- Consulta de solo lectura de `pg_indexes` y `EXPLAIN`: el plan de Kolonvo usa `idx_players_slug` y `idx_tournament_results_player`; el orden por `created_at` requiere `Sort` de un número estimado de 11 filas. **No se propone otro índice de inmediato**: la ganancia no está demostrada a la escala actual.
- La propuesta de RPC resumen replica el cálculo heredado de buy-ins que contempla reentradas, con fallback a totales del jugador si los resultados son incompletos. Aún debe validarse el tratamiento de múltiples divisas antes de activar informes de ROI.

**Criterio de salida:** solo desplegar fase final cuando exista prueba de cuatro identidades (anónimo, sin licencia, licencia activa y superadmin), permisos SQL explícitos, rollback ensayado y revisión del propietario.
