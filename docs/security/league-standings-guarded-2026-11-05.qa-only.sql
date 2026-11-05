-- SHARKANIA RELEASE A — GUARDED STANDINGS PROTOTYPE, 5 November 2026
-- QA ONLY; NOT A MIGRATION. Do not execute against production or a Pages preview.
-- Dependencies: leagues, league_clubs, club admin helpers, tournaments,
-- tournament_results, league_standings, auth.uid().
-- The future production cutover MUST coordinate legacy DML/RPC revocation
-- and all affected frontend paths. This file does not implement that cutover.
BEGIN;
CREATE OR REPLACE FUNCTION public.recalculate_league_standings_guarded(p_league_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guarded$
DECLARE
  v_best integer;
  v_primary uuid;
  v_primary_count integer;
  v_written integer := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  -- Lock the league to serialize calls to THIS function. A later release
  -- must also coordinate writers of tournament results with the same lock.
  SELECT l.best_dates_to_count INTO v_best
  FROM public.leagues l WHERE l.id=p_league_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'League not found' USING ERRCODE='PT404';
  END IF;
  IF v_best IS NOT NULL AND v_best < 1 THEN
    RAISE EXCEPTION 'Invalid best dates setting' USING ERRCODE='PT422';
  END IF;
  SELECT count(*)::integer, (array_agg(lc.club_id))[1] INTO v_primary_count,v_primary
  FROM public.league_clubs lc
  WHERE lc.league_id=p_league_id AND lc.is_primary IS TRUE;
  IF v_primary_count<>1 THEN
    RAISE EXCEPTION 'Primary organizer missing or ambiguous' USING ERRCODE='PT409';
  END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(v_primary))) THEN
    RAISE EXCEPTION 'Primary organizer authorization required' USING ERRCODE='42501';
  END IF;
  -- Fail closed on historical positions lacking a source. Never delete or
  -- silently overwrite the 51 known production exceptions.
  IF EXISTS (
    SELECT 1 FROM public.league_standings s
    WHERE s.league_id=p_league_id AND NOT EXISTS (
      SELECT 1 FROM public.tournament_results tr
      JOIN public.tournaments t ON t.id=tr.tournament_id
      WHERE t.league_id=p_league_id AND tr.player_id=s.player_id
    )
  ) THEN
    RAISE EXCEPTION 'Historical standings without source: reconciliation required'
      USING ERRCODE='PT409';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tournament_results tr
    JOIN public.tournaments t ON t.id=tr.tournament_id
    WHERE t.league_id=p_league_id
  ) THEN
    RAISE EXCEPTION 'No tournament results to recalculate' USING ERRCODE='PT409';
  END IF;
  -- One atomic materialization; IDs, locked CCP, reentries, and
  -- last_tournament_id are preserved on existing standings.
  -- First nonblank CCP/all registrations for NEW rows are QA candidates only,
  -- NOT an approved business rule for historical reconciliation.
  WITH inputs AS (
    SELECT tr.player_id,tr.id AS result_id,tr.tournament_id,tr.position,
           tr.league_points_earned,tr.ccp_club,tr.buy_ins_count,t.start_datetime,
      row_number() OVER (
        PARTITION BY tr.player_id
        ORDER BY tr.league_points_earned DESC,tr.position ASC,
                 t.start_datetime ASC,t.id ASC,tr.id ASC
      ) AS score_rank
    FROM public.tournament_results tr
    JOIN public.tournaments t ON t.id=tr.tournament_id
    WHERE t.league_id=p_league_id
  ), aggregated AS (
    SELECT i.player_id,
      coalesce(sum(i.league_points_earned) FILTER (
        WHERE v_best IS NULL OR i.score_rank<=v_best
      ),0) AS points,
      count(*)::integer AS played,
      min(i.position) AS best_position,
      count(*) FILTER (WHERE i.position BETWEEN 1 AND 9)::integer AS final_tables,
      (array_agg(nullif(pg_catalog.btrim(i.ccp_club),'')
        ORDER BY i.start_datetime,i.tournament_id,i.result_id)
        FILTER (WHERE nullif(pg_catalog.btrim(i.ccp_club),'') IS NOT NULL))[1]
        AS first_ccp,
      sum(coalesce(nullif(i.buy_ins_count,0),1)) AS all_registrations
    FROM inputs i
    GROUP BY i.player_id
  ), ranked AS (
    SELECT a.*,
      row_number() OVER (
        ORDER BY a.points DESC,a.played DESC,
                 a.best_position ASC NULLS LAST,a.final_tables DESC,
                 a.player_id ASC
      )::integer AS proposed_rank
    FROM aggregated a
  )
  INSERT INTO public.league_standings (
    league_id,player_id,total_points,tournaments_played,best_position,
    final_tables_count,rank_position,ccp_club,total_buy_ins_spent
  )
  SELECT p_league_id,r.player_id,r.points,r.played,r.best_position,
    r.final_tables,r.proposed_rank,r.first_ccp,r.all_registrations
  FROM ranked r WHERE true
  ON CONFLICT (league_id,player_id)
  DO UPDATE SET
    total_points=EXCLUDED.total_points,
    tournaments_played=EXCLUDED.tournaments_played,
    best_position=EXCLUDED.best_position,
    final_tables_count=EXCLUDED.final_tables_count,
    rank_position=EXCLUDED.rank_position,
    updated_at=pg_catalog.now();
  GET DIAGNOSTICS v_written = ROW_COUNT;
  RETURN v_written;
END;
$guarded$;
REVOKE ALL ON FUNCTION public.recalculate_league_standings_guarded(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_league_standings_guarded(uuid)
  TO authenticated;
COMMIT;
