import { useState, useEffect } from "react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Link } from "react-router-dom";
import { Play, TrendingUp, Clock, Eye, Sparkles, MonitorPlay } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";

export function SharkTvPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVideos() {
      try {
        const { data, error } = await supabase
          .from('shark_tv_videos')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (data) setVideos(data);
      } catch (err) {
        console.error("Error al cargar videos:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVideos();
  }, []);

  return (
    <PageShell>
      <SEOHead
        title="SharkTV: Análisis de Manos | Sharkania"
        description="Aprende la lógica detrás de las jugadas más complejas con Nicolás Fuentes y nuestros expertos."
        path="/tv"
      />
      
      <div className="pt-20 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* 📺 HERO SECTION */}
          <div className="relative rounded-3xl overflow-hidden mb-16 border border-sk-border-2 bg-sk-bg-2">
            <div className="absolute inset-0 bg-gradient-to-r from-sk-bg-0 via-sk-bg-0/60 to-transparent z-10" />
            <img 
              src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/SharkTv/plo6-2.webp" 
              alt="SharkTV Hero" 
              className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[2px]"
            />
            
            <div className="relative z-20 p-8 md:p-16 max-w-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-sk-accent animate-pulse" />
                <span className="text-sk-accent font-mono text-xs uppercase tracking-widest font-bold">En línea ahora</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-sk-text-1 mb-6 leading-tight">
                DOMINA EL <span className="text-sk-accent">META</span> DEL POKER
              </h1>
              <p className="text-sk-lg text-sk-text-2 mb-8 leading-relaxed">
                Análisis tácticos de manos reales, estrategias de GTO aplicadas y la mentalidad necesaria para aplastar los niveles más difíciles de ClubGG.
              </p>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-sk-bg-3/50 backdrop-blur-md rounded-full border border-sk-border-3 text-sk-xs font-bold text-sk-text-1">
                  <Sparkles size={14} className="text-sk-gold" /> Estrategias Exclusivas
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-sk-bg-3/50 backdrop-blur-md rounded-full border border-sk-border-3 text-sk-xs font-bold text-sk-text-1">
                  <TrendingUp size={14} className="text-sk-accent" /> Basado en Data
                </div>
              </div>
            </div>
          </div>

          {/* 📽️ VIDEO GRID */}
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-sk-text-1 flex items-center gap-3">
              <MonitorPlay className="text-sk-accent" size={28} />
              Últimos Episodios
            </h2>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-sk-border-2 to-transparent ml-8" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full flex justify-center py-20">
                <Spinner size="lg" />
              </div>
            ) : videos.length === 0 ? (
              <div className="col-span-full text-center py-20 border border-sk-border-2 rounded-2xl bg-sk-bg-2">
                <MonitorPlay className="mx-auto text-sk-text-4 mb-3" size={40} />
                <p className="text-sk-text-3">Aún no hay videos publicados. ¡Ve al Super Admin y lanza el primero!</p>
              </div>
            ) : (
              videos.map((video) => (
                <Link 
                  key={video.id} 
                  to={`/tv/${video.id}`}
                  className="group flex flex-col bg-sk-bg-2 border border-sk-border-2 rounded-2xl overflow-hidden hover:border-sk-accent/50 transition-all duration-300 shadow-sk-md hover:shadow-[0_0_30px_rgba(34,211,238,0.1)]"
                >
                  <div className="h-56 overflow-hidden relative border-b border-sk-border-2">
                    <div className="absolute top-3 left-3 z-10">
                      <Badge variant="accent" className="bg-sk-bg-0/80 backdrop-blur-md">{video.level || "Avanzado"}</Badge>
                    </div>
                    <div className="absolute bottom-3 right-3 z-10 bg-black/80 text-white text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1">
                      <Clock size={10} /> {video.duration || "00:00"}
                    </div>
                    
                    <div className="absolute inset-0 bg-sk-bg-0/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center justify-center backdrop-blur-[2px]">
                      <div className="w-16 h-16 rounded-full bg-sk-accent/20 flex items-center justify-center border border-sk-accent/50 group-hover:scale-110 transition-transform">
                        <Play className="text-sk-accent fill-sk-accent ml-1" size={24} />
                      </div>
                    </div>
                    
                    <img 
                      src={video.thumbnail_url} 
                      alt={video.title} 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 opacity-60" 
                    />
                  </div>
                  
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="text-lg font-bold text-sk-text-1 mb-2 group-hover:text-sk-accent transition-colors leading-tight">
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-full bg-sk-bg-4 overflow-hidden border border-sk-border-2">
                        <img 
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(video.instructor_name || "Nicolas Fuentes")}&background=14151a&color=22d3ee`} 
                          alt="Instructor" 
                        />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-sk-text-2">{video.instructor_name || "Nicolás Fuentes"}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(video.tags || []).map((tag: string) => (
                        <span key={tag} className="text-[9px] font-mono uppercase border border-sk-border-2 text-sk-text-3 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-sk-border-2 pt-4 mt-auto">
                      <span className="text-[11px] text-sk-text-4 flex items-center gap-1.5">
                        <Eye size={12} /> Nuevo
                      </span>
                      <span className="text-[11px] font-bold text-sk-text-3">
                        {new Date(video.created_at).toLocaleDateString("es-ES", { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}