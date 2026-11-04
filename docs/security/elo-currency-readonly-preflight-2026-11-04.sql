-- SHARKANIA / production-safe READ ONLY currency & historic consistency preflight.
-- No PII identifiers are selected; aggregate counts only.
-- Run under a READ ONLY transaction, on an approved connection, before any
-- proposed ELO cutover. This script NEVER modifies data.
BEGIN TRANSACTION READ ONLY;

-- Tournament count by unit. The current draft guarded publication only
-- handles USD; CLP/EUR must NOT be silently admitted without an Elo design.
SELECT coalesce(nullif(t.currency,''),'(sin moneda)') AS currency,
  count(*) AS tournament_count,
  count(*) FILTER (WHERE t.results_uploaded) AS published_count
FROM public.tournaments t
GROUP BY coalesce(nullif(t.currency,''),'(sin moneda)')
ORDER BY tournament_count DESC,currency;

-- League currency consistency: verify all/only published games. Note that
-- "no league mixes currency" does NOT imply players stay within one currency.
WITH league_currencies AS (
 SELECT t.league_id,
  count(DISTINCT t.currency) AS currencies_all,
  count(DISTINCT t.currency) FILTER (WHERE t.results_uploaded) AS currencies_published,
  count(*) FILTER (WHERE t.results_uploaded) AS published
 FROM public.tournaments t WHERE t.league_id IS NOT NULL
 GROUP BY t.league_id
)
SELECT count(*) AS leagues_with_tournaments,
 count(*) FILTER(WHERE currencies_all>1) AS mixed_currency_leagues,
 count(*) FILTER(WHERE currencies_published>1) AS mixed_currency_published_leagues,
 count(*) FILTER(WHERE published>0) AS leagues_with_published_results
FROM league_currencies;

-- Players with published results denominated in multiple currencies.
-- Do not expose player IDs in the report.
WITH player_currency AS (
 SELECT tr.player_id,
   count(DISTINCT t.currency) AS currencies,
   count(*) AS result_rows
 FROM public.tournament_results tr
 JOIN public.tournaments t ON t.id=tr.tournament_id
 WHERE t.results_uploaded=true
 GROUP BY tr.player_id
)
SELECT count(*) AS players_with_published_results,
 count(*) FILTER (WHERE currencies>1) AS multiple_currency_players,
 coalesce(sum(result_rows),0) AS published_result_rows
FROM player_currency;

-- Structural consistency ONLY, not a monetary/ELO semantic audit.
WITH x AS (
 SELECT t.id,t.results_uploaded,
  (SELECT count(*) FROM public.tournament_results r
     WHERE r.tournament_id=t.id) AS result_rows,
  (SELECT count(*) FROM public.elo_history h
     WHERE h.tournament_id=t.id) AS elo_rows
 FROM public.tournaments t
)
SELECT count(*) AS tournaments,
 count(*) FILTER (WHERE results_uploaded AND result_rows=0)
   AS published_without_results,
 count(*) FILTER (WHERE NOT results_uploaded AND result_rows>0)
   AS unpublished_with_results,
 count(*) FILTER (WHERE results_uploaded AND elo_rows<>result_rows)
   AS elo_result_count_mismatch
FROM x;

-- Current league organizer data.
WITH p AS (
 SELECT l.id, count(lc.*) FILTER (WHERE lc.is_primary) AS primaries
 FROM public.leagues l LEFT JOIN public.league_clubs lc ON lc.league_id=l.id
 GROUP BY l.id
)
SELECT count(*) AS leagues,
 count(*) FILTER(WHERE primaries=0) AS no_primary,
 count(*) FILTER(WHERE primaries>1) AS multiple_primary
FROM p;

ROLLBACK;
