type NavigationLink = {
  label: string;
  href: string;
  relatedPaths?: readonly string[];
};

export type NavigationGroup = {
  id: string;
  label: string;
  links: readonly NavigationLink[];
  commercialLinks?: readonly NavigationLink[];
  support?: boolean;
};

export const CONTACT_EMAIL = "mailto:contacto@sharkania.com";

export const NAVIGATION: readonly (NavigationLink | NavigationGroup)[] = [
  {
    id: "learn",
    label: "Aprende",
    links: [
      { label: "Academia", href: "/academia" },
      { label: "Estrategia", href: "/blog" },
      { label: "Glosario", href: "/glosario" },
    ],
  },
  { label: "SharkTV", href: "/tv" },
  { label: "Herramientas", href: "/tools" },
  {
    id: "arena",
    label: "Arena",
    links: [
      { label: "Ranking ELO", href: "/ranking" },
      { label: "Calendario", href: "/calendar", relatedPaths: ["/tournament"] },
      { label: "Ligas", href: "/leagues" },
      { label: "Clubes", href: "/clubs" },
      { label: "Sistema ELO", href: "/sistema-elo" },
    ],
  },
  { label: "Noticias", href: "/noticias" },
  {
    id: "more",
    label: "Más",
    links: [
      { label: "Tienda", href: "/shop" },
      { label: "Comparador de jugadores", href: "/compare" },
    ],
    support: true,
    commercialLinks: [{ label: "Promociones", href: "/promociones" }],
  },
];

export function pathMatches(pathname: string, href: string) {
  const path = pathname.toLowerCase();
  return path === href || path.startsWith(href + "/");
}

export function isNavigationLinkActive(pathname: string, link: NavigationLink) {
  return pathMatches(pathname, link.href)
    || Boolean(link.relatedPaths?.some((path) => pathMatches(pathname, path)));
}

export function isNavigationGroupActive(pathname: string, group: NavigationGroup) {
  return group.links.some((link) => isNavigationLinkActive(pathname, link))
    || Boolean(group.commercialLinks?.some((link) => isNavigationLinkActive(pathname, link)));
}
