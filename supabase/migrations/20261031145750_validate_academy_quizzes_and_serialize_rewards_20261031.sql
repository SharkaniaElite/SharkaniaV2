-- Preserve public academy mechanics but verify the quiz and module ownership on server.
-- Lock the profile row to prevent duplicate reward claims or parallel overspending.
CREATE OR REPLACE FUNCTION public.academy_complete_lesson(p_user_id uuid, p_lesson_id uuid, p_quiz_answers jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_lesson RECORD;
  v_module RECORD;
  v_xp INT;
  v_coins INT;
  v_all_lessons_complete BOOLEAN;
  v_streak RECORD;
  v_today DATE := CURRENT_DATE;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Acceso denegado a lección' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','user_not_found'); END IF;
  IF EXISTS (SELECT 1 FROM public.academy_user_lessons WHERE user_id = p_user_id AND lesson_id = p_lesson_id AND quiz_passed = true) THEN RETURN json_build_object('success', false, 'error', 'Lección ya completada'); END IF;
  -- Obtener datos de la lección
  SELECT l.*, m.id as mod_id, m.level, m.total_lessons
  INTO v_lesson
  FROM academy_lessons l
  JOIN academy_modules m ON m.id = l.module_id
  WHERE l.id = p_lesson_id;
  
  IF v_lesson IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Lección no encontrada');
  END IF;
  
  IF v_lesson.is_active IS DISTINCT FROM true THEN
    RETURN json_build_object('success',false,'error','lesson_inactive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.academy_modules m WHERE m.id=v_lesson.mod_id AND m.is_active=true
      AND (m.price_coins=0 OR EXISTS (SELECT 1 FROM public.academy_user_modules um
        WHERE um.user_id=p_user_id AND um.module_id=m.id))) THEN
    RETURN json_build_object('success',false,'error','module_locked');
  END IF;
  IF p_quiz_answers IS NULL OR jsonb_typeof(p_quiz_answers)<>'object'
     OR v_lesson.quiz IS NULL OR jsonb_typeof(v_lesson.quiz)<>'array'
     OR jsonb_array_length(v_lesson.quiz)=0 THEN
    RETURN json_build_object('success',false,'error','invalid_quiz');
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_quiz_answers))<>jsonb_array_length(v_lesson.quiz)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_lesson.quiz) WITH ORDINALITY q(question,idx)
       WHERE jsonb_typeof(p_quiz_answers->((q.idx-1)::text)) IS DISTINCT FROM 'number'
          OR (p_quiz_answers->>((q.idx-1)::text)) IS DISTINCT FROM (q.question->>'correct')) THEN
    RETURN json_build_object('success',false,'error','quiz_failed');
  END IF;
  v_xp := v_lesson.xp_reward;
  v_coins := v_lesson.coins_reward;
  
  -- Registrar o actualizar progreso
  INSERT INTO academy_user_lessons (user_id, lesson_id, quiz_passed, quiz_attempts, quiz_last_answers, completed_at, xp_earned, coins_earned)
  VALUES (p_user_id, p_lesson_id, true, 1, p_quiz_answers, now(), v_xp, v_coins)
  ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    quiz_passed = true,
    quiz_attempts = academy_user_lessons.quiz_attempts + 1,
    quiz_last_answers = p_quiz_answers,
    completed_at = COALESCE(academy_user_lessons.completed_at, now()),
    xp_earned = v_xp,
    coins_earned = v_coins;
  
  -- Dar XP y coins al perfil del usuario
  UPDATE profiles SET
    xp = xp + v_xp,
    shark_coins_balance = shark_coins_balance + v_coins
  WHERE id = p_user_id;
  
  -- Actualizar streak
  INSERT INTO academy_study_streaks (user_id, current_streak, longest_streak, last_study_date, total_lessons_completed, total_xp_earned)
  VALUES (p_user_id, 1, 1, v_today, 1, v_xp)
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = CASE
      WHEN academy_study_streaks.last_study_date = v_today - 1 THEN academy_study_streaks.current_streak + 1
      WHEN academy_study_streaks.last_study_date = v_today THEN academy_study_streaks.current_streak
      ELSE 1
    END,
    longest_streak = GREATEST(
      academy_study_streaks.longest_streak,
      CASE
        WHEN academy_study_streaks.last_study_date = v_today - 1 THEN academy_study_streaks.current_streak + 1
        WHEN academy_study_streaks.last_study_date = v_today THEN academy_study_streaks.current_streak
        ELSE 1
      END
    ),
    last_study_date = v_today,
    total_lessons_completed = academy_study_streaks.total_lessons_completed + 1,
    total_xp_earned = academy_study_streaks.total_xp_earned + v_xp,
    updated_at = now();
  
  -- Verificar si completó TODAS las lecciones del módulo
  SELECT NOT EXISTS (
    SELECT 1 FROM academy_lessons al
    WHERE al.module_id = v_lesson.mod_id
    AND al.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM academy_user_lessons aul
      WHERE aul.lesson_id = al.id
      AND aul.user_id = p_user_id
      AND aul.quiz_passed = true
    )
  ) INTO v_all_lessons_complete;
  
  -- Si completó todo el módulo, marcarlo
  IF v_all_lessons_complete THEN
    UPDATE academy_user_modules
    SET completed_at = now()
    WHERE user_id = p_user_id AND module_id = v_lesson.mod_id;
  END IF;
  
  -- Obtener streak actualizado
  SELECT * INTO v_streak FROM academy_study_streaks WHERE user_id = p_user_id;
  
  RETURN json_build_object(
    'success', true,
    'xp_earned', v_xp,
    'coins_earned', v_coins,
    'module_completed', v_all_lessons_complete,
    'current_streak', v_streak.current_streak,
    'longest_streak', v_streak.longest_streak,
    'total_completed', v_streak.total_lessons_completed
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.academy_unlock_module(p_user_id uuid, p_module_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_module RECORD;
  v_balance INT;
  v_already_unlocked BOOLEAN;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Acceso denegado al módulo' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','user_not_found'); END IF;
  -- Obtener módulo
  SELECT * INTO v_module FROM academy_modules WHERE id = p_module_id;
  IF v_module.is_active IS DISTINCT FROM true THEN
    RETURN json_build_object('success',false,'error','module_inactive');
  END IF;
  IF v_module IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Módulo no encontrado');
  END IF;
  
  -- Si es gratis, desbloquear directamente
  IF v_module.price_coins = 0 THEN
    INSERT INTO academy_user_modules (user_id, module_id)
    VALUES (p_user_id, p_module_id)
    ON CONFLICT (user_id, module_id) DO NOTHING;
    RETURN json_build_object('success', true, 'coins_spent', 0);
  END IF;
  
  -- Verificar si ya está desbloqueado
  SELECT EXISTS (
    SELECT 1 FROM academy_user_modules WHERE user_id = p_user_id AND module_id = p_module_id
  ) INTO v_already_unlocked;
  
  IF v_already_unlocked THEN
    RETURN json_build_object('success', false, 'error', 'Módulo ya desbloqueado');
  END IF;
  
  -- Verificar balance
  SELECT shark_coins_balance INTO v_balance FROM profiles WHERE id = p_user_id;
  IF v_balance < v_module.price_coins THEN
    RETURN json_build_object('success', false, 'error', 'Shark Coins insuficientes', 'needed', v_module.price_coins, 'balance', v_balance);
  END IF;
  
  -- Cobrar coins
  UPDATE profiles SET shark_coins_balance = shark_coins_balance - v_module.price_coins WHERE id = p_user_id;
  
  -- Registrar transacción
  INSERT INTO credit_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
  VALUES (p_user_id, -v_module.price_coins, 'spend', 'academy_module', p_module_id, 'Desbloqueo: ' || v_module.title);
  
  -- Desbloquear
  INSERT INTO academy_user_modules (user_id, module_id)
  VALUES (p_user_id, p_module_id);
  
  RETURN json_build_object('success', true, 'coins_spent', v_module.price_coins);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_mission(p_player_mission_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_profile_id UUID;
  v_reward_xp INT;
  v_reward_coins INT;
BEGIN
  IF NOT (SELECT public.is_super_admin()) THEN RAISE EXCEPTION 'Acceso denegado a aprobar misiones' USING ERRCODE='42501'; END IF;
  -- 1. Buscamos de quién es la misión y cuánto paga
  SELECT pm.profile_id, gm.reward_xp, gm.reward_coins
  INTO v_profile_id, v_reward_xp, v_reward_coins
  FROM public.player_missions pm
  JOIN public.gamification_missions gm ON pm.mission_id = gm.id
  WHERE pm.id = p_player_mission_id AND pm.status = 'pending';

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Misión no encontrada o ya procesada';
  END IF;

  -- 2. Marcamos la misión como completada
  UPDATE public.player_missions
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_player_mission_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Misión ya aprobada o rechazada' USING ERRCODE='42501'; END IF;

  -- 3. Le depositamos el botín al jugador
  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + v_reward_xp,
      shark_coins_balance = COALESCE(shark_coins_balance, 0) + v_reward_coins
  WHERE id = v_profile_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.academy_complete_lesson(uuid,uuid,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.academy_unlock_module(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_complete_lesson(uuid,uuid,jsonb) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.academy_unlock_module(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.approve_mission(uuid) TO authenticated,service_role;
