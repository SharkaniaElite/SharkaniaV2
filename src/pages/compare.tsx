import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import {
  usePlayer,
  usePlayerEloHistory,
  useSearchPlayers,
} from "../hooks/use-players";
import { useAuthStore } from "../stores/auth-store";
import { useFeatureAccess } from "../hooks/use-shop";
import { FlagIcon } from "../components/ui/flag-icon";
import {
  formatElo,
  formatNumber,
  formatPercent,
  formatCurrency,
  calcItm,
  calcRoi,
} from "../lib/format";
import { cn } from "../lib/cn";
import { Search, Lock, Zap, Target, TrendingUp, ShieldAlert } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";
import type { PlayerWithRoom, EloHistory } from "../types";
import { SEOHead } from "../components/seo/seo-head";

// ── Player Selector with autocomplete ──
function PlayerSelector({
  label,
  selectedId,
  onSelect,
}: {
  label: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { data: results } = useSearchPlayers(query);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-2 block">
        {label}
      </label>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sk-text-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar jugador..."
          className="w-full bg-sk-bg-3 border border-sk-border-2 rounded-md py-2.5 pl-9 pr-3 text-sk-sm text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent"
        />
      </div>

      {isOpen && query.length >= 2 && (results ?? []).length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-sk-bg-2 border border-sk-border-2 rounded-md shadow-sk-lg overflow-hidden z-[50]">
          {(results ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect(p.id);
                setQuery(p.nickname);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors text-sk-sm",
                p.id === selectedId && "bg-white/[0.04]"
              )}
            >
              <div className="w-7 h-7 rounded-full bg-sk-bg-4 overflow-hidden flex items-center justify-center shrink-0">
                {p.profiles?.avatar_url ? (
                  <img src={p.profiles.avatar_url} alt={p.nickname} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[11px] font-bold text-sk-accent">{p.nickname.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <FlagIcon countryCode={p.country_code} />
              <span className="font-semibold text-sk-text-1">{p.nickname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Comparison Row ──
function CompareRow({
  label,
  valueA,
  valueB,
  aWins,
  isPremium,
  hasAccess,
}: {
  label: string;
  valueA: string;
  valueB: string;
  aWins: boolean | null;
  isPremium: boolean;
  hasAccess: boolean;
}) {
  const renderValue = (val: string, isWinner: boolean | null, isA: boolean) => {
    if (isPremium && !hasAccess) {
      return (
        <div className={`relative inline-flex items-center ${isA ? "justify-end" : "justify-start"} w-full`}>
          <span className="blur-[6px] select-none opacity-60 pointer-events-none">{val}</span>
          <Lock size={12} className="absolute text-sk-text-1 opacity-80" />
        </div>
      );
    }
    return (
      <div className={cn("w-full font-mono font-bold text-sk-sm", isWinner ? "text-sk-green" : "text-sk-text-1", isA ? "text-right" : "text-left")}>
        {val}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-2.5 border-b border-sk-border-2 last:border-b-0">
      {renderValue(valueA, aWins === true, true)}
      <div className="text-[11px] text-sk-text-2 text-center min-w-[120px] uppercase tracking-wider font-semibold">
        {label}
      </div>
      {renderValue(valueB, aWins === false, false)}
    </div>
  );
}

// ── CompBar Component (Movido afuera para cumplir las reglas de React) ──
function CompBar({ label, icon: Icon, valA, valB, max, formatFn, explanation }: any) {
  const pctA = Math.min((valA / max) * 100, 100);
  const pctB = Math.min((valB / max) * 100, 100);
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sk-xs font-mono text-sk-text-3">{formatFn(valA)}</span>
        <div className="flex items-center gap-1.5 text-sk-sm font-bold text-sk-text-1">
          <Icon size={14} className="text-sk-accent" /> {label}
        </div>
        <span className="text-sk-xs font-mono text-sk-text-3">{formatFn(valB)}</span>
      </div>
      <div className="flex h-2 bg-sk-bg-4 rounded-full overflow-hidden mb-2">
        <div className="h-full bg-sk-accent transition-all" style={{ width: `${pctA}%` }} />
        <div className="h-full bg-transparent flex-1" />
        <div className="h-full bg-sk-purple transition-all" style={{ width: `${pctB}%` }} />
      </div>
      <p className="text-center text-[10px] text-sk-text-3">{explanation}</p>
    </div>
  );
}

// ── Visual ELO Breakdown ──
function EloVisualBreakdown({ playerA, playerB }: { playerA: PlayerWithRoom, playerB: PlayerWithRoom }) {
  const winRateA = (playerA.total_wins / Math.max(playerA.total_tournaments, 1)) * 100;
  const winRateB = (playerB.total_wins / Math.max(playerB.total_tournaments, 1)) * 100;
  const aWinsElo = playerA.elo_rating >= playerB.elo_rating;

  return (
    <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6">
      <div className="text-center mb-6">
        <h3 className="text-sk-md font-extrabold text-sk-text-1 mb-1">Análisis ELO</h3>
        <p className="text-sk-xs text-sk-text-2">Por qué {aWinsElo ? playerA.nickname : playerB.nickname} tiene ventaja en el algoritmo</p>
      </div>

      <CompBar
        label="Techo de Habilidad" icon={TrendingUp}
        valA={playerA.elo_peak} valB={playerB.elo_peak} max={2500}
        formatFn={formatElo}
        explanation="El ELO Peak demuestra la capacidad máxima demostrada contra fields duros (Factor Expectativa)."
      />
      <CompBar
        label="Tasa de Victorias (Score 1.0)" icon={Target}
        valA={winRateA} valB={winRateB} max={100}
        formatFn={(v: number) => formatPercent(v / 100)}
        explanation="Ganar torneos otorga el score normalizado perfecto (1.0). Quien gana más seguido, escala más rápido."
      />
      <CompBar
        label="Volumen (Factor K)" icon={Zap}
        valA={playerA.total_tournaments} valB={playerB.total_tournaments} max={Math.max(playerA.total_tournaments, playerB.total_tournaments, 100)}
        formatFn={formatNumber}
        explanation={
          (playerA.total_tournaments < 30 || playerB.total_tournaments < 30) 
            ? "⚠️ Uno de los jugadores tiene menos de 30 torneos (Factor K=40). Su ELO es altamente volátil." 
            : "Ambos tienen más de 30 torneos (Factor K=20). Sus rangos están estabilizados."
        }
      />
    </div>
  );
}

// ── Dual ELO Chart ──
function DualEloChart({ historyA, historyB, nameA, nameB }: { historyA: EloHistory[], historyB: EloHistory[], nameA: string, nameB: string }) {
  if (historyA.length === 0 && historyB.length === 0) {
    return <div className="h-[280px] bg-sk-bg-2 border border-sk-border-2 rounded-lg flex items-center justify-center"><p className="text-sk-text-2 text-sk-sm">Sin historial disponible</p></div>;
  }
  const allDates = new Set<string>();
  const mapA = new Map<string, number>();
  const mapB = new Map<string, number>();
  for (const h of historyA) { const d = format(new Date(h.recorded_at), "dd/MM"); allDates.add(d); mapA.set(d, Math.round(h.elo_after)); }
  for (const h of historyB) { const d = format(new Date(h.recorded_at), "dd/MM"); allDates.add(d); mapB.set(d, Math.round(h.elo_after)); }
  const chartData = [...allDates].sort().map((date) => ({ date, [nameA]: mapA.get(date) ?? null, [nameB]: mapB.get(date) ?? null }));

  return (
    <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4">
      <h3 className="text-sk-sm font-bold text-sk-text-1 mb-4">📈 Evolución ELO Comparada</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} tickLine={false} />
          <YAxis tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={50} />
          <Tooltip contentStyle={{ background: "#18191c", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "8px", fontSize: "13px", fontFamily: "JetBrains Mono", color: "#fafafa" }} />
          <Legend />
          <Line type="monotone" dataKey={nameA} stroke="#22d3ee" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey={nameB} stroke="#a78bfa" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Page ──
export function ComparePage() {
  const { isAuthenticated } = useAuthStore();
  const { data: radarAccess } = useFeatureAccess("pass_radar");
  const hasRadarAccess = radarAccess?.has_access ?? false;

  const [searchParams, setSearchParams] = useSearchParams();
  const [idA, setIdA] = useState<string | null>(searchParams.get("a"));
  const [idB, setIdB] = useState<string | null>(searchParams.get("b"));

  const { data: playerA, isLoading: loadingA } = usePlayer(idA ?? undefined);
  const { data: playerB, isLoading: loadingB } = usePlayer(idB ?? undefined);
  const { data: historyA } = usePlayerEloHistory(idA ?? undefined);
  const { data: historyB } = usePlayerEloHistory(idB ?? undefined);

  useEffect(() => {
    const params = new URLSearchParams();
    if (idA) params.set("a", idA);
    if (idB) params.set("b", idB);
    setSearchParams(params, { replace: true });
  }, [idA, idB, setSearchParams]);

  if (!isAuthenticated) {
    return (
      <PageShell>
        <SEOHead title="Comparador de Jugadores" description="Compara estadísticas de dos jugadores de poker: ELO, ITM%, ROI, torneos jugados y evolución histórica." path="/compare" />
        <div className="pt-32 pb-16 min-h-[80vh] flex items-center justify-center px-6">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-10 text-center max-w-md w-full shadow-sk-lg">
            <ShieldAlert size={48} className="mx-auto mb-4 text-sk-accent" />
            <h2 className="text-sk-xl font-extrabold text-sk-text-1 mb-3">Herramienta Exclusiva</h2>
            <p className="text-sk-sm text-sk-text-2 mb-6">El comparador Head-to-Head es una herramienta gratuita reservada para usuarios registrados. Crea tu cuenta para enfrentar a cualquier jugador de la base de datos.</p>
            <div className="flex gap-3 justify-center">
              <Link to="/register"><Button variant="accent">Crear cuenta gratis</Button></Link>
              <Link to="/login"><Button variant="secondary">Iniciar Sesión</Button></Link>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  const bothSelected = playerA && playerB;

  const compareData = bothSelected
    ? (() => {
        const itmA = calcItm(playerA.total_cashes, playerA.total_tournaments);
        const itmB = calcItm(playerB.total_cashes, playerB.total_tournaments);
        const roiA = calcRoi(playerA.total_prize_won, playerA.total_buy_ins_spent);
        const roiB = calcRoi(playerB.total_prize_won, playerB.total_buy_ins_spent);
        const profitA = playerA.total_prize_won - playerA.total_buy_ins_spent;
        const profitB = playerB.total_prize_won - playerB.total_buy_ins_spent;

        return [
          { label: "ELO Rating", a: formatElo(playerA.elo_rating), b: formatElo(playerB.elo_rating), aWins: playerA.elo_rating > playerB.elo_rating, premium: false },
          { label: "ELO Peak", a: formatElo(playerA.elo_peak), b: formatElo(playerB.elo_peak), aWins: playerA.elo_peak > playerB.elo_peak, premium: false },
          { label: "Torneos", a: formatNumber(playerA.total_tournaments), b: formatNumber(playerB.total_tournaments), aWins: playerA.total_tournaments > playerB.total_tournaments, premium: false },
          { label: "Victorias", a: formatNumber(playerA.total_wins), b: formatNumber(playerB.total_wins), aWins: playerA.total_wins > playerB.total_wins, premium: false },
          { label: "Cashes", a: formatNumber(playerA.total_cashes), b: formatNumber(playerB.total_cashes), aWins: playerA.total_cashes > playerB.total_cashes, premium: true },
          { label: "ITM %", a: formatPercent(itmA), b: formatPercent(itmB), aWins: itmA > itmB, premium: true },
          { label: "ROI", a: `${roiA >= 0 ? "+" : ""}${formatPercent(roiA)}`, b: `${roiB >= 0 ? "+" : ""}${formatPercent(roiB)}`, aWins: roiA > roiB, premium: true },
          { label: "Profit", a: formatCurrency(profitA), b: formatCurrency(profitB), aWins: profitA > profitB, premium: true },
        ];
      })()
    : [];

  return (
    <PageShell>
      <SEOHead title="Comparador de Jugadores" path="/compare" />
      <div className="pt-20 pb-16">
        <div className="max-w-[900px] mx-auto px-6">
          <div className="mb-8 text-center">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">Head to Head</p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-2">⚔️ Comparar Jugadores</h1>
            <p className="text-sk-base text-sk-text-2">Enfrenta a dos rivales y descubre quién domina la mesa.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <PlayerSelector label="Jugador A (Azul)" selectedId={idA} onSelect={setIdA} />
            <PlayerSelector label="Jugador B (Morado)" selectedId={idB} onSelect={setIdB} />
          </div>

          {(loadingA || loadingB) && (idA || idB) && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

          {bothSelected && (
            <div className="space-y-6">
              
              {/* Bloque Gráfico Explicativo ELO */}
              <EloVisualBreakdown playerA={playerA} playerB={playerB} />

              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6">
                <div className="grid grid-cols-[1fr_60px_1fr] gap-4 items-center">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-accent overflow-hidden flex items-center justify-center mx-auto mb-3">
                      {playerA.profiles?.avatar_url ? <img src={playerA.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sk-xl font-extrabold text-sk-accent">{playerA.nickname.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="font-bold text-sk-text-1 text-sk-md"><FlagIcon countryCode={playerA.country_code} /> {playerA.nickname}</div>
                  </div>
                  <div className="text-center"><div className="text-sk-2xl font-black text-sk-text-3 tracking-tight">VS</div></div>
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-purple overflow-hidden flex items-center justify-center mx-auto mb-3">
                      {playerB.profiles?.avatar_url ? <img src={playerB.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sk-xl font-extrabold text-sk-purple">{playerB.nickname.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="font-bold text-sk-text-1 text-sk-md"><FlagIcon countryCode={playerB.country_code} /> {playerB.nickname}</div>
                  </div>
                </div>

                <div className="w-full h-px my-6 bg-gradient-to-r from-transparent via-sk-border-3 to-transparent" />

                <div>
                  {compareData.map((row) => (
                    <CompareRow key={row.label} label={row.label} valueA={row.a} valueB={row.b} aWins={row.aWins} isPremium={row.premium} hasAccess={hasRadarAccess} />
                  ))}
                </div>
                
                {!hasRadarAccess && (
                  <div className="mt-6 text-center bg-sk-bg-3 border border-sk-border-2 rounded-lg p-4">
                    <p className="text-[11px] text-sk-text-3 mb-2 uppercase tracking-widest font-semibold">🔒 Métricas Protegidas</p>
                    <p className="text-sk-sm text-sk-text-1 mb-3">Consigue el <strong>Pase Radar</strong> en la tienda para revelar el ROI y Profit de cualquier enfrentamiento.</p>
                  </div>
                )}
              </div>

              <DualEloChart historyA={historyA ?? []} historyB={historyB ?? []} nameA={playerA.nickname} nameB={playerB.nickname} />
            </div>
          )}

          {!bothSelected && !loadingA && !loadingB && (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-12 text-center">
              <span className="text-5xl mb-4 block">⚖️</span>
              <p className="text-sk-text-2 text-sk-md">Selecciona dos jugadores arriba para enfrentar sus estadísticas.</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}