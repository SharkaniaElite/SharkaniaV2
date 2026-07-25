import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Sparkles, ExternalLink } from "lucide-react";

type TickerItem = {
  id: string;
  isManual: boolean;
  emoji: string;
  highlightText: string;
  mainText: string;
  linkUrl: string | null;
  dateStr: string;
};

export function GlobalChampionsTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTickerData() {
      try {
        // 1. Fetch de la base de datos (Anuncios manuales y Overrides de Links)
        const { data: dbItems } = await supabase
          .from("teleprompter_items")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        // Procesar manuales
        const manualItems: TickerItem[] = (dbItems || [])
          .filter((i) => i.type === "manual")
          .map((i) => ({
            id: i.id,
            isManual: true,
            emoji: i.emoji || "📣",
            highlightText: "ANUNCIO",
            mainText: i.text_content,
            linkUrl: i.link_url,
            dateStr: i.created_at,
          }));

        // Guardar overrides en memoria
        const overrides = (dbItems || []).filter((i) => i.type === "champion_override");

        // 2. Fetch de Campeones Automáticos (Misma lógica de tiempo)
        const now = new Date();
        const past24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const todayString = now.toISOString().split("T")[0];
        const past4DaysString = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const autoItems: TickerItem[] = [];

        // Lógica: Torneos
        const { data: tourneyData } = await supabase
          .from("tournament_results")
          .select("id, tournaments!inner(id, name, start_datetime, clubs!club_id(name)), players!inner(nickname)")
          .eq("position", 1)
          .eq("tournaments.status", "completed")
          .gte("tournaments.start_datetime", past24hIso);

        if (tourneyData) {
          tourneyData.forEach((r: any) => {
            const clubData = r.tournaments?.clubs;
            const clubName = Array.isArray(clubData) ? clubData[0]?.name : clubData?.name;
            const autoId = `t-${r.id}`;
            const override = overrides.find((o) => o.text_content === autoId); // Buscar si admin le puso link

            autoItems.push({
              id: autoId,
              isManual: false,
              emoji: "🏆",
              highlightText: r.players?.nickname || "Desconocido",
              mainText: `GANÓ ${r.tournaments?.name} ${clubName ? `(${clubName})` : ""}`,
              linkUrl: override?.link_url || null,
              dateStr: r.tournaments?.start_datetime,
            });
          });
        }

        // Lógica: Ligas
        const { data: leaguesData } = await supabase
          .from("league_standings")
          .select("league_id, leagues!inner(id, name, end_date), players!inner(nickname)")
          .eq("rank_position", 1)
          .lte("leagues.end_date", todayString)
          .gte("leagues.end_date", past4DaysString);

        if (leaguesData) {
          leaguesData.forEach((row: any) => {
            const autoId = `l-${row.league_id}`;
            const override = overrides.find((o) => o.text_content === autoId); // Buscar si admin le puso link

            autoItems.push({
              id: autoId,
              isManual: false,
              emoji: "👑",
              highlightText: row.players?.nickname || "Desconocido",
              mainText: `GANÓ ${row.leagues?.name}`,
              linkUrl: override?.link_url || null,
              dateStr: row.leagues?.end_date,
            });
          });
        }

        // Unir y ordenar automáticos por fecha
        autoItems.sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());
        // Eliminar posibles repetidos
        const uniqueAuto = Array.from(new Map(autoItems.map((item) => [item.mainText, item])).values());

        // Mezclar Manuales + Automáticos
        setItems([...manualItems, ...uniqueAuto]);
      } catch (error) {
        console.error("Error fetching ticker data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTickerData();
  }, []);

  if (isLoading || items.length === 0) return null;

  return (
    <div className="w-full bg-transparent overflow-hidden flex items-center h-10 relative z-[100] group">
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-sk-bg-2 to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-sk-bg-2 to-transparent z-10" />

      {/* Etiqueta Fija a la izquierda */}
      <div className="absolute left-0 top-0 bottom-0 bg-sk-bg-3 border-r border-sk-border-2 px-4 flex items-center gap-2 z-20 shadow-[5px_0_15px_rgba(0,0,0,0.6)]">
        <Sparkles size={14} className="text-sk-accent" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white hidden sm:inline">
          Novedades
        </span>
      </div>

      {/* Contenedor Animado (Marquee) que se PAUSA al pasar el mouse (hover) */}
      <div className="flex whitespace-nowrap animate-[marquee_25s_linear_infinite] group-hover:[animation-play-state:paused] pl-40 sm:pl-56 items-center gap-10">
        {[...items, ...items, ...items].map((item, index) => {
          
          const content = (
            <>
              <span className="text-[18px] drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] leading-none -translate-y-0.5">
                {item.emoji}
              </span>
              <span className="text-[13px] font-black text-sk-accent drop-shadow-[0_0_8px_rgba(34,211,238,0.3)] tracking-wide uppercase">
                {item.highlightText}
              </span>
              <span className="text-[12px] text-white font-bold tracking-tight uppercase">
                {item.isManual ? "" : "-"} {item.mainText}
              </span>
              {item.linkUrl && (
                <ExternalLink size={12} className="text-sk-text-3 group-hover:text-sk-accent transition-colors ml-1" />
              )}
            </>
          );

          return (
            <div key={`dup-${item.id}-${index}`} className="flex items-center gap-3">
              {item.linkUrl ? (
                <a
                  href={item.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer group/link"
                >
                  {content}
                </a>
              ) : (
                <div className="flex items-center gap-2">
                  {content}
                </div>
              )}
              <span className="text-sk-border-2 ml-6 text-xl font-thin opacity-50">|</span>
            </div>
          );
        })}
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