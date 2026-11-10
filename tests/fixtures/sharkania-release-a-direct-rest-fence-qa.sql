\set ON_ERROR_STOP on
-- Disposable PG17 ONLY: simulate the permissive REST grants/policies that
-- exist in today's project. The server-side release guards MUST still deny
-- direct client writes to a linked league, while preserving nonleague paths.
BEGIN;
GRANT SELECT,INSERT,UPDATE ON public.tournament_results, public.elo_history,
 public.tournaments TO authenticated;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elo_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_release_rest_results_all
 ON public.tournament_results FOR ALL TO authenticated
 USING (true) WITH CHECK (true);
CREATE POLICY qa_release_rest_elo_all
 ON public.elo_history FOR ALL TO authenticated
 USING (true) WITH CHECK (true);
CREATE POLICY qa_release_rest_tournaments_all
 ON public.tournaments FOR ALL TO authenticated
 USING (true) WITH CHECK (true);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE denied boolean;
BEGIN
 denied:=false;
 BEGIN
  INSERT INTO public.tournament_results(tournament_id,player_id,position)
  VALUES('00000000-0000-0000-0000-000000000094',
         '00000000-0000-0000-0000-000000000051',1);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: direct REST result INSERT succeeded for linked league'; END IF;
 denied:=false;
 BEGIN
  INSERT INTO public.elo_history(tournament_id,player_id,elo_before,elo_after,elo_change)
  VALUES('00000000-0000-0000-0000-000000000094',
         '00000000-0000-0000-0000-000000000051',1200,1220,20);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: direct REST Elo INSERT succeeded for linked league'; END IF;
 denied:=false;
 BEGIN
  UPDATE public.tournaments SET results_uploaded=true
  WHERE id='00000000-0000-0000-0000-000000000094';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: direct REST tournament finalization succeeded for linked league'; END IF;

 -- All three operations remain possible on a standalone tournament.
 INSERT INTO public.tournament_results(tournament_id,player_id,position)
 VALUES('00000000-0000-0000-0000-000000000012',
        '00000000-0000-0000-0000-000000000051',3);
 INSERT INTO public.elo_history(tournament_id,player_id,elo_before,elo_after,elo_change)
 VALUES('00000000-0000-0000-0000-000000000012',
        '00000000-0000-0000-0000-000000000051',1200,1205,5);
 UPDATE public.tournaments SET results_uploaded=true
 WHERE id='00000000-0000-0000-0000-000000000012';
 RAISE NOTICE 'PASS: REST UPDATE/INSERT blocked for linked league but permitted for standalone tournaments';
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tournament_results
  WHERE tournament_id='00000000-0000-0000-0000-000000000094')
 OR EXISTS(SELECT 1 FROM public.elo_history
  WHERE tournament_id='00000000-0000-0000-0000-000000000094')
 OR NOT EXISTS(SELECT 1 FROM public.tournament_results
  WHERE tournament_id='00000000-0000-0000-0000-000000000012')
 OR NOT EXISTS(SELECT 1 FROM public.elo_history
  WHERE tournament_id='00000000-0000-0000-0000-000000000012')
 THEN RAISE EXCEPTION 'FAIL: client REST row safety nonleague parity mismatch'; END IF;
 RAISE NOTICE 'PASS: isolated direct DML defence matches league/nonleague contract';
END;
$qa$;
ROLLBACK;
