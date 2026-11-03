DROP POLICY IF EXISTS "Usuarios pueden insertar en la cola" ON public.email_queue;
REVOKE INSERT ON TABLE public.email_queue FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.queue_club_registration_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
DECLARE v_recipient text;
BEGIN
  -- Limit to one confirmation per user per 24 hours.
  IF EXISTS (
    SELECT 1 FROM public.club_registration_requests r
    WHERE r.user_id = NEW.user_id AND r.id <> NEW.id
      AND r.created_at > now() - interval '24 hours'
      AND r.created_at <= NEW.created_at
  ) THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_recipient
  FROM auth.users WHERE id = NEW.user_id;

  IF v_recipient IS NOT NULL AND position('@' IN v_recipient) > 1 THEN
    INSERT INTO public.email_queue (
      recipient_email, subject, body_html, status
    ) VALUES (
      v_recipient,
      'Solicitud de club recibida - Sharkania',
      '<div style="font-family:sans-serif;padding:20px;color:#333">' ||
      '<h2>Solicitud recibida</h2>' ||
      '<p>Hemos recibido tu solicitud para registrar un club en Sharkania.</p>' ||
      '<p>Un administrador revisará tu solicitud y se comunicará contigo.</p>' ||
      '</div>',
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS queue_club_registration_confirmation
ON public.club_registration_requests;
CREATE TRIGGER queue_club_registration_confirmation
AFTER INSERT ON public.club_registration_requests
FOR EACH ROW EXECUTE FUNCTION public.queue_club_registration_confirmation();

REVOKE EXECUTE ON FUNCTION public.queue_club_registration_confirmation()
FROM PUBLIC, anon, authenticated;