import { useQuery } from "@tanstack/react-query";
import type { BannerConfig, BannersConfig } from "../../lib/api/site-settings";
import { useBannersWithStatus } from "../../hooks/use-banners";
import { supabase } from "../../lib/supabase";
import { bannerIsExternal, bannerIsReviewed } from "../../lib/marketing-banner-policy";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import posthog from "posthog-js";

const OFFICIAL_LOGOS: Record<"coinpoker" | "wptglobal" | "ignition" | "latinallin", string> = {
  coinpoker: "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/coinpoker.png",
  wptglobal: "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/wptglobal.png",
  ignition: "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/logo-ignition-poker.png",
  latinallin: "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/img_clubs/logoLAP-clubbgg.png",
};

const FEATURED_IGNITION: BannerConfig = {
  src: OFFICIAL_LOGOS.ignition,
  href: "/ignition",
  width: 728,
  height: 90,
  label: "Ignition Poker · Liga SHARKANIA",
  partner_id: "ignition",
  editorial_title: "Liga SHARKANIA · Ignition Poker",
  editorial_description: "Jueves 5, 12, 19 y 26 de noviembre · 21:00 Chile",
  verified_on: "2026-11-05",
  review_by: "2026-11-27",
  source_url: "https://sharkania.com/noticias/bases-oficiales-liga-sharkania-noviembre-2026",
};

const FEATURED_LATINALLIN: BannerConfig = {
  src: OFFICIAL_LOGOS.latinallin,
  href: "/como-jugar-en-clubgg",
  width: 728,
  height: 90,
  label: "ClubGG · Latin Allin Póker · jackpot",
  partner_id: "latinallin",
  editorial_title: "ClubGG · Latin Allin Póker",
  editorial_description: "Jackpot en mesas de cash game · consulta el monto del club",
  verified_on: "2026-11-05",
  review_by: "2026-12-05",
  source_url: "https://sharkania.com/como-jugar-en-clubgg",
};

type Placement = "featured_ignition" | "featured_latinallin" | "super_left" | "super_right";
type Highlight = { slot: Placement; config: BannerConfig };
type Jackpot = { bbjClp: number; lastUpdate: string } | null;

async function fetchLatinJackpot(): Promise<Jackpot> {
  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "latin_club_stats").maybeSingle();
  const value = data?.value as { bbjClp?: unknown; lastUpdate?: unknown } | null | undefined;
  if (error || !value || typeof value.bbjClp !== "number" || !Number.isFinite(value.bbjClp) || value.bbjClp < 0) return null;
  return { bbjClp: value.bbjClp, lastUpdate: typeof value.lastUpdate === "string" ? value.lastUpdate : "" };
}

function featuredBanners(): Highlight[] {
  return ([
    { slot: "featured_ignition", config: FEATURED_IGNITION },
    { slot: "featured_latinallin", config: FEATURED_LATINALLIN },
  ] as Highlight[]).filter(({ config }) => bannerIsReviewed(config));
}

function additionalBanners(banners: BannersConfig): Highlight[] {
  return (["super_left", "super_right"] as const).flatMap((slot) => {
    const pair = banners.slots[slot];
    const reviewedDesktop = bannerIsReviewed(pair?.desktop) ? pair.desktop! : null;
    const reviewedMobile = bannerIsReviewed(pair?.mobile) ? pair.mobile! : null;
    const config = reviewedDesktop || reviewedMobile;
    if (!config || config.partner_id === "ignition" || config.partner_id === "latinallin") return [];
    return [{ slot, config }];
  });
}

function BannerTile({ item, order, jackpot, compact = false }: {
  item: Highlight; order: number; jackpot?: Jackpot; compact?: boolean;
}) {
  const { slot, config } = item;
  const external = bannerIsExternal(config.href);
  const logo = config.partner_id ? OFFICIAL_LOGOS[config.partner_id] : config.src;
  return (
    <article data-banner-order={order} data-banner-partner={config.partner_id || slot}
      className="relative flex h-[105px] min-w-0 items-stretch overflow-hidden rounded-xl border border-sk-border-2 bg-sk-bg-2">
      <div className="flex w-[84px] shrink-0 flex-col items-center justify-center gap-1 border-r border-sk-border-2 bg-[#070d15] p-2 sm:w-[106px]">
        <img src={logo} loading="lazy" decoding="async" width={100} height={65}
          alt={config.partner_id === "latinallin" ? "ClubGG y Latin Allin Póker" : config.partner_id ? `Logo de ${config.partner_id}` : ""}
          className={config.partner_id === "latinallin" ? "max-h-[39px] max-w-full object-contain" : "max-h-[58px] max-w-full object-contain"} />
        {config.partner_id === "latinallin" && (
          <img src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/img_clubs/LatinAllinPoker.webp"
            alt="Latin Allin Póker" width={90} height={25} loading="lazy" decoding="async"
            className="max-h-[25px] max-w-full object-contain" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
        <span className="text-[9px] font-mono uppercase tracking-wide text-sk-accent">Contenido comercial</span>
        <h3 className="line-clamp-2 text-[13px] font-bold leading-tight text-sk-text-1 sm:text-sm">
          {config.editorial_title || "Ver promoción"}
        </h3>
        <p className="truncate text-[10px] text-sk-text-3 sm:text-[11px]">
          {config.partner_id === "latinallin" && jackpot
            ? `Jackpot informado: ${new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(jackpot.bbjClp)}${!compact && jackpot.lastUpdate ? ` · ${jackpot.lastUpdate}` : ""}`
            : config.editorial_description || "Consulta los requisitos y condiciones"}
        </p>
        <div className="flex items-center gap-3">
          <a href={config.href} target={external ? "_blank" : undefined}
            rel={external ? "sponsored noopener noreferrer" : undefined}
            onClick={() => posthog.capture("partner_promotion_click", {
              placement: slot, destination_host: new URL(config.href, "https://sharkania.com").hostname,
              destination_type: external ? "partner" : "internal", partner: config.partner_id || "unknown",
            })}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-sk-accent hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sk-accent">
            Ver detalles <ArrowUpRight size={12} aria-hidden="true" />
          </a>
          {config.source_url && <a href={config.source_url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-sk-text-3 underline underline-offset-2 hover:text-sk-text-1">Condiciones</a>}
        </div>
      </div>
    </article>
  );
}

/**
 * Cabecera: una única fila compacta. Móvil = carrusel táctil con los cuatro,
 * desktop = solo dos socios prioritarios para dejar protagonismo al ranking.
 * CoinPoker/WPT se conservan en la sección intermedia del inicio.
 */
export function VerifiedBannerStrip({ banners, loading = false }: { banners: BannersConfig; loading?: boolean }) {
  const { data: jackpot } = useQuery({
    queryKey: ["latin-club-stats"], queryFn: fetchLatinJackpot,
    enabled: true, staleTime: 60_000, refetchInterval: 300_000, refetchOnWindowFocus: true,
  });

  const highlights = [...featuredBanners(), ...additionalBanners(banners)];
  if (!highlights.length && !loading) return null;

  return (
    <section aria-label="Promociones comerciales revisadas" aria-busy={loading}
      className="border-b border-sk-border-2 bg-sk-bg-0 py-2.5" data-promotion-banner-layout="compact">
      <div className="mx-auto max-w-[1520px] px-3 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-wide text-sk-text-3">
          <span className="flex items-center gap-1.5"><ShieldCheck size={12} aria-hidden="true" /> Alianzas del circuito · +18</span>
          <span className="hidden md:block">Publicidad · Condiciones según sala y país</span>
          <span className="md:hidden">Desliza para ver las cuatro <span aria-hidden="true">→</span></span>
        </div>
        <div className="-mr-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-3 touch-pan-x md:mr-0 md:grid md:grid-cols-2 md:overflow-visible md:pr-0"
          role="region" aria-label="Banners de socios, desliza horizontalmente en móvil" tabIndex={0}>
          {highlights.map((item, index) => (
            <div key={item.slot} className={`w-[85%] shrink-0 snap-start sm:w-[62%] md:w-full md:min-w-0 ${index >= 2 ? "md:hidden" : ""}`}>
              <BannerTile item={item} order={index + 1} jackpot={jackpot} />
            </div>
          ))}
          {loading && highlights.length < 4 && Array.from({ length: 4 - highlights.length }, (_, index) =>
            <div key={`loading-${index}`} className="h-[105px] w-[85%] shrink-0 snap-start rounded-xl border border-sk-border-2 bg-sk-bg-2 sm:w-[62%] md:hidden" aria-hidden="true" />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Solo en la portada, después de ranking y agenda: preserva CoinPoker/WPT
 * sin convertir la primera pantalla de SHARKANIA en un panel publicitario.
 */
export function VerifiedSecondaryBannerStrip() {
  const { banners, loading } = useBannersWithStatus();
  const extra = additionalBanners(banners);
  if (!extra.length && !loading) return null;
  return (
    <aside className="hidden border-y border-sk-border-2 bg-sk-bg-0/80 py-5 md:block"
      aria-label="Otros socios y promociones revisadas" data-promotion-banner-layout="midpage">
      <div className="mx-auto max-w-[1200px] px-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-sk-text-3">Otras promociones revisadas</span>
          <span className="text-[10px] text-sk-text-3">Publicidad · Condiciones por sala y país</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {extra.map((item, index) =>
            <BannerTile key={item.slot} item={item} order={index + 3} compact />
          )}
          {loading && !extra.length && [0, 1].map((n) =>
            <div key={n} className="h-[105px] rounded-xl border border-sk-border-2 bg-sk-bg-2" aria-hidden="true" />
          )}
        </div>
      </div>
    </aside>
  );
}
