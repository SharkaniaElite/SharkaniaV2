-- Private transaction-safe throttling of administrator-triggered email reminders.
-- This table stores audit metadata only, never confirmation tokens or passwords.
CREATE TABLE public.email_verification_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_verification_reminders_target_time_idx
  ON public.email_verification_reminders(target_user_id, created_at DESC);
ALTER TABLE public.email_verification_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_verification_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.email_verification_reminders TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_email_confirmation_reminder(
  p_target_user_id uuid, p_requested_by uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_created_at timestamptz;
  v_daily_count integer;
  v_id uuid;
BEGIN
  IF p_target_user_id IS NULL OR p_requested_by IS NULL THEN
    RAISE EXCEPTION 'Invalid reminder request' USING ERRCODE = '22023';
  END IF;

  -- Serialize concurrent reminders to the same user.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    834105, pg_catalog.hashtext(p_target_user_id::text)
  );

  SELECT MAX(created_at),
         COUNT(*) FILTER (WHERE created_at > pg_catalog.now() - INTERVAL '24 hours')
  INTO v_created_at, v_daily_count
  FROM public.email_verification_reminders
  WHERE target_user_id = p_target_user_id;

  -- At most one reminder per hour and two per rolling day, across admins.
  IF v_created_at > pg_catalog.now() - INTERVAL '1 hour' OR v_daily_count >= 2 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.email_verification_reminders(target_user_id, requested_by)
  VALUES (p_target_user_id, p_requested_by)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_email_confirmation_reminder(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_email_confirmation_reminder(uuid,uuid)
  TO service_role;
