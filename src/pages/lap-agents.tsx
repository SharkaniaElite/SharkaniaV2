// src/pages/lap-agents.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";
import { Plus, Trash2 } from "lucide-react";

export function LapAgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDeal, setNewDeal] = useState(0);

  // 1. useCallback memoriza la función, evitando que cambie en cada render
  const fetchAgents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("acc_agents").select("*").order("name");
    setAgents(data || []);
    setLoading(false);
  }, []);

  // 2. Ahora fetchAgents es una dependencia "estable", el Linter estará feliz
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAgents();
  }, [fetchAgents]);

  const addAgent = async () => {
    if (!newName) return;
    await supabase.from("acc_agents").insert({ name: newName, deal_percentage: newDeal });
    setNewName("");
    setNewDeal(0);
    fetchAgents();
  };

  const updateDeal = async (id: string, deal: number) => {
    await supabase.from("acc_agents").update({ deal_percentage: deal }).eq("id", id);
    fetchAgents();
  };

  const deleteAgent = async (id: string) => {
    await supabase.from("acc_agents").delete().eq("id", id);
    fetchAgents();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-white">Configuración de Agentes</h2>
      
      {/* Formulario de Nuevo Agente */}
      <div className="bg-gray-800 p-4 rounded-lg flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-xs text-gray-400 block mb-1">Nombre Agente</label>
          <input className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={newName} onChange={e => setNewName(e.target.value)} />
        </div>
        <div className="w-24">
          <label className="text-xs text-gray-400 block mb-1">Deal %</label>
          <input type="number" className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" value={newDeal} onChange={e => setNewDeal(Number(e.target.value))} />
        </div>
        <button onClick={addAgent} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded flex items-center gap-2">
          <Plus size={18} /> Agregar
        </button>
      </div>

      {/* Listado */}
      {loading ? <Spinner /> : (
        <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
          <table className="w-full text-left text-white">
            <thead className="bg-gray-800 text-xs uppercase">
              <tr>
                <th className="p-4">Nombre</th>
                <th className="p-4 text-center">Deal (%)</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id} className="border-t border-gray-800">
                  <td className="p-4 font-bold">{a.name}</td>
                  <td className="p-4 text-center">
                    <input 
                      type="number" 
                      className="w-16 bg-gray-800 border border-gray-600 rounded p-1 text-center"
                      value={a.deal_percentage}
                      onChange={(e) => updateDeal(a.id, Number(e.target.value))}
                    />
                  </td>
                  <td className="p-4 text-center">
                    {a.name !== "GettingRIcher" && (
                      <button onClick={() => deleteAgent(a.id)} className="text-red-400 hover:text-red-300">
                        <Trash2 size={18} />
                      </button>
                    )}
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