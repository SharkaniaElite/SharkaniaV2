/** Officially supplied by the SHARKANIA league organizer on Nov 5, 2026. */
export const IGNITION_FECHA1 = {
  date: "2026-11-05",
  name: "Liga Privada - Fecha 1",
  id: "82905364",
  buyInUsd: "3.30",
  timeChile: "21:00",
  guidePath: "/images/guias/ignition-liga-privada-fecha-1.svg",
  guideUrl: "https://sharkania.com/images/guias/ignition-liga-privada-fecha-1.svg",
  articleUrl: "https://sharkania.com/noticias/liga-sharkania-noviembre-2026-fechas-puntos-premios-ignition",
  basesUrl: "https://sharkania.com/noticias/bases-oficiales-liga-sharkania-noviembre-2026",
} as const;

export const IGNITION_PROXIMOS_IDS = [
  { date: "2026-11-12", label: "Fecha 2", id: null },
  { date: "2026-11-19", label: "Fecha 3", id: null },
  { date: "2026-11-26", label: "Fecha 4", id: null },
] as const;

export function fecha1AccessInstructions(): string {
  return [
    "CÓMO ENCONTRAR EL TORNEO — FECHA 1",
    'En Ignition Poker abre "Torneos Programados".',
    'En el buscador de torneos escribe exactamente: "Liga Privada - Fecha 1".',
    "ID del torneo: #82905364.",
    "Entrada: US$3,30. Inicio: jueves 5 de noviembre a las 21:00 h de Chile.",
    "Guía visual para encontrar el torneo: " + IGNITION_FECHA1.guideUrl,
    "Los ID de las fechas 2, 3 y 4 se publicarán cuando estén confirmados.",
  ].join("\n");
}
