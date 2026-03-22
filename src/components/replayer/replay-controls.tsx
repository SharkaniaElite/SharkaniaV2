// src/components/replayer/replay-controls.tsx
// ══════════════════════════════════════════════════════════
// Replay Controls — Play/Pause, Step, Speed, Timeline
// Keyboard shortcuts: Space=play, ←→=step, 1-4=speed
// ══════════════════════════════════════════════════════════

import { useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Rewind,
  FastForward,
  RotateCcw,
} from "lucide-react";
import type { ReplayState, HandHistory } from "../../types/replayer";
import {
  getTotalSteps,
  getTotalStepIndex,
  getActionDescription,
} from "../../lib/replayer-engine";

interface ReplayControlsProps {
  state: ReplayState;
  onStepForward: () => void;
  onStepBackward: () => void;
  onGoToStep: (step: number) => void;
  onTogglePlay: () => void;
  onSetSpeed: (speed: number) => void;
  onReset: () => void;
}

const SPEEDS = [0.5, 1, 2, 4];

export function ReplayControls({
  state,
  onStepForward,
  onStepBackward,
  onGoToStep,
  onTogglePlay,
  onSetSpeed,
  onReset,
}: ReplayControlsProps) {
  const totalSteps = getTotalSteps(state.hand);
  const currentStep = getTotalStepIndex(state);
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  // ── Keyboard shortcuts ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          onTogglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          onStepForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          onStepBackward();
          break;
        case "1": onSetSpeed(0.5); break;
        case "2": onSetSpeed(1); break;
        case "3": onSetSpeed(2); break;
        case "4": onSetSpeed(4); break;
        case "r":
        case "R":
          onReset();
          break;
      }
    },
    [onTogglePlay, onStepForward, onStepBackward, onSetSpeed, onReset]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ── Get current action description ──
  const currentStreet = state.hand.streets[state.currentStreetIndex];
  const currentAction =
    currentStreet && state.currentActionIndex >= 0
      ? currentStreet.actions[state.currentActionIndex]
      : null;
  const actionText = currentAction
    ? getActionDescription(currentAction, state.hand.players)
    : state.isFinished
    ? "Mano terminada"
    : "Inicio de la mano";

  // ── Street progress dots ──
  const streets = state.hand.streets.map((s, i) => ({
    name: s.street.toUpperCase(),
    isCurrent: i === state.currentStreetIndex,
    isPast: i < state.currentStreetIndex,
  }));

  return (
    <div className="w-full max-w-[700px] mx-auto space-y-3">
      {/* Action text */}
      <div className="text-center">
        <p className="font-mono text-sk-sm text-sk-text-1 font-semibold min-h-[20px]">
          {actionText}
        </p>
      </div>

      {/* Timeline slider */}
      <div className="relative">
        <input
          type="range"
          min="0"
          max={totalSteps}
          value={currentStep}
          onChange={(e) => onGoToStep(Number(e.target.value))}
          className="w-full accent-[#22d3ee]"
          style={{ height: "6px" }}
        />
        {/* Street markers on the timeline */}
        <div className="flex justify-between mt-1">
          {streets.map((s, i) => (
            <span
              key={i}
              className={`font-mono text-[9px] font-bold uppercase tracking-wider ${
                s.isCurrent ? "text-sk-accent" : s.isPast ? "text-sk-text-3" : "text-sk-text-4"
              }`}
            >
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center justify-center gap-1">
        {/* Reset */}
        <button
          onClick={onReset}
          className="p-2 rounded-lg text-sk-text-3 hover:text-sk-text-1 hover:bg-white/[0.04] transition-colors"
          title="Reiniciar (R)"
        >
          <RotateCcw size={16} />
        </button>

        {/* Step back */}
        <button
          onClick={onStepBackward}
          disabled={currentStep <= 0}
          className="p-2 rounded-lg text-sk-text-2 hover:text-sk-text-1 hover:bg-white/[0.04] transition-colors disabled:opacity-30"
          title="Paso atrás (←)"
        >
          <SkipBack size={18} />
        </button>

        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          disabled={state.isFinished && !state.isPlaying}
          className={`p-3 rounded-xl transition-all duration-200 ${
            state.isPlaying
              ? "bg-sk-accent/20 text-sk-accent border border-sk-accent/30 hover:bg-sk-accent/30"
              : "bg-sk-accent text-sk-bg-0 hover:bg-sk-accent-hover shadow-lg shadow-sk-accent/20"
          }`}
          title="Reproducir / Pausar (Espacio)"
        >
          {state.isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        {/* Step forward */}
        <button
          onClick={onStepForward}
          disabled={state.isFinished}
          className="p-2 rounded-lg text-sk-text-2 hover:text-sk-text-1 hover:bg-white/[0.04] transition-colors disabled:opacity-30"
          title="Paso adelante (→)"
        >
          <SkipForward size={18} />
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-0.5 ml-2 bg-sk-bg-3 rounded-lg p-0.5 border border-sk-border-1">
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => onSetSpeed(speed)}
              className={`font-mono text-[10px] font-bold px-2 py-1 rounded transition-all ${
                state.playbackSpeed === speed
                  ? "bg-sk-accent/20 text-sk-accent"
                  : "text-sk-text-3 hover:text-sk-text-1"
              }`}
              title={`Velocidad ${speed}x (tecla ${SPEEDS.indexOf(speed) + 1})`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Step counter */}
      <div className="flex items-center justify-between text-[10px] text-sk-text-4">
        <span>Paso {currentStep} / {totalSteps}</span>
        <span className="flex items-center gap-2">
          <span>Espacio: play</span>
          <span>←→: step</span>
          <span>1-4: speed</span>
        </span>
      </div>
    </div>
  );
}
