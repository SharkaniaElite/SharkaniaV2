// src/pages/ranking.tsx
import { useState, useMemo } from "react";
import { PageShell } from "../components/layout/page-shell";
import { RankingTable } from "../components/ranking/ranking-table";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { usePlayers } from "../hooks/use-players";
import { usePokerRooms } from "../hooks/use-clubs";
import { useDebounce } from "../hooks/use-debounce";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { SEOHead } from "../components/seo/seo-head";
import { Link } from "react-router-dom";

const COUNTRIES = [
  { code: "", label: "Todos los países" },
  { code: "AR", label: "🇦🇷 Argentina" },
  { code: "BO", label: "🇧🇴 Bolivia" },
  { code: "BR", label: "🇧🇷 Brasil" },
  { code: "CL", label: "🇨🇱 Chile" },
  { code: "CO", label: "🇨🇴 Colombia" },
  { code: "CR", label: "🇨🇷 Costa Rica" },
  { code: "CU", label: "🇨🇺 Cuba" },
  { code: "DO", label: "🇩🇴 Rep. Dominicana" },
  { code: "EC", label: "🇪🇨 Ecuador" },
  { code: "ES", label: "🇪🇸 España" },
  { code: "GQ", label: "🇬🇶 Guinea Ecuatorial" },
  { code: "GT", label: "🇬🇹 Guatemala" },
  { code: "HN", label: "🇭🇳 Honduras" },
  { code: "MX", label: "🇲🇽 México" },
  { code: "NI", label: "🇳🇮 Nicaragua" },
  { code: "PA", label: "🇵🇦 Panamá" },
  { code: "PE", label: "🇵🇪 Perú" },
  { code: "PR", label: "🇵🇷 Puerto Rico" },
  { code: "PY", label: "🇵🇾 Paraguay" },
  { code: "SV", label: "🇸🇻 El Salvador" },
  { code: "US", label: "🇺🇸 Estados Unidos" },
  { code: "UY", label: "🇺🇾 Uruguay" },
  { code: "VE", label: "🇻🇪 Venezuela" },
];

const PAGE_SIZE = 20;

export function RankingPage() {
  const [search, setSearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [roomId, setRoomId] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  const { data: roomsData } = usePokerRooms();

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
      countryCode: countryCode || undefined,
      roomId: roomId || undefined,
    }),
    [page, debouncedSearch, countryCode, roomId]
  );

  const { data, isLoading, isFetching } = usePlayers(filters);

  const players = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.count ?? 0;

  return (
    <PageShell>
      <SEOHead
        title="Ranking ELO Global"
        description="Los mejores jugadores de poker del mundo ordenados por ELO. Busca, filtra y descubre quién domina."
        path="/ranking"
      />

      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">

          {/* Header */}
          <div className="mb-8">
            <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">
              Ranking ELO Global
            </p>
            <h1 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-2">
              🏆 Ranking de Jugadores
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              <p className="text-sk-base text-sk-text-2">
                {totalCount} jugadores rankeados por ELO
                {isFetching && (
                  <span className="ml-2 text-sk-accent">(actualizando...)</span>
                )}
              </p>
              <Link 
                to="/sistema-elo" 
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-sk-text-3 hover:text-sk-accent transition-colors bg-sk-bg-2 border border-sk-border-2 rounded-full px-2.5 py-1"
              >
                <Info size={12} />
                ¿Cómo se calcula?
              </Link>
            </div>
          </div>

{/* Internal link — Blog */}
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <Link
              to="/blog/elo-global-como-medimos-al-mejor-jugador-de-clubes"
              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/30 hover:bg-white/[0.02] transition-all group"
            >
              <span className="text-lg">📊</span>
              <div className="flex-1 min-w-0">
                <p className="text-sk-sm font-semibold text-sk-text-1 group-hover:text-sk-accent transition-colors truncate">
                  ¿Cómo funciona el ELO en poker?
                </p>
                <p className="text-[11px] text-sk-text-3">La ciencia detrás del ranking global</p>
              </div>
              <ChevronRight size={14} className="text-sk-text-4 group-hover:text-sk-accent transition-colors" />
            </Link>
            <Link
              to="/glosario/elo"
              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/30 hover:bg-white/[0.02] transition-all group"
            >
              <span className="text-lg">📖</span>
              <div className="flex-1 min-w-0">
                <p className="text-sk-sm font-semibold text-sk-text-1 group-hover:text-sk-accent transition-colors truncate">
                  ¿Qué es el ELO?
                </p>
                <p className="text-[11px] text-sk-text-3">Definición completa en el glosario</p>
              </div>
              <ChevronRight size={14} className="text-sk-text-4 group-hover:text-sk-accent transition-colors" />
            </Link>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1">
              <Input
                variant="search"
                placeholder="Buscar jugador..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              value={countryCode}
              onChange={(e) => {
                setCountryCode(e.target.value);
                setPage(1);
              }}
              className="bg-sk-bg-2 border border-sk-border-2 rounded-md px-3 py-2.5 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setPage(1);
              }}
              className="bg-sk-bg-2 border border-sk-border-2 rounded-md px-3 py-2.5 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent"
            >
              <option value="">Todas las salas</option>
              {roomsData?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <RankingTable
            players={players}
            isLoading={isLoading}
            startRank={(page - 1) * PAGE_SIZE + 1}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sk-xs text-sk-text-2">
                Página{" "}
                <span className="font-mono font-semibold text-sk-text-1">
                  {page}
                </span>{" "}
                de{" "}
                <span className="font-mono font-semibold text-sk-text-1">
                  {totalPages}
                </span>
              </p>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={16} />
                  Anterior
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page === totalPages}
                >
                  Siguiente
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}