// src/pages/bankroll-calculator.tsx
import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import {
  ArrowLeft,
  ChevronRight,
  Wallet,
  RotateCcw,
  Calculator,
  Info,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  TrendingUp,
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// BANKROLL MATH
// ══════════════════════════════════════════════════════════

type RiskProfile = "conservative" | "moderate" | "aggressive";

interface BankrollInput {
  bankroll: number;
  avgBuyIn: number;
  roi: number;          // % (e.g. 15 = 15%)
  profile: RiskProfile;
  tournamentsPerWeek: number;
  avgFieldSize: number;
}

interface BuyInTier {
  buyIn: number;
  label: string;
  buyInsAvailable: number;
  riskOfRuin: number;   // 0-1
  status: "safe" | "caution" | "danger";
  recommended: boolean;
}

interface BankrollResult {
  maxBuyIn: number;
  recommendedBuyIn: number;
  buyInsAtRecommended: number;
  riskOfRuin: number;
  monthsToDouble: number | null;
  tiers: BuyInTier[];
  weeklyEV: number;
  monthlyEV: number;
}

const PROFILE_MULTIPLIERS: Record<RiskProfile, { minBuyIns: number; rorTarget: number; label: string; emoji: string; color: string }> = {
  conservative: { minBuyIns: 100, rorTarget: 0.01, label: "Conservador", emoji: "🛡️", color: "#34d399" },
  moderate:     { minBuyIns: 60,  rorTarget: 0.05, label: "Moderado",    emoji: "⚖️", color: "#22d3ee" },
  aggressive:   { minBuyIns: 30,  rorTarget: 0.10, label: "Agresivo",    emoji: "🔥", color: "#fb923c" },
};

const BUY_IN_LEVELS = [0, 1, 2, 3, 3.3, 5, 5.5, 10, 11, 15, 20, 22, 30, 33, 50, 55, 100, 109];

/**
 * Simplified Risk of Ruin formula for MTT:
 * RoR ≈ ((1 - edge) / (1 + edge)) ^ (bankroll / (buyIn * varianceMult))
 * where edge = ROI / (100 + ROI)
 * varianceMult accounts for field size: larger fields = more variance = higher RoR
 */
function calculateRoR(bankroll: number, buyIn: number, roiPct: number, varianceMult: number): number {
  if (buyIn <= 0 || bankroll <= 0) return 0;
  const edge = roiPct / (100 + roiPct);
  if (edge <= 0) return 1;
  const ratio = (1 - edge) / (1 + edge);
  // Variance multiplier effectively reduces your "effective buy-ins"
  const effectiveBuyIns = bankroll / (buyIn * varianceMult);
  return Math.pow(ratio, effectiveBuyIns);
}

/**
 * Field size → variance multiplier
 * SNG (6-9): 1.0x (baseline)
 * Small MTT (10-30): 1.2x
 * Medium MTT (30-80): 1.5x
 * Large MTT (80-200): 1.8x
 * Massive MTT (200+): 2.0x
 */
function getVarianceMultiplier(fieldSize: number): number {
  if (fieldSize <= 9) return 1.0;
  if (fieldSize <= 30) return 1.0 + (fieldSize - 9) * (0.2 / 21);
  if (fieldSize <= 80) return 1.2 + (fieldSize - 30) * (0.3 / 50);
  if (fieldSize <= 200) return 1.5 + (fieldSize - 80) * (0.3 / 120);
  return 2.0;
}

function getVarianceLabel(fieldSize: number): string {
  const mult = getVarianceMultiplier(fieldSize);
  if (mult <= 1.05) return "Baja (SNG)";
  if (mult <= 1.25) return "Moderada";
  if (mult <= 1.55) return "Alta (MTT)";
  if (mult <= 1.85) return "Muy alta";
  return "Extrema";
}

function calculateBankroll(input: BankrollInput): BankrollResult {
  const { bankroll, avgBuyIn, roi, profile, tournamentsPerWeek, avgFieldSize } = input;
  const profileConfig = PROFILE_MULTIPLIERS[profile];
  const varianceMult = getVarianceMultiplier(avgFieldSize);

  // Adjust min buy-ins by variance — larger fields need more cushion
  const adjustedMinBuyIns = Math.ceil(profileConfig.minBuyIns * varianceMult);

  // Max and recommended buy-in
  const maxBuyIn = bankroll / adjustedMinBuyIns;
  const recommendedBuyIn = BUY_IN_LEVELS.filter(b => b > 0 && b <= maxBuyIn).pop() ?? 0;
  const buyInsAtRecommended = recommendedBuyIn > 0 ? Math.floor(bankroll / recommendedBuyIn) : 0;

  // Risk of ruin at recommended
  const riskOfRuin = recommendedBuyIn > 0 ? calculateRoR(bankroll, recommendedBuyIn, roi, varianceMult) : 0;

  // EV calculations
  const evPerTournament = avgBuyIn > 0 ? avgBuyIn * (roi / 100) : 0;
  const weeklyEV = evPerTournament * tournamentsPerWeek;
  const monthlyEV = weeklyEV * 4.33;

  // Months to double
  const monthsToDouble = monthlyEV > 0 ? bankroll / monthlyEV : null;

  // Build tiers
  const tiers: BuyInTier[] = BUY_IN_LEVELS
    .filter(b => b > 0)
    .map(buyIn => {
      const buyIns = Math.floor(bankroll / buyIn);
      const ror = calculateRoR(bankroll, buyIn, roi, varianceMult);
      let status: "safe" | "caution" | "danger";
      if (ror <= profileConfig.rorTarget) status = "safe";
      else if (ror <= profileConfig.rorTarget * 3) status = "caution";
      else status = "danger";

      return {
        buyIn,
        label: `$${buyIn}`,
        buyInsAvailable: buyIns,
        riskOfRuin: ror,
        status,
        recommended: buyIn === recommendedBuyIn,
      };
    })
    .filter(t => t.buyInsAvailable >= 1);

  return {
    maxBuyIn,
    recommendedBuyIn,
    buyInsAtRecommended,
    riskOfRuin,
    monthsToDouble,
    tiers,
    weeklyEV,
    monthlyEV,
  };
}

// ══════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════

function RiskMeter({ ror }: { ror: number }) {
  const pct = Math.min(ror * 100, 100);
  const color = pct < 2 ? "#34d399" : pct < 10 ? "#fbbf24" : pct < 25 ? "#fb923c" : "#f87171";
  return (
    <div className="w-full">
      <div className="h-2 bg-sk-bg-4 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(pct, 1)}%`, background: color }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-sk-text-4">0%</span>
        <span className="text-[10px] font-mono font-bold" style={{ color }}>
          {pct < 0.1 ? "<0.1%" : `${pct.toFixed(1)}%`}
        </span>
        <span className="text-[10px] text-sk-text-4">100%</span>
      </div>
    </div>
  );
}

function TierRow({ tier }: { tier: BuyInTier }) {
  const StatusIcon = tier.status === "safe" ? ShieldCheck : tier.status === "caution" ? AlertTriangle : XCircle;
  const statusColor = tier.status === "safe" ? "#34d399" : tier.status === "caution" ? "#fbbf24" : "#f87171";

  return (
    <div
      className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
        tier.recommended
          ? "bg-sk-accent/[0.06] border border-sk-accent/20"
          : "hover:bg-white/[0.02]"
      }`}
    >
      <StatusIcon size={14} style={{ color: statusColor }} className="shrink-0" />
      <span className={`font-mono text-sk-sm w-16 shrink-0 ${tier.recommended ? "font-bold text-sk-accent" : "text-sk-text-1"}`}>
        ${tier.buyIn}
      </span>
      <span className="font-mono text-[11px] text-sk-text-3 w-20 shrink-0">
        {tier.buyInsAvailable} buy-ins
      </span>
      <div className="flex-1">
        <div className="h-1.5 bg-sk-bg-4 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(tier.riskOfRuin * 100, 100)}%`,
              background: statusColor,
            }}
          />
        </div>
      </div>
      <span className="font-mono text-[11px] w-14 text-right shrink-0" style={{ color: statusColor }}>
        {(tier.riskOfRuin * 100) < 0.1 ? "<0.1%" : `${(tier.riskOfRuin * 100).toFixed(1)}%`}
      </span>
      {tier.recommended && (
        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-sk-accent bg-sk-accent/10 px-2 py-0.5 rounded-full shrink-0">
          rec
        </span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════

export function BankrollCalculatorPage() {
  const [bankroll, setBankroll] = useState(500);
  const [avgBuyIn, setAvgBuyIn] = useState(5.5);
  const [roi, setRoi] = useState(15);
  const [profile, setProfile] = useState<RiskProfile>("moderate");
  const [tournamentsPerWeek, setTournamentsPerWeek] = useState(10);
  const [avgFieldSize, setAvgFieldSize] = useState(45);
  const [calculated, setCalculated] = useState(false);

  const result = useMemo(() => {
    if (!calculated) return null;
    return calculateBankroll({ bankroll, avgBuyIn, roi, profile, tournamentsPerWeek, avgFieldSize });
  }, [calculated, bankroll, avgBuyIn, roi, profile, tournamentsPerWeek, avgFieldSize]);

  const handleReset = useCallback(() => {
    setBankroll(500);
    setAvgBuyIn(5.5);
    setRoi(15);
    setProfile("moderate");
    setTournamentsPerWeek(10);
    setAvgFieldSize(45);
    setCalculated(false);
  }, []);

  const profileConfig = PROFILE_MULTIPLIERS[profile];

  return (
    <PageShell>
      <SEOHead
        title="Calculadora de Bankroll"
        description="Calcula tu bankroll óptimo para torneos de poker. Riesgo de ruina, buy-ins recomendados y proyección de ganancias."
        path="/tools/calculadora-banca"
        ogImage="https://sharkania.com/images/tools/og-tool-bankroll.png"
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
              <div className="w-10 h-10 rounded-lg bg-sk-gold-dim flex items-center justify-center">
                <Wallet size={20} className="text-sk-gold" />
              </div>
              <div>
                <h1 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight">
                  Calculadora de Bankroll
                </h1>
                <p className="text-sk-xs text-sk-text-3">
                  Gestión de banca para torneos MTT
                </p>
              </div>
            </div>
            <p className="text-sk-sm text-sk-text-2 mt-3 max-w-2xl leading-relaxed">
              Ingresa tu bankroll, tu ROI estimado y tu perfil de riesgo. Te
              decimos qué buy-ins puedes jugar, tu riesgo de ruina y cuánto
              puedes esperar ganar por mes.
            </p>
          </div>

          {/* Input Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Left: Numbers */}
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wallet size={15} className="text-sk-gold" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2">
                  Tu situación
                </span>
              </div>

              {/* Bankroll */}
              <div className="mb-5">
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    Bankroll total
                  </label>
                  <span className="font-mono text-sk-sm font-bold text-sk-gold">
                    ${bankroll.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="10000"
                  step="50"
                  value={bankroll}
                  onChange={(e) => { setBankroll(Number(e.target.value)); setCalculated(false); }}
                  className="w-full accent-[#fbbf24]"
                />
                <div className="flex justify-between text-[10px] text-sk-text-4 mt-0.5">
                  <span>$50</span>
                  <span>$10,000</span>
                </div>
              </div>

              {/* Avg Buy-in */}
              <div className="mb-5">
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    Buy-in promedio que juegas
                  </label>
                  <span className="font-mono text-sk-sm font-bold text-sk-text-1">
                    ${avgBuyIn.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="100"
                  step="0.5"
                  value={avgBuyIn}
                  onChange={(e) => { setAvgBuyIn(Number(e.target.value)); setCalculated(false); }}
                  className="w-full accent-[#fbbf24]"
                />
                <div className="flex justify-between text-[10px] text-sk-text-4 mt-0.5">
                  <span>$0.50</span>
                  <span>$100</span>
                </div>
              </div>

              {/* ROI */}
              <div className="mb-5">
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    ROI estimado
                  </label>
                  <span className="font-mono text-sk-sm font-bold" style={{ color: roi > 0 ? "#34d399" : roi < 0 ? "#f87171" : "#a1a1aa" }}>
                    {roi > 0 ? "+" : ""}{roi}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="80"
                  step="1"
                  value={roi}
                  onChange={(e) => { setRoi(Number(e.target.value)); setCalculated(false); }}
                  className="w-full accent-[#34d399]"
                />
                <div className="flex justify-between text-[10px] text-sk-text-4 mt-0.5">
                  <span>-20% (perdedor)</span>
                  <span>0%</span>
                  <span>80% (elite)</span>
                </div>
              </div>

              {/* Tournaments per week */}
              <div className="mb-5">
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    Torneos por semana
                  </label>
                  <span className="font-mono text-sk-sm font-bold text-sk-text-1">
                    {tournamentsPerWeek}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={tournamentsPerWeek}
                  onChange={(e) => { setTournamentsPerWeek(Number(e.target.value)); setCalculated(false); }}
                  className="w-full accent-[#22d3ee]"
                />
                <div className="flex justify-between text-[10px] text-sk-text-4 mt-0.5">
                  <span>1 (casual)</span>
                  <span>50 (grinder)</span>
                </div>
              </div>

              {/* Avg Field Size */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3">
                    Jugadores promedio por torneo
                  </label>
                  <span className="font-mono text-sk-sm font-bold text-sk-text-1">
                    {avgFieldSize}
                  </span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="300"
                  step="1"
                  value={avgFieldSize}
                  onChange={(e) => { setAvgFieldSize(Number(e.target.value)); setCalculated(false); }}
                  className="w-full accent-[#a78bfa]"
                />
                <div className="flex justify-between text-[10px] mt-0.5">
                  <span className="text-sk-text-4">6 (SNG)</span>
                  <span className="font-mono font-bold" style={{ color: "#a78bfa" }}>
                    Varianza: {getVarianceLabel(avgFieldSize)} ({getVarianceMultiplier(avgFieldSize).toFixed(2)}x)
                  </span>
                  <span className="text-sk-text-4">300 (MTT)</span>
                </div>
              </div>
            </div>

            {/* Right: Risk Profile */}
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck size={15} className="text-sk-accent" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2">
                  Perfil de riesgo
                </span>
              </div>

              <div className="flex flex-col gap-2 mb-6">
                {(Object.keys(PROFILE_MULTIPLIERS) as RiskProfile[]).map((key) => {
                  const cfg = PROFILE_MULTIPLIERS[key];
                  const isSelected = profile === key;
                  return (
                    <button
                      key={key}
                      onClick={() => { setProfile(key); setCalculated(false); }}
                      className={`w-full text-left px-4 py-3.5 rounded-lg border transition-all duration-200 ${
                        isSelected
                          ? "border-opacity-30 bg-opacity-10"
                          : "bg-sk-bg-3 border-sk-border-2 hover:border-sk-border-3"
                      }`}
                      style={{
                        borderColor: isSelected ? `${cfg.color}50` : undefined,
                        background: isSelected ? `${cfg.color}10` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cfg.emoji}</span>
                        <div className="flex-1">
                          <p className={`text-sk-sm font-semibold ${isSelected ? "text-sk-text-1" : "text-sk-text-2"}`}>
                            {cfg.label}
                          </p>
                          <p className="text-[11px] text-sk-text-3">
                            Mín. {cfg.minBuyIns} buy-ins · RoR objetivo: {(cfg.rorTarget * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? "" : "border-sk-border-3"
                          }`}
                          style={{ borderColor: isSelected ? cfg.color : undefined, background: isSelected ? cfg.color : undefined }}
                        >
                          {isSelected && (
                            <svg width="8" height="8" viewBox="0 0 10 10">
                              <path d="M2 5L4.5 7.5L8 3" fill="none" stroke="#09090b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quick summary */}
              <div className="bg-sk-bg-0 border border-sk-border-1 rounded-lg p-4">
                <p className="font-mono text-[11px] font-semibold text-sk-text-3 uppercase tracking-wide mb-2">
                  Con tu perfil {profileConfig.label.toLowerCase()}
                </p>
                <div className="space-y-1.5 text-sk-sm">
                  <div className="flex justify-between">
                    <span className="text-sk-text-3">Buy-ins mín. ajustados:</span>
                    <span className="font-mono font-bold text-sk-text-1">
                      {Math.ceil(profileConfig.minBuyIns * getVarianceMultiplier(avgFieldSize))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sk-text-3">Buy-in máximo:</span>
                    <span className="font-mono font-bold text-sk-text-1">
                      ${(bankroll / Math.ceil(profileConfig.minBuyIns * getVarianceMultiplier(avgFieldSize))).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sk-text-3">Buy-ins disponibles:</span>
                    <span className="font-mono font-bold text-sk-text-1">
                      {avgBuyIn > 0 ? Math.floor(bankroll / avgBuyIn) : "—"} (a ${avgBuyIn})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sk-text-3">EV por torneo:</span>
                    <span className="font-mono font-bold" style={{ color: roi > 0 ? "#34d399" : "#f87171" }}>
                      {roi > 0 ? "+" : ""}${(avgBuyIn * roi / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Calculate */}
          <div className="flex items-center gap-3 mb-8">
            <Button
              variant="accent"
              size="lg"
              onClick={() => setCalculated(true)}
              className="flex-1 sm:flex-none sm:min-w-[200px]"
            >
              <Calculator size={16} />
              Calcular
            </Button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-sk-sm text-sk-text-3 hover:text-sk-text-1 transition-colors"
            >
              <RotateCcw size={14} />
              Reiniciar
            </button>
          </div>

          {/* Results */}
          {calculated && result && (
            <div className="mb-8 animate-fadeIn">
              {/* Top Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="bg-sk-bg-2 border border-sk-border-1 rounded-lg p-3.5">
                  <p className="font-mono text-[10px] text-sk-text-4 uppercase tracking-wide mb-1">Buy-in recomendado</p>
                  <p className="font-mono text-sk-lg font-bold text-sk-accent">
                    ${result.recommendedBuyIn.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-sk-text-4">{result.buyInsAtRecommended} buy-ins</p>
                </div>
                <div className="bg-sk-bg-2 border border-sk-border-1 rounded-lg p-3.5">
                  <p className="font-mono text-[10px] text-sk-text-4 uppercase tracking-wide mb-1">Riesgo de ruina</p>
                  <p className="font-mono text-sk-lg font-bold" style={{ color: result.riskOfRuin < 0.05 ? "#34d399" : result.riskOfRuin < 0.15 ? "#fbbf24" : "#f87171" }}>
                    {(result.riskOfRuin * 100) < 0.1 ? "<0.1%" : `${(result.riskOfRuin * 100).toFixed(1)}%`}
                  </p>
                  <RiskMeter ror={result.riskOfRuin} />
                </div>
                <div className="bg-sk-bg-2 border border-sk-border-1 rounded-lg p-3.5">
                  <p className="font-mono text-[10px] text-sk-text-4 uppercase tracking-wide mb-1">EV mensual</p>
                  <p className="font-mono text-sk-lg font-bold" style={{ color: result.monthlyEV >= 0 ? "#34d399" : "#f87171" }}>
                    {result.monthlyEV >= 0 ? "+" : ""}${result.monthlyEV.toFixed(0)}
                  </p>
                  <p className="text-[10px] text-sk-text-4">${result.weeklyEV.toFixed(1)}/semana</p>
                </div>
                <div className="bg-sk-bg-2 border border-sk-border-1 rounded-lg p-3.5">
                  <p className="font-mono text-[10px] text-sk-text-4 uppercase tracking-wide mb-1">Meses para duplicar</p>
                  <p className="font-mono text-sk-lg font-bold text-sk-text-1">
                    {result.monthsToDouble !== null && result.monthsToDouble > 0
                      ? result.monthsToDouble < 1 ? "<1" : Math.ceil(result.monthsToDouble).toString()
                      : "—"}
                  </p>
                  <p className="text-[10px] text-sk-text-4">
                    {result.monthsToDouble !== null && result.monthsToDouble > 0
                      ? `$${bankroll} → $${(bankroll * 2).toLocaleString()}`
                      : "ROI negativo o cero"}
                  </p>
                </div>
              </div>

              {/* Buy-in Tiers */}
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sk-sm font-bold text-sk-text-1">
                    Tabla de buy-ins
                  </h3>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><ShieldCheck size={10} className="text-sk-green" /> Seguro</span>
                    <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-sk-gold" /> Precaución</span>
                    <span className="flex items-center gap-1"><XCircle size={10} className="text-sk-red" /> Peligro</span>
                  </div>
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 py-1.5 px-3 text-[10px] font-mono uppercase tracking-wide text-sk-text-4 border-b border-sk-border-1 mb-1">
                  <span className="w-3.5" />
                  <span className="w-16">Buy-in</span>
                  <span className="w-20">Disponibles</span>
                  <span className="flex-1">Riesgo de ruina</span>
                  <span className="w-14 text-right">RoR %</span>
                  <span className="w-8" />
                </div>

                <div className="flex flex-col gap-0.5">
                  {result.tiers.map((tier) => (
                    <TierRow key={tier.buyIn} tier={tier} />
                  ))}
                </div>
              </div>

              {/* Insight */}
              <div className="bg-sk-bg-2 border border-sk-accent/15 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-sk-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sk-xs font-semibold text-sk-accent mb-1">
                      Recomendación para tu perfil
                    </p>
                    <p className="text-sk-xs text-sk-text-3 leading-relaxed">
                      Con un bankroll de <span className="font-mono text-sk-text-2">${bankroll.toLocaleString()}</span> y
                      perfil <span className="text-sk-text-2">{profileConfig.label.toLowerCase()}</span>,
                      tu buy-in máximo recomendado es{" "}
                      <span className="font-mono font-bold text-sk-accent">${result.recommendedBuyIn}</span>
                      {" "}({result.buyInsAtRecommended} buy-ins disponibles).
                      {result.riskOfRuin < 0.02
                        ? " Tu riesgo de ruina es prácticamente cero — estás muy bien capitalizado."
                        : result.riskOfRuin < 0.10
                        ? " Tu riesgo de ruina es aceptable. Mantén la disciplina."
                        : " Tu riesgo de ruina es elevado. Considera bajar de buy-in o aumentar tu bankroll."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Projection */}
              {roi > 0 && (
                <div className="bg-sk-bg-2 border border-sk-green/15 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <TrendingUp size={14} className="text-sk-green mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sk-xs font-semibold text-sk-green mb-1">
                        Proyección a 6 meses
                      </p>
                      <p className="text-sk-xs text-sk-text-3 leading-relaxed">
                        Jugando <span className="font-mono text-sk-text-2">{tournamentsPerWeek}</span> torneos/semana
                        con ROI de <span className="font-mono text-sk-green">+{roi}%</span> a un buy-in promedio
                        de <span className="font-mono text-sk-text-2">${avgBuyIn}</span>:
                        en 6 meses tu bankroll proyectado sería{" "}
                        <span className="font-mono font-bold text-sk-green">
                          ${Math.round(bankroll + result.monthlyEV * 6).toLocaleString()}
                        </span>
                        {" "}(+${Math.round(result.monthlyEV * 6).toLocaleString()}).
                        Esto asume que mantienes el mismo volumen y ROI.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Educational Content */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 mb-8">
            <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">
              ¿Cómo gestionar tu bankroll en poker?
            </h2>
            <div className="space-y-3 text-sk-sm text-sk-text-2 leading-relaxed">
              <p>
                El <strong className="text-sk-text-1">bankroll management</strong> es
                la habilidad más importante que separa a los jugadores que sobreviven
                de los que quiebran. No importa cuán bueno seas — si juegas con
                stakes que tu bankroll no puede soportar, la varianza te va a
                eliminar.
              </p>
              <p>
                La <strong className="text-sk-text-1">regla general</strong> es
                tener entre 30 y 100 buy-ins para el nivel que juegas,
                dependiendo de tu tolerancia al riesgo y tu ROI. Jugadores
                nuevos o con ROI bajo necesitan más buy-ins.
              </p>
              <p>
                El <strong className="text-sk-text-1">riesgo de ruina (RoR)</strong> es
                la probabilidad de perder todo tu bankroll. Un RoR menor al 5%
                es aceptable para la mayoría de jugadores. Debajo del 1% estás
                prácticamente inmune a la varianza.
              </p>
            </div>

            <h3 className="text-sk-sm font-bold text-sk-text-1 mt-5 mb-2">
              Reglas de oro
            </h3>
            <ul className="space-y-2 text-sk-sm text-sk-text-2">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-gold shrink-0" />
                <span><strong className="text-sk-text-1">Nunca juegues más del 2-3% de tu bankroll</strong> en un solo torneo. Si tienes $500, tu buy-in máximo debería ser $10-15.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-gold shrink-0" />
                <span><strong className="text-sk-text-1">Baja de nivel si pierdes el 30%.</strong> Si tu bankroll cae de $500 a $350, baja a buy-ins menores hasta recuperar.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-gold shrink-0" />
                <span><strong className="text-sk-text-1">Sube de nivel gradualmente.</strong> Si duplicas tu bankroll, puedes subir al siguiente nivel de buy-in.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sk-gold shrink-0" />
                <span><strong className="text-sk-text-1">Separa tu bankroll de poker de tu dinero personal.</strong> Solo juega con dinero que puedas permitirte perder.</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 text-center">
            <p className="text-sk-xs font-mono font-semibold uppercase tracking-widest text-sk-accent mb-2">
              Trackea tu bankroll real
            </p>
            <h3 className="text-sk-lg font-extrabold text-sk-text-1 tracking-tight mb-2">
              Sharkania calcula tu ROI automáticamente
            </h3>
            <p className="text-sk-sm text-sk-text-2 mb-4 max-w-md mx-auto">
              Con datos reales de tus torneos, puedes saber tu ROI exacto y
              ajustar tu bankroll management con precisión.
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
        .animate-fadeIn { animation: fadeIn 0.35s ease-out; }
      `}</style>
    </PageShell>
  );
}
