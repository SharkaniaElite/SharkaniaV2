-- SHARKANIA - optional automated league welcome. Initially OFF: no messages are queued.
-- No existing account is added to the automatic campaign upon activation.
-- Reuses email_queue unique (campaign_key, recipient_user_id) for idempotency.

CREATE TABLE IF NOT EXISTS private.ignition_auto_welcome_settings (
  setting_id integer PRIMARY KEY CHECK (setting_id = 1),
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.ignition_auto_welcome_settings FROM PUBLIC, anon, authenticated;
INSERT INTO private.ignition_auto_welcome_settings(setting_id,enabled,subject,body_text)
VALUES(1,false,'','') ON CONFLICT(setting_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_ignition_auto_welcome_settings()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object('enabled',enabled, 'subject',subject,
    'body_text',body_text, 'enabled_at',enabled_at, 'updated_at',updated_at)
  INTO v FROM private.ignition_auto_welcome_settings WHERE setting_id=1;
  RETURN COALESCE(v,'{"enabled":false,"subject":"","body_text":""}'::jsonb);
END
$function$;

CREATE OR REPLACE FUNCTION public.save_ignition_auto_welcome_settings(
  p_enabled boolean, p_subject text, p_body_text text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_previous boolean; v_enabled_at timestamptz;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501';
  END IF;
  IF p_enabled IS NULL OR p_subject IS NULL OR p_body_text IS NULL THEN
    RAISE EXCEPTION 'Configuración incompleta';
  END IF;
  IF length(p_subject)>180 OR length(p_body_text)>7000 THEN
    RAISE EXCEPTION 'El texto excede los límites admitidos';
  END IF;
  IF p_enabled THEN
    IF length(btrim(p_subject))<6 OR length(btrim(p_body_text))<80 THEN
      RAISE EXCEPTION 'Escribe un mensaje de bienvenida completo antes de activar';
    END IF;
    IF p_subject ~ '[\r\n]' OR p_body_text ~* '\[(COMPLETAR|CLAVE|CONTRASEÑA)[^\]]*\]' THEN
      RAISE EXCEPTION 'Reemplaza las contraseñas de ejemplo y revisa el asunto';
    END IF;
    IF (now() AT TIME ZONE 'America/Santiago')::date > DATE '2026-11-26' THEN
      RAISE EXCEPTION 'La campaña de noviembre finalizó';
    END IF;
  END IF;

  SELECT enabled,enabled_at INTO v_previous,v_enabled_at
  FROM private.ignition_auto_welcome_settings WHERE setting_id=1 FOR UPDATE;

  UPDATE private.ignition_auto_welcome_settings
  SET enabled=p_enabled, subject=btrim(p_subject), body_text=p_body_text,
      enabled_at=CASE WHEN p_enabled THEN
        CASE WHEN v_previous IS TRUE THEN v_enabled_at ELSE now() END
        ELSE NULL END,
      updated_at=now()
  WHERE setting_id=1;

  RETURN jsonb_build_object('enabled',p_enabled,
    'starts_for_new_links_only',true,
    'enabled_at',(SELECT enabled_at FROM private.ignition_auto_welcome_settings WHERE setting_id=1));
END
$function$;

-- Manual validation by a super-admin, never by user-supplied metadata.
CREATE OR REPLACE FUNCTION public.verify_ignition_pending_player(
  p_player_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_nick text; v_status text; v_confirmed timestamptz;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501';
  END IF;
  IF p_player_id IS NULL THEN RAISE EXCEPTION 'Jugador inválido'; END IF;
  SELECT p.ignition_nickname,p.ignition_status,u.email_confirmed_at
  INTO v_nick,v_status,v_confirmed
  FROM public.profiles p JOIN auth.users u ON u.id=p.id
  WHERE p.id=p_player_id AND p.ignition_league_player IS TRUE FOR UPDATE OF p;

  IF v_status IS NULL OR v_status <> 'pending' OR btrim(COALESCE(v_nick,''))='' THEN
    RAISE EXCEPTION 'La solicitud no está pendiente o está incompleta';
  END IF;
  IF v_confirmed IS NULL THEN
    RAISE EXCEPTION 'El jugador debe confirmar su email antes de validar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id <> p_player_id AND p.ignition_status='verified'
      AND lower(btrim(COALESCE(p.ignition_nickname,'')))=lower(btrim(v_nick))
  ) THEN
    RAISE EXCEPTION 'El nickname ya está verificado en otra cuenta';
  END IF;
  UPDATE public.profiles SET ignition_status='verified' WHERE id=p_player_id;
  RETURN true;
END
$function$;

-- Executed by the database Cron role. This function is not callable by users.
-- First verifies the admin-enabled template and limits scope to links made
-- AFTER activation. Older linked accounts are never auto-enrolled.
CREATE OR REPLACE FUNCTION private.enqueue_ignition_auto_welcome()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_enabled boolean; v_enabled_at timestamptz;
        v_subject text; v_template text; v_count integer := 0;
BEGIN
  SELECT enabled, enabled_at, subject, body_text
  INTO v_enabled, v_enabled_at, v_subject, v_template
  FROM private.ignition_auto_welcome_settings WHERE setting_id=1;
  IF v_enabled IS DISTINCT FROM TRUE OR v_enabled_at IS NULL
     OR length(COALESCE(v_template,''))<80
     OR (now() AT TIME ZONE 'America/Santiago')::date > DATE '2026-11-26' THEN
    RETURN 0;
  END IF;

  INSERT INTO public.email_queue(
    campaign_key, recipient_user_id, recipient_email, subject, body_text, body_html,status
  )
  SELECT 'ignition-2026-11-welcome',p.id,u.email,v_subject,
    replace(v_template,'{{nickname}}',
      COALESCE(NULLIF(p.display_name,''),NULLIF(p.ignition_nickname,''),'Jugador')),
    '<!doctype html><html><body style="margin:0;padding:24px;background:#09131e;color:#edf7ff;font-family:Arial,sans-serif;">'
    || '<div style="max-width:620px;margin:auto;background:#122333;border:1px solid #27536b;border-radius:12px;">'
    || '<h1 style="margin:0;padding:24px;color:#69dce9;">SHARKANIA</h1>'
    || '<div style="padding:18px 24px;line-height:1.7;">'
    || replace(replace(replace(replace(
      replace(v_template,'{{nickname}}',COALESCE(NULLIF(p.display_name,''),NULLIF(p.ignition_nickname,''),'Jugador')),
      '&','&amp;'),'<','&lt;'),'>','&gt;'),E'\n','<br>')
    || '</div><div style="padding:18px 24px;font-size:12px;border-top:1px solid #27536b;color:#aec5d0;">'
    || '<a href="https://sharkania.com" style="color:#69dce9;">SHARKANIA</a></div></div></body></html>',
    'pending'
  FROM public.profiles p JOIN auth.users u ON u.id=p.id
  WHERE p.ignition_league_player IS TRUE AND p.ignition_status='verified'
    AND p.ignition_linked_at IS NOT NULL
    AND p.ignition_linked_at>=v_enabled_at
    AND u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL AND btrim(u.email)<>''
  ON CONFLICT(campaign_key,recipient_user_id)
    WHERE campaign_key IS NOT NULL AND recipient_user_id IS NOT NULL DO NOTHING;

  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END
$function$;

REVOKE ALL ON FUNCTION public.get_ignition_auto_welcome_settings() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_ignition_auto_welcome_settings(boolean,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.verify_ignition_pending_player(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.enqueue_ignition_auto_welcome() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_ignition_auto_welcome_settings() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_ignition_auto_welcome_settings(boolean,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.verify_ignition_pending_player(uuid) TO authenticated,service_role;

DO $job$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='sharkania_ignition_auto_welcome_2026_11') THEN
    PERFORM cron.schedule(
      'sharkania_ignition_auto_welcome_2026_11',
      '*/5 * * * *',
      'SELECT private.enqueue_ignition_auto_welcome()'
    );
  END IF;
END
$job$;
