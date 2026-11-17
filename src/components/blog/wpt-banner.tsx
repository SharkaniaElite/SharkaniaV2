// src/components/blog/wpt-banner.tsx
import { useBanners } from "../../hooks/use-banners";
import { useUserCountry } from "../../hooks/use-geo"; 
import type { BannerConfig } from "../../lib/api/site-settings";
import { bannerIsReviewed } from "../../lib/marketing-banner-policy";
import "./article-ads.css";

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
  // Las creatividades permanecen guardadas al desactivar cada espacio desde Super Admin.
  if (slotCfg.enabled === false) return null;
  const defaultBonusCode = banners.bonusCode;
  // Creatividades históricas 'us_src/us_href' no tienen verificación propia.
  // No anunciar a usuarios de EE. UU. hasta validar oferta y elegibilidad.
  const getHref = (banner: BannerConfig) => banner.href;
  const getSrc = (banner: BannerConfig) => banner.src;

  // 🔥 NUEVO: Lógica que lee el texto personalizado del CMS, si no existe usa el general.
  const renderPromoText = (banner: BannerConfig | null) => {
    if (!banner || isUS || banner.partner_id !== "wptglobal") return null;
    
    // Si llenaste el texto personalizado en el Super Admin, lo usamos
    if (banner.custom_code || banner.custom_text) {
      return (
        <>
          {banner.custom_text || "Usa el código"} <span style={{ color: "#22d3ee", fontWeight: 700, marginLeft: "4px" }}>{banner.custom_code}</span>
        </>
      );
    }
    
    // Si está vacío, usa el general por defecto (FPHL)
    if (defaultBonusCode) {
      return (
        <>
          Usa el código <span style={{ color: "#22d3ee", fontWeight: 700, marginLeft: "4px" }}>{defaultBonusCode}</span>
        </>
      );
    }
    
    return null;
  };

  // ── Sidebar (300×250, solo desktop) ──────────────────────
  if (slot === "sidebar") {
    const banner = slotCfg.desktop;
    if (!banner || isUS || !bannerIsReviewed(banner)) return null;

    const promoContent = renderPromoText(banner);

    return (
      <div className={className}>
        <style>{`.wpt-sb{display:none}@media(min-width:1024px){.wpt-sb{display:block}}`}</style>
        <div className="wpt-sb">
          <a
            href={getHref(banner)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label="Promoción Poker"
            style={{ display: "block", lineHeight: 0, borderRadius: "8px", overflow: "hidden" }}
          >
            <img
              src={getSrc(banner)}
              alt="Promoción Poker"
              width={banner.width}
              height={banner.height}
              style={{ display: "block", width: "100%", height: "auto", maxWidth: `${banner.width}px` }}
              loading="lazy"
            />
          </a>
          {promoContent && (
            <p style={{
              marginTop: "6px", fontSize: "10px",
              color: "rgba(161,161,170,0.65)", textAlign: "center",
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em",
            }}>
              {promoContent}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Dos espacios editoriales responsivos: 970×250 / 640×200 ──
  const desktopBanner = !isUS && bannerIsReviewed(slotCfg.desktop) ? slotCfg.desktop : null;
  const mobileBanner = !isUS && bannerIsReviewed(slotCfg.mobile) ? slotCfg.mobile : null;
  if (!desktopBanner && !mobileBanner) return null;

  const activeBanner = desktopBanner || mobileBanner;
  const promoContent = renderPromoText(activeBanner);
  const isNative = (banner: BannerConfig, side: "desktop" | "mobile") =>
    side === "desktop"
      ? banner.width === 970 && banner.height === 250
      : banner.width === 640 && banner.height === 200;

  const renderImage = (banner: BannerConfig, side: "desktop" | "mobile") => (
    <a key={side} href={getHref(banner)} target="_blank" rel="sponsored noopener noreferrer"
      aria-label={banner.editorial_title || banner.label || "Publicidad"}
      className={`shark-article-image-ad shark-article-ad-${side} ${isNative(banner, side) ? "" : "shark-article-ad-legacy"}`}>
      <img src={getSrc(banner)} alt={banner.editorial_title || banner.label || "Publicidad"}
        width={banner.width} height={banner.height} loading="lazy" decoding="async" />
    </a>
  );

  return (
    <aside className={`shark-article-ad shark-article-ad-breakout ${className}`}
      aria-label={slot === "mid" ? "Anuncio intermedio" : "Anuncio al final del artículo"}>
      <span className="shark-article-ad-label">Publicidad</span>
      {desktopBanner && renderImage(desktopBanner, "desktop")}
      {mobileBanner && renderImage(mobileBanner, "mobile")}
      {activeBanner?.source_url && (
        <p className="text-center mt-2 text-[11px] text-sk-text-3">
          Publicidad revisada · <a href={activeBanner.source_url} target="_blank"
            rel="noopener noreferrer" className="underline underline-offset-2 hover:text-sk-accent">
            Condiciones oficiales
          </a>
        </p>
      )}
      {promoContent && <p className="shark-article-ad-code">{promoContent}</p>}
    </aside>
  );
}
