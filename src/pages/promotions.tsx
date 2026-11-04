import { useEffect, useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { ArenaPageHero } from "../components/arena/arena-page-hero";
import { SEOHead } from "../components/seo/seo-head";
import { Link } from "react-router-dom";
import { Gift, ArrowRight, Zap, Clock } from "lucide-react"; // 👈 Añadimos Clock
import { cn } from "../lib/cn";
import { supabase } from "../lib/supabase"; // Importación de DB agregada
import { formatBlogDate } from "../lib/api/blog"; // 👈 Importamos el formateador
import { PromotionArtwork } from "../components/marketing/promotion-artwork";


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

  // Formato ISO YYYY-MM-DD en la zona horaria editorial de Sharkania.
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => dateParts.find((entry) => entry.type === type)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const currentPromos = promotions.filter((promo) => promoPhase(promo, today) !== "past");
  const archivePromos = promotions.filter((promo) => promoPhase(promo, today) === "past");

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
        title="Promociones de póker verificadas"
        description="Promociones de póker verificadas, condiciones de bonos y próximos torneos. Consulta la fecha de revisión, requisitos y disponibilidad por país."
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
            description="Consulta campañas, beneficios y eventos publicados por Sharkania. Diferenciamos las ofertas revisadas del archivo histórico y recomendamos comprobar siempre las condiciones oficiales."
            count={loading ? undefined : currentPromos.length}
            countLabel="Ofertas y eventos revisados"
            action={<Link to="/noticias">Ver actualidad del póker <ArrowRight size={15} /></Link>}
          />
          <p className="arena-bridge-disclosure">
            Algunas publicaciones corresponden a campañas anteriores; su fecha de publicación no acredita que la oferta siga vigente. Los enlaces comerciales pueden generar una comisión para Sharkania.
          </p>
          <div className="arena-bridge-section-intro"><div><span className="arena-bridge-kicker">PROMOCIONES / CONDICIONES</span><h2>Ofertas verificadas y próximos eventos</h2><p>Información editorial basada en las fechas y condiciones registradas.</p></div></div>
          <div className="arena-bridge-grid grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full text-center text-sk-text-3 py-10">
                <div className="w-6 h-6 border-2 border-sk-accent/30 border-t-sk-accent rounded-full animate-spin mx-auto mb-3" />
                Cargando promociones...
              </div>
            ) : currentPromos.length === 0 ? (
              <div className="col-span-full text-center text-sk-text-3 py-10">
                No hay ofertas actualmente verificadas para mostrar. Estamos preparando nuevas páginas con fuentes oficiales; las publicaciones anteriores están archivadas más abajo.
              </div>
            ) : (
              currentPromos.map((promo) => (
                <Link 
                  key={promo.id} 
                  to={`/promociones/${promo.slug}`}
                  className="arena-bridge-card group flex flex-col hover:border-sk-accent/40 transition-colors duration-200"
                >
                  <div className="h-48 sm:h-52 overflow-hidden relative border-b border-sk-border-2">
                    {/* Etiqueta superior izquierda */}
                    <div className={cn(
                      "absolute top-3 left-3 z-10 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded",
                      "bg-sk-bg-0/85 text-sk-accent border border-sk-accent/30 backdrop-blur-sm"
                    )}>
                      {promo.category}
                    </div>
                    
                    <div className="absolute inset-0 overflow-hidden">
                      <PromotionArtwork post={promo} variant="card" className="w-full h-full group-hover:scale-[1.025] transition-transform duration-500" />
                    </div>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1">
                    {/* 🔥 NUEVO: Fecha de publicación y tiempo de lectura */}
                    <div className="flex items-center gap-2 mb-3 text-[10px] font-mono text-sk-text-4 uppercase tracking-widest">
                      <span>{formatBlogDate(promo.published_at)}</span>
                      <span className="opacity-50">•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {promo.read_time ?? 3} min
                      </span>
                    </div>

                    <h3 className={cn(
                      "text-xl font-bold text-sk-text-1 mb-2 transition-colors line-clamp-2",
                      promo.slug === "ignition-bonus" 
                        ? "group-hover:text-sk-accent" 
                        : "group-hover:text-sk-accent"
                    )}>
                      {promo.title}
                    </h3>
                    <p className="text-sk-sm text-sk-text-3 mb-6 flex-1 line-clamp-3">
                      {promo.excerpt}
                    </p>
                    
                    <div className="flex items-center justify-between border-t border-sk-border-2 pt-4 mt-auto">
                      <span className="text-[11px] font-mono text-sk-green flex items-center gap-1.5 uppercase font-bold">
                        <Zap size={14} /> {promoPhase(promo, today) === "upcoming" ? "Próximamente" : "Verificada"}
                      </span>
                      <span className={cn(
                        "text-sk-sm font-bold flex items-center gap-1",
                        "text-sk-accent"
                      )}>
                        Ver detalles <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
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