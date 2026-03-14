// src/pages/ranking.tsx
import { useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { RankingTable } from "../components/ranking/ranking-table";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { usePlayers } from "../hooks/use-players";
import { usePokerRooms } from "../hooks/use-clubs";
import { getFlag } from "../lib/countries";
import { ChevronLeft, ChevronRight } from "lucide-react";

const COUNTRIES = [
  { code: "", label: "Todos los países" },
  { code: "BR", label: "🇧🇷 Brasil" },
  { code: "AR", label: "🇦🇷 Argentina" },
  { code: "MX", label: "🇲🇽 México" },
  { code: "CL", label: "🇨🇱 Chile" },
  { code: "CO", label: "🇨🇴 Colombia" },
  { code: "ES", label: "🇪🇸 España" },
  { code: "PE", label: "🇵🇪 Perú" },
  { code: "UY", label: "🇺🇾 Uruguay" },
  { code: "VE", label: "🇻🇪 Venezuela" },
  { code: "EC", label: "🇪🇨 Ecuador" },
];

const PAGE_SIZE = 20;

export function RankingPage() {
  const [search, setSearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [roomId, setRoomId] = useState("");
  const [page, setPage] = useState(1);

  const { data: roomsData } = usePokerRooms();

  const { data, isLoading } = usePlayers({
    page,
    pageSize: PAGE_SIZE,
    search: search.length >= 2 ? search : undefined,
    countryCode: countryCode || undefined,
    roomId: roomId || undefined,
  });

  const players = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.count ?? 0;

  return (
    <PageShell>
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
            <p className="text-sk-base text-sk-text-2">
              {totalCount} jugadores rankeados por ELO
            </p>
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
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
