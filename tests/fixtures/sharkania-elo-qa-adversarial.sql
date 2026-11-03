\set ON_ERROR_STOP on
-- Separate negative-path regression cases on SYNTHETIC PostgreSQL ONLY.
-- Execute AFTER sharkania-elo-qa-setup.sql and sharkania-elo-qa-assert.sql.
-- Do not run against any live or preview Supabase project.
INSERT INTO public.tournaments(id,club_id,buy_in) VALUES
 ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000021',10),
 ('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000021',10),
 ('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000021',10),
 ('00000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000021',10),
 ('00000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000021',10);

-- (13) Duplicate player, unique positions: must NOT increment ELO twice.
INSERT INTO public.tournament_results(tournament_id,player_id,position) VALUES
 ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000051',1),
 ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000051',2);
-- (14) Missing player reference: refuses to silently skip an entry.
INSERT INTO public.tournament_results(tournament_id,player_id,position) VALUES
 ('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000051',1),
 ('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000099',2);
-- (15) Duplicate position.
INSERT INTO public.tournament_results(tournament_id,player_id,position) VALUES
 ('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000051',1),
 ('00000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000052',1);
-- (16) Out-of-range position.
INSERT INTO public.tournament_results(tournament_id,player_id,position) VALUES
 ('00000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000051',0),
 ('00000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000052',2);
-- (17) Otherwise valid case; failure injected *after* first player's writes.
INSERT INTO public.tournament_results(tournament_id,player_id,position,prize_won) VALUES
 ('00000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000051',1,35),
 ('00000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000052',2,0);

CREATE TEMP TABLE qa_players_before AS TABLE public.players;
CREATE TEMP TABLE qa_profiles_before AS TABLE public.profiles;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE
  v_tournament_id uuid;
  v_rejected boolean;
BEGIN
  FOREACH v_tournament_id IN ARRAY ARRAY[
    '00000000-0000-0000-0000-000000000013'::uuid,
    '00000000-0000-0000-0000-000000000014'::uuid,
    '00000000-0000-0000-0000-000000000015'::uuid,
    '00000000-0000-0000-0000-000000000016'::uuid
  ] LOOP
    v_rejected := false;
    BEGIN
      PERFORM public.calculate_tournament_elo_guarded(v_tournament_id);
    EXCEPTION WHEN SQLSTATE '22023' THEN
      v_rejected := true;
    END;
    IF NOT v_rejected THEN
      RAISE EXCEPTION 'QA FAIL: invalid results accepted for tournament %',v_tournament_id;
    END IF;
  END LOOP;
END;
$qa$;
RESET ROLE;

CREATE FUNCTION public.qa_inject_history_failure() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'QA deliberate partial-write abort' USING ERRCODE='P0001';
END;
$$;
CREATE TRIGGER qa_inject_history_failure
BEFORE INSERT ON public.elo_history FOR EACH ROW
WHEN (
  NEW.tournament_id = '00000000-0000-0000-0000-000000000017'::uuid
  AND NEW.player_id = '00000000-0000-0000-0000-000000000052'::uuid
)
EXECUTE FUNCTION public.qa_inject_history_failure();

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE
  v_rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.calculate_tournament_elo_guarded('00000000-0000-0000-0000-000000000017');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM = 'QA deliberate partial-write abort' THEN
      v_rejected := true;
    END IF;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'QA FAIL: injected failure did not stop the transaction';
  END IF;
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
  -- A caught exception in PL/pgSQL must roll back every earlier write
  -- made within the guarded RPC call (including player #51's update).
  IF EXISTS (
    SELECT 1 FROM public.players p JOIN qa_players_before b USING(id)
    WHERE to_jsonb(p) IS DISTINCT FROM to_jsonb(b)
  ) THEN
    RAISE EXCEPTION 'QA FAIL: invalid/injected run partially updated players';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles p JOIN qa_profiles_before b USING(id)
    WHERE to_jsonb(p) IS DISTINCT FROM to_jsonb(b)
  ) THEN
    RAISE EXCEPTION 'QA FAIL: invalid/injected run partially updated profiles';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id IN (
      '00000000-0000-0000-0000-000000000013'::uuid,
      '00000000-0000-0000-0000-000000000014'::uuid,
      '00000000-0000-0000-0000-000000000015'::uuid,
      '00000000-0000-0000-0000-000000000016'::uuid,
      '00000000-0000-0000-0000-000000000017'::uuid
    ) AND (t.results_uploaded OR t.status <> 'scheduled')
  ) THEN
    RAISE EXCEPTION 'QA FAIL: invalid/injected tournament state changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.elo_history h WHERE h.tournament_id IN (
      '00000000-0000-0000-0000-000000000013'::uuid,
      '00000000-0000-0000-0000-000000000014'::uuid,
      '00000000-0000-0000-0000-000000000015'::uuid,
      '00000000-0000-0000-0000-000000000016'::uuid,
      '00000000-0000-0000-0000-000000000017'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'QA FAIL: ELO history written for rejected tournament';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tournament_results r
    WHERE r.tournament_id IN (
      '00000000-0000-0000-0000-000000000013'::uuid,
      '00000000-0000-0000-0000-000000000014'::uuid,
      '00000000-0000-0000-0000-000000000015'::uuid,
      '00000000-0000-0000-0000-000000000016'::uuid,
      '00000000-0000-0000-0000-000000000017'::uuid
    ) AND (r.elo_before IS NOT NULL OR r.elo_after IS NOT NULL OR r.elo_change IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'QA FAIL: rejected result ELO values were mutated';
  END IF;
END;
$qa$;
DROP TRIGGER qa_inject_history_failure ON public.elo_history;
DROP FUNCTION public.qa_inject_history_failure();

SELECT 'PASS: invalid player/position results rejected; injected mid-calculation error rolls back all player, history and tournament writes' AS result;
