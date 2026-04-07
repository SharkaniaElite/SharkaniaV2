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
import { Search, Lock, Zap, Target, TrendingUp, Sparkles, Scale, Unlock, Clock } from "lucide-react";
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

// ── CompBar Component ──
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
  // 👇 Tiburón táctico aleatorio (1 al 10) que cambia en cada visita
  const [mascotId] = useState(() => Math.floor(Math.random() * 10) + 1);

  const { isAuthenticated } = useAuthStore();
  
  // 👇 Verificamos si tiene la suscripción mensual "Stats Espía"
  const { data: premiumAccess } = useFeatureAccess("stats_espia");
  const hasPremiumAccess = premiumAccess?.has_access ?? false;

  // 👇 1. Leemos el disco duro del navegador (localStorage) para ver si ya vino hoy
  const [hasUsedFreeDaily, setHasUsedFreeDaily] = useState(() => {
    return localStorage.getItem("sk_free_date") === new Date().toDateString();
  });

  // 👇 2. Recordamos a qué jugadores comparó, para dejarle ver SU consulta gratis sin cortarle la pantalla
  const [allowedPair, setAllowedPair] = useState(() => {
    return localStorage.getItem("sk_free_pair");
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [idA, setIdA] = useState<string | null>(searchParams.get("a"));
  const [idB, setIdB] = useState<string | null>(searchParams.get("b"));

  const currentPair = `${idA}-${idB}`;
  const isAllowedPair = allowedPair === currentPair || allowedPair === `${idB}-${idA}`;

  // 👇 3. Nueva Regla: Puede buscar si tiene premium, si no ha usado el gratis, O si está viendo el par que le salió gratis.
  const canSearch = hasPremiumAccess || !hasUsedFreeDaily || isAllowedPair;

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

  // 👇 4. QUEMAR EL CARTUCHO: Si elige a los dos y no es premium, registramos el uso diario
  useEffect(() => {
    if (idA && idB && !hasPremiumAccess) {
      const today = new Date().toDateString();
      if (localStorage.getItem("sk_free_date") !== today) {
        // 1. Guardamos en el disco duro (localStorage)
        localStorage.setItem("sk_free_date", today);
        localStorage.setItem("sk_free_pair", currentPair);
        
        // 2. Diferimos el estado al siguiente micro-ciclo para calmar a React y evitar el Cascading Render
        setTimeout(() => {
          setAllowedPair(currentPair);
          setHasUsedFreeDaily(true);
        }, 0);
      }
    }
  }, [idA, idB, hasPremiumAccess, currentPair]);

  // 🚨 VISTA 1: USUARIO NO REGISTRADO (El vendedor)
  if (!isAuthenticated) {
    return (
      <PageShell>
        <SEOHead title="Comparador de Jugadores" description="Compara estadísticas de dos jugadores de poker: ELO, ITM%, ROI, torneos jugados y evolución histórica." path="/compare" />
        <div className="pt-24 pb-16 min-h-[80vh] flex items-center justify-center px-6">
          <div className="max-w-[900px] w-full">
            {/* ══ BANNER DE INTELIGENCIA (NO REGISTRADOS) ══ */}
            <div className="bg-sk-bg-2 border border-sk-gold/20 rounded-2xl p-6 md:p-10 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group shadow-[0_0_30px_rgba(251,191,36,0.05)]">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-sk-gold/5 blur-[50px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-sk-gold/20 to-transparent" />

              <div className="shrink-0 relative z-10">
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 bg-sk-accent/10 blur-xl rounded-full scale-150 group-hover:bg-sk-gold/15 transition-colors duration-500" />
                  <img 
                    src={`/mascot/shark-${mascotId}.webp`} 
                    alt="Sharkania Tactical Analyst" 
                    className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              </div>

              <div className="flex-1 text-center md:text-left relative z-10">
                <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                  <Lock className="text-sk-gold" size={16} />
                  <p className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-sk-gold">
                    ACCESO RESTRINGIDO · NIVEL: LA BÓVEDA
                  </p>
                  <Sparkles className="text-sk-gold animate-pulse" size={16} />
                </div>

                <h1 className="text-sk-3xl md:text-sk-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-sk-text-1 to-sk-text-4 mb-4 leading-none">
                  Comparador de Élite
                </h1>

                <div className="space-y-3 max-w-2xl text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed mb-6">
                  <p>
                    <strong className="text-sk-text-1">"Disecciona a tu rival antes del primer showdown."</strong> Contrasta el ELO, volumen, victorias y métricas ocultas lado a lado.
                  </p>
                  <p className="text-sk-accent font-semibold">
                    Crea tu cuenta ahora y obtén 1 USO GRATUITO al día, además de <strong className="text-sk-gold">100 Shark Coins de regalo</strong> para desbloquear reportes completos.
                  </p>
                </div>

                <div className="flex gap-3 justify-center md:justify-start flex-wrap">
                  <Link to="/register">
                    <Button variant="accent" className="font-bold tracking-wide shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                      Reclamar mis 100 SC
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="secondary">Iniciar Sesión</Button>
                  </Link>
                </div>
              </div>
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

  // 🚨 VISTA 2: USUARIOS REGISTRADOS
  return (
    <PageShell>
      <SEOHead title="Comparador de Jugadores" path="/compare" />
      <div className="pt-20 pb-16">
        <div className="max-w-[900px] mx-auto px-6">
          
          <div className="mb-6 text-center">
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-2">Comparar Jugadores</h1>
            <p className="text-sk-base text-sk-text-2">Enfrenta a dos rivales y descubre quién domina la mesa.</p>
          </div>

          {/* 🧠 ESTADO DE ACCESO (Badges Tácticos) */}
          <div className="mb-8 flex justify-center">
            {hasPremiumAccess ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-sk-green/10 border border-sk-green/20 rounded-full text-sk-green text-sk-xs font-mono font-bold tracking-wide">
                <Unlock size={14} /> STATS ESPÍA: ACCESO ILIMITADO
              </div>
            ) : !hasUsedFreeDaily ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-sk-accent/10 border border-sk-accent/20 rounded-full text-sk-accent text-sk-xs font-mono font-bold tracking-wide">
                <Clock size={14} /> 1 USO GRATUITO DISPONIBLE HOY
              </div>
            ) : null}
          </div>

          {/* 🚨 PAYWALL: Si ya gastó su tiro y no tiene premium */}
          {!canSearch ? (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-10 text-center shadow-sk-lg">
              <Lock className="mx-auto mb-5 text-sk-text-4 opacity-50" size={56} strokeWidth={1.5} />
              <h3 className="text-sk-xl font-black text-sk-text-1 mb-3">Límite Diario Alcanzado</h3>
              <p className="text-sk-text-2 text-sk-sm max-w-md mx-auto mb-8 leading-relaxed">
                Has consumido tu consulta gratuita de hoy. Desbloquea <strong className="text-sk-text-1">Stats Espía</strong> en la tienda para obtener acceso ilimitado a este comparador y a las métricas ocultas.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/shop">
                  <Button variant="secondary" className="w-full sm:w-auto flex flex-col items-center py-6 px-8 border-sk-border-2 hover:border-sk-accent hover:bg-sk-accent/5 transition-all">
                    <span className="text-sk-sm font-bold text-sk-text-1 mb-1">Pase Diario</span>
                    <span className="font-mono text-sk-accent flex items-center gap-1.5"><Zap size={14}/> 15 SC</span>
                  </Button>
                </Link>
                <Link to="/shop">
                  <Button variant="accent" className="w-full sm:w-auto flex flex-col items-center py-6 px-8 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                    <span className="text-sk-sm font-bold mb-1">Mes Ilimitado (Stats Espía)</span>
                    <span className="font-mono flex items-center gap-1.5"><Sparkles size={14}/> 200 SC</span>
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            /* 👇 INTERFAZ DEL COMPARADOR (Si canSearch es true) */
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <PlayerSelector label="Jugador A (Azul)" selectedId={idA} onSelect={setIdA} />
                <PlayerSelector label="Jugador B (Morado)" selectedId={idB} onSelect={setIdB} />
              </div>

              {(loadingA || loadingB) && (idA || idB) && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

              {bothSelected && (
                <div className="space-y-6">
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
                      {/* Le pasamos true a hasAccess porque si llegó aquí, el paywall ya le dio permiso */}
                      {compareData.map((row) => (
                        <CompareRow key={row.label} label={row.label} valueA={row.a} valueB={row.b} aWins={row.aWins} isPremium={false} hasAccess={true} />
                      ))}
                    </div>
                  </div>

                  <DualEloChart historyA={historyA ?? []} historyB={historyB ?? []} nameA={playerA.nickname} nameB={playerB.nickname} />
                </div>
              )}

              {!bothSelected && !loadingA && !loadingB && (
                <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-16 flex flex-col items-center justify-center text-center shadow-inner">
                  <Scale className="text-sk-text-4 mb-5 opacity-40" size={56} strokeWidth={1.5} />
                  <h3 className="text-sk-lg font-bold text-sk-text-1 mb-2 tracking-tight">Esperando parámetros tácticos</h3>
                  <p className="text-sk-text-3 text-sk-sm max-w-md mx-auto">
                    Utiliza los selectores superiores para elegir dos perfiles de la matriz y comenzar la extracción de datos.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}