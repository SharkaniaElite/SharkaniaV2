// src/components/layout/global-champions-ticker.tsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Sparkles } from "lucide-react";

type Champion = {
  id: string;
  type: "tournament" | "league";
  playerName: string;
  eventName: string;
  clubName?: string;
  dateStr: string; // Para ordenar quién sale primero
};

export function GlobalChampionsTicker() {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentChampions() {
      try {
        const now = new Date();
        // Hace 24 hrs en formato ISO exacto (para TIMESTAMP)
        const past24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        
        // Hace 72 hrs en formato YYYY-MM-DD (para coincidir con el DATE de PostgreSQL)
        const past72hDate = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        const past72hString = past72hDate.toISOString().split('T')[0];
        
        // HOY en formato YYYY-MM-DD (nuestro límite superior temporal)
        const todayString = now.toISOString().split('T')[0];

        const fetchedChampions: Champion[] = [];

        // 1. Torneos (Últimas 24h: Jugadores en position = 1)
        const { data: tourneyData } = await supabase
          .from("tournament_results")
          .select("id, tournaments!inner(id, name, start_datetime, clubs(name)), players!inner(nickname)")
          .eq("position", 1)
          .eq("tournaments.status", "completed")
          .gte("tournaments.start_datetime", past24hIso);

        if (tourneyData) {
          tourneyData.forEach((r: any) => {
            const clubData = r.tournaments?.clubs;
            const clubName = Array.isArray(clubData) ? clubData[0]?.name : clubData?.name;
            
            fetchedChampions.push({
              id: `t-${r.id}`,
              type: "tournament",
              playerName: r.players?.nickname || "Desconocido",
              eventName: r.tournaments?.name || "Torneo",
              clubName: clubName,
              dateStr: r.tournaments?.start_datetime
            });
          });
        }

        // 2. Ligas (Últimas 72h: DOBLE CANDADO TEMPORAL)
        const { data: leaguesData } = await supabase
          .from("league_standings")
          .select("league_id, rank_position, leagues!inner(id, name, end_date, status), players!inner(nickname)")
          .eq("rank_position", 1)
          .gte("leagues.end_date", past72hString)
          .lte("leagues.end_date", todayString) // 👈 Candado 1: No toma ligas que terminan en el futuro
          .neq("leagues.status", "active");     // 👈 Candado 2: La liga no debe estar activa

        if (leaguesData) {
          leaguesData.forEach((row: any) => {
            fetchedChampions.push({
              id: `l-${row.league_id}`,
              type: "league",
              playerName: row.players?.nickname || "Desconocido",
              eventName: row.leagues?.name || "Liga",
              dateStr: row.leagues?.end_date
            });
          });
        }

        // Ordenamos del más reciente al más antiguo y removemos torneos repetidos
        fetchedChampions.sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());
        const uniqueChampions = Array.from(new Map(fetchedChampions.map(item => [item.eventName, item])).values());
        
        setChampions(uniqueChampions);
      } catch (error) {
        console.error("Error fetching champions:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecentChampions();
  }, []);

  if (isLoading || champions.length === 0) return null;

  return (
    <div className="w-full bg-sk-bg-2 border-b border-sk-border-2 overflow-hidden flex items-center h-10 relative z-[100] shadow-sm">
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-sk-bg-2 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-sk-bg-2 to-transparent z-10" />
      
      {/* Etiqueta Fija a la izquierda */}
      <div className="absolute left-0 top-0 bottom-0 bg-sk-bg-3 border-r border-sk-border-2 px-4 flex items-center gap-2 z-20 shadow-[5px_0_15px_rgba(0,0,0,0.6)]">
        <Sparkles size={14} className="text-sk-accent" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white hidden sm:inline">Salón de la Fama</span>
      </div>

      {/* Contenedor Animado (Marquee) */}
      <div className="flex whitespace-nowrap animate-[marquee_25s_linear_infinite] pl-40 sm:pl-56 items-center gap-10">
        {[...champions, ...champions].map((champ, index) => (
          <div key={`dup-${champ.id}-${index}`} className="flex items-center gap-3">
            
            {/* Emojis Diferenciados y de Gran Tamaño */}
            {champ.type === "league" ? (
              <span className="text-[28px] drop-shadow-[0_0_15px_rgba(250,204,21,0.9)] leading-none -translate-y-1">👑</span>
            ) : (
              <span className="text-[18px] drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] leading-none">🏆</span>
            )}
            
            {/* Texto Fuerte: Cian (sk-accent) para Jugador, Blanco para la hazaña */}
            <span className="text-[14px] font-black text-sk-accent drop-shadow-[0_0_8px_rgba(34,211,238,0.3)] tracking-wide uppercase">
              {champ.playerName}
            </span>
            <span className="text-[12px] text-white font-bold tracking-tight uppercase">
              GANÓ {champ.eventName} {champ.clubName ? `(${champ.clubName})` : ""}
            </span>
            
            <span className="text-sk-border-2 ml-6 text-xl font-thin opacity-50">|</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}