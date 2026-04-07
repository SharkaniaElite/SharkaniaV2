import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Lock, CheckCircle2, ChevronRight } from "lucide-react";
import type { ModuleWithProgress } from "../../lib/api/academy";

interface ModuleCardProps {
  module: ModuleWithProgress;
  index: number;
  previousCompleted: boolean;
}

// 1. Creamos un color por defecto seguro para que TypeScript no se asuste
const defaultColors = { border: "border-t-sk-accent", accent: "text-sk-accent", bg: "bg-sk-accent-dim" };

const LEVEL_COLORS: Record<string, typeof defaultColors> = {
  fundamentos: defaultColors,
  pensamiento: { border: "border-t-sk-green", accent: "text-sk-green", bg: "bg-sk-green-dim" },
  torneo: { border: "border-t-sk-gold", accent: "text-sk-gold", bg: "bg-sk-gold-dim" },
  mentalidad: { border: "border-t-sk-purple", accent: "text-sk-purple", bg: "bg-sk-purple-dim" },
  avanzado: { border: "border-t-sk-orange", accent: "text-sk-orange", bg: "bg-sk-orange-dim" },
  elite: { border: "border-t-sk-red", accent: "text-sk-red", bg: "bg-sk-red-dim" },
};

export function ModuleCard({ module: m, index, previousCompleted }: ModuleCardProps) {
  // 2. Usamos el defaultColors directo, lo que elimina el error de TypeScript
  const colors = LEVEL_COLORS[m.level] ?? defaultColors;
  const canAccess = m.isUnlocked && (index === 0 || previousCompleted);
  const progress = m.totalActiveLessons > 0
    ? Math.round((m.lessonsCompleted / m.totalActiveLessons) * 100)
    : 0;

  const content = (
    <div
      className={cn(
        "relative bg-sk-bg-2 border border-sk-border-2 border-t-2 rounded-lg p-6 transition-all duration-200",
        colors.border,
        canAccess
          ? "hover:border-sk-border-3 hover:shadow-sk-md hover:-translate-y-0.5 cursor-pointer"
          : "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Status icon (Derecha) */}
      <div className="absolute top-5 right-5">
        {m.isCompleted ? (
          <CheckCircle2 size={20} className="text-sk-green drop-shadow-sm" />
        ) : !m.isUnlocked ? (
          <div className="flex items-center gap-1.5 bg-sk-bg-3 px-2 py-1 rounded-md border border-sk-border-2 shadow-inner">
            <Lock size={12} className="text-sk-text-3" />
            {m.price_coins > 0 && (
              <span className="font-mono text-[10px] font-bold text-sk-text-2 flex items-center gap-1">
                {m.price_coins}
                <img 
                  src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif" 
                  alt="SC" 
                  className="w-3 h-3 drop-shadow-sm" 
                />
              </span>
            )}
          </div>
        ) : (
          <ChevronRight size={20} className="text-sk-text-4" />
        )}
      </div>

      {/* Eyebrow Tag: Nivel (Izquierda, ahora adentro de la tarjeta) */}
      <div className="mb-4">
        <span className={cn(
          "inline-flex items-center font-mono text-[10px] font-black tracking-[0.2em] uppercase px-2.5 py-1 rounded shadow-sm border border-black/10", 
          colors.bg, 
          colors.accent
        )}>
          NIVEL {index + 1}
        </span>
      </div>

      {/* Icon + Title */}
      <div className="flex items-start gap-3 mb-3 pr-14">
        <span className="text-2xl">{m.icon}</span>
        <div>
          <h3 className="text-sk-md font-bold text-sk-text-1 leading-tight">{m.title}</h3>
          {m.subtitle && (
            <p className="text-[11px] text-sk-text-3 mt-0.5">{m.subtitle}</p>
          )}
        </div>
      </div>

      {/* Description */}
      {m.description && (
        <p className="text-sk-xs text-sk-text-2 leading-relaxed mb-4 line-clamp-2">
          {m.description}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-4 text-[11px] text-sk-text-3 font-mono mb-3">
        <span>{m.total_lessons} lecciones</span>
        <span>~{m.estimated_minutes} min</span>
        {m.price_coins === 0 && <span className="text-sk-green font-semibold">GRATIS</span>}
      </div>

      {/* Progress bar */}
      {m.isUnlocked && m.totalActiveLessons > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-sk-text-3">
              {m.lessonsCompleted}/{m.totalActiveLessons} completadas
            </span>
            <span className={cn("font-semibold", progress === 100 ? "text-sk-green" : colors.accent)}>
              {progress}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-sk-bg-4 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                progress === 100 ? "bg-sk-green" : "bg-sk-accent"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (canAccess) {
    return <Link to={`/academia/${m.level}`}>{content}</Link>;
  }

  return content;
}