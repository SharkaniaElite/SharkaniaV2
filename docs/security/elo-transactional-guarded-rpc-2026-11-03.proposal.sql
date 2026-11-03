-- SHARKANIA ELO guarded RPC — ISOLATED QA PROPOSAL ONLY.
-- NOT A MIGRATION; NEVER APPLY ON PRODUCTION without real Supabase QA,
-- finance/ranking reconciliation, rollback and explicit owner approval.
-- Mirrors calculation from src/lib/api/elo-engine.ts (as of 2026-11-03).
-- Public ELO remains readable; RPC mutates only after club/superadmin auth.
-- No Stats Espía permission changes and no SharkTV work.
CREATE OR REPLACE FUNCTION public.calculate_tournament_elo_guarded(
  p_tournament_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_t record;
  v_result record;
  v_n integer;
  v_joined_n integer;
  v_positions integer;
  v_sum numeric;
  v_weight numeric;
  v_buy_in numeric;
  v_expected numeric;
  v_avg_opp numeric;
  v_score numeric;
  v_k numeric;
  v_delta numeric;
  v_before numeric;
  v_after numeric;
  v_prize numeric;
  v_rows integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT t.id, t.club_id, t.buy_in, t.results_uploaded
    INTO v_t
  FROM public.tournaments t
  WHERE t.id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE='P0002';
  END IF;
  IF NOT ((SELECT public.is_super_admin())
       OR (SELECT public.is_club_admin(v_t.club_id))) THEN
    RAISE EXCEPTION 'Club administration required' USING ERRCODE='42501';
  END IF;
  IF v_t.results_uploaded IS TRUE THEN
    RETURN jsonb_build_object('success',true,'already_processed',true,'tournament_id',p_tournament_id);
  END IF;

  v_buy_in := COALESCE(v_t.buy_in,0);
  IF v_buy_in < 0 THEN
    RAISE EXCEPTION 'Invalid negative tournament buy-in' USING ERRCODE='22023';
  END IF;

  -- Lock players deterministically to serialize simultaneous updates
  -- across different tournaments. Tournament row is already locked.
  PERFORM p.id
    FROM public.players p
    WHERE p.id IN (
      SELECT tr.player_id FROM public.tournament_results tr
      WHERE tr.tournament_id = p_tournament_id
    )
    ORDER BY p.id
    FOR UPDATE;

  PERFORM tr.id
    FROM public.tournament_results tr
    WHERE tr.tournament_id = p_tournament_id
    ORDER BY tr.id
    FOR UPDATE;

  SELECT count(*)::integer INTO v_n
  FROM public.tournament_results tr
  WHERE tr.tournament_id = p_tournament_id;

  IF v_n < 2 THEN
    RAISE EXCEPTION 'At least two results required' USING ERRCODE='22023';
  END IF;

  SELECT count(*)::integer, sum(p.elo_rating),count(DISTINCT tr.position)::integer
    INTO v_joined_n,v_sum,v_positions
  FROM public.tournament_results tr
  JOIN public.players p ON p.id=tr.player_id
  WHERE tr.tournament_id=p_tournament_id;

  IF v_joined_n <> v_n OR v_positions <> v_n
     OR EXISTS (
       SELECT 1 FROM public.tournament_results tr
       WHERE tr.tournament_id=p_tournament_id
         AND (tr.position < 1 OR tr.position > v_n)
     ) THEN
    RAISE EXCEPTION 'Inconsistent tournament result positions or players'
      USING ERRCODE='22023';
  END IF;

  -- Never append to a pre-existing ELO history without reconciliation.
  -- This closes a retry path for historically half-processed tournaments.
  IF EXISTS (
    SELECT 1 FROM public.elo_history h
    WHERE h.tournament_id=p_tournament_id
  ) THEN
    RAISE EXCEPTION 'Existing ELO history requires reconciliation'
      USING ERRCODE='P0001';
  END IF;

  v_weight := (v_sum / v_n::numeric) / 1200::numeric;

  FOR v_result IN
    SELECT tr.id AS result_id,tr.player_id,tr.position,
           tr.prize_won,tr.bounties_won,
           p.elo_rating,p.elo_peak,p.total_tournaments
    FROM public.tournament_results tr
    JOIN public.players p ON p.id=tr.player_id
    WHERE tr.tournament_id=p_tournament_id
    ORDER BY tr.position,tr.player_id
  LOOP
    v_before := v_result.elo_rating;
    v_score := (v_n-v_result.position)::numeric/(v_n-1)::numeric;
    v_avg_opp := (v_sum-v_before)/(v_n-1)::numeric;
    v_expected := 1::numeric / (1::numeric
      + power(10::numeric,(v_avg_opp-v_before)/400::numeric));

    v_k := (CASE WHEN v_result.total_tournaments < 30 THEN 40 ELSE 20 END)::numeric
       * (1::numeric + log(10::numeric,v_buy_in+1::numeric)*0.1::numeric)
       * (1::numeric + log(10::numeric,v_n::numeric)*0.15::numeric);
    v_delta := v_k*v_weight*(v_score-v_expected);
    v_after := round(greatest(100::numeric,v_before+v_delta),2);
    v_prize := COALESCE(v_result.prize_won,0)+COALESCE(v_result.bounties_won,0);

    UPDATE public.players p
      SET elo_rating=v_after,
          elo_peak=greatest(p.elo_peak,v_after),
          total_tournaments=p.total_tournaments+1,
          total_cashes=p.total_cashes+CASE WHEN v_prize>0 THEN 1 ELSE 0 END,
          total_wins=p.total_wins+CASE WHEN v_result.position=1 THEN 1 ELSE 0 END,
          total_prize_won=p.total_prize_won+v_prize,
          total_buy_ins_spent=p.total_buy_ins_spent+v_buy_in
      WHERE p.id=v_result.player_id;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows<>1 THEN
      RAISE EXCEPTION 'Player update failed' USING ERRCODE='P0001';
    END IF;

    INSERT INTO public.elo_history
      (player_id,tournament_id,elo_before,elo_after,elo_change)
    VALUES
      (v_result.player_id,p_tournament_id,v_before,v_after,round(v_delta,2));

    UPDATE public.tournament_results tr
       SET elo_before=v_before,elo_after=v_after,elo_change=round(v_delta,2)
     WHERE tr.id=v_result.result_id;
    GET DIAGNOSTICS v_rows=ROW_COUNT;
    IF v_rows<>1 THEN
      RAISE EXCEPTION 'Tournament result update failed' USING ERRCODE='P0001';
    END IF;
  END LOOP;

  -- Current get_unified_elo() is already a privileged function on Supabase.
  -- Reconcile multi-nickname behavior on real QA before production deployment.
  UPDATE public.profiles prof
     SET unified_elo=public.get_unified_elo(prof.id)
   WHERE prof.id IN (
     SELECT DISTINCT p.profile_id
     FROM public.players p
     JOIN public.tournament_results tr ON tr.player_id=p.id
     WHERE tr.tournament_id=p_tournament_id AND p.profile_id IS NOT NULL
   );

  UPDATE public.tournaments
     SET results_uploaded=true,status='completed'
   WHERE id=p_tournament_id;
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  IF v_rows<>1 THEN
    RAISE EXCEPTION 'Tournament completion failed' USING ERRCODE='P0001';
  END IF;

  RETURN jsonb_build_object('success',true,'already_processed',false,
    'tournament_id',p_tournament_id,'players_processed',v_n);
END;
$function$;

-- Default PUBLIC EXECUTE is unsafe for SECURITY DEFINER RPCs.
REVOKE ALL ON FUNCTION public.calculate_tournament_elo_guarded(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_tournament_elo_guarded(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.calculate_tournament_elo_guarded(uuid) TO authenticated;
