// src/pages/lap-players.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";

export function LapPlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Carga de datos
  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: pData } = await supabase.from("acc_players").select("clubgg_id, nickname, agent_id");
    const { data: aData } = await supabase.from("acc_agents").select("id, name");
    setPlayers(pData || []);
    setAgents(aData || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const assignAgent = async (clubgg_id: string, agent_id: string | null) => {
    await supabase.from("acc_players").update({ agent_id: agent_id || null }).eq("clubgg_id", clubgg_id);
    loadData(); // Refrescamos la vista tras el cambio
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-black text-white">Directorio de Jugadores</h2>
      
      <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
        {loading ? (
          <div className="p-8 flex justify-center"><Spinner /></div>
        ) : (
          <table className="w-full text-left text-white">
            <thead className="bg-gray-800 text-xs uppercase">
              <tr>
                <th className="p-4">Nickname</th>
                <th className="p-4">Agente Asignado</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.clubgg_id} className="border-t border-gray-800 text-sm hover:bg-gray-800/50">
                  <td className="p-4 font-bold">{p.nickname}</td>
                  <td className="p-4">
                    <select 
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm text-white focus:ring-1 focus:ring-emerald-500 outline-none"
                      value={p.agent_id || ""}
                      onChange={(e) => assignAgent(p.clubgg_id, e.target.value)}
                    >
                      <option value="">Sin Agente</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}