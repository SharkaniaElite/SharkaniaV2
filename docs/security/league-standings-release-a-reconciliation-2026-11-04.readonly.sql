-- SHARKANIA — Release A standalone read-only standing reconciliation.
-- NOT A MIGRATION. SELECTs only. No writes, no EXPLAIN ANALYZE, no live index tests.
-- Execution requires authorized read access to an existing snapshot/DB;
-- production must remain unchanged. Results report aggregate counts by league,
-- never nicknames, emails or account credentials.
-- A mismatch is a reconciliation candidate, NOT an automatic correction.

-- 1. Check current effective execution permissions and function mode.
SELECT
  n.nspname || '.' || p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS signature,
  pg_get_userbyid(p.proowner) AS owner_name,
  p.prosecdef AS security_definer,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('recalculate_league_standings','recalculate_league_standings_guarded')
ORDER BY function_name;

-- 2. Check RLS policies and table permissions for standing writes.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,
  has_table_privilege('anon',c.oid,'UPDATE') AS anon_update,
  has_table_privilege('anon',c.oid,'DELETE') AS anon_delete,
  has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') AS authenticated_update,
  has_table_privilege('authenticated',c.oid,'DELETE') AS authenticated_delete
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='league_standings';

SELECT policyname,cmd,roles,qual,with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='league_standings'
ORDER BY cmd,policyname;

-- 3. Baseline by league (no player identifiers exposed):
-- Count reentries as COALESCE(NULLIF(buy_ins_count,0),1), matching the
-- legacy JS fallback Number(value) || 1 for 0/NULL values.
-- legacy_reentries counts ONLY rows with non-null CCP, reproducing the
-- client .not("ccp_club","is",null) filter; it is NOT the desired future rule.
WITH sources AS (
  SELECT
    t.league_id, tr.player_id,
    (array_agg(NULLIF(btrim(tr.ccp_club),'')
       ORDER BY t.start_datetime,t.id,tr.id)
       FILTER (WHERE NULLIF(btrim(tr.ccp_club),'') IS NOT NULL))[1] AS first_ccp,
    COALESCE(sum(COALESCE(NULLIF(tr.buy_ins_count,0),1)),0) AS all_reentries,
    COALESCE(sum(COALESCE(NULLIF(tr.buy_ins_count,0),1))
      FILTER (WHERE tr.ccp_club IS NOT NULL),0) AS legacy_reentries
  FROM public.tournament_results tr
  JOIN public.tournaments t ON t.id=tr.tournament_id
  WHERE t.league_id IS NOT NULL
  GROUP BY t.league_id,tr.player_id
)
SELECT
  l.id AS league_id,
  l.slug AS league_slug,
  count(*) AS standing_rows,
  count(*) FILTER (WHERE src.player_id IS NULL) AS without_source_results,
  count(*) FILTER (
    WHERE s.ccp_club IS DISTINCT FROM src.first_ccp
  ) AS first_ccp_mismatch,
  count(*) FILTER (
    WHERE s.total_buy_ins_spent IS DISTINCT FROM src.legacy_reentries
      AND s.ccp_club IS NOT NULL
  ) AS legacy_reentries_mismatch_with_ccp,
  count(*) FILTER (
    WHERE src.all_reentries IS DISTINCT FROM src.legacy_reentries
  ) AS affected_by_excluding_results_without_ccp,
  count(*) FILTER (
    WHERE src.player_id IS NOT NULL
      AND s.total_buy_ins_spent IS DISTINCT FROM src.all_reentries
  ) AS current_vs_full_reentries_mismatch
FROM public.league_standings s
JOIN public.leagues l ON l.id=s.league_id
LEFT JOIN sources src
  ON src.league_id=s.league_id AND src.player_id=s.player_id
GROUP BY l.id,l.slug
ORDER BY without_source_results DESC,
  current_vs_full_reentries_mismatch DESC,l.slug;

-- 4. Global consistency checks / historic fields.
SELECT
  count(*) AS standing_rows,
  count(*) FILTER (WHERE ccp_club IS NOT NULL) AS with_ccp,
  count(*) FILTER (WHERE last_tournament_id IS NOT NULL) AS with_last_tournament_id,
  count(DISTINCT league_id) AS represented_leagues
FROM public.league_standings;

SELECT count(*) AS duplicate_league_player_pairs
FROM (
  SELECT league_id,player_id
  FROM public.league_standings
  GROUP BY league_id,player_id
  HAVING count(*)>1
) duplicates;
