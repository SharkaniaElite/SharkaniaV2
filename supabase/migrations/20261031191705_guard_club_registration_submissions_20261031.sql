-- Guard both direct Data API INSERTs and SECURITY DEFINER club-request RPCs.
-- Previous RLS only checked ownership, allowing a client to supply
-- status='approved' in an INSERT. A BEFORE INSERT trigger closes this path.
-- Limits are per authenticated user: max 3 in a rolling 24h and max 2
-- pending concurrently. Existing requests are never modified.
CREATE OR REPLACE FUNCTION public.guard_club_registration_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_recent integer;
  v_pending integer;
BEGIN
  -- Null auth.uid(): only trusted server/admin inserts can pass existing
  -- RLS and table privileges. Normal visitors cannot insert without a JWT.
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'No puedes registrar solicitudes para otro usuario'
      USING ERRCODE = '42501';
  END IF;

  -- Verified/approved club status is strictly an administrative UPDATE.
  IF NEW.status IS DISTINCT FROM 'pending'::public.request_status
     OR NEW.admin_notes IS NOT NULL OR NEW.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'La solicitud debe comenzar pendiente de revisión'
      USING ERRCODE = '42501';
  END IF;

  -- Never allow client supplied timestamps to bypass a rolling quota.
  NEW.created_at := pg_catalog.now();

  -- Serialize concurrent requests from the SAME user before counting.
  PERFORM pg_catalog.pg_advisory_xact_lock(742831, pg_catalog.hashtext(v_actor::text));
  SELECT COUNT(*)::integer,
         COUNT(*) FILTER (WHERE status = 'pending'::public.request_status)::integer
    INTO v_recent, v_pending
  FROM public.club_registration_requests
  WHERE user_id = v_actor
    AND created_at >= pg_catalog.now() - INTERVAL '24 hours';

  IF v_recent >= 3 THEN
    RAISE EXCEPTION 'Alcanzaste el límite de 3 solicitudes de club en 24 horas'
      USING ERRCODE = 'P0001';
  END IF;

  -- All-time pending count protects the admin review queue (not just 24h).
  SELECT COUNT(*)::integer INTO v_pending
  FROM public.club_registration_requests
  WHERE user_id = v_actor AND status = 'pending'::public.request_status;

  IF v_pending >= 2 THEN
    RAISE EXCEPTION 'Ya tienes 2 solicitudes de club pendientes de revisión'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_club_registration_insert()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_club_registration_insert
BEFORE INSERT ON public.club_registration_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_club_registration_insert();
