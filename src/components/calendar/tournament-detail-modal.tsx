// src/components/calendar/tournament-detail-modal.tsx
import { Modal } from "../ui/modal";
import { Badge } from "../ui/badge";
import { Chip } from "../ui/chip";
import { FlagIcon } from "../ui/flag-icon";
import { formatCurrency } from "../../lib/format";
import type { TournamentWithDetails } from "../../types";
import { format } from "date-fns";

interface TournamentDetailModalProps {
  tournament: TournamentWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

// 🧠 Motor Lógico VIP: Para los torneos, solo alternamos entre El Analista (2) y El Calculador (9)
const getTournamentShark = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash % 2 === 0 ? 2 : 9;
};

export function TournamentDetailModal({
  tournament: t,
  isOpen,
  onClose,
}: TournamentDetailModalProps) {
  if (!t) return null;

  const statusMap = {
    scheduled: { label: "Programado", variant: "accent" as const },
    live: { label: "EN VIVO", variant: "live" as const },
    late_registration: { label: "Late Registration", variant: "orange" as const },
    completed: { label: "Completado", variant: "muted" as const },
    cancelled: { label: "Cancelado", variant: "red" as const },
  };

  const status = statusMap[t.status];
  const sharkId = getTournamentShark(t.name);
  const sharkImage = `/mascot/shark-${sharkId}.webp`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.name}>
      <div className="relative space-y-4 pt-2">
        {/* 🦈 Sharky "Coronando" el Modal en la esquina superior derecha */}
        <div className="absolute -top-16 sm:-top-20 right-0 sm:right-2 w-24 h-28 sm:w-28 sm:h-32 z-10 pointer-events-none drop-shadow-[0_0_15px_rgba(34,211,238,0.25)]">
          <img
            src={sharkImage}
            alt="Sharky Data Analyst"
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* Status + Type (con padding derecho para no chocar con Sharky) */}
        <div className="flex items-center gap-2 flex-wrap pr-20 sm:pr-24 relative z-20">
          <Badge variant={status.variant}>{status.label}</Badge>
          <Chip>{t.game_type}</Chip>
          <Chip>{t.tournament_type}</Chip>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 relative z-20">
          <DetailItem label="Buy-in" value={t.buy_in === 0 ? "FREE" : formatCurrency(t.buy_in)} highlight={t.buy_in === 0} />
          <DetailItem label="Garantizado" value={t.guaranteed_prize ? formatCurrency(t.guaranteed_prize) : "—"} gold />
          <DetailItem label="Prize Pool" value={t.actual_prize_pool ? formatCurrency(t.actual_prize_pool) : "Por definir"} />
          <DetailItem label="Late Reg" value={t.late_registration_minutes ? `${t.late_registration_minutes} min` : "—"} />
          <DetailItem label="Max Jugadores" value={t.max_players ? String(t.max_players) : "Ilimitado"} />
          <DetailItem label="Moneda" value={t.currency} />
        </div>

        {/* Date & Time */}
        <div className="bg-sk-bg-3 rounded-md p-3 relative z-20">
          <p className="font-mono text-[11px] font-semibold text-sk-text-2 uppercase tracking-wide mb-1">
            Fecha y Hora
          </p>
          <p className="font-mono text-sk-sm font-bold text-sk-text-1">
            {format(new Date(t.start_datetime), "dd/MM/yyyy HH:mm")}
          </p>
          <p className="text-[11px] text-sk-text-2 mt-1">
            Zona horaria: {t.timezone}
          </p>
        </div>

        {/* 📝 Description (Añadido) */}
        {t.description && (
          <div className="bg-sk-bg-3 rounded-md p-3 relative z-20">
            <p className="font-mono text-[11px] font-semibold text-sk-text-2 uppercase tracking-wide mb-1">
              Descripción
            </p>
            <p className="text-sk-sm text-sk-text-1 whitespace-pre-wrap leading-relaxed">
              {t.description}
            </p>
          </div>
        )}

        {/* Club & League */}
        <div className="bg-sk-bg-3 rounded-md p-3 relative z-20">
          <p className="font-mono text-[11px] font-semibold text-sk-text-2 uppercase tracking-wide mb-1">
            Club
          </p>
          <p className="text-sk-sm font-semibold text-sk-text-1">
            <FlagIcon countryCode={t.clubs?.country_code ?? null} /> {t.clubs?.name}
          </p>
          {t.leagues && (
            <>
              <p className="font-mono text-[11px] font-semibold text-sk-text-2 uppercase tracking-wide mb-1 mt-3">
                Liga
              </p>
              <p className="text-sk-sm font-semibold text-sk-accent">
                {t.leagues.name}
              </p>
            </>
          )}
        </div>

        {/* Room */}
        <div className="flex items-center gap-2 relative z-20">
          <span className="text-[11px] text-sk-text-2">Sala:</span>
          <Chip>{t.poker_rooms?.name}</Chip>
        </div>
      </div>
    </Modal>
  );
}

function DetailItem({
  label,
  value,
  highlight,
  gold,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  gold?: boolean;
}) {
  return (
    <div className="bg-sk-bg-3 border border-transparent hover:border-sk-border-3 transition-colors rounded-md p-3">
      <p className="font-mono text-[11px] font-semibold text-sk-text-2 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p
        className={`font-mono text-sk-sm font-bold ${
          highlight ? "text-sk-green" : gold ? "text-sk-gold" : "text-sk-text-1"
        }`}
      >
        {value}
      </p>
    </div>
  );
}