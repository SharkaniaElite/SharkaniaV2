import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth-store";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { SharkCoin } from "../ui/shark-coin"; // 👈 FIX 1: Ruta corregida
import { CheckCircle2, Clock, ExternalLink, ShieldAlert, Zap } from "lucide-react";

type Mission = {
  id: string;
  title: string;
  description: string;
  category: string;
  validation_type: "auto" | "manual";
  reward_xp: number;
  reward_coins: number;
  action_url: string;
};

type PlayerMission = {
  mission_id: string;
  status: "pending" | "completed" | "rejected";
  proof_data: string | null;
};

export function MissionsPanel() {
  const { user, refreshProfile } = useAuthStore();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [playerProgress, setPlayerProgress] = useState<Record<string, PlayerMission>>({});
  const [loading, setLoading] = useState(true);

  const [clickedLinks, setClickedLinks] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [proofText, setProofText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // FIX 4: Mover la función dentro o usar useCallback para silenciar a ESLint
  useEffect(() => {
    const fetchMissionsAndProgress = async () => {
      try {
        const { data: missionsData, error: missionsError } = await supabase
          .from("gamification_missions")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: true });

        if (missionsError) throw missionsError;

        const { data: progressData, error: progressError } = await supabase
          .from("player_missions")
          .select("*")
          .eq("profile_id", user?.id);

        if (progressError) throw progressError;

        const progressMap: Record<string, PlayerMission> = {};
        progressData?.forEach((p) => {
          progressMap[p.mission_id] = p;
        });

        setMissions(missionsData || []);
        setPlayerProgress(progressMap);
      } catch (error) {
        console.error("Error cargando misiones:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchMissionsAndProgress();
  }, [user]);

  const handleAutoClaim = async (mission: Mission) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("claim_auto_mission", { p_mission_id: mission.id });
      if (error) {
        alert(`⚠️ ${error.message}`);
        return;
      }
      // Actualización mágica
      window.location.reload(); // Opción rápida para refrescar todo el estado global
    } catch (error) {
      console.error("Error validando misión automática:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExternalLinkClick = (mission: Mission) => {
    window.open(mission.action_url, "_blank");
    setClickedLinks((prev) => ({ ...prev, [mission.id]: true }));
  };

  const handleOpenClaimModal = (mission: Mission) => {
    setSelectedMission(mission);
    setIsModalOpen(true);
  };

  const handleSubmitProof = async () => {
    if (!selectedMission || !user || !proofText.trim()) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from("player_missions")
        .upsert({
          profile_id: user.id,
          mission_id: selectedMission.id,
          status: "pending",
          proof_data: proofText.trim(),
        }, { onConflict: 'profile_id,mission_id' });

      if (error) throw error;

      setPlayerProgress((prev) => ({
        ...prev,
        [selectedMission.id]: { mission_id: selectedMission.id, status: "pending", proof_data: proofText.trim() },
      }));
      
      setIsModalOpen(false);
      setProofText("");
    } catch (error) {
      console.error("Error enviando prueba:", error);
      alert("Hubo un error al enviar tu solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="animate-pulse h-32 bg-sk-bg-2 rounded-lg border border-sk-border-2"></div>;

  return (
    <div className="space-y-4">
      {missions.map((mission) => {
        const progress = playerProgress[mission.id];
        const isCompleted = progress?.status === "completed";
        const isPending = progress?.status === "pending";
        const hasClickedLink = clickedLinks[mission.id];

        return (
          <div key={mission.id} className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition-all hover:border-sk-accent/50">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sk-md font-bold text-sk-text-1">{mission.title}</h4>
                {mission.category === "sponsor" && <Badge variant="gold">Patrocinador</Badge>}
              </div>
              <p className="text-sk-sm text-sk-text-3 max-w-xl">{mission.description}</p>
              
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 bg-sk-bg-3 px-2.5 py-1 rounded-md border border-sk-border-1">
                  <span className="text-sk-sm font-bold text-sk-gold">+{mission.reward_xp} XP</span>
                </div>
                {mission.reward_coins > 0 && (
                  <div className="flex items-center gap-1.5 bg-sk-bg-3 px-2.5 py-1 rounded-md border border-sk-border-1">
                    <SharkCoin size={16} />
                    <span className="text-sk-sm font-bold text-sk-accent">+{mission.reward_coins} Coins</span>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 w-full md:w-56 mt-2 md:mt-0 flex flex-col justify-center">
              {isCompleted ? (
                <Button variant="ghost" disabled className="w-full text-sk-green opacity-100 border border-sk-green/30 bg-sk-green/5">
                  <CheckCircle2 size={16} className="mr-2" /> Completada
                </Button>
              ) : isPending ? (
                <Button variant="ghost" disabled className="w-full text-sk-orange opacity-100 border border-sk-orange/30 bg-sk-orange/5">
                  <Clock size={16} className="mr-2" /> En Revisión
                </Button>
              ) : mission.validation_type === "manual" ? (
                !hasClickedLink ? (
                  <div className="flex flex-col gap-2">
                    <Button variant="accent" onClick={() => handleExternalLinkClick(mission)} className="w-full shadow-[0_0_10px_rgba(0,255,204,0.2)]">
                      1. Crear Cuenta <ExternalLink size={14} className="ml-2" />
                    </Button>
                    <button onClick={() => setClickedLinks((prev) => ({ ...prev, [mission.id]: true }))} className="text-[10px] text-sk-text-3 hover:text-sk-text-1 underline text-center">
                      Ya creé mi cuenta
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <span className="text-[10px] font-semibold uppercase text-sk-accent text-center bg-sk-accent/10 py-1 rounded">
                      Paso 2
                    </span>
                    <Button variant="secondary" onClick={() => handleOpenClaimModal(mission)} className="w-full border-sk-accent text-sk-accent hover:bg-sk-accent/10">
                      Reclamar Recompensa
                    </Button>
                  </div>
                )
              ) : (
                <Button 
                  variant="secondary" // 👈 FIX 2: Cambiado de "outline" a "secondary"
                  isLoading={submitting}
                  onClick={() => handleAutoClaim(mission)} 
                  className="w-full border-sk-accent text-sk-accent hover:bg-sk-accent/10"
                >
                  <Zap size={14} className="mr-2" /> Verificar y Reclamar
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {/* Modal para misiones manuales */}
      {isModalOpen && selectedMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-sk-bg-1 border border-sk-border-2 rounded-2xl p-6 max-w-md w-full shadow-sk-lg">
            <h3 className="text-sk-lg font-extrabold text-sk-text-1 mb-2 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-sk-accent" />
              Validación de Cuenta
            </h3>
            <p className="text-sk-sm text-sk-text-2 mb-4">
              Para validar que creaste tu cuenta usando el código <strong className="text-sk-gold">FPHL</strong>, necesitamos que ingreses tu nombre de usuario o email con el que te registraste en WPT Global.
            </p>
            
            <div className="mb-5 bg-sk-accent-dim border border-sk-accent/20 rounded-lg p-3 flex gap-2">
              <ShieldAlert size={16} className="text-sk-accent shrink-0 mt-0.5" />
              <p className="text-[12px] text-sk-text-1">Un administrador revisará esta información. Si es correcta, se te abonarán <strong>{selectedMission.reward_xp} XP</strong> y <strong>{selectedMission.reward_coins} SharkCoins</strong>.</p>
            </div>

            <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">
              Tu Usuario / Email en WPT Global
            </label>
            <input
              type="text"
              value={proofText}
              onChange={(e) => setProofText(e.target.value)}
              placeholder="Ej: tiburon99 o correo@email.com"
              className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent mb-6"
            />

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button variant="accent" onClick={handleSubmitProof} isLoading={submitting} disabled={!proofText.trim()} className="flex-1">
                Enviar Revisión
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}