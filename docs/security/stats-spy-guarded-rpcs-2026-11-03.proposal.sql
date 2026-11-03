-- SHARKANIA WEB / Stats Espía / propuesta de RPC protegidas
-- 2026-11-03. SOLO REVISIÓN: NO EJECUTADO NI APROBADO PARA PRODUCCIÓN.
--
-- Phase A (additive): guarded endpoints. Phase B (separate, after public API
-- migration): remove direct public access to financial player columns and
-- full results. Phase A alone does NOT protect data still available in
-- public.players/public.tournament_results or existing unguarded RPCs.
--
-- No secrets, service_role tokens, or caller-controlled user IDs are used.
-- IMPORTANT: financial amounts are per-currency; mixed-currency ROI is NULL.
-- Raw results may include EUR, CLP and USD; FX conversion is NOT performed.

BEGIN;

CREATE OR REPLACE FUNCTION public.stats_spy_get_summary_v1(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $body$
DECLARE
  v_viewer uuid := auth.uid();
  v_allowed boolean := false;
  v_player_id uuid;
  v_profile_id uuid;
  v_tournaments bigint;
  v_cashes bigint;
  v_wins bigint;
  v_prizes numeric;
  v_buyins numeric;
  v_currency_count integer := 0;
  v_currency text;
  v_currency_breakdown jsonb := '[]'::jsonb;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Se requiere iniciar sesión' USING ERRCODE = '42501';
  END IF;

  -- Never authorize via p_user_id or user_metadata from the browser.
  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_viewer AND p.role::text = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_purchases up
      WHERE up.user_id = v_viewer
        AND up.feature_key = 'cosmetic_extended_stats'
        AND up.is_active IS TRUE
        AND (up.expires_at IS NULL OR up.expires_at > now())
    )
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Stats Espía requiere una licencia vigente' USING ERRCODE = '42501';
  END IF;

  IF p_slug IS NULL OR length(p_slug) > 180 THEN
    RETURN NULL;
  END IF;

  SELECT p.id, p.profile_id INTO v_player_id, v_profile_id
  FROM public.players p WHERE p.slug = p_slug LIMIT 1;
  IF v_player_id IS NULL THEN RETURN NULL; END IF;

  -- The same linked-account merge rule used by the public profile.
  SELECT
    COALESCE(SUM(p.total_tournaments), 0),
    COALESCE(SUM(p.total_cashes), 0),
    COALESCE(SUM(p.total_wins), 0),
    COALESCE(SUM(p.total_prize_won), 0),
    COALESCE(SUM(p.total_buy_ins_spent), 0)
  INTO v_tournaments, v_cashes, v_wins, v_prizes, v_buyins
  FROM public.players p
  WHERE p.id = v_player_id
    OR (v_profile_id IS NOT NULL AND p.profile_id = v_profile_id);

  -- Currency-safe source of financial metrics.
  -- CLP, EUR and USD are all present in registered tournaments; adding their
  -- amounts produces meaningless ROI. Do not combine without dated FX rates.
  -- The detail is computed within EACH source currency and returned as an
  -- array for later presentation; cross-currency totals are deliberately NULL.
  SELECT
    count(*)::integer,
    max(currency),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'currency', currency,
        'total_prize_won', prizes,
        'total_buy_ins_spent', buyins,
        'profit', prizes - buyins,
        'roi_percent', CASE
          WHEN buyins > 0 THEN round((prizes - buyins) / buyins * 100, 2)
          ELSE NULL
        END
      ) ORDER BY currency
    ), '[]'::jsonb)
  INTO v_currency_count, v_currency, v_currency_breakdown
  FROM (
    SELECT
      COALESCE(t.currency::text, 'SIN_MONEDA') AS currency,
      COALESCE(SUM(COALESCE(r.prize_won,0) + COALESCE(r.bounties_won,0)), 0)::numeric AS prizes,
      COALESCE(SUM(COALESCE(t.buy_in, 0) *
        GREATEST(COALESCE(r.buy_ins_count, 1), 1)), 0)::numeric AS buyins
    FROM public.tournament_results r
    JOIN public.players p ON p.id = r.player_id
    JOIN public.tournaments t ON t.id = r.tournament_id
    WHERE p.id = v_player_id
      OR (v_profile_id IS NOT NULL AND p.profile_id = v_profile_id)
    GROUP BY COALESCE(t.currency::text, 'SIN_MONEDA')
  ) AS financials;

  IF v_currency_count = 1 THEN
    v_prizes := (v_currency_breakdown->0->>'total_prize_won')::numeric;
    v_buyins := (v_currency_breakdown->0->>'total_buy_ins_spent')::numeric;
  ELSE
    -- Also return NULL when no tournament result supports a reliable currency.
    v_prizes := NULL;
    v_buyins := NULL;
    v_currency := NULL;
  END IF;

  RETURN jsonb_build_object(
    'total_tournaments', v_tournaments,
    'total_cashes', v_cashes,
    'total_wins', v_wins,
    'total_prize_won', v_prizes,
    'total_buy_ins_spent', v_buyins,
    'profit', CASE WHEN v_prizes IS NOT NULL AND v_buyins IS NOT NULL
      THEN v_prizes - v_buyins ELSE NULL END,
    'roi_percent',
      CASE WHEN v_buyins > 0 AND v_prizes IS NOT NULL
        THEN round(((v_prizes - v_buyins) / v_buyins) * 100, 2)
        ELSE NULL
      END,
    'currency', v_currency,
    'mixed_currencies', v_currency_count > 1,
    'currency_breakdown', v_currency_breakdown
  );
END
$body$;

-- A separate endpoint for historical detail (paginated, full-access only).
CREATE OR REPLACE FUNCTION public.stats_spy_get_history_v1(
  p_slug text,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $body$
DECLARE
  v_viewer uuid := auth.uid();
  v_allowed boolean := false;
  v_player_id uuid;
  v_profile_id uuid;
  v_results jsonb;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Se requiere iniciar sesión' USING ERRCODE = '42501';
  END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_viewer AND p.role::text = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_purchases up
      WHERE up.user_id = v_viewer
        AND up.feature_key = 'cosmetic_extended_stats'
        AND up.is_active IS TRUE
        AND (up.expires_at IS NULL OR up.expires_at > now())
    )
  INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Stats Espía requiere una licencia vigente' USING ERRCODE = '42501';
  END IF;

  IF p_slug IS NULL OR length(p_slug) > 180 THEN RETURN '[]'::jsonb; END IF;

  SELECT p.id, p.profile_id INTO v_player_id, v_profile_id
  FROM public.players p WHERE p.slug = p_slug LIMIT 1;
  IF v_player_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(history) ORDER BY history.created_at DESC, history.id DESC), '[]'::jsonb)
  INTO v_results
  FROM (
    SELECT
      r.id,
      r.position,
      r.prize_won,
      r.bounties_won,
      r.buy_ins_count,
      r.elo_change,
      r.ccp_club,
      r.created_at,
      jsonb_build_object(
        'id', t.id, 'name', t.name, 'slug', t.slug,
        'buy_in', t.buy_in, 'currency', t.currency, 'start_datetime', t.start_datetime,
        'clubs',
          CASE WHEN c.id IS NULL THEN NULL
          ELSE jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
          END
      ) AS tournaments,
      jsonb_build_object('nickname', p.nickname) AS players
    FROM public.tournament_results r
    JOIN public.players p ON p.id = r.player_id
    JOIN public.tournaments t ON t.id = r.tournament_id
    LEFT JOIN public.clubs c ON c.id = t.club_id
    WHERE p.id = v_player_id
      OR (v_profile_id IS NOT NULL AND p.profile_id = v_profile_id)
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT least(greatest(COALESCE(p_limit, 100), 1), 250)
    OFFSET least(greatest(COALESCE(p_offset, 0), 0), 10000)
  ) AS history;

  RETURN v_results;
END
$body$;

REVOKE ALL ON FUNCTION public.stats_spy_get_summary_v1(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stats_spy_get_history_v1(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stats_spy_get_summary_v1(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_spy_get_history_v1(text, integer, integer)
  TO authenticated;

COMMIT;

-- PHASE B / NOT PART OF THIS SCRIPT:
-- 1. Remove direct SELECT grants on selected financial columns of players
--    and detailed tournament_results, using explicit public column grants.
-- 2. Replace select('*') in every dependent public/admin client path.
-- 3. Redesign get_unified_player_stats and get_unified_ranking to return
--    only the public metrics explicitly approved in the product contract.
-- 4. Revoke EXECUTE from PUBLIC on pre-existing unguarded premium RPCs
--    when their public replacements have passed tests.
-- 5. Verify with anon, authenticated-unlicensed, licensed, expired,
--    super_admin and service_role using isolated test identities.
-- 6. Rollback plans must restore existing APIs if regression is detected.
--
-- Neither CREATE FUNCTION nor REVOKE above was executed in Sharkania.
