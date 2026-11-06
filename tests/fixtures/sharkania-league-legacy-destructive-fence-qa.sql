\set ON_ERROR_STOP on
-- Disposable PostgreSQL QA ONLY. Roll back all fake table data and triggers.
-- Execute after membership QA and original vulnerability reproduction.
BEGIN;
INSERT INTO public.elo_history(
 tournament_id,player_id,elo_before,elo_after,elo_change
) VALUES (
 '00000000-0000-0000-0000-000000000011',
 '00000000-0000-0000-0000-000000000051',1200,1210,10
);
INSERT INTO public.league_standings(league_id,player_id)
VALUES ('00000000-0000-0000-0000-000000000041',
        '00000000-0000-0000-0000-000000000051')
ON CONFLICT DO NOTHING;

\ir ../../docs/security/league-legacy-destructive-delete-fence-2026-11-06.qa-only.sql

-- Minimal mocks of call ORDER in real legacy SECURITY DEFINER operations.
-- They DO NOT reconstruct ELO or represent a new operational alternative.
CREATE FUNCTION public.qa_simulate_legacy_delete(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_club uuid;v_league uuid;
BEGIN
 SELECT t.club_id,t.league_id INTO v_club,v_league
 FROM public.tournaments t WHERE t.id=p_id;
 IF NOT (SELECT public.is_super_admin() OR public.is_club_admin(v_club))
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 DELETE FROM public.elo_history WHERE tournament_id=p_id;
 DELETE FROM public.tournament_results WHERE tournament_id=p_id;
 DELETE FROM public.tournaments WHERE id=p_id;
 IF v_league IS NOT NULL THEN
   DELETE FROM public.league_standings WHERE league_id=v_league;
 END IF;
END;
$fn$;
CREATE FUNCTION public.qa_simulate_legacy_reset(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_club uuid;
BEGIN
 SELECT t.club_id INTO v_club FROM public.tournaments t WHERE t.id=p_id;
 IF NOT (SELECT public.is_super_admin() OR public.is_club_admin(v_club))
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 DELETE FROM public.elo_history WHERE tournament_id=p_id;
 DELETE FROM public.tournament_results WHERE tournament_id=p_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.qa_simulate_legacy_delete(uuid),
  public.qa_simulate_legacy_reset(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qa_simulate_legacy_delete(uuid),
  public.qa_simulate_legacy_reset(uuid) TO authenticated;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
BEGIN
 BEGIN
  PERFORM public.qa_simulate_legacy_delete('00000000-0000-0000-0000-000000000011');
  RAISE EXCEPTION 'FAIL: protected league tournament deleted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: legacy SECURITY DEFINER tournament delete rolled back on linked ELO';
 END;
 BEGIN
  PERFORM public.qa_simulate_legacy_reset('00000000-0000-0000-0000-000000000011');
  RAISE EXCEPTION 'FAIL: protected league tournament reset';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: legacy SECURITY DEFINER reset rolled back on linked ELO';
 END;
END $qa$;
RESET ROLE;

-- Direct privileged writes must also hit the trigger; RLS never overrides it.
DO $qa$
BEGIN
 BEGIN
  DELETE FROM public.tournament_results
   WHERE tournament_id='00000000-0000-0000-0000-000000000011';
  RAISE EXCEPTION 'FAIL: linked results deleted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: direct linked result DELETE rejected';
 END;
 BEGIN
  DELETE FROM public.elo_history
   WHERE tournament_id='00000000-0000-0000-0000-000000000011';
  RAISE EXCEPTION 'FAIL: linked ELO history deleted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: direct linked ELO DELETE rejected';
 END;
 BEGIN
  DELETE FROM public.tournaments
   WHERE id='00000000-0000-0000-0000-000000000011';
  RAISE EXCEPTION 'FAIL: linked tournament deleted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: direct linked tournament DELETE rejected';
 END;
 BEGIN
  DELETE FROM public.league_standings
   WHERE league_id='00000000-0000-0000-0000-000000000041';
  RAISE EXCEPTION 'FAIL: linked standings deleted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: direct linked league_standings DELETE rejected';
 END;
 IF (SELECT count(*) FROM public.tournament_results
  WHERE tournament_id='00000000-0000-0000-0000-000000000011')<>2
 OR (SELECT count(*) FROM public.elo_history
  WHERE tournament_id='00000000-0000-0000-0000-000000000011')<>1
 OR NOT EXISTS (SELECT 1 FROM public.league_standings
  WHERE league_id='00000000-0000-0000-0000-000000000041'
    AND player_id='00000000-0000-0000-0000-000000000051')
 THEN RAISE EXCEPTION 'FAIL: protected history changed under refused operation'; END IF;
 RAISE NOTICE 'PASS: linked results, ELO and standings remain unchanged';
END $qa$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
BEGIN
 PERFORM public.qa_simulate_legacy_delete('00000000-0000-0000-0000-000000000012');
 IF EXISTS(SELECT 1 FROM public.tournaments WHERE id='00000000-0000-0000-0000-000000000012')
 OR EXISTS(SELECT 1 FROM public.tournament_results WHERE tournament_id='00000000-0000-0000-0000-000000000012')
 THEN RAISE EXCEPTION 'FAIL: unrelated non-league tournament was blocked'; END IF;
 RAISE NOTICE 'PASS: existing non-league tournament deletion still works in isolated QA';
END $qa$;
RESET ROLE;

DO $qa$
BEGIN
 IF has_function_privilege('anon'::name,
  'public.guard_legacy_league_destructive_delete_qa()'::regprocedure,'EXECUTE')
  OR has_function_privilege('authenticated'::name,
  'public.guard_legacy_league_destructive_delete_qa()'::regprocedure,'EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: internal trigger exposed for API callers'; END IF;
END $qa$;
ROLLBACK;

DO $qa$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tournaments
    WHERE id='00000000-0000-0000-0000-000000000012')
 OR NOT EXISTS(SELECT 1 FROM public.tournament_results
    WHERE tournament_id='00000000-0000-0000-0000-000000000012')
 OR EXISTS(SELECT 1 FROM pg_proc
    WHERE proname='qa_simulate_legacy_delete')
 OR EXISTS(SELECT 1 FROM pg_trigger
    WHERE tgname='qa_prevent_legacy_results_delete')
 THEN RAISE EXCEPTION 'FAIL: guard test did not revert every fixture change'; END IF;
 RAISE NOTICE 'PASS FINAL: protected legacy delete fence QA fully rolled back';
END $qa$;
