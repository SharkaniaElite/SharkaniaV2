\set ON_ERROR_STOP on
-- Synthetic fault injection: provoke an Elo-history INSERT error AFTER the
-- nickname creation, audit and result insertion would have been attempted.
-- The guarded function must roll back every part of that transaction.
INSERT INTO public.tournaments(id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES('00000000-0000-0000-0000-000000000103',
 '00000000-0000-0000-0000-000000000021',3.30,NULL,
 '00000000-0000-0000-0000-000000000031','USD','2026-12-15T20:00:00Z');

CREATE FUNCTION public.qa_fail_independent_history()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $fault$
BEGIN
 IF NEW.tournament_id='00000000-0000-0000-0000-000000000103' THEN
  RAISE EXCEPTION 'SYNTHETIC FAILURE INSIDE ELO HISTORY'
  USING ERRCODE='PT499';
 END IF;
 RETURN NEW;
END;
$fault$;
CREATE TRIGGER qa_fail_history_for_one_tournament
 BEFORE INSERT ON public.elo_history FOR EACH ROW
 EXECUTE FUNCTION public.qa_fail_independent_history();

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $fail$
DECLARE
 before_elo numeric;
 after_elo numeric;
 rejected bool:=false;
BEGIN
 SELECT elo_rating INTO before_elo FROM public.players
 WHERE id='00000000-0000-0000-0000-000000000051';
 BEGIN
  PERFORM public.publish_independent_nickname_results_guarded(
   '00000000-0000-0000-0000-000000000103',
   '[{"nickname":"SharkHero","position":1,"prize_won":5,"bounties_won":0,"buy_ins_count":1},{"nickname":"QAInjectedFailure","position":2,"prize_won":0,"bounties_won":0,"buy_ins_count":1}]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT499' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL: fault injection did not reach Elo history'; END IF;
 SELECT elo_rating INTO after_elo FROM public.players
 WHERE id='00000000-0000-0000-0000-000000000051';
 IF before_elo IS DISTINCT FROM after_elo THEN
  RAISE EXCEPTION 'FAIL: rollback altered existing player Elo'; END IF;
 RAISE NOTICE 'PASS: injected Elo history failure returned an error and preserved previous Elo';
END;
$fail$;
RESET ROLE;
ROLLBACK;

DO $assert$
BEGIN
 IF EXISTS(SELECT 1 FROM public.players WHERE nickname='QAInjectedFailure')
 OR EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication
  WHERE tournament_id='00000000-0000-0000-0000-000000000103')
 OR EXISTS(SELECT 1 FROM sharkania_release.independent_currency_posting
  WHERE tournament_id='00000000-0000-0000-0000-000000000103')
 OR EXISTS(SELECT 1 FROM public.tournament_results
  WHERE tournament_id='00000000-0000-0000-0000-000000000103')
 OR EXISTS(SELECT 1 FROM public.elo_history
  WHERE tournament_id='00000000-0000-0000-0000-000000000103')
 OR EXISTS(SELECT 1 FROM public.tournaments
  WHERE id='00000000-0000-0000-0000-000000000103' AND results_uploaded)
 THEN RAISE EXCEPTION 'FAIL: partial data committed after injected failure'; END IF;
 RAISE NOTICE 'PASS FINAL: injected failure cannot leave a player, result, history, audit or completion half-written';
END;
$assert$;
DROP TRIGGER qa_fail_history_for_one_tournament ON public.elo_history;
DROP FUNCTION public.qa_fail_independent_history();
