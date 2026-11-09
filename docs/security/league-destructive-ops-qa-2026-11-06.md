# SHARKANIA — Legacy destructive operations: isolated fail-closed QA
**6 November 2026. Draft design, NOT a production migration.** This note does not authorize merging PR #65, restarting Supabase, enabling `VITE_LEAGUE_GUARDED_RPC`, or executing SQL against the real database.

## Why a protection is needed

Read-only inspection of the real production definitions found:
- `delete_tournament_god_mode(uuid)` has `SECURITY DEFINER`; for a league tournament it deletes Elo history, tournament results and the tournament, then performs `DELETE FROM league_standings` and inserts a rebuilt ranking. Existing league row IDs, CCP metadata and buy-in fields can be lost. The current UI is allowed to call this function for club administrators.
- `reset_tournament_impact(uuid)` has `SECURITY DEFINER`; it deletes tournament results and Elo history, but does not atomically recalculate league standings. The old editor depends on later operations.
- `recalculate_league_standings(uuid)` deletes and recreates rankings. `update_league_standings(uuid)` can rewrite ranking fields. **Both also require coordinated revocation / replacement**, not just tournament wrappers.
- `bulk_delete_scheduled_tournaments(uuid[])` removes scheduled/no-upload tournaments without checking that no result rows exist; the bulk client preflight is not a server security boundary.

## Isolated QA-only prototypes

1. `docs/security/league-legacy-destructive-delete-fence-2026-11-06.qa-only.sql` installs a guarded `BEFORE DELETE` trigger on fake `tournaments`, `tournament_results`, `elo_history`, and `league_standings`. For a tournament associated with any league, deletion is rejected (HTTP `409` style SQLSTATE `PT409`); all direct rank deletions are rejected. The result/Elo triggers lock the corresponding tournament row for race safety. The trigger function is not executable directly by API roles.
2. `tests/fixtures/sharkania-league-legacy-destructive-fence-qa.sql` uses the synthetic PostgreSQL 17 dataset, creates minimal SECURITY DEFINER **call-order mocks**, confirms a historical league tournament cannot be deleted/reset or lose Elo, standings or result rows, confirms an unrelated unlinked tournament can still be deleted, and rolls everything back.
3. `docs/security/tournament-league-link-guard-2026-11-06.qa-only.sql` additionally rejects **any association or club change** of a tournament which already has result rows, Elo records or `results_uploaded=true`, even if initiated by the primary organizer. Otherwise a completed tournament could be quietly detached from a league without deleting its result rows and thereby distort its standings. New, empty tournaments remain linkable/detachable by the legitimate organizer.
4. `tests/fixtures/sharkania-tournament-link-guarded-qa.sql` and `sharkania-tournament-link-real-auth-qa.mjs` test the same distinction through isolated PostgreSQL and genuine local GoTrue/PostgREST, using synthetic users only.

## Boundaries and GO/NO-GO

- These tests prove the **behavior of our proposed QA fences and call-order mocks**, not an end-to-end production rewrite of the full legacy functions. The actual production definitions are not altered.
- Blocking delete/reset for all league-affiliated tournaments **intentionally interrupts** old workflows, so it cannot be deployed alone. A protected end-to-end writer must handle upload, correction, deletion, stats, league standings, ELO, and historical rows under a coordinated transaction and authorization protocol. Until then maintain `NO GO`.
- An organizer of a fresh tournament may still change `league_id` only if the club is the unique primary organizer and the match has no results, no ELO and no uploaded flag. Co-organizer contributions require an explicit permission design.
- Blocking historical relinks also applies to already completed **unlinked** tournaments; explicit audited migration is needed if business requirements call for attaching old results.
- Evaluate lock-order consistency with the standings RPC (`leagues FOR UPDATE`), membership operations, and all tournament result writers under concurrency. Also test the full 64-table schema, RLS/GRANT/trigger interactions, background workers, backups/ACL/owners and rollback that does **not** restore vulnerable privileges.
- `PR #65` remains DRAFT. `PR #76` Auth deadlock hotfix is separate. Do not conflate these tasks with the separate Supabase resource-exhaustion incident, for which the user has already received guidance from support.

**No production write, no real-player fixtures, no live index tests, no mails sent.**
