// src/lib/api/site-settings.ts
import { supabase } from "../supabase";

// ── Types ─────────────────────────────────────────────────

export interface BannerConfig {
  src: string;
  href: string;
  width: number;
  height: number;
  label: string;
  us_src?: string;  // 🇺🇸 Imagen USA
  us_href?: string; // 🇺🇸 Link USA
}

export interface BannerSlotConfig {
  desktop: BannerConfig | null;
  mobile: BannerConfig | null;
}

export interface FloatingConfig {
  active?: boolean;
  title?: string;
  description?: string;
  image?: string;
  link?: string;
  delay?: number;
  scrollTrigger?: number;
  us_title?: string;       // 🇺🇸
  us_description?: string; // 🇺🇸
  us_image?: string;       // 🇺🇸
  us_link?: string;        // 🇺🇸
}

export interface BannersConfig {
  bonusCode: string;
  floatingCta?: FloatingConfig;
  slots: {
    mid: BannerSlotConfig;
    final: BannerSlotConfig;
    sidebar: BannerSlotConfig;
  };
}

// ── Valores por defecto (fallback) ──────
// Ya incluyen tus enlaces de ACR Poker listos para usar

export const DEFAULT_BANNERS: BannersConfig = {
  bonusCode: "FPHL",
  slots: {
    mid: {
      desktop: {
        src: "https://wptpartners.ck-cdn.com/tn/serve/?cid=505259",
        href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13409",
        us_src: "https://www.acrpoker.eu/wp-content/uploads/2023/05/1200x800px-Promo-Image-WelcomeBonus-2023-2.jpg",
        us_href: "https://go.wpnaffiliates.com/visit/?bta=236696&brand=americascardroom",
        width: 728, height: 90,
        label: "Leaderboard 728×90",
      },
      mobile: {
        src: "https://wptpartners.ck-cdn.com/tn/serve/?cid=505261",
        href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13410",
        us_src: "https://www.acrpoker.eu/wp-content/uploads/2023/05/1200x800px-Promo-Image-WelcomeBonus-2023-2.jpg",
        us_href: "https://go.wpnaffiliates.com/visit/?bta=236696&brand=americascardroom",
        width: 870, height: 200,
        label: "Wide 870×200",
      },
    },
    final: {
      desktop: {
        src: "https://wptpartners.ck-cdn.com/tn/serve/?cid=505261",
        href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13410",
        us_src: "https://www.acrpoker.eu/wp-content/uploads/2023/05/1200x800px-Promo-Image-WelcomeBonus-2023-2.jpg",
        us_href: "https://go.wpnaffiliates.com/visit/?bta=236696&brand=americascardroom",
        width: 870, height: 200,
        label: "Wide 870×200",
      },
      mobile: {
        src: "https://wptpartners.ck-cdn.com/tn/serve/?cid=505261",
        href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13410",
        us_src: "https://www.acrpoker.eu/wp-content/uploads/2023/05/1200x800px-Promo-Image-WelcomeBonus-2023-2.jpg",
        us_href: "https://go.wpnaffiliates.com/visit/?bta=236696&brand=americascardroom",
        width: 870, height: 200,
        label: "Wide 870×200",
      },
    },
    sidebar: {
      desktop: {
        src: "https://central.ck-cdn.com/w-pt-partners/2026-03-17/300x250_0e7435e0.jpg",
        href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13647",
        us_src: "https://www.acrpoker.eu/wp-content/uploads/2023/05/1200x800px-Promo-Image-WelcomeBonus-2023-2.jpg",
        us_href: "https://go.wpnaffiliates.com/visit/?bta=236696&brand=americascardroom",
        width: 300, height: 250,
        label: "Rectangle 300×250",
      },
      mobile: null,
    },
  },
};

// ── Leer banners ──────────────────────────────────────────

export async function getBannersConfig(): Promise<BannersConfig> {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "banners")
      .maybeSingle();

    if (error || !data) return DEFAULT_BANNERS;

    const mergedSlots = { ...DEFAULT_BANNERS.slots };
    for (const k of Object.keys(DEFAULT_BANNERS.slots)) {
      const key = k as keyof BannersConfig["slots"];
      if (data.value?.slots?.[key]) {
        mergedSlots[key] = {
          desktop: data.value.slots[key].desktop ?? DEFAULT_BANNERS.slots[key].desktop,
          mobile: data.value.slots[key].mobile ?? DEFAULT_BANNERS.slots[key].mobile,
        };
      }
    }

    return {
      bonusCode: data.value?.bonusCode ?? DEFAULT_BANNERS.bonusCode,
      floatingCta: data.value?.floatingCta,
      slots: mergedSlots,
    };
  } catch (err) {
    return DEFAULT_BANNERS;
  }
}

// ── Guardar banners ───────────────────────────────────────

export async function saveBannersConfig(config: BannersConfig) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "banners", value: config as unknown as Record<string, unknown> }, { onConflict: "key" });

  if (error) throw error;
}