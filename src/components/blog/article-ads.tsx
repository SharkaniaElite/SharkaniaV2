import type { BlogPost } from "../../lib/api/blog";
import { useBanners } from "../../hooks/use-banners";
import { bannerIsReviewed } from "../../lib/marketing-banner-policy";
import "./article-ads.css";

const IGNITION_LEAGUE_SLUG = "liga-sharkania-noviembre-2026-fechas-puntos-premios-ignition";
const IGNITION_BASES_SLUG = "bases-oficiales-liga-sharkania-noviembre-2026";

export function isIgnitionBasesArticle(post: Pick<BlogPost, "slug"> | null | undefined): boolean {
  return post?.slug === IGNITION_BASES_SLUG;
}

export function isIgnitionSponsoredArticle(post: Pick<BlogPost, "slug"> | null | undefined): boolean {
  return isIgnitionLeagueArticle(post) || isIgnitionBasesArticle(post);
}

/** La noticia de las Bases tiene cuatro creatividades editoriales propias,
 * no hereda los dos slots comerciales generales de la Liga. */
export function IgnitionBasesBanner({ slot }: { slot: "mid" | "final" }) {
  const path = "/images/banners/ignition-bases-";
  const desktop = `${path}${slot}-desktop-728x90.svg`;
  const mobile = `${path}${slot}-mobile-320x100.svg`;
  return (
    <aside className="shark-article-ad" aria-label="Publicidad informativa de Ignition Poker y SHARKANIA">
      <span className="shark-article-ad-label">Publicidad · Ignition Poker</span>
      <a className="shark-article-bases-banner" href="/ignition" rel="sponsored" aria-label="Consultar inscripción y condiciones de Ignition Poker">
        <picture>
          <source media="(max-width: 767px)" srcSet={mobile} type="image/svg+xml" />
          <img src={desktop} alt={slot === "mid" ? "Liga SHARKANIA: bases oficiales e Ignition Poker" : "Ignition Poker: cuenta verificada y premios adicionales SHARKANIA"} loading="lazy" decoding="async" width={728} height={90} />
        </picture>
      </a>
    </aside>
  );
}

const IGNITION_LOGO = "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/logo-ignition-poker.png";

/** Solo este anuncio de liga bloquea cualquier mezcla con anuncios de otras salas. */
export function isIgnitionLeagueArticle(post: Pick<BlogPost, "slug"> | null | undefined): boolean {
  return post?.slug === IGNITION_LEAGUE_SLUG;
}

/** Creatividad editorial propia, sin promesas comerciales ni reutilizar ofertas caducadas. */
export function IgnitionArticleBanner({ slot }: { slot: "mid" | "final" }) {
  const config = useBanners().slots[slot === "mid" ? "ignition_article_mid" : "ignition_article_final"];
  const desktop = config.desktop;
  const mobile = config.mobile;
  const approvedPair = desktop?.partner_id === "ignition" && mobile?.partner_id === "ignition"
    && desktop.width === 728 && desktop.height === 90
    && mobile.width === 320 && mobile.height === 100
    && bannerIsReviewed(desktop) && bannerIsReviewed(mobile);

  if (approvedPair && desktop && mobile) {
    return (
      <aside className="shark-article-ad" aria-label="Publicidad de Ignition Poker">
        <span className="shark-article-ad-label">Publicidad · Ignition Poker</span>
        <a className="shark-article-ignition-upload-desktop" href={desktop.href}
          target="_blank" rel="sponsored noopener noreferrer" aria-label={desktop.editorial_title || "Información de Ignition Poker"}>
          <img src={desktop.src} alt={desktop.editorial_title || "Publicidad de Ignition Poker"} width={728} height={90} loading="lazy" decoding="async" />
        </a>
        <a className="shark-article-ignition-upload-mobile" href={mobile.href}
          target="_blank" rel="sponsored noopener noreferrer" aria-label={mobile.editorial_title || "Información de Ignition Poker"}>
          <img src={mobile.src} alt={mobile.editorial_title || "Publicidad de Ignition Poker"} width={320} height={100} loading="lazy" decoding="async" />
        </a>
      </aside>
    );
  }

  return (
    <aside className="shark-article-ad" aria-label={`Espacio patrocinado por Ignition Poker, ${slot === "mid" ? "intermedio" : "final"}`}>
      <span className="shark-article-ad-label">Publicidad · Ignition Poker</span>
      <a className="shark-ignition-ad shark-ignition-ad-desktop"
        href="/ignition" rel="sponsored" aria-label="Ignition Poker: información de la Liga SHARKANIA y requisitos para participar">
        <span className="shark-ignition-ad-brand">
          <img src={IGNITION_LOGO} alt="Ignition Poker" width={184} height={52} loading="lazy" decoding="async" />
        </span>
        <span className="shark-ignition-ad-message">
          <strong>LIGA SHARKANIA</strong>
          <small>Cuatro jueves · noviembre 2026 · +18</small>
        </span>
        <span className="shark-ignition-ad-action">Información de la liga <span aria-hidden="true">↗</span></span>
      </a>
      <a className="shark-ignition-ad shark-ignition-ad-mobile"
        href="/ignition" rel="sponsored" aria-label="Ignition Poker: consulta la Liga SHARKANIA y sus condiciones">
        <span className="shark-ignition-ad-mobile-top">
          <img src={IGNITION_LOGO} alt="Ignition Poker" width={112} height={41} loading="lazy" decoding="async" />
          <span className="shark-ignition-ad-mobile-copy"><strong>LIGA SHARKANIA</strong><small>Noviembre 2026 · +18</small></span>
        </span>
        <span className="shark-ignition-ad-mobile-bottom">Información y condiciones <span aria-hidden="true">↗</span></span>
      </a>
    </aside>
  );
}

/**
 * Las creatividades antiguas del CMS son de una sola talla. Se presentan en
 * lienzos responsivos con la relación correcta sin deformarlas ni inventar una
 * versión móvil. Las creatividades nuevas deberán exportarse en ambos tamaños.
 */
export function ArticleImageBanner({ src, href, label }: { src: string; href: string | null; label: string }) {
  if (!src || !href) return null;
  let target: URL;
  let imageUrl: URL;
  try {
    target = new URL(href, "https://sharkania.com");
    imageUrl = new URL(src, "https://sharkania.com");
  } catch { return null; }
  if (!["https:", "http:"].includes(target.protocol) || imageUrl.protocol !== "https:") return null;
  return (
    <aside className="shark-article-ad">
      <span className="shark-article-ad-label">Publicidad</span>
      <a className="shark-article-image-ad" href={target.toString()} target="_blank" rel="sponsored noopener noreferrer" aria-label={label}>
        <img src={imageUrl.toString()} alt={label} loading="lazy" decoding="async" width={728} height={90} />
      </a>
    </aside>
  );
}
