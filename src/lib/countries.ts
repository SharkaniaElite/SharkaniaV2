// src/lib/countries.ts

const COUNTRY_NAMES: Record<string, string> = {
  AR: "Argentina",
  BO: "Bolivia",
  BR: "Brasil",
  CA: "Canadá",
  CL: "Chile",
  CO: "Colombia",
  CR: "Costa Rica",
  CU: "Cuba",
  DO: "República Dominicana",
  EC: "Ecuador",
  ES: "España",
  GQ: "Guinea Ecuatorial",
  GT: "Guatemala",
  HN: "Honduras",
  MX: "México",
  NI: "Nicaragua",
  PA: "Panamá",
  PE: "Perú",
  PR: "Puerto Rico",
  PY: "Paraguay",
  SV: "El Salvador",
  US: "Estados Unidos",
  UY: "Uruguay",
  VE: "Venezuela",
};

/**
 * Devuelve la URL de la bandera SVG local
 * Ejemplo: /flags/cl.svg
 */
export function getFlagUrl(countryCode: string | null): string {
  if (!countryCode) return "/flags/unknown.svg";

  const code = countryCode.toLowerCase();

  return `/flags/${code}.svg`;
}

/**
 * Mantiene compatibilidad con código antiguo
 */
export function getFlag(countryCode: string | null): string {
  if (!countryCode) return "🌍";
  return countryCode.toUpperCase();
}

/**
 * Nombre del país
 */
export function getCountryName(countryCode: string | null): string {
  if (!countryCode) return "Global";

  const code = countryCode.toUpperCase();

  return COUNTRY_NAMES[code] ?? code;
}

/**
 * Lista única de países
 */
export function getUniqueCountries(codes: (string | null)[]): string[] {
  return [...new Set(codes.filter((c): c is string => c !== null))]
    .map((c) => c.toUpperCase())
    .sort();
}