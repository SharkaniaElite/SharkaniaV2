\set ON_ERROR_STOP on
-- Verify cross-writer Elo continuity on real shared players and no duplicate
-- currency/standing journals. Entire fixture is artificial and local.
DO $qa$
DECLARE
 a uuid:='00000000-0000-0000-0000-000000000111';
 b uuid:='00000000-0000-0000-0000-000000000112';
 v int;
BEGIN
 IF (SELECT count(*) FROM public.tournaments
      WHERE id IN(a,b) AND results_uploaded IS TRUE AND status='completed')<>2
 OR (SELECT count(*) FROM public.tournament_results
      WHERE tournament_id IN(a,b))<>4
 OR (SELECT count(*) FROM public.elo_history
      WHERE tournament_id IN(a,b))<>4
 OR (SELECT count(*) FROM sharkania_release.elo_publication
      WHERE tournament_id=a)<>1
 OR (SELECT count(*) FROM sharkania_release.independent_elo_publication
      WHERE tournament_id=b)<>1
 OR (SELECT count(*) FROM sharkania_release.currency_posting
      WHERE tournament_id=a)<>2
 OR (SELECT count(*) FROM sharkania_release.independent_currency_posting
      WHERE tournament_id=b)<>2
 THEN RAISE EXCEPTION 'FAIL: cross-writer loss, duplicate or unfinished publication'; END IF;
 SELECT count(*)::int INTO v FROM (VALUES
  ('00000000-0000-0000-0000-000000000051'::uuid),
  ('00000000-0000-0000-0000-000000000052'::uuid)
 ) AS x(player_id)
 JOIN public.tournament_results ra ON ra.tournament_id=a AND ra.player_id=x.player_id
 JOIN public.tournament_results rb ON rb.tournament_id=b AND rb.player_id=x.player_id
 JOIN public.players p ON p.id=x.player_id
 WHERE ra.elo_after=rb.elo_before AND rb.elo_after=p.elo_rating
    AND p.total_tournaments=4;
 IF v<>2 THEN
  RAISE EXCEPTION 'FAIL: same player Elo history was not serialized across league/independent writers'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sharkania_release.currency_posting j
   WHERE j.tournament_id=a AND j.player_id='00000000-0000-0000-0000-000000000051'
    AND j.buy_ins_count=2 AND j.entry_spend=6.60)
 OR NOT EXISTS(SELECT 1 FROM public.league_standings s
   WHERE s.league_id='00000000-0000-0000-0000-000000000041'
     AND s.player_id='00000000-0000-0000-0000-000000000051'
     AND s.tournaments_played=2)
 THEN RAISE EXCEPTION 'FAIL: league standings or multi-entry journal drift'; END IF;
 RAISE NOTICE 'PASS: league then independent, observed shared Elo continuity and separate currency journals';
END;
$qa$;
