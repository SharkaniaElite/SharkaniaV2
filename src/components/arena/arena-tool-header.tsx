import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, type LucideIcon } from "lucide-react";
import "../../styles/arena-workspaces.css";

type ArenaToolHeaderProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
};

export function ArenaToolHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  description,
}: ArenaToolHeaderProps) {
  return (
    <header className="arena-tool-hero">
      <div className="arena-tool-hero-main">
        <Link to="/tools" className="arena-tool-back">
          <ArrowLeft size={15} aria-hidden="true" /> Volver a herramientas
        </Link>
        <p className="arena-tool-eyebrow">
          <Icon size={16} aria-hidden="true" />
          SHARKANIA / HERRAMIENTAS DE PÓKER
          <span aria-hidden="true">/</span>
          {eyebrow}
        </p>
        <h1 className="arena-tool-heading">{title}</h1>
        <p className="arena-tool-subtitle">{subtitle}</p>
        <p className="arena-tool-description">{description}</p>
      </div>
      <div className="arena-tool-hero-bottom" aria-hidden="true">
        <span>ESTUDIA / SIMULA / DECIDE</span>
        <span>POKER LAB <ArrowUpRight size={13} /></span>
      </div>
    </header>
  );
}
