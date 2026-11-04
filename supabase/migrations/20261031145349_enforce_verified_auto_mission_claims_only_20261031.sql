DO $protect_missions$
DECLARE
  definition text;
  target text;
BEGIN
  definition := replace(pg_get_functiondef('public.claim_auto_mission(uuid)'::regprocedure), E'\r\n', E'\n');
  IF position('WHERE id = p_mission_id AND is_active = true;' IN definition)=0 THEN
    RAISE EXCEPTION 'Cannot locate active mission validation; abort';
  END IF;
  IF position('AND validation_type = ''auto'';' IN definition)>0 THEN
    RAISE EXCEPTION 'Auto mission validation already patched; abort to avoid duplicate edits';
  END IF;
  target := replace(definition,
   'WHERE id = p_mission_id AND is_active = true;',
   'WHERE id = p_mission_id AND is_active = true AND validation_type = ''auto'';'
  );
  IF position('  -- 3. Evitar que cobren dos veces' IN target)=0 THEN
    RAISE EXCEPTION 'Cannot locate pre-award check; abort';
  END IF;
  target := replace(target,'  -- 3. Evitar que cobren dos veces',
    E'  -- Fail closed: only the two validated automatic missions may self-award.\n' ||
    E'  IF v_title IS NULL OR v_title NOT IN (''Identidad Confirmada'', ''Bautizo de Fuego'') THEN\n' ||
    E'    RAISE EXCEPTION ''Esta misión requiere revisión administrativa'' USING ERRCODE = ''42501'';\n' ||
    E'  END IF;\n' ||
    E'  -- Serialize concurrent claims for the same user.\n' ||
    E'  PERFORM 1 FROM public.profiles WHERE id = v_profile_id FOR UPDATE;\n' ||
    E'  IF NOT FOUND THEN RAISE EXCEPTION ''Perfil no encontrado'' USING ERRCODE = ''42501''; END IF;\n' ||
    E'  -- 3. Evitar que cobren dos veces');
  EXECUTE target;
END $protect_missions$;

REVOKE EXECUTE ON FUNCTION public.claim_auto_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_auto_mission(uuid) TO authenticated, service_role;