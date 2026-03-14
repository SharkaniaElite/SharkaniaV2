// src/pages/compare.tsx
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { EloChart } from "../components/players/elo-chart";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import {
  usePlayer,
  usePlayerEloHistory,
  useSearchPlayers,
} from "../hooks/use-players";
import { getFlag } from "../lib/countries";
import {
  formatElo,
  formatNumber,
  formatPercent,
  formatCurrency,
  calcItm,
  calcRoi,
} from "../lib/format";
import { cn } from "../lib/cn";
import { Search, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";
import type { PlayerWithRoom, EloHistory } from "../types";

// ── Player Selector with autocomplete ──

function PlayerSelector({
  label,
  selectedId,
  onSelect,
  color,
}: {
  label: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  color: string;
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
                "w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors text-sk-sm",
                p.id === selectedId && "bg-white/[0.04]"
              )}
            >
              <span>{getFlag(p.country_code)}</span>
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
}: {
  label: string;
  valueA: string;
  valueB: string;
  aWins: boolean | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-2.5 border-b border-sk-border-2 last:border-b-0">
      <div
        className={cn(
          "text-right font-mono font-bold text-sk-sm",
          aWins === true ? "text-sk-green" : "text-sk-text-1"
        )}
      >
        {valueA}
      </div>
      <div className="text-[11px] text-sk-text-2 text-center min-w-[120px]">
        {label}
      </div>
      <div
        className={cn(
          "font-mono font-bold text-sk-sm",
          aWins === false ? "text-sk-green" : "text-sk-text-1"
        )}
      >
        {valueB}
      </div>
    </div>
  );
}

// ── Dual ELO Chart ──

function DualEloChart({
  historyA,
  historyB,
  nameA,
  nameB,
}: {
  historyA: EloHistory[];
  historyB: EloHistory[];
  nameA: string;
  nameB: string;
}) {
  if (historyA.length === 0 && historyB.length === 0) {
    return (
      <div className="h-[280px] bg-sk-bg-2 border border-sk-border-2 rounded-lg flex items-center justify-center">
        <p className="text-sk-text-2 text-sk-sm">Sin historial de ELO disponible</p>
      </div>
    );
  }

  // Merge both histories by date
  const allDates = new Set<string>();
  const mapA = new Map<string, number>();
  const mapB = new Map<string, number>();

  for (const h of historyA) {
    const d = format(new Date(h.recorded_at), "dd/MM");
    allDates.add(d);
    mapA.set(d, Math.round(h.elo_after));
  }
  for (const h of historyB) {
    const d = format(new Date(h.recorded_at), "dd/MM");
    allDates.add(d);
    mapB.set(d, Math.round(h.elo_after));
  }

  const chartData = [...allDates].sort().map((date) => ({
    date,
    [nameA]: mapA.get(date) ?? null,
    [nameB]: mapB.get(date) ?? null,
  }));

  return (
    <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4">
      <h3 className="text-sk-sm font-bold text-sk-text-1 mb-4">📈 Evolución ELO Comparada</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: "#18191c",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "JetBrains Mono",
              color: "#fafafa",
            }}
          />
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [idA, setIdA] = useState<string | null>(searchParams.get("a"));
  const [idB, setIdB] = useState<string | null>(searchParams.get("b"));

  const { data: playerA, isLoading: loadingA } = usePlayer(idA ?? undefined);
  const { data: playerB, isLoading: loadingB } = usePlayer(idB ?? undefined);
  const { data: historyA } = usePlayerEloHistory(idA ?? undefined);
  const { data: historyB } = usePlayerEloHistory(idB ?? undefined);

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (idA) params.set("a", idA);
    if (idB) params.set("b", idB);
    setSearchParams(params, { replace: true });
  }, [idA, idB, setSearchParams]);

  const bothSelected = playerA && playerB;

  const compareData = bothSelected
    ? (() => {
        const itmA = calcItm(playerA.total_cashes, playerA.total_tournaments);
        const itmB = calcItm(playerB.total_cashes, playerB.total_tournaments);
        const roiA = calcRoi(playerA.total_prize_won, playerA.total_buy_ins_spent);
        const roiB = calcRoi(playerB.total_prize_won, playerB.total_buy_ins_spent);

        return [
          { label: "ELO Rating", a: formatElo(playerA.elo_rating), b: formatElo(playerB.elo_rating), aWins: playerA.elo_rating > playerB.elo_rating },
          { label: "ELO Peak", a: formatElo(playerA.elo_peak), b: formatElo(playerB.elo_peak), aWins: playerA.elo_peak > playerB.elo_peak },
          { label: "Torneos", a: formatNumber(playerA.total_tournaments), b: formatNumber(playerB.total_tournaments), aWins: playerA.total_tournaments > playerB.total_tournaments },
          { label: "Cashes", a: formatNumber(playerA.total_cashes), b: formatNumber(playerB.total_cashes), aWins: playerA.total_cashes > playerB.total_cashes },
          { label: "ITM %", a: formatPercent(itmA), b: formatPercent(itmB), aWins: itmA > itmB },
          { label: "ROI", a: `${roiA >= 0 ? "+" : ""}${formatPercent(roiA)}`, b: `${roiB >= 0 ? "+" : ""}${formatPercent(roiB)}`, aWins: roiA > roiB },
          { label: "Victorias", a: formatNumber(playerA.total_wins), b: formatNumber(playerB.total_wins), aWins: playerA.total_wins > playerB.total_wins },
          { label: "Profit", a: formatCurrency(playerA.total_prize_won - playerA.total_buy_ins_spent), b: formatCurrency(playerB.total_prize_won - playerB.total_buy_ins_spent), aWins: (playerA.total_prize_won - playerA.total_buy_ins_spent) > (playerB.total_prize_won - playerB.total_buy_ins_spent) },
        ];
      })()
    : [];

  return (
    <PageShell>
      <div className="pt-20 pb-16">
        <div className="max-w-[900px] mx-auto px-6">
          {/* Header */}
          <div className="mb-8 text-center">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">
              Head to Head
            </p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-2">
              ⚔️ Comparar Jugadores
            </h1>
            <p className="text-sk-base text-sk-text-2">
              Selecciona dos jugadores para comparar sus estadísticas
            </p>
          </div>

          {/* Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <PlayerSelector
              label="Jugador A"
              selectedId={idA}
              onSelect={setIdA}
              color="accent"
            />
            <PlayerSelector
              label="Jugador B"
              selectedId={idB}
              onSelect={setIdB}
              color="purple"
            />
          </div>

          {/* Loading */}
          {(loadingA || loadingB) && (idA || idB) && (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {/* Comparison */}
          {bothSelected && (
            <div className="space-y-6">
              {/* VS Header */}
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6">
                <div className="grid grid-cols-[1fr_60px_1fr] gap-4 items-center">
                  {/* Player A */}
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-accent flex items-center justify-center text-sk-xl font-extrabold text-sk-accent mx-auto mb-3">
                      {playerA.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-bold text-sk-text-1 text-sk-md">
                      {getFlag(playerA.country_code)} {playerA.nickname}
                    </div>
                    <div className="font-mono text-sk-accent font-bold text-sk-lg mt-2">
                      {formatElo(playerA.elo_rating)}
                    </div>
                    <div className="text-[11px] text-sk-text-2">ELO Rating</div>
                  </div>

                  {/* VS */}
                  <div className="text-center">
                    <div className="text-sk-2xl font-black text-sk-text-3 tracking-tight">
                      VS
                    </div>
                  </div>

                  {/* Player B */}
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-purple flex items-center justify-center text-sk-xl font-extrabold text-sk-purple mx-auto mb-3">
                      {playerB.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-bold text-sk-text-1 text-sk-md">
                      {getFlag(playerB.country_code)} {playerB.nickname}
                    </div>
                    <div className="font-mono text-sk-purple font-bold text-sk-lg mt-2">
                      {formatElo(playerB.elo_rating)}
                    </div>
                    <div className="text-[11px] text-sk-text-2">ELO Rating</div>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px my-6 bg-gradient-to-r from-transparent via-sk-accent-dim to-transparent" />

                {/* Stats rows */}
                <div>
                  {compareData.map((row) => (
                    <CompareRow
                      key={row.label}
                      label={row.label}
                      valueA={row.a}
                      valueB={row.b}
                      aWins={row.aWins}
                    />
                  ))}
                </div>
              </div>

              {/* Dual ELO Chart */}
              <DualEloChart
                historyA={historyA ?? []}
                historyB={historyB ?? []}
                nameA={playerA.nickname}
                nameB={playerB.nickname}
              />
            </div>
          )}

          {/* Empty state when nothing selected */}
          {!bothSelected && !loadingA && !loadingB && (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-12 text-center">
              <span className="text-5xl mb-4 block">⚔️</span>
              <p className="text-sk-text-2 text-sk-md">
                Selecciona dos jugadores arriba para ver la comparación
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
