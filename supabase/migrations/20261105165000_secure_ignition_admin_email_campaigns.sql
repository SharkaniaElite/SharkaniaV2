-- SHARKANIA: administrative-only, per-campaign Ignition queue.
-- Does not send any messages and does not modify existing email records.
-- The Worker continues processing public.email_queue every 10 minutes.
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS campaign_key text,
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS email_queue_campaign_recipient_unique
  ON public.email_queue (campaign_key, recipient_user_id)
  WHERE campaign_key IS NOT NULL AND recipient_user_id IS NOT NULL;

-- This protected function replaces browser INSERT + protected profile UPDATE.
-- Only a legitimate super-admin can enqueue, with a selected and eligible
-- player list; the recipient is the confirmed Sharkania account email.
CREATE OR REPLACE FUNCTION public.queue_ignition_selected_campaign(
  p_campaign_key text, p_user_ids uuid[], p_subject text, p_body_text text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_selected integer;
  v_eligible integer;
  v_inserted integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acceso denegado a envíos de Ignition' USING ERRCODE = '42501';
  END IF;
  IF p_campaign_key IS NULL OR
     p_campaign_key !~ '^ignition-[0-9]{4}-[0-9]{2}-(welcome|[0-3][0-9])$' THEN
    RAISE EXCEPTION 'Selecciona una campaña válida';
  END IF;
  IF p_user_ids IS NULL OR cardinality(p_user_ids) NOT BETWEEN 1 AND 250
     OR array_position(p_user_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Selecciona entre 1 y 250 jugadores';
  END IF;
  IF p_subject IS NULL OR length(btrim(p_subject)) NOT BETWEEN 6 AND 180
     OR p_subject ~ '[\r\n]' THEN
    RAISE EXCEPTION 'Asunto inválido';
  END IF;
  IF p_body_text IS NULL OR length(btrim(p_body_text)) NOT BETWEEN 10 AND 7000 THEN
    RAISE EXCEPTION 'Escribe un mensaje entre 10 y 7000 caracteres';
  END IF;

  SELECT count(*) INTO v_selected FROM (SELECT DISTINCT unnest(p_user_ids) AS id) ids;

  SELECT count(*) INTO v_eligible
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id = ANY(p_user_ids)
      AND p.ignition_league_player IS TRUE
      AND p.ignition_status = 'verified'
      AND u.email_confirmed_at IS NOT NULL
      AND u.email IS NOT NULL AND btrim(u.email) <> '';

  INSERT INTO public.email_queue (
    campaign_key, recipient_user_id, recipient_email,
    subject, body_text, body_html, status
  )
  SELECT
    p_campaign_key,
    p.id,
    u.email,
    btrim(p_subject),
    replace(p_body_text, '{{nickname}}', COALESCE(NULLIF(p.display_name,''),NULLIF(p.ignition_nickname,''),'Jugador')),
    '<!doctype html><html><body style="margin:0;padding:22px;background:#0a111b;color:#e5edf5;font-family:Arial,sans-serif;">'
    || '<div style="margin:auto;max-width:620px;border:1px solid #214054;border-radius:14px;overflow:hidden;background:#101c2a;">'
    || '<div style="padding:24px;background:#0c2535;color:#66d9ef;"><strong>SHARKANIA</strong></div>'
    || '<div style="padding:28px;font-size:16px;line-height:1.65;white-space:normal;">'
    || replace(replace(replace(replace(
         replace(p_body_text, '{{nickname}}', COALESCE(NULLIF(p.display_name,''),NULLIF(p.ignition_nickname,''),'Jugador')),
         '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\n', '<br>')
    || '</div><div style="padding:22px 28px;border-top:1px solid #214054;font-size:12px;color:#a5b8c4;">'
    || 'Comunicaciones para participantes vinculados a SHARKANIA. '
    || '<a href="https://sharkania.com" style="color:#66d9ef;">sharkania.com</a></div></div></body></html>',
    'pending'
  FROM public.profiles p
  JOIN auth.users u ON u.id=p.id
  WHERE p.id = ANY(p_user_ids)
    AND p.ignition_league_player IS TRUE
    AND p.ignition_status = 'verified'
    AND u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL AND btrim(u.email) <> ''
  ON CONFLICT (campaign_key, recipient_user_id)
     WHERE campaign_key IS NOT NULL AND recipient_user_id IS NOT NULL
     DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN jsonb_build_object(
    'queued', v_inserted,
    'eligible', v_eligible,
    'already_prepared', v_eligible-v_inserted,
    'excluded', v_selected-v_eligible
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.ignition_campaign_recipients(
  p_campaign_key text
) RETURNS TABLE(player_id uuid, eligible boolean, queue_status text, sent_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501';
  END IF;
  IF p_campaign_key IS NULL OR
     p_campaign_key !~ '^ignition-[0-9]{4}-[0-9]{2}-(welcome|[0-3][0-9])$' THEN
    RAISE EXCEPTION 'Campaña inválida';
  END IF;
  RETURN QUERY
    SELECT p.id,
      (p.ignition_status='verified' AND u.email_confirmed_at IS NOT NULL
       AND u.email IS NOT NULL AND btrim(u.email)<>'') AS eligible,
      COALESCE(q.status,
        CASE WHEN p.ignition_status='verified' AND u.email_confirmed_at IS NOT NULL
             THEN 'not_queued' ELSE 'ineligible' END) AS queue_status,
      q.sent_at
    FROM public.profiles p
    JOIN auth.users u ON u.id=p.id
    LEFT JOIN public.email_queue q ON q.recipient_user_id=p.id AND q.campaign_key=p_campaign_key
    WHERE p.ignition_league_player IS TRUE
    ORDER BY p.ignition_linked_at DESC NULLS LAST;
END;
$function$;

-- Explicit retry: never create another row for the same date and player.
CREATE OR REPLACE FUNCTION public.retry_ignition_failed_campaign(
  p_campaign_key text, p_user_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501';
  END IF;
  IF p_campaign_key IS NULL OR
     p_campaign_key !~ '^ignition-[0-9]{4}-[0-9]{2}-(welcome|[0-3][0-9])$' THEN
    RAISE EXCEPTION 'Campaña inválida';
  END IF;
  IF p_user_ids IS NULL OR cardinality(p_user_ids) NOT BETWEEN 1 AND 250
     OR array_position(p_user_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Selección inválida';
  END IF;
  UPDATE public.email_queue q
    SET status='pending', error_log=NULL, sent_at=NULL
    WHERE q.campaign_key=p_campaign_key
      AND q.recipient_user_id=ANY(p_user_ids)
      AND q.status='failed'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN auth.users u ON u.id=p.id
        WHERE p.id=q.recipient_user_id
          AND p.ignition_league_player IS TRUE
          AND p.ignition_status='verified'
          AND u.email_confirmed_at IS NOT NULL
      );
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- SECURITY DEFINER functions are not public entry points.
REVOKE EXECUTE ON FUNCTION public.queue_ignition_selected_campaign(text,uuid[],text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ignition_campaign_recipients(text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.retry_ignition_failed_campaign(text,uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_ignition_selected_campaign(text,uuid[],text,text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ignition_campaign_recipients(text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.retry_ignition_failed_campaign(text,uuid[])
  TO authenticated, service_role;
