// src/pages/hand-review-ases.tsx
import { useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Link } from "react-router-dom";
import { ChevronLeft, AlertTriangle, Target, BrainCircuit, Gamepad2, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

function RumbleEmbed({ embedUrl }: { embedUrl: string }) {
  return (
    <div className="w-full max-w-[400px] mx-auto rounded-xl overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.15)] border border-sk-border-2 bg-sk-bg-0 relative aspect-[9/16] md:aspect-[4/5] min-h-[600px]">
      <div className="absolute inset-0 flex flex-col items-center justify-center animate-pulse z-0">
        <div className="w-12 h-12 bg-sk-bg-4 rounded-full mb-4"></div>
        <div className="h-4 w-32 bg-sk-bg-4 rounded mb-2"></div>
        <div className="h-3 w-48 bg-sk-bg-4 rounded"></div>
      </div>
      <iframe
        src={embedUrl}
        className="absolute top-0 left-0 w-full h-full z-10"
        frameBorder="0"
        allowFullScreen
        allow="autoplay; encrypted-media"
      />
    </div>
  );
}

export function HandReviewAsesPage() {
  const [vote, setVote] = useState<string | null>(null);

  return (
    <PageShell>
      <SEOHead title="Análisis: PLO6 Par de Ases y Doble Flush Draw | SharkTV" path="/tv/plo6-ases" />
      
      <div className="pt-20 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          
          <Link to="/tv" className="inline-flex items-center gap-1 text-sk-sm text-sk-text-4 hover:text-sk-accent transition-colors mb-6">
            <ChevronLeft size={16} /> Volver a SharkTV
          </Link>

          <div className="grid lg:grid-cols-12 gap-8">
            
            {/* 🎥 COLUMNA IZQUIERDA: EL VIDEO */}
            <div className="lg:col-span-7 xl:col-span-8">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="accent">PLO6</Badge>
                  <Badge variant="muted">Deepstack</Badge> 
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-sk-text-1 mb-2">
                  AAxxxx Doble Suited y Fold Equity
                </h1>
                <p className="text-sk-text-3">Analizado por <strong className="text-sk-text-1">Nicolás Fuentes</strong></p>
              </div>

              {/* El Embed de RUMBLE */}
              <div className="bg-sk-bg-2 p-4 md:p-8 rounded-2xl border border-sk-border-2 mb-8 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
                
                <RumbleEmbed embedUrl="https://rumble.com/embed/v76vtxa/?pub=4par2u" />
                
                <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-sk-border-2 relative z-10">
                  <p className="text-center text-[11px] font-mono text-sk-text-3 uppercase tracking-widest mb-3">
                    ¿Te gustaría enfrentar este field?
                  </p>
                  <Link to="/como-jugar-en-clubgg" className="block w-full group">
                    <Button variant="accent" size="lg" className="w-full h-14 md:h-16 text-sm md:text-md font-black shadow-[0_0_30px_rgba(34,211,238,0.25)] hover:shadow-[0_0_45px_rgba(34,211,238,0.4)] transition-all flex items-center justify-center gap-2 border border-sk-accent/50 group-hover:border-sk-accent">
                      <Gamepad2 size={22} className="animate-pulse" />
                      CÓMO JUGAR DONDE JUEGA NICOLÁS
                      <ChevronRight size={20} className="transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Módulo Interactivo */}
              <div className="bg-gradient-to-r from-sk-bg-2 to-sk-bg-3 border border-sk-accent/20 rounded-xl p-6 md:p-8 shadow-inner">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-sk-accent/10 flex items-center justify-center shrink-0">
                    <BrainCircuit className="text-sk-accent" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-sk-text-1 mb-2">La decisión en el Turn (Deepstack)</h3>
                    <p className="text-sk-sm text-sk-text-3 mb-6">
                      El Turn cae <strong className="text-sk-text-1">8♣</strong> en un board descontinuado. Todos checkean hasta el botón, quien mete un potazo (14BB). Tienes tus Ases y un doble proyecto a color. Estando hiper-deep, ¿Cuál es tu línea ideal aquí?
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button variant={vote === "raise" ? "accent" : "secondary"} className="h-12 border-sk-gold/50 hover:border-sk-gold hover:text-sk-gold" onClick={() => setVote("raise")}>
                        Donk / Potear
                      </Button>
                      <Button variant={vote === "call" ? "accent" : "secondary"} className="h-12 border-sk-green/50 hover:border-sk-green hover:text-sk-green" onClick={() => setVote("call")}>
                        Check / Call
                      </Button>
                      <Button variant={vote === "fold" ? "accent" : "secondary"} className="h-12 border-sk-red/50 hover:border-sk-red hover:text-sk-red" onClick={() => setVote("fold")}>
                        Check / Fold
                      </Button>
                    </div>
                    {vote && (
                      <div className="mt-4 p-4 bg-sk-bg-0 border border-sk-border-2 rounded-lg animate-fade-in">
                        <p className="text-sk-sm text-sk-text-2">
                          <strong className="text-sk-accent">Veredicto de Nico:</strong> "Decidí pagar el turn, es un <strong>check-call bastante claro</strong>. Al estar tan deep y con doble flush draw, no podemos foldear. Si apostáramos nosotros tendríamos fold equity, pero ante su apuesta, pagar para ver el river es la jugada."
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 📊 COLUMNA DERECHA: EL HUD EXPERTO */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-6">
              
              <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden sticky top-24">
                <div className="bg-sk-bg-3 p-4 border-b border-sk-border-2 flex items-center gap-2">
                  <Target className="text-sk-accent" size={18} />
                  <h3 className="font-bold text-sk-text-1">Contexto de la Mesa</h3>
                </div>
                
                <div className="p-5 space-y-5">
                  <div className="flex justify-between items-center pb-4 border-b border-sk-border-2">
                    <div>
                      <p className="text-[10px] font-mono text-sk-text-4 uppercase mb-1">Sala / Posición</p>
                      <p className="font-bold text-sk-text-1 flex items-center gap-2">
                        ClubGG (Hero en BB)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-sk-text-4 uppercase mb-1">Modalidad</p>
                      <p className="font-bold text-sk-accent">PLO6 (4-Way)</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-mono text-sk-text-4 uppercase mb-2">Cartas (Hero)</p>
                    <div className="flex gap-1.5 flex-wrap">
                      <div className="w-8 h-12 md:w-9 md:h-14 bg-white rounded flex items-center justify-center text-sm md:text-lg font-bold text-black border-2 border-sk-border-2 shadow-sm">A<span className="text-black">♠</span></div>
                      <div className="w-8 h-12 md:w-9 md:h-14 bg-white rounded flex items-center justify-center text-sm md:text-lg font-bold text-black border-2 border-sk-border-2 shadow-sm">A<span className="text-green-600">♣</span></div>
                      <div className="w-8 h-12 md:w-9 md:h-14 bg-white rounded flex items-center justify-center text-sm md:text-lg font-bold text-black border-2 border-sk-border-2 shadow-sm">6<span className="text-blue-600">♦</span></div>
                      <div className="w-8 h-12 md:w-9 md:h-14 bg-white rounded flex items-center justify-center text-sm md:text-lg font-bold text-black border-2 border-sk-border-2 shadow-sm">6<span className="text-red-500">♥</span></div>
                      <div className="w-8 h-12 md:w-9 md:h-14 bg-white rounded flex items-center justify-center text-sm md:text-lg font-bold text-black border-2 border-sk-border-2 shadow-sm">3<span className="text-black">♠</span></div>
                      <div className="w-8 h-12 md:w-9 md:h-14 bg-white rounded flex items-center justify-center text-sm md:text-lg font-bold text-black border-2 border-sk-border-2 shadow-sm">3<span className="text-green-600">♣</span></div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-mono text-sk-text-4 uppercase mb-2">Board (River)</p>
                    <div className="flex gap-1.5">
                      <div className="w-10 h-14 bg-sk-bg-0 rounded flex items-center justify-center text-lg font-bold text-white border border-sk-border-2 shadow-sm">9<span className="text-blue-400">♦</span></div>
                      <div className="w-10 h-14 bg-sk-bg-0 rounded flex items-center justify-center text-lg font-bold text-white border border-sk-border-2 shadow-sm">K<span className="text-red-400">♥</span></div>
                      <div className="w-10 h-14 bg-sk-bg-0 rounded flex items-center justify-center text-lg font-bold text-white border border-sk-border-2 shadow-sm">2<span className="text-blue-400">♦</span></div>
                      <div className="w-10 h-14 bg-sk-bg-0 rounded flex items-center justify-center text-lg font-bold text-white border border-sk-border-2 shadow-sm">8<span className="text-green-400">♣</span></div>
                      <div className="w-10 h-14 bg-sk-bg-0 rounded flex items-center justify-center text-lg font-bold text-white border border-sk-border-2 shadow-sm">Q<span className="text-green-400">♣</span></div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-sk-border-2">
                    <p className="text-[10px] font-mono text-sk-text-4 uppercase mb-2">Dinámica de Apuestas</p>
                    <ul className="space-y-2 text-sk-sm">
                      <li className="flex justify-between"><span className="text-sk-text-3">Preflop:</span> <span className="font-bold text-sk-text-1">CO abre 3.5BB (4 Calls)</span></li>
                      <li className="flex justify-between"><span className="text-sk-text-3">Flop (14BB):</span> <span className="font-bold text-sk-text-1">Todos Check</span></li>
                      <li className="flex justify-between"><span className="text-sk-text-3">Turn (14BB):</span> <span className="font-bold text-sk-gold">BTN Pot / Hero Call</span></li>
                      <li className="flex justify-between"><span className="text-sk-text-3">River (42BB):</span> <span className="font-bold text-sk-red">BTN Pot / Hero Folds</span></li>
                    </ul>
                  </div>

                  <div className="bg-sk-accent-dim border border-sk-accent/20 rounded-lg p-3">
                    <p className="text-[11px] font-bold text-sk-accent flex items-center gap-1 mb-1">
                      <AlertTriangle size={12} /> Lectura de River (Nico)
                    </p>
                    <p className="text-xs text-sk-text-2 leading-relaxed">
                      "Teníamos tres pares en mano, pero inútiles frente a este board. Solo contábamos con los Ases y nuestro draw. Tras pagar en Turn por la equity, el River trae la Q♣ completando proyectos contrarios, y ante un segundo POT consecutivo por 42BB, toca foldear."
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}