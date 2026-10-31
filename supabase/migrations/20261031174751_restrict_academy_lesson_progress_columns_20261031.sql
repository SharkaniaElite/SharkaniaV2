-- Defense in depth for academy lesson progress.
-- Existing guard_academy_lesson_rewards trigger and RLS policies remain in place.
-- Browser clients may create their own lesson-start/failed-attempt record but
-- may not write quiz_passed, completed_at, xp_earned, or coins_earned.
-- Only trusted SECURITY DEFINER RPC academy_complete_lesson can award progress.
-- No existing progress rows, XP, coins, rankings, or tournament data are changed.

REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.academy_user_lessons
  FROM PUBLIC, anon, authenticated;

GRANT INSERT (user_id, lesson_id, started_at, quiz_attempts, quiz_last_answers)
  ON TABLE public.academy_user_lessons TO authenticated;

GRANT UPDATE (quiz_attempts, quiz_last_answers)
  ON TABLE public.academy_user_lessons TO authenticated;
