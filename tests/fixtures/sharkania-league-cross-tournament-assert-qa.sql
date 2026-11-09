\set ON_ERROR_STOP on
-- QA: deterministic chronology for TWO different tournaments sharing players.
-- The second connection visibly waited on a PostgreSQL lock before first COMMIT.
DO $qa$
DECLARE
 v_first uuid:='00000000-0000-0000-0000-000000000094';
 v_second uuid:='00000000-0000-0000-0000-000000000095';
 v_p1 uuid:='00000000-0000-0000-0000-000000000051';
 v_p2 uuid:='00000000-0000-0000-0000-000000000052';
BEGIN
 IF (SELECT count(*) FROM public.tournaments
     WHERE id IN (v_first,v_second)
       AND results_uploaded AND status='completed')<>2
 THEN RAISE EXCEPTION 'FAIL: both tournament commits were not completed'; END IF;

 IF (SELECT count(*) FROM sharkania_release_qa.elo_publication
    WHERE tournament_id IN (v_first,v_second))<>2
    OR (SELECT count(*) FROM public.tournament_results
       WHERE tournament_id IN (v_first,v_second))<>4
    OR (SELECT count(*) FROM public.elo_history
       WHERE tournament_id IN (v_first,v_second))<>4
    OR (SELECT count(*) FROM sharkania_release_qa.elo_player_checkpoint cp
        JOIN sharkania_release_qa.elo_publication ep ON ep.id=cp.publication_id
       WHERE ep.tournament_id IN (v_first,v_second))<>4
    OR (SELECT count(*) FROM sharkania_release_qa.currency_posting
       WHERE tournament_id IN (v_first,v_second))<>4
 THEN RAISE EXCEPTION 'FAIL: missing or doubled audit, result, Elo history or native currency rows'; END IF;

 IF NOT EXISTS (
   SELECT 1 FROM public.tournament_results a
   JOIN public.tournament_results b ON a.player_id=b.player_id
   WHERE a.tournament_id=v_first AND b.tournament_id=v_second
     AND a.player_id=v_p1
     AND a.elo_after=b.elo_before
     AND b.elo_after=(SELECT elo_rating FROM public.players WHERE id=v_p1)
 )
 OR NOT EXISTS (
   SELECT 1 FROM public.tournament_results a
   JOIN public.tournament_results b ON a.player_id=b.player_id
   WHERE a.tournament_id=v_first AND b.tournament_id=v_second
     AND a.player_id=v_p2
     AND a.elo_after=b.elo_before
     AND b.elo_after=(SELECT elo_rating FROM public.players WHERE id=v_p2)
 )
 THEN RAISE EXCEPTION 'FAIL: second tournament did not use committed first Elo'; END IF;

 IF EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id IN (v_p1,v_p2) AND p.total_tournaments<>2
 ) OR (SELECT count(*) FROM public.players p
      WHERE p.room_id='00000000-0000-0000-0000-000000000031'
        AND lower(btrim(p.nickname)) IN ('sharkhero','pokerqueen'))<>2
 THEN RAISE EXCEPTION 'FAIL: shared players counted twice or nickname identity changed'; END IF;

 IF NOT EXISTS(
    SELECT 1 FROM sharkania_release_qa.currency_posting j
    WHERE j.tournament_id=v_first AND j.player_id=v_p1
      AND j.buy_ins_count=2 AND j.entry_spend=6.60 AND j.currency='USD'
 ) OR NOT EXISTS(
    SELECT 1 FROM sharkania_release_qa.currency_posting j
    WHERE j.tournament_id=v_second AND j.player_id=v_p1
      AND j.buy_ins_count=1 AND j.entry_spend=3.30 AND j.currency='USD'
 ) OR NOT EXISTS(
    SELECT 1 FROM sharkania_release_qa.currency_totals_by_player x
    WHERE x.player_id=v_p1 AND x.currency='USD'
      AND x.total_entries=3 AND x.total_entry_spend=9.90
 ) OR NOT EXISTS(
    SELECT 1 FROM sharkania_release_qa.currency_totals_by_player x
    WHERE x.player_id=v_p2 AND x.currency='USD'
      AND x.total_entries=2 AND x.total_entry_spend=6.60
 ) THEN RAISE EXCEPTION 'FAIL: overlapping tournaments lost/mixed reentries or currency journal'; END IF;

 RAISE NOTICE 'PASS: cross-tournament Elo continuity, chronological commit, 2 audits, 4 results, 4 history, 4 checkpoints and native-currency postings';
END;
$qa$;
