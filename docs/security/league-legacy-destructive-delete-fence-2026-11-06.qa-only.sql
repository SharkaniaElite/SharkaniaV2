-- SHARKANIA: prototype for isolated QA ONLY, not a deployable migration.
-- Prevents legacy SECURITY DEFINER tournament deletion/re-edit and direct
-- browser DELETE of rankings from destroying the history of ANY linked league.
-- Requires new guarded result-write and ranking RPCs before production cutover.
-- Linked result and ELO deletions cannot proceed without a purpose-built,
-- separately authorized transaction. No bypass flag/service-role exception.
CREATE OR REPLACE FUNCTION public.guard_legacy_league_destructive_delete_qa()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $guard$
DECLARE
  v_league_id uuid;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    RAISE EXCEPTION 'Unsafe trigger invocation' USING ERRCODE='PT422';
  END IF;

  IF TG_TABLE_NAME='league_standings' THEN
    -- Existing production functions delete/recreate standings and silently
    -- lose CCP, buy-ins and last_tournament_id; block even privileged RPCs.
    RAISE EXCEPTION 'League standings cannot be deleted by legacy operations'
      USING ERRCODE='PT409';
  ELSIF TG_TABLE_NAME='tournaments' THEN
    v_league_id:=OLD.league_id;
  ELSIF TG_TABLE_NAME='tournament_results'
     OR TG_TABLE_NAME='elo_history' THEN
    -- Serialize against relinking or detaching a tournament. Its UPDATE owns
    -- a row lock; a parallel DELETE cannot check stale league affiliation.
    SELECT t.league_id INTO v_league_id
      FROM public.tournaments t
      WHERE t.id=OLD.tournament_id
      FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unexpected protected table'
      USING ERRCODE='PT422';
  END IF;

  IF v_league_id IS NOT NULL THEN
    RAISE EXCEPTION 'Protected league tournament history cannot be deleted by legacy operations'
      USING ERRCODE='PT409';
  END IF;
  RETURN OLD;
END;
$guard$;

REVOKE EXECUTE ON FUNCTION public.guard_legacy_league_destructive_delete_qa()
 FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS qa_prevent_legacy_tournament_delete ON public.tournaments;
CREATE TRIGGER qa_prevent_legacy_tournament_delete
BEFORE DELETE ON public.tournaments FOR EACH ROW
EXECUTE FUNCTION public.guard_legacy_league_destructive_delete_qa();

DROP TRIGGER IF EXISTS qa_prevent_legacy_results_delete ON public.tournament_results;
CREATE TRIGGER qa_prevent_legacy_results_delete
BEFORE DELETE ON public.tournament_results FOR EACH ROW
EXECUTE FUNCTION public.guard_legacy_league_destructive_delete_qa();

DROP TRIGGER IF EXISTS qa_prevent_legacy_elo_delete ON public.elo_history;
CREATE TRIGGER qa_prevent_legacy_elo_delete
BEFORE DELETE ON public.elo_history FOR EACH ROW
EXECUTE FUNCTION public.guard_legacy_league_destructive_delete_qa();

DROP TRIGGER IF EXISTS qa_prevent_legacy_standings_delete ON public.league_standings;
CREATE TRIGGER qa_prevent_legacy_standings_delete
BEFORE DELETE ON public.league_standings FOR EACH ROW
EXECUTE FUNCTION public.guard_legacy_league_destructive_delete_qa();
