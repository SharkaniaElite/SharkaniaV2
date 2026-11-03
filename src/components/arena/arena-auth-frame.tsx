import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "../../styles/arena-workspaces.css";

type ArenaAuthFrameProps = {
  mode: "login" | "register" | "recovery" | "reset";
  title: string;
  description: string;
  children: ReactNode;
};

export function ArenaAuthFrame({ mode, title, description, children }: ArenaAuthFrameProps) {
  return (
    <main className={`arena-auth-page arena-auth--${mode}`}>
      <div className="arena-auth-grid">
        <aside className="arena-auth-intro" aria-label="Sharkania Arena">
          <Link to="/" className="arena-auth-brand" aria-label="Volver a la portada de Sharkania">
            <span className="arena-auth-brand-mark" aria-hidden="true">S</span>
            Sharkania <small>ARENA</small>
          </Link>
          <div className="arena-auth-copy">
            <p className="arena-auth-eyebrow">SHARKANIA / PÓKER COMPETITIVO</p>
            <h1>EL PÓKER TIENE <span>SU ARENA.</span></h1>
            <p>Tu acceso al circuito: jugadores, torneos de póker online, clasificación ELO, clubes y ligas registrados en Sharkania.</p>
            <ul className="arena-auth-benefits">
              <li>Ranking ELO</li>
              <li>Torneos de póker</li>
              <li>Clubes y ligas</li>
            </ul>
          </div>
          <p className="arena-auth-footnote">SHARKANIA ARENA / LATINOAMÉRICA</p>
        </aside>
        <section className="arena-auth-panel" aria-labelledby="arena-auth-form-title">
          <div className="arena-auth-panel-heading">
            <p className="arena-auth-panel-eyebrow">
              {mode === "login" ? "CUENTA / ACCESO" : mode === "register" ? "CUENTA / REGISTRO" : "CUENTA / SEGURIDAD"}
            </p>
            <h2 id="arena-auth-form-title">{title}</h2>
            <p>{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
