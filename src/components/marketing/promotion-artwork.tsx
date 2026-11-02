// Sistema visual editorial de promociones. Las marcas se cargan desde los archivos originales,
// nunca desde logos recreados con IA ni desde banners genéricos de otra sala.
import type { BlogPost } from "../../lib/api/blog";

type PromoPost = Pick<BlogPost, "title" | "slug" | "category" | "tags" | "image_thumbnail" | "image_hero">;
export type PartnerId = "coinpoker" | "wptglobal" | "ignition";

const LOGO_ROOT = "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/";
const PARTNERS: Record<PartnerId, { name: string; logo: string; subtitle: string }> = {
  coinpoker: { name: "CoinPoker", logo: LOGO_ROOT + "coinpoker.png", subtitle: "Póker online" },
  wptglobal: { name: "WPT Global", logo: LOGO_ROOT + "wptglobal.png", subtitle: "Póker y torneos" },
  ignition: { name: "Ignition Poker", logo: LOGO_ROOT + "logo-ignition-poker.png", subtitle: "Póker online" },
};

export function getPromotionTag(tags: string[] | null | undefined, prefix: string): string | undefined {
  return tags?.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
}

export function getPromotionPartner(tags: string[] | null | undefined): PartnerId | null {
  const id = getPromotionTag(tags, "partner:");
  return id && Object.prototype.hasOwnProperty.call(PARTNERS, id) ? id as PartnerId : null;
}

export function getPartnerBrand(id: PartnerId) {
  return PARTNERS[id];
}

function tagline(post: PromoPost): { kicker: string; focus: string } {
  if (post.slug === "coinpoker-bono-bienvenida-150-2026") {
    return { kicker: "BONO DE BIENVENIDA", focus: "150% · hasta US$2.000" };
  }
  if (post.slug === "coinpoker-pgt-kickoff-noviembre-2026") {
    return { kicker: "PGT KICKOFF", focus: "8–30 NOV 2026" };
  }
  if (post.slug === "wpt-global-paquete-bienvenida-2026") {
    return { kicker: "NUEVOS JUGADORES", focus: "Bienvenida WPT Global" };
  }
  return { kicker: "PROMOCIONES SHARKANIA", focus: "Revisa las condiciones" };
}

type Props = { post: PromoPost; variant?: "card" | "hero" | "compact"; className?: string; priority?: boolean };

export function PromotionArtwork({ post, variant = "card", className = "", priority = false }: Props) {
  const partnerId = getPromotionPartner(post.tags);
  const brand = partnerId ? PARTNERS[partnerId] : null;
  const source = variant === "hero" ? (post.image_hero || post.image_thumbnail) : (post.image_thumbnail || post.image_hero);
  const isHero = variant === "hero";
  if (source) {
    // El contenedor debe disponer de altura propia: una imagen absoluta no la aporta.
    // En artículos, el hero reserva un espacio 2:1; en tarjetas ocupa el alto del slot.
    return (
      <div className={`relative overflow-hidden bg-sk-bg-3 ${isHero ? "w-full aspect-[2/1]" : "w-full h-full"} ${className}`}>
        <img src={source} alt={post.title} loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined} decoding="async"
          width={isHero ? 1200 : 640} height={isHero ? 600 : 360}
          className="absolute inset-0 w-full h-full object-cover" />
      </div>
    );
  }
  const copy = tagline(post);
  return (
    <div role="img" aria-label={`Gráfica de ${post.title}`}
      className={`relative isolate overflow-hidden bg-[#070f18] text-white ${className}`}>
      {/* Composición vectorial sin descarga adicional: destellos, mesa y fichas. */}
      <div aria-hidden="true" className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 79% 45%,rgba(34,211,238,.18),transparent 48%),linear-gradient(118deg,#07131c 10%,#0b2632 57%,#050b13 100%)" }} />
      <div aria-hidden="true" className="absolute -right-[10%] -top-[48%] w-[77%] aspect-square rounded-full border border-cyan-400/20 rotate-[-20deg]" />
      <div aria-hidden="true" className="absolute -right-[19%] top-[19%] w-[63%] aspect-square rounded-full border-[3px] border-cyan-500/25 shadow-[0_0_55px_rgba(34,211,238,.2)]" />
      <div aria-hidden="true" className="absolute right-[12%] top-[13%] w-[31%] aspect-square rounded-full bg-[#112635] border-[9px] border-[#405866] shadow-[12px_15px_30px_rgba(0,0,0,.65),inset_0_0_16px_rgba(34,211,238,.25)] rotate-12">
        <div className="absolute inset-[13%] rounded-full border-[5px] border-cyan-300/40 bg-[radial-gradient(circle_at_32%_28%,#365c72,#091520_73%)]" />
      </div>
      <div aria-hidden="true" className="absolute right-[6%] bottom-[5%] w-[31%] h-[11%] rounded-[50%] border-[7px] border-[#516875] bg-[#07151b] rotate-[-16deg] opacity-90" />
      <div aria-hidden="true" className="absolute right-[30%] bottom-[8%] w-[22%] h-[9%] rounded-[50%] border-[5px] border-[#597687] bg-[#07151b] rotate-[15deg] opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050b13]/65 via-[#07131c]/15 to-transparent" aria-hidden="true" />
      <div className={`relative z-10 flex flex-col justify-center ${isHero ? "min-h-[290px] sm:min-h-[360px] px-7 sm:px-12 py-9" : variant === "compact" ? "min-h-[148px] px-4 py-4" : "min-h-[188px] sm:min-h-[205px] px-5 sm:px-7 py-5"}`}>
        <div className="flex items-center gap-2.5 mb-3">
          {brand ? <span className="flex items-center justify-center rounded-lg bg-[#061018]/85 border border-white/10 p-1.5 w-14 h-11 shrink-0">
            <img src={brand.logo} alt={`Logo original de ${brand.name}`} loading={priority ? "eager" : "lazy"}
              decoding="async" className="max-w-full max-h-full object-contain" />
          </span> : <span className="w-1 h-8 bg-sk-accent rounded-full" aria-hidden="true" />}
          <span className="text-[10px] sm:text-[11px] text-white/85 font-bold tracking-[0.12em] uppercase">{brand?.name || "Sharkania"}</span>
        </div>
        <span className={`font-mono uppercase tracking-[0.14em] text-cyan-300 font-semibold ${isHero ? "text-xs sm:text-sm mb-2" : "text-[9px] sm:text-[10px] mb-1"}`}>{copy.kicker}</span>
        <strong className={`block max-w-[69%] text-white font-black tracking-tight leading-[1.05] ${isHero ? "text-3xl sm:text-5xl" : variant === "compact" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"}`}>{copy.focus}</strong>
        <span className="mt-4 h-[2px] w-20 bg-gradient-to-r from-sk-accent to-transparent" aria-hidden="true" />
        {isHero && <span className="text-xs mt-4 text-white/65">Condiciones y elegibilidad según país · +18</span>}
      </div>
    </div>
  );
}
