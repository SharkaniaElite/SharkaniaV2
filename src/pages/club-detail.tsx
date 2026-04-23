// src/pages/club-detail.tsx
import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { ClubHeader } from "../components/clubs/club-header";
import { TournamentCard } from "../components/calendar/tournament-card";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { useClubBySlug } from "../hooks/use-clubs";
import { useTournamentsByClub } from "../hooks/use-tournaments";
import { ArrowLeft, Mail, MessageCircle, Globe, ChevronDown, Gamepad2 } from "lucide-react";
import type { TournamentWithDetails } from "../types";
import { SEOHead } from "../components/seo/seo-head";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export function ClubDetailPage() {
  const { clubSlug } = useParams<{ clubSlug: string }>();
  const navigate = useNavigate();
  const { data: club, isLoading } = useClubBySlug(clubSlug);
  const { data: tournaments, isLoading: tournamentsLoading } = useTournamentsByClub(club?.id ?? '');
  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);

  // FETCH DE LIGAS DEL CLUB CON ESTADO DINÁMICO
  const { data: leagues, isLoading: leaguesLoading } = useQuery({
    queryKey: ["club-leagues", club?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_clubs")
        .select("leagues(*)")
        .eq("club_id", club?.id ?? '')

      if (error) throw error;

      return (data || []).map((d: any) => {
        const lg = d.leagues;
        let status = lg.status;

        if (lg.start_date && lg.end_date) {
          const now = new Date();
          const start = new Date(lg.start_date);
          const end = new Date(lg.end_date);
          end.setHours(23, 59, 59, 999);

          if (now < start) status = "upcoming";
          else if (now > end) status = "finished";
          else status = "active";
        }
        return { ...lg, status };
      });
    },
    enabled: !!club?.id,
  });

  // 🔥 Corrección 3: Usamos leaguesLoading aquí para esperar a que carguen las ligas
  if (isLoading || leaguesLoading) {
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

  const clubData = club as any;
  const hasContact = clubData.whatsapp || clubData.email;
  const hasSocials = clubData.website_url || clubData.discord_url || clubData.telegram_url || clubData.instagram_url;
  const hasAnyContact = hasContact || hasSocials;

  const now = new Date();

  const upcoming = (tournaments ?? []).filter((t) => {
    if (["completed", "cancelled"].includes(t.status)) return false;
    if (t.status === "late_registration" && t.late_reg_end && new Date(t.late_reg_end) <= now) return false;
    return true;
  });

  const completed = (tournaments ?? []).filter((t) => {
    if (t.status === "completed") return true;
    if (t.status === "late_registration" && t.late_reg_end && new Date(t.late_reg_end) <= now) return true;
    return false;
  });

  const activeLeagues = leagues?.filter(l => l.status !== "finished") || [];
  const pastLeagues = leagues?.filter(l => l.status === "finished") || [];

  return (
    <PageShell>
      <SEOHead
        title={club.name}
        description={`Club de poker ${club.name}. Torneos, calendario y ranking de jugadores. ${club.description ?? ""}`}
        path={`/clubs/${clubSlug}`}
      />
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

          {/* ══ ONBOARDING & CONTACT SECTION ══ */}
          {(hasAnyContact || clubData.tutorial_url) && (
            <div className="mb-8 bg-sk-bg-2 border border-sk-border-2 rounded-lg p-5">
              
              {/* Botón Masivo de Tutorial */}
              {clubData.tutorial_url && (
                <div className={hasAnyContact ? "mb-5 pb-5 border-b border-sk-border-2" : ""}>
                  <h3 className="text-sk-sm font-bold text-sk-text-1 mb-3">🚀 ¿Nuevo en el club?</h3>
                  <a 
                    href={clubData.tutorial_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="group relative w-full flex items-center justify-center gap-2 bg-sk-accent border border-sk-accent text-black hover:bg-sk-accent-hover px-4 py-4 md:py-5 rounded-xl text-sk-sm md:text-sk-base font-black transition-all overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.25)] hover:shadow-[0_0_45px_rgba(34,211,238,0.45)]"
                  >
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    <Gamepad2 size={24} className="animate-pulse" />
                    CÓMO ENTRAR Y JUGAR AQUÍ
                  </a>
                </div>
              )}

              {/* Botones de Contacto Tradicionales */}
              {hasAnyContact && (
                <>
                  <h3 className="text-sk-sm font-bold text-sk-text-1 mb-4">📬 Contactar al club</h3>
                  <div className="flex flex-wrap gap-3">
                    {clubData.whatsapp && (
                      <a href={`https://wa.me/${clubData.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#25D366]/10 border border-[#25D366]/25 text-[#25D366] hover:bg-[#25D366]/20 px-4 py-2.5 rounded-md text-sk-sm font-semibold transition-all">
                        <MessageCircle size={16} /> WhatsApp
                      </a>
                    )}
                    {clubData.email && (
                      <a href={`mailto:${clubData.email}`} className="inline-flex items-center gap-2 bg-sk-accent-dim border border-sk-accent/20 text-sk-accent hover:bg-sk-accent-glow px-4 py-2.5 rounded-md text-sk-sm font-semibold transition-all">
                        <Mail size={16} /> Email
                      </a>
                    )}
                    {clubData.website_url && (
                      <a href={clubData.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white/[0.04] border border-sk-border-2 text-sk-text-2 hover:text-sk-text-1 hover:border-sk-border-3 px-4 py-2.5 rounded-md text-sk-sm font-medium transition-all">
                        <Globe size={16} /> Sitio Web
                      </a>
                    )}
                    {clubData.discord_url && (
                      <a href={clubData.discord_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#5865F2]/10 border border-[#5865F2]/25 text-[#5865F2] hover:bg-[#5865F2]/20 px-4 py-2.5 rounded-md text-sk-sm font-medium transition-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg> Discord
                      </a>
                    )}
                    {clubData.telegram_url && (
                      <a href={clubData.telegram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#0088cc]/10 border border-[#0088cc]/25 text-[#0088cc] hover:bg-[#0088cc]/20 px-4 py-2.5 rounded-md text-sk-sm font-medium transition-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> Telegram
                      </a>
                    )}
                    {clubData.instagram_url && (
                      <a href={clubData.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#E4405F]/10 border border-[#E4405F]/25 text-[#E4405F] hover:bg-[#E4405F]/20 px-4 py-2.5 rounded-md text-sk-sm font-medium transition-all">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg> Instagram
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ LIGAS DEL CLUB ══ */}
          {(activeLeagues.length > 0 || pastLeagues.length > 0) && (
            <div className="mb-8">
              <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">🏆 Ligas del Club</h2>
              
              {activeLeagues.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {activeLeagues.map(l => (
                    <Link key={l.id} to={`/leagues/${l.slug}`} className="block bg-sk-bg-2 border border-sk-border-2 rounded-lg p-4 hover:border-sk-accent transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sk-text-1 line-clamp-1">{l.name}</h4>
                        <Badge variant={l.status === 'active' ? 'green' : 'accent'}>
                          {l.status === 'active' ? 'Activa' : 'Próxima'}
                        </Badge>
                      </div>
                      <p className="font-mono text-[11px] text-sk-text-2">
                        {l.start_date && l.end_date ? `${l.start_date} — ${l.end_date}` : "Fechas por definir"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}

              {/* Acordeón de ligas pasadas */}
              {pastLeagues.length > 0 && (
                <details className="group bg-sk-bg-2 border border-sk-border-2 rounded-lg overflow-hidden transition-all duration-300">
                  <summary className="cursor-pointer p-4 font-semibold text-sk-sm text-sk-text-2 hover:text-sk-text-1 flex justify-between items-center select-none bg-sk-bg-2 hover:bg-white/[0.02]">
                    Ver ligas pasadas ({pastLeagues.length})
                    <ChevronDown size={16} className="text-sk-text-3 group-open:rotate-180 transition-transform duration-200" />
                  </summary>
                  <div className="p-4 border-t border-sk-border-2 bg-sk-bg-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pastLeagues.map(l => (
                      <Link key={l.id} to={`/leagues/${l.slug}`} className="block bg-sk-bg-3 border border-sk-border-2 rounded-md p-3 hover:border-sk-text-3 transition-colors opacity-80 hover:opacity-100">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-semibold text-sk-sm text-sk-text-1 line-clamp-1">{l.name}</h4>
                          <Badge variant="muted">Finalizada</Badge>
                        </div>
                        <p className="font-mono text-[10px] text-sk-text-3">
                          {l.start_date} — {l.end_date}
                        </p>
                      </Link>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* ══ UPCOMING TOURNAMENTS ══ */}
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

          {/* ══ COMPLETED TOURNAMENTS ══ */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-sk-md font-bold text-sk-text-1 mb-4">
                ✅ Torneos Completados ({completed.length})
              </h2>
              <div className="flex flex-col gap-2">
                {completed.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => navigate(`/tournament/${t.slug}`)}
                    className="cursor-pointer"
                  >
                    {/* 🔥 Corrección 2: Eliminamos e.stopPropagation() para respetar la interfaz de TournamentCard */}
                    <TournamentCard
                      tournament={t}
                      onInfoClick={() => setSelectedTournament(t)}
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