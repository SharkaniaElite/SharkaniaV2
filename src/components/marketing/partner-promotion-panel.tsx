import { ArrowUpRight, ShieldCheck } from "lucide-react";
import type { BlogPost } from "../../lib/api/blog";
import { getPartnerBrand, getPromotionPartner, getPromotionTag } from "./promotion-artwork";

function isoToday(): string {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => p.find(x => x.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const ALLOWED_HOSTS = {
  coinpoker: ["record.coinpokeraffiliates.com"],
  wptglobal: ["tracking.wptpartners.com"],
  ignition: ["record.revenuenetwork.com"],
};

/** Solo promociones verificadas de su misma sala; jamás anuncios generales dentro de artículos comerciales. */
export function PartnerPromotionPanel({ post }: { post: BlogPost }) {
  const partner = getPromotionPartner(post.tags);
  if (post.category !== "Promociones" || !partner) return null;
  const checked = getPromotionTag(post.tags, "verified-on:");
  const reviewBy = getPromotionTag(post.tags, "review-by:");
  const officialEnd = getPromotionTag(post.tags, "official-end:");
  const today = isoToday();
  if (!checked || (reviewBy && today > reviewBy) || (officialEnd && today > officialEnd)) return null;
  const brand = getPartnerBrand(partner);
  const link = post.body.find((b) => {
    if (b.type !== "button" || !b.value || !b.content?.includes("(afiliado)")) return false;
    try {
      const url = new URL(b.value);
      return url.protocol === "https:" && ALLOWED_HOSTS[partner].includes(url.hostname);
    } catch {
      return false;
    }
  })?.value;
  if (!link) return null;
  return (
    <aside className="my-10 overflow-hidden rounded-2xl border border-sk-accent/25 bg-[#0b1720] shadow-sm">
      <div className="relative grid sm:grid-cols-[1fr_auto] gap-6 items-center px-6 py-7 sm:px-8">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_95%_0%,rgba(34,211,238,0.12),transparent_65%)]" />
        <div className="relative flex items-start gap-4">
          <div className="flex items-center justify-center w-16 h-16 shrink-0 rounded-xl bg-black/50 border border-white/10 p-2">
            <img src={brand.logo} alt={`Logo de ${brand.name}`} loading="lazy" decoding="async" className="max-w-full max-h-full object-contain" />
          </div>
          <div>
            <p className="text-[10px] tracking-[0.12em] uppercase font-mono text-sk-accent font-semibold mb-1">Colaboración comercial</p>
            <h3 className="text-base sm:text-lg font-bold text-sk-text-1">Continúa con {brand.name}</h3>
            <p className="text-xs sm:text-sm text-sk-text-3 mt-1 leading-relaxed">
              Consulta la elegibilidad de tu país y los requisitos oficiales antes de participar.
            </p>
          </div>
        </div>
        <a href={link} target="_blank" rel="sponsored noopener noreferrer"
          className="relative inline-flex items-center justify-center gap-2 rounded-lg bg-sk-accent text-sk-bg-0 hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sk-accent font-bold text-sm px-5 py-3.5 transition-colors">
          Ir a {brand.name} <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </div>
      <div className="flex items-start gap-2 border-t border-white/10 bg-black/20 px-6 sm:px-8 py-3 text-[11px] text-sk-text-3">
        <ShieldCheck size={14} className="shrink-0 text-sk-accent" aria-hidden="true" />
        <span>Sharkania puede recibir una comisión. La verificación editorial no garantiza resultados ni sustituye los términos de la sala.</span>
      </div>
    </aside>
  );
}
