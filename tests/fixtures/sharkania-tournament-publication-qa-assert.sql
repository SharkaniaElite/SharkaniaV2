\set ON_ERROR_STOP on
-- Real PostgreSQL 17 execution against the synthetic qa_publish database only.
-- IDs and JWT claims are fictitious and are NOT production credentials.

CREATE TEMP TABLE qa_payload(name text PRIMARY KEY, payload jsonb NOT NULL);
INSERT INTO qa_payload VALUES
('initial', '[
  {"player_id":"00000000-0000-0000-0000-000000000051","nickname":"QaPlayerOne","country_code":"CL","position":1,"prize_won":100,"bounties_won":0,"league_points_earned":100,"ccp_club":"ALPHA","buy_ins_count":2},
  {"player_id":"00000000-0000-0000-0000-000000000052","nickname":"QaPlayerTwo","country_code":"CL","position":2,"prize_won":0,"bounties_won":0,"league_points_earned":50,"ccp_club":"BETA","buy_ins_count":1}
]'::jsonb),
('edited', '[
  {"player_id":"00000000-0000-0000-0000-000000000051","nickname":"QaPlayerOne","country_code":"CL","position":1,"prize_won":120,"bounties_won":0,"league_points_earned":130,"ccp_club":"ALPHA","buy_ins_count":3},
  {"player_id":"00000000-0000-0000-0000-000000000052","nickname":"QaPlayerTwo","country_code":"CL","position":2,"prize_won":30,"bounties_won":0,"league_points_earned":60,"ccp_club":"BETA","buy_ins_count":1},
  {"player_id":null,"nickname":"NewQaNickname","country_code":"CL","position":3,"prize_won":0,"bounties_won":0,"league_points_earned":20,"ccp_club":"BETA","buy_ins_count":1}
]'::jsonb),
('later', '[
  {"player_id":"00000000-0000-0000-0000-000000000051","nickname":"QaPlayerOne","country_code":"CL","position":2,"prize_won":10,"bounties_won":0,"league_points_earned":10,"ccp_club":"ALPHA","buy_ins_count":1},
  {"player_id":"00000000-0000-0000-0000-000000000052","nickname":"QaPlayerTwo","country_code":"CL","position":1,"prize_won":40,"bounties_won":0,"league_points_earned":80,"ccp_club":"BETA","buy_ins_count":2}
]'::jsonb);

GRANT SELECT ON qa_payload TO authenticated;
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
DO $qa$
BEGIN
  PERFORM public.publish_tournament_results_guarded(
    '00000000-0000-0000-0000-000000000011',
    (SELECT payload FROM qa_payload WHERE name='initial'));
  RAISE EXCEPTION 'FAIL: normal player published tournament';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: player without club denied';
END;
$qa$;

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $qa$
BEGIN
  PERFORM public.publish_tournament_results_guarded(
    '00000000-0000-0000-0000-000000000011',
    (SELECT payload FROM qa_payload WHERE name='initial'));
  RAISE EXCEPTION 'FAIL: other club admin published tournament';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: other club admin denied';
END;
$qa$;

SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
BEGIN
  PERFORM public.publish_tournament_results_guarded(
    '00000000-0000-0000-0000-000000000011',
    (SELECT payload || '[{"elo_after":9999}]'::jsonb
       FROM qa_payload WHERE name='initial'));
  RAISE EXCEPTION 'FAIL: manipulated Elo was accepted';
EXCEPTION WHEN invalid_parameter_value THEN
  RAISE NOTICE 'PASS: malformed client-controlled Elo rejected';
END;
$qa$;
DO $qa$
BEGIN
  PERFORM public.publish_tournament_results_guarded(
    '00000000-0000-0000-0000-000000000011',
    pg_catalog.jsonb_set((SELECT payload FROM qa_payload WHERE name='initial'),
      '{0,position}', '1.5'::jsonb));
  RAISE EXCEPTION 'FAIL: fractional position was accepted';
EXCEPTION WHEN invalid_parameter_value THEN
  RAISE NOTICE 'PASS: fractional position rejected by server';
END;
$qa$;

-- First publication: two existing players, USD, reentries and unified ELO.
DO $qa$
DECLARE r jsonb;
BEGIN
  SELECT public.publish_tournament_results_guarded(
    '00000000-0000-0000-0000-000000000011',
    (SELECT payload FROM qa_payload WHERE name='initial')) INTO r;
  IF r->>'success'<>'true' OR r->>'players_processed'<>'2' THEN
    RAISE EXCEPTION 'FAIL: initial publication response %',r;
  END IF;
  RAISE NOTICE 'PASS: first publication transaction accepted';
END;
$qa$;
RESET ROLE;

DO $qa$
BEGIN
 IF (SELECT count(*) FROM public.elo_history)<>2
   OR (SELECT count(*) FROM public.tournament_results)<>2
   OR (SELECT count(*) FROM public.league_standings)<>2
   OR (SELECT total_buy_ins_spent FROM public.players
       WHERE id='00000000-0000-0000-0000-000000000051')<>20
   OR (SELECT total_prize_won FROM public.players
       WHERE id='00000000-0000-0000-0000-000000000051')<>100
   OR (SELECT total_points FROM public.league_standings
       WHERE player_id='00000000-0000-0000-0000-000000000051')<>100
   OR EXISTS(SELECT 1 FROM public.profiles prof JOIN public.players p ON p.profile_id=prof.id
       WHERE prof.unified_elo IS DISTINCT FROM p.elo_rating)
   OR (SELECT results_uploaded FROM public.tournaments
       WHERE id='00000000-0000-0000-0000-000000000011') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'FAIL: first publication left incorrect ELO, profile, prize, standings or entries';
 END IF;
 RAISE NOTICE 'PASS: ELO, unified profiles, results, buy-ins and standings published together';
END;
$qa$;

-- Idempotency of aggregates: identical second request must not accumulate.
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.publish_tournament_results_guarded(
  '00000000-0000-0000-0000-000000000011',
  (SELECT payload FROM qa_payload WHERE name='initial'));
RESET ROLE;
DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.elo_history)<>2
    OR (SELECT total_tournaments FROM public.players
      WHERE id='00000000-0000-0000-0000-000000000051')<>1
    OR (SELECT total_buy_ins_spent FROM public.players
      WHERE id='00000000-0000-0000-0000-000000000051')<>20
  THEN RAISE EXCEPTION 'FAIL: repeat publication duplicated history/stats';
  END IF;
  RAISE NOTICE 'PASS: repeated request preserves aggregate values';
END;
$qa$;

-- Inject a failure AFTER old results are deleted, before ELO insert; the
-- entire statement must roll back, including newly created players.
CREATE FUNCTION public.qa_fail_elo_insert()
RETURNS trigger LANGUAGE plpgsql AS $qa$
BEGIN
  IF current_setting('app.qa.fail_elo_insert',true)='on' THEN
    RAISE EXCEPTION 'Injected Elo history insert failure'
      USING ERRCODE='P0010';
  END IF;
  RETURN NEW;
END;
$qa$;
CREATE TRIGGER qa_fail_elo
BEFORE INSERT ON public.elo_history FOR EACH ROW
EXECUTE FUNCTION public.qa_fail_elo_insert();

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SET app.qa.fail_elo_insert='on';
DO $qa$
BEGIN
  PERFORM public.publish_tournament_results_guarded(
    '00000000-0000-0000-0000-000000000011',
    (SELECT payload FROM qa_payload WHERE name='edited'));
  RAISE EXCEPTION 'FAIL: injected Elo error was ignored';
EXCEPTION WHEN SQLSTATE 'P0010' THEN
  RAISE NOTICE 'PASS: expected Elo failure observed after reset/new player';
END;
$qa$;
SET app.qa.fail_elo_insert='off';
RESET ROLE;
DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.players)<>2
    OR (SELECT count(*) FROM public.tournament_results)<>2
    OR (SELECT count(*) FROM public.elo_history)<>2
    OR (SELECT total_prize_won FROM public.players
      WHERE id='00000000-0000-0000-0000-000000000051')<>100
    OR (SELECT total_points FROM public.league_standings
      WHERE player_id='00000000-0000-0000-0000-000000000051')<>100
  THEN RAISE EXCEPTION 'FAIL: failed edit left partial changes';
  END IF;
  RAISE NOTICE 'PASS: injected failure rolled back old reset AND new-player creation';
END;
$qa$;
DROP TRIGGER qa_fail_elo ON public.elo_history;
DROP FUNCTION public.qa_fail_elo_insert();

-- Commit a 3-player last-event replacement (one new nickname).
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.publish_tournament_results_guarded(
  '00000000-0000-0000-0000-000000000011',
  (SELECT payload FROM qa_payload WHERE name='edited'));
RESET ROLE;
DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.players)<>3
    OR (SELECT count(*) FROM public.tournament_results)<>3
    OR (SELECT count(*) FROM public.elo_history)<>3
    OR (SELECT count(*) FROM public.league_standings)<>3
    OR (SELECT total_tournaments FROM public.players
        WHERE id='00000000-0000-0000-0000-000000000051')<>1
    OR (SELECT total_buy_ins_spent FROM public.players
        WHERE id='00000000-0000-0000-0000-000000000051')<>30
  THEN RAISE EXCEPTION 'FAIL: republish with new player incorrect';
  END IF;
  RAISE NOTICE 'PASS: 3-player last-event republish, new player, buy-ins and standings';
END;
$qa$;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
SELECT public.publish_tournament_results_guarded(
  '00000000-0000-0000-0000-000000000011',
  (SELECT payload FROM qa_payload WHERE name='edited'));
RESET ROLE;
DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.players)<>3
    OR (SELECT count(*) FROM public.elo_history)<>3
    OR (SELECT total_tournaments FROM public.players
        WHERE id='00000000-0000-0000-0000-000000000051')<>1
  THEN RAISE EXCEPTION 'FAIL: repeated 3-player re-publish duplicated data'; END IF;
  RAISE NOTICE 'PASS: repeated new-player payload creates no duplicates';
END;
$qa$;

-- Later date processes successfully in other club; reediting older date
-- must fail inside the RPC, not only as frontend preflight.
SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
SELECT public.publish_tournament_results_guarded(
  '00000000-0000-0000-0000-000000000012',
  (SELECT payload FROM qa_payload WHERE name='later'));
RESET ROLE;
DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.elo_history)<>5
  THEN RAISE EXCEPTION 'FAIL: later date was not published'; END IF;
  RAISE NOTICE 'PASS: later club/tournament published with cumulative Elo';
END;
$qa$;

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
BEGIN
  PERFORM public.publish_tournament_results_guarded(
    '00000000-0000-0000-0000-000000000011',
    (SELECT payload FROM qa_payload WHERE name='edited'));
  RAISE EXCEPTION 'FAIL: out-of-order republish was allowed';
EXCEPTION WHEN object_not_in_prerequisite_state THEN
  RAISE NOTICE 'PASS: older tournament edit refused with later history';
END;
$qa$;
RESET ROLE;

-- A new (not previously processed) tournament with an earlier date must
-- also fail closed after a later date has been committed.
INSERT INTO public.tournaments(id,club_id,buy_in,league_id,start_datetime)
VALUES ('00000000-0000-0000-0000-000000000013',
        '00000000-0000-0000-0000-000000000021',10,
        '00000000-0000-0000-0000-000000000041',
        '2026-10-30 12:00+00'::timestamptz);
-- The SQL Elo/financial model is USD-only until CLP calibration is approved.
INSERT INTO public.tournaments(id,club_id,buy_in,league_id,start_datetime,currency)
VALUES ('00000000-0000-0000-0000-000000000014',
        '00000000-0000-0000-0000-000000000021',10,
        '00000000-0000-0000-0000-000000000041',
        '2026-11-03 12:00+00'::timestamptz,'CLP');

SET ROLE authenticated;
SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
BEGIN
  PERFORM public.publish_tournament_results_guarded(
    '00000000-0000-0000-0000-000000000013',
    (SELECT payload FROM qa_payload WHERE name='initial'));
  RAISE EXCEPTION 'FAIL: backdated first publication was accepted';
EXCEPTION WHEN object_not_in_prerequisite_state THEN
  RAISE NOTICE 'PASS: initial backdated tournament rejected by server';
END;
$qa$;
DO $qa$
BEGIN
  PERFORM public.publish_tournament_results_guarded(
    '00000000-0000-0000-0000-000000000014',
    (SELECT payload FROM qa_payload WHERE name='initial'));
  RAISE EXCEPTION 'FAIL: unsupported CLP ELO was accepted';
EXCEPTION WHEN object_not_in_prerequisite_state THEN
  RAISE NOTICE 'PASS: unsupported CLP publication rejected without conversion';
END;
$qa$;
RESET ROLE;
DO $qa$
BEGIN
  IF (SELECT count(*) FROM public.elo_history)<>5
   OR (SELECT count(*) FROM public.tournament_results)<>5
   OR EXISTS (SELECT 1 FROM public.tournaments t
       WHERE t.id IN ('00000000-0000-0000-0000-000000000011',
                     '00000000-0000-0000-0000-000000000012')
         AND t.results_uploaded IS DISTINCT FROM true)
  THEN RAISE EXCEPTION 'FAIL: rejected chronology mutated data';
  END IF;
  RAISE NOTICE 'PASS FINAL: generalized publication + last-event republish transactional';
END;
$qa$;
