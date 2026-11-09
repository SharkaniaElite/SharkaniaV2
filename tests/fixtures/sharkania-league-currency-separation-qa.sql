\set ON_ERROR_STOP on
-- QA ONLY: per-currency aggregation tests with wholly synthetic postings.
-- These events are artificial and do not represent real result publications
-- or ELO; they exist ONLY to test the immutable financial projection.
BEGIN;
INSERT INTO public.tournaments
(id,club_id,buy_in,league_id,room_id,currency,start_datetime)
VALUES
('00000000-0000-0000-0000-000000000088',
 '00000000-0000-0000-0000-000000000021',3.30,
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031','USD','2026-11-07T20:00:00Z'),
('00000000-0000-0000-0000-000000000089',
 '00000000-0000-0000-0000-000000000021',12,
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031','EUR','2026-11-07T21:00:00Z'),
('00000000-0000-0000-0000-000000000090',
 '00000000-0000-0000-0000-000000000021',3300,
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031','CLP','2026-11-07T22:00:00Z');

INSERT INTO sharkania_release_qa.elo_publication(
 tournament_id,league_id,actor_profile_id,algorithm_version,input_fingerprint
)
SELECT t.id,t.league_id,'00000000-0000-0000-0000-000000000002'::uuid,
       'qa-currency-fixture',repeat('a',64)
FROM public.tournaments t
WHERE t.id IN (
 '00000000-0000-0000-0000-000000000088'::uuid,
 '00000000-0000-0000-0000-000000000089'::uuid,
 '00000000-0000-0000-0000-000000000090'::uuid
);

WITH amount(tournament_id,entry_count,prize,bounty) AS (
 VALUES
 ('00000000-0000-0000-0000-000000000088'::uuid,2,20::numeric,2::numeric),
 ('00000000-0000-0000-0000-000000000089'::uuid,3,15::numeric,1::numeric),
 ('00000000-0000-0000-0000-000000000090'::uuid,2,5000::numeric,200::numeric)
)
INSERT INTO sharkania_release_qa.currency_posting(
 publication_id,tournament_id,player_id,currency,
 buy_in_per_entry,buy_ins_count,prize_won,bounties_won
)
SELECT ep.id,t.id,'00000000-0000-0000-0000-000000000051'::uuid,
 t.currency,t.buy_in,a.entry_count,a.prize,a.bounty
FROM amount a
JOIN public.tournaments t ON t.id=a.tournament_id
JOIN sharkania_release_qa.elo_publication ep ON ep.tournament_id=t.id;

DO $qa$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM sharkania_release_qa.currency_totals_by_player x
 WHERE x.player_id='00000000-0000-0000-0000-000000000051'
   AND x.currency IN ('USD','EUR','CLP');
 IF n<>3
 OR NOT EXISTS(SELECT 1 FROM sharkania_release_qa.currency_totals_by_player
   WHERE player_id='00000000-0000-0000-0000-000000000051'
    AND currency='USD' AND total_entry_spend=6.60
    AND total_entries=2 AND total_prize_won=20 AND total_bounties_won=2)
 OR NOT EXISTS(SELECT 1 FROM sharkania_release_qa.currency_totals_by_player
   WHERE player_id='00000000-0000-0000-0000-000000000051'
    AND currency='EUR' AND total_entry_spend=36
    AND total_entries=3 AND total_prize_won=15 AND total_bounties_won=1)
 OR NOT EXISTS(SELECT 1 FROM sharkania_release_qa.currency_totals_by_player
   WHERE player_id='00000000-0000-0000-0000-000000000051'
    AND currency='CLP' AND total_entry_spend=6600
    AND total_entries=2 AND total_prize_won=5000 AND total_bounties_won=200)
 THEN RAISE EXCEPTION 'FAIL: currency projection mixed native amounts or lost reentries'; END IF;

 IF pg_catalog.has_table_privilege('anon',
   'sharkania_release_qa.currency_posting','SELECT')
 OR pg_catalog.has_table_privilege('authenticated',
   'sharkania_release_qa.currency_posting','SELECT')
 OR pg_catalog.has_table_privilege('anon',
   'sharkania_release_qa.currency_totals_by_player','SELECT')
 OR pg_catalog.has_table_privilege('authenticated',
   'sharkania_release_qa.currency_totals_by_player','SELECT')
 THEN RAISE EXCEPTION 'FAIL: financial journal exposed to API roles'; END IF;

 RAISE NOTICE 'PASS: three native currency totals are separate and not visible to anonymous/REST roles';
END;
$qa$;

DO $qa$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  UPDATE sharkania_release_qa.currency_posting SET prize_won=999
   WHERE tournament_id='00000000-0000-0000-0000-000000000088';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true;
 END;
 IF blocked IS NOT TRUE THEN
  RAISE EXCEPTION 'FAIL: currency posting was mutable';
 END IF;
 blocked:=false;
 BEGIN
  DELETE FROM sharkania_release_qa.currency_posting
   WHERE tournament_id='00000000-0000-0000-0000-000000000089';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true;
 END;
 IF blocked IS NOT TRUE THEN
  RAISE EXCEPTION 'FAIL: currency posting was deletable';
 END IF;
 RAISE NOTICE 'PASS: native currency journal cannot be updated or deleted';
END;
$qa$;
ROLLBACK;

DO $qa$
BEGIN
 IF EXISTS (SELECT 1 FROM sharkania_release_qa.currency_posting
    WHERE tournament_id IN (
      '00000000-0000-0000-0000-000000000088'::uuid,
      '00000000-0000-0000-0000-000000000089'::uuid,
      '00000000-0000-0000-0000-000000000090'::uuid))
 OR EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id IN (
      '00000000-0000-0000-0000-000000000088'::uuid,
      '00000000-0000-0000-0000-000000000089'::uuid,
      '00000000-0000-0000-0000-000000000090'::uuid))
 THEN RAISE EXCEPTION 'FAIL: synthetic currency test did not roll back'; END IF;
 RAISE NOTICE 'PASS: mixed-currency ledger QA was fully discarded';
END;
$qa$;
