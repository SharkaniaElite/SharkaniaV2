-- SHARKANIA — PROTOTIPO QA ONLY, NEVER RUN IN PRODUCTION.
-- Defense in depth for direct tournaments insert/update and for tournament
-- creation via SECURITY DEFINER templates. This function is intentionally
-- scoped to changing (league_id, club_id), not all tournament metadata.
--
-- IMPORTANT business assumption for QA: a linked tournament must belong to
-- the league's single PRIMARY organizer club. A secondary member cannot link
-- its own tournament solely because it is a participant. If co-host creation
-- is a feature, design explicit primary approval in a separate RPC.
--
-- PREREQUISITE: one primary league_clubs row per league and guarded league
-- membership cutover. Companion client/API and migration required.
CREATE OR REPLACE FUNCTION public.guard_tournament_league_link_qa()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $guard$
DECLARE
  v_old_league_id uuid;
  v_league_id uuid;
  v_primary uuid;
  v_primary_count integer;
  v_is_super boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Ordinary tournament edits must keep working. Only relinking or
    -- reassignment of tournament owning club is relevant here.
    IF NEW.league_id IS NOT DISTINCT FROM OLD.league_id
       AND NEW.club_id IS NOT DISTINCT FROM OLD.club_id THEN
      RETURN NEW;
    END IF;
    v_old_league_id := OLD.league_id;
  END IF;

  -- Unlinked tournaments still rely on existing tournament club RLS;
  -- do not expose privileged league lookup operations to unauthenticated JWT.
  IF (NEW.league_id IS NOT NULL OR v_old_league_id IS NOT NULL)
      AND (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required for league tournament membership'
      USING ERRCODE='42501';
  END IF;

  v_is_super := (SELECT public.is_super_admin());

  -- Serialize with existing league membership RPCs (which FOR UPDATE the
  -- league record) and lock BOTH source and target in ascending UUID order.
  -- A concurrent change of primary affiliation cannot slip between check
  -- and write. This is intentionally stronger than FOR SHARE.
  FOR v_league_id IN
    SELECT DISTINCT x.league_id
    FROM (VALUES(v_old_league_id),(NEW.league_id)) AS x(league_id)
    WHERE x.league_id IS NOT NULL
    ORDER BY x.league_id
  LOOP
    PERFORM l.id FROM public.leagues l
      WHERE l.id=v_league_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Linked league missing' USING ERRCODE='PT404';
    END IF;
  END LOOP;

  -- Moving away from a league also needs the organizer's permission.
  -- Otherwise an admin of a secondary club could detach an inherited link.
  IF v_old_league_id IS NOT NULL THEN
    SELECT count(*), (array_agg(lc.club_id))[1]
      INTO v_primary_count,v_primary
    FROM public.league_clubs lc
    WHERE lc.league_id=v_old_league_id AND lc.is_primary;

    IF v_primary_count<>1 OR v_primary IS NULL THEN
      RAISE EXCEPTION 'Old league primary ownership missing or ambiguous'
        USING ERRCODE='PT409';
    END IF;
    IF NOT v_is_super AND NOT (SELECT public.is_club_admin(v_primary)) THEN
      RAISE EXCEPTION 'Only old league organizer can detach or transfer a tournament'
        USING ERRCODE='42501';
    END IF;
  END IF;

  IF NEW.league_id IS NOT NULL THEN
    SELECT count(*), (array_agg(lc.club_id))[1]
      INTO v_primary_count,v_primary
    FROM public.league_clubs lc
    WHERE lc.league_id=NEW.league_id AND lc.is_primary;

    IF v_primary_count<>1 OR v_primary IS NULL THEN
      RAISE EXCEPTION 'New league primary ownership missing or ambiguous'
        USING ERRCODE='PT409';
    END IF;

    -- Preserve the league's ownership invariant even for superadmin:
    -- tournament.club_id must be the league's actual primary club.
    IF NEW.club_id IS DISTINCT FROM v_primary THEN
      RAISE EXCEPTION 'Tournament club is not league primary organizer'
        USING ERRCODE='42501';
    END IF;
    IF NOT v_is_super AND NOT (SELECT public.is_club_admin(v_primary)) THEN
      RAISE EXCEPTION 'Only league primary organizer can assign tournaments'
        USING ERRCODE='42501';
    END IF;
  END IF;

  -- Historical results must NEVER be removed from the league by merely
  -- relinking the tournament (even when its organizer authorizes the edit).
  -- This also prevents taking already-completed unlinked tournaments and
  -- retroactively assigning their points to another league.
  -- UPDATE holds the tournament row lock; concurrent result deletion
  -- obtains the same lock in the accompanying legacy-delete fence.
  IF TG_OP='UPDATE' AND (
     OLD.results_uploaded IS TRUE
     OR EXISTS (SELECT 1 FROM public.tournament_results tr
                WHERE tr.tournament_id=OLD.id)
     OR EXISTS (SELECT 1 FROM public.elo_history eh
                WHERE eh.tournament_id=OLD.id)
  ) THEN
    RAISE EXCEPTION 'Recorded results or ELO prevent tournament reassignment'
      USING ERRCODE='PT409';
  END IF;

  RETURN NEW;
END;
$guard$;

-- Trigger functions are NOT direct public APIs. Revoke defaults even though
-- PostgreSQL executes a trigger function through the trigger binding.
REVOKE ALL ON FUNCTION public.guard_tournament_league_link_qa()
FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS qa_guard_tournament_league_link ON public.tournaments;
CREATE TRIGGER qa_guard_tournament_league_link
BEFORE INSERT OR UPDATE OF league_id,club_id
ON public.tournaments
FOR EACH ROW
EXECUTE FUNCTION public.guard_tournament_league_link_qa();
