import type { ReactNode } from "react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

type ArenaPageHeroProps = {
  section: "ranking" | "calendar" | "clubs" | "leagues" | "blog" | "news" | "tools";
  eyebrow: string;
  heading: string;
  highlight?: string;
  description: ReactNode;
  icon: LucideIcon;
  count?: number | null;
  countLabel?: string;
  action?: ReactNode;
};

export function ArenaPageHero({
  section, eyebrow, heading, highlight, description,
  icon: Icon, count, countLabel, action,
}: ArenaPageHeroProps) {
  return (
    <header className={`arena-page-hero arena-page-hero--${section}`}>
      <div className="arena-page-hero-inner">
        <div className="arena-page-hero-content">
          <div className="arena-page-kicker">
            <span className="arena-page-kicker-line" aria-hidden="true" />
            <Icon size={16} aria-hidden="true" />
            <span>SHARKANIA ARENA</span>
            <span className="arena-page-kicker-divider">/</span>
            <span>{eyebrow}</span>
          </div>
          <h1 className="arena-page-title">
            {heading}{highlight && <> <span>{highlight}</span></>}
          </h1>
          <p className="arena-page-description">{description}</p>
          {action && <div className="arena-page-action">{action}</div>}
        </div>
        {typeof count === "number" && count >= 0 && countLabel && (
          <div className="arena-page-metric" aria-label={`${count.toLocaleString("es-CL")} ${countLabel}`}>
            <span className="arena-page-metric-label">{countLabel}</span>
            <strong>{count.toLocaleString("es-CL")}</strong>
            <span className="arena-page-metric-flag">
              <span aria-hidden="true" className="arena-page-metric-dot" />
              Basado en registros de Sharkania <ArrowUpRight size={13} aria-hidden="true" />
            </span>
          </div>
        )}
      </div>
      <div className="arena-page-hero-bottom" aria-hidden="true">
        <span>COMPETIR / MEDIR / EVOLUCIONAR</span>
        <span>EL CIRCUITO COMPETITIVO</span>
      </div>
    </header>
  );
}
