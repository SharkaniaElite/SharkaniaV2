-- SHARKANIA / NON-LEAGUE initial result publication (QA CANDIDATE, 2026-11-10).
-- Depends on the unmerged Release A single SQL (PR #95), never run separately.
-- NO production deployment. USD first publication only. No historical replay.
-- Standalone tournament ELO is SHARED with league ELO: do not alter the formula.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

-- Fail closed if this file is run before the reviewed Release A schema.
DO $standalone_preflight$
BEGIN
 IF to_regnamespace('sharkania_release') IS NULL
 OR to_regclass('sharkania_release.elo_publication') IS NULL
 OR to_regclass('public.players') IS NULL
 OR to_regprocedure('public.publish_league_nickname_results_guarded(uuid,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'Release A guarded base is required' USING ERRCODE='PT409'; END IF;

 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc p
  WHERE p.pronamespace='public'::regnamespace AND
  p.proname='publish_independent_nickname_results_guarded')
 OR to_regclass('sharkania_release.independent_elo_publication') IS NOT NULL
 THEN RAISE EXCEPTION 'Independent writer already installed; reconcile catalog first'
 USING ERRCODE='PT409'; END IF;

 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index i
  JOIN pg_catalog.pg_class ix ON ix.oid=i.indexrelid
  WHERE ix.relname='league_players_normalized_nickname_room_guarded'
  AND i.indrelid='public.players'::regclass AND i.indisunique AND i.indisvalid AND i.indisready)
 THEN RAISE EXCEPTION 'Normalized nickname UNIQUE index required'
 USING ERRCODE='PT409'; END IF;
END;
$standalone_preflight$;

-- Separate audit from league publications because league_id in the approved
-- Release A audit is NOT NULL. Do not relax its constraints or rewrite evidence.
CREATE TABLE sharkania_release.independent_elo_publication(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tournament_id uuid NOT NULL UNIQUE REFERENCES public.tournaments(id),
 actor_profile_id uuid NOT NULL,
 algorithm_version text NOT NULL CHECK(algorithm_version='legacy-js-v1'),
 input_fingerprint text NOT NULL CHECK(input_fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
CREATE TABLE sharkania_release.independent_elo_checkpoint(
 publication_id uuid NOT NULL REFERENCES sharkania_release.independent_elo_publication(id),
 player_id uuid NOT NULL REFERENCES public.players(id),
 elo_before numeric NOT NULL CHECK(elo_before>=100),
 elo_after numeric NOT NULL CHECK(elo_after>=100),
 elo_peak_before numeric NOT NULL CHECK(elo_peak_before>=elo_before),
 tournaments_before integer NOT NULL CHECK(tournaments_before>=0),
 cashes_before integer NOT NULL CHECK(cashes_before>=0),
 wins_before integer NOT NULL CHECK(wins_before>=0),
 prize_won_before numeric NOT NULL CHECK(prize_won_before>=0),
 buy_ins_before numeric NOT NULL CHECK(buy_ins_before>=0),
 elo_change numeric NOT NULL,
 PRIMARY KEY(publication_id,player_id)
);
CREATE TABLE sharkania_release.independent_currency_posting(
 publication_id uuid NOT NULL REFERENCES sharkania_release.independent_elo_publication(id),
 tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
 player_id uuid NOT NULL REFERENCES public.players(id),
 currency text NOT NULL CHECK(currency='USD'),
 buy_in_per_entry numeric NOT NULL CHECK(buy_in_per_entry>=0),
 buy_ins_count integer NOT NULL CHECK(buy_ins_count BETWEEN 1 AND 100),
 entry_spend numeric GENERATED ALWAYS AS (buy_in_per_entry*buy_ins_count) STORED,
 prize_won numeric NOT NULL CHECK(prize_won>=0),
 bounties_won numeric NOT NULL CHECK(bounties_won>=0),
 PRIMARY KEY(tournament_id,player_id)
);
CREATE TRIGGER independent_immutable_publication
 BEFORE UPDATE OR DELETE ON sharkania_release.independent_elo_publication
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();
CREATE TRIGGER independent_immutable_checkpoint
 BEFORE UPDATE OR DELETE ON sharkania_release.independent_elo_checkpoint
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();
CREATE TRIGGER independent_immutable_currency_posting
 BEFORE UPDATE OR DELETE ON sharkania_release.independent_currency_posting
 FOR EACH ROW EXECUTE FUNCTION sharkania_release.reject_publication_mutation();

ALTER TABLE sharkania_release.independent_elo_publication ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release.independent_elo_checkpoint ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release.independent_currency_posting ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sharkania_release.independent_elo_publication,
 sharkania_release.independent_elo_checkpoint,
 sharkania_release.independent_currency_posting FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.publish_independent_nickname_results_guarded(
 p_tournament_id uuid,p_results jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $nonleague$
DECLARE
 v_actor uuid := (SELECT auth.uid());
 v_club uuid;
 v_league uuid;
 v_room uuid;
 v_country text;
 v_buyin numeric;
 v_currency text;
 v_date timestamptz;
 v_uploaded boolean;
 v_status text;
 v_n int;
 v_invalid int;
 v_distinct_nick int;
 v_distinct_pos int;
 v_pos_min int;
 v_pos_max int;
 v_new int;
 v_found int;
 v_invalid_room int;
 v_ids uuid[];
 v_sum numeric;
 v_weight numeric;
 v_calculated jsonb;
 v_fingerprint text;
 v_pub uuid;
 v_count int;
 v_profile_count int;
 v_nickname text;
BEGIN
 IF v_actor IS NULL THEN
  RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_tournament_id IS NULL OR p_results IS NULL
 OR pg_catalog.jsonb_typeof(p_results)<>'array'
 OR pg_catalog.jsonb_array_length(p_results) NOT BETWEEN 2 AND 1000
 THEN RAISE EXCEPTION 'Expected 2 to 1000 results' USING ERRCODE='PT422'; END IF;

 -- Same lock order as Release A: tournament FIRST, players in UUID order.
 SELECT t.club_id,t.league_id,t.room_id,t.buy_in,t.currency,
        t.start_datetime,t.results_uploaded,t.status::text,c.country_code
 INTO v_club,v_league,v_room,v_buyin,v_currency,v_date,
      v_uploaded,v_status,v_country
 FROM public.tournaments t
 LEFT JOIN public.clubs c ON c.id=t.club_id
 WHERE t.id=p_tournament_id FOR UPDATE OF t;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found' USING ERRCODE='PT404'; END IF;
 IF v_league IS NOT NULL THEN
  RAISE EXCEPTION 'League tournaments must use league writer' USING ERRCODE='PT422'; END IF;
 IF NOT ((SELECT public.is_super_admin()) OR (SELECT public.is_club_admin(v_club))) THEN
  RAISE EXCEPTION 'Only organizer or super admin may publish'
    USING ERRCODE='42501'; END IF;
 IF v_currency IS DISTINCT FROM 'USD' THEN
  RAISE EXCEPTION 'Non-USD results require a separately approved currency Elo policy'
    USING ERRCODE='PT409'; END IF;
 IF v_status='cancelled' OR v_uploaded IS TRUE
    OR EXISTS(SELECT 1 FROM public.tournament_results r WHERE r.tournament_id=p_tournament_id)
    OR EXISTS(SELECT 1 FROM public.elo_history h WHERE h.tournament_id=p_tournament_id)
    OR EXISTS(SELECT 1 FROM sharkania_release.independent_elo_publication j
              WHERE j.tournament_id=p_tournament_id)
 THEN
  RAISE EXCEPTION 'Already processed or existing historical results: replay prohibited'
    USING ERRCODE='PT409'; END IF;
 IF v_buyin IS NULL OR v_buyin<0 OR v_buyin>100000000 THEN
  RAISE EXCEPTION 'Unsupported buy-in' USING ERRCODE='PT422'; END IF;

 IF EXISTS(SELECT 1 FROM pg_catalog.jsonb_array_elements(p_results) AS e(value)
  WHERE pg_catalog.jsonb_typeof(e.value)<>'object'
   OR pg_catalog.jsonb_typeof(e.value->'nickname')<>'string'
   OR e.value ? 'player_id'
   OR e.value ? 'profile_id'
   OR e.value ? 'elo_rating'
   OR e.value ? 'elo_before'
   OR e.value ? 'elo_after'
   OR e.value ? 'actor_id'
   OR e.value ? 'currency'
 ) THEN RAISE EXCEPTION 'Untrusted field or missing nickname' USING ERRCODE='PT422'; END IF;
 WITH input AS (
  SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
   AS x(nickname text,position integer,prize_won numeric,bounties_won numeric,
        league_points_earned numeric,ccp_club text,buy_ins_count numeric)
 )
 SELECT count(*)::int,count(DISTINCT pg_catalog.lower(pg_catalog.btrim(nickname)))::int,
   count(DISTINCT position)::int,min(position),max(position),
   count(*) FILTER (WHERE nickname IS NULL
     OR length(pg_catalog.btrim(nickname)) NOT BETWEEN 1 AND 80
     OR position IS NULL OR position<1
     OR prize_won IS NULL OR prize_won<0 OR prize_won>100000000
     OR prize_won::text IN ('NaN','Infinity','-Infinity')
     OR bounties_won IS NULL OR bounties_won<0 OR bounties_won>100000000
     OR bounties_won::text IN ('NaN','Infinity','-Infinity')
     OR buy_ins_count IS NULL OR buy_ins_count NOT BETWEEN 1 AND 100
     OR buy_ins_count<>pg_catalog.trunc(buy_ins_count)
     OR length(coalesce(ccp_club,''))>120
     OR coalesce(league_points_earned,0)<>0
   )::int
 INTO v_n,v_distinct_nick,v_distinct_pos,v_pos_min,v_pos_max,v_invalid
 FROM input;
 IF v_invalid<>0 OR v_n<>v_distinct_nick OR v_n<>v_distinct_pos
 OR v_pos_min<>1 OR v_pos_max<>v_n THEN
  RAISE EXCEPTION 'Invalid nickname/position/prize/entries or league points'
    USING ERRCODE='PT422'; END IF;

 -- Serialize a nickname within its poker room, ensuring case-folded uniqueness.
 FOR v_nickname IN
  SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(x.nickname)) AS normalized
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
  ORDER BY normalized
 LOOP
  PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('league-player:'||v_room::text||':'||v_nickname,0));
 END LOOP;

 INSERT INTO public.players(nickname,room_id,country_code,elo_rating,elo_peak)
 SELECT pg_catalog.btrim(x.nickname),v_room,v_country,1200,1200
 FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
 WHERE NOT EXISTS(
  SELECT 1 FROM public.players p WHERE p.room_id=v_room
    AND pg_catalog.lower(pg_catalog.btrim(p.nickname))=
      pg_catalog.lower(pg_catalog.btrim(x.nickname)))
 ORDER BY pg_catalog.lower(pg_catalog.btrim(x.nickname))
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_new=ROW_COUNT;

 -- We resolve IDs exclusively from database state; clients provide nicknames.
 WITH input AS (
  SELECT x.*,p.id AS player_id,p.room_id
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(
    nickname text,position integer,prize_won numeric,bounties_won numeric,
    buy_ins_count numeric)
  JOIN public.players p ON p.room_id=v_room AND
   pg_catalog.lower(pg_catalog.btrim(p.nickname))=
     pg_catalog.lower(pg_catalog.btrim(x.nickname))
 )
 SELECT count(*)::int,count(*) FILTER(WHERE room_id IS DISTINCT FROM v_room)::int,
        array_agg(player_id ORDER BY player_id)
 INTO v_found,v_invalid_room,v_ids
 FROM input;
 IF v_found<>v_n OR v_invalid_room<>0 OR
  (SELECT count(DISTINCT x) FROM unnest(v_ids) AS x)<>v_n THEN
  RAISE EXCEPTION 'Ambiguous or incomplete room nickname resolution' USING ERRCODE='PT409';
 END IF;

 -- Deterministic lock order for concurrent tournaments with shared players.
 SELECT count(*) INTO v_found FROM (
  SELECT p.id FROM public.players p
  WHERE p.id=ANY(v_ids) ORDER BY p.id FOR UPDATE
 ) locked_players;
 IF v_found<>v_n THEN RAISE EXCEPTION 'Missing locked players' USING ERRCODE='PT409'; END IF;

 -- Forbid retroactive publication if ANY affected player has a later (or
 -- same-time different) result, even if legacy Elo history is missing.
 IF EXISTS(
   SELECT 1 FROM public.tournament_results r
   JOIN public.tournaments t ON t.id=r.tournament_id
   WHERE r.player_id=ANY(v_ids) AND t.id<>p_tournament_id
    AND t.start_datetime>=v_date
 ) THEN RAISE EXCEPTION 'Later or ambiguous-time results exist for a player'
   USING ERRCODE='PT409'; END IF;

 SELECT pg_catalog.sum(p.elo_rating) INTO v_sum
 FROM public.players p WHERE p.id=ANY(v_ids);
 IF v_sum IS NULL OR v_sum<100*v_n OR v_sum>100000000*v_n
 THEN RAISE EXCEPTION 'Player Elo baseline is outside guardrail' USING ERRCODE='PT409'; END IF;
 v_weight:=(v_sum/v_n)/1200;

 -- Exact Release A algorithm legacy-js-v1: same set-snapshot, K, weight,
 -- expected and min-100 clipping. NO new formula or currency conversion.
 WITH entries AS (
  SELECT p.id AS player_id,p.elo_rating AS elo_before,p.total_tournaments,
         x.position,x.prize_won,x.bounties_won,x.buy_ins_count
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(
    nickname text,position integer,prize_won numeric,
    bounties_won numeric,buy_ins_count numeric)
  JOIN public.players p ON p.room_id=v_room AND
    pg_catalog.lower(pg_catalog.btrim(p.nickname))=
    pg_catalog.lower(pg_catalog.btrim(x.nickname))
 ), factors AS (
  SELECT e.*,(v_n-e.position)::numeric/(v_n-1) AS score,
   1/(1+pg_catalog.power(10::numeric,((v_sum-e.elo_before)/(v_n-1)-e.elo_before)/400))
     AS expected,
   (CASE WHEN e.total_tournaments<30 THEN 40 ELSE 20 END)
   *(1+pg_catalog.log(v_buyin+1)*0.1)
   *(1+pg_catalog.log(v_n::numeric)*0.15) AS k
  FROM entries e
 ), computed AS (
  SELECT f.*,f.k*v_weight*(f.score-f.expected) AS raw_change FROM factors f
 )
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'player_id',x.player_id,'position',x.position,
   'prize_won',x.prize_won,'bounties_won',x.bounties_won,
   'buy_ins_count',x.buy_ins_count,
   'elo_before',x.elo_before,
   'elo_after',pg_catalog.round(GREATEST(100::numeric,x.elo_before+x.raw_change),2),
   'elo_change',pg_catalog.round(x.raw_change,2)
 ) ORDER BY x.position),'[]'::jsonb) INTO v_calculated FROM computed x;
 IF pg_catalog.jsonb_array_length(v_calculated)<>v_n
 THEN RAISE EXCEPTION 'Elo computation failed' USING ERRCODE='PT409'; END IF;

 -- Append private immutable audit BEFORE the updates, in the same transaction.
 SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
  pg_catalog.jsonb_build_object('algorithm_version','legacy-js-v1',
   'tournament_id',p_tournament_id,'room_id',v_room,
   'buy_in',v_buyin,'currency',v_currency,'results',p_results)::text,'UTF8')),'hex')
 INTO v_fingerprint;
 INSERT INTO sharkania_release.independent_elo_publication(
   tournament_id,actor_profile_id,algorithm_version,input_fingerprint
 ) VALUES(p_tournament_id,v_actor,'legacy-js-v1',v_fingerprint)
 RETURNING id INTO v_pub;

 INSERT INTO sharkania_release.independent_elo_checkpoint(
  publication_id,player_id,elo_before,elo_after,elo_peak_before,
  tournaments_before,cashes_before,wins_before,prize_won_before,
  buy_ins_before,elo_change
 )
 SELECT v_pub,p.id,p.elo_rating,x.elo_after,p.elo_peak,
  p.total_tournaments,p.total_cashes,p.total_wins,
  p.total_prize_won,p.total_buy_ins_spent,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,elo_after numeric,elo_change numeric)
 JOIN public.players p ON p.id=x.player_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete Elo checkpoints' USING ERRCODE='PT409'; END IF;

 INSERT INTO public.tournament_results(
  tournament_id,player_id,position,prize_won,bounties_won,
  league_points_earned,ccp_club,buy_ins_count,elo_before,elo_after,elo_change
 )
 SELECT p_tournament_id,x.player_id,x.position,x.prize_won,x.bounties_won,
  0,NULL,x.buy_ins_count,x.elo_before,x.elo_after,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,position integer,prize_won numeric,bounties_won numeric,
  buy_ins_count numeric,elo_before numeric,elo_after numeric,elo_change numeric);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete results' USING ERRCODE='PT409'; END IF;

 INSERT INTO public.elo_history(
  tournament_id,player_id,elo_before,elo_after,elo_change
 )
 SELECT p_tournament_id,x.player_id,x.elo_before,x.elo_after,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,elo_before numeric,elo_after numeric,elo_change numeric);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete Elo history' USING ERRCODE='PT409'; END IF;

 -- Currency ledger stores actual #reentries; old player totals must continue
 -- to add buy-in ONCE per tournament, matching the legacy-js-v1 behavior.
 INSERT INTO sharkania_release.independent_currency_posting(
  publication_id,tournament_id,player_id,currency,buy_in_per_entry,
  buy_ins_count,prize_won,bounties_won
 )
 SELECT v_pub,p_tournament_id,x.player_id,v_currency,v_buyin,
  x.buy_ins_count,x.prize_won,x.bounties_won
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,buy_ins_count integer,prize_won numeric,bounties_won numeric);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete currency journal' USING ERRCODE='PT409'; END IF;

 UPDATE public.players p SET elo_rating=x.elo_after,
  elo_peak=GREATEST(p.elo_peak,x.elo_after),
  total_tournaments=p.total_tournaments+1,
  total_cashes=p.total_cashes+
   (CASE WHEN x.prize_won+x.bounties_won>0 THEN 1 ELSE 0 END),
  total_wins=p.total_wins+(CASE WHEN x.position=1 THEN 1 ELSE 0 END),
  total_prize_won=p.total_prize_won+x.prize_won+x.bounties_won,
  total_buy_ins_spent=p.total_buy_ins_spent+v_buyin
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
  player_id uuid,position integer,prize_won numeric,
  bounties_won numeric,elo_after numeric)
 WHERE p.id=x.player_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>v_n THEN RAISE EXCEPTION 'Incomplete player updates' USING ERRCODE='PT409'; END IF;

 -- Profile Elo materialization is server-owned; preserve Release A formula.
 PERFORM u.id FROM public.profiles u
 WHERE u.id IN(
  SELECT DISTINCT p.profile_id FROM public.players p
  WHERE p.id=ANY(v_ids) AND p.profile_id IS NOT NULL
 ) ORDER BY u.id FOR UPDATE;
 WITH affected AS MATERIALIZED (
  SELECT DISTINCT p.profile_id FROM public.players p
  WHERE p.id=ANY(v_ids) AND p.profile_id IS NOT NULL
 ), aliases AS (
  SELECT p.profile_id,count(*)::int AS alias_count,
         max(p.elo_rating) AS single_alias_elo
  FROM public.players p JOIN affected a ON a.profile_id=p.profile_id
  GROUP BY p.profile_id
 ), histories AS (
  SELECT p.profile_id,coalesce(sum(h.elo_change),0) AS total_change,
    (array_agg(h.elo_after ORDER BY h.recorded_at DESC,h.id DESC)
      FILTER (WHERE h.id IS NOT NULL))[1] AS latest_elo
  FROM public.players p JOIN affected a ON a.profile_id=p.profile_id
  LEFT JOIN public.elo_history h ON h.player_id=p.id
  GROUP BY p.profile_id
 ), projected AS (
  SELECT a.profile_id,
   CASE WHEN a.alias_count=1
    THEN coalesce(h.latest_elo,a.single_alias_elo)
    ELSE GREATEST(100::numeric,1200::numeric+h.total_change)
   END AS unified_elo
  FROM aliases a JOIN histories h ON h.profile_id=a.profile_id
 )
 UPDATE public.profiles prof SET unified_elo=x.unified_elo
 FROM projected x WHERE prof.id=x.profile_id
  AND prof.unified_elo IS DISTINCT FROM x.unified_elo;

 UPDATE public.tournaments
  SET results_uploaded=true,status='completed'
 WHERE id=p_tournament_id;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'Tournament completion missing' USING ERRCODE='PT409'; END IF;

 RETURN pg_catalog.jsonb_build_object(
  'status','published','tournament_id',p_tournament_id,
  'currency','USD','players',v_n,'new_players',v_new,
  'currency_postings',v_n,'atomic',true,'audit_recorded',true);
END;
$nonleague$;

-- Avoid default PUBLIC EXECUTE on SECURITY DEFINER. Only authenticated can
-- invoke via PostgREST. Actual authorization is also verified in the body.
REVOKE ALL ON FUNCTION public.publish_independent_nickname_results_guarded(uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_independent_nickname_results_guarded(uuid,jsonb)
 TO authenticated;

DO $post$
BEGIN
 IF pg_catalog.has_function_privilege('anon',
  'public.publish_independent_nickname_results_guarded(uuid,jsonb)','EXECUTE')
 OR NOT pg_catalog.has_function_privilege('authenticated',
  'public.publish_independent_nickname_results_guarded(uuid,jsonb)','EXECUTE')
 OR pg_catalog.has_schema_privilege('authenticated','sharkania_release','USAGE')
 OR pg_catalog.has_table_privilege('authenticated',
  'sharkania_release.independent_elo_publication','SELECT')
 THEN
  RAISE EXCEPTION 'Independent writer exposed unsafe access'
    USING ERRCODE='PT409';
 END IF;
END;
$post$;
COMMIT;
