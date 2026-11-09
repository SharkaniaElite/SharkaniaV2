\set ON_ERROR_STOP on
-- These are synthetic data in disposable PostgreSQL 17. This fixture
-- verifies committed results of a deliberate parallel two-client race.
DO $qa$
DECLARE n integer;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.tournaments
   WHERE id='00000000-0000-0000-0000-000000000093'
     AND results_uploaded=true AND status='completed')
 THEN RAISE EXCEPTION 'FAIL: race publication did not commit'; END IF;

 SELECT count(*) INTO n FROM sharkania_release_qa.elo_publication
 WHERE tournament_id='00000000-0000-0000-0000-000000000093';
 IF n<>1 THEN RAISE EXCEPTION 'FAIL: race produced % publications',n; END IF;

 SELECT count(*) INTO n FROM public.tournament_results
 WHERE tournament_id='00000000-0000-0000-0000-000000000093';
 IF n<>2 THEN RAISE EXCEPTION 'FAIL: race produced % result rows',n; END IF;

 SELECT count(*) INTO n FROM public.elo_history
 WHERE tournament_id='00000000-0000-0000-0000-000000000093';
 IF n<>2 THEN RAISE EXCEPTION 'FAIL: race produced % history rows',n; END IF;

 SELECT count(*) INTO n FROM sharkania_release_qa.currency_posting
 WHERE tournament_id='00000000-0000-0000-0000-000000000093';
 IF n<>2 THEN RAISE EXCEPTION 'FAIL: race produced % native-currency postings',n; END IF;

 SELECT count(*) INTO n FROM public.players p
 WHERE p.room_id='00000000-0000-0000-0000-000000000031'
 AND lower(btrim(p.nickname)) IN ('racesharkone','racesharktwo');
 IF n<>2 THEN RAISE EXCEPTION 'FAIL: race duplicated or lost % new players',n; END IF;

 IF EXISTS (
 SELECT 1 FROM public.players p
 WHERE p.room_id='00000000-0000-0000-0000-000000000031'
   AND lower(btrim(p.nickname)) IN ('racesharkone','racesharktwo')
   AND (p.profile_id IS NOT NULL OR p.total_tournaments<>1)
 ) THEN RAISE EXCEPTION 'FAIL: profile linked or tournament stats counted twice'; END IF;

 IF (SELECT count(*) FROM sharkania_release_qa.currency_posting j
   JOIN public.players p ON p.id=j.player_id
   WHERE j.tournament_id='00000000-0000-0000-0000-000000000093'
     AND (
       (lower(btrim(p.nickname))='racesharkone'
         AND j.currency='USD' AND j.buy_ins_count=2 AND j.entry_spend=6.60)
       OR
       (lower(btrim(p.nickname))='racesharktwo'
         AND j.currency='USD' AND j.buy_ins_count=1 AND j.entry_spend=3.30)
     )
 )<>2 THEN RAISE EXCEPTION 'FAIL: race left incorrect buy-in journal'; END IF;

 RAISE NOTICE 'PASS: competing authenticated requests committed one result/ledger set, no duplicate nicknames';
END;
$qa$;
