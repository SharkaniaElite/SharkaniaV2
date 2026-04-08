// src/pages/academy-module.tsx
import { useParams, Link, useNavigate } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { SEOHead } from "../components/seo/seo-head";
import { cn } from "../lib/cn";
import {
  useAcademyModules,
  useModuleLessons,
  useUserModuleProgress,
  useUnlockModule,
} from "../hooks/use-academy";
import { useAuthStore } from "../stores/auth-store";
import { getUserLessonProgress } from "../lib/api/academy";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";

export function AcademyModulePage() {
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isSuperAdmin = profile?.role === "super_admin";

  const { data: modules, isLoading: modulesLoading } = useAcademyModules();
  const module = modules?.find((m) => m.level === moduleSlug);

  const { data: lessons, isLoading: lessonsLoading } = useModuleLessons(module?.id);

  const { data: userModules } = useUserModuleProgress();
  const isUnlocked = module
    ? isSuperAdmin || module.price_coins === 0 || userModules?.some((um) => um.module_id === module.id)
    : false;

  const lessonIds = lessons?.map((l) => l.id) ?? [];
  const { data: lessonProgress } = useQuery({
    queryKey: ["academy-module-lesson-progress", user?.id, module?.id],
    queryFn: () => getUserLessonProgress(user!.id, lessonIds),
    enabled: !!user?.id && lessonIds.length > 0,
  });

  const progressMap = new Map(
    (lessonProgress ?? []).map((p) => [p.lesson_id, p])
  );

  const unlockMutation = useUnlockModule();

  const handleUnlock = async () => {
    if (!module || !user) return;
    const result = await unlockMutation.mutateAsync(module.id);
    if (!result.success) {
      alert(result.error ?? "Error al desbloquear");
    }
  };

  const isLoading = modulesLoading || lessonsLoading;

  if (isLoading) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (!module) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex flex-col items-center justify-center gap-4">
          <span className="text-5xl">📚</span>
          <h1 className="text-sk-2xl font-bold text-sk-text-1">Módulo no encontrado</h1>
          <Link to="/academia">
            <Button variant="accent" size="md"><ArrowLeft size={16} /> Volver a la Academia</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <SEOHead
        title={`${module.title} — Sharkania Academy`}
        description={module.description ?? `Aprende ${module.title} con lecciones interactivas y quizzes.`}
        path={`/academia/${moduleSlug}`}
      />
      <div className="pt-20 pb-16">
        <div className="max-w-[700px] mx-auto px-6">
          <Link to="/academia" className="inline-flex items-center gap-2 text-sk-sm font-bold text-sk-text-3 hover:text-sk-accent transition-colors mb-8 group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
            Volver a la Central
          </Link>

          {/* ══ EXPEDIENTE TÁCTICO ══ */}
          <div className="mb-10 bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-8 relative overflow-hidden shadow-sk-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sk-accent/5 blur-3xl rounded-full pointer-events-none" />
            
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <span className="text-2xl">{module.icon}</span>
              <span className="px-3 py-1 bg-sk-bg-3 border border-sk-accent/20 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-sk-accent shadow-inner">
                Expediente Nivel {module.sort_order}
              </span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-sk-text-1 mb-2 leading-none relative z-10">
              {module.title}
            </h1>
            {module.subtitle && <p className="text-sk-sm font-bold text-sk-text-3 mb-4 relative z-10">{module.subtitle}</p>}
            
            {module.description && (
              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed relative z-10 mb-6">
                {module.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-[11px] text-sk-text-3 font-mono border-t border-sk-border-2 pt-4 relative z-10">
              <span>{module.total_lessons} lecciones</span>
              <span>~{module.estimated_minutes} min total</span>
              {module.price_coins === 0 && <span className="text-sk-green font-bold bg-sk-green/10 px-2 py-0.5 rounded">ACCESO LIBRE</span>}
            </div>
          </div>

          {/* ══ BARRERA DE SEGURIDAD (PAYWALL) ══ */}
          {!isUnlocked && (
            <div className="bg-sk-bg-2 border border-sk-gold/20 rounded-2xl p-8 text-center mb-10 shadow-[0_0_40px_rgba(251,191,36,0.05)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-sk-gold/5 to-transparent pointer-events-none" />
              
              <Lock size={40} className="text-sk-gold mx-auto mb-4 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]" />
              <h2 className="text-2xl font-black text-sk-text-1 mb-2 tracking-tight">
                Inteligencia Clasificada
              </h2>
              <p className="text-sk-sm text-sk-text-3 mb-6 max-w-md mx-auto leading-relaxed">
                Tu nivel de autorización actual no te permite acceder a este expediente. Invierte tu conocimiento para desencriptarlo.
                {profile && (
                  <span className="block mt-3 text-[11px] font-mono uppercase tracking-widest text-sk-text-4">
                    Tus fondos: <strong className="text-sk-gold">{profile.shark_coins_balance} SC</strong> / Requerido: {module.price_coins} SC
                  </span>
                )}
              </p>
              
              {!user ? (
                <Link to="/register"><Button variant="accent" size="md">Identifícate en la matriz</Button></Link>
              ) : (profile?.shark_coins_balance ?? 0) >= module.price_coins ? (
                <Button variant="accent" size="lg" onClick={handleUnlock} isLoading={unlockMutation.isPending} className="w-full sm:w-auto font-extrabold shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                  <Sparkles size={18} className="mr-2" /> Desencriptar por {module.price_coins} SC
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] font-mono text-sk-red uppercase tracking-widest">
                    FONDOS INSUFICIENTES
                  </p>
                  <Link to="/shop"><Button variant="secondary" size="md">Adquirir Shark Coins</Button></Link>
                </div>
              )}
            </div>
          )}

          {/* Unlock message */}
          {isUnlocked && module.unlock_message && (
            <div className="bg-sk-accent-dim/50 border border-sk-accent/20 rounded-lg px-4 py-3 mb-6 flex gap-3">
              <span className="text-lg shrink-0">🦈</span>
              <p className="text-sk-xs text-sk-text-2 leading-relaxed italic">{module.unlock_message}</p>
            </div>
          )}

          {/* Lessons list */}
          {isUnlocked && lessons && (
            <div className="space-y-2">
              <h2 className="text-sk-sm font-bold text-sk-text-1 mb-3">Lecciones</h2>
              {lessons.map((lesson, i) => {
                const progress = progressMap.get(lesson.id);
                const isPassed = progress?.quiz_passed ?? false;
                const isStarted = !!progress;
                const previousPassed = i === 0 || (progressMap.get(lessons[i - 1]!.id)?.quiz_passed ?? false);
                const canAccess = isSuperAdmin || previousPassed;

                return (
                  <div
                    key={lesson.id}
                    onClick={() => canAccess && navigate(`/academia/${moduleSlug}/${lesson.slug}`)}
                    className={cn(
                      "bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4 flex items-center gap-4 transition-all",
                      canAccess ? "hover:border-sk-border-3 hover:bg-sk-bg-3 cursor-pointer" : "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-mono font-bold text-sk-sm",
                      isPassed ? "bg-sk-green-dim text-sk-green" : isStarted ? "bg-sk-accent-dim text-sk-accent" : "bg-sk-bg-4 text-sk-text-3"
                    )}>
                      {isPassed ? <CheckCircle2 size={18} /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sk-sm font-semibold text-sk-text-1 truncate">{lesson.title}</h3>
                      {lesson.subtitle && <p className="text-[11px] text-sk-text-3 truncate">{lesson.subtitle}</p>}
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-sk-text-3">
                        <span>~{lesson.estimated_minutes} min</span>
                        <span>+{lesson.xp_reward} XP</span>
                        <span className="flex items-center gap-1">
                          +{lesson.coins_reward}
                          <img 
                            src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif" 
                            alt="Shark Coin" 
                            className="w-3.5 h-3.5 drop-shadow-sm" 
                          />
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {!canAccess ? <Lock size={14} className="text-sk-text-4" /> : <ChevronRight size={16} className="text-sk-text-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
