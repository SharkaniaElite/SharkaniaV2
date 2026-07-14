// src/pages/pro-academy-dashboard.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth-store";
import { Button } from "../components/ui/button";
import { PlayCircle, Lock, MonitorPlay, ListVideo, Lightbulb, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "../lib/cn";
import { EmptyState } from "../components/ui/empty-state";
import type { ProModule, ProVideo, ProSubscription } from "../types";

interface ModuleWithVideos extends ProModule {
  videos: ProVideo[];
}

export function ProAcademyDashboardPage() {
  // 🔥 Extraemos también el 'profile' para leer el rol del usuario
  const { user, profile } = useAuthStore();
  const [selectedVideo, setSelectedVideo] = useState<ProVideo | null>(null);
  const [isCinematic, setIsCinematic] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 🛡️ VERIFICACIÓN DE ADMIN: Fuerza bruta con correos exactos por si falla la caché
  const isAcademyAdmin = 
    profile?.role === "super_admin" || 
    profile?.role === "academy_admin" ||
    user?.email === "andresduhau@gmail.com" ||
    user?.email === "nicolas.afv@gmail.com";

  // 1. Verificar si el usuario tiene una suscripción activa
  const { data: subscription, isLoading: loadingSub } = useQuery({
    queryKey: ["pro-subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("pro_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gt("valid_until", new Date().toISOString()) // Que no haya expirado
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as ProSubscription | null;
    },
    enabled: !!user,
  });

  // 2. Traer el contenido (Módulos y Videos). Si no hay sub, RLS bloqueará los videos.
  const { data: modules, isLoading: loadingContent } = useQuery({
    queryKey: ["pro-content"],
    queryFn: async () => {
      // Traemos módulos
      const { data: modsData } = await supabase.from("pro_academy_modules").select("*").order("sort_order");
      // Traemos videos
      const { data: vidsData } = await supabase.from("pro_academy_videos").select("*").order("sort_order");
      
      const mods = (modsData || []) as ProModule[];
      const vids = (vidsData || []) as ProVideo[];

      // Mapeamos los videos dentro de sus módulos
      const structured: ModuleWithVideos[] = mods.map(m => ({
        ...m,
        videos: vids.filter(v => v.module_id === m.id)
      }));

      return structured;
    },
    // 🔥 Si es Admin, cargamos los videos igual, aunque no tenga suscripción pagada
    enabled: !!subscription || isAcademyAdmin, 
  });

  const activeVideo = selectedVideo ?? (modules?.find(m => m.videos.length > 0)?.videos[0] || null);

  const isLoading = loadingSub || ((!!subscription || isAcademyAdmin) && loadingContent);
  // 🔥 Si es Admin, tiene acceso por defecto
  const hasAccess = !!subscription || isAcademyAdmin;

  // ── PANTALLA DE CARGA ──
  if (isLoading) {
    return (
      <PageShell>
        <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-sk-accent/30 border-t-sk-accent rounded-full animate-spin" />
          <p className="text-sk-sm font-mono text-sk-text-3 uppercase tracking-widest animate-pulse">Desencriptando Bóveda...</p>
        </div>
      </PageShell>
    );
  }

  // ── PANTALLA DE ACCESO DENEGADO (PAYWALL) ──
  if (!hasAccess) {
    return (
      <PageShell>
        <SEOHead title="Bóveda Bloqueada | Latin Allin PRO" path="/pro-dashboard" noIndex={true} />
        <div className="pt-20 pb-20 min-h-[80vh] flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sk-red via-orange-500 to-sk-red" />
            <div className="w-20 h-20 bg-sk-bg-3 border border-sk-border-2 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Lock size={32} className="text-sk-text-4" />
            </div>
            <h2 className="text-2xl font-black text-sk-text-1 mb-3">Acceso Restringido</h2>
            <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-8">
              No tienes una suscripción activa a <strong>Latin Allin PRO</strong> o tu periodo de acceso ha expirado. Si ya enviaste tu comprobante, por favor espera a que un administrador lo apruebe.
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/masterclass-latinallin">
                <Button variant="accent" className="w-full shadow-lg shadow-sk-accent/20">Adquirir Suscripción PRO</Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="secondary" className="w-full">Volver a mi Perfil</Button>
              </Link>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── EL "NETFLIX" PRIVADO (DASHBOARD PRO) ──
  return (
    <PageShell>
      <SEOHead title="Bóveda PRO | Aprende con Latin Allin" path="/pro-dashboard" noIndex={true} />
      
      {/* Fondo oscuro para Modo Cine */}
      {isCinematic && (
        <div className="fixed inset-0 bg-black/95 z-[60] transition-opacity duration-700" />
      )}

      <div className={cn("pt-16 pb-16 transition-all duration-500", isCinematic ? "relative z-[70]" : "")}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-col lg:flex-row gap-6">
          
          {/* 🎬 ÁREA PRINCIPAL DE VIDEO */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Cabecera del reproductor */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sk-accent/20 text-sk-accent flex items-center justify-center">
                  <MonitorPlay size={16} />
                </div>
                <div>
                  <h1 className="text-sk-sm font-bold text-sk-text-1 uppercase tracking-widest">
                    Latin Allin <span className="text-sk-accent">PRO</span>
                  </h1>
                </div>
              </div>
              
              <div className="flex gap-2 items-center">
                {/* 🔥 BOTÓN FORZADO: Visible para acceso rápido. La seguridad real está en la ruta. */}
                <Link to="/admin/academy">
                  <Button variant="ghost" size="sm" className="gap-2 text-sk-accent hover:text-sk-accent hover:bg-sk-accent/10 border border-sk-accent/30 mr-2">
                    <Settings size={14} /> Gestionar Bóveda
                  </Button>
                </Link>

                <Button 
                  variant={isCinematic ? "accent" : "secondary"} 
                  size="sm" 
                  onClick={() => setIsCinematic(!isCinematic)}
                  className="gap-2"
                >
                  <Lightbulb size={14} /> {isCinematic ? "Apagar Modo Cine" : "Modo Cine"}
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <ListVideo size={14} />
                </Button>
              </div>
            </div>

            {/* Reproductor (Iframe de Vimeo/Bunny) */}
            <div className="w-full aspect-video bg-black border border-sk-border-2 rounded-xl overflow-hidden shadow-2xl relative mb-6">
              {activeVideo ? (
                <iframe 
                  src={activeVideo.external_video_url} 
                  className="absolute inset-0 w-full h-full" 
                  frameBorder="0" 
                  allow="autoplay; fullscreen; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-sk-text-4">
                  <PlayCircle size={48} className="mb-4 opacity-50" />
                  <p>Selecciona un video de la lista para comenzar</p>
                </div>
              )}
            </div>

            {/* Metadatos del Video */}
            {activeVideo && (
              <div className={cn("bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 transition-opacity", isCinematic ? "opacity-10" : "opacity-100")}>
                <h2 className="text-2xl font-black text-sk-text-1 mb-2">{activeVideo.title}</h2>
                <div className="flex items-center gap-4 text-sk-xs font-mono text-sk-text-4 mb-4">
                  <span className="bg-sk-bg-3 px-2 py-1 rounded">⏱ {activeVideo.duration_minutes} min</span>
                </div>
                {activeVideo.description && (
                  <p className="text-sk-sm text-sk-text-2 leading-relaxed whitespace-pre-wrap">
                    {activeVideo.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 📚 BARRA LATERAL: TEMARIO (ACORDEÓN) */}
          <div className={cn(
            "w-full lg:w-[400px] shrink-0 flex flex-col transition-all duration-300",
            sidebarOpen ? "block" : "hidden lg:flex",
            isCinematic ? "opacity-10 pointer-events-none" : "opacity-100"
          )}>
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden flex flex-col h-full lg:max-h-[85vh]">
              <div className="p-4 bg-sk-bg-3 border-b border-sk-border-2 flex items-center justify-between shrink-0">
                <h3 className="font-bold text-sk-text-1 flex items-center gap-2">
                  <LayoutDashboard size={16} className="text-sk-accent" />
                  Bóveda de Contenido
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {!modules || modules.length === 0 ? (
                  <EmptyState icon="🏗️" title="En construcción" description="El contenido se está subiendo..." />
                ) : (
                  modules.map((module, mIndex) => (
                    <div key={module.id} className="bg-sk-bg-1 border border-sk-border-2 rounded-lg overflow-hidden">
                      {/* Cabecera del Módulo */}
                      <div className="p-3 bg-sk-bg-3/50 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-mono text-sk-accent font-bold uppercase tracking-widest mb-0.5">Módulo {mIndex + 1}</p>
                          <h4 className="text-sk-sm font-bold text-sk-text-1 leading-tight">{module.title}</h4>
                        </div>
                      </div>
                      
                      {/* Lista de Videos */}
                      <div className="flex flex-col">
                        {module.videos.length === 0 ? (
                          <p className="text-[11px] text-sk-text-4 p-3 italic text-center">Próximamente...</p>
                        ) : (
                          module.videos.map((video, vIndex) => {
                            const isActive = activeVideo?.id === video.id;
                            return (
                              <button
                                key={video.id}
                                onClick={() => setSelectedVideo(video)}
                                className={cn(
                                  "text-left p-3 flex items-start gap-3 border-t border-sk-border-2 transition-colors group",
                                  isActive ? "bg-sk-accent/10" : "hover:bg-sk-bg-3"
                                )}
                              >
                                <div className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                                  isActive ? "bg-sk-accent text-black" : "bg-sk-bg-4 text-sk-text-4 group-hover:bg-sk-border-3"
                                )}>
                                  {isActive ? <PlayCircle size={14} /> : <span className="text-[10px] font-bold">{vIndex + 1}</span>}
                                </div>
                                <div className="flex-1 pr-2">
                                  <p className={cn(
                                    "text-sk-sm font-semibold leading-snug mb-1 line-clamp-2 transition-colors",
                                    isActive ? "text-sk-accent" : "text-sk-text-2 group-hover:text-sk-text-1"
                                  )}>
                                    {video.title}
                                  </p>
                                  <p className="text-[10px] font-mono text-sk-text-4">{video.duration_minutes} min</p>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </PageShell>
  );
}