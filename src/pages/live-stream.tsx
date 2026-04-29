// src/pages/live-stream.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth-store";
import { cn } from "../lib/cn";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { LiveChat } from "../components/live/live-chat";
import { Badge } from "../components/ui/badge";
import { Trophy, Star, Crown, Tv, MessageCircle, FileText } from "lucide-react";

// Componente inyectado para las encuestas en vivo
function LivePollPanel() {
  const { user } = useAuthStore();
  const [poll, setPoll] = useState<any>(null);
  const [votes, setVotes] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("primary_nickname, display_name").eq("id", user.id).single()
        .then(({ data }) => { if (data) setUserProfile(data); });
    }
  }, [user]);

  useEffect(() => {
    const fetchPoll = async () => {
      const { data: pollData } = await supabase.from("live_polls").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(1).single();
      if (pollData) {
        setPoll(pollData);
        const { data: voteData } = await supabase.from("live_poll_votes").select("*").eq("poll_id", pollData.id);
        if (voteData) setVotes(voteData);
      } else {
        setPoll(null);
        setVotes([]);
      }
    };
    fetchPoll();

    const pollChannel = supabase.channel("public:live_polls")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_polls" }, () => fetchPoll())
      .subscribe();

    const voteChannel = supabase.channel("public:live_poll_votes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_poll_votes" }, (payload) => {
         setVotes(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(pollChannel); supabase.removeChannel(voteChannel); };
  }, []);

  const handleVote = async (index: number) => {
    if (!user || !poll || !userProfile) return;
    const hasVoted = votes.some(v => v.user_id === user.id);
    if (hasVoted) return;

    const finalNickname = userProfile.primary_nickname || userProfile.display_name || `Shark_${user.id.substring(0, 4).toUpperCase()}`;

    await supabase.from("live_poll_votes").insert([{
      poll_id: poll.id,
      user_id: user.id,
      user_nickname: finalNickname,
      option_index: index
    }]);
  };

  if (!poll) return null;

  const userVoted = user ? votes.some(v => v.user_id === user.id) : false;

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 bg-gradient-to-br from-sk-bg-2 to-sk-bg-3 p-5 rounded-2xl border border-sk-border-2 relative overflow-hidden group">
        <h4 className="text-sk-sm font-black text-sk-text-1 uppercase mb-2 flex items-center gap-2">
          <Star size={16} className="text-sk-accent animate-pulse" /> Encuesta en Vivo
        </h4>
        <p className="text-sm text-sk-text-2 mb-4">{poll.question}</p>
        <div className="flex flex-col gap-2 relative z-10 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
          {poll.options.map((opt: string, i: number) => {
            const optionVotes = votes.filter(v => v.option_index === i).length;
            const percent = votes.length > 0 ? Math.round((optionVotes / votes.length) * 100) : 0;
            return (
              <div key={i} className="relative w-full">
                <div className="absolute top-0 left-0 h-full bg-sk-accent/15 rounded-lg transition-all duration-500" style={{ width: `${percent}%` }} />
                <button
                  disabled={!user || userVoted}
                  onClick={() => handleVote(i)}
                  className={cn(
                    "relative w-full flex justify-between items-center text-left text-sk-sm font-bold py-2 px-4 rounded-lg transition-all border",
                    userVoted ? "border-transparent text-sk-text-1 cursor-default" : "bg-sk-bg-0 hover:bg-sk-accent/20 border-sk-border-2 hover:border-sk-accent text-sk-text-1 shadow-sm"
                  )}
                >
                  <span className="truncate pr-4 z-10">{opt}</span>
                  <span className="text-sk-xs text-sk-text-3 z-10 whitespace-nowrap">{optionVotes} votos ({percent}%)</span>
                </button>
              </div>
            );
          })}
        </div>
        {!user && (
           <div className="mt-4 flex items-center justify-center p-3 bg-sk-bg-0 rounded-lg border border-sk-border-2">
              <p className="text-sk-xs text-sk-text-3">Para votar debes <Link to="/register" className="text-sk-accent hover:underline font-bold">registrarte</Link> o <Link to="/login" className="text-sk-accent hover:underline font-bold">iniciar sesión</Link>.</p>
           </div>
        )}
      </div>

      <div className="bg-sk-bg-2 border border-sk-border-2 p-5 rounded-2xl flex flex-col max-h-[350px]">
        <h4 className="text-sk-xs font-bold text-sk-text-3 uppercase tracking-widest mb-3 border-b border-sk-border-2 pb-2">Han respondido ({votes.length})</h4>
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin pr-1">
          {votes.slice().reverse().map(v => (
            <div key={v.id} className="flex justify-between items-center text-[11px] bg-sk-bg-3 p-2 rounded animate-fade-in">
              <span className="font-bold text-sk-text-1 truncate pr-2" title={v.user_nickname}>{v.user_nickname}</span>
              <span className="text-sk-text-4 font-mono truncate max-w-[50%] text-right" title={poll.options[v.option_index]}>{poll.options[v.option_index]}</span>
            </div>
          ))}
          {votes.length === 0 && <p className="text-sk-xs text-sk-text-4 text-center italic mt-4">Nadie ha votado aún</p>}
        </div>
      </div>
    </div>
  );
}

export function LiveStreamPage() {
  return (
    <PageShell>
      <SEOHead 
        title="🔴 EN VIVO: Liga Poker Austral 14° Edición | Fecha 1" 
        description="Cobertura oficial de la Liga Poker Austral 2026. Análisis en vivo por Osvaldo Colombo y Andrés Duhau. Participa en nuestra encuesta en vivo."
        path="/live"
      />
      
      <div className="pt-20 h-screen flex flex-col lg:flex-row overflow-hidden bg-sk-bg-1 border-t border-sk-border-2">
        
        {/* 🎬 AREA DEL STREAMING (Izquierda) */}
        <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin">
          <div className="w-full bg-black relative aspect-video border-b border-sk-border-2 shadow-2xl">
            <iframe
              src="https://rumble.com/embed/v76yzcg/?pub=4par2u"
              className="absolute inset-0 w-full h-full"
              frameBorder="0"
              allowFullScreen
            />
          </div>

          <div className="p-6 md:p-8 max-w-5xl mx-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="accent" className="bg-red-500/10 text-red-500 border-red-500/20 animate-pulse flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" /> TRANSMISIÓN OFICIAL
                  </Badge>
                  <span className="text-sk-xs text-sk-text-3 font-mono flex items-center gap-1 bg-sk-bg-2 px-2 py-1 rounded border border-sk-border-2">
                    <Tv size={12} className="text-sk-accent" /> Pokerkai x Sharkania
                  </span>
                </div>
                <h1 className="text-2xl md:text-[1.7rem] font-black text-sk-text-1 tracking-tight leading-tight mb-3 flex items-center gap-2.5">
                  Liga Poker Austral 14° Edición | Fecha 1 <Crown size={24} className="text-sk-gold shrink-0" />
                </h1>
                <p className="text-sk-sm text-sk-text-3">
                  Cobertura y análisis táctico por <strong className="text-sk-accent">Osvaldo Colombo (Kolonvo)</strong> y <strong className="text-sk-accent">Andrés Duhau (Clerigo)</strong>.
                </p>
              </div>

              <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto min-w-[260px]">
                 <div className="bg-sk-bg-2 border border-sk-border-2 px-4 py-3 rounded-xl flex items-center gap-4 shadow-inner">
                   <div className="w-12 h-12 rounded-full bg-sk-gold/10 flex items-center justify-center border border-sk-gold/20 shrink-0">
                     <Trophy size={22} className="text-sk-gold" />
                   </div>
                   <div className="flex-1">
                     <p className="text-[11px] text-sk-text-2 uppercase font-black tracking-widest mb-1 drop-shadow-sm">Premio al Campeón de Liga</p>
                     <div className="flex items-baseline gap-1.5 mb-1">
                        <p className="text-xl font-black text-sk-text-1 leading-none">$1.000.000</p>
                        <span className="text-sk-sm font-bold text-sk-text-1">o</span>
                     </div>
                     <p className="text-[10px] text-sk-gold font-mono uppercase font-bold tracking-tight">ME Ovalle Poker Series + Estadía</p>
                   </div>
                 </div>

                 {/* Contenedor de Botones (WhatsApp + Bases) */}
                 <div className="flex flex-col gap-2">
                   <div className="bg-sk-accent/10 border border-sk-accent/30 rounded-lg p-2.5 hover:bg-sk-accent/15 transition-colors">
                     <a href="https://wa.me/56963333871?text=Hola%20Roberto,%20quiero%20inscribirme%20en%20la%20Liga%20Poker%20Austral." target="_blank" rel="noreferrer" className="flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-full bg-sk-accent flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(17,202,160,0.4)]">
                           <MessageCircle size={16} className="fill-sk-bg-1" />
                        </div>
                        <div>
                           <p className="text-[10px] uppercase font-bold tracking-tight text-sk-text-1">Inscripciones con Roberto F.</p>
                           <p className="text-[11px] text-sk-accent font-semibold group-hover:underline">Formaliza tu cupo aquí</p>
                        </div>
                     </a>
                   </div>
                   
                   {/* NUEVO: Botón sutil hacia las bases */}
                   <Link to="/liga-austral-bases" className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-sk-border-2 bg-sk-bg-0 hover:bg-sk-bg-2 hover:border-sk-text-4 transition-all text-sk-xs text-sk-text-3 hover:text-sk-text-1 group">
                     <FileText size={14} className="group-hover:text-sk-accent transition-colors" />
                     <span className="font-semibold uppercase tracking-wide">Leer Bases Oficiales</span>
                   </Link>
                 </div>
              </div>

            </div>

            {/* 🔥 Panel de Encuestas en Vivo Dinámico */}
            <LivePollPanel />
            
          </div>
        </div>

        {/* 💬 AREA DEL CHAT (Derecha) */}
        <aside className="w-full lg:w-[350px] xl:w-[400px] h-[500px] lg:h-auto shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10">
          <LiveChat />
        </aside>
        
      </div>
    </PageShell>
  );
}