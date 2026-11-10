\set ON_ERROR_STOP on
-- Exact *production-sourced* legacy definer bodies, guarded only at entry.
-- All IDs synthetic. This QA cannot be run on the production Supabase DB.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE denied boolean; actual text;
BEGIN
 denied:=false;
 BEGIN
  PERFORM public.delete_tournament_god_mode('00000000-0000-0000-0000-000000000071');
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  GET STACKED DIAGNOSTICS actual=MESSAGE_TEXT;
  IF actual LIKE 'Legacy mutation of linked league tournament forbidden%' THEN denied:=true; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: real legacy GOD MODE deleted linked tournament'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.reset_tournament_impact('00000000-0000-0000-0000-000000000071');
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  GET STACKED DIAGNOSTICS actual=MESSAGE_TEXT;
  IF actual LIKE 'Legacy mutation of linked league tournament forbidden%' THEN denied:=true; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: real legacy reset could remove linked results'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.bulk_delete_scheduled_tournaments(
    ARRAY['00000000-0000-0000-0000-000000000071'::uuid]);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  GET STACKED DIAGNOSTICS actual=MESSAGE_TEXT;
  IF actual LIKE 'Legacy bulk mutation of linked league tournaments forbidden%' THEN denied:=true; END IF;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: real legacy bulk delete removed league tournament'; END IF;
 RAISE NOTICE 'PASS: 3 genuine production legacy RPC bodies reject league writes with PT409';
END;
$qa$;
RESET ROLE;

-- Test a different club admin does not gain access through the helper.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.delete_tournament_god_mode('00000000-0000-0000-0000-000000000071');
 EXCEPTION WHEN SQLSTATE '42501' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: unauthorized club admin can use old GOD MODE'; END IF;
 RAISE NOTICE 'PASS: original club ownership gate preserved';
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.tournaments t
  WHERE t.id='00000000-0000-0000-0000-000000000071'
   AND t.league_id='00000000-0000-0000-0000-000000000041')
 OR (SELECT count(*) FROM public.league_standings s
  WHERE s.league_id='00000000-0000-0000-0000-000000000041')<1
 OR pg_catalog.has_function_privilege('authenticated',
 'public.recalculate_league_standings(uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
 'public.update_league_standings(uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('anon',
 'public.recalculate_league_standings(uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('anon',
 'public.update_league_standings(uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
 'public.sharkania_guard_legacy_single_nonleague_qa(uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege('authenticated',
 'public.sharkania_guard_legacy_bulk_nonleague_qa(uuid[])','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: linked rows or RPC permissions changed improperly'; END IF;
 RAISE NOTICE 'PASS: linked league unaffected and unsafe recalc/guard RPCs not exposed to clients';
END;
$qa$;

-- The old functions must remain operational for NON-league tournaments
-- owned by the caller, otherwise the cutover breaks the rest of Sharkania.
INSERT INTO public.tournaments(id,club_id,buy_in,room_id,currency,start_datetime)
VALUES
 ('00000000-0000-0000-0000-000000000117',
 '00000000-0000-0000-0000-000000000021',3.30,
 '00000000-0000-0000-0000-000000000031','USD','2026-11-25T20:00:00Z'),
 ('00000000-0000-0000-0000-000000000118',
 '00000000-0000-0000-0000-000000000021',3.30,
 '00000000-0000-0000-0000-000000000031','USD','2026-11-25T21:00:00Z'),
 ('00000000-0000-0000-0000-000000000119',
 '00000000-0000-0000-0000-000000000021',3.30,
 '00000000-0000-0000-0000-000000000031','USD','2026-11-25T22:00:00Z');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE deleted json; reset json; n integer;
BEGIN
 reset:=public.reset_tournament_impact('00000000-0000-0000-0000-000000000117');
 IF reset->>'success'<>'true' THEN
   RAISE EXCEPTION 'FAIL: nonleague reset lost legacy behavior';
 END IF;
 deleted:=public.delete_tournament_god_mode('00000000-0000-0000-0000-000000000118');
 IF deleted->>'success'<>'true' THEN
   RAISE EXCEPTION 'FAIL: nonleague delete lost legacy behavior';
 END IF;
 n:=public.bulk_delete_scheduled_tournaments(
  ARRAY['00000000-0000-0000-0000-000000000119'::uuid]);
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: nonleague bulk delete count %',n; END IF;
 RAISE NOTICE 'PASS: exact old RPCs still allow NON-league reset/delete/bulk for club owner';
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tournaments
  WHERE id='00000000-0000-0000-0000-000000000117')
 OR EXISTS(SELECT 1 FROM public.tournaments
  WHERE id IN ('00000000-0000-0000-0000-000000000118'::uuid,
               '00000000-0000-0000-0000-000000000119'::uuid))
 THEN RAISE EXCEPTION 'FAIL: old nonleague operations did not preserve expected behavior'; END IF;
END;
$qa$;
ROLLBACK;
SELECT 'PASS: real legacy RPC source, guarded linked league and preserved nonleague actions' AS result;
