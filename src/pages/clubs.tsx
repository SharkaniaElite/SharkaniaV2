// src/pages/clubs.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { Chip } from "../components/ui/chip";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import { EmptyState } from "../components/ui/empty-state";
import { useClubs } from "../hooks/use-clubs";
import { getFlag } from "../lib/countries";
import { FlagIcon } from "../components/ui/flag-icon";
import { SEOHead } from "../components/seo/seo-head";

export function ClubsPage() {
  const { data: clubs, isLoading } = useClubs();
  const [search, setSearch] = useState("");

  const filtered = (clubs ?? []).filter((c) => {
    if (search.length >= 2) {
      return c.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  return (
    <PageShell>
    <SEOHead
  title="Clubes de Poker"
  description="Encuentra clubes de poker online verificados de toda Latinoamérica y el mundo. PPPoker, PokerBros, ClubGG y más."
  path="/clubs"
/>
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* Header */}
          <div className="mb-8">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">
              Clubes Activos
            </p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-2">
              🏛️ Clubes de Poker
            </h1>
            <p className="text-sk-base text-sk-text-2">
              {filtered.length} clubes verificados
            </p>
          </div>

          {/* Search */}
          <div className="mb-6 max-w-md">
            <Input
              variant="search"
              placeholder="Buscar club..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Internal links */}
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <Link
              to="/calendar"
              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/30 hover:bg-white/[0.02] transition-all group"
            >
              <span className="text-lg">📅</span>
              <div className="flex-1 min-w-0">
                <p className="text-sk-sm font-semibold text-sk-text-1 group-hover:text-sk-accent transition-colors">
                  Calendario de torneos
                </p>
                <p className="text-[11px] text-sk-text-3">Todos los torneos próximos en un solo lugar</p>
              </div>
            </Link>
            <Link
              to="/ranking"
              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/30 hover:bg-white/[0.02] transition-all group"
            >
              <span className="text-lg">🏆</span>
              <div className="flex-1 min-w-0">
                <p className="text-sk-sm font-semibold text-sk-text-1 group-hover:text-sk-accent transition-colors">
                  Ranking ELO Global
                </p>
                <p className="text-[11px] text-sk-text-3">Los mejores jugadores del ecosistema</p>
              </div>
            </Link>
          </div>

          {/* Clubs grid */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="🏛️"
              title="No se encontraron clubes"
              description="Intenta buscar con otro nombre."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((club) => {
                const rooms = club.club_rooms?.map((cr) => cr.poker_rooms?.name).filter(Boolean) ?? [];

                return (
                  <Link
                    key={club.id}
                    to={`/clubs/${club.id}`}
                    className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 cursor-pointer transition-all duration-200 ease-out hover:border-sk-border-3 hover:shadow-sk-md hover:-translate-y-0.5 flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <FlagIcon countryCode={club.country_code} />
                      <div>
                        <h3 className="text-sk-md font-bold text-sk-text-1 tracking-tight">
                          {club.name}
                        </h3>
                        <div className="flex gap-2 mt-1">
                          {rooms.map((r) => (
                            <Chip key={r}>{r}</Chip>
                          ))}
                        </div>
                      </div>
                    </div>
                    {club.description && (
                      <p className="text-sk-sm text-sk-text-2 leading-relaxed line-clamp-2">
                        {club.description}
                      </p>
                    )}
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
