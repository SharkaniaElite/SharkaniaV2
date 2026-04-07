// src/pages/ranking.tsx
import { useState, useMemo } from "react";
import { PageShell } from "../components/layout/page-shell";
import { RankingTable } from "../components/ranking/ranking-table";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { usePlayers } from "../hooks/use-players";
import { usePokerRooms } from "../hooks/use-clubs";
import { useDebounce } from "../hooks/use-debounce";
import { ChevronLeft, ChevronRight, LineChart, BookOpen, Bot, X } from "lucide-react";
import { SEOHead } from "../components/seo/seo-head";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn"; // 👈 Añade esto para las animaciones del panel

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

const PAGE_SIZE = 50;

export function RankingPage() {
  const [search, setSearch] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [roomId, setRoomId] = useState("");
  const [page, setPage] = useState(1);

  // 👇 ESTADOS PARA EL PANEL DE INTELIGENCIA Y LA MASCOTA
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mascotId, setMascotId] = useState(1);

  // Función para abrir el panel y cambiar de tiburón
  const openIntelligenceHub = () => {
    setMascotId(Math.floor(Math.random() * 10) + 1); // Random del 1 al 10
    setIsPanelOpen(true);
  };

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

          {/* ══ HEADER: LIVE DATA CORE (ESPAÑOL) ══ */}
          <div className="mb-8 relative">
            {/* Luz de ambiente holográfica */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 relative z-10">
              <div>
                {/* 1. Indicador de Radar en Vivo */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex items-center justify-center w-4 h-4">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-sk-accent opacity-30 animate-ping" />
                    <div className="relative w-2 h-2 rounded-full bg-sk-accent shadow-[0_0_12px_rgba(34,211,238,1)]" />
                  </div>
                  <p className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-sk-accent">
                    Red ELO Activa
                  </p>
                </div>

                {/* 2. Título Metálico Holográfico */}
                <h1 className="text-sk-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-sk-text-1 to-sk-text-4 mb-3">
                  Ranking Global
                </h1>
                
                {/* 3. Subtítulo Técnico */}
                <p className="text-sk-base text-sk-text-2">
                  <span className="font-mono text-sk-text-1">{totalCount}</span> perfiles activos en la matriz.
                  {isFetching && (
                    <span className="ml-3 font-mono text-[11px] text-sk-accent animate-pulse uppercase tracking-widest">
                      [ Procesando datos... ]
                    </span>
                  )}
                </p>
              </div>

              {/* Botón de Inteligencia Táctica */}
              <div className="shrink-0 mb-1">
                <button
                  onClick={openIntelligenceHub}
                  className="inline-flex items-center gap-2 text-[11px] font-mono font-bold text-sk-accent hover:text-sk-bg-0 hover:bg-sk-accent transition-all border border-sk-accent/50 hover:border-sk-accent rounded-full px-5 py-2.5 shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_25px_rgba(34,211,238,0.3)] group"
                >
                  <Bot size={16} className="group-hover:animate-pulse" />
                  ANALIZAR ALGORITMO
                </button>
              </div>
            </div>

            {/* 4. Divisor Arquitectónico Cyberpunk */}
            <div className="mt-8 flex items-center gap-3 opacity-60">
              <div className="w-1.5 h-1.5 rotate-45 bg-sk-accent" />
              <div className="h-px bg-gradient-to-r from-sk-accent/80 via-sk-accent/20 to-transparent flex-1" />
            </div>
          </div>

{/* 🧠 INTELIGENCIA TÁCTICA (Links internos) */}
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/blog/elo-global-como-medimos-al-mejor-jugador-de-clubes"
              className="group relative overflow-hidden flex items-center gap-4 p-4 rounded-xl border border-sk-border-2 bg-sk-bg-2/50 backdrop-blur-sm hover:bg-sk-bg-3 hover:border-sk-accent/40 hover:shadow-[0_4px_30px_rgba(34,211,238,0.1)] transition-all duration-300"
            >
              {/* Efecto de luz de fondo sutil al hacer hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-sk-accent/0 via-sk-accent/5 to-sk-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="w-12 h-12 rounded-lg bg-sk-bg-0 border border-sk-border-2 flex items-center justify-center shrink-0 group-hover:border-sk-accent/50 group-hover:bg-sk-accent/10 transition-colors duration-300 relative z-10">
                <LineChart size={20} className="text-sk-accent" />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sk-sm font-extrabold text-sk-text-1 group-hover:text-sk-accent transition-colors truncate tracking-tight">
                  ¿Cómo funciona el ELO?
                </p>
                <p className="text-[11px] text-sk-text-3 mt-0.5 leading-snug">
                  La ciencia matemática detrás del ranking global
                </p>
              </div>
              <ChevronRight size={16} className="text-sk-text-4 group-hover:text-sk-accent transition-colors relative z-10" />
            </Link>

            <Link
              to="/glosario/elo"
              className="group relative overflow-hidden flex items-center gap-4 p-4 rounded-xl border border-sk-border-2 bg-sk-bg-2/50 backdrop-blur-sm hover:bg-sk-bg-3 hover:border-sk-purple/40 hover:shadow-[0_4px_30px_rgba(167,139,250,0.1)] transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-sk-purple/0 via-sk-purple/5 to-sk-purple/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="w-12 h-12 rounded-lg bg-sk-bg-0 border border-sk-border-2 flex items-center justify-center shrink-0 group-hover:border-sk-purple/50 group-hover:bg-sk-purple/10 transition-colors duration-300 relative z-10">
                <BookOpen size={20} className="text-sk-purple" />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sk-sm font-extrabold text-sk-text-1 group-hover:text-sk-purple transition-colors truncate tracking-tight">
                  Glosario: ELO Rating
                </p>
                <p className="text-[11px] text-sk-text-3 mt-0.5 leading-snug">
                  Definición técnica y diccionario de conceptos
                </p>
              </div>
              <ChevronRight size={16} className="text-sk-text-4 group-hover:text-sk-purple transition-colors relative z-10" />
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
      {/* ══ SLIDE-OVER: INTELLIGENCE HUB ══ */}
      
      {/* 1. El Fondo Oscuro (Overlay) */}
      <div
        className={cn(
          "fixed inset-0 bg-sk-bg-0/80 backdrop-blur-sm z-[100] transition-opacity duration-300",
          isPanelOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsPanelOpen(false)}
      />

      {/* 2. El Panel Lateral */}
      <div
        className={cn(
          "fixed top-0 right-0 h-[100dvh] w-full max-w-[400px] bg-sk-bg-1 border-l border-sk-border-2 z-[101] shadow-2xl transition-transform duration-500 ease-sk-spring flex flex-col",
          isPanelOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Cabecera del Panel */}
        <div className="flex items-center justify-between p-6 border-b border-sk-border-2 bg-sk-bg-2/50">
          <h3 className="font-mono text-[11px] font-bold tracking-widest text-sk-accent flex items-center gap-2 uppercase">
            <Bot size={14} /> Intelligence Hub
          </h3>
          <button 
            onClick={() => setIsPanelOpen(false)} 
            className="text-sk-text-3 hover:text-sk-accent transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          
          {/* El Escenario de la Mascota */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-6 flex flex-col items-center text-center mb-8 relative overflow-hidden group">
            {/* Luz de fondo sutil */}
            <div className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-sk-accent/10 to-transparent pointer-events-none" />
            
            {/* La imagen que cambia aleatoriamente */}
            <img
              src={`/mascot/shark-${mascotId}.webp`}
              alt="Sharkania Analyst"
              className="w-40 h-40 object-contain mb-5 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] relative z-10 transition-transform duration-500 group-hover:scale-105"
            />
            
            <p className="text-sk-base text-sk-text-1 font-bold leading-relaxed relative z-10">
              "Aquí no medimos tu suerte con las cartas, medimos tu habilidad pura contra el resto del field."
            </p>
            <p className="text-sk-sm text-sk-text-3 mt-3 relative z-10 leading-relaxed">
              Vence a los mejores y tu ELO se disparará. Si pierdes contra novatos, caerá sin piedad.
            </p>
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-sk-border-2 to-transparent mb-8" />

          {/* Links de Reportes */}
          <h4 className="text-[10px] font-mono text-sk-text-4 font-bold uppercase tracking-widest mb-4">
            Reportes Desclasificados
          </h4>
          <div className="space-y-3">
            <Link
              to="/blog/elo-global-como-medimos-al-mejor-jugador-de-clubes"
              className="flex items-center gap-4 p-4 rounded-xl bg-sk-bg-2 border border-sk-border-2 hover:border-sk-accent/50 hover:bg-sk-accent/5 transition-all group"
              onClick={() => setIsPanelOpen(false)}
            >
              <div className="w-10 h-10 rounded-lg bg-sk-bg-0 border border-sk-border-2 flex items-center justify-center shrink-0 group-hover:border-sk-accent/50 group-hover:text-sk-accent transition-colors">
                <LineChart size={18} />
              </div>
              <div>
                <p className="text-sk-sm font-extrabold text-sk-text-1 group-hover:text-sk-accent transition-colors">La Matemática del ELO</p>
                <p className="text-[11px] text-sk-text-3 mt-0.5">Leer reporte técnico detallado</p>
              </div>
            </Link>

            <Link
              to="/glosario/elo"
              className="flex items-center gap-4 p-4 rounded-xl bg-sk-bg-2 border border-sk-border-2 hover:border-sk-purple/50 hover:bg-sk-purple/5 transition-all group"
              onClick={() => setIsPanelOpen(false)}
            >
              <div className="w-10 h-10 rounded-lg bg-sk-bg-0 border border-sk-border-2 flex items-center justify-center shrink-0 group-hover:border-sk-purple/50 group-hover:text-sk-purple transition-colors">
                <BookOpen size={18} />
              </div>
              <div>
                <p className="text-sk-sm font-extrabold text-sk-text-1 group-hover:text-sk-purple transition-colors">Glosario ELO Rating</p>
                <p className="text-[11px] text-sk-text-3 mt-0.5">Ver definición exacta</p>
              </div>
            </Link>
          </div>

        </div>
      </div>
    </PageShell>
  );
}