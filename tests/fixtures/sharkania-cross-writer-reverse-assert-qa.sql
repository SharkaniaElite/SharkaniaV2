\set ON_ERROR_STOP on
DO $qa$
DECLARE a uuid:='00000000-0000-0000-0000-000000000114';
 b uuid:='00000000-0000-0000-0000-000000000115';
 v int;
BEGIN
 IF (SELECT count(*) FROM public.tournaments
    WHERE id IN(a,b) AND results_uploaded AND status='completed')<>2
 OR (SELECT count(*) FROM public.tournament_results
    WHERE tournament_id IN(a,b))<>4
 OR (SELECT count(*) FROM public.elo_history
    WHERE tournament_id IN(a,b))<>4
 OR (SELECT count(*) FROM sharkania_release.independent_elo_publication
    WHERE tournament_id=a)<>1
 OR (SELECT count(*) FROM sharkania_release.elo_publication
    WHERE tournament_id=b)<>1
 OR (SELECT count(*) FROM sharkania_release.independent_currency_posting
    WHERE tournament_id=a)<>2
 OR (SELECT count(*) FROM sharkania_release.currency_posting
    WHERE tournament_id=b)<>2
 THEN RAISE EXCEPTION 'FAIL: inverse cross-writer transaction skipped/duplicated rows'; END IF;
 SELECT count(*) INTO v FROM
   (VALUES('00000000-0000-0000-0000-000000000051'::uuid),
          ('00000000-0000-0000-0000-000000000052'::uuid)) AS ids(id)
 JOIN public.tournament_results r1 ON r1.tournament_id=a AND r1.player_id=ids.id
 JOIN public.tournament_results r2 ON r2.tournament_id=b AND r2.player_id=ids.id
 JOIN public.players p ON p.id=ids.id
 WHERE r1.elo_after=r2.elo_before
   AND r2.elo_after=p.elo_rating AND p.total_tournaments=4;
 IF v<>2 THEN RAISE EXCEPTION 'FAIL: independent->league shared Elo snapshot continuity broken'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.league_standings s WHERE
    s.league_id='00000000-0000-0000-0000-000000000041'
    AND s.player_id='00000000-0000-0000-0000-000000000051'
    AND s.tournaments_played=3)
 THEN RAISE EXCEPTION 'FAIL: independent result changed league-only standings count'; END IF;
 RAISE NOTICE 'PASS: independent then league concurrency, shared player Elo and rankings preserved';
END;
$qa$;
