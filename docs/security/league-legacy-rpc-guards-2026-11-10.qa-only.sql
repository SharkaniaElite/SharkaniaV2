-- QA candidate only. This SQL replaces legacy functions, NEVER execute in production as-is.
-- Reconcile with guarded Release A and obtain owner approval before any live cutover.
BEGIN;
DO $source_preflight$
DECLARE v record; v_current text; v_exec bool;
BEGIN
 FOR v IN SELECT * FROM (VALUES
    ('bulk_delete_scheduled_tournaments','p_tournament_ids uuid[]','98217e0c3792f81349d63428dd0b37ac'),
    ('delete_tournament_god_mode','tournament_id_to_delete uuid','bcfbc09bd9a8c1726afabb36135b2bb7'),
    ('recalculate_league_standings','p_league_id uuid','b1cef8db810f7ab06b3cffe06daf0f0a'),
    ('reset_tournament_impact','tournament_id_to_reset uuid','c3f34919450f15b5c92fe8e14bef7bb8'),
    ('update_league_standings','p_league_id uuid','28f8c81f6d7bec6a62486428d89a9052')
 ) AS expected(function_name,identity_arguments,hash_md5)
 LOOP
   SELECT pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)),
          pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
     INTO v_current,v_exec
   FROM pg_catalog.pg_proc p
   WHERE p.pronamespace='public'::regnamespace
     AND p.proname=v.function_name
     AND pg_catalog.pg_get_function_identity_arguments(p.oid)=v.identity_arguments;
   IF v_current IS DISTINCT FROM v.hash_md5 OR v_exec IS DISTINCT FROM true THEN
     RAISE EXCEPTION 'Legacy RPC catalog drift: % (%)',v.function_name,v.identity_arguments USING ERRCODE='PT409';
   END IF;
 END LOOP;
END;
$source_preflight$;


-- Old RPCs keep their existing auth checks. These internal helpers are
-- called immediately AFTER that check and BEFORE any DELETE or ELO rebuild.
CREATE OR REPLACE FUNCTION public.sharkania_guard_legacy_single_nonleague_qa(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guard$
DECLARE v_league uuid; v_club uuid;
BEGIN
 SELECT t.league_id,t.club_id INTO v_league,v_club
 FROM public.tournaments t WHERE t.id=p_tournament_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF NOT ((SELECT public.is_super_admin()) OR (SELECT public.is_club_admin(v_club))) THEN
   RAISE EXCEPTION 'Not authorized for tournament' USING ERRCODE='42501';
 END IF;
 IF v_league IS NOT NULL THEN
   RAISE EXCEPTION 'Legacy mutation of linked league tournament forbidden' USING ERRCODE='PT409';
 END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.sharkania_guard_legacy_bulk_nonleague_qa(p_tournament_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guard$
DECLARE r record;
BEGIN
 FOR r IN
  SELECT t.id,t.league_id,t.club_id FROM public.tournaments t
  WHERE t.id=ANY(p_tournament_ids) ORDER BY t.id FOR UPDATE
 LOOP
  IF NOT ((SELECT public.is_super_admin()) OR (SELECT public.is_club_admin(r.club_id))) THEN
    RAISE EXCEPTION 'Not authorized for tournament' USING ERRCODE='42501';
  END IF;
  IF r.league_id IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy bulk mutation of linked league tournaments forbidden' USING ERRCODE='PT409';
  END IF;
 END LOOP;
END;
$guard$;
REVOKE ALL ON FUNCTION public.sharkania_guard_legacy_single_nonleague_qa(uuid),
 public.sharkania_guard_legacy_bulk_nonleague_qa(uuid[]) FROM PUBLIC,anon,authenticated;

-- bulk_delete_scheduled_tournaments: preserve production body + one fail-closed invocation.
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
  PERFORM public.sharkania_guard_legacy_bulk_nonleague_qa(p_tournament_ids);
  DELETE FROM tournaments
  WHERE id = ANY(p_tournament_ids)
  AND status = 'scheduled'
  AND results_uploaded = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- delete_tournament_god_mode: preserve production body + one fail-closed invocation.
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
    PERFORM public.sharkania_guard_legacy_single_nonleague_qa(tournament_id_to_delete);
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

-- reset_tournament_impact: preserve production body + one fail-closed invocation.
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
    PERFORM public.sharkania_guard_legacy_single_nonleague_qa(tournament_id_to_reset);
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

-- Legacy ranking entry points are replaced by guarded standings RPCs;
-- do not let PostgREST clients call mutable, currency-unaware recalc.
REVOKE EXECUTE ON FUNCTION public.recalculate_league_standings(uuid),
 public.update_league_standings(uuid) FROM PUBLIC,anon,authenticated;
COMMIT;
