\set ON_ERROR_STOP on
-- QA OPS / READ ONLY: run only after ELO v2 FX candidate is installed
-- on an approved restored clone. Never displays user IDs, secrets or URLs.
BEGIN READ ONLY;
\echo === ELO v2 FX health — no writes, no credentials ===
SELECT pg_catalog.current_database() AS database_name,
       pg_catalog.clock_timestamp() AS inspected_at,
       a.enabled AS v2_enabled,a.effective_at AS v2_effective_at
FROM sharkania_release.elo_v2_activation a WHERE a.id=1;

\echo === Current source liveness: check at source, not merely a stale quote ===
WITH nowclock AS (
 SELECT pg_catalog.clock_timestamp() AS now_utc
), feed(currency) AS (
 VALUES ('CLP'::text),('EUR'::text)
), last_seen AS (
 SELECT DISTINCT ON (currency)
  currency,checked_at,newest_effective_date,newest_observation_id
 FROM sharkania_release.fx_feed_check_v2
 ORDER BY currency,checked_at DESC,id DESC
)
SELECT f.currency,
 c.checked_at AS last_successful_provider_check,
 round((extract(epoch FROM (n.now_utc-c.checked_at))/60)::numeric,1)
    AS provider_check_age_minutes,
 c.newest_effective_date AS newest_official_observation,
 CASE
  WHEN c.checked_at IS NULL THEN 'NO_PROVIDER_CHECK'
  WHEN c.checked_at>n.now_utc THEN 'FUTURE_CHECK_REQUIRES_INVESTIGATION'
  WHEN n.now_utc-c.checked_at>interval '2 hours' THEN 'STALE_SOURCE_CHECK'
  WHEN c.newest_effective_date<((n.now_utc AT TIME ZONE 'UTC')::date-7)
     THEN 'STALE_OFFICIAL_QUOTE'
  ELSE 'RECENT_PROVIDER_CHECK'
 END AS monitoring_status
FROM feed f CROSS JOIN nowclock n
LEFT JOIN last_seen c ON c.currency=f.currency
ORDER BY f.currency;

\echo === Provider receipt/FX integrity (must both be zero) ===
SELECT
 (SELECT count(*) FROM sharkania_release.fx_feed_check_v2 ch
  LEFT JOIN sharkania_release.fx_observation_v2 fx
  ON fx.id=ch.newest_observation_id
  WHERE fx.id IS NULL OR fx.currency IS DISTINCT FROM ch.currency
   OR fx.effective_date IS DISTINCT FROM ch.newest_effective_date)
  AS mismatched_feed_receipts,
 (SELECT count(*) FROM sharkania_release.elo_v2_event_fx e
  LEFT JOIN sharkania_release.fx_observation_v2 fx
    ON e.rate_observation_id=fx.id
  WHERE (e.original_currency IN ('CLP','EUR') AND
   (fx.id IS NULL OR fx.currency IS DISTINCT FROM e.original_currency
    OR fx.quote IS DISTINCT FROM e.quote)))
  AS mismatched_event_snapshots;

\echo === USD-normalized first publications by currency (metadata only) ===
SELECT e.original_currency AS currency,
 count(*) AS v2_tournaments,
 round(min(e.buy_in_usd),6) AS min_buy_in_usd,
 round(max(e.buy_in_usd),6) AS max_buy_in_usd
FROM sharkania_release.elo_v2_event_fx e
GROUP BY e.original_currency
ORDER BY e.original_currency;

\echo === Never regard recent health as approval of production deployment ===
COMMIT;
