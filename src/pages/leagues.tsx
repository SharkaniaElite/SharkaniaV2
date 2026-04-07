// src/pages/leagues.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { Badge } from "../components/ui/badge";
import { Chip } from "../components/ui/chip";
import { Spinner } from "../components/ui/spinner";
import { useLeagues } from "../hooks/use-leagues";
import { FlagIcon } from "../components/ui/flag-icon";
import { SEOHead } from "../components/seo/seo-head";
import { ShieldAlert } from "lucide-react";
import { cn } from "../lib/cn";

// 1. Mantenemos el mapeo de etiquetas y colores
const statusBadge = {
  upcoming: { label: "Próxima", variant: "accent" as const },
  active: { label: "Activa", variant: "green" as const },
  finished: { label: "Finalizada", variant: "muted" as const },
};

// 2. Agregamos la función de ayuda para calcular el estado real
const getLeagueStatus = (startDate: string | null | undefined, endDate: string | null | undefined): "upcoming" | "active" | "finished" => {
  if (!startDate || !endDate) return "upcoming";
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (now < start) return "upcoming";
  if (now > end) return "finished";
  return "active";
};

export function LeaguesPage() {
  const { data: leagues, isLoading } = useLeagues();
  
  // 👇 1. Estado para controlar la pestaña activa
  const [tab, setTab] = useState<"active" | "archived">("active");

  // 👇 2. Filtramos las ligas en dos matrices separadas
  const activeLeagues = (leagues ?? []).filter((l) => {
    const status = getLeagueStatus(l.start_date, l.end_date);
    return status === "active" || status === "upcoming";
  });

  const archivedLeagues = (leagues ?? []).filter((l) => {
    const status = getLeagueStatus(l.start_date, l.end_date);
    return status === "finished";
  });

  // 👇 3. Definimos qué ligas mostrar según la pestaña elegida
  const displayedLeagues = tab === "active" ? activeLeagues : archivedLeagues;

  return (
    <PageShell>
      <SEOHead
        title="Ligas de Poker"
        description="Ligas organizadas con tabla de posiciones, puntos y premios. Compite en temporadas de poker competitivo."
        path="/leagues"
      />
      <div className="pt-20 pb-16">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* ══ HEADER: LIVE DATA CORE ══ */}
          <div className="mb-8 relative">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 relative z-10">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex items-center justify-center w-4 h-4">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-sk-accent opacity-30 animate-ping" />
                    <div className="relative w-2 h-2 rounded-full bg-sk-accent shadow-[0_0_12px_rgba(34,211,238,1)]" />
                  </div>
                  <p className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-sk-accent">
                    Circuitos Competitivos
                  </p>
                </div>

                <h1 className="text-sk-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-sk-text-1 to-sk-text-4 mb-3">
                  Ligas Oficiales
                </h1>
                
                <p className="text-sk-base text-sk-text-2">
                  Temporadas organizadas con tabla de posiciones, puntos y premios en la matriz.
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3 opacity-60">
              <div className="w-1.5 h-1.5 rotate-45 bg-sk-accent" />
              <div className="h-px bg-gradient-to-r from-sk-accent/80 via-sk-accent/20 to-transparent flex-1" />
            </div>
          </div>

          {/* 🧠 CONTROLADOR DE SEGMENTOS (TABS TÁCTICOS) */}
          <div className="flex mb-6">
            <div className="flex gap-1 bg-sk-bg-0 border border-sk-border-2 rounded-md p-0.5">
              <button
                onClick={() => setTab("active")}
                className={cn(
                  "px-4 py-1.5 rounded-sm text-sk-sm font-medium transition-all flex items-center gap-2",
                  tab === "active"
                    ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs"
                    : "text-sk-text-3 hover:text-sk-text-1"
                )}
              >
                Temporadas en Curso
                <span className={cn(
                  "font-mono text-[10px] px-1.5 py-0.5 rounded-sm transition-colors",
                  tab === "active" ? "bg-sk-accent/10 text-sk-accent" : "bg-sk-bg-4 text-sk-text-4"
                )}>
                  {activeLeagues.length}
                </span>
              </button>
              <button
                onClick={() => setTab("archived")}
                className={cn(
                  "px-4 py-1.5 rounded-sm text-sk-sm font-medium transition-all flex items-center gap-2",
                  tab === "archived"
                    ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs"
                    : "text-sk-text-3 hover:text-sk-text-1"
                )}
              >
                Archivo Histórico
                <span className={cn(
                  "font-mono text-[10px] px-1.5 py-0.5 rounded-sm transition-colors",
                  tab === "archived" ? "bg-sk-text-2/10 text-sk-text-2" : "bg-sk-bg-4 text-sk-text-4"
                )}>
                  {archivedLeagues.length}
                </span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : displayedLeagues.length === 0 ? (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <ShieldAlert className="text-sk-text-4 mb-4 opacity-50" size={48} />
              <h3 className="text-sk-lg font-bold text-sk-text-1 mb-2">
                {tab === "active" ? "Sin ligas en curso" : "Archivo vacío"}
              </h3>
              <p className="text-sk-text-3 text-sk-sm max-w-md mx-auto">
                {tab === "active" 
                  ? "No hay temporadas organizadas por el momento en la red principal."
                  : "Aún no hay registros de ligas finalizadas en la matriz."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 👇 AHORA MAPEAMOS displayedLeagues EN LUGAR DE leagues */}
              {displayedLeagues.map((league) => {
                const currentStatus = getLeagueStatus(league.start_date, league.end_date);
                const status = statusBadge[currentStatus];
                
                // Color del borde según el estado
                const borderColor = 
                  currentStatus === "active" ? "border-t-sk-gold" : 
                  currentStatus === "upcoming" ? "border-t-sk-accent" : 
                  "border-t-sk-border-3 grayscale-[50%]"; // 👈 Le damos un toque gris a las terminadas

                const primaryClubObj = league.league_clubs?.find((lc:any) => lc.is_primary)?.clubs as any;
                const primaryClubName = primaryClubObj?.name;
                const bannerUrl = primaryClubObj?.banner_url;
                const bgPos = bannerUrl ? (bannerUrl.match(/#pos=(\d+)/)?.[1] ?? 50) : 50;
                const cleanUrl = bannerUrl?.split('#')[0];
                
                const rooms = league.league_rooms?.map((lr:any) => lr.poker_rooms?.name).filter(Boolean) ?? [];

                return (
                  <Link
                    key={league.id}
                    to={`/leagues/${league.slug ?? league.id}`}
                    className={cn(
                      "relative overflow-hidden bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 border-t-2 flex flex-col gap-4 cursor-pointer hover:border-sk-accent/50 hover:shadow-sk-md hover:-translate-y-1 transition-all duration-300 group",
                      borderColor
                    )}
                    style={bannerUrl ? {
                      backgroundImage: `linear-gradient(to bottom, rgba(12,13,16,0.4), rgba(12,13,16,0.95)), url('${cleanUrl}')`,
                      backgroundSize: 'cover',
                      backgroundPosition: `center ${bgPos}%`
                    } : undefined}
                  >
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sk-md font-bold text-sk-text-1 tracking-tight group-hover:text-sk-accent transition-colors">
                            {currentStatus === "active" ? "🏆 " : currentStatus === "finished" ? "📖 " : "🌎 "}{league.name}
                          </h3>
                        </div>
                        <div className="font-mono text-[11px] text-sk-text-2 mt-1 group-hover:text-sk-text-1 transition-colors">
                          {league.start_date && league.end_date
                            ? `📅 ${league.start_date.slice(0, 10)} — ${league.end_date.slice(0, 10)}`
                            : "📅 Fechas por definir"}
                          {primaryClubObj && (
                            <>
                              {" · "}
                              <FlagIcon countryCode={primaryClubObj.country_code ?? null} />{" "}
                              {primaryClubName}
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    {league.description && (
                      <p className="relative z-10 text-sk-sm text-sk-text-2 line-clamp-2">
                        {league.description}
                      </p>
                    )}

                    <div className="relative z-10 flex gap-2 flex-wrap mt-auto">
                      {rooms.slice(0,3).map((r: string) => (
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