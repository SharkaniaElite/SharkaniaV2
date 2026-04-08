// src/pages/academy-lesson.tsx
import { useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { SEOHead } from "../components/seo/seo-head";
import { LessonBlockRenderer } from "../components/academy/lesson-block-renderer";
import { QuizComponent } from "../components/academy/quiz-component";
import {
  useLessonBySlug,
  useAcademyModules,
  useModuleLessons,
  useUserLessonProgress,
  useCompleteLesson,
  useStartLesson,
  useRecordQuizAttempt,
} from "../hooks/use-academy";
import { useAuthStore } from "../stores/auth-store";
import { ArrowLeft, Clock, Zap, BookOpen } from "lucide-react";
import { WptBanner } from "../components/blog/wpt-banner";
export function AcademyLessonPage() {
  const { moduleSlug, lessonSlug } = useParams<{ moduleSlug: string; lessonSlug: string }>();
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((s) => s.user);

  const { data: lesson, isLoading: lessonLoading } = useLessonBySlug(lessonSlug);
  const { data: modules } = useAcademyModules();
  const module = modules?.find((m) => m.level === moduleSlug);

  const { data: lessons } = useModuleLessons(module?.id);
  const { data: userProgress } = useUserLessonProgress(lesson?.id);

  const completeMutation = useCompleteLesson();
  const startMutation = useStartLesson();
  const retryMutation = useRecordQuizAttempt();

  // Find next lesson
  const currentIndex = lessons?.findIndex((l) => l.id === lesson?.id) ?? -1;
  const nextLesson = currentIndex >= 0 && lessons ? lessons[currentIndex + 1] : null;

  // Register lesson start
  useEffect(() => {
    if (lesson && user && !userProgress) {
      startMutation.mutate(lesson.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, user?.id]);

  // Scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    topRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [lessonSlug]);

  if (lessonLoading) {
    return (
      <PageShell>
        <div ref={topRef} className="pt-20 min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (!lesson) {
    return (
      <PageShell>
        <div ref={topRef} className="pt-20 min-h-screen flex flex-col items-center justify-center gap-4">
          <span className="text-5xl">📖</span>
          <h1 className="text-sk-2xl font-bold text-sk-text-1">Lección no encontrada</h1>
          <Link to="/academia">
            <Button variant="accent" size="md"><ArrowLeft size={16} /> Volver a la Academia</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const handleComplete = async (answers: Record<string, number>) => {
    if (!user) {
      alert("Necesitas iniciar sesión para guardar tu progreso.");
      return { success: false, error: "No autenticado" };
    }
    return completeMutation.mutateAsync({ lessonId: lesson.id, quizAnswers: answers });
  };

  const handleRetry = async (answers: Record<string, number>) => {
    if (!user) return;
    await retryMutation.mutateAsync({ lessonId: lesson.id, answers });
  };

  const handleNextLesson = () => {
    if (nextLesson) {
      navigate(`/academia/${moduleSlug}/${nextLesson.slug}`);
    } else {
      navigate(`/academia`); // Volvemos al mapa para empezar el siguiente nivel
    }
  };

  return (
    <PageShell>
      <SEOHead
        title={`${lesson.title} — Sharkania Academy`}
        description={lesson.subtitle ?? `Aprende ${lesson.title} en la academia de poker de Sharkania.`}
        path={`/academia/${moduleSlug}/${lessonSlug}`}
      />
      <div ref={topRef} className="pt-20 pb-16">
        <div className="max-w-[720px] mx-auto px-6">

          {/* Back */}
          <Link
            to={`/academia/${moduleSlug}`}
            className="inline-flex items-center gap-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            {module?.title ?? "Volver al módulo"}
          </Link>

          {/* Lesson header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              {module && (
                <span className="font-mono text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-sk-accent-dim text-sk-accent">
                  {module.icon} Nivel {(modules?.findIndex((m) => m.id === module.id) ?? 0) + 1}
                </span>
              )}
              {currentIndex >= 0 && (
                <span className="font-mono text-[10px] text-sk-text-3">
                  Lección {currentIndex + 1}/{lessons?.length ?? "?"}
                </span>
              )}
            </div>

            <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight mb-2">
              {lesson.title}
            </h1>
            {lesson.subtitle && (
              <p className="text-sk-sm text-sk-text-3">{lesson.subtitle}</p>
            )}

            {/* Meta */}
            <div className="flex items-center gap-4 mt-3 text-[11px] font-mono text-sk-text-3">
              <span className="flex items-center gap-1"><Clock size={11} /> ~{lesson.estimated_minutes} min</span>
              <span className="flex items-center gap-1"><Zap size={11} className="text-sk-accent" /> +{lesson.xp_reward} XP</span>
              <span className="flex items-center gap-1">
    +{lesson.coins_reward}
    <img 
      src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif" 
      alt="Shark Coin" 
      className="w-3.5 h-3.5 drop-shadow-sm" 
    />
  </span>
              {lesson.quiz.length > 0 && (
                <span className="flex items-center gap-1"><BookOpen size={11} /> Quiz: {lesson.quiz.length} preguntas</span>
              )}
            </div>
          </div>

          {/* Lesson content */}
          <div className="mb-10">
            <LessonBlockRenderer
              blocks={lesson.body}
              glossaryTerms={lesson.glossary_terms}
            />
          </div>

          {/* Banner final */}
          <WptBanner slot="final" className="mt-10" />

          {/* Quiz section */}
          {lesson.quiz.length > 0 && (
            <div className="mt-10 pt-8 border-t border-sk-border-2">
              {!user ? (
                <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 text-center">
                  <BookOpen size={32} className="text-sk-accent mx-auto mb-3" />
                  <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">
                    Inicia sesión para hacer el quiz
                  </h3>
                  <p className="text-sk-xs text-sk-text-2 mb-4">
                    Necesitas una cuenta para guardar tu progreso y ganar XP.
                  </p>
                  <Link to="/register">
                    <Button variant="accent" size="md">Crear cuenta gratis</Button>
                  </Link>
                </div>
              ) : (
                <QuizComponent
                  questions={lesson.quiz}
                  lessonId={lesson.id}
                  alreadyPassed={userProgress?.quiz_passed ?? false}
                  onComplete={handleComplete}
                  onRetry={handleRetry}
                  onNextLesson={handleNextLesson}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
