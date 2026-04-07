// src/components/academy/quiz-component.tsx
import { useState } from "react";
import { cn } from "../../lib/cn";
import { Button } from "../ui/button";
import { CheckCircle2, XCircle, RotateCcw, Trophy, ArrowRight } from "lucide-react";
import type { QuizQuestion, CompleteLessonResult } from "../../lib/api/academy";

interface QuizComponentProps {
  questions: QuizQuestion[];
  lessonId: string;
  alreadyPassed: boolean;
  onComplete: (answers: Record<string, number>) => Promise<CompleteLessonResult>;
  onRetry: (answers: Record<string, number>) => Promise<void>;
  onNextLesson?: () => void;
}

type QuizState = "idle" | "answering" | "reviewing" | "passed" | "failed";

export function QuizComponent({
  questions,
  alreadyPassed,
  onComplete,
  onRetry,
  onNextLesson,
}: QuizComponentProps) {
  const [state, setState] = useState<QuizState>(alreadyPassed ? "passed" : "idle");
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [results, setResults] = useState<boolean[]>([]);
  const [completionData, setCompletionData] = useState<CompleteLessonResult | null>(null);
  const [loading, setLoading] = useState(false);

  const allAnswered = Object.keys(answers).length === questions.length;
  const correctCount = results.filter(Boolean).length;

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    if (state !== "idle" && state !== "answering") return;
    setState("answering");
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const handleSubmit = async () => {
    if (!allAnswered) return;

    // Check answers
    const newResults = questions.map((q, i) => answers[i] === q.correct);
    setResults(newResults);

    const allPassed = newResults.every(Boolean);

    if (allPassed) {
      setLoading(true);
      const answersRecord: Record<string, number> = {};
      Object.entries(answers).forEach(([k, v]) => {
        answersRecord[k] = v;
      });

      const result = await onComplete(answersRecord);
      setCompletionData(result);
      setState("passed");
      setLoading(false);
    } else {
      const answersRecord: Record<string, number> = {};
      Object.entries(answers).forEach(([k, v]) => {
        answersRecord[k] = v;
      });
      await onRetry(answersRecord);
      setState("failed");
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setResults([]);
    setState("idle");
  };

  // Already passed state
  if (state === "passed" && alreadyPassed && !completionData) {
    return (
      <div className="bg-sk-bg-2 border border-sk-green/20 rounded-lg p-6 text-center">
        <CheckCircle2 size={40} className="text-sk-green mx-auto mb-3" />
        <h3 className="text-sk-md font-bold text-sk-text-1 mb-1">Quiz completado</h3>
        <p className="text-sk-xs text-sk-text-3">Ya pasaste esta prueba con 100% correcto.</p>
        {onNextLesson && (
          <Button variant="accent" size="md" className="mt-4" onClick={onNextLesson}>
            Avanzar a la siguiente lección <ArrowRight size={14} />
          </Button>
        )}
      </div>
    );
  }

  // Just passed - celebration
  if (state === "passed" && completionData?.success) {
    return (
      <div className="bg-sk-bg-2 border border-sk-green/20 rounded-lg p-8 text-center">
        <div className="relative inline-block mb-4">
          <Trophy size={48} className="text-sk-gold" />
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-sk-green rounded-full flex items-center justify-center">
            <CheckCircle2 size={12} className="text-white" />
          </div>
        </div>

        <h3 className="text-sk-xl font-extrabold text-sk-text-1 mb-2">
          ¡Perfecto! 5/5 correctas
        </h3>
        <p className="text-sk-sm text-sk-text-2 mb-6">
          Demostraste que entiendes los conceptos. Estás listo para el siguiente paso.
        </p>

        {/* Rewards */}
        <div className="flex justify-center gap-4 mb-6">
          {completionData.xp_earned && (
            <div className="bg-sk-bg-3 border border-sk-border-2 rounded-lg px-4 py-2">
              <span className="font-mono text-sk-lg font-bold text-sk-accent">
                +{completionData.xp_earned}
              </span>
              <span className="text-[10px] text-sk-text-3 block">XP</span>
            </div>
          )}
          {completionData.coins_earned && (
            <div className="bg-sk-bg-3 border border-sk-border-2 rounded-lg px-4 py-2 flex flex-col items-center">
              <span className="font-mono text-sk-lg font-bold text-sk-gold flex items-center gap-1.5">
                +{completionData.coins_earned}
                <img 
                  src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif" 
                  alt="Shark Coin" 
                  className="w-5 h-5 drop-shadow-md" 
                />
              </span>
              <span className="text-[10px] text-sk-text-3 block mt-0.5 uppercase tracking-wider">Shark Coins</span>
            </div>
          )}
          {completionData.current_streak && completionData.current_streak > 1 && (
            <div className="bg-sk-bg-3 border border-sk-border-2 rounded-lg px-4 py-2">
              <span className="font-mono text-sk-lg font-bold text-sk-orange">
                🔥 {completionData.current_streak}
              </span>
              <span className="text-[10px] text-sk-text-3 block">días seguidos</span>
            </div>
          )}
        </div>

        {completionData.module_completed && (
          <div className="bg-sk-gold-dim border border-sk-gold/20 rounded-lg px-4 py-3 mb-4">
            <p className="text-sk-sm font-bold text-sk-gold">
              🏆 ¡Módulo completado!
            </p>
            <p className="text-[11px] text-sk-text-2">
              Has completado todas las lecciones de este nivel.
            </p>
          </div>
        )}

        {onNextLesson && (
          <Button variant="accent" size="lg" onClick={onNextLesson}>
            {completionData?.module_completed ? "Volver a la Academia" : "Avanzar a la siguiente lección"} <ArrowRight size={14} />
          </Button>
        )}
      </div>
    );
  }

  // Failed state
  if (state === "failed") {
    return (
      <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg overflow-hidden">
       {/* ══ HEADER FAILED: CANDIDEZ RADICAL ══ */}
        <div className="bg-sk-red-dim/30 border-b border-sk-red/20 px-6 py-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-sk-red/10 blur-3xl rounded-full pointer-events-none" />
          <XCircle size={36} className="text-sk-red mx-auto mb-3 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)] relative z-10" />
          <h3 className="text-xl md:text-2xl font-black text-sk-text-1 mb-2 tracking-tight relative z-10">
            {correctCount}/{questions.length} correctas — Se requiere precisión del 100%
          </h3>
          <div className="bg-sk-bg-1/50 rounded-lg p-4 mt-4 border border-sk-red/10 max-w-lg mx-auto relative z-10">
            <p className="text-sk-sm text-sk-text-2 leading-relaxed">
              "En el poker, un error del 20% en tu rango te cuesta el torneo. Aquí es igual. No te dejamos avanzar porque <strong className="text-sk-text-1">tu bankroll futuro nos importa</strong>. Revisa el análisis de tus errores abajo y vuelve a intentarlo con la mente fría."
            </p>
          </div>
        </div>

        {/* Show wrong answers with explanations */}
        <div className="p-6 space-y-4">
          {questions.map((q, i) => {
            const isCorrect = results[i];
            if (isCorrect) return null;

            return (
              <div key={i} className="bg-sk-bg-3 border border-sk-red/10 rounded-lg p-4">
                <p className="text-sk-sm font-semibold text-sk-text-1 mb-2">
                  {q.question}
                </p>
                <p className="text-sk-xs text-sk-red mb-1">
                  ✗ Tu respuesta: {q.options[answers[i]!]}
                </p>
                <p className="text-sk-xs text-sk-green mb-2">
                  ✓ Respuesta correcta: {q.options[q.correct]}
                </p>
                <p className="text-[11px] text-sk-text-3 italic">
                  {q.explanation}
                </p>
              </div>
            );
          })}
        </div>

        <div className="px-6 pb-6 text-center">
          <Button variant="accent" size="md" onClick={handleRetry}>
            <RotateCcw size={14} /> Reintentar quiz
          </Button>
        </div>
      </div>
    );
  }

  // Quiz in progress
  return (
    <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg overflow-hidden">
      {/* ══ HEADER QUIZ ACTIVO: ESTILO BÓVEDA ══ */}
      <div className="bg-sk-bg-3 border-b border-sk-border-2 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🧠</span>
              <h3 className="text-sk-lg font-black tracking-tight text-sk-text-1">
                Examen de Aptitud Táctica
              </h3>
            </div>
            <p className="text-[10px] md:text-sk-xs text-sk-text-3 font-mono uppercase tracking-[0.15em]">
              Condición de victoria: 100% de precisión
            </p>
          </div>
          <div className="font-mono text-2xl font-black text-sk-accent bg-sk-accent/10 px-3 py-1 rounded-md border border-sk-accent/20 shadow-inner">
            {Object.keys(answers).length}<span className="text-sk-text-4 text-lg">/{questions.length}</span>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="p-6 space-y-6">
        {questions.map((q, qi) => (
          <div key={qi} className="space-y-3">
            <p className="text-sk-sm font-semibold text-sk-text-1">
              <span className="font-mono text-sk-accent mr-2">{qi + 1}.</span>
              {q.question}
            </p>

            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isSelected = answers[qi] === oi;

                return (
                  <button
                    key={oi}
                    onClick={() => handleSelectAnswer(qi, oi)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg border transition-all text-sk-sm",
                      isSelected
                        ? "border-sk-accent bg-sk-accent-dim text-sk-text-1"
                        : "border-sk-border-2 bg-sk-bg-3 text-sk-text-2 hover:border-sk-border-3 hover:bg-sk-bg-4"
                    )}
                  >
                    <span className="font-mono text-[11px] mr-2 opacity-50">
                      {String.fromCharCode(65 + oi)}.
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="px-6 pb-6 flex justify-center">
        <Button
          variant="accent"
          size="lg"
          onClick={handleSubmit}
          disabled={!allAnswered || loading}
          isLoading={loading}
        >
          {allAnswered ? "Verificar respuestas" : `Responde las ${questions.length} preguntas`}
        </Button>
      </div>
    </div>
  );
}
