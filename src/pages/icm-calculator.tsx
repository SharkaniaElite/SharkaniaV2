// src/pages/icm-calculator.tsx
import { useState, useCallback, useMemo, useEffect } from "react"; // 👈 Agregamos useEffect
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import {
  Plus,
  Trash2,
  RotateCcw,
  Calculator,
  Info,
  ChevronRight,
  ArrowLeft,
  Users,
  DollarSign,
} from "lucide-react";
import { useFeatureAccess } from "../hooks/use-shop";
import { useAuthStore } from "../stores/auth-store";
import { FeaturePaywall } from "../components/shop/feature-paywall";
import { supabase } from "../lib/supabase"; // 👈 IMPORTANTE: Agregamos supabase

// ══════════════════════════════════════════════════════════
// ICM ALGORITHM (Malmuth-Harville)
// ══════════════════════════════════════════════════════════

/**
 * Calculates ICM equity for each player using the Malmuth-Harville model.
 * This is the industry-standard algorithm used by PokerStars, GGPoker, etc.
 *
 * @param stacks - Array of chip counts for each player
 * @param payouts - Array of prize amounts for each position (1st, 2nd, 3rd...)
 * @returns Array of equity values (in dollars) for each player
 */
function calculateICM(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  const totalChips = stacks.reduce((sum, s) => sum + s, 0);

  if (totalChips === 0 || n === 0) return stacks.map(() => 0);
  if (n === 1) return [payouts[0] ?? 0];

  // For performance, limit recursive depth for large fields
  const maxDepth = Math.min(payouts.length, n, 8);
  const equities = new Array<number>(n).fill(0);

  // Recursive probability calculation
  function recurse(
    remainingStacks: number[],
    place: number,
    probability: number
  ) {
    if (place >= maxDepth || probability < 1e-10) return;

    const remaining = remainingStacks.reduce((s, v) => s + v, 0);
    if (remaining <= 0) return;

    for (let i = 0; i < n; i++) {
      const stack = remainingStacks[i] ?? 0;
      if (stack <= 0) continue;

      const pFinish = (stack / remaining) * probability;
      equities[i] = (equities[i] ?? 0) + pFinish * (payouts[place] ?? 0);

      // Remove this player and recurse for next place
      const newStacks = [...remainingStacks];
      newStacks[i] = 0;
      recurse(newStacks, place + 1, pFinish);
    }
  }

  recurse([...stacks], 0, 1);
  return equities;
}

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

interface PlayerEntry {
  id: string;
  label: string;
  chips: string;
}

interface PayoutEntry {
  place: number;
  amount: string;
}

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

let idCounter = 0;
function uid(): string {
  return `p_${++idCounter}_${Date.now()}`;
}

function formatMoney(value: number): string {
  if (value >= 1000) {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatChips(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

const DEFAULT_PLAYERS: PlayerEntry[] = [
  { id: uid(), label: "Jugador 1", chips: "50000" },
  { id: uid(), label: "Jugador 2", chips: "30000" },
  { id: uid(), label: "Jugador 3", chips: "20000" },
];

const DEFAULT_PAYOUTS: PayoutEntry[] = [
  { place: 1, amount: "500" },
  { place: 2, amount: "300" },
  { place: 3, amount: "200" },
];

// ══════════════════════════════════════════════════════════
// PRESETS
// ══════════════════════════════════════════════════════════

interface Preset {
  label: string;
  players: PlayerEntry[];
  payouts: PayoutEntry[];
}

const PRESETS: Preset[] = [
  {
    label: "3 jugadores",
    players: [
      { id: uid(), label: "Jugador 1", chips: "50000" },
      { id: uid(), label: "Jugador 2", chips: "30000" },
      { id: uid(), label: "Jugador 3", chips: "20000" },
    ],
    payouts: [
      { place: 1, amount: "500" },
      { place: 2, amount: "300" },
      { place: 3, amount: "200" },
    ],
  },
  {
    label: "Burbuja (4J / 3 pagan)",
    players: [
      { id: uid(), label: "Líder", chips: "60000" },
      { id: uid(), label: "Medio 1", chips: "25000" },
      { id: uid(), label: "Medio 2", chips: "10000" },
      { id: uid(), label: "Short", chips: "5000" },
    ],
    payouts: [
      { place: 1, amount: "500" },
      { place: 2, amount: "300" },
      { place: 3, amount: "200" },
    ],
  },
  {
    label: "Mesa final (6J)",
    players: [
      { id: uid(), label: "Chip leader", chips: "120000" },
      { id: uid(), label: "Jugador 2", chips: "80000" },
      { id: uid(), label: "Jugador 3", chips: "60000" },
      { id: uid(), label: "Jugador 4", chips: "40000" },
      { id: uid(), label: "Jugador 5", chips: "25000" },
      { id: uid(), label: "Jugador 6", chips: "15000" },
    ],
    payouts: [
      { place: 1, amount: "1000" },
      { place: 2, amount: "600" },
      { place: 3, amount: "400" },
      { place: 4, amount: "250" },
      { place: 5, amount: "150" },
      { place: 6, amount: "100" },
    ],
  },
  {
    label: "Heads-up",
    players: [
      { id: uid(), label: "Jugador 1", chips: "65000" },
      { id: uid(), label: "Jugador 2", chips: "35000" },
    ],
    payouts: [
      { place: 1, amount: "700" },
      { place: 2, amount: "300" },
    ],
  },
];

// ══════════════════════════════════════════════════════════
// RESULT BAR COMPONENT
// ══════════════════════════════════════════════════════════

function ResultBar({
  label,
  chips,
  equity,
  equityPct,
  chipPct,
  isMax,
  index,
}: {
  label: string;
  chips: number;
  equity: number;
  equityPct: number;
  chipPct: number;
  isMax: boolean;
  index: number;
}) {
  const diff = equityPct - chipPct;
  const diffColor = diff > 0.5 ? "#34d399" : diff < -0.5 ? "#f87171" : "#a1a1aa";
  const diffSign = diff > 0 ? "+" : "";

  return (
    <div
      className="bg-sk-bg-2 border border-sk-border-1 rounded-lg p-4 transition-all duration-300"
      style={{
        animationDelay: `${index * 60}ms`,
        borderColor: isMax ? "rgba(34,211,238,0.25)" : undefined,
        background: isMax ? "rgba(34,211,238,0.04)" : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          {isMax && (
            <span className="w-1.5 h-1.5 rounded-full bg-sk-accent shrink-0" />
          )}
          <span className="text-sk-sm font-semibold text-sk-text-1">
            {label}
          </span>
        </div>
        <span
          className="font-mono text-sk-lg font-bold tracking-tight"
          style={{ color: isMax ? "#22d3ee" : "#fafafa" }}
        >
          {formatMoney(equity)}
        </span>
      </div>

      {/* Equity bar */}
      <div className="h-2 bg-sk-bg-4 rounded-full overflow-hidden mb-2.5">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(equityPct, 1)}%`,
            background: isMax
              ? "linear-gradient(90deg, #22d3ee, #06b6d4)"
              : "rgba(255,255,255,0.20)",
          }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-mono text-sk-text-3">
          {formatChips(chips)} fichas ({formatPercent(chipPct)})
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sk-text-2">
            Equity: {formatPercent(equityPct)}
          </span>
          <span className="font-mono font-bold" style={{ color: diffColor }}>
            {diffSign}{diff.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════

export function ICMCalculatorPage() {
  const [players, setPlayers] = useState<PlayerEntry[]>(DEFAULT_PLAYERS);
  const [payouts, setPayouts] = useState<PayoutEntry[]>(DEFAULT_PAYOUTS);
  const [calculated, setCalculated] = useState(false);

  // Parse values
  const chipValues = useMemo(
    () => players.map((p) => Math.max(0, parseInt(p.chips) || 0)),
    [players]
  );
  const payoutValues = useMemo(
    () => payouts.map((p) => Math.max(0, parseFloat(p.amount) || 0)),
    [payouts]
  );
  const totalChips = useMemo(
    () => chipValues.reduce((s, v) => s + v, 0),
    [chipValues]
  );
  const totalPrize = useMemo(
    () => payoutValues.reduce((s, v) => s + v, 0),
    [payoutValues]
  );

  // ICM calculation
  const equities = useMemo(() => {
    if (!calculated) return null;
    if (totalChips === 0) return null;
    return calculateICM(chipValues, payoutValues);
  }, [calculated, chipValues, payoutValues, totalChips]);

  const maxEquity = equities ? Math.max(...equities) : 0;

  // Handlers
  const addPlayer = useCallback(() => {
    const num = players.length + 1;
    setPlayers((prev) => [
      ...prev,
      { id: uid(), label: `Jugador ${num}`, chips: "10000" },
    ]);
    setCalculated(false);
  }, [players.length]);

  const removePlayer = useCallback(
    (id: string) => {
      if (players.length <= 2) return;
      setPlayers((prev) => prev.filter((p) => p.id !== id));
      setCalculated(false);
    },
    [players.length]
  );

  const updatePlayer = useCallback(
    (id: string, field: "label" | "chips", value: string) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
      );
      setCalculated(false);
    },
    []
  );

  const addPayout = useCallback(() => {
    const place = payouts.length + 1;
    setPayouts((prev) => [...prev, { place, amount: "100" }]);
    setCalculated(false);
  }, [payouts.length]);

  const removePayout = useCallback(
    (place: number) => {
      if (payouts.length <= 1) return;
      setPayouts((prev) =>
        prev
          .filter((p) => p.place !== place)
          .map((p, i) => ({ ...p, place: i + 1 }))
      );
      setCalculated(false);
    },
    [payouts.length]
  );

  const updatePayout = useCallback((place: number, amount: string) => {
    setPayouts((prev) =>
      prev.map((p) => (p.place === place ? { ...p, amount } : p))
    );
    setCalculated(false);
  }, []);

  const applyPreset = useCallback((preset: Preset) => {
    setPlayers(preset.players.map((p) => ({ ...p, id: uid() })));
    setPayouts([...preset.payouts]);
    setCalculated(false);
  }, []);

  const handleReset = useCallback(() => {
    setPlayers(DEFAULT_PLAYERS.map((p) => ({ ...p, id: uid() })));
    setPayouts([...DEFAULT_PAYOUTS]);
    setCalculated(false);
  }, []);

  const canCalculate =
    totalChips > 0 &&
    totalPrize > 0 &&
    players.length >= 2 &&
    payouts.length >= 1;

// ── Premium access control ──
  const { isAuthenticated, user } = useAuthStore();
  const { data: access } = useFeatureAccess("tool_icm");
  const hasFullAccess = access?.has_access ?? false;

  const [freeUsed, setFreeUsed] = useState(false);
  const [isCheckingDB, setIsCheckingDB] = useState(false);

  // 1. Al cargar la página, revisamos silenciosamente en Supabase si ya la usó hoy
  useEffect(() => {
    if (!isAuthenticated || !user || hasFullAccess) return;

    const checkUsage = async () => {
      const { data } = await supabase
        .from('free_tool_usages')
        .select('last_used_date')
        .eq('user_id', user.id)
        .eq('tool_id', 'tool_icm')
        .single();
      
      const today = new Date().toISOString().split("T")[0];
      if (data && data.last_used_date === today) {
        setFreeUsed(true); // Ya quemó su cartucho de hoy
      }
    };
    
    checkUsage();
  }, [isAuthenticated, user, hasFullAccess]);

  const needsPaywall = isAuthenticated && freeUsed && !hasFullAccess;

  const handleCalculate = async () => {
    if (!canCalculate || isCheckingDB) return;
    
    // Si tiene premium, calcula de inmediato
    if (hasFullAccess) {
      setCalculated(true);
      return;
    }

    // Si sabemos que ya lo usó, bloqueamos y mostramos el paywall
    if (freeUsed) {
      setCalculated(false);
      return;
    }

    // Si es un visitante sin cuenta, podrías dejarlo calcular 1 vez localmente, 
    // o forzarlo a loguearse. Asumimos que lo dejamos calcular 1 vez.
    if (!isAuthenticated || !user) { // 👈 Agregamos || !user aquí
       setCalculated(true);
       setFreeUsed(true);
       return;
    }

    // El momento de la verdad: Consultamos a la base de datos si puede consumirlo
    setIsCheckingDB(true);
    const { data: success } = await supabase.rpc('use_free_tool', {
      p_user_id: user.id, // 👈 Ahora TypeScript sabe que esto es 100% seguro
      p_tool_id: 'tool_icm'
    });
    setIsCheckingDB(false);

    if (success) {
      // Supabase dio luz verde, hacemos el cálculo
      setCalculated(true);
      setFreeUsed(true); // Se bloquea para el SIGUIENTE clic
    } else {
      // Supabase dijo que NO (quizás lo usó en otra pestaña/dispositivo)
      setFreeUsed(true);
      setCalculated(false);
    }
  };

  return (
    <PageShell>
      <SEOHead
        title="Calculadora ICM"
        description="Calcula tu equity ICM en burbuja y mesa final. Algoritmo Malmuth-Harville. Ingresa stacks y premios, obtén resultados instantáneos."
        path="/tools/calculadora-icm"
        ogImage="https://sharkania.com/images/tools/og-tool-icm.png"
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
              <div className="w-10 h-10 rounded-lg bg-sk-accent-dim flex items-center justify-center">
                <Calculator size={20} className="text-sk-accent" />
              </div>
              <div>
                <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight">
                  Calculadora ICM
                </h1>
                <p className="text-sk-xs text-sk-text-3">
                  Independent Chip Model — Malmuth-Harville
                </p>
              </div>
            </div>
            <p className="text-sk-sm text-sk-text-2 mt-3 max-w-2xl leading-relaxed">
              Calcula la equity en dinero real de cada jugador según su stack y
              la estructura de premios. Esencial para decisiones de burbuja,
              mesa final y negociaciones de deal.
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
            {/* Players Column */}
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-sk-accent" />
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2">
                    Jugadores ({players.length})
                  </span>
                </div>
                <button
                  onClick={addPlayer}
                  disabled={players.length >= 9}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sk-accent hover:opacity-80 transition-opacity disabled:opacity-30"
                >
                  <Plus size={13} /> Agregar
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {players.map((player, i) => (
                  <div key={player.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={player.label}
                      onChange={(e) =>
                        updatePlayer(player.id, "label", e.target.value)
                      }
                      className="flex-1 min-w-0 bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 placeholder:text-sk-text-4 focus:outline-none focus:border-sk-accent/50"
                      placeholder={`Jugador ${i + 1}`}
                    />
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={player.chips}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          updatePlayer(player.id, "chips", val);
                        }}
                        className="w-28 bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 pr-8 text-sk-sm text-sk-text-1 font-mono text-right focus:outline-none focus:border-sk-accent/50"
                        placeholder="0"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-sk-text-4 font-mono">
                        ch
                      </span>
                    </div>
                    <button
                      onClick={() => removePlayer(player.id)}
                      disabled={players.length <= 2}
                      className="w-8 h-8 flex items-center justify-center text-sk-text-4 hover:text-sk-red transition-colors disabled:opacity-20"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Total chips */}
              <div className="mt-3 pt-3 border-t border-sk-border-1 flex justify-between">
                <span className="text-[11px] text-sk-text-3 font-mono uppercase">
                  Total fichas
                </span>
                <span className="text-sk-sm font-mono font-bold text-sk-text-1">
                  {totalChips.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payouts Column */}
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign size={15} className="text-sk-gold" />
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2">
                    Premios ({payouts.length} posiciones)
                  </span>
                </div>
                <button
                  onClick={addPayout}
                  disabled={payouts.length >= 9}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sk-gold hover:opacity-80 transition-opacity disabled:opacity-30"
                >
                  <Plus size={13} /> Agregar
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {payouts.map((payout) => (
                  <div key={payout.place} className="flex items-center gap-2">
                    <span className="w-8 text-center font-mono text-sk-sm font-bold text-sk-text-3">
                      {payout.place}°
                    </span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sk-text-4 text-sk-sm">
                        $
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={payout.amount}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.]/g, "");
                          updatePayout(payout.place, val);
                        }}
                        className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 pl-7 pr-3 text-sk-sm text-sk-text-1 font-mono text-right focus:outline-none focus:border-sk-gold/50"
                        placeholder="0"
                      />
                    </div>
                    <button
                      onClick={() => removePayout(payout.place)}
                      disabled={payouts.length <= 1}
                      className="w-8 h-8 flex items-center justify-center text-sk-text-4 hover:text-sk-red transition-colors disabled:opacity-20"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Total prize */}
              <div className="mt-3 pt-3 border-t border-sk-border-1 flex justify-between">
                <span className="text-[11px] text-sk-text-3 font-mono uppercase">
                  Prize pool total
                </span>
                <span className="text-sk-sm font-mono font-bold text-sk-gold">
                  {formatMoney(totalPrize)}
                </span>
              </div>
            </div>
          </div>

          {/* Calculate Button */}
          <div className="flex items-center gap-3 mb-8">
            <Button
              variant="accent"
              size="lg"
              onClick={handleCalculate}
              disabled={!canCalculate || isCheckingDB} // 👈 Agregamos || isCheckingDB
              className="flex-1 sm:flex-none sm:min-w-[200px]"
            >
              <Calculator size={16} />
              {freeUsed && !hasFullAccess ? "🔒 Calcular ICM" : "Calcular ICM"}
            </Button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sk-sm text-sk-text-3 hover:text-sk-text-1 transition-colors"
            >
              <RotateCcw size={14} />
              Reiniciar
            </button>
          </div>

          {/* Paywall — shown after free use is exhausted */}
          {needsPaywall && (
            <div className="mb-8">
              <FeaturePaywall
                featureKey="tool_icm"
                title="Cálculos ICM ilimitados"
                description="Ya usaste tu cálculo gratis de hoy. Desbloquea acceso completo con SharkCoins para calcular sin límites."
              >
                <></>
              </FeaturePaywall>
            </div>
          )}

          {/* Results */}
          {calculated && equities && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sk-md font-bold text-sk-text-1">
                  Resultados ICM
                </h2>
                <span className="font-mono text-[11px] text-sk-text-3">
                  Prize pool: {formatMoney(totalPrize)}
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {players
                  .map((player, i) => ({
                    player,
                    chips: chipValues[i] ?? 0,
                    equity: equities?.[i] ?? 0,
                    equityPct: totalPrize > 0 ? ((equities?.[i] ?? 0) / totalPrize) * 100 : 0,
                    chipPct: totalChips > 0 ? ((chipValues[i] ?? 0) / totalChips) * 100 : 0,
                    index: i,
                  }))
                  .sort((a, b) => b.equity - a.equity)
                  .map((row) => (
                    <ResultBar
                      key={row.player.id}
                      label={row.player.label}
                      chips={row.chips}
                      equity={row.equity}
                      equityPct={row.equityPct}
                      chipPct={row.chipPct}
                      isMax={row.equity === maxEquity}
                      index={row.index}
                    />
                  ))}
              </div>

              {/* Insight box */}
              <div className="mt-4 bg-sk-bg-2 border border-sk-accent/15 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-sk-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sk-xs font-semibold text-sk-accent mb-1">
                      ¿Qué significa esto?
                    </p>
                    <p className="text-sk-xs text-sk-text-3 leading-relaxed">
                      La diferencia entre <span className="font-mono text-sk-text-2">% equity</span> y{" "}
                      <span className="font-mono text-sk-text-2">% fichas</span> muestra el efecto
                      ICM. Un valor <span className="text-sk-green">+positivo</span> significa que tus
                      fichas valen proporcionalmente más de lo que representan en el stack total (típico
                      de stacks cortos). Un valor <span className="text-sk-red">-negativo</span> indica
                      que tus fichas valen menos de lo proporcional (típico del chip leader).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Educational content (SEO) */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 mb-8">
            <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">
              ¿Qué es el ICM?
            </h2>
            <div className="space-y-3 text-sk-sm text-sk-text-2 leading-relaxed">
              <p>
                El <strong className="text-sk-text-1">Independent Chip Model (ICM)</strong> es un
                modelo matemático que convierte las fichas de torneo en equity
                monetaria real. A diferencia del cash game, donde cada ficha
                tiene un valor fijo, en un torneo el valor de tus fichas depende
                de la estructura de premios y los stacks de tus oponentes.
              </p>
              <p>
                El principio clave del ICM es que{" "}
                <strong className="text-sk-text-1">
                  las fichas que ganas valen menos que las fichas que pierdes
                </strong>
                . Esto es porque perder todas tus fichas te elimina del torneo,
                pero ganar fichas adicionales no aumenta tu equity proporcionalmente.
              </p>
              <p>
                Esta calculadora usa el{" "}
                <strong className="text-sk-text-1">modelo Malmuth-Harville</strong>,
                el mismo algoritmo que utilizan las principales salas de poker
                online para calcular deals y chopos en mesa final.
              </p>
            </div>

            <h3 className="text-sk-sm font-bold text-sk-text-1 mt-5 mb-2">
              ¿Cuándo usar el ICM?
            </h3>
            <ul className="space-y-2 text-sk-sm text-sk-text-2">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-accent shrink-0" />
                <span><strong className="text-sk-text-1">Burbuja:</strong> Cuando estás cerca de los premios y necesitas decidir si hacer call a un all-in.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-accent shrink-0" />
                <span><strong className="text-sk-text-1">Mesa final:</strong> Para evaluar si un push o un fold es correcto en términos de dinero real.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-accent shrink-0" />
                <span><strong className="text-sk-text-1">Deals/Chopos:</strong> Para negociar un reparto justo del prize pool basado en los stacks actuales.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-accent shrink-0" />
                <span><strong className="text-sk-text-1">Satélites:</strong> Donde todos los premios son iguales, el ICM tiene un impacto enorme en las decisiones.</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 text-center">
            <p className="text-sk-xs font-mono font-semibold uppercase tracking-widest text-sk-accent mb-2">
              Mejora tu juego con datos reales
            </p>
            <h3 className="text-sk-lg font-extrabold text-sk-text-1 tracking-tight mb-2">
              Trackea tu evolución en Sharkania
            </h3>
            <p className="text-sk-sm text-sk-text-2 mb-4 max-w-md mx-auto">
              Ranking ELO, historial de torneos, estadísticas y más. Gratis para
              jugadores y clubes.
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
    </PageShell>
  );
}
