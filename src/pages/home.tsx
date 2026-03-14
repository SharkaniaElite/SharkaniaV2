// src/pages/home.tsx
import { useEffect, useRef } from "react";
import { PageShell } from "../components/layout/page-shell";
import { RevealSection } from "../components/landing/reveal-section";
import { CountdownTimer } from "../components/landing/countdown-timer";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { StatCard } from "../components/ui/stat-card";
import { Chip } from "../components/ui/chip";
import { Input } from "../components/ui/input";
import { cn } from "../lib/cn";
import { GlobalSearch } from "../components/search/global-search";

// ── Mock Data ──

const RANKING_DATA = [
  { rank: 1, initial: "S", flag: "🇧🇷", name: "SharkMaster_BR", elo: "2,487", delta: "+23", deltaDir: "up" as const, tournaments: "342", itm: "28.4%", itmGreen: true },
  { rank: 2, initial: "R", flag: "🇦🇷", name: "RiverKing_AR", elo: "2,451", delta: "+15", deltaDir: "up" as const, tournaments: "289", itm: "26.1%", itmGreen: true },
  { rank: 3, initial: "A", flag: "🇲🇽", name: "AceHunter_MX", elo: "2,398", delta: "-8", deltaDir: "down" as const, tournaments: "415", itm: "24.7%", itmGreen: true },
  { rank: 4, initial: "T", flag: "🇨🇱", name: "TiltProof_CL", elo: "2,356", delta: "+31", deltaDir: "up" as const, tournaments: "198", itm: "22.9%", itmGreen: false },
  { rank: 5, initial: "N", flag: "🇨🇴", name: "NutsHolder_CO", elo: "2,312", delta: "+5", deltaDir: "up" as const, tournaments: "267", itm: "21.3%", itmGreen: false },
  { rank: 6, initial: "B", flag: "🇪🇸", name: "BluffMaster_ES", elo: "2,289", delta: "-12", deltaDir: "down" as const, tournaments: "356", itm: "20.8%", itmGreen: false },
  { rank: 7, initial: "F", flag: "🇵🇪", name: "FoldEquity_PE", elo: "2,245", delta: "+19", deltaDir: "up" as const, tournaments: "178", itm: "19.6%", itmGreen: false },
];

const TOURNAMENT_DATA = [
  { name: "Sunday Million 🦈", buyin: "$5.50", gtd: "$500", status: "live" as const, club: "🇧🇷 Club Tubarão Poker", extra: "Último prize: $423", countdownSec: 872, countdownLabel: "Late reg" },
  { name: "Noche de Grinders", buyin: "$3.30", gtd: "$200", status: "soon" as const, club: "🇦🇷 Buenos Aires Poker Club", extra: "Liga: Copa LATAM S2", time: "22:00 🇦🇷", countdownSec: 4985 },
  { name: "Bounty Hunters 💀", buyin: "$11", gtd: "$1,000", status: "soon" as const, club: "🇲🇽 Azteca Poker League", extra: "Último prize: $892", time: "23:30 🇲🇽", countdownSec: 9912 },
  { name: "Freeroll Comunidad", buyin: "FREE", buyinFree: true, gtd: "$50", status: "soon" as const, club: "🇨🇱 Chile Poker Masters", time: "20:00 🇨🇱", countdownSec: 18750 },
];

const FEATURES = [
  { icon: "📊", title: "Ranking ELO Adaptado", desc: "Sistema de puntuación único que considera buy-in, field size, varianza y rendimiento relativo. No es solo ganar — es contra quién ganas." },
  { icon: "📅", title: "Calendario en Vivo", desc: "Todos los torneos de todos los clubes en un solo lugar. Countdown en vivo, late registration, horarios locales y prize pools." },
  { icon: "🏛️", title: "Clubes & Ligas", desc: "Encuentra clubes por país, sala o tamaño. Únete a ligas con tablas de posiciones, temporadas y premios garantizados." },
  { icon: "⚔️", title: "Comparador de Jugadores", desc: "Enfrenta dos jugadores y analiza su historial ELO, torneos en común, head-to-head y rendimiento comparado." },
  { icon: "🎯", title: "Misiones & Logros", desc: "Gamificación real: completa misiones, gana XP, desbloquea badges y sube de nivel. No solo mires datos — interactúa." },
  { icon: "🔍", title: "Búsqueda Instantánea", desc: "Encuentra cualquier jugador, club, liga o torneo al instante. Los resultados aparecen mientras escribes." },
];

const CLUBS_DATA = [
  { flag: "🇧🇷", name: "Tubarão Poker Club", rooms: ["PPPoker"], desc: "El club de poker online más grande de Brasil. Torneos diarios con garantizados desde $100 hasta $5,000.", players: "1,245", monthly: "89", upcoming: "12" },
  { flag: "🇦🇷", name: "Buenos Aires Poker Club", rooms: ["PokerBros", "ClubGG"], desc: "Comunidad argentina con foco en educación y competencia. Ligas mensuales con sistema de puntos propio.", players: "834", monthly: "56", upcoming: "8" },
  { flag: "🇲🇽", name: "Azteca Poker League", rooms: ["Suprema"], desc: "Liga mexicana con los bounty tournaments más emocionantes. Bounties progresivos y KO especiales.", players: "612", monthly: "42", upcoming: "5" },
];

const COMPARE_ROWS = [
  { label: "Torneos", a: "342", b: "289", aWins: true },
  { label: "ITM %", a: "28.4%", b: "26.1%", aWins: true },
  { label: "ROI", a: "+34.2%", b: "+41.8%", aWins: false },
  { label: "Torneos en común", a: "12", b: "12", aWins: false },
  { label: "Mejor posición H2H", a: "7", b: "5", aWins: true },
];

const ROOMS = ["♠️ PPPoker", "♦️ PokerBros", "♣️ ClubGG", "♥️ Suprema Poker", "🃏 X-Poker", "♠️ Pokerrrr 2"];

// ── Helpers ──

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? "bg-sk-gold-dim text-sk-gold"
      : rank === 2
        ? "bg-[rgba(203,213,225,0.1)] text-sk-silver"
        : rank === 3
          ? "bg-[rgba(217,119,6,0.1)] text-sk-bronze"
          : "text-sk-text-2";
  return (
    <span className={cn("font-mono font-bold text-sk-sm w-7 h-7 inline-flex items-center justify-center rounded-xs", cls)}>
      {rank}
    </span>
  );
}

function SectionHeader({ overline, title, desc }: { overline: string; title: string; desc?: string }) {
  return (
    <div className="text-center mb-12 max-w-[600px] mx-auto px-4">
      <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-3">
        {overline}
      </p>
      <h2 className="text-sk-3xl font-extrabold tracking-tight text-sk-text-1 mb-4">
        {title}
      </h2>
      {desc && <p className="text-sk-md text-sk-text-2 leading-relaxed">{desc}</p>}
    </div>
  );
}

// ── Main Page ──

export function HomePage() {
  const searchRef = useRef<HTMLInputElement>(null);
  

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        const section = searchRef.current?.closest("section");
        if (section) {
          const top = section.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <PageShell>
      {/* ════ HERO ════ */}
      <section className="relative min-h-dvh flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden max-md:min-h-auto max-md:py-16 max-md:pt-[calc(4rem+56px)]">
        {/* BG */}
        <div className="absolute inset-0 -z-20 bg-sk-bg-1" style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 0%, var(--sk-accent-dim), transparent 70%), radial-gradient(ellipse 40% 30% at 70% 80%, var(--sk-purple-dim), transparent 60%), var(--sk-bg-1)"
        }} />
        {/* Grid */}
        <div className="absolute inset-0 -z-10" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
        }} />

        <div className="max-w-[720px]">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 py-1 pl-1 pr-3.5 bg-sk-bg-3 border border-sk-border-2 rounded-full text-[11px] font-medium text-sk-text-2 mb-8 animate-sk-fade-up">
            <span className="px-2 py-0.5 bg-sk-accent-dim text-sk-accent rounded-full font-bold text-[10px] tracking-wide">
              BETA
            </span>
            Plataforma Global de Poker Competitivo
          </div>

          {/* Title */}
          <h1 className="text-sk-hero font-black tracking-[-0.045em] text-sk-text-1 leading-none mb-6 animate-sk-fade-up sk-delay-1">
            Tu ranking ELO.
            <br />
            <span className="bg-gradient-to-br from-sk-accent to-sk-purple bg-clip-text text-transparent">
              Tu legado competitivo.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sk-lg text-sk-text-2 leading-relaxed max-w-[560px] mx-auto animate-sk-fade-up sk-delay-2">
            El primer sistema de ranking ELO diseñado para poker. Rastrea tu rendimiento en torneos, compara jugadores y compite en clubes y ligas de todo el mundo.
          </p>

          {/* Actions */}
          <div className="flex justify-center gap-3 mt-10 flex-wrap animate-sk-fade-up sk-delay-3">
            <a href="#ranking">
              <Button variant="accent" size="xl">🏆 Ver Ranking Global</Button>
            </a>
            <a href="#calendar">
              <Button variant="secondary" size="xl">📅 Calendario de Torneos</Button>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 flex flex-col items-center gap-2 text-sk-text-4 text-[11px] animate-sk-scroll-bounce max-md:hidden">
          <span>Scroll</span>
          <div className="w-px h-6 bg-gradient-to-b from-sk-text-4 to-transparent" />
        </div>
      </section>

      {/* ════ LIVE STATS BAR ════ */}
      <div className="bg-sk-bg-0 border-b border-sk-border-2 py-3 overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex justify-center items-center gap-8 flex-wrap">
            {[
              { label: "Jugadores activos", value: "2,847" },
              { label: "Torneos jugados", value: "12,493" },
              { label: "Clubes registrados", value: "186" },
              { label: "Ligas activas", value: "34" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sk-xs text-sk-text-2">
                <span>{item.label}</span>
                <span className="font-mono font-bold text-sk-text-1">{item.value}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sk-xs text-sk-text-2">
              <Badge variant="live">EN VIVO</Badge>
              <span className="font-mono font-bold text-sk-text-1">7 torneos</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════ COMPATIBLE ROOMS ════ */}
      <section className="py-10 border-b border-sk-border-2">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-center text-[11px] font-semibold tracking-[0.08em] uppercase text-sk-text-2 mb-6">
            Compatible con las mejores salas online
          </p>
          <div className="flex justify-center items-center gap-12 flex-wrap">
            {ROOMS.map((room) => (
              <span key={room} className="font-mono text-sk-sm font-semibold text-sk-text-2 tracking-wide hover:text-sk-text-1 transition-colors duration-sk-fast">
                {room}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════ SEARCH ════ */}
      <section className="py-12" id="search">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col items-center">
          <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent mb-4">
            Búsqueda Instantánea
          </p>
          <GlobalSearch variant="full" />
        </div>
      </section>

      {/* ════ DASHBOARD PREVIEW (Ranking + Calendar) ════ */}
      <section className="py-20 bg-sk-bg-0" id="ranking">
        <div className="max-w-[1300px] mx-auto px-6">
          <RevealSection>
            <SectionHeader
              overline="Ranking ELO Global"
              title="Los mejores jugadores del mundo"
              desc="Un sistema de puntuación único adaptado al poker competitivo. Como el ajedrez, pero diseñado para la varianza del MTT."
            />
          </RevealSection>

          {/* Dashboard frame */}
          <RevealSection>
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden shadow-sk-xl">
              {/* Toolbar */}
              <div className="flex items-center p-3 px-4 border-b border-sk-border-2 gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-sk-red" />
                <div className="w-2.5 h-2.5 rounded-full bg-sk-gold" />
                <div className="w-2.5 h-2.5 rounded-full bg-sk-green" />
                <div className="ml-4 font-mono text-[11px] text-sk-text-4 bg-sk-bg-0 px-3 py-1 rounded-sm border border-sk-border-2 flex-1 max-w-[300px]">
                  sharkania.com/ranking
                </div>
              </div>

              {/* Content: Ranking + Calendar */}
              <div className="grid grid-cols-[1.2fr_1fr] max-lg:grid-cols-1">
                {/* LEFT: Ranking */}
                <div className="p-5 border-r border-sk-border-2 max-lg:border-r-0 max-lg:border-b overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sk-md font-bold text-sk-text-1">🏆 Ranking Global</h3>
                    <div className="flex gap-px bg-sk-bg-0 rounded-md p-0.5 border border-sk-border-2">
                      {["Global", "LATAM", "Europa"].map((tab, i) => (
                        <button
                          key={tab}
                          className={cn(
                            "text-[11px] font-medium px-2.5 py-1 rounded-sm whitespace-nowrap transition-all duration-sk-fast",
                            i === 0
                              ? "bg-sk-bg-3 text-sk-text-1 shadow-sk-xs"
                              : "text-sk-text-2 hover:text-sk-text-1"
                          )}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="rounded-md overflow-hidden">
                    <table className="w-full border-collapse text-sk-sm">
                      <thead>
                        <tr>
                          {["#", "Jugador", "ELO", "Δ", "Torneos", "ITM%"].map((h, i) => (
                            <th
                              key={h}
                              className={cn(
                                "bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 py-3 px-4 border-b border-sk-border-2 whitespace-nowrap",
                                i === 0 && "w-[50px]",
                                i >= 2 && "text-right"
                              )}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {RANKING_DATA.map((p) => (
                          <tr
                            key={p.rank}
                            className={cn(
                              "transition-colors duration-sk-fast hover:bg-white/[0.015]",
                              p.rank === 1 && "bg-[rgba(251,191,36,0.03)]",
                              p.rank === 2 && "bg-[rgba(203,213,225,0.02)]",
                              p.rank === 3 && "bg-[rgba(217,119,6,0.02)]"
                            )}
                          >
                            <td className="py-3 px-4 border-b border-sk-border-2">
                              <RankBadge rank={p.rank} />
                            </td>
                            <td className="py-3 px-4 border-b border-sk-border-2">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-sk-bg-4 border border-sk-border-2 flex items-center justify-center text-[11px] font-bold text-sk-text-3 shrink-0">
                                  {p.initial}
                                </div>
                                <span className="text-sm leading-none">{p.flag}</span>
                                <span className="font-semibold text-sk-text-1">{p.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 border-b border-sk-border-2 text-right">
                              <span className="font-mono font-bold text-sk-accent tracking-tight">{p.elo}</span>
                            </td>
                            <td className="py-3 px-4 border-b border-sk-border-2 text-right">
                              <span className={cn(
                                "font-mono text-[11px] font-semibold py-0.5 px-1.5 rounded-xs",
                                p.deltaDir === "up" ? "text-sk-green bg-sk-green-dim" : "text-sk-red bg-sk-red-dim"
                              )}>
                                {p.delta}
                              </span>
                            </td>
                            <td className="py-3 px-4 border-b border-sk-border-2 text-right text-sk-text-1">
                              {p.tournaments}
                            </td>
                            <td className={cn(
                              "py-3 px-4 border-b border-sk-border-2 text-right font-mono font-semibold",
                              p.itmGreen ? "text-sk-green" : "text-sk-text-2"
                            )}>
                              {p.itm}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-center py-4">
                    <Button variant="ghost" size="sm">Ver ranking completo →</Button>
                  </div>
                </div>

                {/* RIGHT: Calendar */}
                <div className="p-5 overflow-hidden" id="calendar">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sk-md font-bold text-sk-text-1">📅 Próximos Torneos</h3>
                    <Badge variant="live">3 EN VIVO</Badge>
                  </div>

                  <div className="flex flex-col gap-2">
                    {TOURNAMENT_DATA.map((t) => (
                      <div
                        key={t.name}
                        className={cn(
                          "bg-sk-bg-3 border border-sk-border-2 rounded-md p-3 px-4",
                          t.status === "live" && "border-l-2 border-l-sk-green"
                        )}
                      >
                        {/* Row 1: Name + Countdown */}
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-sk-text-1 text-sk-sm">{t.name}</span>
                          {t.status === "live" ? (
                            <Badge variant="live">EN VIVO</Badge>
                          ) : null}
                          {t.status !== "live" && t.countdownSec ? (
                            <CountdownTimer targetSeconds={t.countdownSec} variant="soon" />
                          ) : null}
                        </div>

                        {/* Row 2: Buy-in, GTD, Time/Countdown */}
                        <div className="flex justify-between items-center">
                          <div className="flex gap-4 text-[11px] text-sk-text-2">
                            <span>
                              Buy-in:{" "}
                              <span className={cn("font-mono font-semibold", t.buyinFree ? "text-sk-green" : "text-sk-text-1")}>
                                {t.buyin}
                              </span>
                            </span>
                            <span>
                              GTD:{" "}
                              <span className="font-mono font-bold text-sk-gold">{t.gtd}</span>
                            </span>
                          </div>
                          {t.status === "live" && t.countdownSec ? (
                            <CountdownTimer targetSeconds={t.countdownSec} variant="late" label="Late reg" />
                          ) : t.time ? (
                            <span className="font-mono text-[11px] text-sk-text-1">{t.time}</span>
                          ) : null}
                        </div>

                        {/* Row 3: Club + Extra */}
                        <div className="mt-1 flex justify-between items-center">
                          <a href="#" className="text-[11px] text-sk-accent font-medium hover:opacity-80 transition-opacity">
                            {t.club}
                          </a>
                          {t.extra && (
                            <span className="text-[10px] text-sk-text-2 font-mono">{t.extra}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-center py-4">
                    <Button variant="ghost" size="sm">Ver calendario completo →</Button>
                  </div>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ════ STATS GRID ════ */}
      <section className="py-12 border-b border-sk-border-2">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="ELO Promedio" value="1,247" delta="3.2%" deltaDirection="up" accent="accent" />
              <StatCard label="Prize Pools Totales" value="$847K" delta="12.5%" deltaDirection="up" accent="gold" />
              <StatCard label="Torneos Esta Semana" value="142" delta="8 más" deltaDirection="up" accent="green" />
              <StatCard label="Países Representados" value="23" delta="2 nuevos" deltaDirection="up" />
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ════ FEATURES ════ */}
      <section className="py-20" id="features">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <SectionHeader
              overline="Plataforma Completa"
              title="Todo lo que necesitas en un solo lugar"
              desc="Diseñado por jugadores de poker, para jugadores de poker. Cada feature existe porque resuelve un problema real."
            />
          </RevealSection>

          <RevealSection>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="p-8 bg-sk-bg-2 border border-sk-border-2 rounded-lg transition-all duration-sk-base ease-sk-ease hover:border-sk-border-2 hover:shadow-sk-md hover:-translate-y-0.5"
                >
                  <div className="w-10 h-10 rounded-md bg-sk-bg-4 flex items-center justify-center text-lg mb-5">
                    {f.icon}
                  </div>
                  <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">{f.title}</h3>
                  <p className="text-sk-sm text-sk-text-2 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ════ CLUBS ════ */}
      <section className="py-20 bg-sk-bg-0" id="clubs">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <SectionHeader
              overline="Clubes Activos"
              title="Únete a los mejores clubes"
              desc="Clubes de poker online verificados de toda Latinoamérica y el mundo. Encuentra tu comunidad."
            />
          </RevealSection>

          <RevealSection>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CLUBS_DATA.map((c) => (
                <div
                  key={c.name}
                  className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 cursor-pointer transition-all duration-sk-base ease-sk-ease hover:border-sk-border-3 hover:shadow-sk-md hover:-translate-y-0.5 flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl leading-none">{c.flag}</span>
                    <div>
                      <h3 className="text-sk-md font-bold text-sk-text-1 tracking-tight">{c.name}</h3>
                      <div className="flex gap-2 mt-1">
                        {c.rooms.map((r) => <Chip key={r}>{r}</Chip>)}
                      </div>
                    </div>
                  </div>
                  <p className="text-sk-sm text-sk-text-2 leading-relaxed line-clamp-2">{c.desc}</p>
                  <div className="flex gap-6 flex-wrap">
                    {[
                      { val: c.players, label: "Jugadores" },
                      { val: c.monthly, label: "Torneos/mes" },
                      { val: c.upcoming, label: "Próximos" },
                    ].map((m) => (
                      <div key={m.label}>
                        <div className="font-mono text-sk-sm font-bold text-sk-text-1">{m.val}</div>
                        <div className="text-[11px] text-sk-text-2">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </RevealSection>

          <RevealSection className="text-center mt-8">
            <Button variant="secondary" size="lg">Ver todos los clubes →</Button>
          </RevealSection>
        </div>
      </section>

      {/* ════ HOW IT WORKS ════ */}
      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <SectionHeader overline="Cómo Funciona" title="De torneo a ranking en 3 pasos" />
          </RevealSection>

          <RevealSection>
            <div className="flex gap-8 relative pt-4 max-md:flex-col max-md:gap-4">
              {/* Connector line */}
              <div className="absolute top-6 left-6 right-6 h-px bg-sk-border-1 max-md:hidden" />

              {[
                { n: "01", title: "Un club sube resultados", desc: "El admin del club carga los resultados del torneo desde su panel de administración." },
                { n: "02", title: "ELO se calcula", desc: "Nuestro algoritmo procesa el resultado considerando field, buy-in, varianza y fuerza del campo." },
                { n: "03", title: "Rankings se actualizan", desc: "El ranking global y de liga se actualizan al instante. Tu posición refleja tu verdadero nivel." },
              ].map((step) => (
                <div key={step.n} className="flex-1 text-center relative z-[1]">
                  <div className="w-12 h-12 rounded-full bg-sk-bg-4 border-2 border-sk-border-3 flex items-center justify-center font-mono font-extrabold text-sk-md text-sk-accent mx-auto mb-4">
                    {step.n}
                  </div>
                  <h4 className="font-bold text-sk-sm text-sk-text-1 mb-2">{step.title}</h4>
                  <p className="text-sk-xs text-sk-text-2 leading-relaxed max-w-[200px] mx-auto">{step.desc}</p>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ════ COMPARATOR ════ */}
      <section className="py-20 bg-sk-bg-0" id="compare">
        <div className="max-w-[900px] mx-auto px-6">
          <RevealSection>
            <SectionHeader
              overline="Head to Head"
              title="Compara jugadores"
              desc="Enfrenta a dos jugadores y descubre quién domina en los números. ELO, ITM, ROI y torneos en común."
            />
          </RevealSection>

          <RevealSection>
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 overflow-hidden">
              {/* VS Header */}
              <div className="grid grid-cols-[1fr_60px_1fr] gap-4 items-center">
                {/* Player A */}
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-accent flex items-center justify-center text-sk-xl font-extrabold text-sk-accent mx-auto mb-3">S</div>
                  <div className="font-bold text-sk-text-1 text-sk-md">🇧🇷 SharkMaster_BR</div>
                  <div className="font-mono text-sk-accent font-bold text-sk-lg mt-2">2,487</div>
                  <div className="text-[11px] text-sk-text-2">ELO Rating</div>
                </div>

                {/* VS */}
                <div className="text-center">
                  <div className="text-sk-2xl font-black text-sk-text-3 tracking-tight">VS</div>
                </div>

                {/* Player B */}
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-sk-bg-4 border-2 border-sk-purple flex items-center justify-center text-sk-xl font-extrabold text-sk-purple mx-auto mb-3">R</div>
                  <div className="font-bold text-sk-text-1 text-sk-md">🇦🇷 RiverKing_AR</div>
                  <div className="font-mono text-sk-purple font-bold text-sk-lg mt-2">2,451</div>
                  <div className="text-[11px] text-sk-text-2">ELO Rating</div>
                </div>
              </div>

              {/* Divider */}
              <div className="w-full h-px my-6 bg-gradient-to-r from-transparent via-sk-accent-dim to-transparent" />

              {/* Comparison rows */}
              <div className="flex flex-col gap-0.5">
                {COMPARE_ROWS.map((row) => (
                  <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center py-2">
                    <div className={cn("text-right font-mono font-bold", row.aWins ? "text-sk-green" : "text-sk-text-1")}>
                      {row.a}
                    </div>
                    <div className="text-[11px] text-sk-text-2 text-center min-w-[100px]">
                      {row.label}
                    </div>
                    <div className={cn("font-mono font-bold", !row.aWins ? "text-sk-green" : "text-sk-text-1")}>
                      {row.b}
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center pt-4">
                <Button variant="accent" size="lg">⚔️ Comparar jugadores</Button>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ════ LEAGUES ════ */}
      <section className="py-20" id="leagues">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <SectionHeader
              overline="Ligas Activas"
              title="Compite en ligas organizadas"
              desc="Temporadas con tabla de posiciones, puntos de liga y premios. Encuentra tu próximo desafío."
            />
          </RevealSection>

          <RevealSection>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* League 1 */}
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 border-t-2 border-t-sk-gold flex flex-col gap-4 cursor-pointer hover:border-sk-border-3 hover:shadow-sk-md hover:-translate-y-0.5 transition-all duration-sk-base">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sk-md font-bold text-sk-text-1 tracking-tight">🏆 Copa LATAM Season 2</h3>
                    <div className="font-mono text-[11px] text-sk-text-2 mt-1">
                      📅 Mar 2025 — Jun 2025 · 🇦🇷 Buenos Aires Poker Club
                    </div>
                  </div>
                  <Badge variant="green">Activa</Badge>
                </div>
                <div className="flex gap-6 flex-wrap">
                  {[
                    { val: "245", label: "Jugadores" },
                    { val: "18/24", label: "Torneos" },
                    { val: "$2,400", label: "Prize Pool" },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="font-mono text-sk-sm font-bold text-sk-text-1">{m.val}</div>
                      <div className="text-[11px] text-sk-text-2">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Chip>PokerBros</Chip>
                  <Chip>NLH</Chip>
                  <Chip>MTT</Chip>
                </div>
              </div>

              {/* League 2 */}
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-lg p-6 border-t-2 border-t-sk-purple flex flex-col gap-4 cursor-pointer hover:border-sk-border-3 hover:shadow-sk-md hover:-translate-y-0.5 transition-all duration-sk-base">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sk-md font-bold text-sk-text-1 tracking-tight">🌎 Circuito Iberoamericano</h3>
                    <div className="font-mono text-[11px] text-sk-text-2 mt-1">
                      📅 Ene 2025 — Dic 2025 · Multi-Club
                    </div>
                  </div>
                  <Badge variant="green">Activa</Badge>
                </div>
                <div className="flex gap-6 flex-wrap">
                  {[
                    { val: "892", label: "Jugadores" },
                    { val: "6/12", label: "Etapas" },
                    { val: "$12,000", label: "Prize Pool" },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="font-mono text-sk-sm font-bold text-sk-text-1">{m.val}</div>
                      <div className="text-[11px] text-sk-text-2">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Chip>PPPoker</Chip>
                  <Chip>ClubGG</Chip>
                  <Chip>NLH + PLO</Chip>
                </div>
              </div>
            </div>
          </RevealSection>

          <RevealSection className="text-center mt-8">
            <Button variant="secondary" size="lg">Ver todas las ligas →</Button>
          </RevealSection>
        </div>
      </section>

      {/* ════ FOR CLUBS ════ */}
      <section className="py-20 bg-sk-bg-0">
        <div className="max-w-[1200px] mx-auto px-6">
          <RevealSection>
            <SectionHeader
              overline="Para Clubes & Organizadores"
              title="Haz crecer tu club con Sharkania"
              desc="Herramientas profesionales para gestionar tu club, crear ligas y atraer jugadores de todo el mundo."
            />
          </RevealSection>

          <RevealSection>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: "🎛️", title: "Panel de Administración", desc: "Crea y gestiona torneos, sube resultados, configura ligas y personaliza tu club desde un dashboard intuitivo." },
                { icon: "📈", title: "Ranking Personalizable", desc: "Crea sistemas de puntos propios para tus ligas. Simple o complejo — tú decides cómo se calculan los puntos." },
                { icon: "🌍", title: "Visibilidad Global", desc: "Tu club aparece en el calendario global. Jugadores de todo el mundo pueden encontrarte y unirse a tus torneos." },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-8 bg-sk-bg-2 border border-sk-border-2 rounded-lg transition-all duration-sk-base ease-sk-ease hover:border-sk-border-2 hover:shadow-sk-md hover:-translate-y-0.5"
                >
                  <div className="w-10 h-10 rounded-md bg-sk-bg-4 flex items-center justify-center text-lg mb-5">
                    {f.icon}
                  </div>
                  <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">{f.title}</h3>
                  <p className="text-sk-sm text-sk-text-2 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </RevealSection>

          <RevealSection className="text-center mt-8">
            <Button variant="primary" size="xl">🏛️ Registrar mi Club</Button>
          </RevealSection>
        </div>
      </section>

      {/* ════ CTA FINAL ════ */}
      <section className="py-16 px-6 bg-sk-bg-0 border-t border-sk-border-2 text-center">
        <RevealSection className="max-w-[600px] mx-auto">
          <div className="text-5xl mb-4">🦈</div>
          <h2 className="text-sk-2xl font-extrabold text-sk-text-1 tracking-tight mb-3">
            Empieza a construir tu legado
          </h2>
          <p className="text-sk-md text-sk-text-2 mb-8">
            Únete a miles de jugadores que ya están rankeados en Sharkania. Gratis para siempre. Premium para los que quieren más.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="accent" size="xl">Crear cuenta gratis</Button>
            <Button variant="secondary" size="xl">Registrar mi club</Button>
          </div>
          <p className="mt-4 text-[11px] text-sk-text-3">
            No se requiere tarjeta de crédito · Gratis para siempre · Setup en 2 minutos
          </p>
        </RevealSection>
      </section>
    </PageShell>
  );
}
