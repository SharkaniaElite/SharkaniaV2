-- SHARKANIA — atomic INITIAL league results upload, QA-only prototype.
-- NOT a Supabase migration; NEVER apply to production.
-- This server-side function operates in ONE PostgREST database transaction:
-- results + Elo history + player stats + unified Elo + league standings.
-- Edit/delete are explicitly rejected pending deterministic Elo history replay.
-- Business restrictions intentionally conservative: existing player ids, USD,
-- no later tournament results, single primary organizer, no orphan standings.
-- Legacy DML/RPC and concurrent writers MUST be removed in coordinated release.
CREATE OR REPLACE FUNCTION public.publish_league_results_guarded_qa(
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
 IF v_currency IS DISTINCT FROM 'USD' THEN
   RAISE EXCEPTION 'Currency conversion rules must be approved before publishing non-USD Elo'
     USING ERRCODE='PT409';
 END IF;

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
       *(1+pg_catalog.log(v_buyin+1)*0.1)
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
     'algorithm_version','legacy-js-v1',
     'tournament_id',p_tournament_id,'league_id',v_league,
     'buy_in',v_buyin,'currency',v_currency,
     'results',v_canonical_payload)::text,'UTF8')),'hex');

 -- Append exactly one publication and one checkpoint per player BEFORE
 -- modifying results/ELO/stats. Later failures roll everything back.
 INSERT INTO sharkania_release_qa.elo_publication(
   tournament_id,league_id,actor_profile_id,algorithm_version,input_fingerprint
 ) VALUES (
   p_tournament_id,v_league,(SELECT auth.uid()),
   'legacy-js-v1',v_input_fingerprint
 ) RETURNING id INTO v_publication_id;

 INSERT INTO sharkania_release_qa.elo_player_checkpoint(
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
   total_prize_won=p.total_prize_won+x.prize_won+x.bounties_won,
   total_buy_ins_spent=p.total_buy_ins_spent+v_buyin
 FROM pg_catalog.jsonb_to_recordset(v_calculated) AS x(
   player_id uuid,position integer,prize_won numeric,
   bounties_won numeric,elo_after numeric
 ) WHERE p.id=x.player_id;

 -- Match existing unified Elo semantics: one alias uses the latest Elo;
 -- multiple aliases use 1200 + the cumulative recorded Elo changes. A
 -- separate historical parity gate remains mandatory before deployment.
 FOR v_profile IN
   SELECT DISTINCT p.profile_id AS id FROM public.players p
   WHERE p.id=ANY(v_player_ids) AND p.profile_id IS NOT NULL
   ORDER BY p.profile_id
 LOOP
   PERFORM u.id FROM public.profiles u WHERE u.id=v_profile.id FOR UPDATE;
   SELECT count(*) INTO v_alias_count
   FROM public.players p WHERE p.profile_id=v_profile.id;
   IF v_alias_count=1 THEN
     SELECT coalesce((
       SELECT eh.elo_after FROM public.elo_history eh
       JOIN public.players p ON p.id=eh.player_id
       WHERE p.profile_id=v_profile.id
       ORDER BY eh.recorded_at DESC,eh.id DESC LIMIT 1
     ),(SELECT p.elo_rating FROM public.players p WHERE p.profile_id=v_profile.id LIMIT 1))
       INTO v_unified;
   ELSE
     SELECT GREATEST(100::numeric,1200+coalesce(sum(eh.elo_change),0))
       INTO v_unified
     FROM public.elo_history eh
     JOIN public.players p ON p.id=eh.player_id
     WHERE p.profile_id=v_profile.id;
   END IF;
   UPDATE public.profiles SET unified_elo=v_unified WHERE id=v_profile.id;
 END LOOP;

 UPDATE public.tournaments SET results_uploaded=true,status='completed'
 WHERE id=p_tournament_id;

 -- This guarded function preserves standings row IDs, locked CCP and other
 -- historical columns; it refuses to run if source-less rows exist.
 v_rank_written:=public.recalculate_league_standings_guarded(v_league);
 v_result:=pg_catalog.jsonb_build_object(
   'status','published','tournament_id',p_tournament_id,
   'league_id',v_league,'players',v_n,
   'standings_updated',v_rank_written,'atomic',true,
   'audit_recorded',true);
 RETURN v_result;
END;
$guarded$;
REVOKE EXECUTE ON FUNCTION public.publish_league_results_guarded_qa(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_league_results_guarded_qa(uuid,text,jsonb)
  TO authenticated;
