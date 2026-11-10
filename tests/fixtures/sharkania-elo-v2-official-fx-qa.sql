\set ON_ERROR_STOP on
-- Disposable PG17 only. Before any real v2 writer, check rate isolation,
-- immutable receipts, DB-captured timestamps and exact USD normalization.
DO $pre$
BEGIN
 IF to_regclass('sharkania_release.fx_observation_v2') IS NULL
 OR to_regclass('sharkania_release.elo_v2_event_fx') IS NULL
 OR to_regprocedure('sharkania_release.reserve_usd_elo_v2(uuid)') IS NULL
 OR has_function_privilege('authenticated',
 'public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)','EXECUTE')
 OR has_function_privilege('anon',
 'public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: official FX reserve/ACL missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM sharkania_release.elo_v2_activation
  WHERE id=1 AND enabled IS FALSE)
 THEN RAISE EXCEPTION 'FAIL: v2 activation is not OFF by default'; END IF;
 RAISE NOTICE 'PASS: FX ingest service-role only; v2 OFF by default';
END;$pre$;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role='authenticated';
DO $deny$
DECLARE blocked bool:=false;
BEGIN
 BEGIN
  PERFORM public.sharkania_fx_ingest_official_v2(
   'CLP','2026-11-09',990,
   repeat('a',64),'BCCH:F073.TCO.PRE.Z.D:2026-11-09');
 EXCEPTION WHEN SQLSTATE '42501' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: player forged official FX rate'; END IF;
END;$deny$;
RESET ROLE;
ROLLBACK;

BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claim.role='service_role';
DO $service$
DECLARE
 c1 jsonb;c2 jsonb;bad bool:=false;old_seen timestamptz;new_seen timestamptz;
BEGIN
 c1:=public.sharkania_fx_ingest_official_v2('CLP','2026-11-09',990,
  repeat('a',64),'BCCH:F073.TCO.PRE.Z.D:2026-11-09');
 SELECT first_seen_at INTO old_seen FROM sharkania_release.fx_observation_v2
 WHERE currency='CLP' AND effective_date='2026-11-09';
 c2:=public.sharkania_fx_ingest_official_v2('CLP','2026-11-09',990,
  repeat('a',64),'BCCH:F073.TCO.PRE.Z.D:2026-11-09');
 SELECT first_seen_at INTO new_seen FROM sharkania_release.fx_observation_v2
 WHERE currency='CLP' AND effective_date='2026-11-09';
 IF c1->>'status'<>'recorded' OR c2->>'status'<>'recorded'
 OR old_seen IS NULL OR old_seen IS DISTINCT FROM new_seen
 THEN RAISE EXCEPTION 'FAIL: idempotent official FX receipt not retained'; END IF;
 BEGIN
  PERFORM public.sharkania_fx_ingest_official_v2('CLP','2026-11-09',991,
   repeat('b',64),'BCCH:F073.TCO.PRE.Z.D:2026-11-09');
 EXCEPTION WHEN SQLSTATE 'PT409' THEN bad:=true; END;
 IF NOT bad THEN RAISE EXCEPTION 'FAIL: silent exchange-rate revision allowed'; END IF;
 RAISE NOTICE 'PASS: service-role record once, duplicate idempotent, revised quote rejected';
END;$service$;
RESET ROLE;
COMMIT;

-- No retroactive admission: server saw 2026-11-09 observation AFTER
-- a tournament held Nov 9; even an authentic value cannot be backdated.
INSERT INTO public.tournaments(
 id,club_id,buy_in,league_id,room_id,currency,start_datetime,
 timezone
) VALUES
 ('00000000-0000-0000-0000-000000000130',
  '00000000-0000-0000-0000-000000000021',9500,NULL,
  '00000000-0000-0000-0000-000000000031','CLP',
  '2026-11-09T21:00:00Z','America/Santiago'),
 ('00000000-0000-0000-0000-000000000131',
  '00000000-0000-0000-0000-000000000021',9500,NULL,
  '00000000-0000-0000-0000-000000000031','CLP',
  '2026-11-05T21:00:00Z','America/Santiago'),
 ('00000000-0000-0000-0000-000000000132',
  '00000000-0000-0000-0000-000000000021',9.0909090909,NULL,
  '00000000-0000-0000-0000-000000000031','EUR',
  '2026-11-06T21:00:00Z','Europe/Madrid'),
 ('00000000-0000-0000-0000-000000000133',
  '00000000-0000-0000-0000-000000000021',10,NULL,
  '00000000-0000-0000-0000-000000000031','USD',
  '2026-11-07T21:00:00Z','UTC'),
 ('00000000-0000-0000-0000-000000000134',
  '00000000-0000-0000-0000-000000000021',9.09,NULL,
  '00000000-0000-0000-0000-000000000031','EUR',
  '2026-11-04T19:00:00Z','Europe/Madrid');

-- Populate fake, pre-event snapshots in PG17 ONLY. These are synthetic,
-- never passed via service-role API and cannot be inserted in production by
-- browsers. We are explicitly testing against historical first_seen.
INSERT INTO sharkania_release.fx_observation_v2(
 currency,provider,series_key,effective_date,quote,
 raw_observation_sha256,reference_id,first_seen_at
) VALUES
 ('CLP','BCCH','F073.TCO.PRE.Z.D','2026-11-04',950,
  repeat('c',64),'BCCH:F073.TCO.PRE.Z.D:2026-11-04','2026-11-04T11:00:00Z'),
 ('EUR','ECB','EXR/D.USD.EUR.SP00.A','2026-11-05',1.1,
  repeat('d',64),'ECB:EXR.D.USD.EUR.SP00.A:2026-11-05','2026-11-05T16:00:00Z');

UPDATE sharkania_release.elo_v2_activation
SET enabled=true,effective_at='2026-11-01T00:00:00Z' WHERE id=1;

-- Rule: only original verified FX and server-side policy, never injected FX.
BEGIN;
DO $bad$
DECLARE blocked bool:=false;
BEGIN
 BEGIN
  PERFORM sharkania_release.reserve_usd_elo_v2(
   '00000000-0000-0000-0000-000000000134');
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: late FX fetch retroactively used by Elo'; END IF;
END;$bad$;
ROLLBACK;

BEGIN;
DO $rates$
DECLARE a numeric;b numeric;c numeric;
BEGIN
 -- A retroactively ingested 990 CLP/USD must be ignored: Nov 9's
 -- previously observed 950 CLP/USD is the latest valid pre-event quote.
 IF abs(sharkania_release.reserve_usd_elo_v2(
  '00000000-0000-0000-0000-000000000130')-10)>0.00000001 THEN
  RAISE EXCEPTION 'FAIL: late-observed quote selected for pre-event ELO';
 END IF;
  a:=sharkania_release.reserve_usd_elo_v2(
  '00000000-0000-0000-0000-000000000131');
 b:=sharkania_release.reserve_usd_elo_v2(
  '00000000-0000-0000-0000-000000000132');
 c:=sharkania_release.reserve_usd_elo_v2(
  '00000000-0000-0000-0000-000000000133');
 IF abs(a-10)>0.00000001 OR abs(b-10)>0.00000001 OR c<>10
 THEN RAISE EXCEPTION 'FAIL: 9500 CLP, EUR 9.09, USD 10 have different USD equiv % % %',a,b,c; END IF;
 IF (SELECT count(*) FROM sharkania_release.elo_v2_event_fx
  WHERE tournament_id IN(
    '00000000-0000-0000-0000-000000000130',
    '00000000-0000-0000-0000-000000000131',
    '00000000-0000-0000-0000-000000000132',
    '00000000-0000-0000-0000-000000000133'))<>4
 THEN RAISE EXCEPTION 'FAIL: USD snapshots not saved'; END IF;
 RAISE NOTICE 'PASS: same USD equivalent, official quote binding and frozen event snapshots';
END;$rates$;
ROLLBACK;

DO $immutable$
DECLARE blocked bool:=false;
BEGIN
 BEGIN
  UPDATE sharkania_release.fx_observation_v2 SET quote=999
  WHERE currency='CLP' AND effective_date='2026-11-04';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: provider quote changed after capture'; END IF;
END;$immutable$;

DO $v1$
DECLARE denied bool:=false;
BEGIN
 BEGIN
  INSERT INTO sharkania_release.independent_elo_publication(
   tournament_id,actor_profile_id,algorithm_version,input_fingerprint)
  VALUES('00000000-0000-0000-0000-000000000130',
   '00000000-0000-0000-0000-000000000002','legacy-js-v1',repeat('e',64));
 EXCEPTION WHEN SQLSTATE 'PT409' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'FAIL: future v1 writer bypassed v2 policy'; END IF;
 RAISE NOTICE 'PASS FINAL: v1 first upload blocked after v2 activation';
END;$v1$;
