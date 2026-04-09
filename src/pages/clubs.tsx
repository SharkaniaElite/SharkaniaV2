// src/pages/clubs.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { Chip } from "../components/ui/chip";
import { Input } from "../components/ui/input";
import { Spinner } from "../components/ui/spinner";
import { useClubs } from "../hooks/use-clubs";
import { FlagIcon } from "../components/ui/flag-icon";
import { SEOHead } from "../components/seo/seo-head";
import { useAuthStore } from "../stores/auth-store";
import { useSharkCoinsBalance } from "../hooks/use-shop";
import { CalendarDays, Trophy, SearchX, Sparkles, Building2 } from "lucide-react";

export function ClubsPage() {
  const [mascotId] = useState(() => Math.floor(Math.random() * 10) + 1);
  const user = useAuthStore((s) => s.user);
  const { data: balance } = useSharkCoinsBalance();
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
          {/* ══ HERO SECTION UNIFICADO ══ */}
          <div className="bg-sk-bg-2 border border-sk-accent/20 rounded-2xl p-6 md:p-10 mb-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group shadow-[0_0_40px_rgba(34,211,238,0.05)]">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-sk-accent/30 to-transparent" />

            <div className="shrink-0 relative z-10">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-sk-accent/10 blur-xl rounded-full scale-150 group-hover:bg-sk-accent/20 transition-colors duration-500" />
                <img
                  src={`/mascot/shark-${mascotId}.webp`}
                  alt="Sharkania Quartermaster"
                  className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left relative z-10">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                <Building2 className="text-sk-accent" size={16} />
                <p className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-sk-accent">
                  RED DE CLUBES ACTIVA
                </p>
                <Sparkles className="text-sk-accent animate-pulse" size={16} />
              </div>

              <h1 className="text-sk-3xl md:text-sk-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-sk-text-1 to-sk-text-4 mb-4 leading-none">
                Directorio Global
              </h1>

              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed">
                <span className="font-mono text-sk-text-1">{filtered.length}</span> clubes verificados en la matriz.
                {isLoading && (
                  <span className="ml-3 font-mono text-[11px] text-sk-accent animate-pulse uppercase tracking-widest">
                    [ Procesando datos... ]
                  </span>
                )}
              </p>
            </div>

            {user && (
              <div className="shrink-0 bg-sk-bg-0/50 backdrop-blur-md border border-sk-border-2 rounded-xl p-5 text-center min-w-[160px] relative z-10 group-hover:border-sk-accent/40 transition-colors">
                <p className="text-[10px] font-mono text-sk-text-3 font-bold uppercase tracking-widest mb-3">
                  Tu Reserva
                </p>
                <div className="flex items-center justify-center gap-2 text-sk-3xl font-black text-sk-accent tracking-tighter leading-none mb-1">
                  {balance ?? 0}
                  <img
                    src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif"
                    alt="SC"
                    className="w-7 h-7 drop-shadow-md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Buscador Integrado */}
          <div className="mb-8 max-w-md">
            <Input
              variant="search"
              placeholder="Buscar en la red de clubes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* 🧠 ENLACES TÁCTICOS */}
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/calendar"
              className="group relative overflow-hidden flex items-center gap-4 p-4 rounded-xl border border-sk-border-2 bg-sk-bg-2/50 backdrop-blur-sm hover:bg-sk-bg-3 hover:border-sk-accent/40 hover:shadow-[0_4px_30px_rgba(34,211,238,0.1)] transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-sk-accent/0 via-sk-accent/5 to-sk-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="w-12 h-12 rounded-lg bg-sk-bg-0 border border-sk-border-2 flex items-center justify-center shrink-0 group-hover:border-sk-accent/50 group-hover:bg-sk-accent/10 transition-colors duration-300 relative z-10">
                <CalendarDays size={20} className="text-sk-accent" />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sk-sm font-extrabold text-sk-text-1 group-hover:text-sk-accent transition-colors truncate tracking-tight">
                  Calendario de Torneos
                </p>
                <p className="text-[11px] text-sk-text-3 mt-0.5 leading-snug">
                  Explora la agenda global en vivo
                </p>
              </div>
            </Link>

            <Link
              to="/ranking"
              className="group relative overflow-hidden flex items-center gap-4 p-4 rounded-xl border border-sk-border-2 bg-sk-bg-2/50 backdrop-blur-sm hover:bg-sk-bg-3 hover:border-sk-gold/40 hover:shadow-[0_4px_30px_rgba(251,191,36,0.1)] transition-all duration-300"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-sk-gold/0 via-sk-gold/5 to-sk-gold/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="w-12 h-12 rounded-lg bg-sk-bg-0 border border-sk-border-2 flex items-center justify-center shrink-0 group-hover:border-sk-gold/50 group-hover:bg-sk-gold/10 transition-colors duration-300 relative z-10">
                <Trophy size={20} className="text-sk-gold" />
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sk-sm font-extrabold text-sk-text-1 group-hover:text-sk-gold transition-colors truncate tracking-tight">
                  Ranking ELO Global
                </p>
                <p className="text-[11px] text-sk-text-3 mt-0.5 leading-snug">
                  Los mejores jugadores del ecosistema
                </p>
              </div>
            </Link>
          </div>

          {/* Clubs grid */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <SearchX className="text-sk-text-4 mb-4 opacity-50" size={48} />
              <h3 className="text-sk-lg font-bold text-sk-text-1 mb-2">Base de datos vacía</h3>
              <p className="text-sk-text-3 text-sk-sm max-w-md mx-auto">
                No se encontraron clubes en la matriz con ese nombre.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((club) => {
                const rooms = club.club_rooms?.map((cr) => cr.poker_rooms?.name).filter(Boolean) ?? [];

                return (
                  <Link
                    key={club.id}
                    to={`/clubs/${club.slug}`}
                    className="relative overflow-hidden bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 cursor-pointer transition-all duration-200 ease-out hover:border-sk-border-3 hover:shadow-sk-md hover:-translate-y-0.5 flex flex-col gap-4 group"
                    style={club.banner_url ? {
                      // Reducimos la opacidad del degradado (de 0.85 a 0.4) para que la imagen brille
                      backgroundImage: `linear-gradient(to bottom, rgba(12,13,16,0.4), rgba(12,13,16,0.9)), url('${club.banner_url.split('#')[0]}')`,
                      backgroundSize: 'cover',
                      // Respetamos la posición guardada
                      backgroundPosition: `center ${club.banner_url.match(/#pos=(\d+)/)?.[1] ?? 50}%`
                    } : undefined}
                  >
                    <div className="relative z-10 flex items-center gap-3">
                      <FlagIcon countryCode={club.country_code} />
                      <div>
                        <h3 className="text-sk-md font-bold text-sk-text-1 tracking-tight group-hover:text-sk-accent transition-colors">
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
                      <p className="relative z-10 text-sk-sm text-sk-text-2 leading-relaxed line-clamp-2">
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