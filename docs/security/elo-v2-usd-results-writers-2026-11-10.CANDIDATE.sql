-- SHARKANIA ELO v2 USD-normalized FIRST RESULTS (QA CANDIDATE ONLY)
-- Depends on #95/#96 and elo-v2-usd-fx-observations candidate.
-- Copies vetted initial writers, changes only K buy-in to USD equivalent,
-- immutable version evidence and currency-aware finance. No historical replay.
-- Production remains v1; policy OFF until explicit dated go-live.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

DO $pre$
BEGIN
 IF to_regprocedure('sharkania_release.reserve_usd_elo_v2(uuid)') IS NULL
 OR to_regclass('sharkania_release.elo_v2_event_fx') IS NULL
 OR EXISTS(SELECT 1 FROM sharkania_release.elo_v2_activation WHERE enabled)
 THEN RAISE EXCEPTION 'FX observations not installed or already enabled'
 USING ERRCODE='PT409'; END IF;
END;$pre$;
-- Extend ONLY the #96 review schema CHECKS; old v1 values remain unchanged.
ALTER TABLE sharkania_release.independent_elo_publication
 DROP CONSTRAINT independent_elo_publication_algorithm_version_check;
ALTER TABLE sharkania_release.independent_elo_publication
 ADD CONSTRAINT independent_elo_publication_algorithm_version_check
 CHECK(algorithm_version IN ('legacy-js-v1','elo-v2-usd-normalized'));
ALTER TABLE sharkania_release.independent_currency_posting
 DROP CONSTRAINT independent_currency_posting_currency_check;
ALTER TABLE sharkania_release.independent_currency_posting
 ADD CONSTRAINT independent_currency_posting_currency_check
 CHECK(currency IN ('USD','CLP','EUR'));

-- League v2 internal transactional ELO and client-facing nickname wrapper.
CREATE OR REPLACE FUNCTION sharkania_release.publish_results_initial_v2(
  p_tournament_id uuid,
  p_operation text,
  p_results jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $guarded$
DECLARE
 v_club uuid;
 v_league uuid;
 v_room uuid;
 v_buyin numeric;
 v_buyin_usd numeric;
 v_currency text;
 v_date timestamptz;
 v_uploaded boolean;
 v_status text;
 v_primary uuid;
 v_primary_count integer;
 v_n int;
 v_distinct_players int;
 v_distinct_positions int;
 v_min_pos int;
 v_max_pos int;
 v_invalid int;
 v_players_found int;
 v_invalid_room_count integer;
 v_player_ids uuid[];
 v_sum_elo numeric;
 v_weight numeric;
 v_avg_opp numeric;
 v_score numeric;
 v_expect numeric;
 v_k numeric;
 v_raw_change numeric;
 v_before numeric;
 v_after numeric;
 v_delta numeric;
 v_rank_written integer;
 v_result jsonb;
 v_calculated jsonb := '[]'::jsonb;
 v_canonical_payload jsonb;
 v_input_fingerprint text;
 v_publication_id uuid;
 v_checkpoint_rows integer;
 v_row record;
 v_player record;
 v_profile record;
 v_alias_count int;
 v_unified numeric;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN
   RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
 END IF;
 IF p_tournament_id IS NULL
    OR p_operation NOT IN ('upload','edit','delete') OR p_operation IS NULL THEN
   RAISE EXCEPTION 'Invalid tournament or operation' USING ERRCODE='PT422';
 END IF;

 -- Tournament row first; serialize the link guard and result deletion fence.
 -- All authorized result writers must adopt the SAME lock order at cutover.
 SELECT t.club_id,t.league_id,t.room_id,t.buy_in,t.currency,t.start_datetime,
        t.results_uploaded,t.status::text
  INTO v_club,v_league,v_room,v_buyin,v_currency,v_date,v_uploaded,v_status
 FROM public.tournaments t WHERE t.id=p_tournament_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found' USING ERRCODE='PT404'; END IF;
 IF v_league IS NULL THEN
   RAISE EXCEPTION 'This guarded writer only operates on league tournaments'
     USING ERRCODE='PT422';
 END IF;
 PERFORM 1 FROM public.leagues l WHERE l.id=v_league FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'League not found' USING ERRCODE='PT404'; END IF;
 SELECT count(*)::integer,(array_agg(lc.club_id))[1]
  INTO v_primary_count,v_primary
 FROM public.league_clubs lc
 WHERE lc.league_id=v_league AND lc.is_primary IS TRUE;
 IF v_primary_count<>1 OR v_primary IS DISTINCT FROM v_club THEN
   RAISE EXCEPTION 'League primary organizer is missing or mismatched'
     USING ERRCODE='PT409';
 END IF;
 IF NOT ((SELECT public.is_super_admin()) OR
         (SELECT public.is_club_admin(v_primary))) THEN
   RAISE EXCEPTION 'Only the primary organizer may modify league tournament results'
     USING ERRCODE='42501';
 END IF;

 -- No partial rollback of prior Elo at this stage. The old editor's SQL
 -- reversal is not equivalent to recalculating later Elo in chronological order.
 IF p_operation IN ('edit','delete') THEN
   RAISE EXCEPTION 'Editing/deleting historical league results requires full Elo replay'
     USING ERRCODE='PT409';
 END IF;
 IF v_status='cancelled' OR v_uploaded IS TRUE
    OR EXISTS(SELECT 1 FROM public.tournament_results r
              WHERE r.tournament_id=p_tournament_id)
    OR EXISTS(SELECT 1 FROM public.elo_history h
              WHERE h.tournament_id=p_tournament_id) THEN
   RAISE EXCEPTION 'Tournament already processed, cancelled or contains prior results'
     USING ERRCODE='PT409';
 END IF;
 IF v_currency NOT IN ('USD','CLP','EUR') THEN
   RAISE EXCEPTION 'Unsupported Elo v2 currency' USING ERRCODE='PT422';
 END IF;
 -- Read and freeze the official USD equivalence INSIDE this publication
 -- transaction. The server must have received the observation before start.
 v_buyin_usd:=sharkania_release.reserve_usd_elo_v2(p_tournament_id);

 -- Protect every ranking entry with no result source; the 51 historical
 -- production exceptions are never removed or silently overwritten.
 IF EXISTS(
   SELECT 1 FROM public.league_standings s
   WHERE s.league_id=v_league
     AND NOT EXISTS(
       SELECT 1 FROM public.tournament_results tr
       JOIN public.tournaments t ON t.id=tr.tournament_id
       WHERE t.league_id=v_league AND tr.player_id=s.player_id
     )
 ) THEN
   RAISE EXCEPTION 'Historical orphan standings require reconciliation'
     USING ERRCODE='PT409';
 END IF;

 IF p_results IS NULL OR pg_catalog.jsonb_typeof(p_results)<>'array'
   OR pg_catalog.jsonb_array_length(p_results) NOT BETWEEN 2 AND 1000 THEN
   RAISE EXCEPTION 'Expected 2 to 1000 players in an array'
     USING ERRCODE='PT422';
 END IF;
 WITH payload AS (
   SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
   AS x(player_id uuid,position integer,prize_won numeric,
        bounties_won numeric,league_points_earned numeric,
        ccp_club text,buy_ins_count numeric)
 )
 SELECT count(*)::integer, count(DISTINCT player_id)::integer,
        count(DISTINCT position)::integer,
        min(position),max(position),
        count(*) FILTER (
           WHERE player_id IS NULL OR position IS NULL OR position<1
           OR prize_won IS NULL OR prize_won<0
           OR bounties_won IS NULL OR bounties_won<0
           OR league_points_earned IS NULL OR league_points_earned<0
           OR buy_ins_count IS NULL OR buy_ins_count<1 OR buy_ins_count>100
           OR buy_ins_count<>trunc(buy_ins_count)
           OR length(coalesce(ccp_club,''))>120
        )::integer,
        array_agg(DISTINCT player_id)
 INTO v_n,v_distinct_players,v_distinct_positions,
      v_min_pos,v_max_pos,v_invalid,v_player_ids
 FROM payload;
 IF v_invalid<>0 OR v_n<>v_distinct_players
    OR v_n<>v_distinct_positions OR v_min_pos<>1 OR v_max_pos<>v_n THEN
   RAISE EXCEPTION 'Invalid/duplicate players or noncontiguous finishing positions'
     USING ERRCODE='PT422';
 END IF;

 -- Lock only the affected player rows in deterministic UUID order.
 -- Aggregate validations ONCE instead of iterating N times in PL/pgSQL.
 SELECT count(*)::integer,
        count(*) FILTER (WHERE q.room_id IS DISTINCT FROM v_room)::integer
 INTO v_players_found,v_invalid_room_count
 FROM (
   SELECT p.id,p.room_id FROM public.players p
   WHERE p.id=ANY(v_player_ids) ORDER BY p.id FOR UPDATE
 ) q;
 IF v_invalid_room_count<>0 THEN
   RAISE EXCEPTION 'Player nickname does not belong to tournament room'
     USING ERRCODE='PT422';
 END IF;
 IF v_players_found<>v_n THEN
   RAISE EXCEPTION 'Unknown players: resolve nicknames before publishing'
     USING ERRCODE='PT422';
 END IF;

 -- Existing Elo engine has no deterministic historical replay. Refuse an
 -- out-of-order upload affecting a player with a later completed result,
 -- including those with missing Elo history.
 IF EXISTS(
   SELECT 1 FROM public.tournament_results tr
   JOIN public.tournaments t ON t.id=tr.tournament_id
   WHERE tr.player_id=ANY(v_player_ids)
      AND t.id<>p_tournament_id AND t.start_datetime>v_date
 ) THEN
   RAISE EXCEPTION 'Later tournament results exist for an affected player'
     USING ERRCODE='PT409';
 END IF;

 SELECT sum(p.elo_rating) INTO v_sum_elo
 FROM public.players p WHERE p.id=ANY(v_player_ids);
 v_weight:=(v_sum_elo/v_n)/1200;

 -- Compute all players from ONE locked snapshot, in one set-oriented SELECT.
 -- No per-player SELECT or JSON array concatenation loop (avoids N+1).
 WITH entries AS (
   SELECT p.id AS player_id,p.elo_rating AS elo_before,
          p.total_tournaments,x.position,x.prize_won,x.bounties_won,
          x.league_points_earned,x.ccp_club,x.buy_ins_count
   FROM pg_catalog.jsonb_to_recordset(p_results) AS x(
     player_id uuid,position integer,prize_won numeric,
     bounties_won numeric,league_points_earned numeric,
     ccp_club text,buy_ins_count numeric)
   JOIN public.players p ON p.id=x.player_id
 ), factors AS (
   SELECT e.*,
     (v_n-e.position)::numeric/(v_n-1) AS score,
     1/(1+pg_catalog.power(10::numeric,
       ((v_sum_elo-e.elo_before)/(v_n-1)-e.elo_before)/400)) AS expected,
     (CASE WHEN e.total_tournaments<30 THEN 40 ELSE 20 END)
       *(1+pg_catalog.log(v_buyin_usd+1)*0.1)
       *(1+pg_catalog.log(v_n::numeric)*0.15) AS k
   FROM entries e
 ), changes AS (
   SELECT f.*, f.k*v_weight*(f.score-f.expected) AS raw_change
   FROM factors f
 )
 SELECT COALESCE(pg_catalog.jsonb_agg(
   pg_catalog.jsonb_build_object(
     'player_id',q.player_id,'position',q.position,
     'prize_won',q.prize_won,'bounties_won',q.bounties_won,
     'league_points_earned',q.league_points_earned,
     'ccp_club',q.ccp_club,'buy_ins_count',q.buy_ins_count,
     'elo_before',q.elo_before,
     'elo_after',pg_catalog.round(GREATEST(100::numeric,
       q.elo_before+q.raw_change),2),
     'elo_change',pg_catalog.round(q.raw_change,2)
   ) ORDER BY q.position), '[]'::jsonb)
 INTO v_calculated FROM changes q;
 IF pg_catalog.jsonb_array_length(v_calculated)<>v_n THEN
   RAISE EXCEPTION 'Elo calculation missed a participant' USING ERRCODE='PT409';
 END IF;

 -- SHA-256 computed on the SERVER from typed, position-sorted inputs.
 -- Reordering the request array does not change the fingerprint. Only a
 -- single bounded aggregate is needed, not N individual hashes.
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
    ORDER BY x.position),'[]'::jsonb)
 INTO v_canonical_payload
 FROM pg_catalog.jsonb_to_recordset(p_results) AS x(
   player_id uuid,position integer,prize_won numeric,
   bounties_won numeric,league_points_earned numeric,
   ccp_club text,buy_ins_count numeric);
 v_input_fingerprint:=pg_catalog.encode(pg_catalog.sha256(
   pg_catalog.convert_to(pg_catalog.jsonb_build_object(
     'algorithm_version','elo-v2-usd-normalized',
     'tournament_id',p_tournament_id,'league_id',v_league,
     'buy_in',v_buyin,'currency',v_currency,
     'buy_in_usd',v_buyin_usd,
     'results',v_canonical_payload)::text,'UTF8')),'hex');

 -- Append exactly one publication and one checkpoint per player BEFORE
 -- modifying results/ELO/stats. Later failures roll everything back.
 INSERT INTO sharkania_release.elo_publication(
   tournament_id,league_id,actor_profile_id,algorithm_version,input_fingerprint
 ) VALUES (
   p_tournament_id,v_league,(SELECT auth.uid()),
   'elo-v2-usd-normalized',v_input_fingerprint
 ) RETURNING id INTO v_publication_id;

 INSERT INTO sharkania_release.elo_player_checkpoint(
   publication_id,player_id,elo_before,elo_after,elo_peak_before,
   tournaments_before,cashes_before,wins_before,prize_won_before,
   buy_ins_before,elo_change
 )
 SELECT v_publication_id,p.id,p.elo_rating,x.elo_after,p.elo_peak,
   p.total_tournaments,p.total_cashes,p.total_wins,
   p.total_prize_won,p.total_buy_ins_spent,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,elo_after numeric,elo_change numeric)
 JOIN public.players p ON p.id=x.player_id;
 GET DIAGNOSTICS v_checkpoint_rows = ROW_COUNT;
 IF v_checkpoint_rows<>v_n THEN
   RAISE EXCEPTION 'Incomplete audit checkpoint coverage' USING ERRCODE='PT409';
 END IF;

 INSERT INTO public.tournament_results (
   tournament_id,player_id,position,prize_won,bounties_won,
   league_points_earned,ccp_club,buy_ins_count,
   elo_before,elo_after,elo_change
 )
 SELECT p_tournament_id,x.player_id,x.position,x.prize_won,x.bounties_won,
        x.league_points_earned,x.ccp_club,x.buy_ins_count,
        x.elo_before,x.elo_after,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,position integer,prize_won numeric,
   bounties_won numeric,league_points_earned numeric,
   ccp_club text,buy_ins_count numeric,
   elo_before numeric,elo_after numeric,elo_change numeric
 );

 INSERT INTO public.elo_history(tournament_id,player_id,elo_before,elo_after,elo_change)
 SELECT p_tournament_id,x.player_id,x.elo_before,x.elo_after,x.elo_change
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,elo_before numeric,elo_after numeric,elo_change numeric
 );

 UPDATE public.players p SET
   elo_rating=x.elo_after,
   elo_peak=GREATEST(p.elo_peak,x.elo_after),
   total_tournaments=p.total_tournaments+1,
   total_cashes=p.total_cashes+(CASE WHEN x.prize_won+x.bounties_won>0 THEN 1 ELSE 0 END),
   total_wins=p.total_wins+(CASE WHEN x.position=1 THEN 1 ELSE 0 END),
   -- Legacy monetary totals are NOT allowed to mix CLP/EUR with USD.
   total_prize_won=p.total_prize_won+
     (CASE WHEN v_currency='USD' THEN x.prize_won+x.bounties_won ELSE 0 END),
   total_buy_ins_spent=p.total_buy_ins_spent+
     (CASE WHEN v_currency='USD' THEN v_buyin ELSE 0 END)
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,position integer,prize_won numeric,
   bounties_won numeric,elo_after numeric
 ) WHERE p.id=x.player_id;

 -- Lock only affected profile rows in UUID order, then materialize their
 -- unified Elo using ONE set-based UPDATE. No per-profile SELECT/UPDATE loop.
 -- Semantics match the legacy code: one alias uses latest historical Elo,
 -- multiple aliases use 1200+the sum of Elo history deltas.
 PERFORM u.id FROM public.profiles u
 WHERE u.id IN (
   SELECT DISTINCT p.profile_id FROM public.players p
   WHERE p.id=ANY(v_player_ids) AND p.profile_id IS NOT NULL
 ) ORDER BY u.id FOR UPDATE;
 WITH affected_profiles AS MATERIALIZED (
   SELECT DISTINCT p.profile_id FROM public.players p
   WHERE p.id=ANY(v_player_ids) AND p.profile_id IS NOT NULL
 ), aliases AS (
   SELECT p.profile_id,count(*)::integer AS alias_count,
          max(p.elo_rating) AS single_alias_elo
   FROM public.players p
   JOIN affected_profiles a ON a.profile_id=p.profile_id
   GROUP BY p.profile_id
 ), histories AS (
   SELECT p.profile_id,coalesce(sum(eh.elo_change),0) AS total_change,
     (array_agg(eh.elo_after ORDER BY eh.recorded_at DESC,eh.id DESC)
       FILTER (WHERE eh.id IS NOT NULL))[1] AS latest_elo
   FROM public.players p
   JOIN affected_profiles a ON a.profile_id=p.profile_id
   LEFT JOIN public.elo_history eh ON eh.player_id=p.id
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

 UPDATE public.tournaments SET results_uploaded=true,status='completed'
 WHERE id=p_tournament_id;

 -- This guarded function preserves standings row IDs, locked CCP and other
 -- historical columns; it refuses to run if source-less rows exist.
 v_rank_written:=sharkania_release.recalculate_standings_guarded(v_league);
 v_result:=pg_catalog.jsonb_build_object(
   'status','published','tournament_id',p_tournament_id,
   'league_id',v_league,'players',v_n,
   'standings_updated',v_rank_written,'atomic',true,
   'audit_recorded',true);
 RETURN v_result;
END;
$guarded$;
REVOKE EXECUTE ON FUNCTION sharkania_release.publish_results_initial_v2(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
-- Private server-only: absolutely NO EXECUTE for API roles.


CREATE OR REPLACE FUNCTION public.publish_league_nickname_results_v2_guarded(
  p_tournament_id uuid,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guarded$
DECLARE
  v_club uuid;
  v_league uuid;
  v_room uuid;
  v_currency text;
  v_buyin numeric;
  v_country text;
  v_primary uuid;
  v_primary_count integer;
  v_rows integer;
  v_invalid integer;
  v_distinct_nicks integer;
  v_distinct_positions integer;
  v_min_position integer;
  v_max_position integer;
  v_nick text;
  v_new_players integer;
  v_resolved_count integer;
  v_resolved jsonb;
  v_pub_id uuid;
  v_postings integer;
  v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;

  IF p_tournament_id IS NULL
    OR p_results IS NULL OR pg_catalog.jsonb_typeof(p_results)<>'array'
    OR pg_catalog.jsonb_array_length(p_results) NOT BETWEEN 2 AND 1000
  THEN RAISE EXCEPTION 'Expected 2 to 1000 nickname results'
    USING ERRCODE='PT422'; END IF;

  -- Lock order agrees with the inner guarded writer: tournament then league.
  SELECT t.club_id,t.league_id,t.room_id,t.currency,t.buy_in,
         c.country_code
    INTO v_club,v_league,v_room,v_currency,v_buyin,v_country
  FROM public.tournaments t
  LEFT JOIN public.clubs c ON c.id=t.club_id
  WHERE t.id=p_tournament_id FOR UPDATE OF t;

  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'
    USING ERRCODE='PT404'; END IF;
  IF v_league IS NULL THEN
    RAISE EXCEPTION 'Only league tournaments are supported'
      USING ERRCODE='PT422'; END IF;

  PERFORM 1 FROM public.leagues WHERE id=v_league FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'League not found'
    USING ERRCODE='PT404'; END IF;

  SELECT count(*)::int,(array_agg(lc.club_id))[1]
    INTO v_primary_count,v_primary
  FROM public.league_clubs lc
  WHERE lc.league_id=v_league AND lc.is_primary IS TRUE;
  IF v_primary_count<>1 OR v_primary IS DISTINCT FROM v_club THEN
    RAISE EXCEPTION 'Only the primary organizer tournament may publish'
      USING ERRCODE='42501'; END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(v_primary))) THEN
    RAISE EXCEPTION 'Only the primary organizer may publish'
      USING ERRCODE='42501'; END IF;

  -- Currency is a SERVER-side tournament attribute. Do not accept an
  -- untrusted currency or conversion rate from the CSV.
  -- Multi-currency postings are modeled below, but *publishing* non-USD
  -- remains blocked until currency/Elo semantics are approved and tested.
  IF v_currency NOT IN ('USD','CLP','EUR') THEN
    RAISE EXCEPTION 'Unsupported league currency' USING ERRCODE='PT422'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_results) AS item(value)
    WHERE pg_catalog.jsonb_typeof(item.value)<>'object'
      OR pg_catalog.jsonb_typeof(item.value->'nickname')<>'string'
      OR item.value ? 'player_id'
      OR item.value ? 'fx_rate'
      OR item.value ? 'buy_in_usd'
      OR item.value ? 'currency'
      OR item.value ? 'algorithm_version'
  ) THEN RAISE EXCEPTION 'Expected nickname objects without client player IDs'
    USING ERRCODE='PT422'; END IF;

  WITH input AS (
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
      AS x(nickname text,position integer,prize_won numeric,
           bounties_won numeric,league_points_earned numeric,
           ccp_club text,buy_ins_count numeric)
  )
  SELECT count(*)::int,
         count(DISTINCT pg_catalog.lower(pg_catalog.btrim(nickname)))::int,
         count(DISTINCT position)::int,min(position),max(position),
         count(*) FILTER (
           WHERE nickname IS NULL
              OR length(pg_catalog.btrim(nickname)) NOT BETWEEN 1 AND 80
              OR position IS NULL OR position<=0
              OR prize_won IS NULL OR prize_won<0
              OR bounties_won IS NULL OR bounties_won<0
              OR league_points_earned IS NULL OR league_points_earned<0
              OR buy_ins_count IS NULL OR buy_ins_count NOT BETWEEN 1 AND 100
              OR buy_ins_count<>trunc(buy_ins_count)
              OR length(coalesce(ccp_club,''))>120
         )::int
  INTO v_rows,v_distinct_nicks,v_distinct_positions,
       v_min_position,v_max_position,v_invalid
  FROM input;
  IF v_invalid<>0 OR v_distinct_nicks<>v_rows OR
     v_distinct_positions<>v_rows OR v_min_position<>1 OR
     v_max_position<>v_rows THEN
    RAISE EXCEPTION 'Invalid, duplicate or nonconsecutive nickname results'
      USING ERRCODE='PT422'; END IF;

  -- Contract: this unique expression index is mandatory. A legacy
  -- case-sensitive UNIQUE(nickname,room_id) alone is NOT sufficient.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class ix ON ix.oid=i.indexrelid
    WHERE i.indrelid='public.players'::regclass
      AND ix.relname='league_players_normalized_nickname_room_guarded'
      AND i.indisunique AND i.indisvalid AND i.indisready
  ) THEN
    RAISE EXCEPTION 'Normalized player identity uniqueness is not enforced'
      USING ERRCODE='PT409'; END IF;

  -- Serialise normalized nicknames per room, acquired in stable order to
  -- avoid in-RPC slug/alias races; the unique expression index is final
  -- integrity enforcement. All old direct player writers must be closed
  -- or subject to the same index at production cutover.
  FOR v_nick IN
    SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(x.nickname)) AS normalized
    FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
    ORDER BY normalized
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('league-player:'||v_room::text||':'||v_nick,0)
    );
  END LOOP;

  INSERT INTO public.players(nickname,room_id,country_code,elo_rating,elo_peak)
  SELECT pg_catalog.btrim(x.nickname),v_room,v_country,1200,1200
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.room_id=v_room
      AND pg_catalog.lower(pg_catalog.btrim(p.nickname))=
          pg_catalog.lower(pg_catalog.btrim(x.nickname))
  )
  ORDER BY pg_catalog.lower(pg_catalog.btrim(x.nickname))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new_players = ROW_COUNT;

  -- Construct a trusted, typed payload from the DB player IDs; never
  -- trust an incoming player_id or allow CSV nickname to link a profile.
  WITH input AS (
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
      AS x(nickname text,position integer,prize_won numeric,
           bounties_won numeric,league_points_earned numeric,
           ccp_club text,buy_ins_count numeric)
  ), resolved AS (
    SELECT x.*, p.id AS resolved_id
    FROM input x
    JOIN public.players p ON p.room_id=v_room
      AND pg_catalog.lower(pg_catalog.btrim(p.nickname))=
          pg_catalog.lower(pg_catalog.btrim(x.nickname))
  )
  SELECT count(*)::int,
         pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'player_id',resolved_id,'position',position,
           'prize_won',prize_won,'bounties_won',bounties_won,
           'league_points_earned',league_points_earned,
           'ccp_club',ccp_club,'buy_ins_count',buy_ins_count
         ) ORDER BY position)
    INTO v_resolved_count,v_resolved
  FROM resolved;
  IF v_resolved_count<>v_rows OR
     (SELECT count(DISTINCT x.player_id)
      FROM pg_catalog.jsonb_to_recordset(v_resolved)
        AS x(player_id uuid))<>v_rows THEN
    RAISE EXCEPTION 'Nickname resolution incomplete or ambiguous'
      USING ERRCODE='PT409'; END IF;

  -- The inner writer stores results, Elo, standings and audit in this same
  -- PostgREST transaction. Any error below rolls back new players too.
  v_result := sharkania_release.publish_results_initial_v2(
    p_tournament_id,'upload',v_resolved
  );

  SELECT p.id INTO v_pub_id
  FROM sharkania_release.elo_publication p
  WHERE p.tournament_id=p_tournament_id;
  IF v_pub_id IS NULL THEN
    RAISE EXCEPTION 'Required publication audit missing'
      USING ERRCODE='PT409'; END IF;

  -- Per-player native-currency facts, with true buy-in count.
  -- Never aggregate distinct currencies into players' legacy totals.
  INSERT INTO sharkania_release.currency_posting(
    publication_id,tournament_id,player_id,currency,
    buy_in_per_entry,buy_ins_count,prize_won,bounties_won
  )
  SELECT v_pub_id,p_tournament_id,x.player_id,v_currency,
         v_buyin,x.buy_ins_count::integer,x.prize_won,x.bounties_won
  FROM pg_catalog.jsonb_to_recordset(v_resolved) AS x(
    player_id uuid,buy_ins_count numeric,prize_won numeric,bounties_won numeric
  );
  GET DIAGNOSTICS v_postings = ROW_COUNT;
  IF v_postings<>v_rows THEN
    RAISE EXCEPTION 'Incomplete currency journal coverage'
      USING ERRCODE='PT409'; END IF;

  RETURN v_result || pg_catalog.jsonb_build_object(
    'new_players',v_new_players,'currency',v_currency,
    'currency_postings',v_postings,'normalized_nicknames',true,
    'algorithm_version','elo-v2-usd-normalized',
    'buy_in_usd',(SELECT fx.buy_in_usd FROM sharkania_release.elo_v2_event_fx fx
                  WHERE fx.tournament_id=p_tournament_id)
  );
END;
$guarded$;
REVOKE EXECUTE ON FUNCTION public.publish_league_nickname_results_v2_guarded(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_league_nickname_results_v2_guarded(uuid,jsonb)
  TO authenticated;


-- Independent v2 transactional nickname writer.
CREATE FUNCTION public.publish_independent_nickname_results_v2_guarded(
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
 v_buyin_usd numeric;
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
 IF v_currency NOT IN ('USD','CLP','EUR') THEN
  RAISE EXCEPTION 'Unsupported independent tournament currency'
    USING ERRCODE='PT422'; END IF;
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
 v_buyin_usd:=sharkania_release.reserve_usd_elo_v2(p_tournament_id);

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
   OR e.value ? 'fx_rate'
   OR e.value ? 'buy_in_usd'
   OR e.value ? 'algorithm_version'
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
   *(1+pg_catalog.log(v_buyin_usd+1)*0.1)
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
  pg_catalog.jsonb_build_object('algorithm_version','elo-v2-usd-normalized',
   'tournament_id',p_tournament_id,'room_id',v_room,
   'buy_in',v_buyin,'buy_in_usd',v_buyin_usd,
   'currency',v_currency,'results',p_results)::text,'UTF8')),'hex')
 INTO v_fingerprint;
 INSERT INTO sharkania_release.independent_elo_publication(
   tournament_id,actor_profile_id,algorithm_version,input_fingerprint
 ) VALUES(p_tournament_id,v_actor,'elo-v2-usd-normalized',v_fingerprint)
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
  -- Native-currency prizes go to the per-currency immutable journal.
  total_prize_won=p.total_prize_won+
    (CASE WHEN v_currency='USD' THEN x.prize_won+x.bounties_won ELSE 0 END),
  total_buy_ins_spent=p.total_buy_ins_spent+
    (CASE WHEN v_currency='USD' THEN v_buyin ELSE 0 END)
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
  'currency',v_currency,'buy_in_usd',v_buyin_usd,
  'algorithm_version','elo-v2-usd-normalized','players',v_n,'new_players',v_new,
  'currency_postings',v_n,'atomic',true,'audit_recorded',true);
END;
$nonleague$;

-- Avoid default PUBLIC EXECUTE on SECURITY DEFINER. Only authenticated can
-- invoke via PostgREST. Actual authorization is also verified in the body.
REVOKE ALL ON FUNCTION public.publish_independent_nickname_results_v2_guarded(uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_independent_nickname_results_v2_guarded(uuid,jsonb)
 TO authenticated;



DO $post$
BEGIN
 IF has_function_privilege('anon',
  'public.publish_league_nickname_results_v2_guarded(uuid,jsonb)','EXECUTE')
 OR has_function_privilege('anon',
  'public.publish_independent_nickname_results_v2_guarded(uuid,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
  'public.publish_league_nickname_results_v2_guarded(uuid,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
  'public.publish_independent_nickname_results_v2_guarded(uuid,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated',
  'sharkania_release.publish_results_initial_v2(uuid,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'V2 results API privilege regression' USING ERRCODE='PT409'; END IF;
END;$post$;
COMMIT;
