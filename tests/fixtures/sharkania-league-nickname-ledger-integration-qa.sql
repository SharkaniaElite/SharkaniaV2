\set ON_ERROR_STOP on
-- QA-ONLY. Each fixture operation has synthetic IDs. Test transaction
-- rolls back all player creation and result publication at the end.
BEGIN;

INSERT INTO public.tournaments(
 id,club_id,buy_in,league_id,room_id,currency,start_datetime
) VALUES
 ('00000000-0000-0000-0000-000000000077',
  '00000000-0000-0000-0000-000000000021',3.30,
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031','USD','2026-11-05T21:00:00Z'),
 ('00000000-0000-0000-0000-000000000078',
  '00000000-0000-0000-0000-000000000021',3300,
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031','CLP','2026-11-06T01:00:00Z'),
 ('00000000-0000-0000-0000-000000000079',
  '00000000-0000-0000-0000-000000000021',3.30,
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031','USD','2026-11-06T02:00:00Z'),
 ('00000000-0000-0000-0000-000000000080',
  '00000000-0000-0000-0000-000000000021',12,
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031','EUR','2026-11-06T03:00:00Z');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
  PERFORM public.publish_league_nickname_results_guarded_qa(
   '00000000-0000-0000-0000-000000000077','[
    {"nickname":"SharkHero","position":1,"prize_won":10,"bounties_won":0,
     "league_points_earned":20,"buy_ins_count":1},
    {"nickname":"NewShark","position":2,"prize_won":0,"bounties_won":0,
     "league_points_earned":5,"buy_ins_count":1}]'::jsonb
  );
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true;
 END;
 IF blocked IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: secondary admin could publish league results'; END IF;
 RAISE NOTICE 'PASS: secondary club admin denied before player creation';
END;
$qa$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE tid uuid; blocked boolean; v_error text;
BEGIN
 FOR tid IN SELECT x.id FROM (VALUES
  ('00000000-0000-0000-0000-000000000078'::uuid),
  ('00000000-0000-0000-0000-000000000080'::uuid)
 ) AS x(id)
 LOOP
  blocked:=false;
  BEGIN
   PERFORM public.publish_league_nickname_results_guarded_qa(
    tid,'[
    {"nickname":"NewShark","position":1,"prize_won":10,"bounties_won":0,
     "league_points_earned":20,"buy_ins_count":1},
    {"nickname":"SharkHero","position":2,"prize_won":0,"bounties_won":0,
     "league_points_earned":5,"buy_ins_count":1}]'::jsonb);
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
   GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
   IF v_error NOT LIKE 'Non-USD league publication needs%' THEN
     RAISE EXCEPTION 'FAIL: unexpected non-USD reason: %',v_error;
   END IF;
   blocked:=true;
  END;
  IF blocked IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: non-USD nickname load was accepted';
  END IF;
 END LOOP;
 RAISE NOTICE 'PASS: CLP/EUR rejected before any nickname creation';

 blocked:=false;
 BEGIN
  PERFORM public.publish_league_nickname_results_guarded_qa(
   '00000000-0000-0000-0000-000000000079','[
    {"nickname":"NewShark","position":1,"prize_won":10,"bounties_won":0,
     "league_points_earned":20,"buy_ins_count":1},
    {"nickname":" newshark ","position":2,"prize_won":0,"bounties_won":0,
     "league_points_earned":5,"buy_ins_count":1}]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT422' THEN blocked:=true;
 END;
 IF blocked IS NOT TRUE THEN
  RAISE EXCEPTION 'FAIL: case/whitespace duplicate was not rejected';
 END IF;

 blocked:=false;
 BEGIN
  PERFORM public.publish_league_nickname_results_guarded_qa(
   '00000000-0000-0000-0000-000000000079','[
    {"nickname":"NewShark","player_id":"00000000-0000-0000-0000-000000000051",
     "position":1,"prize_won":10,"bounties_won":0,
     "league_points_earned":20,"buy_ins_count":1},
    {"nickname":"SharkHero","position":2,"prize_won":0,"bounties_won":0,
     "league_points_earned":5,"buy_ins_count":1}]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT422' THEN blocked:=true;
 END;
 IF blocked IS NOT TRUE THEN
  RAISE EXCEPTION 'FAIL: CSV-supplied player_id spoofing was accepted';
 END IF;
 RAISE NOTICE 'PASS: duplicate and client-controlled player IDs rejected';
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
 IF EXISTS (SELECT 1 FROM public.players WHERE nickname='NewShark') OR
 EXISTS(SELECT 1 FROM sharkania_release_qa.elo_publication ep WHERE ep.tournament_id IN (
  '00000000-0000-0000-0000-000000000077'::uuid,
  '00000000-0000-0000-0000-000000000078'::uuid,
  '00000000-0000-0000-0000-000000000079'::uuid,
  '00000000-0000-0000-0000-000000000080'::uuid
 ))
 THEN RAISE EXCEPTION 'FAIL: denied upload wrote players or audit rows'; END IF;
 RAISE NOTICE 'PASS: invalid attempts left no players or publication events';
END;
$qa$;

-- First successful upload: a case-folded known nickname plus one new alias.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE answer jsonb;
BEGIN
 answer:=public.publish_league_nickname_results_guarded_qa(
 '00000000-0000-0000-0000-000000000077','[
 {"nickname":"  sHarkheRo ","position":1,"prize_won":20,
  "bounties_won":2,"league_points_earned":30,"ccp_club":"CCP-CUSTOM",
  "buy_ins_count":2},
 {"nickname":"NuevoTiburon","position":2,"prize_won":0,
  "bounties_won":0,"league_points_earned":12,"ccp_club":null,
  "buy_ins_count":1}
 ]'::jsonb);
 IF answer->>'status'<>'published'
    OR answer->>'new_players'<>'1'
    OR answer->>'currency'<>'USD'
    OR answer->>'currency_postings'<>'2'
 THEN RAISE EXCEPTION 'FAIL: success response malformed: %',answer; END IF;
 RAISE NOTICE 'PASS: first league upload resolves existing alias and creates exactly one new player';
END;
$qa$;
RESET ROLE;

DO $qa$
DECLARE v_new uuid;
BEGIN
 SELECT id INTO v_new FROM public.players
 WHERE nickname='NuevoTiburon' AND room_id='00000000-0000-0000-0000-000000000031';
 IF v_new IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id=v_new AND p.profile_id IS NULL AND p.country_code='CL'
      AND p.slug LIKE 'qa-nick-%'
      AND p.elo_rating=1177.77)
    OR NOT EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id='00000000-0000-0000-0000-000000000051'
        AND p.nickname='SharkHero' AND p.elo_rating=1222.23)
    OR EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.room_id='00000000-0000-0000-0000-000000000031'
       AND lower(btrim(p.nickname))='sharkhero'
       AND p.id<>'00000000-0000-0000-0000-000000000051'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.tournament_results r
      WHERE r.tournament_id='00000000-0000-0000-0000-000000000077'
       AND r.player_id=v_new)
    OR NOT EXISTS (
      SELECT 1 FROM sharkania_release_qa.currency_posting j
      JOIN sharkania_release_qa.elo_publication a
        ON a.id=j.publication_id
      WHERE a.tournament_id='00000000-0000-0000-0000-000000000077'
        AND j.player_id='00000000-0000-0000-0000-000000000051'
        AND j.currency='USD' AND j.buy_in_per_entry=3.30
        AND j.buy_ins_count=2 AND j.entry_spend=6.60
        AND j.prize_won=20 AND j.bounties_won=2
    )
    OR (SELECT count(*) FROM sharkania_release_qa.currency_posting
        WHERE tournament_id='00000000-0000-0000-0000-000000000077')<>2
 THEN
  RAISE EXCEPTION 'FAIL: casefold identity, ledger amount, or Elo parity differs';
 END IF;
 RAISE NOTICE 'PASS: player identity, origin country, ELO and native USD ledger match';
END;
$qa$;

-- Trigger injects failure AFTER inner writer succeeded; outer RPC must
-- revert newly created players, profiles, Elo, standings and all postings.
CREATE OR REPLACE FUNCTION public.qa_reject_currency_posting()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $qa$
BEGIN
 IF NEW.player_id IN (
   SELECT p.id FROM public.players p WHERE p.nickname='RollbackShark'
 ) THEN
   RAISE EXCEPTION 'QA: fail currency ledger after Elo upload'
    USING ERRCODE='PT503';
 END IF;
 RETURN NEW;
END;
$qa$;
CREATE TRIGGER qa_force_currency_failure
 BEFORE INSERT ON sharkania_release_qa.currency_posting
 FOR EACH ROW EXECUTE FUNCTION public.qa_reject_currency_posting();

CREATE TEMP TABLE qa_nickname_state AS
SELECT
 (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM public.players p) AS players_before,
 (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM public.profiles p) AS profiles_before,
 (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.id),'[]'::jsonb) FROM public.elo_history h) AS elo_before,
 (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) FROM public.tournament_results r) AS results_before,
 (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.league_id,s.player_id),'[]'::jsonb)
    FROM public.league_standings s) AS standings_before,
 (SELECT COALESCE(jsonb_agg(to_jsonb(j) ORDER BY j.id),'[]'::jsonb)
    FROM sharkania_release_qa.currency_posting j) AS postings_before;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN
 PERFORM public.publish_league_nickname_results_guarded_qa(
 '00000000-0000-0000-0000-000000000079','[
 {"nickname":"SharkHero","position":1,"prize_won":9,
  "bounties_won":0,"league_points_earned":15,"buy_ins_count":1},
 {"nickname":"RollbackShark","position":2,"prize_won":0,
  "bounties_won":0,"league_points_earned":5,"buy_ins_count":1}
 ]'::jsonb);
 EXCEPTION WHEN SQLSTATE 'PT503' THEN blocked:=true;
 END;
 IF blocked IS NOT TRUE THEN
  RAISE EXCEPTION 'FAIL: forced journal failure did not abort the entire upload';
 END IF;
 RAISE NOTICE 'PASS: journal insertion failure rolled back nickname creation and Elo';
END;
$qa$;
RESET ROLE;

DO $qa$
DECLARE s record;
BEGIN
 SELECT * INTO s FROM qa_nickname_state;
 IF EXISTS (SELECT 1 FROM public.players WHERE nickname='RollbackShark')
  OR EXISTS (SELECT 1 FROM sharkania_release_qa.elo_publication
     WHERE tournament_id='00000000-0000-0000-0000-000000000079')
  OR (SELECT results_uploaded FROM public.tournaments
     WHERE id='00000000-0000-0000-0000-000000000079') IS DISTINCT FROM false
  OR s.players_before IS DISTINCT FROM
     (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM public.players p)
  OR s.profiles_before IS DISTINCT FROM
     (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM public.profiles p)
  OR s.elo_before IS DISTINCT FROM
     (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.id),'[]'::jsonb) FROM public.elo_history h)
  OR s.results_before IS DISTINCT FROM
     (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) FROM public.tournament_results r)
  OR s.standings_before IS DISTINCT FROM
     (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.league_id,t.player_id),'[]'::jsonb) FROM public.league_standings t)
  OR s.postings_before IS DISTINCT FROM
     (SELECT COALESCE(jsonb_agg(to_jsonb(j) ORDER BY j.id),'[]'::jsonb)
      FROM sharkania_release_qa.currency_posting j)
 THEN RAISE EXCEPTION 'FAIL: post-writer journal failure left partial data'; END IF;
 RAISE NOTICE 'PASS: full business snapshot unchanged after late ledger failure';
END;
$qa$;
ROLLBACK;
SELECT 'PASS: nickname and currency-tagged journal changes fully rolled back' AS qa_status;
