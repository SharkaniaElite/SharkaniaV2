CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_club_name text;
  v_ignition_nickname text;
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

  -- User metadata is a request, never proof of ownership of a poker nickname.
  -- Store only a pending Ignition link that requires later admin verification.
  IF COALESCE(NEW.raw_user_meta_data ->> 'ignition_league_player', 'false') = 'true' THEN
    v_ignition_nickname := NULLIF(LEFT(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'ignition_nickname', '')), 80), '');
    IF v_ignition_nickname IS NOT NULL THEN
      UPDATE public.profiles SET
        ignition_league_player = true,
        ignition_email = NEW.email,
        ignition_nickname = v_ignition_nickname,
        ignition_status = 'pending'
      WHERE id = NEW.id;
    END IF;
  END IF;

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
$function$
