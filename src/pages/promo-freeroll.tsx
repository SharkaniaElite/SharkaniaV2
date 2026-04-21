import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { Link } from "react-router-dom";
import { Trophy, Swords, Ticket, Clock, Coins, ChevronRight, AlertCircle } from "lucide-react";

export function PromoFreerollPage() {
  return (
    <PageShell>
      <SEOHead
        title="Freeroll Diario: Clasifica a grandes torneos | Sharkania"
        description="Juega gratis todos los días a las 17:00 en LatinAllinPoker. Gana tickets para los clasificatorios y compite por los pozos garantizados del evento principal."
        path="/promociones/freeroll-diario"
      />
      
      {/* ══ HERO ══ */}
      <div className="relative pt-24 pb-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/bg/freeroll-diario.webp" alt="Freeroll Fondo" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-sk-bg-0/90 via-sk-bg-0/95 to-sk-bg-1" />
        </div>

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <span className="inline-block py-1 px-3 rounded-full bg-sk-green/10 text-sk-green border border-sk-green/20 font-mono text-[10px] font-bold uppercase tracking-widest mb-4">
            Torneo Diario • 17:00 HRS
          </span>
          <h1 className="text-4xl md:text-6xl font-black text-sk-text-1 tracking-tighter mb-6 leading-tight">
            El Camino del Tiburón: <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sk-accent to-blue-400 pr-4">
              Freeroll Diario
            </span>
          </h1>
          <p className="text-sk-base md:text-lg text-sk-text-2 max-w-2xl mx-auto mb-8">
            Compite sin riesgo todos los días en el club LatinAllinPoker. Supera el sistema de 3 pasos y transforma una inscripción gratuita en miles garantizados.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/como-jugar-en-clubgg">
              <Button variant="accent" size="lg" className="w-full sm:w-auto shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                ¿No tienes cuenta? Aprende a unirte
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="py-16 bg-sk-bg-1">
        <div className="max-w-5xl mx-auto px-6">
          
          <div className="text-center mb-16">
            <h2 className="text-sk-2xl font-black text-sk-text-1 mb-2">El Sistema de 3 Pasos (Steps)</h2>
            <p className="text-sk-sm text-sk-text-3">La ruta exacta desde cero inversión hasta las grandes ligas.</p>
          </div>

          {/* ══ LOS 3 PASOS ══ */}
          <div className="grid lg:grid-cols-3 gap-6 relative">
            
            {/* Conectores visuales (solo desktop) */}
            <div className="hidden lg:block absolute top-[120px] left-1/6 right-1/6 h-0.5 bg-sk-border-2 z-0" />

            {/* STEP 1: Freeroll */}
            <div className="bg-sk-bg-2 border border-sk-accent/40 rounded-2xl p-6 relative z-10 shadow-[0_0_30px_rgba(34,211,238,0.05)] transform hover:-translate-y-1 transition-transform">
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-sk-accent text-sk-bg-0 font-black flex items-center justify-center rounded-full text-xl shadow-lg">1</div>
              <div className="w-14 h-14 bg-sk-accent/10 text-sk-accent rounded-xl flex items-center justify-center mb-6 border border-sk-accent/20">
                <Ticket size={28} />
              </div>
              <h3 className="text-xl font-bold text-sk-text-1 mb-2">Paso 1: El Freeroll</h3>
              <p className="text-sm text-sk-text-3 mb-6">El punto de partida. Tu objetivo es sobrevivir y quedar entre los mejores para ganar tu ticket al clasificatorio de la noche.</p>
              
              <ul className="space-y-3 bg-sk-bg-3 p-4 rounded-xl border border-sk-border-2">
                <li className="flex items-center gap-3 text-sm text-sk-text-1"><Clock size={16} className="text-sk-text-4" /> <strong>Hora:</strong> 17:00 hrs (Diario)</li>
                <li className="flex items-center gap-3 text-sm text-sk-text-1"><Coins size={16} className="text-sk-text-4" /> <strong>Buy-in:</strong> ¡GRATIS!</li>
                <li className="flex items-center gap-3 text-sm text-sk-text-1"><Swords size={16} className="text-sk-text-4" /> <strong>Stack Inicial:</strong> 5.000 (50bb)</li>
                <li className="flex items-start gap-3 text-sm text-sk-text-1"><AlertCircle size={16} className="text-sk-text-4 shrink-0 mt-0.5" /> <span><strong>Ciegas:</strong> 50/100 (Ante 15)<br/>Suben cada 5 minutos</span></li>
                <li className="flex items-center gap-3 text-sm text-sk-green mt-2 pt-2 border-t border-sk-border-2"><Trophy size={16} /> <strong>Premio:</strong> 7 Tickets GTD al Paso 2</li>
              </ul>
            </div>

            {/* STEP 2: Clasificatorio */}
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-6 relative z-10 hover:border-sk-text-4 transition-colors">
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-sk-bg-4 border border-sk-border-2 text-sk-text-1 font-black flex items-center justify-center rounded-full text-xl">2</div>
              <div className="w-14 h-14 bg-sk-bg-3 text-sk-text-3 rounded-xl flex items-center justify-center mb-6 border border-sk-border-2">
                <Swords size={28} />
              </div>
              <h3 className="text-xl font-bold text-sk-text-1 mb-2">Paso 2: Clasificatorio (Satélite)</h3>
              <p className="text-sm text-sk-text-3 mb-6">Usa tu ticket ganado (o paga el buy-in directo) para entrar a este torneo puente. El nivel sube, pero la recompensa es el pase al evento estelar.</p>
              
              <ul className="space-y-3 bg-sk-bg-3 p-4 rounded-xl border border-sk-border-2 opacity-90">
                <li className="flex items-center gap-3 text-sm text-sk-text-1"><Coins size={16} className="text-sk-text-4" /> <strong>Buy-in:</strong> Variable</li>
                <li className="flex items-center gap-3 text-sm text-sk-text-1"><Clock size={16} className="text-sk-text-4" /> <strong>Hora:</strong> Noche</li>
                <li className="flex items-start gap-3 text-sm text-sk-text-1"><AlertCircle size={16} className="text-sk-text-4 shrink-0 mt-0.5" /> <span>Estructura optimizada dependiendo del torneo principal.</span></li>
                <li className="flex items-center gap-3 text-sm text-sk-gold mt-2 pt-2 border-t border-sk-border-2"><Trophy size={16} /> <strong>Premio:</strong> Tickets al Evento Principal</li>
              </ul>
            </div>

            {/* STEP 3: Main Event */}
            <div className="bg-gradient-to-b from-sk-bg-2 to-sk-bg-3 border border-sk-gold/30 rounded-2xl p-6 relative z-10 shadow-[0_0_40px_rgba(255,215,0,0.05)]">
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-sk-gold text-sk-bg-0 font-black flex items-center justify-center rounded-full text-xl shadow-lg">3</div>
              <div className="w-14 h-14 bg-sk-gold/10 text-sk-gold rounded-xl flex items-center justify-center mb-6 border border-sk-gold/20">
                <Trophy size={28} />
              </div>
              <h3 className="text-xl font-bold text-sk-text-1 mb-2">Paso 3: Evento Principal</h3>
              <p className="text-sm text-sk-text-3 mb-6">El gran escenario. Juega por premios masivos utilizando la entrada que conseguiste sin gastar ni un centavo desde el Paso 1.</p>
              
              <ul className="space-y-3 bg-sk-bg-0/50 p-4 rounded-xl border border-sk-gold/10">
                <li className="flex items-center gap-3 text-sm text-sk-text-1"><Coins size={16} className="text-sk-gold/70" /> <strong>Buy-in:</strong> Variable (Entrada VIP)</li>
                <li className="flex items-start gap-3 text-sm text-sk-text-1"><AlertCircle size={16} className="text-sk-gold/70 shrink-0 mt-0.5" /> <span>Cambia cada día (Mystery Bounty, PKO, Deepstack).</span></li>
                <li className="flex items-center gap-3 text-sm text-sk-green mt-2 pt-2 border-t border-sk-border-2"><Trophy size={16} /> <strong>Pozo:</strong> ¡Miles garantizados!</li>
              </ul>
            </div>

          </div>

          {/* ══ CALL TO ACTION FINAL ══ */}
          <div className="mt-20 bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-8 md:p-12 text-center flex flex-col items-center">
            <img src="/logos/latin-logo.png" alt="LatinAllinPoker" className="h-16 object-contain mb-6 drop-shadow-md" />
            <h3 className="text-2xl font-black text-sk-text-1 mb-3">Únete hoy mismo a LatinAllinPoker</h3>
            <p className="text-sk-sm text-sk-text-3 max-w-lg mb-8">
              Para participar en este y todos nuestros freerolls, necesitas tener la aplicación ClubGG y unirte a nuestro club oficial mediante nuestra guía paso a paso.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/como-jugar-en-clubgg">
                <Button variant="accent" size="lg" className="w-full sm:w-auto group">
                  Ver Tutorial de Instalación <ChevronRight size={18} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </PageShell>
  );
}