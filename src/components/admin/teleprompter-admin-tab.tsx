import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Trash2, Plus, Sparkles, Save, X as XIcon, Link as LinkIcon } from "lucide-react";
import { cn } from "../../lib/cn";

type DisplayItem = {
  id: string;
  db_id?: string;
  type: "manual" | "auto";
  emoji: string;
  text_content: string;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
};

export function TeleprompterAdminTab() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState<Partial<DisplayItem> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Traer TODO: Manuales, Overrides y Campeones Automáticos
  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-teleprompter-items"],
    queryFn: async () => {
      // 1. Traer manuales y overrides guardados
      const { data: dbItems, error } = await supabase
        .from("teleprompter_items")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      
      if (error) throw error;

      // 2. Calcular los automáticos igual que en el ticker
      const now = new Date();
      const past24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const todayString = now.toISOString().split('T')[0];
      const past4DaysString = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const autoItems: DisplayItem[] = [];

      // Torneos automáticos
      const { data: tourneyData } = await supabase
        .from("tournament_results")
        .select("id, tournaments!inner(name, start_datetime, clubs!club_id(name)), players!inner(nickname)")
        .eq("position", 1)
        .eq("tournaments.status", "completed")
        .gte("tournaments.start_datetime", past24hIso);

      if (tourneyData) {
        tourneyData.forEach((r: any) => {
          const clubData = r.tournaments?.clubs;
          const clubName = Array.isArray(clubData) ? clubData[0]?.name : clubData?.name;
          const autoId = `t-${r.id}`;
          const override = dbItems.find((i: any) => i.type === 'champion_override' && i.text_content === autoId);
          
          autoItems.push({
            id: autoId,
            db_id: override?.id,
            type: "auto",
            emoji: "🏆",
            text_content: `${r.players?.nickname} GANÓ ${r.tournaments?.name} ${clubName ? `(${clubName})` : ""}`,
            link_url: override?.link_url || "",
            is_active: true,
            sort_order: 99
          });
        });
      }

      // Ligas automáticas
      const { data: leaguesData } = await supabase
        .from("league_standings")
        .select("league_id, leagues!inner(name, end_date), players!inner(nickname)")
        .eq("rank_position", 1)
        .lte("leagues.end_date", todayString)
        .gte("leagues.end_date", past4DaysString);

      if (leaguesData) {
        leaguesData.forEach((row: any) => {
          const autoId = `l-${row.league_id}`;
          const override = dbItems.find((i: any) => i.type === 'champion_override' && i.text_content === autoId);

          autoItems.push({
            id: autoId,
            db_id: override?.id,
            type: "auto",
            emoji: "👑",
            text_content: `${row.players?.nickname} GANÓ ${row.leagues?.name}`,
            link_url: override?.link_url || "",
            is_active: true,
            sort_order: 98
          });
        });
      }

      // Parsear los manuales
      const manuals: DisplayItem[] = dbItems.filter((i: any) => i.type === 'manual').map((i: any) => ({
        id: i.id,
        db_id: i.id,
        type: 'manual',
        emoji: i.emoji,
        text_content: i.text_content,
        link_url: i.link_url,
        is_active: i.is_active,
        sort_order: i.sort_order
      }));

      return [...manuals, ...autoItems];
    }
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isEditing?.type === "auto") {
        // Guardar Link en Campeón Automático
        const payload = {
          type: "champion_override",
          text_content: isEditing.id, // Guardamos el ID del torneo/liga
          link_url: isEditing.link_url || null,
          emoji: "🏆",
          is_active: true,
          sort_order: 0
        };

        if (isEditing.db_id) {
          await supabase.from("teleprompter_items").update(payload).eq("id", isEditing.db_id);
        } else {
          await supabase.from("teleprompter_items").insert([payload]);
        }
      } else {
        // Guardar Anuncio Manual
        if (!isEditing?.text_content?.trim()) return alert("El texto es obligatorio.");
        
        const payload = {
          type: "manual",
          text_content: isEditing.text_content,
          link_url: isEditing.link_url || null,
          emoji: isEditing.emoji || "📣",
          is_active: isEditing.is_active ?? true,
          sort_order: isEditing.sort_order ?? 0
        };

        if (isEditing.id && isEditing.id !== 'new') {
          await supabase.from("teleprompter_items").update(payload).eq("id", isEditing.id);
        } else {
          await supabase.from("teleprompter_items").insert([payload]);
        }
      }

      setIsEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin-teleprompter-items"] });
    } catch (e: any) {
      alert("Error al guardar: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este anuncio manual?")) return;
    try {
      await supabase.from("teleprompter_items").delete().eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["admin-teleprompter-items"] });
    } catch (e: any) {
      alert("Error al eliminar: " + e.message);
    }
  };

  const handleToggleActive = async (item: DisplayItem) => {
    if (item.type === 'auto') return; // Automáticos no se apagan desde aquí
    try {
      await supabase.from("teleprompter_items").update({ is_active: !item.is_active }).eq("id", item.id);
      queryClient.invalidateQueries({ queryKey: ["admin-teleprompter-items"] });
    } catch (e: any) {
      alert("Error al cambiar estado: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-sk-bg-2 p-5 rounded-xl border border-sk-border-2">
        <div>
          <h3 className="text-sk-sm font-bold text-sk-text-1 flex items-center gap-2">
            <Sparkles size={16} className="text-sk-accent" />
            Control del Teleprompter
          </h3>
          <p className="text-sk-xs text-sk-text-3 mt-1">
            Los campeones recientes aparecen automáticamente. Puedes añadirles un enlace o crear anuncios manuales extra.
          </p>
        </div>
        <Button variant="accent" size="sm" onClick={() => setIsEditing({ id: 'new', type: 'manual', emoji: "📣", is_active: true, sort_order: 0 })}>
          <Plus size={14} className="mr-1" /> Nuevo Anuncio Manual
        </Button>
      </div>

      {isEditing && (
        <div className="bg-sk-bg-3 p-5 rounded-xl border border-sk-accent/30 shadow-sk-lg mb-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sk-sm font-bold text-sk-text-1">
              {isEditing.type === 'auto' ? "Añadir Enlace a Campeón" : isEditing.id === 'new' ? "Crear Anuncio" : "Editar Anuncio"}
            </h4>
            <button onClick={() => setIsEditing(null)} className="text-sk-text-3 hover:text-white"><XIcon size={16} /></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {isEditing.type === 'manual' && (
              <>
                <div>
                  <label className="text-[10px] font-mono uppercase text-sk-text-3 mb-1 block">Emoji</label>
                  <input type="text" value={isEditing.emoji || ""} onChange={(e) => setIsEditing({ ...isEditing, emoji: e.target.value })} className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" placeholder="Ej: 🚨" maxLength={5} />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] font-mono uppercase text-sk-text-3 mb-1 block">Texto del Anuncio *</label>
                  <input type="text" value={isEditing.text_content || ""} onChange={(e) => setIsEditing({ ...isEditing, text_content: e.target.value })} className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" placeholder="Ej: ÚLTIMA HORA..." />
                </div>
              </>
            )}

            {isEditing.type === 'auto' && (
              <div className="md:col-span-4">
                <label className="text-[10px] font-mono uppercase text-sk-text-3 mb-1 block">Campeón Automático (No editable)</label>
                <div className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-4 font-mono cursor-not-allowed">
                  {isEditing.text_content}
                </div>
              </div>
            )}

            <div className="md:col-span-3">
              <label className="text-[10px] font-mono uppercase text-sk-text-3 mb-1 block">URL del Enlace (Opcional)</label>
              <input type="url" value={isEditing.link_url || ""} onChange={(e) => setIsEditing({ ...isEditing, link_url: e.target.value })} className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 font-mono focus:border-sk-accent" placeholder="https://sharkania.com/..." />
            </div>
            
            {isEditing.type === 'manual' && (
              <div>
                <label className="text-[10px] font-mono uppercase text-sk-text-3 mb-1 block">Orden</label>
                <input type="number" value={isEditing.sort_order || 0} onChange={(e) => setIsEditing({ ...isEditing, sort_order: Number(e.target.value) })} className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" />
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t border-sk-border-2">
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(null)}>Cancelar</Button>
            <Button variant="accent" size="sm" onClick={handleSave} isLoading={isSaving}><Save size={14} className="mr-1" /> Guardar</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-10 text-sk-text-3 text-sm">Cargando Ticker...</div>
      ) : (
        <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-hidden">
          <table className="w-full text-left text-sk-sm">
            <thead className="bg-sk-bg-3 font-mono text-[11px] uppercase text-sk-text-3">
              <tr>
                <th className="p-3">Anuncio en Ticker</th>
                <th className="p-3">Enlace URL</th>
                <th className="p-3">Origen</th>
                <th className="p-3 w-28 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sk-border-2">
              {items?.map(item => (
                <tr key={item.id} className={cn("hover:bg-white/[0.02]", !item.is_active && "opacity-50")}>
                  <td className="p-3">
                    <span className="mr-2 text-lg">{item.emoji}</span>
                    <span className={item.type === 'auto' ? "font-bold text-sk-text-2" : "font-bold text-sk-text-1"}>{item.text_content}</span>
                  </td>
                  <td className="p-3 font-mono text-[10px]">
                    {item.link_url ? (
                      <a href={item.link_url} target="_blank" rel="noreferrer" className="text-sk-accent hover:underline line-clamp-1 max-w-[200px]">
                        {item.link_url}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="p-3">
                    {item.type === 'auto' ? (
                      <Badge variant="muted">Automático</Badge>
                    ) : (
                      <button onClick={() => handleToggleActive(item)} className="focus:outline-none">
                        <Badge variant={item.is_active ? "green" : "red"}>{item.is_active ? "Activo" : "Oculto"}</Badge>
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setIsEditing(item)} className="text-sk-text-3 hover:text-sk-accent p-1" title={item.type === 'auto' ? "Agregar Link" : "Editar"}><LinkIcon size={14} /></button>
                      {item.type === 'manual' && (
                        <button onClick={() => handleDelete(item.id)} className="text-sk-text-3 hover:text-sk-red p-1"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}