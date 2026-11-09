\set ON_ERROR_STOP on
-- Following two concurrent, separately authenticated transactions in two
-- unrelated leagues. Every row is synthetic, never a production user.
DO $qa$
DECLARE
  v_first uuid:='00000000-0000-0000-0000-000000000097';
  v_second uuid:='00000000-0000-0000-0000-000000000098';
  v_p1 uuid:='00000000-0000-0000-0000-000000000051';
  v_p2 uuid:='00000000-0000-0000-0000-000000000052';
BEGIN
  IF (SELECT count(*) FROM public.tournaments t
      WHERE t.id IN (v_first,v_second)
        AND t.results_uploaded IS TRUE AND t.status='completed')<>2
  THEN RAISE EXCEPTION 'FAIL: two leagues did not both commit'; END IF;

  IF (SELECT count(*) FROM sharkania_release_qa.elo_publication ep
      WHERE ep.tournament_id IN (v_first,v_second))<>2
   OR (SELECT count(*) FROM public.tournament_results tr
      WHERE tr.tournament_id IN (v_first,v_second))<>4
   OR (SELECT count(*) FROM public.elo_history eh
      WHERE eh.tournament_id IN (v_first,v_second))<>4
   OR (SELECT count(*) FROM sharkania_release_qa.currency_posting cp
      WHERE cp.tournament_id IN (v_first,v_second))<>4
   OR (SELECT count(*) FROM sharkania_release_qa.elo_player_checkpoint ck
       JOIN sharkania_release_qa.elo_publication ep
        ON ep.id=ck.publication_id
      WHERE ep.tournament_id IN (v_first,v_second))<>4
  THEN RAISE EXCEPTION 'FAIL: cross-league audit/result/Elo/posting duplication or loss'; END IF;

  IF NOT EXISTS (
      SELECT 1 FROM sharkania_release_qa.elo_publication
      WHERE tournament_id=v_first
        AND league_id='00000000-0000-0000-0000-000000000041'
        AND actor_profile_id='00000000-0000-0000-0000-000000000002'
  ) OR NOT EXISTS (
      SELECT 1 FROM sharkania_release_qa.elo_publication
      WHERE tournament_id=v_second
        AND league_id='00000000-0000-0000-0000-000000000042'
        AND actor_profile_id='00000000-0000-0000-0000-000000000005'
  ) THEN RAISE EXCEPTION 'FAIL: cross-league audit actor or ownership wrong'; END IF;

  IF EXISTS (
      SELECT 1 FROM (VALUES(v_p1),(v_p2)) AS players(player_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.tournament_results a
        JOIN public.tournament_results b ON a.player_id=b.player_id
        JOIN public.players p ON p.id=b.player_id
        WHERE a.tournament_id=v_first
          AND b.tournament_id=v_second
          AND a.player_id=players.player_id
          AND a.elo_after=b.elo_before
          AND b.elo_after=p.elo_rating
      )
  ) THEN RAISE EXCEPTION 'FAIL: different leagues did not chain committed Elo'; END IF;

  IF (SELECT count(*) FROM public.league_standings s
      WHERE s.league_id='00000000-0000-0000-0000-000000000042'
        AND s.player_id IN (v_p1,v_p2))<>2
   OR (SELECT count(*) FROM public.league_standings s
      WHERE s.league_id='00000000-0000-0000-0000-000000000041'
        AND s.player_id IN (v_p1,v_p2))<>2
  THEN RAISE EXCEPTION 'FAIL: standings across different leagues omitted shared players'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id IN (v_p1,v_p2) AND p.total_tournaments<>4
  ) THEN RAISE EXCEPTION 'FAIL: shared player tournament count incorrect'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sharkania_release_qa.currency_posting j
    WHERE j.tournament_id=v_first AND j.player_id=v_p1
      AND j.currency='USD' AND j.buy_ins_count=2 AND j.entry_spend=6.60
  ) OR NOT EXISTS (
    SELECT 1 FROM sharkania_release_qa.currency_posting j
    WHERE j.tournament_id=v_second AND j.player_id=v_p1
      AND j.currency='USD' AND j.buy_ins_count=1 AND j.entry_spend=3.30
  ) THEN RAISE EXCEPTION 'FAIL: cross-league buy-in entries not recorded'; END IF;

  RAISE NOTICE 'PASS: two primary organizers, two leagues, two shared players, ordered Elo and independent standings';
END;
$qa$;
