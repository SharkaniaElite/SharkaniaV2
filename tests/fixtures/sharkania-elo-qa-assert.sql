\set ON_ERROR_STOP on
\ir ../../docs/security/elo-transactional-guarded-rpc-2026-11-03.proposal.sql

SET ROLE anon;
RESET request.jwt.claim.sub;
DO $qa$
DECLARE rejected boolean := false;
BEGIN
  BEGIN PERFORM public.calculate_tournament_elo_guarded('00000000-0000-0000-0000-000000000011');
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'QA FAIL: anonymous caller executed ELO RPC'; END IF;
END;
$qa$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
DO $qa$
DECLARE rejected boolean := false;
BEGIN
  BEGIN PERFORM public.calculate_tournament_elo_guarded('00000000-0000-0000-0000-000000000011');
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'QA FAIL: ordinary player recalculated ELO'; END IF;
END;
$qa$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE rejected boolean := false;
BEGIN
  BEGIN PERFORM public.calculate_tournament_elo_guarded('00000000-0000-0000-0000-000000000011');
  EXCEPTION WHEN insufficient_privilege THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'QA FAIL: unrelated club admin recalculated ELO'; END IF;
END;
$qa$;

-- Club A admin processes precisely 2 synthetic results.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE response jsonb;
BEGIN
  SELECT public.calculate_tournament_elo_guarded('00000000-0000-0000-0000-000000000011') INTO response;
  IF response->>'success' <> 'true'
    OR response->>'already_processed' <> 'false'
    OR (response->>'players_processed')::integer <> 2 THEN
    RAISE EXCEPTION 'QA FAIL: legitimate admin did not complete ELO: %',response;
  END IF;
END;
$qa$;
DO $qa$
DECLARE response jsonb;
BEGIN
  SELECT public.calculate_tournament_elo_guarded('00000000-0000-0000-0000-000000000011') INTO response;
  IF response->>'already_processed' <> 'true' THEN
    RAISE EXCEPTION 'QA FAIL: repeated ELO processing was not idempotent';
  END IF;
END;
$qa$;
RESET ROLE;

-- Expected numeric values obtained from current TypeScript formula for 2 x
-- Elo 1200 players, 10 buy-in, first and second place (delta +/-23.079922).
DO $qa$
BEGIN
  IF (SELECT elo_rating FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 1223.08
  OR (SELECT elo_rating FROM public.players WHERE id='00000000-0000-0000-0000-000000000052') <> 1176.92 THEN
    RAISE EXCEPTION 'QA FAIL: SQL ELO does not match legacy TypeScript formula';
  END IF;
  IF (SELECT total_prize_won FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 55
  OR (SELECT total_buy_ins_spent FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 10
  OR (SELECT total_tournaments FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 1
  OR (SELECT total_cashes FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 1
  OR (SELECT total_wins FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 1 THEN
    RAISE EXCEPTION 'QA FAIL: player totals mismatch';
  END IF;
  IF (SELECT count(*) FROM public.elo_history WHERE tournament_id='00000000-0000-0000-0000-000000000011') <> 2
  OR (SELECT count(*) FROM public.tournament_results WHERE tournament_id='00000000-0000-0000-0000-000000000011' AND elo_after IS NOT NULL) <> 2
  OR (SELECT status FROM public.tournaments WHERE id='00000000-0000-0000-0000-000000000011') <> 'completed'
  OR NOT (SELECT results_uploaded FROM public.tournaments WHERE id='00000000-0000-0000-0000-000000000011') THEN
    RAISE EXCEPTION 'QA FAIL: transaction missing result history or completion status';
  END IF;
  IF (SELECT unified_elo FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000061') <> 1223.08 THEN
    RAISE EXCEPTION 'QA FAIL: unified ELO sync failed';
  END IF;
END;
$qa$;

-- Simulate historical half-processing on another tournament. Must refuse to
-- append duplicate history or alter player totals before reconciliation.
INSERT INTO public.elo_history(player_id,tournament_id,elo_before,elo_after,elo_change) VALUES
('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000012',1200,1201,1);
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE refused boolean := false;
BEGIN
  BEGIN PERFORM public.calculate_tournament_elo_guarded('00000000-0000-0000-0000-000000000012');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM LIKE 'Existing ELO history%' THEN refused := true; END IF;
  END;
  IF NOT refused THEN RAISE EXCEPTION 'QA FAIL: pre-existing history was not rejected'; END IF;
END;
$qa$;
RESET ROLE;
DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.elo_history WHERE tournament_id='00000000-0000-0000-0000-000000000012') <> 1
  OR (SELECT results_uploaded FROM public.tournaments WHERE id='00000000-0000-0000-0000-000000000012') THEN
    RAISE EXCEPTION 'QA FAIL: blocked transaction modified history or status';
  END IF;
END;
$qa$;
SELECT 'PASS: guarded ELO permissions, formula, atomicity assumptions and idempotency' AS result;
