// src/lib/api/academy.ts
import { supabase } from "../supabase";

// ── Types ──

export interface AcademyModule {
  id: string;
  level: string;
  sort_order: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  icon: string;
  price_coins: number;
  total_lessons: number;
  estimated_minutes: number;
  is_active: boolean;
  unlock_message: string | null;
}

export interface AcademyLesson {
  id: string;
  module_id: string;
  sort_order: number;
  title: string;
  slug: string;
  subtitle: string | null;
  estimated_minutes: number;
  xp_reward: number;
  coins_reward: number;
  body: LessonBlock[];
  quiz: QuizQuestion[];
  action_challenge: string | null;
  glossary_terms: string[];
  is_active: boolean;
}

export interface LessonBlock {
  type: "text" | "h2" | "h3" | "callout" | "stat" | "list" | "hand" | "tip" | "warning" | "action" | "p";
  content?: string;
  value?: string;
  items?: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface UserModuleProgress {
  id: string;
  user_id: string;
  module_id: string;
  unlocked_at: string;
  completed_at: string | null;
}

export interface UserLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  started_at: string;
  completed_at: string | null;
  quiz_passed: boolean;
  quiz_attempts: number;
  quiz_last_answers: Record<string, number> | null;
  xp_earned: number;
  coins_earned: number;
}

export interface StudyStreak {
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  total_lessons_completed: number;
  total_xp_earned: number;
}

export interface CompleteLessonResult {
  success: boolean;
  error?: string;
  xp_earned?: number;
  coins_earned?: number;
  module_completed?: boolean;
  current_streak?: number;
  longest_streak?: number;
  total_completed?: number;
}

export interface UnlockModuleResult {
  success: boolean;
  error?: string;
  coins_spent?: number;
  needed?: number;
  balance?: number;
}

export interface ModuleWithProgress extends AcademyModule {
  isUnlocked: boolean;
  isCompleted: boolean;
  lessonsCompleted: number;
  totalActiveLessons: number;
}

// ── API Functions ──

export async function getAcademyModules(): Promise<AcademyModule[]> {
  const { data, error } = await supabase
    .from("academy_modules")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getAllAcademyModules(): Promise<AcademyModule[]> {
  const { data, error } = await supabase
    .from("academy_modules")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getModuleLessons(moduleId: string): Promise<AcademyLesson[]> {
  const { data, error } = await supabase
    .from("academy_lessons")
    .select("*")
    .eq("module_id", moduleId)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as AcademyLesson[];
}

export async function getLessonBySlug(slug: string): Promise<AcademyLesson | null> {
  const { data, error } = await supabase
    .from("academy_lessons")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as AcademyLesson;
}

export async function getUserModuleProgress(userId: string): Promise<UserModuleProgress[]> {
  const { data, error } = await supabase
    .from("academy_user_modules")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function getUserLessonProgress(
  userId: string,
  lessonIds: string[]
): Promise<UserLessonProgress[]> {
  if (lessonIds.length === 0) return [];
  const { data, error } = await supabase
    .from("academy_user_lessons")
    .select("*")
    .eq("user_id", userId)
    .in("lesson_id", lessonIds);
  if (error) throw error;
  return data ?? [];
}

export async function getUserSingleLessonProgress(
  userId: string,
  lessonId: string
): Promise<UserLessonProgress | null> {
  const { data, error } = await supabase
    .from("academy_user_lessons")
    .select("*")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserStudyStreak(userId: string): Promise<StudyStreak | null> {
  const { data, error } = await supabase
    .from("academy_study_streaks")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function completeLesson(
  userId: string,
  lessonId: string,
  quizAnswers: Record<string, number>
): Promise<CompleteLessonResult> {
  const { data, error } = await supabase.rpc("academy_complete_lesson", {
    p_user_id: userId,
    p_lesson_id: lessonId,
    p_quiz_answers: quizAnswers,
  });
  if (error) {
    console.error("Error completing lesson:", error);
    return { success: false, error: error.message };
  }
  return data as CompleteLessonResult;
}

export async function unlockModule(
  userId: string,
  moduleId: string
): Promise<UnlockModuleResult> {
  const { data, error } = await supabase.rpc("academy_unlock_module", {
    p_user_id: userId,
    p_module_id: moduleId,
  });
  if (error) {
    console.error("Error unlocking module:", error);
    return { success: false, error: error.message };
  }
  return data as UnlockModuleResult;
}

export async function startLesson(userId: string, lessonId: string): Promise<void> {
  await supabase
    .from("academy_user_lessons")
    .upsert(
      { user_id: userId, lesson_id: lessonId, started_at: new Date().toISOString() },
      { onConflict: "user_id,lesson_id", ignoreDuplicates: true }
    );
}

export async function recordQuizAttempt(
  userId: string,
  lessonId: string,
  answers: Record<string, number>
): Promise<void> {
  const { data: existing } = await supabase
    .from("academy_user_lessons")
    .select("id, quiz_attempts")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("academy_user_lessons")
      .update({ quiz_attempts: existing.quiz_attempts + 1, quiz_last_answers: answers })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("academy_user_lessons")
      .insert({ user_id: userId, lesson_id: lessonId, quiz_attempts: 1, quiz_last_answers: answers });
  }
}

export async function getModulesWithProgress(
  userId: string | null
): Promise<ModuleWithProgress[]> {
  const modules = await getAcademyModules();

  if (!userId) {
    return modules.map((m) => ({
      ...m,
      isUnlocked: m.price_coins === 0,
      isCompleted: false,
      lessonsCompleted: 0,
      totalActiveLessons: m.total_lessons,
    }));
  }

  const userModules = await getUserModuleProgress(userId);
  const unlockedMap = new Map(userModules.map((um) => [um.module_id, um]));

  const result: ModuleWithProgress[] = [];

  for (const m of modules) {
    const userModule = unlockedMap.get(m.id);
    const isUnlocked = m.price_coins === 0 || !!userModule;

    let lessonsCompleted = 0;

    if (isUnlocked) {
      const lessons = await getModuleLessons(m.id);
      const lessonIds = lessons.map((l) => l.id);
      if (lessonIds.length > 0) {
        const progress = await getUserLessonProgress(userId, lessonIds);
        lessonsCompleted = progress.filter((p) => p.quiz_passed).length;
      }
    }

    result.push({
      ...m,
      isUnlocked,
      isCompleted: !!userModule?.completed_at,
      lessonsCompleted,
      totalActiveLessons: m.total_lessons,
    });
  }

  return result;
}