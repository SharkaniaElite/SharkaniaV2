CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $body$
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
  RETURN NEW;
END;
$body$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;