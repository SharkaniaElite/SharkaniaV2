CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
DECLARE v_club_name text;
BEGIN
  INSERT INTO public.profiles (
    id, email, display_name, country_code, whatsapp, shark_coins_balance, role
  ) VALUES (
    NEW.id, NEW.email,
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'country_code',
    NEW.raw_user_meta_data ->> 'whatsapp',
    100,
    'player'::public.user_role
  )
  ON CONFLICT (id) DO NOTHING;

  -- Club signup is a REQUEST, never a club_admin role grant.
  IF NEW.raw_user_meta_data ->> 'registration_type' = 'club' THEN
    v_club_name := LEFT(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'club_name', '')), 120);
    IF v_club_name <> '' THEN
      INSERT INTO public.club_registration_requests (
        user_id, club_name, country_code, description, whatsapp
      ) VALUES (
        NEW.id, v_club_name,
        NULLIF(UPPER(LEFT(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'club_country_code', '')), 2)), ''),
        NULLIF(LEFT(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'club_description', '')), 1000), ''),
        NULLIF(LEFT(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'whatsapp', '')), 64), '')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$body$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;