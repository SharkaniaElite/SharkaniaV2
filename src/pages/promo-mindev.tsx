// src/pages/promo-mindev.tsx
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { RevealSection } from "../components/landing/reveal-section";
import { Button } from "../components/ui/button";
import { 
  Brain, 
  Radar, 
  Target, 
  Cpu, 
  ShieldAlert, 
  TrendingUp, 
  ChevronRight, 
  CheckCircle2, 
  Zap,
  LineChart
} from "lucide-react";

export function PromoMindevPage() {
  const affiliateLink = "https://mindev-ia.cl/?ref=sharkania";

  return (
    <PageShell>
      <SEOHead 
        title="Descubre tus fugas invisibles con IA | Sharkania x MindEV" 
        description="Diagnóstico mental y técnico para jugadores de Texas Hold'em con Inteligencia Artificial. Descubre por qué estás perdiendo dinero y obtén tu plan de mejora." 
        path="/mindev"
      />

      {/* ══ BACKGROUND EFFECTS ══ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-sk-accent/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#d4af37]/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 pt-24 pb-20">
        
        {/* ══ HERO CO-BRANDING ══ */}
        <section className="max-w-[1000px] mx-auto px-6 text-center mb-20">
          <RevealSection>
            {/* Badges de Alianza */}
            <div className="flex items-center justify-center gap-4 mb-8 animate-sk-fade-up">
              <div className="flex items-center gap-2 bg-sk-bg-2 border border-sk-border-2 px-4 py-2 rounded-xl shadow-lg">
                <span className="font-extrabold text-white tracking-tight">Sharkania</span>
              </div>
              <div className="text-sk-text-4">
                <Zap size={20} className="text-[#d4af37]" />
              </div>
              <div className="flex items-center gap-2 bg-[#0a1128] border border-[#d4af37]/30 px-4 py-2 rounded-xl shadow-lg shadow-[#d4af37]/10">
                {/* Asumo que guardarás el logo en la carpeta public como mindev-logo.png */}
                <span className="font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  Mind<span className="text-[#d4af37]">EV</span>
                </span>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] text-[10px] font-black uppercase tracking-widest mb-6">
              <Brain size={14} /> Tu EV+ empieza en tu mente
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter mb-6 leading-[1.1]">
              ¿Sabes exactamente por qué estás <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">perdiendo dinero</span> en las mesas?
            </h1>
            
            <p className="text-lg md:text-xl text-sk-text-2 max-w-3xl mx-auto mb-10 leading-relaxed">
              El 80% de los jugadores ignora sus <strong className="text-white">"fugas invisibles"</strong>. No es mala suerte, es falta de data. Evalúa tus 10 dimensiones psicológicas y tu nivel técnico con la primera IA de diagnóstico para póker.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href={affiliateLink} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                <Button variant="accent" size="xl" className="w-full group shadow-[0_0_30px_rgba(34,211,238,0.25)] hover:shadow-[0_0_40px_rgba(34,211,238,0.4)]">
                  <Cpu className="mr-2" size={20} />
                  Iniciar Diagnóstico con IA
                  <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                </Button>
              </a>
              <p className="text-xs text-sk-text-4 font-mono mt-3 sm:mt-0 sm:ml-4">
                Toma menos de 15 minutos.
              </p>
            </div>
          </RevealSection>
        </section>

        {/* ══ THE PROBLEM (Agitación) ══ */}
        <section className="max-w-[1200px] mx-auto px-6 mb-24">
          <RevealSection>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-sk-bg-2/50 backdrop-blur-sm border border-sk-border-2 rounded-2xl p-8 hover:border-red-500/30 transition-colors">
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-6">
                  <ShieldAlert className="text-red-500" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Tilt Destructivo</h3>
                <p className="text-sk-text-3 text-sm leading-relaxed">Saber qué hacer no sirve de nada si pierdes el control cuando la varianza ataca. Identifica tus detonantes mentales exactos.</p>
              </div>
              <div className="bg-sk-bg-2/50 backdrop-blur-sm border border-sk-border-2 rounded-2xl p-8 hover:border-orange-500/30 transition-colors">
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6">
                  <TrendingUp className="text-orange-500" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Estancamiento</h3>
                <p className="text-sk-text-3 text-sm leading-relaxed">¿Llevas meses jugando los mismos niveles de compra-in? Tienes lagunas técnicas (leaks) que los regulares están explotando.</p>
              </div>
              <div className="bg-sk-bg-2/50 backdrop-blur-sm border border-sk-border-2 rounded-2xl p-8 hover:border-[#d4af37]/30 transition-colors">
                <div className="w-12 h-12 bg-[#d4af37]/10 rounded-xl flex items-center justify-center mb-6">
                  <LineChart className="text-[#d4af37]" size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Falta de Rumbo</h3>
                <p className="text-sk-text-3 text-sm leading-relaxed">Estudiar videos al azar en YouTube no es un sistema. Necesitas saber exactamente qué estudiar hoy para mejorar mañana.</p>
              </div>
            </div>
          </RevealSection>
        </section>

        {/* ══ THE SOLUTION (Características MindEV) ══ */}
        <section className="bg-gradient-to-b from-sk-bg-1 to-sk-bg-0 border-y border-sk-border-2 py-24 mb-24 relative overflow-hidden">
          <div className="max-w-[1200px] mx-auto px-6 relative z-10">
            <RevealSection>
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
                  El quirófano para tu <span className="text-[#d4af37]">Winrate</span>
                </h2>
                <p className="text-sk-text-2 max-w-2xl mx-auto">La IA de MindEV analiza tus respuestas para generar un mapa exacto de tu cerebro como jugador de póker.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  {[
                    { icon: Target, title: "Test de 94 Preguntas Híbrido", desc: "Mide tus conocimientos técnicos reales en Texas Hold'em y evalúa 10 dimensiones de tu perfil psicológico." },
                    { icon: Radar, title: "Radar de Habilidades", desc: "Visualización gráfica instantánea de tus mayores debilidades y tus puntos más fuertes en la mesa." },
                    { icon: Brain, title: "Plan de Estudio de 12 Semanas", desc: "No te dejamos con el problema. La IA diseña un plan de mejora paso a paso basado exclusivamente en tus resultados." },
                    { icon: Cpu, title: "Análisis de Manos con IA", desc: "Pega el historial de esa mano que te quitó el sueño y deja que nuestro coach de IA la analice al instante." }
                  ].map((feat, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="w-12 h-12 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-xl flex items-center justify-center shrink-0">
                        <feat.icon className="text-[#d4af37]" size={24} />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white mb-1">{feat.title}</h4>
                        <p className="text-sm text-sk-text-3 leading-relaxed">{feat.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#0a1128] border border-[#d4af37]/20 rounded-3xl p-8 relative shadow-[0_0_50px_rgba(212,175,55,0.05)] overflow-hidden flex items-center justify-center min-h-[400px]">
                   <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                   <div className="text-center z-10">
                     <Radar size={80} className="text-[#d4af37] mx-auto mb-6 animate-[spin_10s_linear_infinite]" />
                     <p className="font-mono text-sk-text-2 tracking-widest uppercase text-sm mb-2">Generando</p>
                     <h3 className="text-2xl font-black text-white">Radar de Jugador</h3>
                   </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ══ PRICING TRIPWIRE (La Oferta Irresistible) ══ */}
        <section className="max-w-[800px] mx-auto px-6 mb-24">
          <RevealSection>
            <div className="bg-gradient-to-br from-sk-bg-2 to-sk-bg-3 border border-sk-accent/30 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sk-accent via-[#d4af37] to-sk-accent" />
              
              <div className="inline-block bg-[#d4af37]/10 text-[#d4af37] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                Retorno de Inversión Inmediato
              </div>
              
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                El coach más rentable del circuito
              </h2>
              <p className="text-sk-text-2 mb-10 max-w-lg mx-auto">
                Olvídate de pagar $100 USD la hora a un coach humano para que te diga lo que nuestra IA puede diagnosticar en 15 minutos.
              </p>

              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-2xl p-6 md:p-8 max-w-md mx-auto mb-8 relative">
                <div className="absolute -top-4 right-4 bg-sk-accent text-black text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-lg transform rotate-3">
                  Menos de 1 Buy-in
                </div>
                <div className="text-sk-text-3 font-mono text-sm uppercase tracking-widest mb-2">Plan Permanente</div>
                <div className="flex items-baseline justify-center gap-1 mb-6">
                  <span className="text-3xl font-bold text-sk-text-2">$</span>
                  <span className="text-6xl font-black text-white tracking-tighter">9.90</span>
                  <span className="text-sk-text-3 ml-1">USD</span>
                </div>
                <ul className="space-y-3 text-sm text-sk-text-2 text-left mb-8">
                  <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#d4af37]" /> Test de 94 Preguntas</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#d4af37]" /> Radar de 10 Dimensiones</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#d4af37]" /> Plan de Mejora Semanal</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#d4af37]" /> Análisis de Manos con IA</li>
                </ul>
                <a href={affiliateLink} target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full bg-[#d4af37] text-black hover:bg-[#b5952f] font-black text-base h-12 shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                    Obtener Acceso Vitalicio
                  </Button>
                </a>
              </div>
              
              <p className="text-[11px] text-sk-text-4 font-mono">
                *También disponible plan de 30 días por solo $4.90 USD. Acepta tarjetas locales vía Mercado Pago (LATAM) y tarjetas internacionales.
              </p>
            </div>
          </RevealSection>
        </section>

      </div>
    </PageShell>
  );
}