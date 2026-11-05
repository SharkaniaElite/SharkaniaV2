import type { BannersConfig, BannerConfig } from "../../lib/api/site-settings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { isArenaPreviewHost } from "../../lib/arena-preview";
import { bannerIsExternal, bannerIsReviewed } from "../../lib/marketing-banner-policy";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import posthog from "posthog-js";
const OFFICIAL_LOGOS: Record<"coinpoker" | "wptglobal" | "ignition" | "latinallin", string> = {
  coinpoker: "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/coinpoker.png",
  wptglobal: "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/wptglobal.png",
  ignition: "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/logo-ignition-poker.png",
  latinallin: "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/img_clubs/logoLAP-clubbgg.png",
};


// Solo el preview muestra la futura configuración. Producción sigue leyendo
// site_settings.banners; en el lanzamiento se actualizarán ambos slots con aprobación.
const PREVIEW_SUPER_LEFT: BannerConfig = {
  src: OFFICIAL_LOGOS.ignition,
  href: "/ignition",
  width: 728, height: 90,
  label: "Ignition Poker · Liga SHARKANIA",
  partner_id: "ignition",
  editorial_title: "Liga SHARKANIA · Ignition Poker",
  editorial_description: "Jueves 5, 12, 19 y 26 de noviembre · 21:00 Chile",
  verified_on: "2026-11-05",
  review_by: "2026-11-27",
  source_url: "https://sharkania.com/noticias/bases-oficiales-liga-sharkania-noviembre-2026",
};
const PREVIEW_SUPER_RIGHT: BannerConfig = {
  src: OFFICIAL_LOGOS.latinallin,
  href: "/como-jugar-en-clubgg",
  width: 728, height: 90,
  label: "ClubGG · Latin Allin Póker · jackpot",
  partner_id: "latinallin",
  editorial_title: "ClubGG · Latin Allin Póker",
  editorial_description: "Jackpot en mesas de cash game · consulta el monto del club",
  verified_on: "2026-11-05",
  review_by: "2026-12-05",
  source_url: "https://sharkania.com/como-jugar-en-clubgg",
};
type Highlight = { slot: "super_left" | "super_right"; config: BannerConfig; mobile: BannerConfig | null };
type Jackpot = { bbjClp: number; lastUpdate: string } | null;
async function fetchLatinJackpot(): Promise<Jackpot> {
  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "latin_club_stats").maybeSingle();
  const value = data?.value as { bbjClp?: unknown; lastUpdate?: unknown } | null | undefined;
  if (error || !value || typeof value.bbjClp !== "number" || !Number.isFinite(value.bbjClp) || value.bbjClp < 0) return null;
  return { bbjClp: value.bbjClp, lastUpdate: typeof value.lastUpdate === "string" ? value.lastUpdate : "" };
}

export function VerifiedBannerStrip({ banners, loading = false }: { banners: BannersConfig; loading?: boolean }) {
  const showPreviewPriority = isArenaPreviewHost();
  const latinConfigured = banners.slots.super_right.desktop?.partner_id === "latinallin"
    || banners.slots.super_right.mobile?.partner_id === "latinallin";
  const { data: jackpot } = useQuery({
    queryKey: ["latin-club-stats"],
    queryFn: fetchLatinJackpot,
    enabled: showPreviewPriority || latinConfigured,
    staleTime: 60_000,
    refetchInterval: 300_000,
    refetchOnWindowFocus: true,
  });
  const highlights: Highlight[] = (["super_left", "super_right"] as const).flatMap((slot) => {
    const previewConfig = slot === "super_left" ? PREVIEW_SUPER_LEFT : PREVIEW_SUPER_RIGHT;
    const pair = showPreviewPriority
      ? { desktop: previewConfig, mobile: { ...previewConfig, width: 320, height: 100 } }
      : banners.slots[slot];
    const desktop = pair?.desktop;
    const mobile = pair?.mobile;
    const reviewedDesktop = bannerIsReviewed(desktop) ? desktop! : null;
    const reviewedMobile = bannerIsReviewed(mobile) ? mobile! : null;
    const current = reviewedDesktop || reviewedMobile;
    return current ? [{ slot, config: current, mobile: reviewedMobile }] : [];
  });
  if (!highlights.length && !loading) return null;

  return (
    <section aria-label="Promociones comerciales revisadas"
      aria-busy={loading}
      className="border-b border-sk-border-2 bg-sk-bg-0 py-3 sm:py-4 min-h-[167px] sm:min-h-[180px]">
      {loading && !highlights.length ? (
        <div aria-hidden="true" className="max-w-[1520px] mx-auto px-3 sm:px-5">
          <div className="h-3 w-44 rounded bg-sk-bg-3/70 mb-3" />
          <div className="h-[112px] md:h-[118px] grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-sk-border-2 bg-sk-bg-2" />
            <div className="hidden sm:block rounded-xl border border-sk-border-2 bg-sk-bg-2" />
          </div>
        </div>
      ) : (
      <div className="max-w-[1520px] mx-auto px-3 sm:px-5">
        <div className="flex items-center justify-between gap-3 mb-2.5 text-[10px] font-mono uppercase tracking-[0.08em] text-sk-text-3">
          <span className="flex items-center gap-1.5"><ShieldCheck size={13} aria-hidden="true" /> Promociones revisadas · +18</span>
          <span className="hidden sm:block">Publicidad · Condiciones según la sala y el país</span>
        </div>
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 sm:overflow-visible sm:grid sm:grid-cols-2">
          {highlights.map(({ slot, config }) => {
            const external = bannerIsExternal(config.href);
            return (
              <article key={slot} className="relative snap-start shrink-0 w-[88%] sm:w-full sm:min-w-0 h-[112px] md:h-[118px] rounded-xl border border-sk-border-2 bg-sk-bg-2 overflow-hidden flex items-stretch">
                <div className="flex w-[100px] sm:w-[120px] shrink-0 flex-col items-center justify-center gap-1 border-r border-sk-border-2 bg-[#070d15] p-3">
                  <img
                    src={OFFICIAL_LOGOS[config.partner_id || ""] || config.src}
                    alt={config.partner_id === "latinallin" ? "Logo original de ClubGG y Latin Allin Póker" : config.partner_id ? `Logo oficial de ${config.partner_id}` : ""}
                    width={120} height={90}
                    loading="lazy" decoding="async"
                    className={config.partner_id === "latinallin" ? "max-h-[44px] max-w-full object-contain" : "max-h-[65px] max-w-full object-contain"}
                  />
                  {config.partner_id === "latinallin" && (
                    <img src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/img_clubs/LatinAllinPoker.webp"
                      alt="Latin Allin Póker" loading="lazy" decoding="async"
                      className="max-h-[29px] max-w-full object-contain" />
                  )}
                </div>
                <div className="relative min-w-0 flex-1 flex flex-col justify-center gap-1 px-3 sm:px-4 py-2.5">
                  <span className="text-[9px] font-mono uppercase tracking-wide text-sk-accent">Contenido comercial</span>
                  <h2 className="text-sm sm:text-base font-bold text-sk-text-1 leading-tight line-clamp-2">{config.editorial_title || "Ver oferta"}</h2>
                  <p className="text-[10px] sm:text-xs text-sk-text-3 line-clamp-1">
                    {config.partner_id === "latinallin" && jackpot
                      ? `Jackpot informado: ${new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(jackpot.bbjClp)}${jackpot.lastUpdate ? ` · ${jackpot.lastUpdate}` : ""}`
                      : config.editorial_description || "Consulta los requisitos oficiales"}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <a href={config.href} target={external ? "_blank" : undefined}
                      onClick={() => posthog.capture("partner_promotion_click", {
                        placement: slot,
                        destination_host: new URL(config.href, "https://sharkania.com").hostname,
                        destination_type: external ? "partner" : "internal",
                        partner: config.partner_id || "unknown",
                      })}
                      rel={external ? "sponsored noopener noreferrer" : undefined}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sk-accent hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sk-accent">
                      Ver detalles <ArrowUpRight size={13} aria-hidden="true"/>
                    </a>
                    <a href={config.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-sk-text-3 underline underline-offset-2 hover:text-sk-text-1">
                      Condiciones
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      )}
    </section>
  );
}
