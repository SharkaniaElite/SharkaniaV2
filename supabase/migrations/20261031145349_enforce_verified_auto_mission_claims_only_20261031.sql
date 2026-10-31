-- Production-matched function. Only verified automatic missions can issue rewards.
CREATE OR REPLACE FUNCTION public.claim_auto_mission(p_mission_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_profile_id UUID;
  v_title TEXT;
  v_reward_xp INT;
  v_reward_coins INT;
  v_avatar TEXT;
  v_country TEXT;
  v_player_count INT;
BEGIN
  -- 1. Obtener quién está haciendo clic
  v_profile_id := auth.uid();
  IF v_profile_id IS NULL THEN 
    RAISE EXCEPTION 'No estás autenticado.'; 
  END IF;

  -- 2. Buscar qué misión es y cuánto paga
  SELECT title, reward_xp, reward_coins INTO v_title, v_reward_xp, v_reward_coins
  FROM public.gamification_missions 
  WHERE id = p_mission_id AND is_active = true AND validation_type = 'auto';

  -- Fail closed: only the two validated automatic missions may self-award.
  IF v_title IS NULL OR v_title NOT IN ('Identidad Confirmada', 'Bautizo de Fuego') THEN
    RAISE EXCEPTION 'Esta misión requiere revisión administrativa' USING ERRCODE = '42501';
  END IF;
  -- Serialize concurrent claims for the same user.
  PERFORM 1 FROM public.profiles WHERE id = v_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil no encontrado' USING ERRCODE = '42501'; END IF;
  -- 3. Evitar que cobren dos veces
  IF EXISTS (SELECT 1 FROM public.player_missions WHERE profile_id = v_profile_id AND mission_id = p_mission_id) THEN
    RAISE EXCEPTION 'Ya completaste esta misión.';
  END IF;

  -- 🎯 4. REGLAS DE VERIFICACIÓN AUTOMÁTICA
  IF v_title = 'Identidad Confirmada' THEN
    SELECT avatar_url, country_code INTO v_avatar, v_country FROM public.profiles WHERE id = v_profile_id;
    IF v_avatar IS NULL OR v_country IS NULL THEN 
      RAISE EXCEPTION 'Aún te falta subir tu foto de perfil o guardar tu país en Editar.'; 
    END IF;

  ELSIF v_title = 'Bautizo de Fuego' THEN
    SELECT COUNT(*) INTO v_player_count FROM public.players WHERE profile_id = v_profile_id;
    IF v_player_count = 0 THEN 
      RAISE EXCEPTION 'Aún no tienes ningún Nickname vinculado a tu cuenta.'; 
    END IF;
  END IF;

  -- 5. Todo en orden -> Marcamos como completada
  INSERT INTO public.player_missions (profile_id, mission_id, status, completed_at)
  VALUES (v_profile_id, p_mission_id, 'completed', NOW());

  -- 6. ¡Entregamos el Botín!
  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + v_reward_xp,
      shark_coins_balance = COALESCE(shark_coins_balance, 0) + v_reward_coins
  WHERE id = v_profile_id;

END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_auto_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_auto_mission(uuid) TO authenticated, service_role;
