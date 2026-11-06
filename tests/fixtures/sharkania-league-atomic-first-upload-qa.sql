\set ON_ERROR_STOP on
-- ALL transactions, users, leagues and results are synthetic.
-- This creates no persistent production artifacts.
BEGIN;
-- Existing player P51 has a second nickname in another room attached to the
-- SAME profile. Unified Elo must accumulate BOTH identities' Elo changes.
INSERT INTO public.players(id,profile_id,room_id,elo_rating,elo_peak)
VALUES ('00000000-0000-0000-0000-000000000053',
        '00000000-0000-0000-0000-000000000061',
        '00000000-0000-0000-0000-000000000032',1240,1240);
INSERT INTO public.elo_history(
 tournament_id,player_id,elo_before,elo_after,elo_change,recorded_at
) VALUES (
 '00000000-0000-0000-0000-000000000012',
 '00000000-0000-0000-0000-000000000053',
 1200,1240,40,'2026-11-03T23:00:00Z'
);
-- Include the actual guarded results RPC, already created from prototype SQL.
-- Source player P51 existing league_standings row must preserve its identity.
CREATE OR REPLACE FUNCTION public.qa_inject_elo_failure()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $f$
BEGIN
 IF NEW.player_id='00000000-0000-0000-0000-000000000052' THEN
  RAISE EXCEPTION 'QA injection: simulate second Elo history INSERT failure'
   USING ERRCODE='PT500';
 END IF;
 RETURN NEW;
END;
$f$;

-- Fail while inserting a checkpoint. The preceding publication row must
-- roll back together with the incomplete checkpoint and ALL business rows.
CREATE OR REPLACE FUNCTION public.qa_fail_checkpoint()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $f$
BEGIN
 IF NEW.player_id='00000000-0000-0000-0000-000000000052' THEN
  RAISE EXCEPTION 'QA injected failure while writing second checkpoint'
    USING ERRCODE='PT502';
 END IF;
 RETURN NEW;
END;
$f$;
CREATE TRIGGER qa_fail_checkpoint_insert
BEFORE INSERT ON sharkania_release_qa.elo_player_checkpoint
FOR EACH ROW EXECUTE FUNCTION public.qa_fail_checkpoint();
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $test$
DECLARE payload jsonb:='[
 {"player_id":"00000000-0000-0000-0000-000000000051","position":1,
  "prize_won":20,"bounties_won":2,"league_points_earned":30,
  "ccp_club":"CCP-P51","buy_ins_count":2},
 {"player_id":"00000000-0000-0000-0000-000000000052","position":2,
  "prize_won":0,"bounties_won":0,"league_points_earned":12,
  "ccp_club":"CCP-P52","buy_ins_count":1}
]'::jsonb;
BEGIN
 BEGIN
  PERFORM public.publish_league_results_guarded_qa(
   '00000000-0000-0000-0000-000000000071','upload',payload);
  RAISE EXCEPTION 'FAIL: a bad checkpoint should prevent publication';
 EXCEPTION WHEN SQLSTATE 'PT502' THEN
  RAISE NOTICE 'PASS: failed second checkpoint rejected entire publication';
 END;
END $test$;
RESET ROLE;
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM sharkania_release_qa.elo_publication
           WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 OR EXISTS(SELECT 1 FROM public.tournament_results
           WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 OR EXISTS(SELECT 1 FROM public.elo_history
           WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 THEN RAISE EXCEPTION 'FAIL: partial audit or business rows survived'; END IF;
 RAISE NOTICE 'PASS: audit and business rows rolled back together';
END $test$;
DROP TRIGGER qa_fail_checkpoint_insert ON sharkania_release_qa.elo_player_checkpoint;
DROP FUNCTION public.qa_fail_checkpoint();

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000005';
DO $test$
DECLARE payload jsonb:='[
 {"player_id":"00000000-0000-0000-0000-000000000051","position":1,
  "prize_won":20,"bounties_won":2,"league_points_earned":30,
  "ccp_club":"CCP-P51","buy_ins_count":2},
 {"player_id":"00000000-0000-0000-0000-000000000052","position":2,
  "prize_won":0,"bounties_won":0,"league_points_earned":12,
  "ccp_club":"CCP-P52","buy_ins_count":1}
]'::jsonb;
BEGIN
 BEGIN
  PERFORM public.publish_league_results_guarded_qa(
   '00000000-0000-0000-0000-000000000071','upload',payload);
  RAISE EXCEPTION 'FAIL: club B uploaded results of A league';
 EXCEPTION WHEN SQLSTATE '42501' THEN
  RAISE NOTICE 'PASS: secondary club cannot publish to primary A league';
 END;
END $test$;
RESET ROLE;

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claim.sub='';
DO $test$
BEGIN
 BEGIN
  PERFORM public.publish_league_results_guarded_qa(
   '00000000-0000-0000-0000-000000000071','upload','[]'::jsonb);
  RAISE EXCEPTION 'FAIL: anonymous published results';
 EXCEPTION WHEN SQLSTATE '42501' THEN
  RAISE NOTICE 'PASS: anonymous cannot execute guarded results writer';
 END;
END $test$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $test$
DECLARE
 payload jsonb:='[
 {"player_id":"00000000-0000-0000-0000-000000000051","position":1,
  "prize_won":20,"bounties_won":2,"league_points_earned":30,
  "ccp_club":"CCP-P51","buy_ins_count":2},
 {"player_id":"00000000-0000-0000-0000-000000000052","position":2,
  "prize_won":0,"bounties_won":0,"league_points_earned":12,
  "ccp_club":"CCP-P52","buy_ins_count":1}
]'::jsonb;
BEGIN
 FOR i IN 1..2 LOOP
  BEGIN
   PERFORM public.publish_league_results_guarded_qa(
    '00000000-0000-0000-0000-000000000071',
    CASE WHEN i=1 THEN 'edit' ELSE 'delete' END,payload);
   RAISE EXCEPTION 'FAIL: old results edit/delete unexpectedly enabled';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
   RAISE NOTICE 'PASS: historical edit/delete fail closed pending Elo replay';
  END;
 END LOOP;
 BEGIN
  PERFORM public.publish_league_results_guarded_qa(
   '00000000-0000-0000-0000-000000000071','upload',
   pg_catalog.jsonb_set(payload,'{1,position}','1'::jsonb));
  RAISE EXCEPTION 'FAIL: duplicate finishing position accepted';
 EXCEPTION WHEN SQLSTATE 'PT422' THEN
  RAISE NOTICE 'PASS: duplicate positions rejected before any write';
 END;
 BEGIN
  PERFORM public.publish_league_results_guarded_qa(
   '00000000-0000-0000-0000-000000000071','upload',
   pg_catalog.jsonb_set(payload,'{1,player_id}',
     '"00000000-0000-0000-0000-000000000051"'::jsonb));
  RAISE EXCEPTION 'FAIL: duplicate player accepted';
 EXCEPTION WHEN SQLSTATE 'PT422' THEN
  RAISE NOTICE 'PASS: duplicate player ID rejected';
 END;

 -- A database error after results INSERT but during Elo-history INSERT must
 -- abort the ENTIRE operation, leaving all five tables unchanged.
END $test$;
RESET ROLE;

CREATE TRIGGER qa_fault_inject_elo
BEFORE INSERT ON public.elo_history FOR EACH ROW
EXECUTE FUNCTION public.qa_inject_elo_failure();

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $test$
DECLARE
 payload jsonb:='[
 {"player_id":"00000000-0000-0000-0000-000000000051","position":1,
  "prize_won":20,"bounties_won":2,"league_points_earned":30,
  "ccp_club":"CCP-P51","buy_ins_count":2},
 {"player_id":"00000000-0000-0000-0000-000000000052","position":2,
  "prize_won":0,"bounties_won":0,"league_points_earned":12,
  "ccp_club":"CCP-P52","buy_ins_count":1}
]'::jsonb;
BEGIN
 BEGIN
  PERFORM public.publish_league_results_guarded_qa(
   '00000000-0000-0000-0000-000000000071','upload',payload);
  RAISE EXCEPTION 'FAIL: Elo failure did not abort transaction';
 EXCEPTION WHEN SQLSTATE 'PT500' THEN
  RAISE NOTICE 'PASS: injected Elo failure aborted the atomic call';
 END;
END $test$;
RESET ROLE;

DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tournament_results
           WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 OR EXISTS(SELECT 1 FROM public.elo_history
           WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 OR EXISTS(SELECT 1 FROM public.tournaments
           WHERE id='00000000-0000-0000-0000-000000000071' AND results_uploaded)
 OR EXISTS(SELECT 1 FROM public.players WHERE total_tournaments<>0)
 OR EXISTS(SELECT 1 FROM public.profiles WHERE unified_elo IS NOT NULL)
 OR EXISTS(SELECT 1 FROM sharkania_release_qa.elo_publication
           WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 OR (SELECT id FROM public.league_standings
   WHERE league_id='00000000-0000-0000-0000-000000000041'
     AND player_id='00000000-0000-0000-0000-000000000051')
   <> '00000000-0000-0000-0000-000000000075'::uuid
 THEN RAISE EXCEPTION 'FAIL: injected Elo exception left partially written data'; END IF;
 RAISE NOTICE 'PASS: result/Elo/player/profile/tournament/standings are unchanged after rollback';
END $test$;

DROP TRIGGER qa_fault_inject_elo ON public.elo_history;
DROP FUNCTION public.qa_inject_elo_failure();

-- Force a second failure at the VERY END: standings update happens only
-- after results, Elo, player totals, profile Elo and tournament status.
CREATE OR REPLACE FUNCTION public.qa_inject_rank_failure()
RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $f$
BEGIN
 IF NEW.player_id='00000000-0000-0000-0000-000000000052' THEN
  RAISE EXCEPTION 'QA injection: final standing row failed' USING ERRCODE='PT501';
 END IF;
 RETURN NEW;
END;
$f$;
CREATE TRIGGER qa_fault_inject_standing
BEFORE INSERT OR UPDATE ON public.league_standings
FOR EACH ROW EXECUTE FUNCTION public.qa_inject_rank_failure();

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $test$
DECLARE payload jsonb:='[
 {"player_id":"00000000-0000-0000-0000-000000000051","position":1,
  "prize_won":20,"bounties_won":2,"league_points_earned":30,
  "ccp_club":"CCP-P51","buy_ins_count":2},
 {"player_id":"00000000-0000-0000-0000-000000000052","position":2,
  "prize_won":0,"bounties_won":0,"league_points_earned":12,
  "ccp_club":"CCP-P52","buy_ins_count":1}
]'::jsonb;
BEGIN
 BEGIN
  PERFORM public.publish_league_results_guarded_qa(
   '00000000-0000-0000-0000-000000000071','upload',payload);
  RAISE EXCEPTION 'FAIL: ranking error did not revert completed writes';
 EXCEPTION WHEN SQLSTATE 'PT501' THEN
  RAISE NOTICE 'PASS: late standings error rolled back entire publication';
 END;
END $test$;
RESET ROLE;

DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tournament_results WHERE tournament_id=
   '00000000-0000-0000-0000-000000000071')
 OR EXISTS(SELECT 1 FROM public.elo_history WHERE tournament_id=
   '00000000-0000-0000-0000-000000000071')
 OR EXISTS(SELECT 1 FROM public.tournaments WHERE id=
   '00000000-0000-0000-0000-000000000071' AND results_uploaded)
 OR EXISTS(SELECT 1 FROM public.players WHERE total_tournaments<>0)
 OR EXISTS(SELECT 1 FROM public.profiles WHERE unified_elo IS NOT NULL)
 OR EXISTS(SELECT 1 FROM sharkania_release_qa.elo_publication
           WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 OR (SELECT id FROM public.league_standings WHERE league_id=
   '00000000-0000-0000-0000-000000000041' AND player_id=
   '00000000-0000-0000-0000-000000000051')
  <> '00000000-0000-0000-0000-000000000075'::uuid
 THEN RAISE EXCEPTION 'FAIL: late standing failure left partial Elo or ranking changes'; END IF;
 RAISE NOTICE 'PASS: complete rollback despite failure in final ranking materialization';
END $test$;
DROP TRIGGER qa_fault_inject_standing ON public.league_standings;
DROP FUNCTION public.qa_inject_rank_failure();

-- Historical exception must be caught BEFORE results write.
INSERT INTO public.league_standings(league_id,player_id,total_points,ccp_club)
VALUES ('00000000-0000-0000-0000-000000000041',
        '00000000-0000-0000-0000-000000000099',90,'CCP-HISTORIC');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $test$
DECLARE payload jsonb:='[
 {"player_id":"00000000-0000-0000-0000-000000000051","position":1,
  "prize_won":20,"bounties_won":2,"league_points_earned":30,
  "ccp_club":"CCP-P51","buy_ins_count":2},
 {"player_id":"00000000-0000-0000-0000-000000000052","position":2,
  "prize_won":0,"bounties_won":0,"league_points_earned":12,
  "ccp_club":"CCP-P52","buy_ins_count":1}
]'::jsonb;
BEGIN
 BEGIN
  PERFORM public.publish_league_results_guarded_qa(
   '00000000-0000-0000-0000-000000000071','upload',payload);
  RAISE EXCEPTION 'FAIL: orphan standings were not protected';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: orphan standings prohibit historical league recalculation';
 END;
END $test$;
RESET ROLE;
DO $test$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.league_standings WHERE player_id=
   '00000000-0000-0000-0000-000000000099' AND total_points=90)
 OR EXISTS(SELECT 1 FROM public.tournament_results WHERE tournament_id=
   '00000000-0000-0000-0000-000000000071')
 THEN RAISE EXCEPTION 'FAIL: orphan changed and/or result inserted despite rejection';END IF;
END $test$;
DELETE FROM public.league_standings WHERE player_id=
 '00000000-0000-0000-0000-000000000099';

-- Authorized initial upload: all writes succeed or none.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $test$
DECLARE
 payload jsonb:='[
 {"player_id":"00000000-0000-0000-0000-000000000051","position":1,
  "prize_won":20,"bounties_won":2,"league_points_earned":30,
  "ccp_club":"CCP-P51","buy_ins_count":2},
 {"player_id":"00000000-0000-0000-0000-000000000052","position":2,
  "prize_won":0,"bounties_won":0,"league_points_earned":12,
  "ccp_club":"CCP-P52","buy_ins_count":1}
]'::jsonb;
 result jsonb;
BEGIN
 result:=public.publish_league_results_guarded_qa(
  '00000000-0000-0000-0000-000000000071','upload',payload);
 IF result->>'status'<>'published' OR (result->>'players')::integer<>2
 THEN RAISE EXCEPTION 'FAIL: authorized writer did not report full publication'; END IF;
 RAISE NOTICE 'PASS: primary organizer atomically published 2 result rows';
 BEGIN
  PERFORM public.publish_league_results_guarded_qa(
   '00000000-0000-0000-0000-000000000071','upload',payload);
  RAISE EXCEPTION 'FAIL: duplicate publication succeeded';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: duplicate initial publication cannot double-count Elo';
 END;
END $test$;
RESET ROLE;

DO $test$
BEGIN
 IF (SELECT count(*) FROM public.tournament_results WHERE tournament_id=
     '00000000-0000-0000-0000-000000000071')<>2
 OR (SELECT count(*) FROM public.elo_history WHERE tournament_id=
     '00000000-0000-0000-0000-000000000071')<>2
 OR (SELECT count(*) FROM public.players WHERE total_tournaments=1)<>2
 OR NOT EXISTS(SELECT 1 FROM public.tournaments WHERE id=
      '00000000-0000-0000-0000-000000000071' AND results_uploaded=true AND status='completed')
 OR (SELECT id FROM public.league_standings WHERE league_id=
      '00000000-0000-0000-0000-000000000041' AND player_id=
      '00000000-0000-0000-0000-000000000051')
    <> '00000000-0000-0000-0000-000000000075'::uuid
 OR NOT EXISTS(SELECT 1 FROM public.league_standings
    WHERE league_id='00000000-0000-0000-0000-000000000041'
      AND player_id='00000000-0000-0000-0000-000000000051'
      AND ccp_club='CCP-LOCKED' AND total_buy_ins_spent=95)
 OR (SELECT count(*) FROM public.profiles u
    JOIN public.players p ON p.profile_id=u.id
    WHERE p.id='00000000-0000-0000-0000-000000000052'
      AND u.unified_elo=p.elo_rating)<>1
 OR NOT EXISTS(SELECT 1 FROM public.players WHERE id=
       '00000000-0000-0000-0000-000000000051' AND elo_rating>1200
       AND total_prize_won=22 AND total_cashes=1 AND total_wins=1)
 OR NOT EXISTS(SELECT 1 FROM public.players WHERE id=
       '00000000-0000-0000-0000-000000000052' AND elo_rating=1177.77
       AND total_cashes=0 AND total_wins=0)
 OR NOT EXISTS(SELECT 1 FROM public.players WHERE id=
       '00000000-0000-0000-0000-000000000051' AND elo_rating=1222.23)
 OR NOT EXISTS(SELECT 1 FROM public.profiles
    WHERE id='00000000-0000-0000-0000-000000000061'
      AND unified_elo=1262.23)
 OR NOT EXISTS(SELECT 1 FROM public.players
    WHERE id='00000000-0000-0000-0000-000000000053'
      AND elo_rating=1240 AND total_tournaments=0)
 OR (SELECT count(*) FROM sharkania_release_qa.elo_publication
    WHERE tournament_id='00000000-0000-0000-0000-000000000071')<>1
 OR (SELECT count(*) FROM sharkania_release_qa.elo_player_checkpoint cp
     JOIN sharkania_release_qa.elo_publication ep ON ep.id=cp.publication_id
     WHERE ep.tournament_id='00000000-0000-0000-0000-000000000071')<>2
 OR NOT EXISTS(SELECT 1 FROM sharkania_release_qa.elo_publication ep
    WHERE ep.tournament_id='00000000-0000-0000-0000-000000000071'
     AND ep.actor_profile_id='00000000-0000-0000-0000-000000000002'
     AND ep.algorithm_version='legacy-js-v1'
     AND ep.input_fingerprint ~ '^[a-f0-9]{64}
 RAISE NOTICE 'PASS: atomic results/Elo/players/unified profiles/standings verified';
END $test$;

-- Entire test is isolated; end without persistence even in this temporary DB.
ROLLBACK;
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tournament_results
    WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 OR EXISTS(SELECT 1 FROM public.elo_history
    WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 OR NOT EXISTS(SELECT 1 FROM public.tournaments
    WHERE id='00000000-0000-0000-0000-000000000071'
      AND results_uploaded=false)
 OR EXISTS(SELECT 1 FROM sharkania_release_qa.elo_publication
    WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 THEN RAISE EXCEPTION 'FAIL: QA transaction changes were not rolled back';END IF;
 RAISE NOTICE 'PASS FINAL: atomic league writer checks fully rolled back';
END $test$;
)
 OR (SELECT count(*) FROM sharkania_release_qa.elo_player_checkpoint cp
     JOIN sharkania_release_qa.elo_publication ep ON ep.id=cp.publication_id
     WHERE ep.tournament_id='00000000-0000-0000-0000-000000000071'
       AND cp.elo_before=1200 AND cp.elo_peak_before=1200
       AND cp.tournaments_before=0
       AND cp.elo_after IN (1222.23,1177.77))<>2
 THEN RAISE EXCEPTION 'FAIL: coordinated Elo/rank/profile/audit invariants broke'; END IF;
 RAISE NOTICE 'PASS: atomic results/Elo/players/unified profiles/standings verified';
END $test$;

-- Entire test is isolated; end without persistence even in this temporary DB.
ROLLBACK;
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tournament_results
    WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 OR EXISTS(SELECT 1 FROM public.elo_history
    WHERE tournament_id='00000000-0000-0000-0000-000000000071')
 OR NOT EXISTS(SELECT 1 FROM public.tournaments
    WHERE id='00000000-0000-0000-0000-000000000071'
      AND results_uploaded=false)
 THEN RAISE EXCEPTION 'FAIL: QA transaction changes were not rolled back';END IF;
 RAISE NOTICE 'PASS FINAL: atomic league writer checks fully rolled back';
END $test$;
