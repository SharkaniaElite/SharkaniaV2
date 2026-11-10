-- SHARKANIA / PR #96 draft ACL cutover (QA only; NOT A PRODUCTION MIGRATION).
-- Apply only after PR #95 and the independent-results candidate SQL.
-- Activation without the guarded frontend would BREAK legacy non-league uploads.
-- No deploy, no flag, no DDL on production.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

DO $pre$
BEGIN
 IF to_regprocedure('public.publish_independent_nickname_results_guarded(uuid,jsonb)') IS NULL
 OR to_regprocedure('public.publish_league_nickname_results_guarded(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'Both guarded writers required before client lockdown'
 USING ERRCODE='PT409'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid='public.players'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid='public.elo_history'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_catalog.pg_class
   WHERE oid='public.tournament_results'::regclass)
 THEN RAISE EXCEPTION 'Critical RLS is missing' USING ERRCODE='PT409'; END IF;
END;
$pre$;

-- The API must NEVER set player ID, profile linkage, Elo or financial fields.
-- Only narrowly scoped cosmetic name/country edits survive for club admins.
-- RLS still determines which player's nickname can be changed.
REVOKE INSERT,UPDATE,DELETE ON TABLE public.players
  FROM PUBLIC,anon,authenticated;
GRANT UPDATE(nickname,country_code) ON public.players TO authenticated;

-- No browser may add or delete a legacy Elo event or tournament result.
-- Both server writers are SECURITY DEFINER with their own actor checks.
REVOKE INSERT,UPDATE,DELETE ON TABLE public.elo_history
  FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON TABLE public.tournament_results
  FROM PUBLIC,anon,authenticated;

-- A direct authenticated PATCH could otherwise mark a standalone tournament
-- completed without a result/ledger. Preserve normal unrelated edits.
CREATE FUNCTION public.guard_independent_client_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $guard$
BEGIN
 IF current_user IN ('authenticated','anon')
 AND OLD.league_id IS NULL
 AND (
    NEW.results_uploaded IS DISTINCT FROM OLD.results_uploaded
    OR (
      NEW.status IS DISTINCT FROM OLD.status
      AND (NEW.status::text='completed' OR OLD.status::text='completed')
    )
 ) THEN
    RAISE EXCEPTION 'Independent tournament completion requires guarded server writer'
    USING ERRCODE='PT409';
 END IF;
 RETURN NEW;
END;
$guard$;

REVOKE EXECUTE ON FUNCTION public.guard_independent_client_completion()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER independent_guard_direct_completion
 BEFORE UPDATE OF results_uploaded,status ON public.tournaments
 FOR EACH ROW EXECUTE FUNCTION public.guard_independent_client_completion();

DO $post$
BEGIN
 IF pg_catalog.has_column_privilege('authenticated','public.players','elo_rating','UPDATE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','elo_peak','UPDATE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','total_prize_won','UPDATE')
 OR pg_catalog.has_column_privilege('authenticated','public.players','profile_id','UPDATE')
 OR pg_catalog.has_table_privilege('authenticated','public.players','INSERT')
 OR pg_catalog.has_table_privilege('authenticated','public.elo_history','INSERT')
 OR pg_catalog.has_table_privilege('authenticated','public.tournament_results','UPDATE')
 OR NOT pg_catalog.has_column_privilege('authenticated','public.players','nickname','UPDATE')
 OR NOT pg_catalog.has_column_privilege('authenticated','public.players','country_code','UPDATE')
 THEN RAISE EXCEPTION 'Elo/finance direct API privileges were not closed'
 USING ERRCODE='PT409'; END IF;
END;
$post$;
COMMIT;
