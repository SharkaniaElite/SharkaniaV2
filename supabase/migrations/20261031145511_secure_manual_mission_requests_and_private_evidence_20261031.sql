-- Player mission evidence must not be public. The player may only request a manual review.
DROP POLICY IF EXISTS "Permitir lectura publica" ON public.player_missions;
DROP POLICY IF EXISTS "Missions: own or super admin read" ON public.player_missions;
CREATE POLICY "Missions: own or super admin read" ON public.player_missions FOR SELECT TO authenticated
USING (profile_id=(SELECT auth.uid()) OR (SELECT public.is_super_admin()));
DROP POLICY IF EXISTS "Missions: request manual validation" ON public.player_missions;
CREATE POLICY "Missions: request manual validation" ON public.player_missions FOR INSERT TO authenticated
WITH CHECK (profile_id=(SELECT auth.uid()) AND status='pending' AND completed_at IS NULL AND
EXISTS (SELECT 1 FROM public.gamification_missions gm WHERE gm.id=mission_id AND gm.is_active=true AND gm.validation_type='manual'));
DROP POLICY IF EXISTS "Missions: edit own pending or admin" ON public.player_missions;
CREATE POLICY "Missions: edit own pending or admin" ON public.player_missions FOR UPDATE TO authenticated
USING ((SELECT public.is_super_admin()) OR (profile_id=(SELECT auth.uid()) AND status='pending'))
WITH CHECK ((SELECT public.is_super_admin()) OR (profile_id=(SELECT auth.uid()) AND status='pending' AND completed_at IS NULL AND
EXISTS (SELECT 1 FROM public.gamification_missions gm WHERE gm.id=mission_id AND gm.is_active=true AND gm.validation_type='manual')));
CREATE OR REPLACE FUNCTION public.guard_player_mission_client_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_super_admin() AND TG_OP='UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
      OR NEW.mission_id IS DISTINCT FROM OLD.mission_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
      OR NEW.status IS DISTINCT FROM OLD.status
    THEN
      RAISE EXCEPTION 'Solo el administrador puede cambiar el estado de una misión'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_player_mission_client_updates ON public.player_missions;
CREATE TRIGGER guard_player_mission_client_updates BEFORE UPDATE ON public.player_missions
FOR EACH ROW EXECUTE FUNCTION public.guard_player_mission_client_updates();
REVOKE EXECUTE ON FUNCTION public.guard_player_mission_client_updates() FROM PUBLIC, anon, authenticated;
