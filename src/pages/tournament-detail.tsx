import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  getTournamentById,
  getTournamentResults,
} from "../lib/api/tournaments";
import { PageShell } from "../components/layout/page-shell";
import { Spinner } from "../components/ui/spinner";

export function TournamentDetailPage() {
  const { id } = useParams();

  const [tournament, setTournament] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      getTournamentById(id),
      getTournamentResults(id),
    ]).then(([tData, rData]) => {
      setTournament(tData);
      setResults(rData);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <div className="pt-20 flex justify-center">
          <Spinner />
        </div>
      </PageShell>
    );
  }

  if (!tournament) {
    return (
      <PageShell>
        <div className="pt-20 text-center">
          Torneo no encontrado
        </div>
      </PageShell>
    );
  }

  const isLeague = !!tournament.league_id;

  return (
    <PageShell>
      <div className="pt-20 pb-16">
        <div className="max-w-[900px] mx-auto px-6">

          {/* HEADER */}
          <h1 className="text-sk-2xl font-bold text-sk-text-1 mb-2">
            🏆 {tournament.name}
          </h1>

          <div className="text-sk-sm text-sk-text-2 mb-6">
            {tournament.clubs?.name}
          </div>

          {!isLeague && (
            <div className="mb-4 text-sk-sm text-yellow-400">
              ⚠️ Torneo sin liga (no genera puntos)
            </div>
          )}

          {/* TABLA */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg overflow-hidden">

            {/* HEADER TABLA */}
            <div className="grid grid-cols-[60px_1fr_120px_100px_100px] px-4 py-3 text-xs uppercase text-sk-text-2 border-b border-sk-border-2">
              <span>#</span>
              <span>Jugador</span>
              <span>Premio</span>
              <span>ELO</span>
              <span>Puntos</span>
            </div>

            {/* FILAS */}
            {results.map((r) => {
              const avatar = r.players?.profiles?.avatar_url;

              return (
                <div
                  key={r.position}
                  className="grid grid-cols-[60px_1fr_120px_100px_100px] px-4 py-3 items-center border-b border-sk-border-2 text-sm"
                >
                  {/* POSICIÓN */}
                  <span className="font-bold">{r.position}</span>

                  {/* PLAYER */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-sk-bg-4 flex items-center justify-center">
                      {avatar ? (
                        <img
                          src={`${avatar}?t=${Date.now()}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold">
                          {r.players.nickname?.charAt(0)}
                        </span>
                      )}
                    </div>

                    <span className="font-semibold">
                      {r.players.nickname}
                    </span>
                  </div>

                  {/* PREMIO */}
                  <span>{r.prize ?? "-"}</span>

                  {/* ELO */}
                  <span
                    className={
                      r.elo_change > 0
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {r.elo_change > 0 ? "+" : ""}
                    {r.elo_change}
                  </span>

                  {/* PUNTOS */}
                  <span>
                    {isLeague ? r.points ?? 0 : "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageShell>
  );
}