
DO $safe_privileged_rewards$
DECLARE
  f text;
  original text;
  marker text;
BEGIN
  f := replace(pg_get_functiondef('public.academy_complete_lesson(uuid,uuid,jsonb)'::regprocedure), E'\r\n', E'\n');
  marker := '  IF EXISTS (SELECT 1 FROM public.academy_user_lessons WHERE user_id = p_user_id AND lesson_id = p_lesson_id AND quiz_passed = true)';
  IF position(marker IN f)=0 THEN RAISE EXCEPTION 'Academy guard anchor missing'; END IF;
  f := replace(f, marker,
    E'  PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;\n' ||
    E'  IF NOT FOUND THEN RETURN json_build_object(''success'',false,''error'',''user_not_found''); END IF;\n' ||
    marker);

  marker := '  v_xp := v_lesson.xp_reward;';
  IF position(marker IN f)=0 THEN RAISE EXCEPTION 'Academy reward anchor missing'; END IF;
  f := replace(f, marker,
    E'  IF v_lesson.is_active IS DISTINCT FROM true THEN\n' ||
    E'    RETURN json_build_object(''success'',false,''error'',''lesson_inactive'');\n' ||
    E'  END IF;\n' ||
    E'  IF NOT EXISTS (SELECT 1 FROM public.academy_modules m WHERE m.id=v_lesson.mod_id AND m.is_active=true\n' ||
    E'      AND (m.price_coins=0 OR EXISTS (SELECT 1 FROM public.academy_user_modules um\n' ||
    E'        WHERE um.user_id=p_user_id AND um.module_id=m.id))) THEN\n' ||
    E'    RETURN json_build_object(''success'',false,''error'',''module_locked'');\n' ||
    E'  END IF;\n' ||
    E'  IF p_quiz_answers IS NULL OR jsonb_typeof(p_quiz_answers)<>''object''\n' ||
    E'     OR v_lesson.quiz IS NULL OR jsonb_typeof(v_lesson.quiz)<>''array''\n' ||
    E'     OR jsonb_array_length(v_lesson.quiz)=0 THEN\n' ||
    E'    RETURN json_build_object(''success'',false,''error'',''invalid_quiz'');\n' ||
    E'  END IF;\n' ||
    E'  IF (SELECT count(*) FROM jsonb_object_keys(p_quiz_answers))<>jsonb_array_length(v_lesson.quiz)\n' ||
    E'     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_lesson.quiz) WITH ORDINALITY q(question,idx)\n' ||
    E'       WHERE jsonb_typeof(p_quiz_answers->((q.idx-1)::text)) IS DISTINCT FROM ''number''\n' ||
    E'          OR (p_quiz_answers->>((q.idx-1)::text)) IS DISTINCT FROM (q.question->>''correct'')) THEN\n' ||
    E'    RETURN json_build_object(''success'',false,''error'',''quiz_failed'');\n' ||
    E'  END IF;\n' ||
    marker);
  EXECUTE f;

  f := replace(pg_get_functiondef('public.academy_unlock_module(uuid,uuid)'::regprocedure), E'\r\n', E'\n');
  marker := '  -- Obtener módulo';
  IF position(marker IN f)=0 THEN RAISE EXCEPTION 'Unlock guard anchor missing'; END IF;
  f := replace(f,marker,
    E'  PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;\n' ||
    E'  IF NOT FOUND THEN RETURN json_build_object(''success'',false,''error'',''user_not_found''); END IF;\n' ||
    marker);
  marker := '  IF v_module IS NULL THEN';
  IF position(marker IN f)=0 THEN RAISE EXCEPTION 'Unlock module read anchor missing'; END IF;
  f := replace(f,marker,
    E'  IF v_module.is_active IS DISTINCT FROM true THEN\n' ||
    E'    RETURN json_build_object(''success'',false,''error'',''module_inactive'');\n' ||
    E'  END IF;\n' ||
    marker);
  EXECUTE f;

  f := replace(pg_get_functiondef('public.approve_mission(uuid)'::regprocedure), E'\r\n', E'\n');
  marker := '  WHERE id = p_player_mission_id;';
  IF position(marker IN f)=0 THEN RAISE EXCEPTION 'Mission approval anchor missing'; END IF;
  f := replace(f, marker,
    E'  WHERE id = p_player_mission_id AND status = ''pending'';\n' ||
    E'  IF NOT FOUND THEN RAISE EXCEPTION ''Misión ya aprobada o rechazada'' USING ERRCODE=''42501''; END IF;');
  EXECUTE f;
END $safe_privileged_rewards$;