-- SHARKANIA / ELO V2 OFFICIAL USD NORMALIZATION (QA CANDIDATE ONLY).
-- Install AFTER both Release A #95 and independent #96 candidates.
-- Do NOT run on production. NO scheduled jobs or FX credentials included.
-- OFF BY DEFAULT: config.enabled remains false; no writes to legacy ELO.
-- FX source first_seen_at is minted by PostgreSQL on *actual* server receipt.
-- IMPORTANT: historical provider series dates do NOT prove when originally
-- published. A backfilled rate first seen AFTER tournament start is unusable.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

DO $pre$
BEGIN
 IF to_regnamespace('sharkania_release') IS NULL
 OR to_regclass('sharkania_release.elo_publication') IS NULL
 OR to_regclass('sharkania_release.independent_elo_publication') IS NULL
 OR to_regprocedure('public.publish_league_nickname_results_guarded(uuid,jsonb)') IS NULL
 OR to_regprocedure('public.publish_independent_nickname_results_guarded(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'Release A and independent guarded writers are required'
 USING ERRCODE='PT409'; END IF;
END;$pre$;

-- Deliberately not exposed in PostgREST; no browser can insert quotes.
CREATE TABLE sharkania_release.fx_observation_v2 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 currency text NOT NULL CHECK(currency IN ('CLP','EUR')),
 provider text NOT NULL CHECK(provider IN ('BCCH','ECB')),
 series_key text NOT NULL CHECK(
  (currency='CLP' AND provider='BCCH' AND series_key='F073.TCO.PRE.Z.D')
  OR (currency='EUR' AND provider='ECB' AND series_key='EXR/D.USD.EUR.SP00.A')
 ),
 effective_date date NOT NULL,
 quote numeric(24,10) NOT NULL CHECK(quote>0 AND quote<=100000000),
 -- BCCH: CLP per USD; ECB: USD per EUR, never inverted.
 raw_observation_sha256 text NOT NULL
  CHECK(raw_observation_sha256~'^[a-f0-9]{64}$'),
 reference_id text NOT NULL CHECK(length(btrim(reference_id)) BETWEEN 8 AND 180),
 -- This server-generated timestamp is the only auditable proof of presence.
 first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(currency,effective_date)
);

CREATE TABLE sharkania_release.elo_v2_activation (
 id smallint PRIMARY KEY CHECK(id=1),
 enabled boolean NOT NULL DEFAULT false,
 effective_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO sharkania_release.elo_v2_activation(id,enabled,effective_at)
VALUES(1,false,'2100-01-01T00:00:00Z');

CREATE TABLE sharkania_release.elo_v2_event_fx (
 tournament_id uuid PRIMARY KEY REFERENCES public.tournaments(id),
 algorithm_version text NOT NULL DEFAULT 'elo-v2-usd-normalized'
   CHECK(algorithm_version='elo-v2-usd-normalized'),
 event_started_at timestamptz NOT NULL,
 original_currency text NOT NULL CHECK(original_currency IN ('USD','CLP','EUR')),
 original_buy_in numeric NOT NULL CHECK(original_buy_in>=0),
 rate_observation_id uuid REFERENCES sharkania_release.fx_observation_v2(id),
 quote numeric(24,10) NOT NULL CHECK(quote>0),
 buy_in_usd numeric NOT NULL CHECK(buy_in_usd>=0 AND buy_in_usd<100000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (
  (original_currency='USD' AND quote=1 AND rate_observation_id IS NULL
   AND buy_in_usd=original_buy_in)
  OR (original_currency IN ('CLP','EUR') AND rate_observation_id IS NOT NULL)
 )
);

ALTER TABLE sharkania_release.fx_observation_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release.elo_v2_activation ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release.elo_v2_event_fx ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sharkania_release.fx_observation_v2,
 sharkania_release.elo_v2_activation,
 sharkania_release.elo_v2_event_fx FROM PUBLIC,anon,authenticated;

-- No updates/deletes even by a legacy elevated function; on corrected quote,
-- store a new audit version under a reviewed schema migration, not an UPDATE.
CREATE TRIGGER elo_v2_observation_immutable
 BEFORE UPDATE OR DELETE ON sharkania_release.fx_observation_v2
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();
CREATE TRIGGER elo_v2_event_fx_immutable
 BEFORE UPDATE OR DELETE ON sharkania_release.elo_v2_event_fx
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();

-- Service-role-only endpoint for the already-parsed official data.
-- The Edge Function MUST fetch and validate BCCH/ECB; the API role cannot
-- add a source or edit the first_seen_at receipt timestamp.
CREATE FUNCTION public.sharkania_fx_ingest_official_v2(
 p_currency text,p_effective_date date,p_quote numeric,
 p_raw_sha256 text,p_reference_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $ingest$
DECLARE v_provider text; v_series text; v_id uuid; v_quote numeric;
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role'
 THEN RAISE EXCEPTION 'Only internal service-role ingestion allowed'
 USING ERRCODE='42501'; END IF;
 IF p_currency='CLP' THEN
  v_provider:='BCCH'; v_series:='F073.TCO.PRE.Z.D';
 ELSIF p_currency='EUR' THEN
  v_provider:='ECB'; v_series:='EXR/D.USD.EUR.SP00.A';
 ELSE RAISE EXCEPTION 'No provider for currency'
 USING ERRCODE='PT422'; END IF;
 IF p_quote IS NULL OR p_quote<=0 OR p_quote>100000000
 OR p_raw_sha256 IS NULL OR p_raw_sha256 !~ '^[a-f0-9]{64}$'
 OR p_reference_id IS NULL OR length(btrim(p_reference_id)) NOT BETWEEN 8 AND 180
 OR p_effective_date IS NULL
 OR p_effective_date> ((clock_timestamp() AT TIME ZONE 'UTC')::date + 1)
 OR p_effective_date < '2000-01-01'
 THEN RAISE EXCEPTION 'Invalid or unverified quote metadata'
 USING ERRCODE='PT422'; END IF;

 -- Serialize daily currency inserts to avoid mutable duplicate quoted values.
 INSERT INTO sharkania_release.fx_observation_v2(
  currency,provider,series_key,effective_date,quote,
  raw_observation_sha256,reference_id
 ) VALUES (
  p_currency,v_provider,v_series,p_effective_date,p_quote,
  p_raw_sha256,p_reference_id
 ) ON CONFLICT(currency,effective_date) DO NOTHING
 RETURNING id,quote INTO v_id,v_quote;

 IF v_id IS NULL THEN
  SELECT id,quote INTO v_id,v_quote
  FROM sharkania_release.fx_observation_v2
  WHERE currency=p_currency AND effective_date=p_effective_date;
  IF v_quote IS DISTINCT FROM p_quote
     OR NOT EXISTS (
       SELECT 1 FROM sharkania_release.fx_observation_v2
       WHERE id=v_id AND
         raw_observation_sha256=p_raw_sha256 AND reference_id=p_reference_id
     )
  THEN
   RAISE EXCEPTION 'Existing official observation differs; requires manual review'
    USING ERRCODE='PT409';
  END IF;
 END IF;
 RETURN jsonb_build_object('observation_id',v_id,
  'status','recorded','effective_date',p_effective_date,
  'currency',p_currency);
END;
$ingest$;
REVOKE ALL ON FUNCTION
 public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)
 TO service_role;

-- PRIVATE function called ONLY from authenticated, authorized v2 publication.
-- No browser-supplied rate/amount and no lookup based on upload time.
CREATE FUNCTION sharkania_release.reserve_usd_elo_v2(p_tournament_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $reserve$
DECLARE
 v_start timestamptz;
 v_timezone text;
 v_date date;
 v_currency text;
 v_buyin numeric;
 v_fx record;
 v_buyin_usd numeric;
 v_enabled boolean;
 v_effective timestamptz;
BEGIN
 SELECT enabled,effective_at INTO v_enabled,v_effective
 FROM sharkania_release.elo_v2_activation
 WHERE id=1 FOR SHARE;
 IF NOT FOUND OR v_enabled IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ELO v2 still disabled' USING ERRCODE='PT409'; END IF;

 SELECT t.start_datetime,t.timezone,t.currency,t.buy_in
 INTO v_start,v_timezone,v_currency,v_buyin
 FROM public.tournaments t WHERE t.id=p_tournament_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tournament missing' USING ERRCODE='PT404'; END IF;
 IF v_start IS NULL OR v_start<v_effective THEN
  RAISE EXCEPTION 'Historical tournament is v1; replay policy required'
  USING ERRCODE='PT409'; END IF;
 IF v_start>clock_timestamp() THEN
  RAISE EXCEPTION 'Cannot publish a future tournament'
  USING ERRCODE='PT409'; END IF;
 IF v_buyin IS NULL OR v_buyin<0 OR v_buyin>100000000
  OR v_currency NOT IN ('CLP','EUR','USD') THEN
  RAISE EXCEPTION 'Invalid buy-in currency or amount' USING ERRCODE='PT422'; END IF;
 v_date:=(v_start AT TIME ZONE coalesce(nullif(v_timezone,''),'UTC'))::date;
 IF v_currency='USD' THEN
  v_buyin_usd:=v_buyin;
  INSERT INTO sharkania_release.elo_v2_event_fx(
   tournament_id,event_started_at,original_currency,original_buy_in,
   rate_observation_id,quote,buy_in_usd
  ) VALUES(p_tournament_id,v_start,'USD',v_buyin,NULL,1,v_buyin_usd);
 ELSE
  SELECT fx.* INTO v_fx
  FROM sharkania_release.fx_observation_v2 fx
  WHERE fx.currency=v_currency
   AND fx.effective_date<=v_date
   AND (v_date-fx.effective_date) BETWEEN 0 AND 7
   AND fx.first_seen_at<=v_start
  ORDER BY fx.effective_date DESC,fx.first_seen_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No official FX rate captured before tournament start'
    USING ERRCODE='PT409'; END IF;
  IF v_currency='CLP' THEN
   v_buyin_usd:=v_buyin/v_fx.quote;
  ELSE
   v_buyin_usd:=v_buyin*v_fx.quote;
  END IF;
  IF v_buyin_usd>100000000 THEN
    RAISE EXCEPTION 'Normalized buy-in exceeds safe maximum'
    USING ERRCODE='PT422'; END IF;
  INSERT INTO sharkania_release.elo_v2_event_fx(
   tournament_id,event_started_at,original_currency,original_buy_in,
   rate_observation_id,quote,buy_in_usd
  ) VALUES(p_tournament_id,v_start,v_currency,v_buyin,v_fx.id,v_fx.quote,v_buyin_usd);
 END IF;
 RETURN v_buyin_usd;
END;
$reserve$;
REVOKE ALL ON FUNCTION sharkania_release.reserve_usd_elo_v2(uuid)
 FROM PUBLIC,anon,authenticated;

-- AFTER the v2 switch, v1 writers must not bypass normalization by
-- uploading USD-only results with the old RPC. The untouched historic
-- rows in production are never updated; this only checks NEW publications.
CREATE FUNCTION sharkania_release.guard_new_legacy_v1_after_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guard$
BEGIN
 IF (SELECT enabled FROM sharkania_release.elo_v2_activation WHERE id=1)
 AND NEW.algorithm_version IS DISTINCT FROM 'elo-v2-usd-normalized' THEN
   RAISE EXCEPTION 'ELO v1 first publication disabled after v2 cutover'
   USING ERRCODE='PT409';
 END IF;
 RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION sharkania_release.guard_new_legacy_v1_after_activation()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER block_new_league_v1_after_cutover
 BEFORE INSERT ON sharkania_release.elo_publication
 FOR EACH ROW EXECUTE FUNCTION
 sharkania_release.guard_new_legacy_v1_after_activation();
CREATE TRIGGER block_new_independent_v1_after_cutover
 BEFORE INSERT ON sharkania_release.independent_elo_publication
 FOR EACH ROW EXECUTE FUNCTION
 sharkania_release.guard_new_legacy_v1_after_activation();

-- The v2 version will be generated in a separate QA file; do NOT enable
-- activation or call reserve() without the full new writers deployed.
DO $check$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM sharkania_release.elo_v2_activation
   WHERE id=1 AND enabled IS FALSE)
 OR has_function_privilege('authenticated',
  'public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)',
  'EXECUTE')
 OR has_function_privilege('anon',
  'public.sharkania_fx_ingest_official_v2(text,date,numeric,text,text)',
  'EXECUTE')
 OR has_schema_privilege('authenticated','sharkania_release','USAGE')
 THEN RAISE EXCEPTION 'ELO v2 snapshot installation unsafe'
 USING ERRCODE='PT409'; END IF;
END;
$check$;
COMMIT;
