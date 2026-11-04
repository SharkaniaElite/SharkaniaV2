-- SHARKANIA / proposal — protected initial publication and final-tournament re-publication.
-- NOT A MIGRATION. DO NOT APPLY TO PRODUCTION OR ENABLE FEATURE FLAGS.
-- Integration candidate, adapted from isolated QA PASS scripts dated 2026-11-04.
-- This generalized version has NOT YET PASSED PostgreSQL execution or end-to-end QA.
--
-- Dependencies that MUST be installed and tested together:
--   public.calculate_tournament_elo_guarded(uuid)
--   public.ensure_tournament_player_guarded(uuid,text,text)
--   public.recalculate_league_standings(uuid) (legacy math, internal use only)
-- Following coordinated cutover, direct client DML on players calculated columns,
-- tournament_results, elo_history, league_standings and league_clubs and EXECUTE on
-- reset_tournament_impact/recalculate_league_standings must be restricted.
--
-- HTTP business errors: PT409 state/chronology conflict, PT422 currency unsupported.
-- PostgREST maps 55000 to HTTP 500 and must not be used for business denials.
-- Conservative release-1 rules:
-- * USD tournaments only (CLP Elo formula / historical accounting unapproved).
-- * Publish initial results or replace ONLY the last processed tournament
--   for every affected player. No chronological replay of middle tournaments.
-- * Never accept computed ELO, extra JSON keys or client-specified club/room.
-- * Automatic standings recalc on an authorized club's own tournament may
--   update its shared league, but only an organizer controls manual league edits.
-- * One invocation = one Postgres transaction; error aborts ALL changes.
-- * Repeated identical requests are idempotent in aggregates, NOT in row IDs;
--   request-key/revision handling requires a future audited schema migration.

CREATE OR REPLACE FUNCTION public.publish_tournament_results_guarded(
  p_tournament_id uuid,
  p_results jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $publish$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_t record;
  v_item jsonb;
  v_payload jsonb := '[]'::jsonb;
  v_id uuid;
  v_old_ids uuid[];
  v_new_ids uuid[];
  v_affected uuid[];
  v_n integer;
  v_old_n integer;
  v_old_hist integer;
  v_distinct integer;
  v_stats record;
  v_player_id uuid;
  v_last_rating numeric;
  v_peak numeric;
  v_elo jsonb;
  v_results integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;

  -- A per-tournament row lock serializes duplicate requests before reading state.
  SELECT t.id,t.club_id,t.league_id,t.room_id,t.currency,
         t.buy_in,t.start_datetime,t.status,t.results_uploaded
    INTO v_t
  FROM public.tournaments t
  WHERE t.id=p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE='P0002';
  END IF;
  IF NOT ((SELECT public.is_super_admin())
          OR (SELECT public.is_club_admin(v_t.club_id))) THEN
    RAISE EXCEPTION 'Club admin required' USING ERRCODE='42501';
  END IF;
  IF v_t.status::text='cancelled' OR v_t.start_datetime IS NULL THEN
    RAISE EXCEPTION 'Cancelled/undated tournament is not publishable' USING ERRCODE='PT409';
  END IF;
  IF v_t.currency IS DISTINCT FROM 'USD' OR v_t.buy_in<0 THEN
    RAISE EXCEPTION 'Only valid USD tournaments supported in this cutover' USING ERRCODE='PT422';
  END IF;

  -- Lock the league for the entire rebuild. This also serializes different
  -- tournaments publishing into the same league.
  IF v_t.league_id IS NOT NULL THEN
    PERFORM l.id FROM public.leagues l WHERE l.id=v_t.league_id FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (
      SELECT 1 FROM public.league_clubs lc
      WHERE lc.league_id=v_t.league_id AND lc.club_id=v_t.club_id
    ) THEN
      RAISE EXCEPTION 'Tournament club is not a league participant'
        USING ERRCODE='42501';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.league_id=v_t.league_id
        AND t.results_uploaded=true AND t.id<>p_tournament_id
        AND t.currency IS DISTINCT FROM 'USD'
    ) THEN
      RAISE EXCEPTION 'Mixed league currencies require a separate model'
        USING ERRCODE='PT422';
    END IF;
  END IF;

  IF p_results IS NULL OR pg_catalog.jsonb_typeof(p_results)<>'array'
     OR pg_catalog.jsonb_array_length(p_results) NOT BETWEEN 2 AND 1000 THEN
    RAISE EXCEPTION 'Expected 2 to 1000 results' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_results) AS x(item)
    WHERE pg_catalog.jsonb_typeof(x.item)<>'object'
  ) THEN
    RAISE EXCEPTION 'Every result must be an object' USING ERRCODE='22023';
  END IF;
  -- Reject fractional or malformed integers before typed JSON casts.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_results) AS x(item)
    WHERE x.item->>'position' !~ '^[1-9][0-9]*$'
       OR x.item->>'buy_ins_count' !~ '^[1-9][0-9]*$'
       OR x.item->>'position' IS NULL
       OR x.item->>'buy_ins_count' IS NULL
  ) THEN
    RAISE EXCEPTION 'Positions and entries must be positive integer values'
      USING ERRCODE='22023';
  END IF;
  -- Strict whitelist; a client cannot smuggle ELO or other calculated data.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_results) AS x(item)
    CROSS JOIN LATERAL pg_catalog.jsonb_object_keys(x.item) AS k(key_name)
    WHERE k.key_name NOT IN (
      'player_id','nickname','country_code','position',
      'prize_won','bounties_won','league_points_earned',
      'ccp_club','buy_ins_count'
    )
  ) THEN
    RAISE EXCEPTION 'Unexpected result field' USING ERRCODE='22023';
  END IF;

  v_n:=pg_catalog.jsonb_array_length(p_results);
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_to_recordset(p_results) AS r(
      player_id uuid,nickname text,country_code text,position integer,
      prize_won numeric,bounties_won numeric,league_points_earned numeric,
      ccp_club text,buy_ins_count numeric
    )
    WHERE r.nickname IS NULL OR pg_catalog.length(pg_catalog.btrim(r.nickname)) NOT BETWEEN 2 AND 80
      OR r.position IS NULL OR r.position NOT BETWEEN 1 AND v_n
      OR r.prize_won IS NULL OR r.prize_won<0 OR r.prize_won>99999999.99
      OR r.prize_won<>pg_catalog.round(r.prize_won,2)
      OR r.bounties_won IS NULL OR r.bounties_won<0 OR r.bounties_won>99999999.99
      OR r.bounties_won<>pg_catalog.round(r.bounties_won,2)
      OR r.league_points_earned IS NULL OR r.league_points_earned<0
      OR r.league_points_earned>99999999.99
      OR r.league_points_earned<>pg_catalog.round(r.league_points_earned,2)
      OR r.buy_ins_count IS NULL OR r.buy_ins_count<1
      OR r.buy_ins_count<>pg_catalog.trunc(r.buy_ins_count)
      OR (r.country_code IS NOT NULL AND r.country_code<>''
          AND r.country_code !~ '^[A-Z]{2}$')
      OR (r.ccp_club IS NOT NULL AND pg_catalog.length(r.ccp_club)>80)
  ) THEN
    RAISE EXCEPTION 'Invalid positions, nicknames, amounts, countries or entries'
      USING ERRCODE='22023';
  END IF;

  SELECT count(DISTINCT r.position),count(DISTINCT pg_catalog.lower(pg_catalog.btrim(r.nickname)))
    INTO v_distinct,v_results
  FROM pg_catalog.jsonb_to_recordset(p_results) AS r(
    position integer,nickname text);
  IF v_distinct<>v_n OR v_results<>v_n THEN
    RAISE EXCEPTION 'Duplicate position or nickname' USING ERRCODE='22023';
  END IF;

  SELECT pg_catalog.array_agg(DISTINCT tr.player_id),count(*)::integer
    INTO v_old_ids,v_old_n
  FROM public.tournament_results tr WHERE tr.tournament_id=p_tournament_id;
  SELECT count(*)::integer INTO v_old_hist
  FROM public.elo_history h WHERE h.tournament_id=p_tournament_id;

  IF v_t.results_uploaded=true THEN
    IF v_t.status::text<>'completed' OR v_old_n<2 OR v_old_hist<>v_old_n
       OR pg_catalog.cardinality(v_old_ids)<>v_old_n OR EXISTS (
         SELECT 1 FROM public.tournament_results tr
         WHERE tr.tournament_id=p_tournament_id
           AND NOT EXISTS (
             SELECT 1 FROM public.elo_history h
             WHERE h.tournament_id=tr.tournament_id AND h.player_id=tr.player_id
           )
       ) THEN
      RAISE EXCEPTION 'Pre-existing tournament requires reconciliation'
        USING ERRCODE='PT409';
    END IF;
  ELSIF v_old_n<>0 OR v_old_hist<>0 THEN
    RAISE EXCEPTION 'Partial legacy tournament requires reconciliation'
      USING ERRCODE='PT409';
  END IF;

  -- Resolve all nicknames inside THIS transaction, in deterministic order.
  -- For existing ids, enforce both room ownership and matching nickname.
  FOR v_item IN
    SELECT x.item FROM pg_catalog.jsonb_array_elements(p_results) AS x(item)
    ORDER BY pg_catalog.lower(x.item->>'nickname'), (x.item->>'position')::integer
  LOOP
    v_id:=NULLIF(v_item->>'player_id','')::uuid;
    IF v_id IS NULL THEN
      v_id:=public.ensure_tournament_player_guarded(
        p_tournament_id,v_item->>'nickname',NULLIF(v_item->>'country_code','')
      );
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id=v_id AND p.room_id=v_t.room_id
        AND pg_catalog.lower(p.nickname)=pg_catalog.lower(pg_catalog.btrim(v_item->>'nickname'))
    ) THEN
      RAISE EXCEPTION 'Player does not match this room/nickname'
        USING ERRCODE='42501';
    END IF;

    v_payload:=v_payload || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_set(v_item,'{player_id}',pg_catalog.to_jsonb(v_id))
    );
  END LOOP;

  SELECT pg_catalog.array_agg(DISTINCT r.player_id),count(DISTINCT r.player_id)::integer
    INTO v_new_ids,v_distinct
  FROM pg_catalog.jsonb_to_recordset(v_payload) AS r(player_id uuid);
  IF v_distinct<>v_n THEN
    RAISE EXCEPTION 'Duplicate resolved players' USING ERRCODE='22023';
  END IF;

  SELECT pg_catalog.array_agg(DISTINCT v.id)
    INTO v_affected
  FROM pg_catalog.unnest(
    coalesce(v_old_ids,ARRAY[]::uuid[]) ||
    coalesce(v_new_ids,ARRAY[]::uuid[])
  ) v(id);
  -- All other guarded paths must use the same ordering of player locks.
  PERFORM p.id FROM public.players p WHERE p.id=ANY(v_affected)
  ORDER BY p.id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.tournament_results tr
    JOIN public.tournaments t ON t.id=tr.tournament_id
    WHERE tr.player_id=ANY(v_affected) AND tr.tournament_id<>p_tournament_id
      AND t.start_datetime>=v_t.start_datetime
  ) OR EXISTS (
    SELECT 1 FROM public.elo_history h
    JOIN public.tournaments t ON t.id=h.tournament_id
    WHERE h.player_id=ANY(v_affected) AND h.tournament_id<>p_tournament_id
      AND t.start_datetime>=v_t.start_datetime
  ) THEN
    RAISE EXCEPTION 'Later/same-date player history: chronological replay required'
      USING ERRCODE='PT409';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tournament_results tr
    JOIN public.tournaments t ON t.id=tr.tournament_id
    WHERE tr.player_id=ANY(v_affected) AND t.status::text='completed'
      AND t.currency IS DISTINCT FROM 'USD'
  ) THEN
    RAISE EXCEPTION 'Player has financial history in mixed currencies'
      USING ERRCODE='PT422';
  END IF;
  -- Fail closed if current ELO has already diverged from persisted history.
  IF EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id=ANY(v_affected)
      AND p.elo_rating IS DISTINCT FROM coalesce(
        (SELECT h.elo_after
         FROM public.elo_history h JOIN public.tournaments t ON t.id=h.tournament_id
         WHERE h.player_id=p.id
         ORDER BY t.start_datetime DESC,h.recorded_at DESC,h.id DESC LIMIT 1),
        1200::numeric
      )
  ) THEN
    RAISE EXCEPTION 'Player ELO diverges from historical record; reconcile first'
      USING ERRCODE='PT409';
  END IF;

  IF v_t.results_uploaded=true THEN
    DELETE FROM public.elo_history WHERE tournament_id=p_tournament_id;
    DELETE FROM public.tournament_results WHERE tournament_id=p_tournament_id;
    UPDATE public.tournaments SET results_uploaded=false,status='scheduled'
      WHERE id=p_tournament_id;
    -- Restore historical totals from remaining completed events (no UUID ordering).
    FOREACH v_player_id IN ARRAY v_old_ids LOOP
      SELECT count(*)::integer AS played,
        count(*) FILTER (WHERE tr.prize_won>0)::integer AS cashes,
        count(*) FILTER (WHERE tr.position=1)::integer AS wins,
        coalesce(sum(tr.prize_won+tr.bounties_won),0) AS prize,
        coalesce(sum(t.buy_in*tr.buy_ins_count),0) AS buyins
      INTO v_stats
      FROM public.tournament_results tr JOIN public.tournaments t
        ON t.id=tr.tournament_id
      WHERE tr.player_id=v_player_id AND t.status::text='completed';

      SELECT coalesce(
         (pg_catalog.array_agg(h.elo_after ORDER BY t.start_datetime DESC,
                              h.recorded_at DESC,h.id DESC))[1],1200),
         greatest(1200,coalesce(max(h.elo_after),1200))
        INTO v_last_rating,v_peak
      FROM public.elo_history h JOIN public.tournaments t ON t.id=h.tournament_id
      WHERE h.player_id=v_player_id;
      UPDATE public.players p SET
        total_tournaments=v_stats.played,total_cashes=v_stats.cashes,
        total_wins=v_stats.wins,total_prize_won=v_stats.prize,
        total_buy_ins_spent=v_stats.buyins,
        elo_rating=v_last_rating,elo_peak=v_peak
      WHERE p.id=v_player_id;
    END LOOP;
    UPDATE public.profiles prof SET unified_elo=public.get_unified_elo(prof.id)
    WHERE prof.id IN (
      SELECT DISTINCT p.profile_id FROM public.players p
      WHERE p.id=ANY(v_old_ids) AND p.profile_id IS NOT NULL
    );
  END IF;

  INSERT INTO public.tournament_results
    (tournament_id,player_id,position,prize_won,bounties_won,
     league_points_earned,ccp_club,buy_ins_count)
  SELECT p_tournament_id,r.player_id,r.position,r.prize_won,r.bounties_won,
         r.league_points_earned,r.ccp_club,r.buy_ins_count
  FROM pg_catalog.jsonb_to_recordset(v_payload) AS r(
    player_id uuid,position integer,prize_won numeric,bounties_won numeric,
    league_points_earned numeric,ccp_club text,buy_ins_count numeric
  );

  v_elo:=public.calculate_tournament_elo_guarded(p_tournament_id);
  IF v_elo->>'success'<>'true' OR v_elo->>'already_processed'<>'false'
     OR (v_elo->>'players_processed')::integer<>v_n THEN
    RAISE EXCEPTION 'Server ELO computation failed: all operations rolled back'
      USING ERRCODE='P0001';
  END IF;

  IF v_t.league_id IS NOT NULL THEN
    -- Legacy recalc must no longer be executable by client roles after cutover.
    PERFORM public.recalculate_league_standings(v_t.league_id);
    WITH extra AS (
      SELECT tr.player_id,
        sum(tr.buy_ins_count) AS total_entries,
        (pg_catalog.array_agg(tr.ccp_club ORDER BY t.start_datetime,t.id,tr.id)
          FILTER (WHERE tr.ccp_club IS NOT NULL))[1] AS original_ccp,
        (pg_catalog.array_agg(t.id ORDER BY t.start_datetime DESC,t.id DESC,tr.id DESC))[1]
          AS last_tournament
      FROM public.tournament_results tr JOIN public.tournaments t
        ON t.id=tr.tournament_id
      WHERE t.league_id=v_t.league_id AND t.status::text='completed'
      GROUP BY tr.player_id
    )
    UPDATE public.league_standings ls SET
      total_buy_ins_spent=e.total_entries,
      ccp_club=e.original_ccp,last_tournament_id=e.last_tournament
    FROM extra e WHERE ls.league_id=v_t.league_id AND ls.player_id=e.player_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object('success',true,
    'tournament_id',p_tournament_id,'players_processed',v_n,
    'replaced_existing',v_old_n>0);
END;
$publish$;

-- Do NOT apply these grants before complete coordinated client/table cutover.
REVOKE ALL ON FUNCTION public.publish_tournament_results_guarded(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_tournament_results_guarded(uuid,jsonb)
  TO authenticated;

-- COORDINATED CUTOVER SECURITY REQUIREMENTS — NOT YET QA EXECUTED:
--
-- Once the single RPC has passed integration QA, its helpers must NOT remain
-- callable by authenticated users: direct ELO calculation could bypass the
-- chronological preflight above. PostgreSQL SECURITY DEFINER owner can still
-- call them from inside this authorized wrapper.
--
-- These are deliberately COMMENTED until every admin workflow is migrated:
--
-- REVOKE EXECUTE ON FUNCTION public.calculate_tournament_elo_guarded(uuid)
--   FROM PUBLIC,anon,authenticated;
-- REVOKE EXECUTE ON FUNCTION public.ensure_tournament_player_guarded(uuid,text,text)
--   FROM PUBLIC,anon,authenticated;
-- REVOKE EXECUTE ON FUNCTION public.reset_tournament_impact(uuid)
--   FROM PUBLIC,anon,authenticated;
-- REVOKE EXECUTE ON FUNCTION public.recalculate_league_standings(uuid)
--   FROM PUBLIC,anon,authenticated;
--
-- Also coordinate REVOKE of direct DML on elo_history, tournament_results,
-- calculated players fields, league_standings and unauthorized league_clubs.
-- KEEP THIS PROPOSAL UNDEPLOYED until this access closure is implemented
-- and tested with existing admin CRUD, multi-club and Stats Espía routes.
