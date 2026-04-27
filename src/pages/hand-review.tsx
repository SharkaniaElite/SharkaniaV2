// src/pages/hand-review.tsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { ChevronLeft, AlertTriangle, Target, BrainCircuit, Gamepad2, ChevronRight, MonitorPlay } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";

// Componente estable para Rumble Embed
function RumbleEmbed({ embedUrl }: { embedUrl: string }) {
  return (
    <div className="w-full max-w-[400px] mx-auto rounded-xl overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.15)] border border-sk-border-2 bg-sk-bg-0 relative aspect-[9/16] md:aspect-[4/5] min-h-[600px]">
      {/* Skeleton de carga mientras Rumble responde */}
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

// Motor visual para renderizar cartas dinámicamente desde texto (ej: "As", "Tc", "9d")
function renderCard(cardString: string, isBoard = false) {
  if (!cardString || cardString.length < 2) return null;
  const suitStr = cardString.slice(-1).toLowerCase();
  const rank = cardString.slice(0, -1).toUpperCase();

  let suitSymbol = "";
  let heroSuitClass = "";
  let boardSuitClass = "";

  switch (suitStr) {
    case "s": 
      suitSymbol = "♠"; 
      heroSuitClass = "text-black"; 
      boardSuitClass = "text-sk-text-4"; // Gris claro para modo oscuro
      break;
    case "c": 
      suitSymbol = "♣"; 
      heroSuitClass = "text-green-600"; 
      boardSuitClass = "text-green-400"; 
      break;
    case "d": 
      suitSymbol = "♦"; 
      heroSuitClass = "text-blue-600"; 
      boardSuitClass = "text-blue-400"; 
      break;
    case "h": 
      suitSymbol = "♥"; 
      heroSuitClass = "text-red-500"; 
      boardSuitClass = "text-red-400"; 
      break;
    default: 
      suitSymbol = suitStr; 
      heroSuitClass = "text-black"; 
      boardSuitClass = "text-white";
  }

  // Estilo para las cartas en la mesa (Fondo oscuro)
  if (isBoard) {
    return (
      <div key={cardString} className="w-10 h-14 bg-sk-bg-0 rounded flex items-center justify-center text-lg font-bold text-white border border-sk-border-2 shadow-sm">
        {rank}<span className={boardSuitClass}>{suitSymbol}</span>
      </div>
    );
  }

  // Estilo para las cartas de Hero (Fondo blanco)
  return (
    <div key={cardString} className="w-8 h-12 md:w-9 md:h-14 bg-white rounded flex items-center justify-center text-sm md:text-lg font-bold text-black border-2 border-sk-border-2 shadow-sm">
      {rank}<span className={heroSuitClass}>{suitSymbol}</span>
    </div>
  );
}

export function HandReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vote, setVote] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVideo() {
      try {
        const { data, error } = await supabase
          .from("shark_tv_videos")
          .select("*")
          .eq("id", id)
          .single();
        
        if (error) throw error;
        if (data) setVideo(data);
      } catch (err) {
        console.error("Error cargando el video:", err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchVideo();
    }
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <div className="min-h-screen flex items-center justify-center bg-sk-bg-1">
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (!video) {
    return (
      <PageShell>
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
          <MonitorPlay size={48} className="text-sk-text-4 mb-4" />
          <h2 className="text-2xl font-bold text-sk-text-1 mb-2">Video no encontrado</h2>
          <p className="text-sk-text-3 mb-6">El análisis que buscas no existe o fue eliminado.</p>
          <Link to="/tv"><Button variant="accent">Volver a SharkTV</Button></Link>
        </div>
      </PageShell>
    );
  }

  const ctx = video.table_context || {};

  return (
    <PageShell>
      <SEOHead title={`${video.title} | SharkTV`} path={`/tv/${video.id}`} />
      
      <div className="pt-20 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          
          <Link to="/tv" className="inline-flex items-center gap-1 text-sk-sm text-sk-text-4 hover:text-sk-accent transition-colors mb-6">
            <ChevronLeft size={16} /> Volver a SharkTV
          </Link>

          <div className="grid lg:grid-cols-12 gap-8">
            
            {/* 🎥 COLUMNA IZQUIERDA: EL VIDEO */}
            <div className="lg:col-span-7 xl:col-span-8">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  {(video.tags || []).map((tag: string, i: number) => (
                    <Badge key={i} variant={i === 0 ? "accent" : "muted"}>{tag}</Badge>
                  ))}
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-sk-text-1 mb-2">
                  {video.title}
                </h1>
                <p className="text-sk-text-3">Analizado por <strong className="text-sk-text-1">{video.instructor_name}</strong></p>
              </div>

              {/* El Embed de RUMBLE y Call To Action */}
              <div className="bg-sk-bg-2 p-4 md:p-8 rounded-2xl border border-sk-border-2 mb-8 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
                
                <RumbleEmbed embedUrl={video.video_url} />
                
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
                    <h3 className="text-xl font-bold text-sk-text-1 mb-2">Decisión Crítica</h3>
                    <p className="text-sk-sm text-sk-text-3 mb-6">
                      Basado en la acción y el rango del rival, ¿Cuál crees que es la línea correcta (GTO o Explotativa) en esta situación específica?
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button variant={vote === "fold" ? "accent" : "secondary"} className="h-12 border-sk-red/50 hover:border-sk-red hover:text-sk-red" onClick={() => setVote("fold")}>
                        Fold
                      </Button>
                      <Button variant={vote === "call" ? "accent" : "secondary"} className="h-12 border-sk-green/50 hover:border-sk-green hover:text-sk-green" onClick={() => setVote("call")}>
                        Call
                      </Button>
                      <Button variant={vote === "raise" ? "accent" : "secondary"} className="h-12 border-sk-gold/50 hover:border-sk-gold hover:text-sk-gold" onClick={() => setVote("raise")}>
                        Raise
                      </Button>
                    </div>
                    {vote && (
                      <div className="mt-4 p-4 bg-sk-bg-0 border border-sk-border-2 rounded-lg animate-fade-in">
                        <p className="text-sk-sm text-sk-text-2">
                          <strong className="text-sk-accent">Veredicto del Analista:</strong> {ctx.analysis_verdict || "Decisión dependiente de factores técnicos explicados en el video."}
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
                      <p className="text-[10px] font-mono text-sk-text-4 uppercase mb-1">Posición Hero</p>
                      <p className="font-bold text-sk-text-1 flex items-center gap-2">
                        {ctx.hero_position || "No definida"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-sk-text-4 uppercase mb-1">Nivel</p>
                      <p className="font-bold text-sk-accent">{video.level || "Avanzado"}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-mono text-sk-text-4 uppercase mb-2">Cartas (Hero)</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {(ctx.hero_cards || []).map((card: string) => renderCard(card, false))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-mono text-sk-text-4 uppercase mb-2">Board</p>
                    <div className="flex gap-1.5">
                      {(ctx.board || []).map((card: string) => renderCard(card, true))}
                      {(!ctx.board || ctx.board.length === 0) && <span className="text-sk-xs text-sk-text-4">Preflop</span>}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-sk-border-2">
                    <p className="text-[10px] font-mono text-sk-text-4 uppercase mb-2">Dinámica de Apuestas</p>
                    <ul className="space-y-2 text-sk-sm">
                      {(ctx.action_history || []).map((h: any, index: number) => (
                        <li key={index} className="flex justify-between">
                          <span className="text-sk-text-3">{h.stage}:</span> 
                          <span className="font-bold text-sk-text-1 text-right max-w-[65%]">{h.action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-sk-accent-dim border border-sk-accent/20 rounded-lg p-3 mt-4">
                    <p className="text-[11px] font-bold text-sk-accent flex items-center gap-1 mb-1">
                      <AlertTriangle size={12} /> Nota Estratégica
                    </p>
                    <p className="text-xs text-sk-text-2 leading-relaxed">
                      "Analiza la textura del board y los rangos percibidos antes de tomar tu decisión. En spots como este, la varianza es alta pero la matemática siempre dicta la rentabilidad a largo plazo."
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