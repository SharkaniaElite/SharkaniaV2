// src/components/calendar/tournament-card.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Badge } from "../ui/badge";
import { FlagIcon } from "../ui/flag-icon";
import { formatCurrency } from "../../lib/format";
import { Info } from "lucide-react";
import type { TournamentWithDetails } from "../../types";

interface TournamentCardProps {
  tournament: TournamentWithDetails;
  onInfoClick?: () => void;
}

function cleanName(s: string) {
  return s.replace(/^\[DEMO\]\s*/, "").replace(/⚠️ DATOS DEMO.*$/, "").trim();
}

function useCountdown(targetDate: string) {
  const [diff, setDiff] = useState(() => {
    const target = new Date(targetDate).getTime();
    return Math.max(0, Math.floor((target - Date.now()) / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const target = new Date(targetDate).getTime();
      const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setDiff(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;

  return { diff, timeStr };
}

export function TournamentCard({ tournament: t, onInfoClick }: TournamentCardProps) {
  const { diff, timeStr } = useCountdown(t.start_datetime);

  const isLive = t.status === "live";
  const isLateReg = t.status === "late_registration";
  const isCompleted = t.status === "completed";
  const isCancelled = t.status === "cancelled";
  const isUpcoming = t.status === "scheduled" && diff > 0;
  const isDemo = (t as any).is_demo;

  const statusBadge = isLive ? (
    <Badge variant="live">EN VIVO</Badge>
  ) : isLateReg ? (
    <span className="font-mono text-[11px] font-semibold py-[3px] px-2 rounded-xs bg-sk-orange-dim text-sk-orange inline-flex items-center gap-1">
      ⏳ Late reg: {timeStr}
    </span>
  ) : isCompleted ? (
    <Badge variant="muted">Completado</Badge>
  ) : isCancelled ? (
    <Badge variant="red">Cancelado</Badge>
  ) : isUpcoming ? (
    <span className="font-mono text-[11px] font-semibold py-[3px] px-2 rounded-xs bg-sk-accent-dim text-sk-accent inline-flex items-center gap-1">
      ⏱ {timeStr}
    </span>
  ) : null;

  const startDate = new Date(t.start_datetime);

  // Fecha formateada: dd/MM
  const dateLabel = startDate.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: t.timezone,
  });

  // Hora formateada en timezone del club
  const timeZoneLabel = startDate.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: t.timezone,
  });

  return (
    <div
      className={cn(
        "bg-sk-bg-3 border border-sk-border-2 rounded-md p-3 px-4 transition-colors hover:border-sk-border-3",
        (isLive || isLateReg) && "border-l-2 border-l-sk-green"
      )}
    >
      {/* Row 1: Name + Status */}
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sk-text-1 text-sk-sm truncate">{cleanName(t.name)}</span>
          {onInfoClick && (
            <button
              onClick={onInfoClick}
              className="w-[18px] h-[18px] rounded-full bg-white/[0.04] text-sk-text-3 hover:bg-sk-accent-dim hover:text-sk-accent text-[11px] flex items-center justify-center transition-colors shrink-0"
              aria-label="Ver detalles del torneo"
            >
              <Info size={11} />
            </button>
          )}
          {isDemo && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sk-gold-dim text-sk-gold uppercase tracking-wider shrink-0">
              ⚠ Demo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge}
        </div>
      </div>

      {/* Row 2: Buy-in, GTD, Date + Time */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4 text-[11px] text-sk-text-2">
          <span>
            Buy-in:{" "}
            <span className={cn("font-mono font-semibold", t.buy_in === 0 ? "text-sk-green" : "text-sk-text-1")}>
              {t.buy_in === 0 ? "FREE" : formatCurrency(t.buy_in)}
            </span>
          </span>
          {t.guaranteed_prize && (
            <span>
              GTD:{" "}
              <span className="font-mono font-bold text-sk-gold">
                {formatCurrency(t.guaranteed_prize)}
              </span>
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-sk-text-1 flex items-center gap-1.5">
          {dateLabel} · {timeZoneLabel} <FlagIcon countryCode={t.clubs?.country_code ?? null} />
        </span>
      </div>

      {/* Row 3: Club + League */}
      <div className="mt-1 flex justify-between items-center">
        <Link
          to={`/clubs/${t.club_id}`}
          className="text-[11px] text-sk-accent font-medium hover:opacity-80 transition-opacity flex items-center gap-1"
        >
          <FlagIcon countryCode={t.clubs?.country_code ?? null} /> {cleanName(t.clubs?.name ?? "")}
        </Link>
        {t.leagues ? (
          <Link
            to={`/leagues/${t.league_id}`}
            className="text-[10px] text-sk-text-2 font-mono hover:text-sk-accent transition-colors"
          >
            Liga: {cleanName(t.leagues.name)}
          </Link>
        ) : t.actual_prize_pool ? (
          <span className="text-[10px] text-sk-text-2 font-mono">
            Prize: {formatCurrency(t.actual_prize_pool)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
