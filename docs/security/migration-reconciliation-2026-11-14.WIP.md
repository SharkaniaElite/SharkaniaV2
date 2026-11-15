# Sharkania — Reconciliación del historial de migraciones (WIP / NO MERGE)

Fecha de preparación: 2026-11-14. Fuente histórica: tabla `supabase_migrations.schema_migrations`, consultada solamente con SELECT. Rama creada desde `main` SHA `d7ea99971cdc76a22b6d0692e46f1bb7b9ff68e6`.

## Alcance

- Producción conserva 54 versiones registradas. No se ejecutó SQL/DDL/DML de migraciones.
- Se recupera el contenido literal de `statements[1]` de 29 versiones ausentes y 3 versiones con nombre de archivo incorrecto; las tres últimas habían sido cotejadas byte por byte antes de renombrar.
- Los tres archivos con versión GitHub distinta se retiran **solo de esta rama**, reemplazándolos por la misma fuente SQL con la versión efectiva de producción.
- Permanecen 11 archivos con versión coincidente pero diferencia de contenido según la auditoría previa; NO se reemplazan automáticamente.
- `supabase/migrations/20261031_secure_batch_blog_views.sql` conserva versión de 8 dígitos y contenido no idéntico a las dos migraciones de sincronización/PostHog inspeccionadas. Permanece intacto y requiere decisión individual.
- El paquete ELO v2 en `docs/security/` NO se agrega a `supabase/migrations` ni se autoriza para producción.
- Se hizo un escaneo automatizado básico de patrones de credenciales y direcciones de correo antes de añadir el SQL histórico; **no sustituye una revisión humana de seguridad previa al merge**.

## Conteo de inventario

| Estado | Cantidad |
|---|---:|
| Migraciones en producción | 54 |
| Archivos previos `supabase/migrations` en main | 26 |
| Versiones coincidentes antes del trabajo | 22 |
| Históricas faltantes restauradas en esta rama | 29 |
| Equivalencias renombradas al ID de producción | 3 |
| Diferencias de contenido aún pendientes | 11 |
| Archivo con fecha anómala pendiente | 1 |

## Tres equivalencias corregidas

| Versión efectiva en Supabase | Versión antigua en GitHub |
|---|---|
| `20261105143347` | `20261105165000` |
| `20261105151342` | `20261105190000` |
| `20261105180002` | `20261105195500` |

## 29 migraciones recuperadas

- `20260320132525_allow_club_admin_update_players.sql`
- `20260320135619_add_club_contact_fields.sql`
- `20260321120051_fix_club_admin_update_players_via_tournaments.sql`
- `20260322113059_create_tournament_templates.sql`
- `20260322121037_bulk_delete_scheduled_tournaments.sql`
- `20260322123712_allow_club_admin_delete_own_leagues.sql`
- `20260331001639_add_slug_columns.sql`
- `20260403193557_create_glossary_table.sql`
- `20260405000159_unified_player_views.sql`
- `20260406064057_create_club_request_function.sql`
- `20260407103120_create_academy_tables.sql`
- `20261031112408_restrict_add_credits_rpc_to_service_role.sql`
- `20261031113149_restrict_acc_backing_deals_to_accounting_managers.sql`
- `20261031113245_remove_authenticated_truncate_trigger_and_references_on_backing_deals.sql`
- `20261031115741_enforce_rpc_authorization_rewards_tournaments_20261031.sql`
- `20261031120716_secure_blog_rewards_once_per_article_20261031.sql`
- `20261031121126_secure_club_ignition_feature_reads_20261031.sql`
- `20261031123934_fix_auth_user_metadata_role_escalation_20261031.sql`
- `20261031124255_block_self_escalation_profiles_rewards_verification_20261031.sql`
- `20261031124412_restrict_remaining_purchase_and_internal_trigger_rpcs_20261031.sql`
- `20261031124639_allow_only_pending_user_verification_requests_20261031.sql`
- `20261031124807_restrict_private_profile_rows_to_self_or_admin_20261031.sql`
- `20261031125423_pin_search_path_on_public_privileged_rpcs_20261031.sql`
- `20261031125806_secure_email_queue_and_server_side_club_confirmation_20261031.sql`
- `20261031125903_capture_club_signup_requests_from_verified_auth_trigger_20261031.sql`
- `20261031130111_limit_public_club_directory_to_approved_20261031.sql`
- `20261031135830_secure_batch_posthog_unique_views_20261031.sql`
- `20261031135902_correct_batch_blog_sync_jsonb_key_count_20261031.sql`
- `20261102213705_restrict_blog_images_to_sharkania_super_admin_20261102.sql`

## Puertas para avanzar

1. Comparar con cuidado las 11 discrepancias; documentar sus implicaciones. No asumir equivalencia semántica.
2. Resolver aisladamente el archivo de ocho dígitos antes de habilitar instalación desde una base vacía.
3. Pasar escaneo de secretos adicional y verificar reproducibilidad en entorno aislado, **sin** ejecutar sobre producción.
4. Revisar y aprobar por separado el PR de reconciliación antes de cualquier merge.

**Estado de lanzamiento ELO v2: NO GO.** Issue #98 y PR #95, #96, #97 no cambian.


## Verificación detallada adicional del 14-11-2026

Tras el commit se comprobó por lectura del catálogo de Supabase y la rama de GitHub que existen exactamente **54 archivos con identificador válido de 14 dígitos**, una versión por cada una de las **54 versiones productivas**, sin versiones sobrantes ni faltantes. Existe un archivo adicional con versión anómala de 8 dígitos.

Los 22 archivos que ya compartían identificador con producción se cotejaron: **11 SQL idénticos** y **11 distintos**. No se modificó ninguno de estos 22.

### Cuatro diferencias compatibles con comentarios o formato, NO certificadas como equivalentes

Una eliminación automática preliminar de comentarios de línea y espacios deja coincidencia textual en las siguientes cuatro versiones. No equivale a comparar AST ni a ejecutar QA; **no se deben sustituir todavía**.

- `20261031151554` — RLS interna de contador de manos.
- `20261031153006` — Propiedad y privilegios de manos compartidas.
- `20261031154647` — Identificadores fuertes de manos compartidas.
- `20261031155504` — Restricción de lectura a propietarios.

### Siete discrepancias con diferencias restantes de SQL

| Versión | Caracteres en SQL guardado en Supabase | Caracteres en archivo GitHub | Área |
|---|---:|---:|---|
| `20261031143409` | 2.455 | 3.079 | Políticas y función de protección de clubes |
| `20261031145349` | 1.727 | 2.711 | Reclamación de misiones automáticas |
| `20261031145511` | 2.500 | 2.502 | Políticas y actualizaciones de misiones |
| `20261031145750` | 3.634 | 9.764 | Academia: completar lección, desbloquear módulo y aprobar misión |
| `20261031145859` | 2.897 | 3.216 | Recompensas y protecciones de academia |
| `20261031151248` | 2.004 | 2.151 | Contador de visitas de manos compartidas |
| `20261031151446` | 550 | 630 | Corrección de función del contador |

**No inferir equivalencia o incompatibilidad por el tamaño.** Algunos archivos GitHub presentan definiciones de estado final frente a un script histórico que lo ajustaba dinámicamente; requieren lectura y validación aislada. El mayor diferencial corresponde a `20261031145750`.

### Archivo de ocho dígitos

`supabase/migrations/20261031_secure_batch_blog_views.sql` crea o reemplaza `public.sync_blog_unique_views`. Está relacionado con la migración histórica `20261031135830`, pero **no contiene texto idéntico**; tampoco equivale a `20261031135902`. Conservarlo para revisión independiente, sin renombrar ni ejecutar por inercia.

### Estado de autorización

Esta rama es preparación documental e histórica exclusivamente en GitHub. Ningún SQL de la rama ha sido ejecutado; ningún PR fusionado; sin cambios en Supabase producción, Cloudflare, Edge, cron o flags. No abrir PR de merge ni ejecutar replay de migraciones antes de resolver los bloqueos indicados.

## Análisis de las siete discrepancias restantes — 14-11-2026

Revisión comparativa de SQL histórico de Supabase frente a archivos de esta rama, incluyendo consulta **solo lectura** al catálogo de funciones y políticas productivas. **No constituye un ensayo de migraciones ni aprobación para merge**.

| Versión | Diferencia confirmada | Evaluación y acción |
|---|---|---|
| `20261031143409` | GitHub agrega cuatro `DROP POLICY IF EXISTS` inmediatamente antes de volver a crear las mismas cuatro políticas de `club_admins`; el SQL guardado en Supabase usa `BEGIN/COMMIT` que no están en el archivo. Las cuatro políticas finales están presentes hoy en el catálogo productivo. | Idempotencia añadida probable. Revisar límites transaccionales en test aislado; no sustituir. |
| `20261031145349` | Supabase modifica el texto de `claim_auto_mission(uuid)` con un bloque `DO`, mientras GitHub contiene la definición completa `CREATE OR REPLACE FUNCTION`. | La definición completa de GitHub coincide token por token con la definición **actual** de PostgreSQL, salvo punto y coma final. Conservar hasta probar la reconstrucción. |
| `20261031145511` | Cambia el orden de condiciones `AND`, el delimitador de la función y el tratamiento explícito/implícito de `SECURITY INVOKER`. | Guardas similares, no idénticas textualmente. `guard_player_mission_client_updates()` es `SECURITY INVOKER` hoy. Validar políticas en clon aislado. |
| `20261031145750` | Supabase cambia dinámicamente definiciones existentes; GitHub almacena las definiciones completas de tres funciones. | `academy_complete_lesson` y `approve_mission` coinciden con las funciones productivas actuales, salvo terminador. `academy_unlock_module` **cambió posteriormente** mediante la migración `20261031160943`, cuyo cuerpo final coincide con el de producción. Nunca reemplazar esa corrección. |
| `20261031145859` | GitHub añade cinco `DROP POLICY IF EXISTS` antes de sus `CREATE POLICY`, cambia el delimitador de un cuerpo de función y omite `SECURITY INVOKER` explícito. | `guard_academy_lesson_rewards()` es `SECURITY INVOKER` en producción. Probar secuencia en ambiente aislado; no sobrescribir migración. |
| `20261031151248` | GitHub ya utiliza `ON CONFLICT ON CONSTRAINT hand_view_cooldowns_pkey`; la versión histórica de Supabase tenía `ON CONFLICT (hand_id, viewer_id)`. | La migración productiva posterior `20261031151446` corrige esa expresión. La definición actual de `increment_hand_views(text)` coincide con el archivo GitHub de `20261031151248`, salvo terminador; queda por probar la secuencia completa. |
| `20261031151446` | Diferencias de comentarios y formato. | Secuencia de tokens SQL equivalente al SQL registrado; la corrección se mantiene. |

Se verificó además que `20261031160943` sigue intacta, y que la definición completa de `academy_unlock_module` allí coincide token por token con la versión productiva actual, salvo terminador.

**Otros cuatro archivos** (`20261031151554`, `20261031153006`, `20261031154647` y `20261031155504`) mostraron igualdad tras omitir comentarios y espacio en una comparación preliminar. No se reemplazaron.

### Archivo histórico con identificador de ocho dígitos

El archivo original `20261031_secure_batch_blog_views.sql` era una copia documental de estado final, no una migración válida de 14 dígitos; incluía `public.sync_blog_unique_views` y privilegios. Su cuerpo de función coincide token por token con el catálogo productivo actual (el archivo contiene además comandos de permisos). El historial efectivo quedó recuperado por separado con las versiones `20261031135830` y `20261031135902`. Los permisos actuales de ejecución de la función son para `authenticated`, `postgres` y `service_role` (consulta al catálogo).

Para impedir que una copia sin versión histórica correcta se confunda con otra migración, se trasladó **su mismo blob Git, sin editarlo**, desde `supabase/migrations/20261031_secure_batch_blog_views.sql` a `docs/security/reference-only/20261031_secure_batch_blog_views.LEGACY_MIRROR.sql`. Es **referencia histórica y no debe ejecutarse**. No se alteró el contenido, los dos archivos de migración recuperados ni la función en producción.

**Control de calidad pendiente**: ningún conjunto de 54 archivos demuestra por sí solo que una base vacía pueda reconstruir todo Sharkania. Existen dependencias y estado anterior al primer registro de marzo; hay que validar con una base de referencia **aislada** antes de habilitar la rama para merge. Evitar pruebas de autenticación/ELO duplicadas ya aprobadas; evaluar únicamente compatibilidad de la reconstrucción y los cambios concretos.

**Reglas NO GO:** sin merge, sin SQL de migraciones sobre Supabase real, sin Edge, cron ni flags; PR #95/#96/#97 no afectados.
