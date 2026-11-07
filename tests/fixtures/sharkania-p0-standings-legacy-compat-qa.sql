\set ON_ERROR_STOP on
-- Run WITHIN the outer BEGIN of sharkania-p0-league-standings-rls-qa.sql.
-- Simulates current main branch's legacy invoker RPC: DELETE old standings,
-- INSERT recalculated rows and later UPDATE ranking. This is NOT the actual
-- production function body and does not reproduce CCP fields/tiebreaks.
CREATE TABLE public.qa_result_source(
 league_id uuid NOT NULL,player_id uuid NOT NULL,points numeric NOT NULL);
INSERT INTO public.qa_result_source VALUES
('00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000051',17),
('00000000-0000-0000-0000-000000000042',
 '00000000-0000-0000-0000-000000000052',19);
GRANT SELECT ON public.qa_result_source TO authenticated;
CREATE OR REPLACE FUNCTION public.qa_legacy_invoker_rebuild_standings(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO ''
AS $fn$
BEGIN
 DELETE FROM public.league_standings WHERE league_id=p_id;
 INSERT INTO public.league_standings(league_id,player_id,total_points)
 SELECT r.league_id,r.player_id,r.points
 FROM public.qa_result_source r WHERE r.league_id=p_id;
 UPDATE public.league_standings SET total_points=total_points
 WHERE league_id=p_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.qa_legacy_invoker_rebuild_standings(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.qa_legacy_invoker_rebuild_standings(uuid)
 TO authenticated;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.qa_legacy_invoker_rebuild_standings(
 '00000000-0000-0000-0000-000000000041');
DO $qa$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.league_standings
  WHERE league_id='00000000-0000-0000-0000-000000000041'
    AND total_points=17)
 THEN RAISE EXCEPTION 'FAIL: legacy invoker cannot rebuild own league'; END IF;
 RAISE NOTICE 'PASS: primary organizer preserved legacy invoker delete/insert/update workflow';
END $qa$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
BEGIN
 BEGIN
  PERFORM public.qa_legacy_invoker_rebuild_standings(
   '00000000-0000-0000-0000-000000000041');
  RAISE EXCEPTION 'FAIL: secondary club rebuilt someone else''s standings';
 EXCEPTION WHEN SQLSTATE '42501' THEN
  RAISE NOTICE 'PASS: secondary club cannot invoke old multi-step writer on foreign league';
 END;
END $qa$;
SELECT public.qa_legacy_invoker_rebuild_standings(
 '00000000-0000-0000-0000-000000000042');
DO $qa$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.league_standings
  WHERE league_id='00000000-0000-0000-0000-000000000042'
    AND total_points=19)
 THEN RAISE EXCEPTION 'FAIL: primary B cannot rebuild league B'; END IF;
 RAISE NOTICE 'PASS: primary B still rebuilds its own league only';
END $qa$;
RESET ROLE;
DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.league_standings)<>2
 OR (SELECT count(*) FROM public.league_standings
  WHERE league_id='00000000-0000-0000-0000-000000000041'
    AND total_points=17)<>1
 THEN RAISE EXCEPTION 'FAIL: legacy compatibility left partial or cross-league standings'; END IF;
 RAISE NOTICE 'PASS: legacy compatibility preserved independent standings';
END $qa$;

-- Plan-only RLS check: EXPLAIN without ANALYZE cannot write.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE p jsonb;
BEGIN
 EXECUTE $stmt$EXPLAIN (FORMAT JSON) UPDATE public.league_standings
  SET total_points=total_points
  WHERE league_id='00000000-0000-0000-0000-000000000041'$stmt$
 INTO p;
 IF p->0->'Plan' IS NULL THEN
  RAISE EXCEPTION 'FAIL: RLS UPDATE plan was not generated'; END IF;
 RAISE NOTICE 'PASS: policy and authorized UPDATE compile in planner without executing a write';
END $qa$;
RESET ROLE;
