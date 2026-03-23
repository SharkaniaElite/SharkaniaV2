// src/config/promotions.ts
// ══════════════════════════════════════════════════════════
// Sharkania — Promociones y banners WPT Global
// Código de bono: FPHL
//
// Para cambiar qué banner aparece en cada posición,
// edita solo la sección "SLOTS" más abajo.
// ══════════════════════════════════════════════════════════

// ── Banners disponibles ───────────────────────────────────
// Agrega aquí todos los banners que tengas de WPT Partners.
// Cada uno tiene: src (imagen), href (link de afiliado), width, height.

export const WPT_BANNERS = {

  leaderboard_728x90: {
    src: "https://wptpartners.ck-cdn.com/tn/serve/?cid=505259",
    href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13409",
    width: 728,
    height: 90,
    label: "Leaderboard 728×90",
  },

  wide_870x200: {
    src: "https://wptpartners.ck-cdn.com/tn/serve/?cid=505261",
    href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13410",
    width: 870,
    height: 200,
    label: "Wide 870×200",
  },

  rectangle_300x250: {
    src: "https://central.ck-cdn.com/w-pt-partners/2026-03-17/300x250_0e7435e0.jpg",
    href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=13647",
    width: 300,
    height: 250,
    label: "Rectangle 300×250",
  },

  // ── Agrega más banners aquí cuando los tengas ─────────────
  // ejemplo_nuevo: {
  //   src: "https://...",
  //   href: "https://tracking.wptpartners.com/visit/?bta=35660&nci=XXXXX",
  //   width: 320,
  //   height: 50,
  //   label: "Mobile 320×50",
  // },

} as const;

// ── SLOTS — asigna qué banner va en cada posición ─────────
// Cambia el valor de desktop/mobile en cada slot para
// rotarlos sin tocar nada más en el código.
//
// Posiciones disponibles:
//   mid      → inline dentro del artículo (después del 3er H2)
//   final    → al terminar el body del artículo
//   sidebar  → columna derecha sticky (solo desktop ≥1024px)

export const WPT_SLOTS = {

  // Slot: mid-article (después del 3er H2)
  mid: {
    desktop: WPT_BANNERS.leaderboard_728x90,
    mobile:  WPT_BANNERS.wide_870x200,
  },

  // Slot: final del artículo (antes del CTA de Sharkania)
  final: {
    desktop: WPT_BANNERS.wide_870x200,   // ← distinto al mid en desktop
    mobile:  WPT_BANNERS.wide_870x200,
  },

  // Slot: sidebar sticky (solo desktop)
  sidebar: {
    desktop: WPT_BANNERS.rectangle_300x250,
    mobile:  null, // el sidebar no aparece en mobile
  },

} as const;

// ── Config general ────────────────────────────────────────

export const WPT_PROMO = {
  bonusCode: "FPHL",
  title: "$10,000 gratis cada semana en WPT Global",
  description: "Deposita $30 y juega los Elite Freerolls del sábado y domingo.",

  // Para el popup flotante (FloatingCTA — no cambia)
  image: WPT_BANNERS.rectangle_300x250.src,
  link:  WPT_BANNERS.rectangle_300x250.href,
  delay: 6000,
  scrollTrigger: 0.35,
};
