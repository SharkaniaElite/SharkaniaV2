import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft, Download } from "lucide-react";

export function TutorialCsvPage() {
  return (
    <PageShell>
      <SEOHead
        title="Tutorial: Cómo crear un CSV de Resultados — Sharkania"
        description="Aprende a crear y exportar un archivo CSV desde Excel o Google Sheets para subir los resultados de tus torneos a Sharkania."
        path="/tutorial-csv"
      />

      <div className="pt-20 pb-16">
        <div className="max-w-[800px] mx-auto px-6">
          {/* Back button */}
          <Link
            to="/admin/club"
            className="inline-flex items-center gap-1.5 text-sk-sm text-sk-text-3 hover:text-sk-text-1 transition-colors mb-8"
          >
            <ArrowLeft size={14} />
            Volver a mi club
          </Link>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-sk-accent/10 border border-sk-accent/20 flex items-center justify-center">
                <FileSpreadsheet size={24} className="text-sk-accent" />
              </div>
              <div>
                <h1 className="text-sk-3xl font-extrabold text-sk-text-1 tracking-tight">
                  Cómo subir resultados (CSV)
                </h1>
              </div>
            </div>
            <p className="text-sk-md text-sk-text-2 leading-relaxed">
              Un archivo CSV (Valores Separados por Comas) es el formato estándar para importar tablas. 
              Aprende a exportar tus resultados desde Excel o Google Sheets en menos de 1 minuto.
            </p>
          </div>

          <div className="space-y-8">
            {/* Paso 1 */}
            <section className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 md:p-8">
              <h2 className="text-sk-lg font-bold text-sk-text-1 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sk-accent text-sk-bg-0 text-sk-sm font-bold">1</span>
                Prepara tu tabla
              </h2>
              <p className="text-sk-sm text-sk-text-2 mb-4">
                Abre Excel o Google Sheets y crea una tabla. <strong className="text-sk-text-1">La primera fila debe contener los nombres de las columnas.</strong>
              </p>
              
              <div className="bg-sk-bg-0 border border-sk-border-1 rounded-lg overflow-hidden mb-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-sk-bg-3 border-b border-sk-border-1">
                      <th className="py-2 px-4 font-mono text-[11px] text-sk-text-1">lugar</th>
                      <th className="py-2 px-4 font-mono text-[11px] text-sk-text-1">nickname</th>
                      <th className="py-2 px-4 font-mono text-[11px] text-sk-text-1">premio</th>
                      <th className="py-2 px-4 font-mono text-[11px] text-sk-text-1">puntos</th>
                    </tr>
                  </thead>
                  <tbody className="text-sk-sm text-sk-text-2 font-mono">
                    <tr className="border-b border-sk-border-1/50">
                      <td className="py-2 px-4">1</td>
                      <td className="py-2 px-4 text-sk-accent">SharkMaster</td>
                      <td className="py-2 px-4 text-sk-green">150.50</td>
                      <td className="py-2 px-4">100</td>
                    </tr>
                    <tr className="border-b border-sk-border-1/50">
                      <td className="py-2 px-4">2</td>
                      <td className="py-2 px-4 text-sk-accent">RiverKing</td>
                      <td className="py-2 px-4 text-sk-green">90.00</td>
                      <td className="py-2 px-4">80</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4">3</td>
                      <td className="py-2 px-4 text-sk-accent">AceHunter</td>
                      <td className="py-2 px-4 text-sk-text-4">0</td>
                      <td className="py-2 px-4">60</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="bg-sk-bg-3 rounded-lg p-4 border border-sk-border-1">
                  <h4 className="text-sk-xs font-bold text-sk-red mb-2 uppercase tracking-wide">Obligatorias</h4>
                  <ul className="text-sk-sm text-sk-text-3 space-y-1.5">
                    <li><strong className="text-sk-text-1">lugar:</strong> Posición final (Ej: 1, 2, 3)</li>
                    <li><strong className="text-sk-text-1">nickname:</strong> Nombre del jugador</li>
                  </ul>
                </div>
                <div className="bg-sk-bg-3 rounded-lg p-4 border border-sk-border-1">
                  <h4 className="text-sk-xs font-bold text-sk-text-2 mb-2 uppercase tracking-wide">Opcionales</h4>
                  <ul className="text-sk-sm text-sk-text-3 space-y-1.5">
                    <li><strong className="text-sk-text-1">premio:</strong> Dinero ganado. Usa punto o coma para decimales.</li>
                    <li><strong className="text-sk-text-1">puntos:</strong> Puntos para el ranking.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Paso 2 */}
            <section className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 md:p-8">
              <h2 className="text-sk-lg font-bold text-sk-text-1 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sk-accent text-sk-bg-0 text-sk-sm font-bold">2</span>
                Descargar como CSV
              </h2>
              
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <CheckCircle2 size={18} className="text-sk-green shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sk-sm font-bold text-sk-text-1">En Google Sheets</p>
                    <p className="text-sk-sm text-sk-text-3">Ve a <strong className="text-sk-text-2">Archivo &gt; Descargar &gt; Valores separados por comas (.csv)</strong></p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <CheckCircle2 size={18} className="text-sk-green shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sk-sm font-bold text-sk-text-1">En Microsoft Excel</p>
                    <p className="text-sk-sm text-sk-text-3">Ve a <strong className="text-sk-text-2">Archivo &gt; Guardar como...</strong> y en el tipo de archivo selecciona <strong className="text-sk-text-2">CSV (delimitado por comas)</strong>.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Alertas comunes */}
            <section className="bg-sk-orange/10 border border-sk-orange/20 rounded-xl p-6 md:p-8">
              <h2 className="text-sk-md font-bold text-sk-orange mb-3 flex items-center gap-2">
                <AlertTriangle size={18} />
                Errores comunes
              </h2>
              <ul className="text-sk-sm text-sk-text-2 space-y-2 list-disc pl-5">
                <li><strong className="text-sk-text-1">Nombres de columnas incorrectos:</strong> Si pones "Posición" en lugar de "Lugar", el sistema igual lo reconocerá gracias a nuestro lector inteligente. Sin embargo, evita usar nombres muy raros.</li>
                <li><strong className="text-sk-text-1">Símbolos de moneda:</strong> No incluyas el signo de dólar ($) ni letras en la columna de premio (ej. 150.50 en lugar de $150.50).</li>
              </ul>
            </section>

          </div>
        </div>
      </div>
    </PageShell>
  );
}