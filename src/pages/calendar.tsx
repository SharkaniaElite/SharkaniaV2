// src/pages/calendar.tsx
import { useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { TournamentCard } from "../components/calendar/tournament-card";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { Spinner } from "../components/ui/spinner";
import { EmptyState } from "../components/ui/empty-state";
import { useAllTournaments } from "../hooks/use-tournaments";
import { usePokerRooms } from "../hooks/use-clubs";
import type { TournamentWithDetails } from "../types";

export function CalendarPage() {
  const { data: tournaments, isLoading } = useAllTournaments();
  const { data: rooms } = usePokerRooms();
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");

  const filtered = (tournaments ?? []).filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (roomFilter && t.room_id !== roomFilter) return false;
    return true;
  });

  // Sort: live/late_reg first, then scheduled by date, then completed
  const sorted = [...filtered].sort((a, b) => {
    const order = { live: 0, late_registration: 1, scheduled: 2, completed: 3, cancelled: 4 };
    const aOrder = order[a.status] ?? 5;
    const bOrder = order[b.status] ?? 5;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
  });

  return (
    <PageShell>
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">
              Calendario de Torneos
            </p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-2">
              📅 Todos los Torneos
            </h1>
            <p className="text-sk-base text-sk-text-2">
              {filtered.length} torneos · Countdown en vivo
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-sk-bg-2 border border-sk-border-2 rounded-md px-3 py-2.5 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent"
            >
              <option value="">Todos los estados</option>
              <option value="live">EN VIVO</option>
              <option value="late_registration">Late Registration</option>
              <option value="scheduled">Programados</option>
              <option value="completed">Completados</option>
            </select>
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="bg-sk-bg-2 border border-sk-border-2 rounded-md px-3 py-2.5 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent"
            >
              <option value="">Todas las salas</option>
              {rooms?.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Tournament list */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No hay torneos"
              description="No se encontraron torneos con los filtros seleccionados."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((t) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  onInfoClick={() => setSelectedTournament(t)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <TournamentDetailModal
        tournament={selectedTournament}
        isOpen={!!selectedTournament}
        onClose={() => setSelectedTournament(null)}
      />
    </PageShell>
  );
}
