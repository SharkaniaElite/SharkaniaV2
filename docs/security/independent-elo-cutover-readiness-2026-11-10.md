# SHARKANIA — PR #96, corte de ELO compartido y conservación del panel Admin

**10 de noviembre de 2026 — únicamente QA / PR DRAFT apilado sobre #95. NO GO A PRODUCCIÓN.**

## Qué se ha preparado

- **Servidor independiente:** `docs/security/independent-results-atomic-v1-2026-11-10.CANDIDATE.sql` agrega `publish_independent_nickname_results_guarded(uuid,jsonb)`. Solo primera publicación **USD** de torneo sin liga, actor validado por `auth.uid()` y `is_club_admin(club_id)`/superadministrador, nicknames normalizados por sala, posiciones consecutivas, montos/entradas validados, bloqueo de torneo y jugadores, rechazo de competiciones posteriores ya publicadas.
- **Atomicidad:** la publicación realiza en un solo COMMIT alta de jugadores, ELO `legacy-js-v1`, resultados, historial, acumulados, perfil unificado, estado del torneo y ledger privado inmutable con checkpoints. La bitácora USD registra entradas reales; `players.total_buy_ins_spent` sigue sumando una entrada por torneo por compatibilidad **con el código legado**. Ajustar esa presentación requiere aprobación deportiva aparte.
- **Permisos de API:** `docs/security/independent-elo-rest-lockdown-2026-11-10.CANDIDATE.sql` revoca INSERT/UPDATE/DELETE de `players`, `elo_history` y `tournament_results` a roles cliente; mantiene únicamente UPDATE de `players.nickname` y `country_code` según RLS existente; el cierre directo de torneo independiente se protege con trigger. La migración actual del PR #95 sigue protegiendo ligas y standings.
- **Administración:** el inventario de escrituras detectó tres actualizaciones directas a `players.profile_id` en `src/pages/super-admin.tsx`. Para no romper vinculación/desvinculación ni reclamaciones, `docs/security/admin-player-link-guarded-2026-11-10.CANDIDATE.sql` crea `admin_link_player_profile_guarded`: exige superadministrador, impide robar una cuenta ya vinculada y confirma en una transacción el perfil y la reclamación pendiente. El método manual deja constancia `admin-claim`.
- **Cliente preparado:** `src/lib/api/guarded-independent-results.ts` y `src/lib/api/guarded-admin-player-link.ts`; rutas protegidas en CSV, editor y pantalla superadministradora. Requiere **ambas** `VITE_LEAGUE_GUARDED_RPC=true` y `VITE_INDEPENDENT_RESULTS_GUARDED_RPC=true` para activarse, nunca como única modificación. Los flags están apagados por defecto; fallos de RPC no usan fallback de escritura directa.

## Evidencia y alcance de QA

1. El SQL de publicación inicial y el cierre ACL pasaron en PostgreSQL 17 ficticio, incluyendo club autorizado/ajeno, CLP rechazado, cronología, idempotencia, identidad nickname, dos participantes, bitácora de reentradas y conservación de historia de ligas.
2. Sobre **GoTrue y PostgREST locales reales, sin enlace remoto**, cuatro actores ficticios confirmaron HTTP de publicación USD, superadministrador, denegación de propietario de fila al editar ELO o insertar historial/resultados, edición permitida de nickname y bloqueo de finalización manual. El fixture posterior verifica además vinculación de nicknames bajo JWT reales.
3. Pruebas adicionales prueban aprobación y desvinculación de claims en una sola transacción y **fault injection** en el INSERT de `elo_history`, verificando rollback de jugadores, resultados, ELO, auditoría, premios y torneo ante fallo tardío.
4. TypeScript y contratos estáticos impiden fallback en las rutas protegidas. Las suites de PR #95 siguen ejecutándose para prevenir regresión.
5. **Importante:** una prueba PG17 o Supabase CLI aislado no es una copia restaurada de producción. No hemos hecho DML en el proyecto real ni comparado el resultado contra Auth, FK, permisos, índices y funciones reales del proyecto restaurado.

## Bloqueos antes de siquiera proponer un GO

- [ ] Revisar **todos** los consumidores legítimos de `players`, `profiles.unified_elo`, `nickname_claims`, `tournament_results` y las RPC `SECURITY DEFINER`, no solo los escritorios de administración observados.
- [ ] Confirmar el tratamiento funcional de CLP/EUR y de torneos independientes ya publicados. Hoy la ruta protegida bloquea moneda no USD, edición y reversión; no hay replay histórico validado. Las 3.576 discontinuidades ELO históricas detectadas en la investigación anterior impiden reconstrucciones optimistas.
- [ ] Validar simultaneidad real con jugadores compartidos **liga ↔ independiente**, fecha y orden de bloqueos, rollback tras fallos y paridad exacta del motor v1 sobre una muestra histórica conocida.
- [ ] Revisar que el modelo de reclamos de nicknames conserve toda regla de negocio, la sincronización eventual de ELO materializado y las consecuencias de enlaces/desenlaces históricos.
- [ ] Preparar una **única migración versionada y revisada** a partir de #95+#96, sobre un clon fiel restaurado y aprobado económicamente; verificar grant/owners, RLS, triggers, Auth/REST, permisos de escritura de todas las rutas y rollback sin reabrir accesos inseguros.
- [ ] Aprobar específicamente costo del clon, después migración a producción y separadamente despliegue de frontend/flags con plan de ventana de corte y monitoreo.

**No ejecutar SQL de `docs/security/*.CANDIDATE.sql` sobre Supabase productivo. No fusionar PR #95/#96, no migrar, no activar flags ni desplegar.** Todo el material se preparó en ramas QA para revisión. La publicación actual de torneos independientes sigue intacta porque la nueva ruta está apagada.

Referencias: [PR #95 — base Release A](https://github.com/SharkaniaElite/SharkaniaV2/pull/95) · [PR #96 — escritor independiente y permisos](https://github.com/SharkaniaElite/SharkaniaV2/pull/96) · [checklist GO/NO-GO maestro](https://github.com/SharkaniaElite/SharkaniaV2/issues/81).
