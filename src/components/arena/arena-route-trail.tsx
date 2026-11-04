import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

type ArenaRouteTrailProps = {
  section: string;
  current: string;
  href?: string;
};

export function ArenaRouteTrail({ section, current, href = "/promociones" }: ArenaRouteTrailProps) {
  return (
    <nav className="arena-route-trail" aria-label="Ruta de navegación">
      <Link to="/">Sharkania Arena</Link>
      <ChevronRight size={13} aria-hidden="true" />
      <Link to={href}>{section}</Link>
      <ChevronRight size={13} aria-hidden="true" />
      <span aria-current="page">{current}</span>
    </nav>
  );
}
