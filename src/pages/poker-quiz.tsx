// src/pages/poker-quiz.tsx
import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { ChevronRight, ChevronLeft, Share2, RotateCcw, Trophy, Target, Brain, Flame, Shield, Zap } from "lucide-react";
import { useFeatureAccess } from "../hooks/use-shop";
import { useAuthStore } from "../stores/auth-store";
import { FeaturePaywall } from "../components/shop/feature-paywall";
import { supabase } from "../lib/supabase";
// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

interface QuizOption {
  text: string;
  scores: Record<ProfileType, number>;
}

interface QuizQuestion {
  id: number;
  question: string;
  context: string;
  options: QuizOption[];
}

type ProfileType = "shark" | "grinder" | "strategist" | "tilter" | "nit" | "gambler";

interface ProfileResult {
  type: ProfileType;
  title: string;
  emoji: string;
  subtitle: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  tip: string;
  color: string;
  colorDim: string;
  icon: typeof Trophy;
  eloRange: string;
}

// ══════════════════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════════════════

const PROFILES: Record<ProfileType, ProfileResult> = {
  shark: {
    type: "shark",
    title: "El Tiburón",
    emoji: "🦈",
    subtitle: "Depredador calculador del field",
    description:
      "Eres el jugador que todos temen en la mesa. Combinas lectura de oponentes con ejecución fría. No solo juegas tus cartas — juegas a la gente. Tu edge viene de explotar los leaks ajenos mientras minimizas los propios.",
    strengths: ["Lectura de oponentes elite", "Adaptación dinámica", "Presión en spots clave", "Control emocional superior"],
    weaknesses: ["Puedes sobre-explotar fields regulares", "A veces complicas spots simples"],
    tip: "Tu siguiente nivel está en el estudio de GTO para balancear tu juego explotativo. Sharkania te muestra exactamente contra quién estás jugando.",
    color: "#22d3ee",
    colorDim: "rgba(34,211,238,0.10)",
    icon: Trophy,
    eloRange: "1600+",
  },
  grinder: {
    type: "grinder",
    title: "El Grinder",
    emoji: "⚙️",
    subtitle: "Máquina incansable de volumen",
    description:
      "Tu fuerza es la consistencia. Mientras otros buscan el gran score, tú acumulas ROI positivo torneo tras torneo. Tienes disciplina de hierro para la selección de torneos y el bankroll management.",
    strengths: ["Disciplina excepcional", "Selección de torneos óptima", "Bankroll management sólido", "Consistencia a largo plazo"],
    weaknesses: ["Puedes ser predecible en mesas regulares", "Te cuesta tomar riesgos en spots marginales"],
    tip: "Incorpora más creatividad en tu juego postflop. Usa el historial de Sharkania para identificar en qué tipos de torneo tienes mejor ROI.",
    color: "#34d399",
    colorDim: "rgba(52,211,153,0.10)",
    icon: Target,
    eloRange: "1400-1600",
  },
  strategist: {
    type: "strategist",
    title: "El Estratega",
    emoji: "🧠",
    subtitle: "Arquitecto de decisiones GTO",
    description:
      "Tu juego está construido sobre fundamentos teóricos sólidos. Estudias rangos, frecuencias y sizings como un científico. Tu edge es que tomas la decisión matemáticamente correcta más veces que nadie en la mesa.",
    strengths: ["Base teórica sólida (GTO)", "Decisiones consistentes", "Difícil de explotar", "Pensamiento a largo plazo"],
    weaknesses: ["Puedes no explotar suficiente a jugadores débiles", "Sobre-analizas spots simples"],
    tip: "Aprende a detectar cuándo alejarte de GTO. Los fields de clubes privados son más explotables de lo que piensas. Compara tu ITM% vs el field en Sharkania.",
    color: "#a78bfa",
    colorDim: "rgba(167,139,250,0.10)",
    icon: Brain,
    eloRange: "1450-1650",
  },
  tilter: {
    type: "tilter",
    title: "El Volcánico",
    emoji: "🌋",
    subtitle: "Talento sin brida emocional",
    description:
      "Tienes flashes de brillantez que pocos jugadores pueden igualar — pero también momentos de autodestrucción que te cuestan buyins. Tu potencial es enorme, pero tu mayor oponente eres tú mismo.",
    strengths: ["Creatividad explosiva", "Capaz de jugadas brillantes", "Intuitivo en lectura de tells", "Alto potencial de mejora"],
    weaknesses: ["Tilt frecuente tras bad beats", "Decisiones impulsivas bajo presión", "Bankroll management errático"],
    tip: "Tu ROI podría duplicarse solo controlando el tilt. Trackea tus sesiones en Sharkania y verás el patrón: tus peores resultados vienen después de bad beats, no de malas decisiones.",
    color: "#f87171",
    colorDim: "rgba(248,113,113,0.10)",
    icon: Flame,
    eloRange: "1200-1500",
  },
  nit: {
    type: "nit",
    title: "El Fortín",
    emoji: "🏰",
    subtitle: "Sólido como roca, difícil de mover",
    description:
      "Tu juego es una fortaleza. Juegas rangos tight, evitas spots marginales y esperas a que tus oponentes cometan errores. Tu paciencia es tu arma — pero a veces la fortaleza se convierte en prisión.",
    strengths: ["Extremadamente difícil de sacar de su juego", "Pérdidas mínimas en sesiones malas", "Paciencia infinita", "Buenas decisiones preflop"],
    weaknesses: ["Muy predecible para regulares", "Pierde equity al no defender lo suficiente", "Pocas oportunidades de grandes scores"],
    tip: "Amplía tus rangos de apertura en posición tardía y defiende más tu big blind. El ELO de Sharkania premia la consistencia — pero también el volumen.",
    color: "#fbbf24",
    colorDim: "rgba(251,191,36,0.10)",
    icon: Shield,
    eloRange: "1300-1500",
  },
  gambler: {
    type: "gambler",
    title: "El Apostador",
    emoji: "🎲",
    subtitle: "All-in a la vida, all-in en la mesa",
    description:
      "Para ti el poker es adrenalina pura. Buscas los spots más grandes, las jugadas más arriesgadas, los torneos con más varianza. Cuando te sale bien, eres leyenda. Cuando no, necesitas recargar.",
    strengths: ["Sin miedo a situaciones de alta presión", "Capaz de acumular stacks enormes", "Impredecible para oponentes", "Mentalidad de ganador"],
    weaknesses: ["Varianza extrema en resultados", "Bankroll management cuestionable", "Selectividad de spots deficiente"],
    tip: "Canaliza esa energía. Estudia ICM para saber cuándo tu agresividad tiene +EV y cuándo es una fuga. Compara tu volatilidad vs tu ROI real en Sharkania.",
    color: "#fb923c",
    colorDim: "rgba(251,146,60,0.10)",
    icon: Zap,
    eloRange: "1100-1600",
  },
};

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "Estás en la burbuja de un MTT. Tienes stack promedio. El chip leader te sube all-in. Tienes AQs.",
    context: "Queda 1 jugador para que todos cobren.",
    options: [
      { text: "Call instantáneo. AQs es demasiado fuerte para foldear aquí.", scores: { shark: 1, grinder: 0, strategist: 0, tilter: 1, nit: -1, gambler: 2 } },
      { text: "Fold. La presión ICM hace que este call sea -EV contra su rango.", scores: { shark: 0, grinder: 2, strategist: 2, tilter: -1, nit: 2, gambler: -1 } },
      { text: "Depende — miro sus stats y tamaño de stack antes de decidir.", scores: { shark: 2, grinder: 1, strategist: 1, tilter: 0, nit: 0, gambler: 0 } },
      { text: "Call. Vine a ganar, no a cobrar el mínimo.", scores: { shark: 0, grinder: -1, strategist: -1, tilter: 1, nit: -2, gambler: 2 } },
    ],
  },
  {
    id: 2,
    question: "Pierdes 3 buy-ins seguidos en una noche. ¿Qué haces?",
    context: "Tu bankroll puede absorberlo sin problemas.",
    options: [
      { text: "Paro. Mañana es otro día. Mi regla es máximo 3 buy-ins por sesión.", scores: { shark: 1, grinder: 2, strategist: 1, tilter: -1, nit: 2, gambler: -1 } },
      { text: "Sigo jugando pero bajo el buy-in para recuperar confianza.", scores: { shark: 0, grinder: 1, strategist: 0, tilter: 0, nit: 1, gambler: 0 } },
      { text: "Analizo las manos — si jugué bien, sigo. Si no, paro.", scores: { shark: 2, grinder: 1, strategist: 2, tilter: 0, nit: 0, gambler: 0 } },
      { text: "Subo el buy-in. Necesito recuperar rápido lo perdido.", scores: { shark: -1, grinder: -2, strategist: -2, tilter: 2, nit: -2, gambler: 2 } },
    ],
  },
  {
    id: 3,
    question: "Tu rival habitual te ha ganado los últimos 3 enfrentamientos directos. ¿Cómo reaccionas?",
    context: "Lo ves regularmente en los mismos torneos de tu club.",
    options: [
      { text: "Estudio sus manos y busco sus leaks para explotarlo.", scores: { shark: 2, grinder: 1, strategist: 1, tilter: 0, nit: 0, gambler: 0 } },
      { text: "Me da igual — juego mi juego sin importar quién esté en la mesa.", scores: { shark: 0, grinder: 2, strategist: 0, tilter: 0, nit: 1, gambler: 0 } },
      { text: "Reviso la teoría para asegurarme de que estoy jugando GTO.", scores: { shark: 0, grinder: 0, strategist: 2, tilter: 0, nit: 1, gambler: 0 } },
      { text: "La próxima vez que lo vea voy a 3-betear todo contra él.", scores: { shark: -1, grinder: -1, strategist: -1, tilter: 2, nit: -1, gambler: 1 } },
    ],
  },
  {
    id: 4,
    question: "Tienes la opción de jugar un torneo freeroll o uno de buy-in alto con GTD enorme. ¿Cuál eliges?",
    context: "El freeroll es de tu club habitual. El buy-in alto es 10% de tu bankroll.",
    options: [
      { text: "El buy-in alto. Los fields más caros son donde mejor edge tengo.", scores: { shark: 2, grinder: 0, strategist: 0, tilter: 0, nit: -1, gambler: 1 } },
      { text: "El freeroll. ROI infinito y sin riesgo.", scores: { shark: 0, grinder: 1, strategist: 0, tilter: 0, nit: 2, gambler: -1 } },
      { text: "Calculo el EV esperado de ambos y voy al que tiene mejor expectativa.", scores: { shark: 1, grinder: 1, strategist: 2, tilter: 0, nit: 0, gambler: 0 } },
      { text: "El buy-in alto sin pensarlo. Los grandes premios están en los grandes torneos.", scores: { shark: 0, grinder: -1, strategist: -1, tilter: 0, nit: -2, gambler: 2 } },
    ],
  },
  {
    id: 5,
    question: "Estás en mesa final con 4 jugadores. Eres segundo en chips. ¿Cuál es tu prioridad?",
    context: "La diferencia entre 1° y 4° es significativa.",
    options: [
      { text: "Presionar al 3° y 4° para eliminarlos y llegar heads-up como líder.", scores: { shark: 2, grinder: 0, strategist: 0, tilter: 0, nit: 0, gambler: 1 } },
      { text: "Jugar tight y dejar que los stacks cortos se eliminen entre ellos.", scores: { shark: 0, grinder: 1, strategist: 1, tilter: 0, nit: 2, gambler: -1 } },
      { text: "Ajustar según los rangos y stacks efectivos de cada rival.", scores: { shark: 1, grinder: 1, strategist: 2, tilter: 0, nit: 0, gambler: 0 } },
      { text: "Ir a por todas. En mesa final solo importa el primer puesto.", scores: { shark: 0, grinder: -1, strategist: -1, tilter: 1, nit: -2, gambler: 2 } },
    ],
  },
  {
    id: 6,
    question: "¿Cómo te preparas antes de una sesión importante de torneos?",
    context: "Tienes 3 torneos seguidos esta noche.",
    options: [
      { text: "Reviso los campos: quién está registrado, sus stats, sus tendencias.", scores: { shark: 2, grinder: 1, strategist: 0, tilter: 0, nit: 0, gambler: 0 } },
      { text: "Nada especial. Confío en mi proceso y sigo mi rutina.", scores: { shark: 0, grinder: 2, strategist: 0, tilter: 0, nit: 1, gambler: 0 } },
      { text: "Repaso mi base de datos de manos y estudio spots problemáticos.", scores: { shark: 0, grinder: 0, strategist: 2, tilter: 0, nit: 1, gambler: 0 } },
      { text: "Me pongo música, agarro algo para comer y me lanzo.", scores: { shark: 0, grinder: 0, strategist: -1, tilter: 1, nit: 0, gambler: 2 } },
    ],
  },
  {
    id: 7,
    question: "Llevas AK en el botón. 3 jugadores ven el flop: Q-7-2 rainbow. ¿Qué haces?",
    context: "El bote tiene 6bb. Tú tienes 45bb efectivos.",
    options: [
      { text: "C-bet 1/3 del bote. Mantengo presión con mi posición y equity.", scores: { shark: 2, grinder: 1, strategist: 1, tilter: 0, nit: 0, gambler: 0 } },
      { text: "Check. No conecté y hay 3 rivales — no voy a quemar chips.", scores: { shark: 0, grinder: 0, strategist: 0, tilter: 0, nit: 2, gambler: -1 } },
      { text: "C-bet 2/3. Si nadie tiene Q, me lo llevo. Si alguien tiene Q, lo descubro barato.", scores: { shark: 1, grinder: 0, strategist: 0, tilter: 1, nit: -1, gambler: 1 } },
      { text: "Depende del perfil de los 3 rivales — contra nits c-bet grande, contra calling stations check.", scores: { shark: 2, grinder: 0, strategist: 2, tilter: 0, nit: 0, gambler: 0 } },
    ],
  },
  {
    id: 8,
    question: "Un amigo te ofrece staking: él paga tus buy-ins y se lleva el 50% de tus ganancias. ¿Aceptas?",
    context: "Tu bankroll actual te permite jugar cómodo los torneos que juegas.",
    options: [
      { text: "Sí, pero negocio un mejor deal — 60/40 a mi favor basándome en mi historial.", scores: { shark: 2, grinder: 1, strategist: 0, tilter: 0, nit: 0, gambler: 0 } },
      { text: "No. Prefiero jugar con mi propio bankroll y quedarme con todo.", scores: { shark: 0, grinder: 2, strategist: 0, tilter: 0, nit: 2, gambler: 0 } },
      { text: "Acepto solo si me permite subir de buy-in y maximizar mi EV esperado.", scores: { shark: 1, grinder: 0, strategist: 2, tilter: 0, nit: 0, gambler: 1 } },
      { text: "Acepto. Con staking puedo jugar los torneos grandes sin arriesgar mi plata.", scores: { shark: 0, grinder: 0, strategist: 0, tilter: 0, nit: 0, gambler: 2 } },
    ],
  },
  {
    id: 9,
    question: "¿Qué métrica de poker consideras MÁS importante para medir tu nivel?",
    context: "Solo puedes elegir una.",
    options: [
      { text: "ROI — cuánto gano por cada dólar invertido.", scores: { shark: 1, grinder: 2, strategist: 1, tilter: 0, nit: 1, gambler: 0 } },
      { text: "ITM% — mi consistencia para cobrar.", scores: { shark: 0, grinder: 1, strategist: 0, tilter: 0, nit: 2, gambler: -1 } },
      { text: "ELO — mi rendimiento ajustado contra la fuerza del field.", scores: { shark: 2, grinder: 0, strategist: 2, tilter: 0, nit: 0, gambler: 0 } },
      { text: "Dinero total ganado. Al final, lo que importa es la plata.", scores: { shark: 0, grinder: 0, strategist: -1, tilter: 1, nit: -1, gambler: 2 } },
    ],
  },
  {
    id: 10,
    question: "¿Cuál es tu motivación principal para jugar poker?",
    context: "Sé honesto, nadie te juzga.",
    options: [
      { text: "Superar a mis rivales. Me obsesiona ser el mejor de mi mesa.", scores: { shark: 2, grinder: 0, strategist: 0, tilter: 1, nit: 0, gambler: 0 } },
      { text: "Generar ingresos consistentes. Es mi trabajo o segunda fuente.", scores: { shark: 0, grinder: 2, strategist: 1, tilter: 0, nit: 1, gambler: 0 } },
      { text: "El desafío intelectual. Me fascina la complejidad del juego.", scores: { shark: 0, grinder: 0, strategist: 2, tilter: 0, nit: 0, gambler: 0 } },
      { text: "La emoción. No hay nada como la adrenalina de un all-in.", scores: { shark: 0, grinder: -1, strategist: -1, tilter: 1, nit: -1, gambler: 2 } },
    ],
  },
];

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function calculateResult(answers: Record<number, number>): ProfileResult {
  const totals: Record<ProfileType, number> = {
    shark: 0, grinder: 0, strategist: 0, tilter: 0, nit: 0, gambler: 0,
  };

  Object.entries(answers).forEach(([questionIdx, optionIdx]) => {
    const q = QUESTIONS[Number(questionIdx)];
    if (!q) return;
    const option = q.options[optionIdx];
    if (!option) return;
    (Object.keys(option.scores) as ProfileType[]).forEach((profile) => {
      totals[profile] += option.scores[profile];
    });
  });

  const winner = (Object.keys(totals) as ProfileType[]).reduce((a, b) =>
    totals[a] >= totals[b] ? a : b
  );

  return PROFILES[winner];
}

function getSecondaryProfile(answers: Record<number, number>, primary: ProfileType): ProfileResult {
  const totals: Record<ProfileType, number> = {
    shark: 0, grinder: 0, strategist: 0, tilter: 0, nit: 0, gambler: 0,
  };

  Object.entries(answers).forEach(([questionIdx, optionIdx]) => {
    const q = QUESTIONS[Number(questionIdx)];
    if (!q) return;
    const option = q.options[optionIdx];
    if (!option) return;
    (Object.keys(option.scores) as ProfileType[]).forEach((profile) => {
      totals[profile] += option.scores[profile];
    });
  });

  delete (totals as Partial<Record<ProfileType, number>>)[primary];

  const second = (Object.keys(totals) as ProfileType[]).reduce((a, b) =>
    (totals[a] ?? 0) >= (totals[b] ?? 0) ? a : b
  );

  return PROFILES[second];
}

// ══════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = ((current + 1) / total) * 100;
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="font-mono text-[11px] font-semibold text-sk-text-3 uppercase tracking-wide">
          Pregunta {current + 1} de {total}
        </span>
        <span className="font-mono text-[11px] font-bold text-sk-accent">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="h-1.5 bg-sk-bg-3 rounded-full overflow-hidden">
        <div
          className="h-full bg-sk-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  selectedOption,
  onSelect,
}: {
  question: QuizQuestion;
  selectedOption: number | undefined;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="animate-fadeIn">
      <p className="text-sk-xs text-sk-accent font-mono font-semibold uppercase tracking-widest mb-3">
        Situación
      </p>
      <h2 className="text-sk-lg font-bold text-sk-text-1 leading-snug mb-2">
        {question.question}
      </h2>
      <p className="text-sk-sm text-sk-text-3 mb-6 italic">
        {question.context}
      </p>

      <div className="flex flex-col gap-2.5">
        {question.options.map((option, idx) => {
          const isSelected = selectedOption === idx;
          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              className={`w-full text-left px-4 py-3.5 rounded-lg border transition-all duration-200 ${
                isSelected
                  ? "bg-sk-accent/10 border-sk-accent/30 text-sk-text-1"
                  : "bg-sk-bg-2 border-sk-border-2 text-sk-text-2 hover:border-sk-border-3 hover:bg-sk-bg-3"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? "border-sk-accent bg-sk-accent"
                      : "border-sk-border-3"
                  }`}
                >
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <path
                        d="M2 5L4.5 7.5L8 3"
                        fill="none"
                        stroke="#09090b"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="text-sk-sm font-medium leading-snug">
                  {option.text}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({
  result,
  secondary,
  onRestart,
}: {
  result: ProfileResult;
  secondary: ProfileResult;
  onRestart: () => void;
}) {
  // Eliminamos IconComponent porque ya usas result.emoji en el diseño visual
  const shareText = `Soy "${result.title}" en el quiz de perfil de poker de Sharkania. ¿Y tú qué tipo de jugador eres? 🦈`;
  const shareUrl = "https://sharkania.com/tools/quiz";

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: `${result.title} — Quiz Sharkania`, text: shareText, url: shareUrl });
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      alert("Link copiado al portapapeles");
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* Result Header */}
      <div
        className="rounded-xl border p-6 mb-6 text-center"
        style={{ borderColor: `${result.color}30`, background: result.colorDim }}
      >
        <span className="text-5xl mb-3 block">{result.emoji}</span>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: result.color }}>
          Tu perfil de jugador
        </p>
        <h2 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight mb-1">
          {result.title}
        </h2>
        <p className="text-sk-sm text-sk-text-2">{result.subtitle}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-3 py-1 rounded-full" style={{ background: `${result.color}20`, color: result.color }}>
          ELO estimado: {result.eloRange}
        </div>
      </div>

      {/* Description */}
      <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-5 mb-4">
        <p className="text-sk-base text-sk-text-2 leading-relaxed">
          {result.description}
        </p>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-green mb-3">
            Fortalezas
          </p>
          <ul className="space-y-2">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sk-sm text-sk-text-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-green shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-red mb-3">
            Debilidades
          </p>
          <ul className="space-y-2">
            {result.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sk-sm text-sk-text-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-red shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tip */}
      <div className="rounded-lg border px-5 py-4 mb-4" style={{ borderColor: `${result.color}25`, background: result.colorDim }}>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: result.color }}>
          Consejo para tu siguiente nivel
        </p>
        <p className="text-sk-sm text-sk-text-2 leading-relaxed">{result.tip}</p>
      </div>

      {/* Secondary Profile */}
      <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4 mb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3 mb-2">
          Tu perfil secundario
        </p>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{secondary.emoji}</span>
          <div>
            <p className="text-sk-sm font-bold text-sk-text-1">{secondary.title}</p>
            <p className="text-sk-xs text-sk-text-3">{secondary.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleShare}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sk-sm font-bold transition-colors"
          style={{ background: result.color, color: "#09090b" }}
        >
          <Share2 size={16} />
          Compartir mi resultado
        </button>
        <button
          onClick={onRestart}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-sk-bg-3 border border-sk-border-2 text-sk-sm font-semibold text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 transition-colors"
        >
          <RotateCcw size={16} />
          Hacer el quiz otra vez
        </button>
      </div>

      {/* CTA */}
      <div className="mt-8 rounded-xl border border-sk-border-2 bg-sk-bg-2 p-6 text-center">
        <p className="text-sk-xs font-mono font-semibold uppercase tracking-widest text-sk-accent mb-2">
          Descubre tu ELO real
        </p>
        <h3 className="text-sk-lg font-extrabold text-sk-text-1 tracking-tight mb-2">
          Registra tu club y compite en el ranking global
        </h3>
        <p className="text-sk-sm text-sk-text-2 mb-4 max-w-md mx-auto">
          Sharkania calcula tu ELO basándose en tus resultados reales.
          Los primeros clubes acceden gratis de por vida.
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sk-accent text-sk-bg-0 text-sk-sm font-bold hover:bg-sk-accent-hover transition-colors"
        >
          Crear cuenta gratis <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════

export function PokerQuizPage() {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);

  const handleSelect = useCallback(
    (optionIdx: number) => {
      setAnswers((prev) => ({ ...prev, [currentQ]: optionIdx }));
    },
    [currentQ]
  );

  const handleNext = () => {
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ((p) => p + 1);
    } else {
      handleFinishQuiz();
    }
  };

  const handlePrev = () => {
    if (currentQ > 0) setCurrentQ((p) => p - 1);
  };

  const handleRestart = () => {
    setAnswers({});
    setCurrentQ(0);
    setShowResult(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  

  const result = showResult ? calculateResult(answers) : null;
  const secondary = showResult && result ? getSecondaryProfile(answers, result.type) : null;
  
// ── Premium access control ──
  const { isAuthenticated, user } = useAuthStore();
  const { data: access } = useFeatureAccess("tool_quiz");
  const hasFullAccess = access?.has_access ?? false;

  const [freeUsed, setFreeUsed] = useState(false);
  const [isCheckingDB, setIsCheckingDB] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user || hasFullAccess) return;
    const checkUsage = async () => {
      const { data } = await supabase
        .from('free_tool_usages')
        .select('last_used_date')
        .eq('user_id', user.id)
        .eq('tool_id', 'tool_quiz')
        .single();
      const today = new Date().toISOString().split("T")[0];
      if (data && data.last_used_date === today) setFreeUsed(true);
    };
    checkUsage();
  }, [isAuthenticated, user, hasFullAccess]);

  const needsPaywall = isAuthenticated && freeUsed && !hasFullAccess;

  const handleFinishQuiz = async () => {
    if (isCheckingDB) return;
    if (hasFullAccess) { setShowResult(true); return; }
    if (freeUsed) { return; } // blocked
    if (!isAuthenticated || !user) { setShowResult(true); setFreeUsed(true); return; }

    setIsCheckingDB(true);
    const { data: success } = await supabase.rpc('use_free_tool', {
      p_user_id: user.id,
      p_tool_id: 'tool_quiz'
    });
    setIsCheckingDB(false);

    if (success) { setShowResult(true); setFreeUsed(true); }
    else { setFreeUsed(true); }
  };

  return (
    <PageShell>
      <SEOHead
        title="Quiz: ¿Qué tipo de jugador de poker eres?"
        description="Descubre tu perfil de jugador con el quiz de Sharkania. 10 preguntas de situaciones reales. Resultado compartible."
        path="/tools/quiz"
        ogImage="https://sharkania.com/images/tools/og-tool-quiz.png"
      />

      <div className="pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-6">
          {!showResult ? (
            <>
              {/* Paywall — si ya usó su turno gratis */}
              {needsPaywall && (
                <div className="mb-8">
                  <FeaturePaywall
                    featureKey="tool_quiz"
                    title="Quiz completo ilimitado"
                    description="Ya usaste tu quiz gratis de hoy. Desbloquea acceso completo con SharkCoins."
                  >
                    <></>
                  </FeaturePaywall>
                </div>
              )}

              {/* Header (solo en primera pregunta) */}
              {currentQ === 0 && answers[0] === undefined && (
                <div className="text-center mb-8">
                  <span className="text-4xl mb-3 block">🃏</span>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-sk-accent mb-2">
                    Quiz de perfil
                  </p>
                  <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight mb-2">
                    ¿Qué tipo de jugador de poker eres?
                  </h1>
                  <p className="text-sk-sm text-sk-text-2 max-w-md mx-auto">
                    10 situaciones reales de torneo. Responde con honestidad y
                    descubre tu perfil competitivo.
                  </p>
                </div>
              )}

              {/* Progress */}
              <div className="mb-6">
                <ProgressBar current={currentQ} total={QUESTIONS.length} />
              </div>

              {/* Question */}
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5 sm:p-6 mb-6">
                <QuestionCard
                  question={QUESTIONS[currentQ]!} // 👈 Le agregamos el "!" aquí
                  selectedOption={answers[currentQ]}
                  onSelect={handleSelect}
                />
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center">
                <button
                  onClick={handlePrev}
                  disabled={currentQ === 0}
                  className="inline-flex items-center gap-1.5 text-sk-sm font-medium text-sk-text-3 hover:text-sk-text-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>

                <Button
                  variant="accent"
                  size="md"
                  onClick={handleNext}
                  disabled={answers[currentQ] === undefined}
                  className="min-w-[140px]"
                >
                  {currentQ === QUESTIONS.length - 1 ? "Ver resultado" : "Siguiente"}
                  <ChevronRight size={16} />
                </Button>
              </div>
            </>
          ) : (
            result &&
            secondary && (
              <ResultCard
                result={result}
                secondary={secondary}
                onRestart={handleRestart}
              />
            )
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.35s ease-out;
        }
      `}</style>
    </PageShell>
  );
}
