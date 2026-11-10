-- SHARKANIA ELO v2 / Hourly official FX capture (QA CANDIDATE).
-- NOT A PRODUCTION MIGRATION. NEVER RUN until explicit signed-off GO.
-- This script does NOT create FX secrets, deploy any Edge Functions,
-- enable the v2 scoring switch or edit any historical data.
-- The BCCh personal token stays as BCCH_BDE_API_TOKEN only inside Edge.
--
-- PREREQUISITES (each with explicit owner authorization):
--   1. Transactional SQL release A/v2 installed, activation.enabled=false.
--   2. Disabled ELO FX function deployed and confirmed authenticated using
--      a DEDICATED Supabase secret key named elo-fx-scheduler, not a publishable/anon key.
--   3. Two existing production cron jobs have been identified and preserved.
--   4. Vault stores project URL and dedicated secret key named EXACTLY
--      sharkania_elo_fx_url and sharkania_elo_fx_scheduler_key.
--   5. Poll verified at both BCCh and ECB (no quoted value invented).
--
-- Authorization gate: operator must execute in SAME CONNECTION:
--   SET sharkania.fx_schedule_authorized = 'yes';
-- before psql -f this file, after documented owner approval.
-- The file deliberately fails closed in all other environments.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='30s';

DO $guard$
DECLARE n integer;
BEGIN
 IF current_setting('sharkania.fx_schedule_authorized',true) IS DISTINCT FROM 'yes'
 THEN RAISE EXCEPTION 'Explicit owner FX cron launch authorization missing'
   USING ERRCODE='PT409'; END IF;

 IF to_regclass('sharkania_release.fx_observation_v2') IS NULL OR
    to_regprocedure('public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)') IS NULL OR
    to_regprocedure('public.sharkania_fx_record_feed_check_v2(text)') IS NULL OR
    to_regclass('cron.job') IS NULL OR to_regclass('net.http_request_queue') IS NULL
 THEN RAISE EXCEPTION 'FX v2 backend or required Supabase extensions not installed'
   USING ERRCODE='PT409'; END IF;

 IF (SELECT enabled FROM sharkania_release.elo_v2_activation WHERE id=1)
 THEN RAISE EXCEPTION 'Refuse scheduling once v2 is already active: validate safe rollout order'
   USING ERRCODE='PT409'; END IF;

 SELECT count(*) INTO n FROM vault.secrets
 WHERE name IN ('sharkania_elo_fx_url','sharkania_elo_fx_scheduler_key');
 IF n<>2 THEN RAISE EXCEPTION 'Required named Vault secrets not available'
   USING ERRCODE='PT409'; END IF;
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='sharkania-elo-v2-fx-hourly')
 THEN RAISE EXCEPTION 'Cron already installed; abort instead of replacing it'
   USING ERRCODE='PT409'; END IF;
END;
$guard$;

-- Exactly one BCCh daily series per hour: far below the BCCh 5 series/sec
-- published limit, assuming no other users of the same BDE account conflict.
-- Never embed either secret's VALUE in SQL or cron.job.command.
SELECT cron.schedule(
 'sharkania-elo-v2-fx-hourly',
 '5 * * * *',
 $job$
 SELECT net.http_post(
   url:=(SELECT decrypted_secret
         FROM vault.decrypted_secrets
         WHERE name='sharkania_elo_fx_url')||'/functions/v1/elo-fx-capture',
   headers:=jsonb_build_object(
     'Content-Type','application/json',
     'apikey',(SELECT decrypted_secret
               FROM vault.decrypted_secrets
               WHERE name='sharkania_elo_fx_scheduler_key')
   ),
   body:='{}'::jsonb,
   timeout_milliseconds:=20000
 );
 $job$
);
COMMIT;
