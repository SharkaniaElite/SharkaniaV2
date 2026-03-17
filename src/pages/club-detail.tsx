// src/pages/club-detail.tsx
import { useParams, Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { ClubHeader } from "../components/clubs/club-header";
import { TournamentCard } from "../components/calendar/tournament-card";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { useClub } from "../hooks/use-clubs";
import { useTournamentsByClub } from "../hooks/use-tournaments";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import type { TournamentWithDetails } from "../types";
import { useNavigate } from "react-router-dom";

export function ClubDetailPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { data: club, isLoading } = useClub(clubId);
  const { data: tournaments, isLoading: tournamentsLoading } = useTournamentsByClub(clubId);
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);
  

  if (isLoading) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (!club) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex flex-col items-center justify-center gap-4">
          <span className="text-5xl">🏛️</span>
          <h1 className="text-sk-2xl font-bold text-sk-text-1">Club no encontrado</h1>
          <Link to="/clubs">
            <Button variant="accent" size="md">
              <ArrowLeft size={16} /> Volver a clubes
            </Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const upcoming = (tournaments ?? []).filter((t) =>
    ["scheduled", "live", "late_registration"].includes(t.status)
  );
  const completed = (tournaments ?? []).filter((t) => t.status === "completed");

  return (
    <PageShell>
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <Link
            to="/clubs"
            className="inline-flex items-center gap-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> Volver a clubes
          </Link>

          <div className="mb-8">
            <ClubHeader club={club} />
          </div>

          {/* Upcoming tournaments */}
          <div className="mb-8">
            <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">
              📅 Torneos Próximos ({upcoming.length})
            </h2>
            {tournamentsLoading ? (
              <Spinner size="md" />
            ) : upcoming.length === 0 ? (
              <EmptyState icon="📅" title="Sin torneos próximos" />
            ) : (
              <div className="flex flex-col gap-2">
                {upcoming.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    onInfoClick={() => setSelectedTournament(t)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Completed tournaments */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">
                ✅ Torneos Completados ({completed.length})
              </h2>
              <div className="flex flex-col gap-2">
                {completed.map((t) => (
  <div
    key={t.id}
    onClick={() => navigate(`/tournament/${t.id}`)}
    className="cursor-pointer"
  >
    <TournamentCard
      tournament={t}
      onInfoClick={(e) => {
        e?.stopPropagation?.(); // 🔥 evita que abra la página
        setSelectedTournament(t);
      }}
    />
  </div>
))}
              </div>
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
