// src/pages/league-detail.tsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { LeagueStandingsTable } from "../components/leagues/league-standings-table";
import { ClubStandingsTable } from "../components/leagues/club-standings-table";
import { getLeagueCCPStandings, type CCPClubRanking } from "../lib/api/leagues";
import { TournamentCard } from "../components/calendar/tournament-card";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { Badge } from "../components/ui/badge";
import { Chip } from "../components/ui/chip";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { useLeagueBySlug, useLeagueStandings } from "../hooks/use-leagues";
import { useTournamentsByLeague } from "../hooks/use-tournaments";
import { FlagIcon } from "../components/ui/flag-icon";
import { ArrowLeft, Trophy, Crown, Download } from "lucide-react";
import type { TournamentWithDetails } from "../types";
import { cn } from "../lib/cn";
import { SEOHead } from "../components/seo/seo-head";
import { formatNumber } from "../lib/format";
import Papa from "papaparse";

type Tab = "standings" | "ccp_standings" | "upcoming" | "history" | "info";

const statusBadge = {
  upcoming: { label: "Próxima", variant: "accent" as const },
  active: { label: "Activa", variant: "green" as const },
  finished: { label: "Finalizada", variant: "muted" as const },
};

export function LeagueDetailPage() {
  const { leagueSlug } = useParams<{ leagueSlug: string }>();
  const { data: league, isLoading } = useLeagueBySlug(leagueSlug);
  const { data: standings, isLoading: standingsLoading } = useLeagueStandings(league?.id);
  const { data: tournaments, isLoading: tournamentsLoading } = useTournamentsByLeague(league?.id ?? '', true);
  const [tab, setTab] = useState<Tab>("standings");
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);

  // Durante la convocatoria la primera intención de búsqueda es conocer
  // la próxima fecha; después se preserva el ranking y las pestañas habituales.
  useEffect(() => {
    if (league?.slug === "liga-sharkania-noviembre-2026" && league.status !== "finished" && !standings?.length) {
      setTab("upcoming");
    }
  }, [league?.slug, league?.status, standings?.length]);

  const [ccpStandings, setCcpStandings] = useState<CCPClubRanking[]>([]);
  const [ccpLoading, setCcpLoading] = useState(false);

  useEffect(() => {
    if (league?.id && tab === "ccp_standings" && ccpStandings.length === 0) {
      const timerId = setTimeout(() => {
        setCcpLoading(true);
        getLeagueCCPStandings(league.id)
          .then(setCcpStandings)
          .catch(console.error)
          .finally(() => setCcpLoading(false));
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [league?.id, tab, ccpStandings.length]);

  if (isLoading) {
    return (
      <PageShell variant="arena">
        <div className="pt-20 min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (!league) {
    return (
      <PageShell variant="arena">
        <div className="pt-20 min-h-screen flex flex-col items-center justify-center gap-4">
          <span className="text-5xl">🏆</span>
          <h1 className="text-sk-2xl font-bold text-sk-text-1">Liga no encontrada</h1>
          <Link to="/leagues">
            <Button variant="accent" size="md">
              <ArrowLeft size={16} /> Volver a ligas
            </Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const currentStatus = league.status as "upcoming" | "active" | "finished";
  const status = statusBadge[currentStatus] || { label: league.status, variant: "muted" };
  const clubs = league.league_clubs ?? [];

  const directRooms = league.league_rooms?.map((lr) => lr.poker_rooms?.name).filter(Boolean) ?? [];
  const tournamentRooms = Array.from(new Set((tournaments ?? []).map(t => t.poker_rooms?.name).filter(Boolean)));
  const rooms = directRooms.length > 0 ? directRooms : tournamentRooms;

  const champion = standings && standings.length > 0 ? standings[0] : null;

  // 🔥 BÚSQUEDA IMPLACABLE DE LA IMAGEN
  const primaryClub = clubs.find(lc => lc.is_primary)?.clubs || clubs[0]?.clubs;
  const bannerUrl = (league as any)?.image_url || (league as any)?.banner_url || (primaryClub as any)?.banner_url || (primaryClub as any)?.image_url;

  const isLatinAllin = clubs.some(
    (lc) => (lc.clubs as any)?.slug === "latin-allin-poker" || lc.clubs?.name.toLowerCase().includes("latin allin")
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: "standings", label: "Tabla de Posiciones" },
    ...(isLatinAllin ? [{ key: "ccp_standings" as Tab, label: "Ranking de Clubes CCP" }] : []), 
    { key: "upcoming", label: "Próximos" },
    { key: "history", label: "Historial" },
    { key: "info", label: "Información" },
  ];

  const upcoming = (tournaments ?? [])
    .filter(t => ["scheduled", "live", "late_registration"].includes(t.status))
    .sort((a, b) => new Date(a.start_datetime || 0).getTime() - new Date(b.start_datetime || 0).getTime());

  const isNovemberSharkaniaLeague = league.slug === "liga-sharkania-noviembre-2026";
  const nextNovemberDate = upcoming.find(t =>
    (t.status === "live" || t.status === "late_registration") ||
    new Date(t.start_datetime).getTime() >= Date.now()
  );
  const nextNovemberDateLabel = nextNovemberDate
    ? new Intl.DateTimeFormat("es-CL", {
        weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Santiago"
      }).format(new Date(nextNovemberDate.start_datetime))
    : null;

  const completed = (tournaments ?? [])
    .filter(t => t.results_uploaded || (t.status === "completed" && !t.results_uploaded))
    .sort((a, b) => new Date(b.start_datetime || 0).getTime() - new Date(a.start_datetime || 0).getTime());

  const playersMap = standings?.reduce((acc, st) => {
    acc[st.player_id] = st.players?.nickname || "Desconocido";
    return acc;
  }, {} as Record<string, string>) || {};

  const handleDownloadCSV = () => {
    if (!standings || standings.length === 0) return;

    const csvData = standings.map((s, index) => ({
      Posición: index + 1,
      Jugador: s.players?.nickname || "—",
      "Club CCP": s.ccp_club || "Sin Club",
      Puntos: Math.round(s.total_points),
      "Torneos Jugados": s.tournaments_played,
      "Mejor Posición": s.best_position ? `${s.best_position}°` : "—",
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8;" }); 
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ranking_${leagueSlug}.csv`); 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <PageShell variant="arena">
      <SEOHead
        title={`${league.name} — Liga`}
        description={`Liga de poker ${league.name}. Tabla de posiciones, calendario y resultados.`}
        path={`/leagues/${leagueSlug}`}
      />
      <div className="arena-interior">
        <div className="arena-interior-container">
          <Link
            to="/leagues"
            className="inline-flex items-center gap-2 text-sk-sm text-sk-text-2 hover:text-sk-text-1 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> Volver a ligas
          </Link>

          {/* 🔥 Header con Imagen de Fondo Arreglada */}
          <header className="arena-detail-banner arena-detail-banner--league relative bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 mb-6 overflow-hidden min-h-[160px] flex flex-col justify-center shadow-md">
            
            {/* 1. Imagen de fondo (Opacidad limpia y pura, sin mix-blend) */}
            {bannerUrl && (
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
                style={{ backgroundImage: `url('${bannerUrl}')`, opacity: 0.35 }}
              />
            )}
            
            {/* 2. Capa oscura para que las letras resalten */}
            <div className="absolute inset-0 bg-gradient-to-r from-sk-bg-0/95 via-sk-bg-0/70 to-transparent z-10" />
            
            {/* 3. Contenido de la cabecera (por encima del fondo) */}
            <div className="relative z-20">
              <p className="arena-detail-kicker">SHARKANIA ARENA / CIRCUITO DE LIGAS</p>
              <div className="flex justify-between items-start mb-3">
                <h1 className="arena-detail-title text-sk-2xl font-extrabold text-sk-text-1 tracking-tight drop-shadow-md">
                  {league.name}
                </h1>
                <Badge variant={status.variant} className="shadow-sm">{status.label}</Badge>
              </div>
              
              {league.description && (
                <div className="mb-4 max-w-3xl">
                  <p className="text-sk-sm text-sk-text-2 leading-relaxed line-clamp-3 sm:line-clamp-4 drop-shadow-sm">
                    {league.description}
                  </p>
                  <a href="#league-tabs" onClick={() => setTab("info")} className="mt-2 inline-flex items-center text-xs font-bold text-sk-accent hover:underline focus-visible:outline-2 focus-visible:outline-sk-accent">
                    Leer descripción y condiciones completas
                  </a>
                </div>
              )}
              
              <div className="flex items-center gap-3 flex-wrap mb-3 drop-shadow-sm">
                {league.start_date && league.end_date && (
                  <span className="font-mono text-[11px] text-sk-text-2">
                    📅 {league.start_date} — {league.end_date}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {clubs.filter(lc => lc.is_primary).map((lc) => (
                  <Link
                    key={lc.clubs?.id}
                    to={`/clubs/${(lc.clubs as any)?.slug ?? lc.clubs?.id}`}
                    className="text-sk-xs text-sk-accent hover:opacity-80 transition-opacity font-semibold drop-shadow-sm"
                  >
                    <FlagIcon countryCode={lc.clubs?.country_code ?? null} /> {lc.clubs?.name}
                    {lc.is_primary && " ★"}
                  </Link>
                ))}
              </div>
              
              <div className="flex gap-2 flex-wrap">
                {rooms.map((r) => (
                  <Chip key={r} className="shadow-sm border-white/10 bg-black/50">{r}</Chip>
                ))}
              </div>
            </div>
          </header>

          {isNovemberSharkaniaLeague && (
            <aside aria-label="Requisitos para recibir los premios de SHARKANIA" className="mb-6 rounded-xl border-2 border-sk-gold/50 bg-sk-gold/10 p-4 sm:p-5">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-sk-gold">Importante · premios exclusivos SHARKANIA</p>
              <h2 className="mt-2 text-lg font-extrabold text-sk-text-1">El bounty de cada fecha y los premios del ranking mensual requieren inscripción a través de SHARKANIA</h2>
              <p className="mt-2 text-sm leading-relaxed text-sk-text-2">
                Participar en los torneos de Ignition por sí solo no habilita para estos premios adicionales.
                Debes estar registrado en la Liga SHARKANIA mediante este sitio y tener tu nickname vinculado
                para acreditar tu participación.
              </p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-sk-text-1">
                Si ya te registraste anteriormente y tu vinculación está guardada, no necesitas hacerlo de nuevo.
              </p>
              <Link to="/ignition" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sk-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-accent">
                Cómo inscribirse y verificar mi vinculación <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </aside>
          )}

          {/* Ruta de acceso clara a la liga; se alimenta del calendario real. */}
          {isNovemberSharkaniaLeague && currentStatus !== "finished" && (
            <section className="mb-6 overflow-hidden rounded-xl border border-sk-accent/30 bg-gradient-to-br from-sk-bg-2 via-sk-bg-2 to-sk-accent/10 p-5 sm:p-7" aria-labelledby="sharkania-november-join-title">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-sk-gold">Liga SHARKANIA · Noviembre 2026</p>
                  <h2 id="sharkania-november-join-title" className="text-xl sm:text-2xl font-extrabold text-sk-text-1">
                    {nextNovemberDateLabel ? "Próxima fecha de la liga" : "Sigue el ranking de la liga"}
                  </h2>
                  {nextNovemberDateLabel && <p className="mt-2 text-sk-base font-semibold text-sk-accent capitalize">{nextNovemberDateLabel} · Chile</p>}
                  <p className="mt-2 text-sk-sm leading-relaxed text-sk-text-2">
                    Cuatro jueves de noviembre, 21:00 h de Chile. Si aún no tienes Ignition, descárgalo usando el enlace de SHARKANIA en nuestra guía.
                  </p>
                  <p className="mt-2 text-sk-sm font-semibold leading-relaxed text-sk-text-1">
                    ¿Ya estabas inscrito en la Liga SHARKANIA? No necesitas registrarte nuevamente. Entra con tu cuenta de siempre y comprueba el estado de tu nickname.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:flex-col">
                  <Link to="/ignition" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-sk-accent px-5 py-3 text-center text-sm font-extrabold text-sk-bg-0 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-accent">
                    Descargar Ignition y vincular nickname
                  </Link>
                  <a href="#league-tabs" onClick={() => setTab("upcoming")} className="inline-flex min-h-12 items-center justify-center rounded-lg border border-sk-border-2 bg-sk-bg-3 px-5 py-3 text-center text-sm font-bold text-sk-text-1 hover:border-sk-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-accent">
                    Ver fechas programadas
                  </a>
                </div>
              </div>
            </section>
          )}

          {/* Campeón Finalizado */}
          {currentStatus === "finished" && champion && (
            <div className="bg-gradient-to-r from-sk-gold/10 via-sk-gold/5 to-transparent border border-sk-gold/30 rounded-xl p-6 mb-6 flex items-center gap-5 sm:gap-6 animate-in fade-in zoom-in-95 duration-500 shadow-[0_4px_30px_rgba(250,212,25,0.05)]">
              <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full bg-sk-bg-0 border-2 border-sk-gold flex items-center justify-center shadow-[0_0_15px_rgba(250,212,25,0.3)] relative overflow-hidden">
                <div className="absolute inset-0 bg-sk-gold/20 animate-pulse" />
                <Crown className="text-sk-gold relative z-10" size={28} />
              </div>
              <div>
                <h2 className="text-[10px] sm:text-sk-xs font-bold text-sk-gold uppercase tracking-widest mb-1 sm:mb-1.5">
                  ¡Liga Finalizada! Campeón Oficial
                </h2>
                <div className="text-sk-xl sm:text-3xl font-extrabold text-sk-text-1 flex items-center gap-3">
                  <FlagIcon countryCode={champion.players?.country_code ?? null} />
                  <Link 
                    to={`/ranking/${(champion.players as any)?.slug ?? champion.player_id}`} 
                    className="hover:text-sk-gold transition-colors"
                  >
                    {champion.players?.nickname}
                  </Link>
                </div>
                <p className="text-[11px] sm:text-sk-sm text-sk-text-2 mt-1.5">
                  Coronado con <strong className="text-sk-text-1">{formatNumber(champion.total_points)} puntos</strong> tras {champion.tournaments_played} fechas jugadas.
                </p>
              </div>
            </div>
          )}

          {/* Reglas de la liga */}
          {league.best_dates_to_count && league.total_dates && (
            <div className="flex items-center gap-3 bg-sk-gold/10 border border-sk-gold/20 text-sk-gold rounded-lg p-3.5 px-5 mb-6 text-sk-sm">
              <Trophy size={18} className="shrink-0" />
              <p>
                <strong className="font-bold mr-1">Regla de Liga:</strong> 
                Se consideran los mejores <strong className="font-extrabold text-sk-text-1">{league.best_dates_to_count} puntajes</strong> de un total de <strong className="font-extrabold text-sk-text-1">{league.total_dates} fechas</strong>.
              </p>
            </div>
          )}

          {/* Tabs */}
          <div id="league-tabs" className="flex justify-between items-end mb-6 scroll-mt-24">
            <div className="flex gap-px bg-sk-bg-0 rounded-md p-0.5 border border-sk-border-2 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "text-sk-sm font-medium px-4 py-2 rounded-sm whitespace-nowrap transition-all duration-100",
                    tab === t.key
                      ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs"
                      : "text-sk-text-2 hover:text-sk-text-1"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* BOTÓN DE DESCARGA CSV */}
            {tab === "standings" && standings && standings.length > 0 && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleDownloadCSV}
                className="hidden sm:flex items-center gap-2 border-sk-border-2"
              >
                <Download size={14} /> Descargar CSV
              </Button>
            )}
          </div>

          {/* Tab content */}
          {tab === "standings" && (
            <LeagueStandingsTable
              standings={standings ?? []}
              isLoading={standingsLoading}
              leagueId={league?.id}
            />
          )}

          {tab === "ccp_standings" && (
            <ClubStandingsTable 
              standings={ccpStandings} 
              tournaments={tournaments ?? []} 
              playersMap={playersMap}         
              isLoading={ccpLoading} 
            />
          )}

          {tab === "upcoming" && (
            tournamentsLoading ? <Spinner size="md" /> :
            upcoming.length === 0 ? <EmptyState icon="📅" title="Sin torneos próximos" /> :
            <div className="flex flex-col gap-2">
              {upcoming.map((t) => (
                <TournamentCard key={t.id} tournament={t} onInfoClick={() => setSelectedTournament(t)} />
              ))}
            </div>
          )}

          {tab === "history" && (
            tournamentsLoading ? <Spinner size="md" /> :
            completed.length === 0 ? <EmptyState icon="⏱️" title="Sin historial de torneos" /> :
            <div className="flex flex-col gap-2">
              {completed.map((t) => (
                <div key={t.id} className="opacity-80 hover:opacity-100 transition-opacity">
                  <TournamentCard tournament={t} onInfoClick={() => setSelectedTournament(t)} />
                </div>
              ))}
            </div>
          )}

          {tab === "info" && (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6">
              <h3 className="text-sk-md font-bold text-sk-text-1 mb-4">Información de la Liga</h3>
              <div className="space-y-3 text-sk-sm text-sk-text-2">
                {league.description && (
                  <div className="rounded-lg border border-sk-border-2 bg-sk-bg-3 p-4">
                    <h4 className="mb-2 font-bold text-sk-text-1">Descripción y condiciones de la liga</h4>
                    <p className="whitespace-pre-line leading-relaxed">{league.description}</p>
                  </div>
                )}
                <p><span className="text-sk-text-1 font-semibold">Nombre:</span> {league.name}</p>
                <p><span className="text-sk-text-1 font-semibold">Estado:</span> {status.label}</p>
                <p><span className="text-sk-text-1 font-semibold">Periodo:</span> {league.start_date} — {league.end_date}</p>
                <p><span className="text-sk-text-1 font-semibold">Organizador:</span> {clubs.filter(c => c.is_primary).map((c) => c.clubs?.name).join(", ")}</p>
                
                {rooms.length > 0 ? (
                  <p><span className="text-sk-text-1 font-semibold">Salas:</span> {rooms.join(", ")}</p>
                ) : (
                  <p><span className="text-sk-text-1 font-semibold">Salas:</span> Por definir</p>
                )}

                {league.rules_url && (
                  <p>
                    <span className="text-sk-text-1 font-semibold">Reglas:</span>{" "}
                    <a href={league.rules_url} target="_blank" rel="noopener noreferrer" className="text-sk-accent hover:opacity-80">
                      Ver reglas →
                    </a>
                  </p>
                )}
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