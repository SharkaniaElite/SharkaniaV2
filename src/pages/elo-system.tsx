// src/pages/elo-system.tsx
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import {
  TrendingUp,
  Swords,
  Target,
  ShieldAlert,
  Zap,
  Calculator,
  ChevronRight,
  BarChart3,
  Users,
  Trophy
} from "lucide-react";

export function EloSystemPage() {
  return (
    <PageShell>
      <SEOHead
        title="Cómo funciona el Sistema ELO — Sharkania"
        description="Descubre cómo Sharkania calcula la habilidad real de los jugadores de póker en torneos MTT aislando la varianza."
        path="/sistema-elo"
      />

      <div className="pt-20 pb-20">
        <div className="max-w-[800px] mx-auto px-6">
          
          {/* ── Header ── */}
          <div className="mb-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-sk-accent/10 border border-sk-accent/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
              <TrendingUp size={32} className="text-sk-accent" />
            </div>
            <h1 className="text-sk-3xl sm:text-sk-4xl font-extrabold text-sk-text-1 tracking-tight mb-4">
              El Algoritmo ELO
            </h1>
            <p className="text-sk-base text-sk-text-2 max-w-2xl mx-auto leading-relaxed">
              En Sharkania no medimos quién tiene la billetera más grande o quién tuvo un "lucky bink" el domingo. Medimos el <strong>edge real</strong> aislando la varianza matemática.
            </p>
          </div>

          {/* ── Por qué ELO vs ROI ── */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-6 sm:p-8 mb-10">
            <div className="flex items-center gap-3 mb-4">
              <Swords size={20} className="text-sk-red" />
              <h2 className="text-sk-xl font-bold text-sk-text-1">¿Por qué ELO y no ROI o Dinero Ganado?</h2>
            </div>
            <p className="text-sk-sm text-sk-text-2 leading-relaxed mb-4">
              El ecosistema tradicional del póker mide el éxito en dólares. Esto tiene un problema masivo: <strong>la varianza y el tamaño del bankroll distorsionan la realidad</strong>. Un jugador mediocre jugando torneos de $100 ganará premios más grandes (en dólares) que un genio jugando torneos de $5, aunque el genio juegue matemáticamente perfecto.
            </p>
            <p className="text-sk-sm text-sk-text-2 leading-relaxed">
              Nuestro sistema es una adaptación del <strong>algoritmo Glicko / Malmuth-Harville para MTTs</strong>. Transforma tu posición final en un torneo y la compara directamente contra la <em>dificultad</em> de tus oponentes, entregando un número puro de habilidad.
            </p>
          </div>

          {/* ── Los 4 Pilares ── */}
          <h2 className="text-sk-xl font-bold text-sk-text-1 mb-6 text-center">Los 4 Factores que mueven tu ELO</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
            
            {/* Factor 1 */}
            <div className="bg-sk-bg-2 border border-sk-border-1 rounded-xl p-6 hover:border-sk-accent/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-sk-bg-3 border border-sk-border-2 flex items-center justify-center mb-4">
                <Target size={20} className="text-sk-text-1" />
              </div>
              <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">1. Score (Tu Posición)</h3>
              <p className="text-sk-sm text-sk-text-3 leading-relaxed">
                No se trata solo de hacer ITM o ganar. Tu posición se normaliza de 0 a 1. Quedar 10° en un field de 1000 jugadores es un score de 0.99. Quedar 500° es 0.50. <strong>Cada salto en premios y posiciones cuenta</strong>.
              </p>
            </div>

            {/* Factor 2 */}
            <div className="bg-sk-bg-2 border border-sk-border-1 rounded-xl p-6 hover:border-sk-accent/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-sk-bg-3 border border-sk-border-2 flex items-center justify-center mb-4">
                <BarChart3 size={20} className="text-sk-accent" />
              </div>
              <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">2. El Score Esperado</h3>
              <p className="text-sk-sm text-sk-text-3 leading-relaxed">
                Si tienes 1800 de ELO (Shark) y juegas contra un field de 1100 (Recreacionales), el sistema <strong>espera</strong> que destroces el torneo. Si quedas en la mitad de la tabla, perderás ELO por rendir debajo de tu expectativa.
              </p>
            </div>

            {/* Factor 3 */}
            <div className="bg-sk-bg-2 border border-sk-border-1 rounded-xl p-6 hover:border-sk-accent/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-sk-bg-3 border border-sk-border-2 flex items-center justify-center mb-4">
                <Users size={20} className="text-sk-green" />
              </div>
              <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">3. Peso del Torneo (Field)</h3>
              <p className="text-sk-sm text-sk-text-3 leading-relaxed">
                Ganarle a los mejores paga más. El sistema calcula el ELO promedio de todos los inscritos. <strong>Un deep run en un torneo lleno de regulares (ELO alto) multiplica los puntos ganados</strong> mucho más que ganar un freeroll suave.
              </p>
            </div>

            {/* Factor 4 */}
            <div className="bg-sk-bg-2 border border-sk-border-1 rounded-xl p-6 hover:border-sk-accent/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-sk-bg-3 border border-sk-border-2 flex items-center justify-center mb-4">
                <Zap size={20} className="text-sk-gold" />
              </div>
              <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">4. El Factor K (Volatilidad)</h3>
              <p className="text-sk-sm text-sk-text-3 leading-relaxed">
                Es el "multiplicador de gravedad". El Factor K determina qué tan rápido sube o baja tu ranking. Es dinámico y se ajusta automáticamente según tu experiencia y las condiciones del torneo.
              </p>
            </div>

          </div>

          {/* ── Deep Dive: El Factor K ── */}
          <div className="bg-[#111214] border border-[#27272a] rounded-2xl overflow-hidden mb-12">
            <div className="bg-[#18181b] border-b border-[#27272a] px-6 py-4">
              <h3 className="font-mono text-sk-sm font-bold text-sk-text-1 uppercase tracking-wide flex items-center gap-2">
                <Calculator size={16} className="text-sk-gold" />
                Desglose del Factor K
              </h3>
            </div>
            <div className="p-6 space-y-5">
              
              <div className="flex gap-4">
                <div className="mt-1 w-6 h-6 rounded-full bg-sk-bg-3 flex items-center justify-center font-mono text-[10px] text-sk-text-2 shrink-0">1</div>
                <div>
                  <h4 className="text-sk-sm font-bold text-sk-text-1 mb-1">Periodo de Calibración (K-Base)</h4>
                  <p className="text-sk-sm text-sk-text-3">Tus primeros 30 torneos en la plataforma son cruciales. Tendrás un multiplicador altísimo (<strong>K=40</strong>) para que el sistema encuentre tu nivel real rápidamente. Después del torneo 30, te estabilizas (<strong>K=20</strong>) y será más difícil subir o bajar drásticamente.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1 w-6 h-6 rounded-full bg-sk-bg-3 flex items-center justify-center font-mono text-[10px] text-sk-text-2 shrink-0">2</div>
                <div>
                  <h4 className="text-sk-sm font-bold text-sk-text-1 mb-1">Impacto del Buy-in</h4>
                  <p className="text-sk-sm text-sk-text-3">Los torneos más caros pesan más. El algoritmo aplica un modificador logarítmico al Buy-in. Ganar un High Roller moverá tu ELO significativamente más que jugar 10 torneos micro-stakes.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1 w-6 h-6 rounded-full bg-sk-bg-3 flex items-center justify-center font-mono text-[10px] text-sk-text-2 shrink-0">3</div>
                <div>
                  <h4 className="text-sk-sm font-bold text-sk-text-1 mb-1">Volumen del Field</h4>
                  <p className="text-sk-sm text-sk-text-3">Vencer a 500 personas es matemáticamente más difícil que vencer a 9. A mayor cantidad de jugadores inscritos (Field Size), el Factor K se expande, recompensando los deep runs masivos.</p>
                </div>
              </div>

            </div>
          </div>

          {/* ── Mitos Comunes ── */}
          <div className="mb-12">
            <h2 className="text-sk-xl font-bold text-sk-text-1 mb-6 text-center">Mitos sobre el ELO</h2>
            <div className="space-y-3">
              <div className="bg-sk-bg-0 border border-sk-border-2 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={16} className="text-sk-red" />
                  <span className="font-bold text-sk-text-1 text-sk-sm">"Si no hago ITM, mi ELO se va al piso"</span>
                </div>
                <p className="text-sk-sm text-sk-text-3 pl-6">
                  <strong>Falso.</strong> Si el torneo premia al top 15%, y tú quedas en el 16% (la burbuja), perdiste dinero, pero para el ELO venciste al 84% del field. Si el field era duro, ¡es muy probable que tu ELO suba incluso perdiendo dinero!
                </p>
              </div>
              <div className="bg-sk-bg-0 border border-sk-border-2 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={16} className="text-sk-red" />
                  <span className="font-bold text-sk-text-1 text-sk-sm">"Jugar freerolls me bajará el ELO"</span>
                </div>
                <p className="text-sk-sm text-sk-text-3 pl-6">
                  <strong>Depende.</strong> Como el modificador de Buy-in es $0, el impacto (Factor K) de un freeroll es el mínimo posible. Tendrá un impacto muy marginal en tu ranking global a menos que juegues cientos de ellos y los pierdas todos.
                </p>
              </div>
            </div>
          </div>

          {/* ── Call To Action ── */}
          <div className="bg-gradient-to-br from-sk-bg-2 to-sk-bg-3 border border-sk-border-2 rounded-2xl p-8 text-center shadow-sk-xl">
            <Trophy size={32} className="text-sk-gold mx-auto mb-4" />
            <h3 className="text-sk-lg font-extrabold text-sk-text-1 mb-3">
              No nos creas, ponlo a prueba
            </h3>
            <p className="text-sk-sm text-sk-text-3 max-w-md mx-auto mb-6">
              Usa nuestro Simulador de ELO y descubre exactamente cuántos puntos ganarías (o perderías) en tu próximo torneo según tu posición.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/tools/simulador-elo">
                <Button variant="accent" size="lg" className="w-full sm:w-auto flex items-center gap-2">
                  <Calculator size={16} />
                  Abrir Simulador de ELO
                </Button>
              </Link>
              <Link to="/ranking">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto flex items-center gap-2">
                  Ver Ranking Global <ChevronRight size={16} />
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </PageShell>
  );
}