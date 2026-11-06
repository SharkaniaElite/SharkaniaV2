\set ON_ERROR_STOP on
-- SHARKANIA bounded volume smoke test: isolated PostgreSQL only, all fake data.
-- Measures one 200-player upload under the NEW set-based audit/ELO writer.
-- This does NOT benchmark Supabase production Micro or establish p95 latency.
BEGIN;
INSERT INTO public.profiles(id,role)
SELECT md5('qa-volume-profile-'||g::text)::uuid,'player'
FROM generate_series(1,200) g;
INSERT INTO public.players(id,profile_id,room_id)
SELECT md5('qa-volume-player-'||g::text)::uuid,
       md5('qa-volume-profile-'||g::text)::uuid,
       '00000000-0000-0000-0000-000000000031'::uuid
FROM generate_series(1,200) g;
INSERT INTO public.tournaments(
 id,club_id,buy_in,league_id,room_id,currency,start_datetime
) VALUES (
 '00000000-0000-0000-0000-000000000073',
 '00000000-0000-0000-0000-000000000021',
 3.30,'00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000031','USD','2026-11-20T20:00:00Z'
);
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
DO $qa$
DECLARE
  payload jsonb;
  output jsonb;
  started_at timestamptz;
  elapsed_ms numeric;
BEGIN
 SELECT jsonb_agg(jsonb_build_object(
   'player_id',md5('qa-volume-player-'||g::text)::uuid,
   'position',g,
   'prize_won',CASE WHEN g=1 THEN 50 ELSE 0 END,
   'bounties_won',0,'league_points_earned',CASE WHEN g<=9 THEN 10 ELSE 2 END,
   'ccp_club',NULL,'buy_ins_count',1
 ) ORDER BY g)
 INTO payload FROM generate_series(1,200) g;
 started_at:=pg_catalog.clock_timestamp();
 output:=public.publish_league_results_guarded_qa(
  '00000000-0000-0000-0000-000000000073','upload',payload);
 elapsed_ms:=extract(epoch FROM (pg_catalog.clock_timestamp()-started_at))*1000;
 IF output->>'status'<>'published' OR (output->>'players')::int<>200
    OR output->>'audit_recorded'<>'true' THEN
   RAISE EXCEPTION 'FAIL: volume publication incomplete';
 END IF;
 RAISE NOTICE 'QA only: 200 synthetic participants, first publication time % ms',
   pg_catalog.round(elapsed_ms,2);
END $qa$;
RESET ROLE;
DO $qa$
DECLARE
  pub_id uuid;
BEGIN
 SELECT id INTO pub_id FROM sharkania_release_qa.elo_publication WHERE
 tournament_id='00000000-0000-0000-0000-000000000073';
 IF pub_id IS NULL
 OR (SELECT count(*) FROM sharkania_release_qa.elo_player_checkpoint
     WHERE publication_id=pub_id)<>200
 OR (SELECT count(*) FROM public.tournament_results WHERE
     tournament_id='00000000-0000-0000-0000-000000000073')<>200
 OR (SELECT count(*) FROM public.elo_history WHERE
     tournament_id='00000000-0000-0000-0000-000000000073')<>200
 OR (SELECT count(*) FROM public.profiles WHERE id::text IN (
     SELECT md5('qa-volume-profile-'||g::text)::uuid::text
     FROM generate_series(1,200) g)
     AND unified_elo IS NOT NULL)<>200
 OR (SELECT count(*) FROM public.league_standings WHERE league_id=
     '00000000-0000-0000-0000-000000000041'
     AND player_id IN (SELECT md5('qa-volume-player-'||g::text)::uuid
       FROM generate_series(1,200) g))<>200
 THEN RAISE EXCEPTION 'FAIL: 200-player audit/results/ELO/standings out of sync'; END IF;
 RAISE NOTICE 'PASS: 200-player first publication has N audit checkpoints and consistent stats';
END $qa$;
ROLLBACK;
DO $qa$
BEGIN
 IF EXISTS(SELECT 1 FROM public.tournament_results WHERE
     tournament_id='00000000-0000-0000-0000-000000000073')
 OR EXISTS(SELECT 1 FROM sharkania_release_qa.elo_publication WHERE
     tournament_id='00000000-0000-0000-0000-000000000073')
 OR EXISTS(SELECT 1 FROM public.players WHERE
     id=md5('qa-volume-player-1')::uuid)
 THEN RAISE EXCEPTION 'FAIL: volume test was not rolled back'; END IF;
 RAISE NOTICE 'PASS FINAL: volume QA produced no durable synthetic changes';
END $qa$;
