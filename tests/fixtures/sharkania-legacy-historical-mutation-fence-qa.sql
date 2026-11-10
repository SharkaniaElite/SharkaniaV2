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

 RAISE NOTICE 'PASS: both privileged history rewrite and delete RPCs denied for published independent tournament';
END;
$legacy$;
RESET ROLE;
ROLLBACK;

-- The legacy synthetic tournament ...012 belongs to OTHER club 022.
-- Role 005 (not 002) is the real admin of that club, so verify this
-- historical independent reset under an authorized organizer, not an
-- unrelated actor who is already denied by the old RPC's ownership check.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $legacy_other_club$
DECLARE denied bool:=false;
BEGIN
 BEGIN
  PERFORM public.reset_tournament_impact(
   '00000000-0000-0000-0000-000000000012');
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: authorized club admin reset historical independent results'; END IF;
 RAISE NOTICE 'PASS: legitimate other club admin still cannot silently rewrite legacy historical ELO';
END;
$legacy_other_club$;
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

-- Three legacy production tournaments are marked uploaded while status is
-- still scheduled. No-op status writes must not be blocked by the guard:
-- only actual transitions away from completed or toward cancelled are denied.
INSERT INTO public.tournaments(
 id,club_id,buy_in,league_id,room_id,currency,start_datetime,
 results_uploaded,status
) VALUES (
 '00000000-0000-0000-0000-000000000121',
 '00000000-0000-0000-0000-000000000021',3.30,NULL,
 '00000000-0000-0000-0000-000000000031','USD',
 '2026-12-19T20:00:00Z',true,'scheduled'
);
DO $legacy_status$
DECLARE blocked bool:=false;
BEGIN
 UPDATE public.tournaments SET status='scheduled'
 WHERE id='00000000-0000-0000-0000-000000000121';
 IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: unchanged legacy status blocked'; END IF;
 BEGIN
  UPDATE public.tournaments SET status='cancelled'
  WHERE id='00000000-0000-0000-0000-000000000121';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: uploaded legacy tournament cancelled'; END IF;
 UPDATE public.tournaments SET status='completed'
 WHERE id='00000000-0000-0000-0000-000000000121';
 blocked:=false;
 BEGIN
  UPDATE public.tournaments SET status='scheduled'
  WHERE id='00000000-0000-0000-0000-000000000121';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: completed uploaded tournament reopened'; END IF;
 RAISE NOTICE 'PASS: legacy scheduled/uploaded inconsistency preserved, but transitions back to unsafe state refused';
END;
$legacy_status$;

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
