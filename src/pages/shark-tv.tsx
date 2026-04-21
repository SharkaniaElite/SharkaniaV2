import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Link } from "react-router-dom";
import { Play, TrendingUp, Clock, Eye, Sparkles, MonitorPlay } from "lucide-react";
import { Badge } from "../components/ui/badge";

export function SharkTvPage() {
  const videos = [
    {
      id: "plo6-bombpot",
      title: "Análisis PLO6: Top Two Pair en Bombpot Multiway",
      instructor: "Nicolás Fuentes",
      role: "Fundador LatinAllinPoker",
      date: "Hoy",
      duration: "01:00",
      views: "Nuevo",
      level: "Avanzado",
      tags: ["PLO6", "Bombpot", "Exploitative"],
      image: "https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/SharkTv/plo6-foldflush.webp",
      link: "/tv/plo6-bombpot"
    },
    // Aquí agregarás los siguientes videos a futuro
  ];

  return (
    <PageShell>
      <SEOHead
        title="SharkTV: Análisis de Manos | Sharkania"
        description="Aprende la lógica detrás de las jugadas más complejas con Nicolás Fuentes y nuestros expertos."
        path="/tv"
      />
      
      <div className="pt-20 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* ══ HERO SECTION ESTILO LIGAS ══ */}
          <div className="bg-sk-bg-2 border border-sk-accent/20 rounded-2xl p-6 md:p-10 mb-10 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group shadow-[0_0_40px_rgba(34,211,238,0.05)]">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-sk-accent/30 to-transparent" />

            {/* Avatar del Tiburón Analista */}
            <div className="shrink-0 relative z-10">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-sk-accent/10 blur-xl rounded-full scale-150 group-hover:bg-sk-accent/20 transition-colors duration-500" />
                <img
                  src="/mascot/shark-4.webp"
                  alt="Sharkania Analista"
                  className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-2"
                />
              </div>
            </div>

            {/* Textos y Contexto */}
            <div className="flex-1 text-center md:text-left relative z-10">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                <MonitorPlay className="text-sk-accent" size={16} />
                <p className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-sk-accent">
                  CONTENIDO EDUCATIVO
                </p>
                <Sparkles className="text-sk-accent animate-pulse" size={16} />
              </div>

              <h1 className="text-sk-3xl md:text-sk-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-sk-text-1 to-sk-text-4 mb-4 leading-none flex items-center justify-center md:justify-start gap-2">
                Shark<span className="text-sk-accent">TV</span>
              </h1>

              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed max-w-2xl mx-auto md:mx-0">
                Análisis de manos, estrategia explotativa y revisiones de torneos por <strong className="text-sk-text-1">Nicolás Fuentes</strong> y los pros de LatinAllinPoker.
              </p>
            </div>

            {/* Badge Lateral */}
            <div className="shrink-0 relative z-10 hidden md:block">
              <div className="bg-sk-bg-0/50 backdrop-blur-md border border-sk-accent/40 rounded-xl p-4 flex flex-col items-center justify-center shadow-[0_0_25px_rgba(34,211,238,0.15)] group-hover:border-sk-accent transition-colors">
                <TrendingUp className="text-sk-accent mb-2" size={24} />
                <p className="text-[10px] font-mono text-sk-text-1 font-bold uppercase tracking-widest text-center">
                  Nuevos<br/>Episodios
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Link 
                key={video.id} 
                to={video.link}
                className="group flex flex-col bg-sk-bg-2 border border-sk-border-2 rounded-2xl overflow-hidden hover:border-sk-accent/50 transition-all duration-300 shadow-sk-md hover:shadow-[0_0_30px_rgba(34,211,238,0.1)]"
              >
                <div className="h-56 overflow-hidden relative border-b border-sk-border-2">
                  <div className="absolute top-3 left-3 z-10">
                    <Badge variant="accent" className="bg-sk-bg-0/80 backdrop-blur-md">{video.level}</Badge>
                  </div>
                  <div className="absolute bottom-3 right-3 z-10 bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1">
                    <Clock size={10} /> {video.duration}
                  </div>
                  
                  {/* Capa de Play Hover */}
                  <div className="absolute inset-0 bg-sk-bg-0/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="w-16 h-16 rounded-full bg-sk-accent/20 flex items-center justify-center border border-sk-accent/50 group-hover:scale-110 transition-transform">
                      <Play className="text-sk-accent fill-sk-accent ml-1" size={24} />
                    </div>
                  </div>
                  
                  <img src={video.image} alt={video.title} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 opacity-60" />
                </div>
                
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-lg font-bold text-sk-text-1 mb-2 group-hover:text-sk-accent transition-colors leading-tight">
                    {video.title}
                  </h3>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-full bg-sk-bg-4 overflow-hidden border border-sk-border-2">
                      <img src="https://ui-avatars.com/api/?name=Nicolas+Fuentes&background=14151a&color=22d3ee" alt="Nico" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-sk-text-2">{video.instructor}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {video.tags.map(tag => (
                      <span key={tag} className="text-[9px] font-mono uppercase border border-sk-border-2 text-sk-text-3 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-sk-border-2 pt-4 mt-auto">
                    <span className="text-[11px] text-sk-text-4 flex items-center gap-1.5">
                      <Eye size={12} /> {video.views} vistas
                    </span>
                    <span className="text-[11px] font-bold text-sk-text-3">{video.date}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </PageShell>
  );
}