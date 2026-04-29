// src/components/live/live-chat.tsx
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth-store";
import { Send, Lock, Crown } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export function LiveChat() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // 1. Obtener datos exactos del usuario actual (ELO y Nickname)
  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("primary_nickname, display_name, unified_elo, role").eq("id", user.id).single()
        .then(({ data }) => { if (data) setUserProfile(data); });
    }
  }, [user]);

  // 2. Cargar historial y suscribirse al tiempo real
  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await supabase
        .from("live_chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data);
    };

    fetchInitial();

    const channel = supabase
      .channel("live-stream-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // 3. Auto-scroll al recibir mensaje nuevo
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !userProfile) return;

    // Lógica de Fallback para el Nickname
    const finalNickname = 
      userProfile.primary_nickname || 
      userProfile.display_name || 
      `Shark_${user.id.substring(0, 4).toUpperCase()}`;

    // Truco Maestro: Si es admin/super_admin, le damos un ELO secreto de 9999 para identificarlo como HOST
    const isHost = userProfile.role === 'super_admin' || userProfile.role === 'admin';
    const finalElo = isHost ? 9999 : (userProfile.unified_elo !== null ? userProfile.unified_elo : 0);

    await supabase.from("live_chat_messages").insert([{
        user_id: user.id,
        content: newMessage,
        user_nickname: finalNickname,
        user_elo: finalElo
    }]);
    
    setNewMessage("");
  };

  // Función rápida para determinar color según ELO (puedes reemplazarla con tu componente RankBadge real)
  const getEloColor = (elo: number) => {
    if (elo >= 2000) return "text-sk-gold border-sk-gold";
    if (elo >= 1500) return "text-purple-400 border-purple-400";
    if (elo >= 1200) return "text-sk-accent border-sk-accent";
    return "text-sk-text-3 border-sk-border-2";
  };

  return (
    <div className="flex flex-col h-full bg-sk-bg-2 border-l border-sk-border-2 w-full">
      <div className="p-4 border-b border-sk-border-2 bg-sk-bg-3 flex items-center justify-between">
        <h3 className="font-black text-sk-sm text-sk-text-1 uppercase tracking-tighter flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          Chat del Torneo
        </h3>
        <Badge variant="muted" className="text-[9px]">Exclusivo Registrados</Badge>
      </div>

      {/* 💬 Zona de Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-sk-bg-4">
        {messages.map((msg) => (
          <div key={msg.id} className="group flex flex-col gap-1 animate-fade-in">
            <div className="flex items-baseline gap-2">
              {msg.user_elo === 9999 ? (
                // 👑 Medalla exclusiva para el HOST / Admin
                <span className="text-[9px] px-1.5 py-0.5 border border-sk-gold bg-sk-gold/20 text-sk-gold rounded uppercase tracking-wider font-black flex items-center gap-1 shadow-[0_0_8px_rgba(250,204,21,0.4)]" title="Transmisión Oficial">
                  <Crown size={10} /> HOST
                </span>
              ) : msg.user_elo === 0 ? (
                // Medalla para usuarios SIN rango (Observadores)
                <span className="text-[8px] px-1.5 py-0.5 border border-sk-text-4/30 bg-sk-bg-3 text-sk-text-4 rounded uppercase tracking-wider font-bold" title="Aún no ha jugado torneos">
                  OBSERVADOR
                </span>
              ) : (
                // Medalla para Jugadores con ELO
                <span className={`text-[9px] px-1.5 py-0.5 border rounded font-mono font-bold ${getEloColor(msg.user_elo)}`}>
                  {Math.round(msg.user_elo)} ELO
                </span>
              )}
              
              <span className={`text-[11px] font-black ${msg.user_elo >= 1500 || msg.user_elo === 9999 ? "text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" : "text-sk-text-2"}`}>
                {msg.user_nickname}
              </span>
              <span className="text-[9px] text-sk-text-4 font-mono ml-auto">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sk-sm text-sk-text-1 leading-snug break-words">
              {msg.content}
            </p>
          </div>
        ))}
      </div>

      {/* ⌨️ Zona de Input */}
      <div className="p-4 bg-sk-bg-3 border-t border-sk-border-2">
        {user ? (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Analiza la mano..."
              className="flex-1 bg-sk-bg-0 border border-sk-border-2 rounded px-3 py-2 text-sk-sm text-sk-text-1 focus:border-sk-accent outline-none focus:ring-1 focus:ring-sk-accent/50"
              maxLength={200}
            />
            <Button variant="accent" size="sm" type="submit" disabled={!newMessage.trim()} className="px-3">
              <Send size={16} className={newMessage.trim() ? "fill-sk-bg-1" : ""} />
            </Button>
          </form>
        ) : (
          <Link to="/register" className="flex items-center justify-center gap-2 py-3 bg-sk-bg-0 rounded border border-sk-border-2 text-sk-text-4 hover:text-sk-accent hover:border-sk-accent transition-colors text-xs italic group">
            <Lock size={12} className="group-hover:text-sk-accent" /> Haz clic aquí para registrarte y comentar
          </Link>
        )}
      </div>
    </div>
  );
}