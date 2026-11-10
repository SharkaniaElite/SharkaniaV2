-- PR #96. QA ONLY. Blocking SECURITY DEFINER legacy reset/delete from
-- rewriting already-published Elo, even if an admin owns the tournament.
-- This extends PR #95's league-only trigger fence to ALL completed tournaments.
-- Review separately before any production cutover: legacy historical edits
-- deliberately return PT409 pending an approved replay algorithm.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

DO $preflight$
BEGIN
 IF to_regprocedure('public.publish_independent_nickname_results_guarded(uuid,jsonb)') IS NULL
 OR to_regclass('sharkania_release.independent_elo_publication') IS NULL
 OR to_regclass('sharkania_release.elo_publication') IS NULL
 OR NOT (SELECT c.relrowsecurity FROM pg_catalog.pg_class c
         WHERE c.oid='public.elo_history'::regclass)
 THEN
  RAISE EXCEPTION 'Published history guard requires both Release A and independent writer'
  USING ERRCODE='PT409';
 END IF;
END;
$preflight$;

-- For the existing pre-Release-A records we MUST NOT infer Elo starts at 1200
-- nor let a legacy privileged function silently overwrite real history.
-- No path exists for editing results after publication until versioned replay.
CREATE FUNCTION public.guard_published_elo_history_legacy()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $immutable$
DECLARE
 v_id uuid;
 v_uploaded boolean;
 v_has_protected_evidence boolean;
BEGIN
 v_id:=OLD.tournament_id;
 SELECT t.results_uploaded,
   (EXISTS(SELECT 1 FROM sharkania_release.elo_publication ep
           WHERE ep.tournament_id=t.id)
    OR EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication ip
           WHERE ip.tournament_id=t.id))
 INTO v_uploaded,v_has_protected_evidence
 FROM public.tournaments t WHERE t.id=v_id FOR SHARE;
 IF NOT FOUND THEN
  -- Foreign-key cascading deletes are never allowed for historical data:
  -- preserve evidence until explicit chronological replay is approved.
  RAISE EXCEPTION 'Historical Elo row lost its tournament context' USING ERRCODE='PT409';
 END IF;
 IF v_uploaded IS TRUE OR v_has_protected_evidence OR TG_OP='DELETE'
    OR TG_OP='UPDATE' THEN
  RAISE EXCEPTION 'Historic Elo is immutable until an approved chronological replay'
   USING ERRCODE='PT409';
 END IF;
 RETURN OLD;
END;
$immutable$;

-- This guard is intentionally strict: no legacy Elo row can be edited/deleted
-- without a versioned administrative correction process.
REVOKE EXECUTE ON FUNCTION public.guard_published_elo_history_legacy()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_all_historical_elo_mutations
 BEFORE UPDATE OR DELETE ON public.elo_history
 FOR EACH ROW EXECUTE FUNCTION public.guard_published_elo_history_legacy();

CREATE FUNCTION public.guard_published_result_legacy()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $immutable$
DECLARE v_uploaded boolean;
BEGIN
 SELECT t.results_uploaded INTO v_uploaded
 FROM public.tournaments t WHERE t.id=OLD.tournament_id FOR SHARE;
 IF NOT FOUND OR v_uploaded IS TRUE OR EXISTS(
  SELECT 1 FROM public.elo_history h
  WHERE h.tournament_id=OLD.tournament_id
 ) OR EXISTS(
  SELECT 1 FROM sharkania_release.independent_elo_publication ep
  WHERE ep.tournament_id=OLD.tournament_id
 ) OR EXISTS(
  SELECT 1 FROM sharkania_release.elo_publication ep
  WHERE ep.tournament_id=OLD.tournament_id
 ) THEN
  RAISE EXCEPTION 'Results already have Elo or publication evidence; replay required'
   USING ERRCODE='PT409';
 END IF;
 -- Even if a tournament's legacy status is inconsistent, existing result
 -- rows must not be edited/deleted outside a guarded correction procedure.
 RAISE EXCEPTION 'Historical tournament results cannot be edited directly'
 USING ERRCODE='PT409';
END;
$immutable$;
REVOKE EXECUTE ON FUNCTION public.guard_published_result_legacy()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_all_historical_result_mutations
 BEFORE UPDATE OR DELETE ON public.tournament_results
 FOR EACH ROW EXECUTE FUNCTION public.guard_published_result_legacy();

CREATE FUNCTION public.guard_published_tournament_deletion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $immutable$
BEGIN
 IF OLD.results_uploaded IS TRUE
 OR EXISTS(SELECT 1 FROM public.tournament_results r WHERE r.tournament_id=OLD.id)
 OR EXISTS(SELECT 1 FROM public.elo_history h WHERE h.tournament_id=OLD.id)
 OR EXISTS(SELECT 1 FROM sharkania_release.elo_publication ep WHERE ep.tournament_id=OLD.id)
 OR EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication ip WHERE ip.tournament_id=OLD.id)
 THEN
  RAISE EXCEPTION 'Deleting published or partially recorded tournament requires reviewed replay'
   USING ERRCODE='PT409';
 END IF;
 RETURN OLD;
END;
$immutable$;
REVOKE EXECUTE ON FUNCTION public.guard_published_tournament_deletion()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_any_published_tournament_deletion
 BEFORE DELETE ON public.tournaments
 FOR EACH ROW EXECUTE FUNCTION public.guard_published_tournament_deletion();

-- Do not allow any privileged legacy function to reopen a completed tournament
-- while its Elo history/checkpoints remain installed. The guarded first writer
-- updates false -> true, which remains allowed.
CREATE FUNCTION public.guard_published_tournament_reopening()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $immutable$
BEGIN
 -- Live read-only catalog has three historical uploaded tournaments with
 -- status=scheduled (all CLP/EUR leagues). Preserve no-op status updates.
 -- Do not allow transitions to cancellation or reopening; correcting those
 -- legacy rows requires separately reviewed permission and data lineage.
 IF OLD.results_uploaded IS TRUE AND
   (NEW.results_uploaded IS NOT TRUE OR
    (NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text <> 'completed'))
 THEN
  RAISE EXCEPTION 'Published tournament cannot revert status without chronological replay'
   USING ERRCODE='PT409';
 END IF;
 RETURN NEW;
END;
$immutable$;
REVOKE EXECUTE ON FUNCTION public.guard_published_tournament_reopening()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_any_published_tournament_reopening
 BEFORE UPDATE OF results_uploaded,status ON public.tournaments
 FOR EACH ROW EXECUTE FUNCTION public.guard_published_tournament_reopening();

COMMIT;
