\set ON_ERROR_STOP on
-- Run ONLY in a fresh, synthetic PostgreSQL 17 qa_elo_concurrency database.
-- Both tournament RPC calls must have been started from different psql sessions
-- while the first transaction held row locks. This fixture never targets Supabase.
DO $qa$
DECLARE
  h_count integer;
BEGIN
  SELECT count(*) INTO h_count FROM public.elo_history;
  IF h_count <> 4 THEN
    RAISE EXCEPTION 'QA FAIL: concurrent tournaments produced % history rows, expected 4', h_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tournaments
    WHERE id IN (
      '00000000-0000-0000-0000-000000000011'::uuid,
      '00000000-0000-0000-0000-000000000012'::uuid
    ) AND (results_uploaded IS DISTINCT FROM true OR status <> 'completed')
  ) THEN
    RAISE EXCEPTION 'QA FAIL: concurrent tournament remained unfinished';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.players
    WHERE total_tournaments <> 2 OR total_buy_ins_spent <> 20
  ) THEN
    RAISE EXCEPTION 'QA FAIL: shared player counters lost updates in parallel calls';
  END IF;
  IF (SELECT total_prize_won FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 105
    OR (SELECT total_cashes FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 2
    OR (SELECT total_wins FROM public.players WHERE id='00000000-0000-0000-0000-000000000051') <> 2
    OR (SELECT total_prize_won FROM public.players WHERE id='00000000-0000-0000-0000-000000000052') <> 0
  THEN
    RAISE EXCEPTION 'QA FAIL: shared player winnings were duplicated or lost';
  END IF;

  -- A serialized ELO computation must use the previous tournament's
  -- final rating as the next tournament's initial rating, in either order.
  IF EXISTS (
    SELECT 1
    FROM public.elo_history a
    JOIN public.elo_history b ON b.player_id=a.player_id
    WHERE a.tournament_id='00000000-0000-0000-0000-000000000011'::uuid
      AND b.tournament_id='00000000-0000-0000-0000-000000000012'::uuid
      AND NOT (
        (a.elo_before=1200 AND a.elo_after=b.elo_before)
        OR (b.elo_before=1200 AND b.elo_after=a.elo_before)
      )
  ) THEN
    RAISE EXCEPTION 'QA FAIL: concurrent ELO history is not serializable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.profiles prof ON prof.id=p.profile_id
    JOIN public.elo_history a ON a.player_id=p.id
      AND a.tournament_id='00000000-0000-0000-0000-000000000011'::uuid
    JOIN public.elo_history b ON b.player_id=p.id
      AND b.tournament_id='00000000-0000-0000-0000-000000000012'::uuid
    WHERE p.elo_rating <> CASE
        WHEN a.elo_after=b.elo_before THEN b.elo_after ELSE a.elo_after END
      OR prof.unified_elo <> p.elo_rating
  ) THEN
    RAISE EXCEPTION 'QA FAIL: final player/profile ELO is not the last serialized rating';
  END IF;
END;
$qa$;

-- A repeated request must not increment counters/history a third time.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE response jsonb;
BEGIN
  SELECT public.calculate_tournament_elo_guarded('00000000-0000-0000-0000-000000000011') INTO response;
  IF response->>'already_processed' <> 'true' THEN
    RAISE EXCEPTION 'QA FAIL: already-processed tournament is not idempotent';
  END IF;
END;
$qa$;
RESET ROLE;
DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.elo_history) <> 4
    OR EXISTS(SELECT 1 FROM public.players WHERE total_tournaments <> 2)
  THEN
    RAISE EXCEPTION 'QA FAIL: repeat execution changed tournament history/counters';
  END IF;
END;
$qa$;
SELECT 'PASS: concurrent overlapping tournaments serialize ELO and preserve all counters' AS result;
