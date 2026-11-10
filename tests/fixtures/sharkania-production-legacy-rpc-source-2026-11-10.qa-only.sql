-- QA ONLY: verbatim pg_get_functiondef snapshot extracted read-only 2026-11-10.
-- NEVER execute this file against Supabase production: it defines legacy RPCs.
-- bulk_delete_scheduled_tournaments(p_tournament_ids uuid[]) MD5 98217e0c3792f81349d63428dd0b37ac
CREATE OR REPLACE FUNCTION public.bulk_delete_scheduled_tournaments(p_tournament_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = ANY(p_tournament_ids) AND NOT (public.is_super_admin() OR public.is_club_admin(t.club_id))) THEN RAISE EXCEPTION 'Acceso denegado a eliminar torneos' USING ERRCODE='42501'; END IF;
  DELETE FROM tournaments
  WHERE id = ANY(p_tournament_ids)
  AND status = 'scheduled'
  AND results_uploaded = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- delete_tournament_god_mode(tournament_id_to_delete uuid) MD5 bcfbc09bd9a8c1726afabb36135b2bb7
CREATE OR REPLACE FUNCTION public.delete_tournament_god_mode(tournament_id_to_delete uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    affected_player_ids UUID[];
    league_id_affected UUID;
    v_player_id UUID;
    v_club_id UUID;
    v_current_elo DECIMAL;
    v_peak_elo DECIMAL;
    h RECORD;
    v_t INTEGER; v_c INTEGER; v_w INTEGER; v_prize DECIMAL; v_buyin DECIMAL;
BEGIN
  IF NOT COALESCE((SELECT public.is_super_admin() OR public.is_club_admin(club_id) FROM public.tournaments WHERE id = tournament_id_to_delete), false) THEN RAISE EXCEPTION 'Acceso denegado a eliminar torneo' USING ERRCODE='42501'; END IF;
    RAISE NOTICE '🧨 INICIANDO ELIMINACIÓN SQL GOD MODE: %', tournament_id_to_delete;

    -- 1. Capturar info del torneo antes de borrarlo
    SELECT league_id, club_id INTO league_id_affected, v_club_id
    FROM tournaments WHERE id = tournament_id_to_delete;

    IF v_club_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Torneo no encontrado');
    END IF;

    -- 2. CAPTURAR JUGADORES AFECTADOS
    SELECT ARRAY_AGG(DISTINCT player_id) INTO affected_player_ids
    FROM tournament_results
    WHERE tournament_id = tournament_id_to_delete AND player_id IS NOT NULL;

    -- 3. LIMPIEZA TOTAL (Bypass de RLS)
    DELETE FROM elo_history WHERE tournament_id = tournament_id_to_delete;
    DELETE FROM tournament_results WHERE tournament_id = tournament_id_to_delete;
    DELETE FROM tournaments WHERE id = tournament_id_to_delete;

    -- 4. RECONSTRUCCIÓN DE LA REALIDAD PARA CADA JUGADOR
    IF affected_player_ids IS NOT NULL THEN
        FOREACH v_player_id IN ARRAY affected_player_ids
        LOOP
            -- A) Recalcular contadores (Wins, Cashes, Profit REALES restantes)
            SELECT 
                COUNT(tr.id),
                COUNT(CASE WHEN tr.prize_won > 0 THEN 1 END),
                COUNT(CASE WHEN tr.position = 1 THEN 1 END),
                SUM(COALESCE(tr.prize_won, 0) + COALESCE(tr.bounties_won, 0)),
                SUM(COALESCE(t.buy_in, 0))
            INTO v_t, v_c, v_w, v_prize, v_buyin
            FROM tournament_results tr
            JOIN tournaments t ON tr.tournament_id = t.id
            WHERE tr.player_id = v_player_id AND t.status = 'completed';

            -- B) RECONSTRUIR CADENA DE ELO (CRONOLÓGICA)
            v_current_elo := 1200;
            v_peak_elo := 1200;

            -- Usamos id como fallback ya que created_at no existe
            FOR h IN 
                SELECT id, tournament_id, elo_change
                FROM elo_history
                WHERE player_id = v_player_id
                ORDER BY id ASC 
            LOOP
                UPDATE elo_history
                SET elo_before = v_current_elo, 
                    elo_after = v_current_elo + h.elo_change
                WHERE id = h.id;

                UPDATE tournament_results
                SET elo_before = v_current_elo, 
                    elo_after = v_current_elo + h.elo_change
                WHERE tournament_id = h.tournament_id AND player_id = v_player_id;

                v_current_elo := v_current_elo + h.elo_change;
                v_peak_elo := GREATEST(v_peak_elo, v_current_elo);
            END LOOP;

            -- C) Sincronizar tabla 'players' (Ceros garantizados si stats es NULL)
            UPDATE players
            SET 
                total_tournaments = COALESCE(v_t, 0),
                total_cashes = COALESCE(v_c, 0),
                total_wins = COALESCE(v_w, 0),
                total_prize_won = COALESCE(v_prize, 0),
                total_buy_ins_spent = COALESCE(v_buyin, 0),
                elo_rating = v_current_elo,
                elo_peak = v_peak_elo
            WHERE id = v_player_id;
        END LOOP;
    END IF;

    -- 5. RECALCULAR LIGA (Ranking y Best Position)
    IF league_id_affected IS NOT NULL THEN
        DELETE FROM league_standings WHERE league_id = league_id_affected;

        INSERT INTO league_standings (league_id, player_id, total_points, tournaments_played, best_position, rank_position)
        SELECT 
            league_id_affected,
            tr.player_id,
            SUM(COALESCE(tr.league_points_earned, 0)),
            COUNT(tr.id),
            MIN(tr.position),
            ROW_NUMBER() OVER (ORDER BY SUM(COALESCE(tr.league_points_earned, 0)) DESC)
        FROM tournament_results tr
        JOIN tournaments t ON tr.tournament_id = t.id
        WHERE t.league_id = league_id_affected AND t.status = 'completed'
        GROUP BY tr.player_id;
    END IF;

    RETURN json_build_object('success', true, 'message', 'Torneo eliminado y sistema reconstruido');
END;
$function$;

-- recalculate_league_standings(p_league_id uuid) MD5 b1cef8db810f7ab06b3cffe06daf0f0a
CREATE OR REPLACE FUNCTION public.recalculate_league_standings(p_league_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
DECLARE
  v_best_dates INTEGER;
BEGIN
  -- Obtener la configuración de la liga
  SELECT best_dates_to_count INTO v_best_dates
  FROM leagues
  WHERE id = p_league_id;

  -- Borrar las posiciones actuales
  DELETE FROM league_standings WHERE league_id = p_league_id;

  -- Insertar las nuevas posiciones calculadas
  INSERT INTO league_standings (
    league_id, 
    player_id, 
    total_points, 
    tournaments_played, 
    best_position,
    final_tables_count, -- 👈 NUEVA COLUMNA AGREGADA
    updated_at
  )
  SELECT 
    p_league_id,
    player_id,
    SUM(league_points_earned) AS total_points,
    MAX(total_played) AS tournaments_played,
    MAX(overall_best_position) AS best_position, -- 👈 Tomamos la mejor posición global
    MAX(total_final_tables) AS final_tables_count, -- 👈 Tomamos el conteo global de mesas finales
    now()
  FROM (
    SELECT 
      tr.player_id,
      tr.tournament_id,
      tr.league_points_earned,
      tr.position,
      -- Numeramos de mayor a menor puntaje
      ROW_NUMBER() OVER (
        PARTITION BY tr.player_id 
        ORDER BY tr.league_points_earned DESC, tr.position ASC
      ) as score_rank,
      
      -- Contamos el total absoluto jugado por este jugador
      COUNT(tr.tournament_id) OVER (
        PARTITION BY tr.player_id
      ) as total_played,
      
      -- Calculamos su mejor posición histórica en la liga
      MIN(tr.position) OVER (
        PARTITION BY tr.player_id
      ) as overall_best_position,
      
      -- 👈 NUEVO: Contamos cuántas veces llegó a Mesa Final (Posición 9 o mejor)
      SUM(CASE WHEN tr.position <= 9 THEN 1 ELSE 0 END) OVER (
        PARTITION BY tr.player_id
      ) as total_final_tables

    FROM tournament_results tr
    JOIN tournaments t ON t.id = tr.tournament_id
    WHERE t.league_id = p_league_id
  ) ranked_scores
  WHERE (v_best_dates IS NULL OR score_rank <= v_best_dates)
  GROUP BY player_id;

  -- Actualizamos la columna rank_position con las nuevas reglas de desempate
  WITH ranked_standings AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY 
          total_points DESC,         -- 1° Instancia: Mayor cantidad de puntos
          tournaments_played DESC,   -- 2° Instancia: Más participaciones
          best_position ASC,         -- 3° Instancia: Mejor resultado individual
          final_tables_count DESC    -- 4° Instancia: Más mesas finales
      ) as new_rank
    FROM league_standings
    WHERE league_id = p_league_id
  )
  UPDATE league_standings ls
  SET rank_position = rs.new_rank
  FROM ranked_standings rs
  WHERE ls.id = rs.id;

END;
$function$;

-- reset_tournament_impact(tournament_id_to_reset uuid) MD5 c3f34919450f15b5c92fe8e14bef7bb8
CREATE OR REPLACE FUNCTION public.reset_tournament_impact(tournament_id_to_reset uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    affected_player_ids UUID[];
    v_player_id UUID;
    v_current_elo DECIMAL;
    v_peak_elo DECIMAL;
    h RECORD;
    stats RECORD;
BEGIN
  IF NOT COALESCE((SELECT public.is_super_admin() OR public.is_club_admin(club_id) FROM public.tournaments WHERE id = tournament_id_to_reset), false) THEN RAISE EXCEPTION 'Acceso denegado a reiniciar torneo' USING ERRCODE='42501'; END IF;
    -- 1. Identificar a los jugadores afectados
    SELECT ARRAY_AGG(DISTINCT player_id) INTO affected_player_ids
    FROM tournament_results WHERE tournament_id = tournament_id_to_reset;

    -- 2. Limpiar historial y resultados SOLO de este torneo
    DELETE FROM elo_history WHERE tournament_id = tournament_id_to_reset;
    DELETE FROM tournament_results WHERE tournament_id = tournament_id_to_reset;

    -- 3. Reconstruir las estadísticas cronológicamente
    IF affected_player_ids IS NOT NULL THEN
        FOREACH v_player_id IN ARRAY affected_player_ids
        LOOP
            SELECT 
                COUNT(tr.id) as t, COUNT(CASE WHEN tr.prize_won > 0 THEN 1 END) as c,
                COUNT(CASE WHEN tr.position = 1 THEN 1 END) as w,
                SUM(COALESCE(tr.prize_won, 0) + COALESCE(tr.bounties_won, 0)) as prize,
                SUM(COALESCE(t.buy_in, 0)) as buyin
            INTO stats
            FROM tournament_results tr
            JOIN tournaments t ON tr.tournament_id = t.id
            WHERE tr.player_id = v_player_id AND t.status = 'completed';

            v_current_elo := 1200;
            v_peak_elo := 1200;

            FOR h IN SELECT elo_change FROM elo_history WHERE player_id = v_player_id ORDER BY id ASC 
            LOOP
                v_current_elo := v_current_elo + h.elo_change;
                v_peak_elo := GREATEST(v_peak_elo, v_current_elo);
            END LOOP;

            UPDATE players SET 
                total_tournaments = COALESCE(stats.t, 0),
                total_cashes = COALESCE(stats.c, 0),
                total_wins = COALESCE(stats.w, 0),
                total_prize_won = COALESCE(stats.prize, 0),
                total_buy_ins_spent = COALESCE(stats.buyin, 0),
                elo_rating = v_current_elo,
                elo_peak = v_peak_elo
            WHERE id = v_player_id;
        END LOOP;
    END IF;

    -- HEMOS ELIMINADO EL RECOLECTOR DE BASURA (evita el error de Foreign Key con React)
    -- HEMOS ELIMINADO EL CAMBIO A results_uploaded = false (evita que el modal se cierre)

    RETURN json_build_object('success', true);
END;
$function$;

-- update_league_standings(p_league_id uuid) MD5 28f8c81f6d7bec6a62486428d89a9052
CREATE OR REPLACE FUNCTION public.update_league_standings(p_league_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
begin

  -- Recalcular standings completos de la liga
  insert into league_standings (
    league_id,
    player_id,
    total_points,
    tournaments_played,
    best_position,
    rank_position,
    updated_at
  )
  select
    t.league_id,
    tr.player_id,
    coalesce(sum(tr.league_points_earned), 0) as total_points,
    count(tr.id) as tournaments_played,
    min(tr.position) as best_position,
    rank() over (
      order by coalesce(sum(tr.league_points_earned), 0) desc
    ) as rank_position,
    now()
  from tournament_results tr
  join tournaments t on t.id = tr.tournament_id
  where t.league_id = p_league_id
  group by t.league_id, tr.player_id

  -- 🔁 UPSERT (clave)
  on conflict (league_id, player_id)
  do update set
    total_points = excluded.total_points,
    tournaments_played = excluded.tournaments_played,
    best_position = excluded.best_position,
    rank_position = excluded.rank_position,
    updated_at = now();

end;
$function$;
