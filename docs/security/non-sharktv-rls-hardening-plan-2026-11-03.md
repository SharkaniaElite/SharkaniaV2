# Sharkania — permisos críticos sin SharkTV (3 nov 2026)

> **Estado: PROPUESTA / NO APLICADA.** SharkTV se excluye expresamente porque se retirará del producto. No invertir esfuerzos en nuevas protecciones para ese módulo; su eliminación real se planificará aparte y nunca con pérdida de compras o accesos históricos sin evaluación.

## Hallazgos confirmados en producción (consultas read-only)

Las consultas a `pg_policies` y `has_table_privilege` confirman privilegios de tabla que, combinados con políticas RLS permisivas, permiten operaciones más amplias de las esperadas. RLS habilitado no garantiza autorización suficiente:

| Tabla | Problema actual | Corrección propuesta, aún no aplicada |
|---|---|---|
| `tournament_clubs` | `Admin full access tournament_clubs`: `ALL` para `PUBLIC`, `USING true`. Las cuentas anónimas tienen grants DML. | Escritura solo superadmin o admin del club propietario del torneo; conservar consulta pública. |
| `acc_payouts` | `ALL true` para `authenticated` | Superadmin o usuario registrado en `acc_managers`. |
| `acc_player_promo_config` | `ALL true` para `authenticated` | Igual. |
| `acc_player_promo_payouts` | `ALL true` para `authenticated` | Igual. |
| `site_configs` | `ALL true` para `authenticated` | Solo superadmin puede escribir; conservar lectura pública existente. |
| `live_polls` | `ALL true` para `authenticated` | Solo superadmin puede escribir; conservar lectura pública existente. |
| `blog_embeddings` | `ALL true` para `authenticated` | Solo superadmin puede escribir; mantener lectura pública existente provisionalmente, su pertinencia requiere revisión. |

La propuesta de SQL versionada se encuentra en
[`sharkania-non-sharktv-rls-hardening-2026-11-03.proposal.sql`](sharkania-non-sharktv-rls-hardening-2026-11-03.proposal.sql).
**No colocarla en `supabase/migrations/` ni ejecutarla en producción.**
El SQL no modifica ninguna fila y utiliza `BEGIN/COMMIT`, pero sería una alteración real de políticas si se ejecutara: requiere QA aislado, comparación del esquema, aprobación y plan de reversión.

## Matriz de pruebas de seguridad requerida antes de desplegar

| Actor | `tournament_clubs` | ACC contabilidad | `site_configs`, `live_polls`, `blog_embeddings` |
|---|---|---|---|
| `anon` sin cuenta | Solo lectura existente, nunca INSERT/UPDATE/DELETE | Sin operaciones | Solo lectura si hay una política pública |
| Autenticado normal | Consulta, no escribe asociaciones | No consulta ni modifica pagos | No escribe |
| Club admin autorizado | Puede gestionar torneos de su propio club, no ajenos | Sin acceso de finanzas a menos que sea `acc_manager` | No escribe |
| Gestor inscrito en `acc_managers` | Sin permiso de club por ser gestor | Puede operar las 3 tablas según negocio | No escribe |
| Superadmin | Operaciones administrativas autorizadas | Acceso autorizado | Escritura permitida |

**Casos de regresión obligatorios:** alta de torneos, asociaciones automáticas CCP/Latin, edición de ligas y campeón, escritura del chat/encuestas públicas, exportaciones ACC, cambios de configuración, blog/embeddings y compraventa de Shark Coins. No hacer pruebas DML en producción.

## Pendientes que no se corrigen con este primer parche

1. **Stats Espía P0:** columnas económicas de `players`/`tournament_results` y RPCs públicos. Se necesita el corte a RPCs protegidos, prueba por rol y verificación de licencias, sin ocultar los rankings/ELO legítimamente públicos.
2. **`players` y `leagues`:** política INSERT accesible a cualquier sesión autenticada sin validación de administrador; revisar la intención funcional del registro de jugadores y ligas antes de bloquearlo.
3. **`current_league_champion`:** inserción/actualización abierta a autenticados; el trigger de finalización de liga se ejecuta con privilegios de invocador. Requiere diseño conjunto para no romper publicación automática de campeones.
4. **Branching:** las 50 migraciones históricas fueron recuperadas, pero el dump 2026-11-03 es posterior al historial y no permite reproducir el estado anterior a marzo de 2026. El baseline sigue sin resolverse. Los snapshots omitieron `--acl`/`--owner`, por lo que también falta reconstruir los grants. No crear ramas facturables que aún fallarían.
5. **Retiro de SharkTV:** fuera de alcance aquí. Esperar decisión de retiro y plan de preservación de obligaciones históricas.

## Condiciones GO / NO-GO

- [x] Política vulnerable y permisos confirmados mediante metadatos read-only.
- [x] SQL propuesto con controles específicos de propietario y administrador; **fuera de migraciones aplicadas**.
- [x] Pruebas estáticas de alcance añadidas a CI de GitHub.
- [ ] Restaurar la estructura en base aislada correctamente configurada, con `auth`, roles y extensiones.
- [ ] Ejecutar matriz por roles con identidades sintéticas y comprobar bloqueos reales.
- [ ] Resolver posibles regresiones de negocio y permisos de los módulos críticos.
- [ ] Aprobar explícitamente el cambio a producción; respaldo, despliegue y rollback revisados.

**Hasta completar las casillas pendientes, NO-GO para producción.**

## Validación CI RLS — PostgreSQL 17 aislado, resultado exitoso

Nuevo flujo `.github/workflows/core-supabase-rls-qa.yml` con tablas mínimas ficticias y roles `anon`/`authenticated`. Ejecuta los scripts `tests/fixtures/sharkania-rls-qa-setup.sql` y `tests/fixtures/sharkania-rls-qa-assert.sql`, cargando el **SQL propuesto original**, sin conexión a producción.

**Resultado primer run: success** para GitHub Actions en commit `d091ede950ef0630e9d27d5656a02117dcd94a24`. Los cuatro flujos habituales (SEO/access, sitemap, cleanup, TypeScript) también terminaron success. Los tests realizan operaciones de escritura solamente en PostgreSQL 17 efímero con identidades ficticias.

**Límites:** Es una simulación PostgreSQL con tablas mínimas, no un entorno Supabase completo. No verifica auth real, todas las extensiones, triggers de producción, compras ni las 50 migraciones. Sigue NO-GO para aplicar políticas a producción.

## Riesgo adicional de integridad del ranking — confirmado por privilegios y RLS

El rol authenticated tiene privilegio UPDATE para `public.players.elo_rating`, `elo_peak`, `total_prize_won`, `total_buy_ins_spent` y los contadores de torneos. La política `Players: editar propio` permite actualizar la fila donde `profile_id = auth.uid()` sin excluir esas columnas; no existe trigger protector de estadísticas derivadas en `players`. Un jugador autenticado con una fila vinculada podría alterar sus propias estadísticas por la API, aunque la interfaz no lo ofrezca. Además existe una política INSERT para players que exige solamente `auth.uid() IS NOT NULL`. El diagnóstico es de permisos efectivos, sin realizar explotación.

Antes de bloquear estas vías hay que conservar la edición legítima de nicknames/país por club admin y verificar el flujo real de registro de nuevos jugadores, resultados y cálculo ELO. Preparar trigger/permiso por columna y pruebas de regresión en una segunda propuesta aislada; no aplicar aún a producción.

Priorizar integridad del ranking y Stats Espía sobre otras mejoras, manteniendo fuera de alcance los módulos que se retirarán.
