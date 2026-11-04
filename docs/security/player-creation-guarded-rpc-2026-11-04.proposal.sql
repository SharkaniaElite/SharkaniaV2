-- SHARKANIA / propuesta QA de alta de jugadores para torneos.
-- NO MIGRACION. NO EJECUTAR EN PRODUCCION SIN CUTOVER DE FRONTEND Y APROBACION.
-- Esta funcion fue probada solo dentro de BEGIN ... ROLLBACK en Supabase local.
CREATE OR REPLACE FUNCTION public.ensure_tournament_player_guarded(
  p_tournament_id uuid,
  p_nickname text,
  p_country_code text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_name text := NULLIF(btrim(p_nickname), '');
  v_country text := NULLIF(upper(btrim(p_country_code)), '');
  v_room uuid;
  v_club uuid;
  v_player uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF v_name IS NULL OR length(v_name) < 2 OR length(v_name) > 80 THEN
    RAISE EXCEPTION 'Invalid player nickname' USING ERRCODE = '22023';
  END IF;
  IF v_country IS NOT NULL AND
     (length(v_country) <> 2 OR v_country !~ '^[A-Z]{2}$') THEN
    RAISE EXCEPTION 'Invalid country code' USING ERRCODE = '22023';
  END IF;

  SELECT t.room_id, t.club_id INTO v_room, v_club
  FROM public.tournaments t
  WHERE t.id = p_tournament_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tournament not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(v_club))) THEN
    RAISE EXCEPTION 'Club administration required' USING ERRCODE = '42501';
  END IF;

  -- Bloqueo transaccional por nombre/sala para no duplicar altas concurrentes.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_room::text || ':' || lower(v_name), 0)
  );
  SELECT p.id INTO v_player
  FROM public.players p
  WHERE p.room_id = v_room AND lower(p.nickname) = lower(v_name)
  ORDER BY p.created_at, p.id LIMIT 1;
  IF FOUND THEN
    RETURN v_player;
  END IF;

  -- Nunca aceptar ELO, premios, perfil vinculado o recuentos del cliente.
  INSERT INTO public.players (nickname, room_id, country_code)
  VALUES (v_name, v_room, v_country)
  RETURNING id INTO v_player;
  RETURN v_player;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_tournament_player_guarded(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_tournament_player_guarded(uuid,text,text)
  TO authenticated;
