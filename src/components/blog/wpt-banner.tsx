// src/components/blog/wpt-banner.tsx
import { useBanners } from "../../hooks/use-banners";
import { useUserCountry } from "../../hooks/use-geo"; // 👈 El Radar
import type { BannerConfig } from "../../lib/api/site-settings";

type BannerSlot = "mid" | "final" | "sidebar";

interface WptBannerProps {
  slot: BannerSlot;
  className?: string;
}

export function WptBanner({ slot, className = "" }: WptBannerProps) {
  const banners  = useBanners();
  const countryCode = useUserCountry();
  const isUS = countryCode === "US"; // 🇺🇸 Condición mágica

  const slotCfg  = banners.slots[slot];
  const bonusCode = banners.bonusCode;

  // Helpers que deciden qué enlace/imagen mostrar
  const getHref = (b: BannerConfig) => (isUS && b.us_href) ? b.us_href : b.href;
  const getSrc = (b: BannerConfig) => (isUS && b.us_src) ? b.us_src : b.src;

  // ── Sidebar (300×250, solo desktop) ──────────────────────
  if (slot === "sidebar") {
    const banner = slotCfg.desktop;
    if (!banner) return null;

    return (
      <div className={className}>
        <style>{`.wpt-sb{display:none}@media(min-width:1024px){.wpt-sb{display:block}}`}</style>
        <div className="wpt-sb">
          <a
            href={getHref(banner)} // 👈 URL Inteligente
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label="Promoción Poker"
            style={{ display: "block", lineHeight: 0, borderRadius: "8px", overflow: "hidden" }}
          >
            <img
              src={getSrc(banner)} // 👈 Imagen Inteligente
              alt="Promoción Poker"
              width={banner.width}
              height={banner.height}
              style={{ display: "block", width: "100%", height: "auto", maxWidth: `${banner.width}px` }}
              loading="lazy"
            />
          </a>
          {bonusCode && !isUS && (
            <p style={{
              marginTop: "6px", fontSize: "10px",
              color: "rgba(161,161,170,0.65)", textAlign: "center",
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em",
            }}>
              Código: <span style={{ color: "#22d3ee", fontWeight: 700 }}>{bonusCode}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Inline (mid / final) ──────────────────────────────────
  const desktopBanner = slotCfg.desktop as BannerConfig | null;
  const mobileBanner  = slotCfg.mobile  as BannerConfig | null;
  if (!desktopBanner && !mobileBanner) return null;

  const s = slot;

  return (
    <div className={className} style={{ width: "100%", margin: "2.5rem 0" }}>
      <style>{`
        .wpt-${s}-label{display:block;font-size:9px;font-family:'JetBrains Mono',monospace;color:rgba(113,113,122,0.55);text-align:right;margin-bottom:4px;letter-spacing:0.08em;text-transform:uppercase;line-height:1}
        .wpt-${s}-a{display:block;line-height:0;border-radius:10px;overflow:hidden;outline:1px solid rgba(34,211,238,0.10);transition:outline-color .25s ease,box-shadow .25s ease}
        .wpt-${s}-a:hover{outline-color:rgba(34,211,238,0.30);box-shadow:0 0 28px rgba(34,211,238,0.10)}
        .wpt-${s}-d{display:block}.wpt-${s}-m{display:none}
        @media(max-width:767px){.wpt-${s}-d{display:none}.wpt-${s}-m{display:block}}
        .wpt-${s}-code{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:8px;font-size:11px;font-family:'JetBrains Mono',monospace;color:rgba(161,161,170,0.60);line-height:1}
        .wpt-${s}-code strong{color:#22d3ee;font-weight:700}
      `}</style>

      <small className={`wpt-${s}-label`}>Publicidad {isUS && "🇺🇸"}</small>

      {desktopBanner && (
        <a href={getHref(desktopBanner)} target="_blank" rel="noopener noreferrer sponsored"
          aria-label="Promo" className={`wpt-${s}-a wpt-${s}-d`}>
          <img src={getSrc(desktopBanner)} alt="Promo"
            width={desktopBanner.width} height={desktopBanner.height}
            style={{ display: "block", width: "100%", height: "auto", maxWidth: `${desktopBanner.width}px`, margin: "0 auto" }}
            loading="lazy" />
        </a>
      )}

      {mobileBanner && (
        <a href={getHref(mobileBanner)} target="_blank" rel="noopener noreferrer sponsored"
          aria-label="Promo" className={`wpt-${s}-a wpt-${s}-m`}>
          <img src={getSrc(mobileBanner)} alt="Promo"
            width={mobileBanner.width} height={mobileBanner.height}
            style={{ display: "block", width: "100%", height: "auto" }}
            loading="lazy" />
        </a>
      )}

      {bonusCode && !isUS && (
        <p className={`wpt-${s}-code`}>
          Usa el código <strong>{bonusCode}</strong> al registrarte
        </p>
      )}
    </div>
  );
}