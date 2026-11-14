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
