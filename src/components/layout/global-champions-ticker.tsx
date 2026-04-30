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
        const past24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const past72hIso = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
        
        // HOY en formato YYYY-MM-DD para comparar con el end_date de la liga
        const todayString = now.toISOString().split('T')[0];

        const fetchedChampions: Champion[] = [];

        // 1. Torneos (Últimas 24h: Jugadores en position = 1 de torneos completados)
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

        // 2. Ligas (Últimas 72h: LA LÓGICA PERFECTA)
        // Ignoramos el 'status'. Solo pedimos:
        // A) Que sea el rango 1.
        // B) Que el ranking se haya actualizado en las últimas 72 hrs (Acabas de subir el CSV).
        // C) Que la liga ya haya alcanzado su fecha final oficial (Evita coronar en ligas a medias).
        const { data: leaguesData } = await supabase
          .from("league_standings")
          .select("league_id, rank_position, updated_at, leagues!inner(id, name, end_date), players!inner(nickname)")
          .eq("rank_position", 1)
          .gte("updated_at", past72hIso)         // 👈 Se subió el CSV recientemente
          .lte("leagues.end_date", todayString); // 👈 La fecha oficial de la liga ya pasó

        if (leaguesData) {
          leaguesData.forEach((row: any) => {
            fetchedChampions.push({
              id: `l-${row.league_id}`,
              type: "league",
              playerName: row.players?.nickname || "Desconocido",
              eventName: row.leagues?.name || "Liga",
              dateStr: row.updated_at // Usamos el updated_at para que salga fresquito
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