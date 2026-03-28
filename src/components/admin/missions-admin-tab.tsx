import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Check, X, ShieldAlert, User } from "lucide-react";

type PendingMission = {
  id: string;
  proof_data: string | null;
  created_at: string;
  profiles: {
    display_name: string;
    email: string;
  };
  gamification_missions: {
    title: string;
    reward_xp: number;
    reward_coins: number;
  };
};

export function MissionsAdminTab() {
  const [pendingMissions, setPendingMissions] = useState<PendingMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingMissions();
  }, []);

  const fetchPendingMissions = async () => {
    try {
      const { data, error } = await supabase
        .from("player_missions")
        .select(`
          id,
          proof_data,
          created_at,
          profiles:profile_id (display_name, email),
          gamification_missions:mission_id (title, reward_xp, reward_coins)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingMissions(data as any);
    } catch (error) {
      console.error("Error fetching missions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm("¿Seguro que quieres aprobar esta misión y pagar la recompensa?")) return;
    setProcessingId(id);
    try {
      // Llamamos a la función segura (Atómica) que acabamos de crear en SQL
      const { error } = await supabase.rpc("approve_mission", { p_player_mission_id: id });
      if (error) throw error;
      
      // Quitamos la misión de la lista
      setPendingMissions((prev) => prev.filter((m) => m.id !== id));
    } catch (error) {
      console.error("Error approving:", error);
      alert("Hubo un error al aprobar la misión.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("¿Rechazar esta misión? El jugador no recibirá nada.")) return;
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from("player_missions")
        .update({ status: "rejected" })
        .eq("id", id);
        
      if (error) throw error;
      setPendingMissions((prev) => prev.filter((m) => m.id !== id));
    } catch (error) {
      console.error("Error rejecting:", error);
      alert("Hubo un error al rechazar la misión.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="animate-pulse h-32 bg-sk-bg-2 rounded-lg mt-6"></div>;

  if (pendingMissions.length === 0) {
    return (
      <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-10 text-center mt-6">
        <ShieldAlert size={48} className="text-sk-green mx-auto mb-4 opacity-50" />
        <h3 className="text-sk-lg font-bold text-sk-text-1">Bandeja Limpia</h3>
        <p className="text-sk-sm text-sk-text-3 mt-2">No hay misiones pendientes de revisión en este momento.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {pendingMissions.map((mission) => (
        <div key={mission.id} className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="orange">Pendiente</Badge>
              <h4 className="text-sk-md font-bold text-sk-text-1">{mission.gamification_missions.title}</h4>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 text-sk-sm">
              <div className="flex items-center gap-1.5 text-sk-text-2">
                <User size={14} className="text-sk-accent" />
                <span className="font-semibold text-sk-text-1">{mission.profiles.display_name}</span>
                <span className="text-sk-text-3">({mission.profiles.email})</span>
              </div>
            </div>

            <div className="bg-sk-bg-0 border border-sk-border-1 rounded-md p-3 mt-2">
              <span className="text-[11px] font-mono text-sk-text-3 uppercase tracking-wider block mb-1">Dato / Prueba enviada:</span>
              <p className="font-mono text-sk-accent font-bold">{mission.proof_data || "Sin datos"}</p>
            </div>
            
            <p className="text-sk-xs text-sk-text-3">
              Recompensa en juego: <strong className="text-sk-gold">+{mission.gamification_missions.reward_xp} XP</strong> | <strong className="text-sk-accent">+{mission.gamification_missions.reward_coins} Coins</strong>
            </p>
          </div>

          <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto">
            <Button 
              variant="accent" 
              onClick={() => handleApprove(mission.id)} 
              isLoading={processingId === mission.id}
              disabled={processingId !== null}
              className="flex-1 md:w-40 shadow-[0_0_10px_rgba(0,255,204,0.15)]"
            >
              <Check size={16} className="mr-2" /> Aprobar
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleReject(mission.id)}
              disabled={processingId !== null}
              className="flex-1 md:w-40 border-sk-red/30 text-sk-red hover:bg-sk-red/10"
            >
              <X size={16} className="mr-2" /> Rechazar
            </Button>
          </div>

        </div>
      ))}
    </div>
  );
}