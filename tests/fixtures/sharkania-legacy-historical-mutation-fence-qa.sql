\set ON_ERROR_STOP on
-- Synthetic PG17 only, AFTER parent Release A + independent writer + test
-- publications and the new global historic guard SQL.
-- Verify SECURITY DEFINER RPCs cannot silently reset shared Elo to 1200.
DO $pre$
BEGIN
 IF to_regprocedure('public.reset_tournament_impact(uuid)') IS NULL
 OR to_regprocedure('public.delete_tournament_god_mode(uuid)') IS NULL
 OR to_regprocedure('public.bulk_delete_scheduled_tournaments(uuid[])') IS NULL
 THEN RAISE EXCEPTION 'Legacy function candidate missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication
   WHERE tournament_id='00000000-0000-0000-0000-000000000098')
 THEN RAISE EXCEPTION 'Independent published audit fixture missing'; END IF;
END;
$pre$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $legacy$
DECLARE
 denied bool;
BEGIN
 denied:=false;
 BEGIN
  PERFORM public.reset_tournament_impact(
   '00000000-0000-0000-0000-000000000098');
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: privileged reset modified published independent Elo'; END IF;

 denied:=false;
 BEGIN
  PERFORM public.delete_tournament_god_mode(
   '00000000-0000-0000-0000-000000000098');
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: privileged GOD MODE deleted published independent Elo'; END IF;

 denied:=false;
 BEGIN
  PERFORM public.reset_tournament_impact(
   '00000000-0000-0000-0000-000000000012');
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: privileged reset removed legacy independent results'; END IF;

 RAISE NOTICE 'PASS: both privileged historical deletion/reset RPCs denied for published and legacy independent tournaments';
END;
$legacy$;
RESET ROLE;
ROLLBACK;

DO $direct$
DECLARE blocked bool;
BEGIN
 blocked:=false;
 BEGIN
  DELETE FROM public.elo_history
  WHERE tournament_id='00000000-0000-0000-0000-000000000098';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: privileged direct DELETE Elo history permitted'; END IF;

 blocked:=false;
 BEGIN
  UPDATE public.tournament_results SET prize_won=9999
  WHERE tournament_id='00000000-0000-0000-0000-000000000098';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: privileged direct UPDATE history permitted'; END IF;

 blocked:=false;
 BEGIN
  DELETE FROM public.tournaments
  WHERE id='00000000-0000-0000-0000-000000000098';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: privileged direct deletion of published tournament permitted'; END IF;

 blocked:=false;
 BEGIN
  UPDATE public.tournaments SET results_uploaded=false,status='scheduled'
  WHERE id='00000000-0000-0000-0000-000000000098';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: reopening published tournament permitted'; END IF;

 IF (SELECT count(*) FROM public.elo_history
  WHERE tournament_id='00000000-0000-0000-0000-000000000098')<>2
 OR (SELECT count(*) FROM public.tournament_results
  WHERE tournament_id='00000000-0000-0000-0000-000000000098')<>2
 OR NOT EXISTS(SELECT 1 FROM public.tournaments
  WHERE id='00000000-0000-0000-0000-000000000098'
    AND results_uploaded AND status='completed')
 THEN RAISE EXCEPTION 'FAIL: historic data changed after refused deletion'; END IF;
 RAISE NOTICE 'PASS: privileged DML cannot rewrite Elo history or reopen completed independent tournament';
END;
$direct$;

-- Allow normal cleanup of a truly empty scheduled tournament.
INSERT INTO public.tournaments(id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES('00000000-0000-0000-0000-000000000120',
 '00000000-0000-0000-0000-000000000021',3.30,NULL,
 '00000000-0000-0000-0000-000000000031','USD','2026-12-18T20:00:00Z');
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $clear$
DECLARE deleted int;
BEGIN
 SELECT public.bulk_delete_scheduled_tournaments(
  ARRAY['00000000-0000-0000-0000-000000000120']::uuid[]) INTO deleted;
 IF deleted<>1 THEN RAISE EXCEPTION 'FAIL: empty scheduled tournament deletion broken'; END IF;
END;
$clear$;
RESET ROLE;
COMMIT;

DO $final$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tournaments
   WHERE id='00000000-0000-0000-0000-000000000120')
 OR (SELECT count(*) FROM sharkania_release.independent_elo_publication)<>2
 OR (SELECT count(*) FROM public.elo_history
   WHERE tournament_id='00000000-0000-0000-0000-000000000098')<>2
 THEN RAISE EXCEPTION 'FAIL: cleanup broke publication or failed to delete empty tournament'; END IF;
 RAISE NOTICE 'PASS FINAL: direct and SECURITY DEFINER historical Elo mutation blocked; scheduled cleanup preserved';
END;
$final$;
