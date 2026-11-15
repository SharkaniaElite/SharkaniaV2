CREATE OR REPLACE FUNCTION public.guard_profile_privileged_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $body$
BEGIN
  -- PostgREST executes direct client requests as anon/authenticated.
  -- SECURITY DEFINER functions and trusted internal triggers run as their
  -- database owner and retain the authority needed for rewards and rankings.
  IF current_user IN ('anon', 'authenticated')
     AND NOT public.is_super_admin() THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Profiles must be created by the authenticated signup trigger'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.role IS DISTINCT FROM OLD.role
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.xp IS DISTINCT FROM OLD.xp
      OR NEW.level IS DISTINCT FROM OLD.level
      OR NEW.shark_coins_balance IS DISTINCT FROM OLD.shark_coins_balance
      OR NEW.unified_elo IS DISTINCT FROM OLD.unified_elo
      OR NEW.wpt_status IS DISTINCT FROM OLD.wpt_status
      OR NEW.wpt_verified_at IS DISTINCT FROM OLD.wpt_verified_at
      OR NEW.latin_status IS DISTINCT FROM OLD.latin_status
      OR NEW.ignition_status IS DISTINCT FROM OLD.ignition_status
      OR NEW.ignition_linked_at IS DISTINCT FROM OLD.ignition_linked_at
      OR NEW.ignition_password_sent IS DISTINCT FROM OLD.ignition_password_sent
      OR NEW.pro_referral_code IS DISTINCT FROM OLD.pro_referral_code
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Protected profile fields can only be modified by trusted administration'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$body$;
DROP TRIGGER IF EXISTS guard_profile_privileged_mutations ON public.profiles;
CREATE TRIGGER guard_profile_privileged_mutations
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_privileged_mutations();
REVOKE EXECUTE ON FUNCTION public.guard_profile_privileged_mutations() FROM PUBLIC, anon, authenticated;