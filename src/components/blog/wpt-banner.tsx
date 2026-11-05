// src/components/blog/wpt-banner.tsx
import { useBanners } from "../../hooks/use-banners";
import { useUserCountry } from "../../hooks/use-geo"; 
import type { BannerConfig } from "../../lib/api/site-settings";
import { bannerIsReviewed } from "../../lib/marketing-banner-policy";

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

  // ── Inline (mid / final) ──────────────────────────────────
  const desktopBanner = !isUS && bannerIsReviewed(slotCfg.desktop) ? slotCfg.desktop : null;
  const mobileBanner  = !isUS && bannerIsReviewed(slotCfg.mobile) ? slotCfg.mobile : null;
  if (!desktopBanner && !mobileBanner) return null;

  const s = slot;
  const activeBanner = desktopBanner || mobileBanner; // Leemos la config del activo
  const promoContent = renderPromoText(activeBanner);

  return (
    <div className={className} style={{ width: "100%", margin: "2.5rem 0" }}>
      <style>{`
        .wpt-${s}-label{display:block;font-size:9px;font-family:'JetBrains Mono',monospace;color:rgba(113,113,122,0.55);text-align:right;margin-bottom:4px;letter-spacing:0.08em;text-transform:uppercase;line-height:1}
        .wpt-${s}-a{display:block;width:100%;line-height:0;border-radius:10px;overflow:hidden;outline:1px solid rgba(34,211,238,0.10);transition:outline-color .25s ease,box-shadow .25s ease;background:#0b1520}
        .wpt-${s}-a:hover{outline-color:rgba(34,211,238,0.30);box-shadow:0 0 28px rgba(34,211,238,0.10)}
        .wpt-${s}-d{display:block;max-width:728px;aspect-ratio:728/90;margin:0 auto}.wpt-${s}-m{display:none;max-width:320px;aspect-ratio:320/100;margin:0 auto}
        @media(max-width:767px){.wpt-${s}-d{display:none}.wpt-${s}-m{display:block}}
        .wpt-${s}-code{display:flex;align-items:center;justify-content:center;margin-top:8px;font-size:11px;font-family:'JetBrains Mono',monospace;color:rgba(161,161,170,0.60);line-height:1}
      `}</style>

      <small className={`wpt-${s}-label`}>Publicidad {isUS && "🇺🇸"}</small>

      {desktopBanner && (
        <a href={getHref(desktopBanner)} target="_blank" rel="noopener noreferrer sponsored"
          aria-label={desktopBanner.editorial_title || "Publicidad"} className={`wpt-${s}-a wpt-${s}-d`}>
          <img src={getSrc(desktopBanner)} alt="Promo"
            width={728} height={90}
            style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
            loading="lazy" />
        </a>
      )}

      {mobileBanner && (
        <a href={getHref(mobileBanner)} target="_blank" rel="noopener noreferrer sponsored"
          aria-label={mobileBanner.editorial_title || "Publicidad"} className={`wpt-${s}-a wpt-${s}-m`}>
          <img src={getSrc(mobileBanner)} alt="Promo"
            width={320} height={100}
            style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
            loading="lazy" />
        </a>
      )}

      {activeBanner?.source_url && <p className="text-center mt-2 text-[11px] text-sk-text-3">
        Publicidad revisada · <a href={activeBanner.source_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-sk-accent">Condiciones oficiales</a>
      </p>}

      {promoContent && (
        <p className={`wpt-${s}-code`}>
          {promoContent}
        </p>
      )}
    </div>
  );
}