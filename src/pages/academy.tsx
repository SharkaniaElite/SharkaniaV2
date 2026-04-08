// src/pages/academy.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { SEOHead } from "../components/seo/seo-head";
import { ModuleCard } from "../components/academy/module-card";
import { useModulesWithProgress, useStudyStreak } from "../hooks/use-academy";
import { useAuthStore } from "../stores/auth-store";
import { Flame, BookOpen, Trophy, Target, Lock, Sparkles, GraduationCap } from "lucide-react";

export function AcademyPage() {
  const [mascotId] = useState(() => Math.floor(Math.random() * 10) + 1);
  const user = useAuthStore((s) => s.user);
  const { data: modules, isLoading } = useModulesWithProgress();
  const { data: streak } = useStudyStreak();

  return (
    <PageShell>
      <SEOHead
        title="Academia — Aprende Poker Competitivo"
        description="Aprende Texas Hold'em desde cero hasta nivel élite. Lecciones interactivas, quizzes obligatorios y sistema de progresión diseñado para que realmente mejores."
        path="/academia"
      />
      <div className="pt-20 pb-16">
        <div className="max-w-[900px] mx-auto px-6">

          {/* ══ HERO ACADEMY: ESTILO LA BÓVEDA ══ */}
          <div className="bg-sk-bg-2 border border-sk-gold/20 rounded-2xl p-6 md:p-10 mb-10 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group shadow-[0_0_30px_rgba(251,191,36,0.05)]">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-sk-gold/5 blur-[50px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-sk-gold/20 to-transparent" />

            <div className="shrink-0 relative z-10">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-sk-accent/10 blur-xl rounded-full scale-150 group-hover:bg-sk-gold/15 transition-colors duration-500" />
                <img 
                  src={`/mascot/shark-${mascotId}.webp`} 
                  alt="Sharkania Academy Instructor" 
                  className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left relative z-10">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                <Lock className="text-sk-gold" size={16} />
                <p className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-sk-gold">
                  CENTRAL DE INTELIGENCIA · NIVEL: LA BÓVEDA
                </p>
                <Sparkles className="text-sk-gold animate-pulse" size={16} />
              </div>

              <h1 className="text-sk-3xl md:text-sk-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-sk-text-1 to-sk-text-4 mb-4 leading-none">
                Sharkania Academy
              </h1>

              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed">
                <strong className="text-sk-text-1">"En Sharkania no regalamos la llave; te enseñamos a forjarla."</strong>
              </p>
              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed mt-2">
                Domina los MTTs con nuestra ruta de 6 niveles diseñada para resultados inmediatos.
              </p>
            </div>
          </div>

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
                    previousCompleted={i === 0 || (modules[i - 1]?.isCompleted ?? false)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ══ FILOSOFÍA SHARKANIA: PROTOCOLO DE ENTRENAMIENTO ══ */}
          <div className="mt-12 bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-8 relative overflow-hidden shadow-sk-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sk-accent/5 blur-3xl rounded-full pointer-events-none" />
            
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-4 flex items-center gap-2">
              <Sparkles className="text-sk-gold" size={20} />
              Filosofía de Entrenamiento
            </h3>
            
            <div className="space-y-4 text-sk-sm text-sk-text-2 leading-relaxed relative z-10">
              <p>
                No somos una academia más. Cada lección termina con un quiz de precisión letal donde necesitas <strong className="text-sk-text-1">100% de efectividad para avanzar</strong>. No es por ser duros — es porque en la mesa, un error del 20% te cuesta el torneo.
              </p>
              <p>
                Cada concepto viene con una <strong className="text-sk-accent font-bold italic">Misión en Mesa</strong> concreta. No enseñamos teoría abstracta; entregamos arsenal táctico aplicable desde tu próxima sesión.
              </p>
              <div className="border-t border-sk-border-2 pt-4 mt-2">
                <p className="text-sk-text-3 font-mono text-[11px] uppercase tracking-[0.15em]">
                  Estructura: Nivel 1 (Acceso Abierto) · Niveles 2-6 (Desbloqueo vía SC)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
