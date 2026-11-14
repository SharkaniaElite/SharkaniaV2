-- Secure self-service link request for EXISTING Sharkania accounts.
-- Never changes an already-verified Ignition identity, admin approval or campaign queue.
CREATE OR REPLACE FUNCTION public.request_my_ignition_link(
  p_email text,
  p_nickname text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_email text := btrim(coalesce(p_email,''));
  v_nickname text := btrim(coalesce(p_nickname,''));
  v_status text;
  v_linked boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión en Sharkania' USING ERRCODE='42501';
  END IF;
  IF length(v_email) NOT BETWEEN 5 AND 254
     OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR length(v_nickname) NOT BETWEEN 2 AND 60 THEN
    RAISE EXCEPTION 'Introduce el correo y nickname válidos de Ignition';
  END IF;

  SELECT p.ignition_status, p.ignition_league_player
    INTO v_status, v_linked
  FROM public.profiles p WHERE p.id=v_user FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo encontrar tu perfil de Sharkania';
  END IF;
  -- Return first, before any duplicate check or writes: already-verified users
  -- must never be switched back to pending on account re-login.
  IF v_status='verified' AND v_linked IS TRUE THEN
    RETURN jsonb_build_object('status','already_linked');
  END IF;
  IF v_status='pending' AND v_linked IS TRUE THEN
    RETURN jsonb_build_object('status','pending');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id=v_user AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Primero confirma el correo de tu cuenta Sharkania';
  END IF;

  -- Lock per identity so two users cannot concurrently claim the same value.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sharkania-ignition-nick:'||lower(v_nickname),0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sharkania-ignition-email:'||lower(v_email),0)
  );

  IF EXISTS (
    SELECT 1 FROM public.profiles other
    WHERE other.id<>v_user
      AND (other.ignition_league_player IS TRUE OR other.ignition_status IN ('pending','verified'))
      AND (
        lower(btrim(coalesce(other.ignition_nickname,'')))=lower(v_nickname)
        OR lower(btrim(coalesce(other.ignition_email,'')))=lower(v_email)
      )
  ) THEN
    RAISE EXCEPTION 'Ese correo o nickname de Ignition ya está asociado a otra solicitud. Contacta a soporte si consideras que es un error';
  END IF;

  UPDATE public.profiles
  SET ignition_league_player=true,
      ignition_email=v_email,
      ignition_nickname=v_nickname,
      ignition_status='pending'
  WHERE id=v_user;
  RETURN jsonb_build_object('status','pending');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.request_my_ignition_link(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_my_ignition_link(text,text)
  TO authenticated, service_role;
