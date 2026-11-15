
-- ══════════════════════════════════════════════════════════
-- UNIFIED PLAYER STATS — Para merge de nicknames vinculados
-- ══════════════════════════════════════════════════════════

-- 1. Vista que identifica qué players pertenecen al mismo profile
--    (basado en nickname_claims aprobados)
CREATE OR REPLACE VIEW v_player_groups AS
SELECT 
  p.id as player_id,
  p.profile_id,
  p.nickname,
  p.slug,
  p.country_code,
  p.elo_rating,
  p.elo_peak,
  p.total_tournaments,
  p.total_cashes,
  p.total_wins,
  p.total_prize_won,
  p.total_buy_ins_spent,
  p.room_id,
  p.created_at,
  -- El "primary player" es el que tiene el ELO más alto del grupo
  FIRST_VALUE(p.id) OVER (
    PARTITION BY p.profile_id 
    ORDER BY p.elo_rating DESC, p.total_tournaments DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) as primary_player_id,
  -- Cuenta cuántos aliases tiene este profile
  COUNT(*) OVER (PARTITION BY p.profile_id) as alias_count
FROM players p
WHERE p.profile_id IS NOT NULL;

-- 2. Función que retorna stats unificadas de un jugador por su slug
CREATE OR REPLACE FUNCTION get_unified_player_stats(p_slug TEXT)
RETURNS JSON AS $$
DECLARE
  v_player_id UUID;
  v_profile_id UUID;
  v_alias_count INT;
  v_result JSON;
BEGIN
  -- Buscar el player por slug
  SELECT id, profile_id INTO v_player_id, v_profile_id
  FROM players WHERE slug = p_slug LIMIT 1;
  
  IF v_player_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Si no tiene profile_id, no hay merge posible
  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Contar aliases con el mismo profile_id
  SELECT count(*) INTO v_alias_count
  FROM players WHERE profile_id = v_profile_id;
  
  -- Si solo tiene 1 nickname, no hay merge necesario
  IF v_alias_count <= 1 THEN
    RETURN NULL;
  END IF;
  
  -- Calcular stats unificadas
  SELECT json_build_object(
    'profile_id', v_profile_id,
    'primary_player_id', v_player_id,
    'alias_count', v_alias_count,
    'total_tournaments', SUM(p.total_tournaments),
    'total_cashes', SUM(p.total_cashes),
    'total_wins', SUM(p.total_wins),
    'total_prize_won', SUM(p.total_prize_won),
    'total_buy_ins_spent', SUM(p.total_buy_ins_spent),
    'aliases', (
      SELECT json_agg(json_build_object(
        'player_id', p2.id,
        'nickname', p2.nickname,
        'slug', p2.slug,
        'room_id', p2.room_id,
        'elo_rating', p2.elo_rating,
        'total_tournaments', p2.total_tournaments,
        'room_name', pr.name
      ) ORDER BY p2.total_tournaments DESC)
      FROM players p2
      LEFT JOIN poker_rooms pr ON pr.id = p2.room_id
      WHERE p2.profile_id = v_profile_id
    )
  ) INTO v_result
  FROM players p
  WHERE p.profile_id = v_profile_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función que retorna el historial de ELO unificado (para la gráfica)
CREATE OR REPLACE FUNCTION get_unified_elo_history(p_slug TEXT)
RETURNS TABLE(
  recorded_at TIMESTAMPTZ,
  elo_after NUMERIC,
  elo_change NUMERIC,
  tournament_name TEXT,
  nickname TEXT
) AS $$
DECLARE
  v_profile_id UUID;
  v_alias_count INT;
BEGIN
  -- Obtener profile_id del player por slug
  SELECT p.profile_id INTO v_profile_id
  FROM players p WHERE p.slug = p_slug LIMIT 1;
  
  IF v_profile_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Contar aliases
  SELECT count(*) INTO v_alias_count
  FROM players WHERE profile_id = v_profile_id;
  
  -- Si solo tiene 1 nickname, retornar historial normal
  IF v_alias_count <= 1 THEN
    RETURN QUERY
    SELECT eh.recorded_at, eh.elo_after, eh.elo_change, 
           t.name as tournament_name, pl.nickname
    FROM elo_history eh
    JOIN players pl ON pl.id = eh.player_id
    JOIN tournaments t ON t.id = eh.tournament_id
    WHERE eh.player_id = (SELECT id FROM players WHERE slug = p_slug LIMIT 1)
    ORDER BY eh.recorded_at ASC;
    RETURN;
  END IF;
  
  -- Retornar historial unificado: todos los elo_history de todos los aliases
  -- ordenados cronológicamente, con ELO recalculado secuencialmente
  RETURN QUERY
  WITH all_history AS (
    SELECT 
      eh.recorded_at,
      eh.elo_change,
      t.name as tournament_name,
      pl.nickname,
      ROW_NUMBER() OVER (ORDER BY eh.recorded_at ASC) as rn
    FROM elo_history eh
    JOIN players pl ON pl.id = eh.player_id
    JOIN tournaments t ON t.id = eh.tournament_id
    WHERE pl.profile_id = v_profile_id
    ORDER BY eh.recorded_at ASC
  ),
  running_elo AS (
    SELECT 
      ah.recorded_at,
      ah.elo_change,
      ah.tournament_name,
      ah.nickname,
      -- Recalcular ELO acumulativo desde 1200
      GREATEST(100, 1200 + SUM(ah.elo_change) OVER (ORDER BY ah.recorded_at ASC)) as elo_after
    FROM all_history ah
  )
  SELECT 
    re.recorded_at,
    re.elo_after,
    re.elo_change,
    re.tournament_name,
    re.nickname
  FROM running_elo re
  ORDER BY re.recorded_at ASC;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función para obtener el ELO unificado actual (para el ranking)
CREATE OR REPLACE FUNCTION get_unified_elo(p_profile_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_alias_count INT;
  v_unified_elo NUMERIC;
BEGIN
  SELECT count(*) INTO v_alias_count
  FROM players WHERE profile_id = p_profile_id;
  
  IF v_alias_count <= 1 THEN
    SELECT elo_rating INTO v_unified_elo
    FROM players WHERE profile_id = p_profile_id LIMIT 1;
    RETURN v_unified_elo;
  END IF;
  
  -- Calcular ELO unificado: 1200 + suma de todos los elo_changes
  SELECT GREATEST(100, 1200 + COALESCE(SUM(eh.elo_change), 0))
  INTO v_unified_elo
  FROM elo_history eh
  WHERE eh.player_id IN (SELECT id FROM players WHERE profile_id = p_profile_id);
  
  RETURN v_unified_elo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grants para las funciones
GRANT EXECUTE ON FUNCTION get_unified_player_stats(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_unified_elo_history(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_unified_elo(UUID) TO anon, authenticated;
