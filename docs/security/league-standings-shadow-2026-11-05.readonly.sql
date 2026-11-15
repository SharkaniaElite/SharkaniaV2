-- SHARKANIA / League standings shadow reconciliation — 2026-11-05
-- READ ONLY: one WITH ... SELECT. NOT A MIGRATION, NOT A REPLACEMENT RPC.
-- Compare numeric scores using the current top-N scoring definition.
-- CCP and reentry figures below are DIAGNOSTIC CANDIDATES ONLY; no rules
-- approved for changing locked clubs or historical participation counters.
-- No player names, email addresses or player IDs are returned.
--
-- Do not use this SELECT as evidence that historical league rows may be deleted.
-- Confirm the business meaning of the 51 no-source rows first.
WITH inputs AS (
 SELECT t.league_id, tr.player_id, tr.id AS result_id, tr.tournament_id,
        tr.league_points_earned, tr.position, tr.ccp_club, tr.buy_ins_count,
        t.start_datetime, l.best_dates_to_count,
        row_number() OVER (
          PARTITION BY t.league_id,tr.player_id
          ORDER BY tr.league_points_earned DESC, tr.position ASC,
                   t.start_datetime ASC, t.id ASC, tr.id ASC
        ) AS score_rank
 FROM public.tournament_results tr
 JOIN public.tournaments t ON t.id=tr.tournament_id
 JOIN public.leagues l ON l.id=t.league_id
 WHERE t.league_id IS NOT NULL
), candidate_scores AS (
 SELECT league_id, player_id,
  sum(league_points_earned) FILTER (
    WHERE best_dates_to_count IS NULL OR score_rank <= best_dates_to_count
  ) AS total_points,
  count(*)::integer AS tournaments_played,
  min(position) AS best_position,
  count(*) FILTER (WHERE position <= 9)::integer AS final_tables_count,
  (array_agg(nullif(btrim(ccp_club),'')
    ORDER BY start_datetime,tournament_id,result_id)
    FILTER (WHERE nullif(btrim(ccp_club),'') IS NOT NULL))[1] AS first_ccp,
  sum(buy_ins_count) AS all_reentries
 FROM inputs
 GROUP BY league_id,player_id
), candidates AS (
 SELECT *,
  row_number() OVER (
   PARTITION BY league_id
   ORDER BY total_points DESC, tournaments_played DESC,
            best_position ASC NULLS LAST, final_tables_count DESC,
            player_id ASC
  ) AS proposed_rank
 FROM candidate_scores
), compared AS (
 SELECT coalesce(c.league_id,s.league_id) AS league_id,
        s.player_id AS existing_player,c.player_id AS source_player,
        s.total_points AS old_points,c.total_points AS new_points,
        s.tournaments_played AS old_played,c.tournaments_played AS new_played,
        s.rank_position AS old_rank,c.proposed_rank AS new_rank,
        s.ccp_club AS old_ccp,c.first_ccp AS new_ccp,
        s.total_buy_ins_spent AS old_reentries,c.all_reentries AS new_reentries
 FROM candidates c
 FULL OUTER JOIN public.league_standings s
 ON c.league_id=s.league_id AND c.player_id=s.player_id
)
SELECT l.slug AS league_slug,
 count(*) FILTER (WHERE existing_player IS NOT NULL) AS existing_positions,
 count(*) FILTER (WHERE source_player IS NOT NULL) AS calculated_positions,
 count(*) FILTER (WHERE existing_player IS NOT NULL AND source_player IS NULL) AS historical_without_source,
 count(*) FILTER (WHERE source_player IS NOT NULL AND existing_player IS NULL) AS missing_current_position,
 count(*) FILTER (
   WHERE existing_player IS NOT NULL AND source_player IS NOT NULL
    AND old_points IS DISTINCT FROM new_points
 ) AS points_diff,
 count(*) FILTER (
   WHERE existing_player IS NOT NULL AND source_player IS NOT NULL
    AND old_played IS DISTINCT FROM new_played
 ) AS participations_diff,
 count(*) FILTER (
   WHERE existing_player IS NOT NULL AND source_player IS NOT NULL
    AND old_rank IS DISTINCT FROM new_rank
 ) AS rank_diff,
 count(*) FILTER (
   WHERE existing_player IS NOT NULL AND source_player IS NOT NULL
    AND old_ccp IS DISTINCT FROM new_ccp
 ) AS ccp_diff,
 count(*) FILTER (
   WHERE existing_player IS NOT NULL AND source_player IS NOT NULL
    AND old_reentries IS DISTINCT FROM new_reentries
 ) AS reentries_diff
FROM compared JOIN public.leagues l ON l.id=compared.league_id
GROUP BY l.slug
ORDER BY historical_without_source DESC,missing_current_position DESC,
         rank_diff DESC,l.slug;
