// src/pages/elo-simulator.tsx
import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import {
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw,
  Play,
  Info,
  Users,
  Trophy,
} from "lucide-react";
import { useFeatureAccess } from "../hooks/use-shop";
import { useAuthStore } from "../stores/auth-store";
import { FeaturePaywall } from "../components/shop/feature-paywall";
import { supabase } from "../lib/supabase";

// ══════════════════════════════════════════════════════════
// ELO ALGORITHM (exact Sharkania formula from 06-elo-algorithm.md)
// ══════════════════════════════════════════════════════════

interface EloSimInput {
  currentElo: number;
  totalTournaments: number;
  position: number;
  fieldSize: number;
  buyIn: number;
  avgFieldElo: number;
}

interface EloSimResult {
  score: number;
  expected: number;
  kBase: number;
  kFinal: number;
  weight: number;
  eloChange: number;
  newElo: number;
}

function simulateElo(input: EloSimInput): EloSimResult {
  const { currentElo, totalTournaments, position, fieldSize, buyIn, avgFieldElo } = input;

  // 1. Score normalizado
  const score = (fieldSize - position) / (fieldSize - 1);

  // 2. Score esperado
  const expected = 1 / (1 + Math.pow(10, (avgFieldElo - currentElo) / 400));

  // 3. Factor K dinámico
  const kBase = totalTournaments < 30 ? 40 : 20;
  const kBuyIn = kBase * (1 + Math.log10(buyIn + 1) * 0.1);
  const kFinal = kBuyIn * (1 + Math.log10(fieldSize) * 0.15);

  // 4. Peso del torneo
  const weight = avgFieldElo / 1200;

  // 5. Cambio de ELO
  const eloChange = kFinal * weight * (score - expected);
  const newElo = Math.max(100, currentElo + eloChange);

  return { score, expected, kBase, kFinal, weight, eloChange, newElo };
}

// ══════════════════════════════════════════════════════════
// PRESETS
// ══════════════════════════════════════════════════════════

interface Preset {
  label: string;
  fieldSize: number;
  buyIn: number;
  avgFieldElo: number;
}

const PRESETS: Preset[] = [
  { label: "Freeroll club", fieldSize: 30, buyIn: 0, avgFieldElo: 1150 },
  { label: "Torneo $3.30", fieldSize: 45, buyIn: 3.3, avgFieldElo: 1250 },
  { label: "Torneo $5.50", fieldSize: 60, buyIn: 5.5, avgFieldElo: 1300 },
  { label: "Torneo $11", fieldSize: 40, buyIn: 11, avgFieldElo: 1350 },
  { label: "Torneo $22", fieldSize: 35, buyIn: 22, avgFieldElo: 1400 },
  { label: "High Roller $55", fieldSize: 25, buyIn: 55, avgFieldElo: 1500 },
];

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function formatEloChange(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}`;
}

function getChangeColor(val: number): string {
  if (val > 1) return "#34d399";
  if (val < -1) return "#f87171";
  return "#a1a1aa";
}

function getPositionLabel(pos: number, total: number): string {
  const pct = ((total - pos) / (total - 1)) * 100;
  if (pos === 1) return "Ganador";
  if (pos <= 3) return "Podio";
  if (pct >= 85) return "Top 15%";
  if (pct >= 70) return "ITM alto";
  if (pct >= 50) return "Mitad superior";
  if (pct >= 30) return "Mitad inferior";
  return "Eliminado temprano";
}

// ══════════════════════════════════════════════════════════
// MULTI-POSITION CHART (shows ELO change for every position)
// ══════════════════════════════════════════════════════════

function PositionChart({
  currentElo,
  totalTournaments,
  fieldSize,
  buyIn,
  avgFieldElo,
  highlightPos,
}: {
  currentElo: number;
  totalTournaments: number;
  fieldSize: number;
  buyIn: number;
  avgFieldElo: number;
  highlightPos: number;
}) {
  const positions = useMemo(() => {
    const results: { pos: number; change: number }[] = [];
    for (let pos = 1; pos <= fieldSize; pos++) {
      const sim = simulateElo({
        currentElo,
        totalTournaments,
        position: pos,
        fieldSize,
        buyIn,
        avgFieldElo,
      });
      results.push({ pos, change: sim.eloChange });
    }
    return results;
  }, [currentElo, totalTournaments, fieldSize, buyIn, avgFieldElo]);

  const maxAbs = Math.max(...positions.map((p) => Math.abs(p.change)), 1);
  const barMaxWidth = 100; // percentage

  // Show all positions for small fields, sample for large fields
  const displayPositions = useMemo(() => {
    if (fieldSize <= 20) return positions;
    // Sample: 1st, top positions, highlighted, breakeven zone, bottom, last
    const sampled = new Set<number>();
    sampled.add(1);
    sampled.add(2);
    sampled.add(3);
    sampled.add(highlightPos);
    // Find breakeven position
    const breakeven = positions.find((p, i) => {
      const prev = positions[i - 1];
      // Ahora validamos que 'prev' exista antes de leer su '.change'
      return i > 0 && prev !== undefined && prev.change >= 0 && p.change < 0;
    });
    if (breakeven) {
      sampled.add(breakeven.pos - 1);
      sampled.add(breakeven.pos);
    }
    // Bottom positions
    sampled.add(Math.floor(fieldSize * 0.75));
    sampled.add(fieldSize - 1);
    sampled.add(fieldSize);
    return positions.filter((p) => sampled.has(p.pos));
  }, [positions, fieldSize, highlightPos]);

  return (
    <div className="flex flex-col gap-1">
      {displayPositions.map((p) => {
        const isHighlight = p.pos === highlightPos;
        const pct = (Math.abs(p.change) / maxAbs) * barMaxWidth;
        const isPositive = p.change >= 0;

        return (
          <div
            key={p.pos}
            className={`flex items-center gap-2 py-1 px-2 rounded ${
              isHighlight ? "bg-white/[0.04]" : ""
            }`}
          >
            <span
              className={`font-mono text-[11px] w-8 text-right shrink-0 ${
                isHighlight ? "font-bold text-sk-accent" : "text-sk-text-3"
              }`}
            >
              {p.pos}°
            </span>
            <div className="flex-1 flex items-center h-4">
              {isPositive ? (
                <div
                  className="h-2.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    background: isHighlight
                      ? "#22d3ee"
                      : "rgba(52,211,153,0.5)",
                  }}
                />
              ) : (
                <div className="flex-1 flex justify-end">
                  <div
                    className="h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      background: isHighlight
                        ? "#22d3ee"
                        : "rgba(248,113,113,0.5)",
                    }}
                  />
                </div>
              )}
            </div>
            <span
              className={`font-mono text-[11px] w-16 text-right shrink-0 ${
                isHighlight ? "font-bold text-sk-text-1" : "text-sk-text-3"
              }`}
              style={{ color: isHighlight ? getChangeColor(p.change) : undefined }}
            >
              {formatEloChange(p.change)}
            </span>
          </div>
        );
      })}
      {fieldSize > 20 && (
        <p className="text-[10px] text-sk-text-4 text-center mt-1">
          Mostrando posiciones clave de {fieldSize} totales
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════

export function EloSimulatorPage() {
  const [currentElo, setCurrentElo] = useState(1200);
  const [totalTournaments, setTotalTournaments] = useState(10);
  const [position, setPosition] = useState(5);
  const [fieldSize, setFieldSize] = useState(45);
  const [buyIn, setBuyIn] = useState(5.5);
  const [avgFieldElo, setAvgFieldElo] = useState(1300);
  const [calculated, setCalculated] = useState(false);

  const result = useMemo(() => {
    if (!calculated) return null;
    return simulateElo({
      currentElo,
      totalTournaments,
      position: Math.min(position, fieldSize),
      fieldSize,
      buyIn,
      avgFieldElo,
    });
  }, [calculated, currentElo, totalTournaments, position, fieldSize, buyIn, avgFieldElo]);

  const applyPreset = useCallback((preset: Preset) => {
    setFieldSize(preset.fieldSize);
    setBuyIn(preset.buyIn);
    setAvgFieldElo(preset.avgFieldElo);
    setPosition(Math.min(position, preset.fieldSize));
    setCalculated(false);
  }, [position]);

  const handleReset = useCallback(() => {
    setCurrentElo(1200);
    setTotalTournaments(10);
    setPosition(5);
    setFieldSize(45);
    setBuyIn(5.5);
    setAvgFieldElo(1300);
    setCalculated(false);
  }, []);

  const effectivePos = Math.min(position, fieldSize);

  // ── Premium access control ──
  const { isAuthenticated, user } = useAuthStore();
  const { data: access } = useFeatureAccess("tool_elo_sim");
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
        .eq('tool_id', 'tool_elo_sim')
        .single();
      const today = new Date().toISOString().split("T")[0];
      if (data && data.last_used_date === today) setFreeUsed(true);
    };
    checkUsage();
  }, [isAuthenticated, user, hasFullAccess]);

  const needsPaywall = isAuthenticated && freeUsed && !hasFullAccess;

  const handleCalculate = async () => {
    if (isCheckingDB) return;
    if (hasFullAccess) { setCalculated(true); return; }
    if (freeUsed) { setCalculated(false); return; }
    if (!isAuthenticated || !user) { setCalculated(true); setFreeUsed(true); return; }

    setIsCheckingDB(true);
    const { data: success } = await supabase.rpc('use_free_tool', {
      p_user_id: user.id,
      p_tool_id: 'tool_elo_sim'
    });
    setIsCheckingDB(false);

    if (success) { setCalculated(true); setFreeUsed(true); }
    else { setFreeUsed(true); setCalculated(false); }
  };

  return (
    <PageShell>
      <SEOHead
        title="Simulador de ELO"
        description="Simula cuánto subiría o bajaría tu ELO en Sharkania según tu posición en un torneo. Algoritmo real, resultados instantáneos."
        path="/tools/simulador-elo"
        ogImage="https://sharkania.com/images/tools/og-tool-elo.png"
      />

      <div className="pt-20 pb-16">
        <div className="max-w-[960px] mx-auto px-6">
          {/* Back */}
          <Link
            to="/tools"
            className="inline-flex items-center gap-1.5 text-sk-sm text-sk-text-3 hover:text-sk-text-1 transition-colors mb-6"
          >
            <ArrowLeft size={14} />
            Herramientas
          </Link>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-sk-green-dim flex items-center justify-center">
                <TrendingUp size={20} className="text-sk-green" />
              </div>
              <div>
                <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight">
                  Simulador de ELO
                </h1>
                <p className="text-sk-xs text-sk-text-3">
                  Algoritmo real de Sharkania — Glicko simplificado para MTT
                </p>
              </div>
            </div>
            <p className="text-sk-sm text-sk-text-2 mt-3 max-w-2xl leading-relaxed">
              ¿Cuánto subiría tu ELO si ganas este torneo? ¿Y si quedas en el
              medio? Simula cualquier escenario con el mismo algoritmo que usa
              Sharkania para calcular los rankings reales.
            </p>
          </div>

          {/* Presets */}
          <div className="mb-6">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3 mb-2">
              Escenarios rápidos
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="px-3 py-1.5 rounded-md bg-sk-bg-3 border border-sk-border-2 text-sk-xs font-medium text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Your Profile */}
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={15} className="text-sk-accent" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2">
                  Tu perfil
                </span>
              </div>

              {/* Current ELO */}
              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    Tu ELO actual
                  </label>
                  <span className="font-mono text-sk-sm font-bold text-sk-accent">
                    {currentElo.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="800"
                  max="2500"
                  step="10"
                  value={currentElo}
                  onChange={(e) => {
                    setCurrentElo(Number(e.target.value));
                    setCalculated(false);
                  }}
                  className="w-full accent-[#22d3ee]"
                />
                <div className="flex justify-between text-[10px] text-sk-text-4 mt-0.5">
                  <span>800</span>
                  <span>1200 (nuevo)</span>
                  <span>2500</span>
                </div>
              </div>

              {/* Total Tournaments */}
              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    Torneos jugados
                  </label>
                  <span className="font-mono text-sk-sm font-bold text-sk-text-1">
                    {totalTournaments}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="1"
                  value={totalTournaments}
                  onChange={(e) => {
                    setTotalTournaments(Number(e.target.value));
                    setCalculated(false);
                  }}
                  className="w-full accent-[#22d3ee]"
                />
                <div className="flex justify-between text-[10px] text-sk-text-4 mt-0.5">
                  <span>0 (nuevo)</span>
                  <span className="text-sk-gold">
                    K = {totalTournaments < 30 ? "40 (volátil)" : "20 (estable)"}
                  </span>
                  <span>500+</span>
                </div>
              </div>

              {/* Position */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    Tu posición
                  </label>
                  <span className="font-mono text-sk-sm font-bold text-sk-text-1">
                    {effectivePos}° / {fieldSize}
                    <span className="text-sk-text-3 text-[10px] ml-1.5">
                      ({getPositionLabel(effectivePos, fieldSize)})
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={fieldSize}
                  step="1"
                  value={effectivePos}
                  onChange={(e) => {
                    setPosition(Number(e.target.value));
                    setCalculated(false);
                  }}
                  className="w-full accent-[#22d3ee]"
                />
                <div className="flex justify-between text-[10px] text-sk-text-4 mt-0.5">
                  <span>1° (ganador)</span>
                  <span>{fieldSize}° (último)</span>
                </div>
              </div>
            </div>

            {/* Tournament Info */}
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={15} className="text-sk-gold" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2">
                  Datos del torneo
                </span>
              </div>

              {/* Field size */}
              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    Jugadores en el torneo
                  </label>
                  <span className="font-mono text-sk-sm font-bold text-sk-text-1">
                    {fieldSize}
                  </span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="200"
                  step="1"
                  value={fieldSize}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFieldSize(val);
                    if (position > val) setPosition(val);
                    setCalculated(false);
                  }}
                  className="w-full accent-[#fbbf24]"
                />
                <div className="flex justify-between text-[10px] text-sk-text-4 mt-0.5">
                  <span>3 (SNG)</span>
                  <span>200 (MTT grande)</span>
                </div>
              </div>

              {/* Buy-in */}
              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    Buy-in
                  </label>
                  <span className="font-mono text-sk-sm font-bold text-sk-gold">
                    ${buyIn.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={buyIn}
                  onChange={(e) => {
                    setBuyIn(Number(e.target.value));
                    setCalculated(false);
                  }}
                  className="w-full accent-[#fbbf24]"
                />
                <div className="flex justify-between text-[10px] text-sk-text-4 mt-0.5">
                  <span>$0 (freeroll)</span>
                  <span>$100</span>
                </div>
              </div>

              {/* Avg field ELO */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    ELO promedio del field
                  </label>
                  <span className="font-mono text-sk-sm font-bold text-sk-text-1">
                    {avgFieldElo.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="900"
                  max="1800"
                  step="10"
                  value={avgFieldElo}
                  onChange={(e) => {
                    setAvgFieldElo(Number(e.target.value));
                    setCalculated(false);
                  }}
                  className="w-full accent-[#fbbf24]"
                />
                <div className="flex justify-between text-[10px] text-sk-text-4 mt-0.5">
                  <span>900 (débil)</span>
                  <span>1200 (neutro)</span>
                  <span>1800 (fuerte)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Calculate */}
          <div className="flex items-center gap-3 mb-8">
            <Button
              variant="accent"
              size="lg"
              onClick={handleCalculate}
              disabled={isCheckingDB}
              className="flex-1 sm:flex-none sm:min-w-[200px]"
            >
              <Play size={16} />
              {freeUsed && !hasFullAccess ? "🔒 Simular ELO" : "Simular ELO"}
            </Button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sk-sm text-sk-text-3 hover:text-sk-text-1 transition-colors"
            >
              <RotateCcw size={14} />
              Reiniciar
            </button>
          </div>

          {needsPaywall && (
            <div className="mb-8">
              <FeaturePaywall
                featureKey="tool_elo_sim"
                title="Simulaciones ELO ilimitadas"
                description="Ya usaste tu simulación gratis de hoy. Desbloquea acceso completo con SharkCoins."
              >
                <></>
              </FeaturePaywall>
            </div>
          )}

          {/* Results */}
          {calculated && result && (
            <div className="mb-8 animate-fadeIn">
              {/* Big Result */}
              <div
                className="rounded-xl border p-6 mb-4 text-center"
                style={{
                  borderColor:
                    result.eloChange >= 0
                      ? "rgba(52,211,153,0.25)"
                      : "rgba(248,113,113,0.25)",
                  background:
                    result.eloChange >= 0
                      ? "rgba(52,211,153,0.04)"
                      : "rgba(248,113,113,0.04)",
                }}
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  {result.eloChange > 1 ? (
                    <TrendingUp size={20} className="text-sk-green" />
                  ) : result.eloChange < -1 ? (
                    <TrendingDown size={20} className="text-sk-red" />
                  ) : (
                    <Minus size={20} className="text-sk-text-3" />
                  )}
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-sk-text-3">
                    Cambio de ELO
                  </span>
                </div>
                <div
                  className="font-mono text-4xl font-extrabold tracking-tight leading-none mb-2"
                  style={{ color: getChangeColor(result.eloChange) }}
                >
                  {formatEloChange(result.eloChange)}
                </div>
                <div className="flex items-center justify-center gap-3 font-mono text-sk-sm">
                  <span className="text-sk-text-3">{currentElo}</span>
                  <span className="text-sk-text-4">→</span>
                  <span className="font-bold text-sk-text-1">
                    {Math.round(result.newElo).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="bg-sk-bg-2 border border-sk-border-1 rounded-lg p-3">
                  <p className="font-mono text-[10px] text-sk-text-4 uppercase tracking-wide mb-1">
                    Score
                  </p>
                  <p className="font-mono text-sk-sm font-bold text-sk-text-1">
                    {result.score.toFixed(4)}
                  </p>
                  <p className="text-[10px] text-sk-text-4">
                    Pos {effectivePos}/{fieldSize}
                  </p>
                </div>
                <div className="bg-sk-bg-2 border border-sk-border-1 rounded-lg p-3">
                  <p className="font-mono text-[10px] text-sk-text-4 uppercase tracking-wide mb-1">
                    Esperado
                  </p>
                  <p className="font-mono text-sk-sm font-bold text-sk-text-1">
                    {result.expected.toFixed(4)}
                  </p>
                  <p className="text-[10px] text-sk-text-4">
                    vs field {avgFieldElo}
                  </p>
                </div>
                <div className="bg-sk-bg-2 border border-sk-border-1 rounded-lg p-3">
                  <p className="font-mono text-[10px] text-sk-text-4 uppercase tracking-wide mb-1">
                    Factor K
                  </p>
                  <p className="font-mono text-sk-sm font-bold text-sk-gold">
                    {result.kFinal.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-sk-text-4">
                    Base: {result.kBase}
                  </p>
                </div>
                <div className="bg-sk-bg-2 border border-sk-border-1 rounded-lg p-3">
                  <p className="font-mono text-[10px] text-sk-text-4 uppercase tracking-wide mb-1">
                    Peso torneo
                  </p>
                  <p className="font-mono text-sk-sm font-bold text-sk-text-1">
                    {result.weight.toFixed(3)}
                  </p>
                  <p className="text-[10px] text-sk-text-4">
                    {result.weight > 1 ? "Field fuerte" : result.weight < 0.95 ? "Field débil" : "Neutro"}
                  </p>
                </div>
              </div>

              {/* Position Chart */}
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5 mb-4">
                <h3 className="text-sk-sm font-bold text-sk-text-1 mb-3">
                  ELO por posición en este torneo
                </h3>
                <PositionChart
                  currentElo={currentElo}
                  totalTournaments={totalTournaments}
                  fieldSize={fieldSize}
                  buyIn={buyIn}
                  avgFieldElo={avgFieldElo}
                  highlightPos={effectivePos}
                />
              </div>

              {/* Insight */}
              <div className="bg-sk-bg-2 border border-sk-accent/15 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-sk-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sk-xs font-semibold text-sk-accent mb-1">
                      ¿Cómo se calcula?
                    </p>
                    <p className="text-sk-xs text-sk-text-3 leading-relaxed">
                      Sharkania usa una adaptación del sistema Glicko para MTT.
                      Tu score ({result.score.toFixed(2)}) se compara con tu
                      score esperado ({result.expected.toFixed(2)}) basado en
                      tu ELO vs el promedio del field. Si superas las expectativas
                      ganas puntos; si no, pierdes. El Factor K ({result.kFinal.toFixed(1)}) amplifica el
                      cambio — es mayor para jugadores nuevos (&lt;30 torneos), buy-ins altos y fields grandes.
                      El peso del torneo ({result.weight.toFixed(2)}) hace que ganar contra un field fuerte valga más.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Educational Content */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 mb-8">
            <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">
              ¿Cómo funciona el ELO en Sharkania?
            </h2>
            <div className="space-y-3 text-sk-sm text-sk-text-2 leading-relaxed">
              <p>
                A diferencia del ajedrez donde el ELO se basa en partidas 1v1,
                el sistema de Sharkania está adaptado para{" "}
                <strong className="text-sk-text-1">
                  torneos multi-jugador (MTT)
                </strong>
                . Tu posición final se normaliza en un score de 0 a 1, y se
                compara con lo que se esperaba de ti según tu ELO y el del field.
              </p>
              <p>
                <strong className="text-sk-text-1">
                  Los jugadores nuevos (&lt;30 torneos) tienen un Factor K de 40
                </strong>
                , lo que significa que su ELO se mueve más rápido — tanto para
                arriba como para abajo. Después de 30 torneos, el K baja a 20 y
                el ELO se estabiliza.
              </p>
              <p>
                <strong className="text-sk-text-1">
                  No solo importa tu posición — importa contra quién juegas
                </strong>
                . Ganar un torneo con ELO promedio de 1500 vale más que ganar uno
                con promedio de 1100. El sistema recompensa a los que compiten
                en campos difíciles.
              </p>
            </div>

            <h3 className="text-sk-sm font-bold text-sk-text-1 mt-5 mb-2">
              Tips para subir tu ELO
            </h3>
            <ul className="space-y-2 text-sk-sm text-sk-text-2">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-green shrink-0" />
                <span>
                  <strong className="text-sk-text-1">Consistencia &gt; grandes scores.</strong>{" "}
                  Quedar top 30% consistentemente suma más ELO que ganar 1 torneo y quedar último en 5.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-green shrink-0" />
                <span>
                  <strong className="text-sk-text-1">Juega torneos con fields fuertes.</strong>{" "}
                  El peso del torneo multiplica tus ganancias si el ELO promedio supera 1200.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-green shrink-0" />
                <span>
                  <strong className="text-sk-text-1">Tus primeros 30 torneos son clave.</strong>{" "}
                  Con K=40, puedes subir rápido si juegas bien — pero también caer si no te concentras.
                </span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 text-center">
            <p className="text-sk-xs font-mono font-semibold uppercase tracking-widest text-sk-accent mb-2">
              Deja de simular — empieza a competir
            </p>
            <h3 className="text-sk-lg font-extrabold text-sk-text-1 tracking-tight mb-2">
              Registra tu club y obtén tu ELO real
            </h3>
            <p className="text-sk-sm text-sk-text-2 mb-4 max-w-md mx-auto">
              Sharkania calcula tu ELO basándose en resultados reales.
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
