-- Keep client-side start/quiz attempts while reserving rewards for trusted RPCs.
DROP POLICY IF EXISTS academy_user_lessons_own ON public.academy_user_lessons;
DROP POLICY IF EXISTS academy_user_lessons_read_own ON public.academy_user_lessons;
CREATE POLICY academy_user_lessons_read_own ON public.academy_user_lessons FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS academy_user_lessons_start_own ON public.academy_user_lessons;
CREATE POLICY academy_user_lessons_start_own ON public.academy_user_lessons FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS academy_user_lessons_attempt_own ON public.academy_user_lessons;
CREATE POLICY academy_user_lessons_attempt_own ON public.academy_user_lessons FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
REVOKE DELETE ON public.academy_user_lessons FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.guard_academy_lesson_rewards()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF current_user='authenticated' THEN
    IF TG_OP='INSERT' THEN
      IF NEW.quiz_passed IS DISTINCT FROM false
         OR NEW.completed_at IS NOT NULL
         OR COALESCE(NEW.xp_earned,0)<>0
         OR COALESCE(NEW.coins_earned,0)<>0 THEN
        RAISE EXCEPTION 'Solo el quiz validado puede completar una lección o acreditar recompensas'
          USING ERRCODE='42501';
      END IF;
    ELSIF TG_OP='UPDATE' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
         OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
         OR NEW.quiz_passed IS DISTINCT FROM OLD.quiz_passed
         OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
         OR NEW.xp_earned IS DISTINCT FROM OLD.xp_earned
         OR NEW.coins_earned IS DISTINCT FROM OLD.coins_earned THEN
        RAISE EXCEPTION 'Recompensas de academia no editables desde el navegador'
          USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_academy_lesson_rewards ON public.academy_user_lessons;
CREATE TRIGGER guard_academy_lesson_rewards BEFORE INSERT OR UPDATE ON public.academy_user_lessons
FOR EACH ROW EXECUTE FUNCTION public.guard_academy_lesson_rewards();
REVOKE EXECUTE ON FUNCTION public.guard_academy_lesson_rewards() FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS academy_user_modules_own ON public.academy_user_modules;
DROP POLICY IF EXISTS academy_user_modules_read_own ON public.academy_user_modules;
CREATE POLICY academy_user_modules_read_own ON public.academy_user_modules FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
REVOKE INSERT,UPDATE,DELETE ON public.academy_user_modules FROM anon,authenticated;
DROP POLICY IF EXISTS academy_streaks_own ON public.academy_study_streaks;
DROP POLICY IF EXISTS academy_streaks_read_own ON public.academy_study_streaks;
CREATE POLICY academy_streaks_read_own ON public.academy_study_streaks FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
REVOKE INSERT,UPDATE,DELETE ON public.academy_study_streaks FROM anon,authenticated;
