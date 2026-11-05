import { useEffect, useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { ArenaPageHero } from "../components/arena/arena-page-hero";
import { SEOHead } from "../components/seo/seo-head";
import { Link } from "react-router-dom";
import { Gift, ArrowRight, Clock } from "lucide-react";
import { supabase } from "../lib/supabase"; // Importación de DB agregada
import { formatBlogDate } from "../lib/api/blog"; // 👈 Importamos el formateador
import { PromotionArtwork } from "../components/marketing/promotion-artwork";
import { ArenaFeaturedPromo } from "../components/marketing/arena-featured-promo";


function promoTag(promo: { tags?: string[] | null }, prefix: string): string | undefined {
  return promo.tags?.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
}
function promoPhase(promo: { tags?: string[] | null }, today: string): "verified" | "upcoming" | "past" {
  const verified = promoTag(promo, "verified-on:");
  if (!verified) return "past"; // No transformar una fecha de publicación antigua en vigencia.
  const deadline = promoTag(promo, "review-by:");
  const officialEnd = promoTag(promo, "official-end:");
  if ((deadline && today > deadline) || (officialEnd && today > officialEnd)) return "past";
  const startsOn = promoTag(promo, "starts-on:");
  return startsOn && today < startsOn ? "upcoming" : "verified";
}

export function PromotionsPage() {
  const [promotions, setPromotions] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [clubStats, setClubStats] = useState<{ bbjClp: number; lastUpdate: string } | null>(null);
  // Mismo origen que la guía ClubGG; actualizar al entrar y recuperar foco.
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const { data, error } = await supabase.from("site_settings")
        .select("value").eq("key", "latin_club_stats").maybeSingle();
      if (!mounted) return;
      const value = data?.value as {bbjClp?: unknown; lastUpdate?: unknown} | undefined | null;
      if (!error && value && typeof value.bbjClp === "number" && Number.isFinite(value.bbjClp) && value.bbjClp >= 0)
        setClubStats({ bbjClp: value.bbjClp, lastUpdate: typeof value.lastUpdate === "string" ? value.lastUpdate : "" });
      else setClubStats(null);
    };
    void refresh();
    const onFocus = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { mounted = false; window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, []);

  // Formato ISO YYYY-MM-DD en la zona horaria editorial de Sharkania.
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => dateParts.find((entry) => entry.type === type)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const currentPromos = promotions.filter((promo) => promoPhase(promo, today) !== "past");

  const archivePromos = promotions.filter((promo) => promoPhase(promo, today) === "past");
  const featuredSlugs = ["coinpoker-bono-bienvenida-150-2026", "wpt-global-paquete-bienvenida-2026"];
  const verifiedPartnerPosts = featuredSlugs.map(slug => currentPromos.find(p => p.slug === slug)).filter(Boolean);
  const remainingCurrent = currentPromos.filter(p => !featuredSlugs.includes(p.slug));
  const publicAsset = (bucket: string, name: string) => supabase.storage.from(bucket).getPublicUrl(name).data.publicUrl;
  const logoIgnition = publicAsset("Logos Sharkania", "logo-ignition-poker.png");
  const logoClubggLatin = publicAsset("img_clubs", "logoLAP-clubbgg.png");
  const logoLatin = publicAsset("img_clubs", "LatinAllinPoker.webp");
  const logoCoinpoker = publicAsset("Logos Sharkania", "coinpoker.png");
  const logoWpt = publicAsset("Logos Sharkania", "wptglobal.png");
  const isLeagueInWindow = today >= "2026-11-05" && today <= "2026-11-26";

  useEffect(() => {
    // Definimos la función asíncrona
    const fetchPromos = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("category", "Promociones")
        .eq("published", true)
        .order("published_at", { ascending: false });
      
      setPromotions(data || []);
      setLoading(false); // Lo manejamos aquí directamente
    };

    // La ejecutamos
    fetchPromos();
  }, []);

  return (
    <PageShell variant="arena" showMarketing>
      <SEOHead
        title="Liga SHARKANIA, ClubGG y promociones de póker"
        description="Liga SHARKANIA en Ignition Poker, jackpot del Club Latin Allin Póker en ClubGG y ofertas revisadas de CoinPoker y WPT Global. Revisa condiciones."
        path="/promociones"
      />
      
      <div className="arena-public-bridge arena-promo-hub">
        <div className="arena-bridge-content">
          
          <ArenaPageHero
            section="promotions"
            eyebrow="PROMOCIONES / PÓKER ONLINE"
            heading="PROMOCIONES"
            highlight="DE PÓKER."
            icon={Gift}
            description="Liga SHARKANIA en Ignition, jackpot Latin Allin Póker en ClubGG y promociones revisadas de CoinPoker y WPT Global."
            count={loading ? undefined : currentPromos.length}
            countLabel="Ofertas y eventos revisados"
            action={<Link to="/noticias">Ver actualidad del póker <ArrowRight size={15} /></Link>}
          />
          <p className="arena-bridge-disclosure">
            Algunas publicaciones corresponden a campañas anteriores; su fecha de publicación no acredita que la oferta siga vigente. Los enlaces comerciales pueden generar una comisión para Sharkania.
          </p>
          <div className="arena-bridge-section-intro"><div><span className="arena-bridge-kicker">PROMOCIONES / CONDICIONES</span><h2>Promociones destacadas de SHARKANIA</h2><p>Ignition Poker y Latin Allin Póker encabezan nuestras alianzas; CoinPoker y WPT Global siguen con revisión editorial.</p></div></div>

          <div className="arena-bridge-grid grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <ArenaFeaturedPromo number={1} tone="orange" brand="Ignition Poker" logo={logoIgnition}
              kicker="LIGA OFICIAL · SHARKANIA" title="Liga SHARKANIA · noviembre 2026"
              description="Cuatro jueves de póker en Ignition: 5, 12, 19 y 26 de noviembre, 21:00 h Chile. Buy-in US$3,30 y US$100 garantizados por fecha."
              detail={<p className="text-xs leading-relaxed text-slate-200">Ranking mensual, puntos dobles el 26 de noviembre y premios adicionales sujetos a inscripción y verificación.</p>}
              footnote="Consulta las bases oficiales, las contraseñas y la elegibilidad antes de participar."
              href="/ignition" cta={isLeagueInWindow ? "Inscripción y acceso" : "Consultar la liga"} />
            <ArenaFeaturedPromo number={2} tone="cyan" brand="ClubGG · Latin Allin Póker"
              logo={logoClubggLatin} secondaryLogo={logoLatin} kicker="CLUB RECOMENDADO"
              title="Jackpot cash game · Latin Allin Póker"
              description="Mesas de cash game en ClubGG. Consulta el Bad Beat Jackpot informado por Latin Allin Póker y cómo incorporarte al club."
              detail={clubStats ? <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">Jackpot informado · CLP</span>
                <strong className="mt-1 block text-2xl font-black tabular-nums text-white">{new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(clubStats.bbjClp)}</strong>
                {clubStats.lastUpdate && <span className="mt-1 block text-xs text-slate-300">Última actualización indicada: {clubStats.lastUpdate}</span>}
              </div> : <p className="text-xs text-slate-300">Consulta en la guía del club el jackpot actualizado.</p>}
              footnote="Monto sujeto a actualización y reglas del club; no implica premio garantizado."
              href="/como-jugar-en-clubgg" cta="Cómo jugar en ClubGG" />
            {verifiedPartnerPosts.map(promo => {
              const coin = promo.slug === "coinpoker-bono-bienvenida-150-2026";
              return <ArenaFeaturedPromo key={promo.id} number={coin ? 3 : 4} tone={coin ? "violet" : "gold"}
                brand={coin ? "CoinPoker" : "WPT Global"} logo={coin ? logoCoinpoker : logoWpt}
                kicker="OFERTA CON REVISIÓN EDITORIAL"
                title={promo.title} description={promo.excerpt}
                cover={promo.image_thumbnail ?? undefined}
                footnote={`Revisión: ${promoTag(promo,"verified-on:") ?? "pendiente"}. Consulta los requisitos oficiales y la disponibilidad en tu país.`}
                href={`/promociones/${promo.slug}`} cta="Ver condiciones" />;
            })}
            {loading && <div role="status" className="p-6 text-sm text-slate-300">Cargando ofertas verificadas…</div>}
          </div>
          {!loading && verifiedPartnerPosts.length < 2 && <p className="mt-5 text-sm text-slate-300">Las ofertas de CoinPoker y WPT Global sin revisión vigente no se presentan como promociones activas.</p>}
          {!loading && remainingCurrent.length > 0 && <section className="mt-12" aria-label="Otros eventos revisados">
            <div className="arena-bridge-section-intro"><div><span className="arena-bridge-kicker">OTROS EVENTOS</span><h2>Más eventos revisados</h2><p>Consulta sus fechas y condiciones específicas.</p></div></div>
            <div className="arena-bridge-grid grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {remainingCurrent.map(promo => <Link key={promo.id} to={`/promociones/${promo.slug}`} className="arena-bridge-card group flex flex-col">
                <div className="h-40 overflow-hidden"><PromotionArtwork post={promo} variant="card" className="h-full w-full" /></div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">{promoPhase(promo,today)==="upcoming"?"Próximamente":"Revisión vigente"}</p>
                  <h3 className="text-lg font-extrabold text-white">{promo.title}</h3>
                  <p className="flex-1 text-sm text-slate-300">{promo.excerpt}</p>
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-cyan-200">Ver detalles <ArrowRight size={15}/></span>
                </div></Link>)}
            </div>
          </section>}
          {!loading && archivePromos.length > 0 && (
            <section className="mt-16" aria-label="Promociones anteriores sin vigencia confirmada">
              <h2 className="text-xl font-bold text-sk-text-1 mb-2">Publicaciones anteriores</h2>
              <p className="text-sm text-sk-text-3 mb-5">Archivo editorial: estos artículos NO acreditan promociones vigentes. Una revisión pendiente o una fecha de campaña superada impide mostrarlos como ofertas verificadas.</p>
              <div className="grid md:grid-cols-2 gap-3">
                {archivePromos.map((promo) => (
                  <Link key={promo.id} to={`/promociones/${promo.slug}`}
                    className="flex gap-3 items-start rounded-lg border border-sk-border-2 bg-sk-bg-2 p-4 hover:border-sk-accent/40">
                    <Clock size={16} className="text-sk-text-3 shrink-0 mt-1" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-sk-text-2">{promo.title}</span>
                      <span className="block mt-1 text-xs text-sk-text-3">Histórico · Vigencia no confirmada · {formatBlogDate(promo.published_at)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </PageShell>
  );
}