\set ON_ERROR_STOP on
-- Run only in temporary qa_stats PostgreSQL 17 database with fixture identities.
-- Load the ORIGINAL guarded RPC SQL, not an edited mock.
\ir ../../docs/security/stats-spy-guarded-rpcs-2026-11-03.proposal.sql

SET ROLE anon;
RESET request.jwt.claim.sub;
DO $qa$
DECLARE v_refused boolean := false;
BEGIN
  BEGIN
    PERFORM public.stats_spy_get_summary_v1('mixed-main');
  EXCEPTION WHEN insufficient_privilege THEN v_refused := true;
  END;
  IF NOT v_refused THEN RAISE EXCEPTION 'QA FAIL: anon executed premium summary'; END IF;
END;
$qa$;
RESET ROLE;

SET ROLE authenticated;
DO $qa$
DECLARE
  v_id uuid;
  v_refused_summary boolean;
  v_refused_history boolean;
BEGIN
  FOREACH v_id IN ARRAY ARRAY[
    '00000000-0000-0000-0000-000000000002'::uuid, -- no purchase
    '00000000-0000-0000-0000-000000000004'::uuid, -- expired purchase
    '00000000-0000-0000-0000-000000000005'::uuid  -- inactive purchase
  ] LOOP
    PERFORM set_config('request.jwt.claim.sub',v_id::text,false);
    v_refused_summary := false;
    v_refused_history := false;
    BEGIN
      PERFORM public.stats_spy_get_summary_v1('mixed-main');
    EXCEPTION WHEN insufficient_privilege THEN v_refused_summary := true;
    END;
    BEGIN
      PERFORM public.stats_spy_get_history_v1('mixed-main',1,0);
    EXCEPTION WHEN insufficient_privilege THEN v_refused_history := true;
    END;
    IF NOT v_refused_summary OR NOT v_refused_history THEN
      RAISE EXCEPTION 'QA FAIL: unlicensed identity % accessed premium stats', v_id;
    END IF;
  END LOOP;
END;
$qa$;

-- Active license: mixed EUR/USD/CLP amounts must not be added into a global ROI.
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $qa$
DECLARE
  v_summary jsonb;
  v_history_1 jsonb;
  v_history_2 jsonb;
  v_item jsonb;
  v_clp boolean := false;
  v_eur boolean := false;
  v_usd boolean := false;
BEGIN
  SELECT public.stats_spy_get_summary_v1('mixed-main') INTO v_summary;
  IF v_summary->>'mixed_currencies' <> 'true'
    OR v_summary->'total_prize_won' <> 'null'::jsonb
    OR v_summary->'total_buy_ins_spent' <> 'null'::jsonb
    OR v_summary->'profit' <> 'null'::jsonb
    OR v_summary->'roi_percent' <> 'null'::jsonb
    OR jsonb_array_length(v_summary->'currency_breakdown') <> 3
    OR (v_summary->>'total_tournaments')::integer <> 3
  THEN
    RAISE EXCEPTION 'QA FAIL: mixed-currency totals were inappropriately aggregated';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_summary->'currency_breakdown')
  LOOP
    IF v_item->>'currency' = 'CLP' AND
      (v_item->>'total_prize_won')::numeric = 5000 AND
      (v_item->>'total_buy_ins_spent')::numeric = 5000 AND
      (v_item->>'roi_percent')::numeric = 0 THEN v_clp := true; END IF;
    IF v_item->>'currency' = 'EUR' AND
      (v_item->>'total_prize_won')::numeric = 50 AND
      (v_item->>'total_buy_ins_spent')::numeric = 20 AND
      (v_item->>'roi_percent')::numeric = 150 THEN v_eur := true; END IF;
    IF v_item->>'currency' = 'USD' AND
      (v_item->>'total_prize_won')::numeric = 100 AND
      (v_item->>'total_buy_ins_spent')::numeric = 20 AND
      (v_item->>'roi_percent')::numeric = 400 THEN v_usd := true; END IF;
  END LOOP;
  IF NOT (v_clp AND v_eur AND v_usd) THEN
    RAISE EXCEPTION 'QA FAIL: per-currency ROI or reentry count mismatch';
  END IF;

  SELECT public.stats_spy_get_history_v1('mixed-main',1,0) INTO v_history_1;
  SELECT public.stats_spy_get_history_v1('mixed-main',1,1) INTO v_history_2;
  IF jsonb_array_length(v_history_1) <> 1 OR jsonb_array_length(v_history_2) <> 1
    OR v_history_1->0->>'id' = v_history_2->0->>'id'
    OR v_history_1->0->'players'->>'nickname' <> 'Mixed alias'
  THEN
    RAISE EXCEPTION 'QA FAIL: pagination or linked-alias history mismatch';
  END IF;
  IF jsonb_array_length(public.stats_spy_get_history_v1('mixed-main',0,0)) <> 1 THEN
    RAISE EXCEPTION 'QA FAIL: history limit lower bound not enforced';
  END IF;
END;
$qa$;

-- One-currency player: return correct ROI with buy_ins_count=2.
DO $qa$
DECLARE v_result jsonb;
BEGIN
  SELECT public.stats_spy_get_summary_v1('single-player') INTO v_result;
  IF v_result->>'mixed_currencies' <> 'false'
    OR v_result->>'currency' <> 'CLP'
    OR (v_result->>'total_prize_won')::numeric <> 30000
    OR (v_result->>'total_buy_ins_spent')::numeric <> 20000
    OR (v_result->>'profit')::numeric <> 10000
    OR (v_result->>'roi_percent')::numeric <> 50
  THEN
    RAISE EXCEPTION 'QA FAIL: single-currency ROI or buy-in reentry count incorrect';
  END IF;
END;
$qa$;

-- Superadmin without purchase is allowed.
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
DO $qa$
BEGIN
  IF (SELECT public.stats_spy_get_summary_v1('single-player')) IS NULL THEN
    RAISE EXCEPTION 'QA FAIL: superadmin cannot query authorized summary';
  END IF;
  IF jsonb_array_length(public.stats_spy_get_history_v1('single-player',1,0)) <> 1 THEN
    RAISE EXCEPTION 'QA FAIL: superadmin cannot query authorized history';
  END IF;
END;
$qa$;
RESET ROLE;

SELECT 'PASS: Stats Espia guarded RPC authorization, expired/inactive licenses, aliases, pagination and per-currency ROI' AS result;
