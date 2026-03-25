// src/pages/terms.tsx
import { PageShell } from "../components/layout/page-shell";

export function TermsPage() {
  const lastUpdated = "2024-03-20";

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-sk-text-1 mb-2">Términos y Condiciones</h1>
          <p className="font-mono text-sk-xs text-sk-text-3">Última actualización: {lastUpdated}</p>
        </header>

        <article className="prose prose-invert prose-zinc max-w-none text-sk-text-2 text-sk-sm leading-relaxed space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-sk-text-1 mb-3">1. Naturaleza del Servicio</h2>
            <p>
              Sharkania es estrictamente una plataforma de analítica, seguimiento de estadísticas, gamificación y ranking (Sistema ELO) para clubes y jugadores de póker. 
              <strong> Sharkania NO es un operador de apuestas, no organiza partidas por dinero real, ni procesa pagos relacionados con apuestas.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-sk-text-1 mb-3">2. Restricción de Edad (18+)</h2>
            <p>
              El acceso y uso de Sharkania está estrictamente limitado a personas mayores de <span className="font-mono">18</span> años, o la mayoría de edad legal para participar en actividades relacionadas con el póker en su jurisdicción. Al utilizar este sitio, usted declara y garantiza que cumple con este requisito de edad.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-sk-text-1 mb-3">3. Cuentas y Responsabilidad de Clubes</h2>
            <p>
              Los administradores de clubes son los únicos responsables de los datos de los torneos que ingresan en la plataforma. Sharkania no audita la veracidad financiera de los premios reportados, ya que estos se utilizan únicamente con fines de cálculo matemático para el ranking ELO y las tablas de clasificación virtuales.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-sk-text-1 mb-3">4. Propiedad Intelectual</h2>
            <p>
              Todo el código, diseño, sistema de cálculo ELO adaptado y base de datos son propiedad de Sharkania. Está estrictamente prohibido el scraping automatizado de nuestras tablas de clasificación sin autorización explícita a través de una API oficial.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-sk-text-1 mb-3">5. Limitación de Responsabilidad</h2>
            <p>
              Sharkania se proporciona "tal cual". No nos hacemos responsables de disputas financieras entre jugadores y clubes de póker. Nuestra plataforma es una pizarra pública de resultados deportivos/competitivos.
            </p>
          </section>
        </article>
      </div>
    </PageShell>
  );
}