import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Badge } from "../ui/badge";
import { FlagIcon } from "../ui/flag-icon";
import { formatCurrency } from "../../lib/format";
import { Info, BarChart3, ArrowUpRight } from "lucide-react";
import type { TournamentWithDetails } from "../../types";

interface TournamentCardProps {
  tournament: TournamentWithDetails;
  onInfoClick?: () => void;
}

function cleanName(name: string) {
  return name.replace(/^\[DEMO\]\s*/, "").replace(/⚠️ DATOS DEMO.*$/, "").trim();
}

function useCountdown(targetDate: string, running: boolean) {
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.floor((new Date(targetDate).getTime() - Date.now()) / 1000)));

  useEffect(() => {
    if (!running) return;
    const tick = () => setSeconds(Math.max(0, Math.floor((new Date(targetDate).getTime() - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetDate, running]);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    timeStr: hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}` : `${pad(minutes)}:${pad(remainingSeconds)}`,
    isExpired: seconds <= 0,
  };
}

export function TournamentCard({ tournament: t, onInfoClick }: TournamentCardProps) {
  const countdownEnabled = t.status === "scheduled" || t.status === "late_registration";
  const { timeStr, isExpired } = useCountdown(
    t.status === "late_registration" && t.late_reg_end ? t.late_reg_end : t.start_datetime,
    countdownEnabled
  );

  const isLive = t.status === "live";
  const isLateReg = t.status === "late_registration" && !isExpired;
  const isCompleted = t.status === "completed" || (t.status === "late_registration" && isExpired);
  const isCancelled = t.status === "cancelled";
  const isUpcoming = t.status === "scheduled" && !isExpired;
  const isDemo = (t as { is_demo?: boolean }).is_demo;

  const statusBadge = isLive ? (
    <Badge variant="live">EN VIVO</Badge>
  ) : isLateReg ? (
    <span className="arena-tournament-status font-mono font-semibold bg-sk-orange-dim text-sk-orange">⏳ LATE REG: {timeStr}</span>
  ) : isCompleted ? (
    <div className="flex items-center gap-2">
      {t.results_uploaded && <Badge variant="green" className="gap-1 px-1.5 py-0.5"><BarChart3 size={12} /> RESULTADOS</Badge>}
      <Badge variant="muted">FINALIZADO</Badge>
    </div>
  ) : isCancelled ? (
    <Badge variant="red">Cancelado</Badge>
  ) : isUpcoming ? (
    <span className="arena-tournament-status font-mono font-semibold bg-sk-accent-dim text-sk-accent">⏱ {timeStr}</span>
  ) : (
    <Badge variant="muted">FINALIZADO</Badge>
  );

  const startDate = new Date(t.start_datetime);
  const dateLabel = startDate.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", timeZone: t.timezone });
  const timeZoneLabel = startDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: t.timezone });
  const participationLink = ["ccp", "latin-allin-poker"].includes(t.clubs?.slug || "")
    ? "/como-jugar-en-clubgg"
    : `/clubs/${t.clubs?.slug ?? t.club_id}`;

  return (
    <article
      className={cn(
        "arena-tournament-card bg-sk-bg-3 border border-sk-border-2 rounded-md p-3 px-4 transition-all",
        (isLive || isLateReg) && "arena-tournament-card--live border-l-2 border-l-sk-green",
        isCompleted && "arena-tournament-card--completed"
      )}
      aria-labelledby={`arena-event-title-${t.id}`}
    >
      <div className="arena-tournament-card-header flex justify-between items-center">
        <div className="arena-tournament-card-title-wrap flex items-center gap-2 min-w-0">
          <Link
            to={`/tournament/${t.slug || t.id}`}
            id={`arena-event-title-${t.id}`}
            className="arena-tournament-card-title font-semibold text-sk-text-1 text-sk-sm"
          >
            {cleanName(t.name)}
          </Link>
          {onInfoClick && (
            <button
              type="button"
              onClick={onInfoClick}
              className="arena-tournament-info-button bg-white/[0.04] text-sk-text-3 hover:bg-sk-accent-dim hover:text-sk-accent flex items-center justify-center transition-colors shrink-0"
              aria-label={`Ver información de ${cleanName(t.name)}`}
              title="Información del torneo"
            >
              <Info size={15} aria-hidden="true" />
            </button>
          )}
          {isDemo && <span className="arena-tournament-demo font-bold text-sk-gold bg-sk-gold-dim">Demo</span>}
        </div>
        <div className="arena-tournament-badges flex items-center gap-2 shrink-0">{statusBadge}</div>
      </div>

      <div className="arena-tournament-card-details flex justify-between items-center">
        <div className="arena-tournament-financials flex gap-4 text-[11px] text-sk-text-2">
          <span>
            Buy-in:{" "}
            <strong className={cn("font-mono", t.buy_in === 0 ? "text-sk-green" : "text-sk-text-1")}>
              {t.buy_in === 0 ? "FREE" : <>{formatCurrency(t.buy_in)} <small>{t.currency || "USD"}</small></>}
            </strong>
          </span>
          {!!t.guaranteed_prize && (
            <span>
              GTD:{" "}
              <strong className="font-mono text-sk-gold">
                {formatCurrency(t.guaranteed_prize)} <small>{t.currency || "USD"}</small>
              </strong>
            </span>
          )}
        </div>
        <span className="arena-tournament-date font-mono text-[11px] text-sk-text-1 flex items-center gap-1.5">
          {dateLabel} · {timeZoneLabel}
          <FlagIcon countryCode={t.clubs?.country_code ?? null} />
        </span>
      </div>

      <div className="arena-tournament-card-links flex justify-between items-start">
        {t.custom_link ? (
          <a href={t.custom_link} target="_blank" rel="noopener noreferrer" className="arena-tournament-participation group flex flex-col gap-1">
            <span className="text-sk-accent text-xs font-semibold">🌐 {t.poker_rooms?.name}</span>
            <span className="arena-tournament-participation-hint"><ArrowUpRight size={14} aria-hidden="true" /> Consultar cómo participar en el torneo</span>
          </a>
        ) : (
          <Link to={participationLink} className="arena-tournament-participation group flex flex-col gap-1">
            <span className="text-sk-accent text-xs font-semibold flex items-center gap-1.5">
              <FlagIcon countryCode={t.clubs?.country_code ?? null} /> {cleanName(t.clubs?.name ?? "")}
            </span>
            <span className="arena-tournament-participation-hint"><ArrowUpRight size={14} aria-hidden="true" /> Consultar cómo participar en el torneo</span>
          </Link>
        )}
        {t.leagues ? (
          <Link to={`/leagues/${t.leagues.slug ?? t.league_id}`} className="arena-tournament-league text-xs text-sk-text-2 hover:text-sk-accent transition-colors">
            Liga: {cleanName(t.leagues.name)}
          </Link>
        ) : t.actual_prize_pool ? (
          <span className="arena-tournament-league text-xs text-sk-text-2">
            Premio: {formatCurrency(t.actual_prize_pool)} {t.currency || "USD"}
          </span>
        ) : null}
      </div>
    </article>
  );
}
