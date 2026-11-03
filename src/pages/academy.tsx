// src/pages/academy.tsx
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { ArenaPageHero } from "../components/arena/arena-page-hero";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { SEOHead } from "../components/seo/seo-head";
import { ModuleCard } from "../components/academy/module-card";
import { useModulesWithProgress, useStudyStreak } from "../hooks/use-academy";
import { useAuthStore } from "../stores/auth-store";
import { Flame, BookOpen, Trophy, Target, Sparkles, GraduationCap } from "lucide-react";

export function AcademyPage() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const { data: modules, isLoading } = useModulesWithProgress();
  const { data: streak } = useStudyStreak();

  return (
    <PageShell variant="arena">
      <SEOHead
        title="Academia de póker | Lecciones y entrenamiento"
        description="Aprende póker competitivo con módulos, lecciones y autoevaluaciones. Explora la Academia Sharkania y registra tu progreso."
        path="/academia"
      />
      <div className="arena-interior arena-editorial">
        <div className="arena-interior-container">

          <ArenaPageHero
            section="academy"
            eyebrow="APRENDIZAJE / ACADEMIA"
            heading="ACADEMIA"
            highlight="DE PÓKER."
            icon={GraduationCap}
            description="Explora los módulos de formación en póker competitivo. Avanza a tu ritmo, consulta las lecciones y registra tu progreso si inicias sesión."
            count={isLoading ? undefined : (modules?.length ?? 0)}
            countLabel="Módulos disponibles"
            action={<Link to="/glosario">Consultar el glosario <BookOpen size={16} /></Link>}
          />

          {/* Streak + Stats bar (solo logueado) */}
          {user && streak && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg px-4 py-3 text-center">
                <Flame size={18} className="text-sk-orange mx-auto mb-1" />
                <span className="font-mono text-sk-lg font-bold text-sk-text-1 block">
                  {streak.current_streak}
                </span>
                <span className="text-[10px] text-sk-text-3">Racha actual</span>
              </div>
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg px-4 py-3 text-center">
                <Trophy size={18} className="text-sk-gold mx-auto mb-1" />
                <span className="font-mono text-sk-lg font-bold text-sk-text-1 block">
                  {streak.longest_streak}
                </span>
                <span className="text-[10px] text-sk-text-3">Mejor racha</span>
              </div>
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg px-4 py-3 text-center">
                <BookOpen size={18} className="text-sk-accent mx-auto mb-1" />
                <span className="font-mono text-sk-lg font-bold text-sk-text-1 block">
                  {streak.total_lessons_completed}
                </span>
                <span className="text-[10px] text-sk-text-3">Completadas</span>
              </div>
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg px-4 py-3 text-center">
                <Target size={18} className="text-sk-green mx-auto mb-1" />
                <span className="font-mono text-sk-lg font-bold text-sk-text-1 block">
                  {streak.total_xp_earned}
                </span>
                <span className="text-[10px] text-sk-text-3">XP ganado</span>
              </div>
            </div>
          )}

          {/* Not logged in CTA */}
          {!user && (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-5 mb-8 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sk-sm font-semibold text-sk-text-1">
                  Inicia sesión para guardar tu progreso
                </p>
                <p className="text-[11px] text-sk-text-3">
                  Tu avance, XP y Shark Coins se vinculan a tu cuenta.
                </p>
              </div>
              <Link to="/register">
                <Button variant="accent" size="sm">Crear cuenta gratis</Button>
              </Link>
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {/* ══ MÓDULOS: DISEÑO DE ALTO VOLUMEN ══ */}
          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : modules && (
            <div className="mb-14">
              <div className="flex items-center gap-3 mb-8">
                <GraduationCap className="text-sk-accent" size={24} />
                <h2 className="text-sk-xl font-extrabold text-sk-text-1 tracking-tight uppercase">Ruta de Aprendizaje</h2>
                <span className="font-mono text-[11px] text-sk-text-3 ml-auto">
                  {modules.length} niveles de inteligencia
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map((m, i) => (
                  <ModuleCard 
                    key={m.id} 
                    module={m} 
                    index={i}
                    previousCompleted={true} // 🔥 AHORA SIEMPRE ESTÁN DESBLOQUEADOS
                    isSuperAdmin={profile?.role === "super_admin"}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ══ FILOSOFÍA SHARKANIA: PROTOCOLO DE ENTRENAMIENTO ══ */}
          <div className="arena-learning-panel mt-12 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sk-accent/5 blur-3xl rounded-full pointer-events-none" />
            
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-4 flex items-center gap-2">
              <Sparkles className="text-sk-gold" size={20} />
              Filosofía de Entrenamiento
            </h3>
            
            <div className="space-y-4 text-sk-sm text-sk-text-2 leading-relaxed relative z-10">
              <p>
                No somos una academia convencional con manuales obsoletos. En Sharkania creemos en un <strong className="text-sk-text-1">modelo de aprendizaje ágil, abierto y modular</strong>, diseñado para adaptarse al ritmo del grinder moderno. Tienes acceso completo e inmediato a todo nuestro arsenal táctico, permitiéndote consultar cualquier concepto técnico de forma libre y directa en el momento exacto en que lo necesites.
              </p>
              <p>
                Aunque puedes avanzar libremente entre lecciones, cada una cuenta con <strong className="text-sk-accent font-bold italic">quizzes de autoevaluación opcionales</strong> y misiones prácticas. No enseñamos teoría abstracta; entregamos herramientas de precisión letal que puedes aplicar en tu próxima sesión para transformar el conocimiento en ROI inmediato.
              </p>
              <div className="border-t border-sk-border-2 pt-4 mt-2">
                <p className="text-sk-text-3 font-mono text-[11px] uppercase tracking-[0.15em]">
                  Estructura: Acceso 100% libre y modular
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
