DO $patch$ DECLARE r record; f text; t text; BEGIN
FOR r IN SELECT * FROM (VALUES ('public.create_club_registration_request(uuid,text,text,text,text)'::regprocedure,'IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION ''Acceso denegado al registro de club'' USING ERRCODE=''42501''; END IF;'),('public.check_ignition_duplicate(text,text,uuid)'::regprocedure,'IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION ''Inicio de sesión requerido'' USING ERRCODE=''42501''; END IF;
  IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM (SELECT auth.uid()) THEN RAISE EXCEPTION ''Acceso denegado a consulta de Ignition'' USING ERRCODE=''42501''; END IF;'),('public.get_user_active_features(uuid)'::regprocedure,'IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION ''Acceso denegado a información de compras'' USING ERRCODE=''42501''; END IF;')) v(fn,guard_sql) LOOP
  f := replace(pg_get_functiondef(r.fn),E'\r\n',E'\n');
  IF strpos(f,E'\nBEGIN\n')=0 THEN RAISE EXCEPTION 'missing BEGIN %',r.fn; END IF;
  IF strpos(f,'Acceso denegado a')>0 THEN RAISE EXCEPTION 'already patched %',r.fn; END IF;
  t := replace(f,E'\nBEGIN\n',E'\nBEGIN\n'||r.guard_sql||E'\n');
  EXECUTE t;
  EXECUTE 'REVOKE EXECUTE ON FUNCTION '||r.fn||' FROM PUBLIC,anon,authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION '||r.fn||' TO authenticated,service_role';
END LOOP; END $patch$;
REVOKE EXECUTE ON FUNCTION public.claim_auto_mission(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_auto_mission(uuid) TO authenticated,service_role;