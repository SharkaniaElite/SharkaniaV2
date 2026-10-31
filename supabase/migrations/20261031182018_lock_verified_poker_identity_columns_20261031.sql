-- Keep the existing profile mutation guard. Extend it to lock verified
-- Ignition and WPT identities so a player cannot replace a previously
-- approved nickname or linked email without trusted administrative action.
-- Pending applications can still correct their information.
-- No rows are updated. SECURITY DEFINER admin RPCs retain existing behavior.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_mutations()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
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
      OR (
        NEW.wpt_status IS DISTINCT FROM OLD.wpt_status
        AND NOT (
          NEW.wpt_status = 'pending'
          AND COALESCE(OLD.wpt_status, 'none') IN ('none', 'rejected', 'pending')
        )
      )
      OR NEW.wpt_verified_at IS DISTINCT FROM OLD.wpt_verified_at
      OR NEW.latin_status IS DISTINCT FROM OLD.latin_status
      OR (
        NEW.ignition_status IS DISTINCT FROM OLD.ignition_status
        AND NOT (
          NEW.ignition_status = 'pending'
          AND COALESCE(OLD.ignition_status, 'none') IN ('none', 'rejected', 'pending')
        )
      )
      -- Verified poker identities cannot be silently swapped by their owner.
      -- Pending Ignition/WPT requests remain editable for legitimate corrections.
      OR (
        OLD.ignition_status = 'verified'
        AND (
          NEW.ignition_email IS DISTINCT FROM OLD.ignition_email
          OR NEW.ignition_nickname IS DISTINCT FROM OLD.ignition_nickname
          OR NEW.ignition_league_player IS DISTINCT FROM OLD.ignition_league_player
        )
      )
      OR (
        OLD.wpt_status = 'verified'
        AND NEW.wpt_nickname IS DISTINCT FROM OLD.wpt_nickname
      )
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
$function$

