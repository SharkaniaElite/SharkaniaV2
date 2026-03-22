// src/components/replayer/replay-controls.tsx
// ══════════════════════════════════════════════════════════
// Sharkania Replayer — Controls v2
// Panel inferior: action log + pot evolution + controles
// ══════════════════════════════════════════════════════════

import { useEffect, useCallback, useRef } from "react";
import {
  Play, Pause, SkipForward, SkipBack, RotateCcw,
} from "lucide-react";
import type { ReplayState } from "../../types/replayer";
import {
  getTotalSteps,
  getTotalStepIndex,
  getActionDescription,
} from "../../lib/replayer-engine";

interface ReplayControlsProps {
  state: ReplayState;
  onStepForward:  () => void;
  onStepBackward: () => void;
  onGoToStep:     (step: number) => void;
  onTogglePlay:   () => void;
  onSetSpeed:     (speed: number) => void;
  onReset:        () => void;
}

// ── Action log — máximo de entradas a mostrar ─────────────
const MAX_LOG = 8;

// ── Color semántico por tipo de acción ───────────────────
const ACTION_COLOR: Record<string, string> = {
  fold:         "#52525b",
  check:        "#34d399",
  call:         "#34d399",
  bet:          "#fbbf24",
  raise:        "#fb923c",
  "all-in":     "#f87171",
  "post-sb":    "#a78bfa",
  "post-bb":    "#60a5fa",
  "post-ante":  "#a1a1aa",
  show:         "#22d3ee",
  muck:         "#52525b",
};

const SPEEDS = [0.5, 1, 2, 4];

// ── Construir log de acciones hasta el paso actual ───────
function buildActionLog(state: ReplayState): {
  text: string;
  color: string;
  isCurrent: boolean;
}[] {
  const log: { text: string; color: string; isCurrent: boolean }[] = [];

  for (let si = 0; si <= state.currentStreetIndex; si++) {
    const street = state.hand.streets[si];
    if (!street) continue;

    const maxAction =
      si < state.currentStreetIndex
        ? street.actions.length - 1
        : state.currentActionIndex;

    for (let ai = 0; ai <= maxAction; ai++) {
      const action = street.actions[ai];
      if (!action) continue;
      const player = state.hand.players[action.playerIndex];
      const name = player?.name ?? `P${action.playerIndex}`;
      const desc = getActionDescription(action, state.hand.players);
      const isCurrent =
        si === state.currentStreetIndex && ai === state.currentActionIndex;

      log.push({
        text: `${name}: ${desc}`,
        color: ACTION_COLOR[action.type] ?? "#a1a1aa",
        isCurrent,
      });
    }
  }

  // Devolvemos las últimas MAX_LOG entradas (más recientes al fondo)
  return log.slice(-MAX_LOG);
}

// ── Construir datos para la mini sparkline del pot ───────
function buildPotHistory(state: ReplayState): number[] {
  const points: number[] = [0];
  let pot = 0;

  for (let si = 0; si <= state.currentStreetIndex; si++) {
    const street = state.hand.streets[si];
    if (!street) continue;

    const maxAction =
      si < state.currentStreetIndex
        ? street.actions.length - 1
        : state.currentActionIndex;

    for (let ai = 0; ai <= maxAction; ai++) {
      const action = street.actions[ai];
      if (!action) continue;
      pot += action.amount;
      points.push(pot);
    }
  }

  return points;
}

// ── Mini sparkline SVG ────────────────────────────────────
function PotSparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;

  const W = 180;
  const H = 40;
  const max = Math.max(...points, 1);
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * (W - 10) + 5;
    const y = H - 6 - ((v / max) * (H - 12));
    return `${x},${y}`;
  });

  const lastX = parseFloat(coords[coords.length - 1].split(",")[0]);
  const lastY = parseFloat(coords[coords.length - 1].split(",")[1]);

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Área bajo la línea */}
      <polyline
        points={[...coords, `${W - 5},${H}`, `5,${H}`].join(" ")}
        fill="rgba(34,211,238,0.06)"
        stroke="none"
      />
      {/* Línea principal */}
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="rgba(34,211,238,0.50)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Punto actual */}
      <circle cx={lastX} cy={lastY} r="3" fill="#22d3ee" />
      <circle cx={lastX} cy={lastY} r="5" fill="none" stroke="rgba(34,211,238,0.30)" strokeWidth="1"/>
    </svg>
  );
}

// ── Componente principal ──────────────────────────────────

export function ReplayControls({
  state,
  onStepForward, onStepBackward,
  onGoToStep, onTogglePlay,
  onSetSpeed, onReset,
}: ReplayControlsProps) {
  const totalSteps  = getTotalSteps(state.hand);
  const currentStep = getTotalStepIndex(state);
  const logRef      = useRef<HTMLDivElement>(null);

  const actionLog  = buildActionLog(state);
  const potHistory = buildPotHistory(state);

  // Scroll automático del log al último elemento
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [actionLog.length]);

  // ── Keyboard shortcuts ────────────────────────────────
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    switch (e.key) {
      case " ":        e.preventDefault(); onTogglePlay(); break;
      case "ArrowRight": e.preventDefault(); onStepForward(); break;
      case "ArrowLeft":  e.preventDefault(); onStepBackward(); break;
      case "1": onSetSpeed(0.5); break;
      case "2": onSetSpeed(1);   break;
      case "3": onSetSpeed(2);   break;
      case "4": onSetSpeed(4);   break;
      case "r": case "R": onReset(); break;
    }
  }, [onTogglePlay, onStepForward, onStepBackward, onSetSpeed, onReset]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Street markers para el slider
  const streets = state.hand.streets;
  let stepAccum = 0;
  const streetMarkers: { label: string; step: number }[] = [];
  streets.forEach((s) => {
    streetMarkers.push({ label: s.street.toUpperCase(), step: stepAccum });
    stepAccum += s.actions.length + 1;
  });

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "780px",
        margin: "0 auto",
        background: "rgba(9,9,11,0.97)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* ── Panel superior: log + sparkline ──────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 200px",
          gap: "0",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Action log */}
        <div style={{ padding: "12px 14px" }}>
          <div
            style={{
              fontSize: "8px",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: "#3f3f46",
              letterSpacing: "0.18em",
              marginBottom: "8px",
            }}
          >
            ACTION LOG
          </div>
          <div
            ref={logRef}
            style={{
              height: "90px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              scrollbarWidth: "none",
            }}
          >
            {actionLog.length === 0 ? (
              <span style={{ fontSize: "9px", color: "#3f3f46", fontFamily: "'JetBrains Mono', monospace" }}>
                Inicio de la mano
              </span>
            ) : (
              actionLog.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: entry.isCurrent ? 1 : i === actionLog.length - 1 ? 0.9 : 0.45,
                  }}
                >
                  {/* Indicador de color */}
                  <div
                    style={{
                      width: "3px",
                      height: "14px",
                      borderRadius: "2px",
                      background: entry.color,
                      flexShrink: 0,
                      boxShadow: entry.isCurrent ? `0 0 6px ${entry.color}` : "none",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "9px",
                      fontFamily: "'JetBrains Mono', monospace",
                      color: entry.isCurrent ? "#fafafa" : "#a1a1aa",
                      fontWeight: entry.isCurrent ? 700 : 400,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pot evolution */}
        <div
          style={{
            padding: "12px 14px",
            borderLeft: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div
            style={{
              fontSize: "8px",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: "#3f3f46",
              letterSpacing: "0.18em",
              marginBottom: "8px",
            }}
          >
            POT
          </div>
          <div
            style={{
              fontSize: "16px",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: "#fbbf24",
              letterSpacing: "-0.5px",
              marginBottom: "6px",
            }}
          >
            {state.pot.totalPot > 0 ? (
              state.pot.totalPot >= 10000
                ? `${(state.pot.totalPot / 1000).toFixed(1)}K`
                : String(state.pot.totalPot)
            ) : "—"}
          </div>
          <PotSparkline points={potHistory} />
        </div>
      </div>

      {/* ── Timeline ─────────────────────────────────── */}
      <div style={{ padding: "12px 16px 0" }}>
        {/* Slider de progreso */}
        <div style={{ position: "relative", marginBottom: "4px" }}>
          {/* Track background */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: "4px",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "2px",
              pointerEvents: "none",
            }}
          />
          {/* Track progreso */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              width: `${totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0}%`,
              height: "4px",
              transform: "translateY(-50%)",
              background: "linear-gradient(90deg, rgba(34,211,238,0.6), #22d3ee)",
              borderRadius: "2px",
              pointerEvents: "none",
              transition: "width 0.15s ease",
            }}
          />
          <input
            type="range"
            min={0}
            max={totalSteps}
            value={currentStep}
            onChange={(e) => onGoToStep(Number(e.target.value))}
            style={{
              position: "relative",
              width: "100%",
              appearance: "none",
              background: "transparent",
              height: "20px",
              cursor: "pointer",
              outline: "none",
            }}
          />
        </div>

        {/* Street labels bajo el slider */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          {streetMarkers.map((m, i) => {
            const isCurrent = state.hand.streets[state.currentStreetIndex]?.street.toUpperCase() === m.label;
            return (
              <button
                key={i}
                onClick={() => onGoToStep(m.step)}
                style={{
                  fontSize: "8px",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: isCurrent ? "#22d3ee" : "#3f3f46",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0",
                  textShadow: isCurrent ? "0 0 8px rgba(34,211,238,0.5)" : "none",
                  transition: "color 0.3s",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Botones de control ────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "0 16px 14px",
        }}
      >
        {/* Reset */}
        <button
          onClick={onReset}
          title="Reiniciar (R)"
          style={btnStyle("ghost")}
        >
          <RotateCcw size={14} />
        </button>

        {/* Step back */}
        <button
          onClick={onStepBackward}
          disabled={currentStep <= 0}
          title="Paso atrás (←)"
          style={btnStyle("ghost", currentStep <= 0)}
        >
          <SkipBack size={16} />
        </button>

        {/* Play / Pause — botón principal */}
        <button
          onClick={onTogglePlay}
          title="Play/Pause (Espacio)"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "52px",
            height: "44px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            background: state.isPlaying
              ? "rgba(34,211,238,0.15)"
              : "#22d3ee",
            color: state.isPlaying ? "#22d3ee" : "#09090b",
            boxShadow: state.isPlaying
              ? "0 0 16px rgba(34,211,238,0.20), inset 0 0 0 1px rgba(34,211,238,0.35)"
              : "0 0 20px rgba(34,211,238,0.30), 0 4px 12px rgba(0,0,0,0.4)",
            transition: "all 0.2s ease",
          }}
        >
          {state.isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        {/* Step forward */}
        <button
          onClick={onStepForward}
          disabled={state.isFinished}
          title="Paso adelante (→)"
          style={btnStyle("ghost", state.isFinished)}
        >
          <SkipForward size={16} />
        </button>

        {/* Separador */}
        <div style={{ width: "1px", height: "28px", background: "rgba(255,255,255,0.06)", margin: "0 4px" }} />

        {/* Speed selector */}
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              onClick={() => onSetSpeed(speed)}
              title={`Velocidad ${speed}x`}
              style={{
                padding: "6px 9px",
                border: "none",
                borderRight: "1px solid rgba(255,255,255,0.05)",
                cursor: "pointer",
                fontSize: "9px",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                background: state.playbackSpeed === speed
                  ? "rgba(34,211,238,0.12)"
                  : "transparent",
                color: state.playbackSpeed === speed ? "#22d3ee" : "#52525b",
                transition: "all 0.15s ease",
              }}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* ── Paso y shortcuts ─────────────────────────── */}
      <div
        style={{
          padding: "0 16px 10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={hintStyle}>
          Paso {currentStep} / {totalSteps}
        </span>
        <span style={hintStyle}>
          SPACE · ←→ · 1-4 · R
        </span>
      </div>

      {/* Estilos globales del slider thumb */}
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #22d3ee;
          border: 2px solid rgba(9,9,11,0.8);
          box-shadow: 0 0 8px rgba(34,211,238,0.5);
          cursor: pointer;
          margin-top: -5px;
        }
        input[type=range]::-webkit-slider-runnable-track {
          height: 4px;
          background: transparent;
        }
        input[type=range]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #22d3ee;
          border: 2px solid rgba(9,9,11,0.8);
          box-shadow: 0 0 8px rgba(34,211,238,0.5);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

// ── Helpers de estilos ────────────────────────────────────

function btnStyle(variant: "ghost", disabled?: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    color: disabled ? "#3f3f46" : "#a1a1aa",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: "all 0.15s ease",
  };
}

const hintStyle: React.CSSProperties = {
  fontSize: "8px",
  fontFamily: "'JetBrains Mono', monospace",
  color: "#3f3f46",
  letterSpacing: "0.06em",
};
