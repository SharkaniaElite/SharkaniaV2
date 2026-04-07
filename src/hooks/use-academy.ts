// src/hooks/use-academy.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAcademyModules,
  getModuleLessons,
  getLessonBySlug,
  getUserModuleProgress,
  getUserSingleLessonProgress,
  getUserStudyStreak,
  getModulesWithProgress,
  completeLesson,
  unlockModule,
  startLesson,
  recordQuizAttempt,
} from "../lib/api/academy";
import { useAuthStore } from "../stores/auth-store";

// ── Module hooks ──

export function useAcademyModules() {
  return useQuery({
    queryKey: ["academy-modules"],
    queryFn: getAcademyModules,
    staleTime: 1000 * 60 * 10,
  });
}

export function useModulesWithProgress() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["academy-modules-progress", user?.id],
    queryFn: () => getModulesWithProgress(user?.id ?? null),
    staleTime: 1000 * 60 * 2,
  });
}

// ── Lesson hooks ──

export function useModuleLessons(moduleId: string | undefined) {
  return useQuery({
    queryKey: ["academy-lessons", moduleId],
    queryFn: () => getModuleLessons(moduleId!),
    enabled: !!moduleId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useLessonBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["academy-lesson", slug],
    queryFn: () => getLessonBySlug(slug!),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });
}

// ── Progress hooks ──

export function useUserModuleProgress() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["academy-user-modules", user?.id],
    queryFn: () => getUserModuleProgress(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  });
}

export function useUserLessonProgress(lessonId: string | undefined) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["academy-user-lesson", user?.id, lessonId],
    queryFn: () => getUserSingleLessonProgress(user!.id, lessonId!),
    enabled: !!user?.id && !!lessonId,
    staleTime: 1000 * 60 * 1,
  });
}

export function useStudyStreak() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["academy-streak", user?.id],
    queryFn: () => getUserStudyStreak(user!.id),
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  });
}

// ── Mutation hooks ──

export function useCompleteLesson() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({
      lessonId,
      quizAnswers,
    }: {
      lessonId: string;
      quizAnswers: Record<string, number>;
    }) => completeLesson(user!.id, lessonId, quizAnswers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-modules-progress"] });
      queryClient.invalidateQueries({ queryKey: ["academy-user-modules"] });
      queryClient.invalidateQueries({ queryKey: ["academy-user-lesson"] });
      queryClient.invalidateQueries({ queryKey: ["academy-streak"] });
    },
  });
}

export function useUnlockModule() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (moduleId: string) => unlockModule(user!.id, moduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-modules-progress"] });
      queryClient.invalidateQueries({ queryKey: ["academy-user-modules"] });
    },
  });
}

export function useStartLesson() {
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (lessonId: string) => startLesson(user!.id, lessonId),
  });
}

export function useRecordQuizAttempt() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({
      lessonId,
      answers,
    }: {
      lessonId: string;
      answers: Record<string, number>;
    }) => recordQuizAttempt(user!.id, lessonId, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-user-lesson"] });
    },
  });
}