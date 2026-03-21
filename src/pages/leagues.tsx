// src/pages/leagues.tsx
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { Badge } from "../components/ui/badge";
import { Chip } from "../components/ui/chip";
import { Spinner } from "../components/ui/spinner";
import { EmptyState } from "../components/ui/empty-state";
import { useLeagues } from "../hooks/use-leagues";
import { getFlag } from "../lib/countries";
import { FlagIcon } from "../components/ui/flag-icon";
import { SEOHead } from "../components/seo/seo-head";

const statusBadge = {
  upcoming: { label: "Próxima", variant: "accent" as const },
  active: { label: "Activa", variant: "green" as const },
  finished: { label: "Finalizada", variant: "muted" as const },
};

export function LeaguesPage() {
  const { data: leagues, isLoading } = useLeagues();

  return (
    <PageShell>
    <SEOHead
  title="Ligas de Poker"
  description="Ligas organizadas con tabla de posiciones, puntos y premios. Compite en temporadas de poker competitivo."
  path="/leagues"
/>
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="mb-8">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">
              Ligas
            </p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-2">
              🏆 Ligas de Poker
            </h1>
            <p className="text-sk-base text-sk-text-2">
              Temporadas organizadas con tabla de posiciones y premios
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (leagues ?? []).length === 0 ? (
            <EmptyState icon="🏆" title="No hay ligas activas" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(leagues ?? []).map((league) => {
                const status = statusBadge[league.status];
                const primaryClub = league.league_clubs?.find((lc) => lc.is_primary);
                const rooms = league.league_rooms?.map((lr) => lr.poker_rooms?.name).filter(Boolean) ?? [];
                const borderColor = league.status === "active" ? "border-t-sk-gold" : "border-t-sk-accent";

                return (
                  <Link
                    key={league.id}
                    to={`/leagues/${league.id}`}
                    className={`bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 border-t-2 ${borderColor} flex flex-col gap-4 cursor-pointer hover:border-sk-border-3 hover:shadow-sk-md hover:-translate-y-0.5 transition-all duration-200`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sk-md font-bold text-sk-text-1 tracking-tight">
                          {league.name}
                        </h3>
                        <div className="font-mono text-[11px] text-sk-text-2 mt-1">
                          {league.start_date && league.end_date
                            ? `📅 ${league.start_date} — ${league.end_date}`
                            : "📅 Fechas por definir"}
                          {primaryClub && (
                            <>
                              {" · "}
                              <FlagIcon countryCode={primaryClub.clubs?.country_code ?? null} />{" "}
                              {primaryClub.clubs?.name}
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    {league.description && (
                      <p className="text-sk-sm text-sk-text-2 line-clamp-2">
                        {league.description}
                      </p>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      {rooms.map((r) => (
                        <Chip key={r}>{r}</Chip>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
