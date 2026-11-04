DO $security_patch$
DECLARE r record; original text; normalized text; patched text;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('public.academy_complete_lesson(uuid,uuid,jsonb)'::regprocedure, 'IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION ''Acceso denegado a lección'' USING ERRCODE=''42501''; END IF;
  IF EXISTS (SELECT 1 FROM public.academy_user_lessons WHERE user_id = p_user_id AND lesson_id = p_lesson_id AND quiz_passed = true) THEN RETURN json_build_object(''success'', false, ''error'', ''Lección ya completada''); END IF;'),
('public.academy_unlock_module(uuid,uuid)'::regprocedure, 'IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION ''Acceso denegado al módulo'' USING ERRCODE=''42501''; END IF;'),
('public.spend_credits(uuid,text)'::regprocedure, 'IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION ''Acceso denegado a la compra'' USING ERRCODE=''42501''; END IF;'),
('public.use_free_tool(uuid,text)'::regprocedure, 'IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION ''Acceso denegado a herramienta'' USING ERRCODE=''42501''; END IF;'),
('public.update_latin_onboarding(uuid,text,text)'::regprocedure, 'IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION ''Acceso denegado al perfil'' USING ERRCODE=''42501''; END IF;'),
('public.approve_mission(uuid)'::regprocedure, 'IF NOT (SELECT public.is_super_admin()) THEN RAISE EXCEPTION ''Acceso denegado a aprobar misiones'' USING ERRCODE=''42501''; END IF;'),
('public.queue_newsletter_emails(text,text)'::regprocedure, 'IF NOT (SELECT public.is_super_admin()) THEN RAISE EXCEPTION ''Acceso denegado a la cola de correos'' USING ERRCODE=''42501''; END IF;'),
('public.queue_newsletter_emails(text,text,text)'::regprocedure, 'IF NOT (SELECT public.is_super_admin()) THEN RAISE EXCEPTION ''Acceso denegado a la cola de correos'' USING ERRCODE=''42501''; END IF;'),
('public.queue_ignition_emails(text,text)'::regprocedure, 'IF NOT (SELECT public.is_super_admin()) THEN RAISE EXCEPTION ''Acceso denegado a correos Ignition'' USING ERRCODE=''42501''; END IF;'),
('public.bulk_delete_scheduled_tournaments(uuid[])'::regprocedure, 'IF EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = ANY(p_tournament_ids) AND NOT (public.is_super_admin() OR public.is_club_admin(t.club_id))) THEN RAISE EXCEPTION ''Acceso denegado a eliminar torneos'' USING ERRCODE=''42501''; END IF;'),
('public.delete_tournament_god_mode(uuid)'::regprocedure, 'IF NOT COALESCE((SELECT public.is_super_admin() OR public.is_club_admin(club_id) FROM public.tournaments WHERE id = tournament_id_to_delete), false) THEN RAISE EXCEPTION ''Acceso denegado a eliminar torneo'' USING ERRCODE=''42501''; END IF;'),
('public.reset_tournament_impact(uuid)'::regprocedure, 'IF NOT COALESCE((SELECT public.is_super_admin() OR public.is_club_admin(club_id) FROM public.tournaments WHERE id = tournament_id_to_reset), false) THEN RAISE EXCEPTION ''Acceso denegado a reiniciar torneo'' USING ERRCODE=''42501''; END IF;'),
('public.create_tournament_from_template(uuid,timestamptz,text,numeric,numeric)'::regprocedure, 'IF NOT COALESCE((SELECT public.is_super_admin() OR public.is_club_admin(club_id) FROM public.tournament_templates WHERE id = p_template_id), false) THEN RAISE EXCEPTION ''Acceso denegado a crear torneo'' USING ERRCODE=''42501''; END IF;'),
('public.generate_calendar_from_templates(uuid,integer)'::regprocedure, 'IF NOT (public.is_super_admin() OR public.is_club_admin(p_club_id)) THEN RAISE EXCEPTION ''Acceso denegado al calendario'' USING ERRCODE=''42501''; END IF;')) AS x(fn, guard_sql)
  LOOP
    original := pg_get_functiondef(r.fn);
    normalized := replace(original, E'\r\n', E'\n');
    IF strpos(normalized, E'\nBEGIN\n') = 0 THEN RAISE EXCEPTION 'No BEGIN in %',r.fn; END IF;
    IF strpos(normalized, 'Acceso denegado a') > 0 THEN RAISE EXCEPTION 'Already guarded %',r.fn; END IF;
    patched := replace(normalized,E'\nBEGIN\n',E'\nBEGIN\n  '||r.guard_sql||E'\n');
    EXECUTE patched;
    EXECUTE 'REVOKE EXECUTE ON FUNCTION '||r.fn||' FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION '||r.fn||' TO authenticated, service_role';
  END LOOP;
END
$security_patch$;
REVOKE EXECUTE ON FUNCTION public.claim_blog_reward(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_blog_reward(uuid,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_blog_reward(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_blog_reward(uuid,integer,integer) TO service_role;