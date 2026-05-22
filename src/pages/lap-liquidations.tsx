// src/pages/lap-liquidations.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";
import { Calendar, CheckCircle2, AlertTriangle } from "lucide-react";

export function LapLiquidationsPage() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputAmounts, setInputAmounts] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );

  const loadFinancialReport = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data: agents } = await supabase.from("acc_agents").select("*").neq("name", "GettingRIcher").order("name");
      
      // 🔥 MAGIA: Ya no traemos a los jugadores. Ahora pedimos directamente el agent_id que quedó sellado en la transacción
      const { data: transactions } = await supabase
        .from("acc_transactions")
        .select("amount, date, agent_id") 
        .eq("category", "Rakeback")
        .in("type", ["Ingreso", "ingreso"]); 

      const { data: payouts } = await supabase.from("acc_payouts").select("amount, agent_id");

      if (!agents) return;

      const calculatedReport = agents.map((agent) => {
        // Ahora filtramos estrictamente por el agente sellado en la transacción
        const periodRake = transactions
          ?.filter((t) => {
            if (!t.date || !startDate || !endDate) return false;
            const tDate = t.date.slice(0, 10);
            return t.agent_id === agent.id && tDate >= startDate && tDate <= endDate;
          })
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const historicalRake = transactions
          ?.filter((t) => t.agent_id === agent.id)
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const totalPaid = payouts?.filter((p) => p.agent_id === agent.id).reduce((sum, p) => sum + Number(p.amount), 0) || 0;

        const dealPerc = Number(agent.deal_percentage || 0);
        const periodCommission = periodRake * (dealPerc / 100);
        const historicalCommission = historicalRake * (dealPerc / 100);
        
        const pendingRake = historicalCommission - totalPaid;

        return {
          id: agent.id,
          name: agent.name,
          deal: dealPerc,
          periodRake,
          periodCommission,
          totalPaid,
          pendingRake,
        };
      });

      setReport(calculatedReport);
    } catch (err: any) {
      setErrorMessage("Error al calcular comisiones: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadFinancialReport();
  }, [loadFinancialReport]);

  const handleAmountChange = (agentId: string, value: string) => {
    setInputAmounts((prev) => ({ ...prev, [agentId]: value }));
  };

  const validateAndSendPayout = async (agentId: string, pendingRake: number) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const amountToPay = parseFloat(inputAmounts[agentId] || "0");

    if (amountToPay <= 0 || isNaN(amountToPay)) {
      setErrorMessage("Introduce un monto mayor a 0 para pagar.");
      return;
    }

    if (amountToPay > pendingRake) {
      setErrorMessage("🚫 Operación denegada: Estás intentando pagarle más dinero del que tiene acumulado a su favor.");
      return;
    }

    const { error } = await supabase.from("acc_payouts").insert({
      agent_id: agentId,
      amount: amountToPay
    });

    if (error) {
      setErrorMessage("Error al registrar pago: " + error.message);
    } else {
      setSuccessMessage("✅ Pago de comisión registrado correctamente.");
      setInputAmounts((prev) => ({ ...prev, [agentId]: "" }));
      loadFinancialReport(); 
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Pagos de Rake a Agentes</h2>
          <p className="text-sm text-gray-400">Calcula y liquida comisiones según el % de Deal.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700 text-sm text-white">
          <Calendar size={16} className="text-gray-400" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
          <span className="text-gray-600">~</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg flex items-center gap-3 text-sm">
          <AlertTriangle size={18} /> {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-900/50 border border-emerald-700 text-emerald-300 p-4 rounded-lg flex items-center gap-3 text-sm">
          <CheckCircle2 size={18} /> {successMessage}
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 overflow-x-auto">
          <table className="w-full text-left text-white min-w-[800px]">
            <thead className="bg-gray-800 text-[11px] uppercase font-mono tracking-wider text-gray-400">
              <tr>
                <th className="p-4">Agente</th>
                <th className="p-4 text-right">Rake del Periodo</th>
                <th className="p-4 text-center">Deal</th>
                <th className="p-4 text-right">Comisión a Pagar</th>
                <th className="p-4 text-right text-amber-400">Saldo Pendiente</th>
                <th className="p-4 text-center">Abonar a Saldo</th>
                <th className="p-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-800">
              {report.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 font-bold">{agent.name}</td>
                  <td className="p-4 text-right font-mono text-gray-300">${agent.periodRake.toLocaleString("es-CL")}</td>
                  <td className="p-4 text-center font-bold text-emerald-500">{agent.deal}%</td>
                  <td className="p-4 text-right font-mono text-emerald-400 font-bold">${agent.periodCommission.toLocaleString("es-CL")}</td>
                  
                  <td className="p-4 text-right font-mono text-amber-400 font-bold bg-amber-500/5">
                    ${agent.pendingRake.toLocaleString("es-CL")}
                  </td>
                  
                  <td className="p-4 text-center">
                    <input
                      type="number"
                      placeholder="$0"
                      value={inputAmounts[agent.id] || ""}
                      onChange={(e) => handleAmountChange(agent.id, e.target.value)}
                      className="w-28 bg-gray-950 border border-gray-700 rounded p-1.5 text-right font-mono text-white focus:border-emerald-500 outline-none text-sm"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => validateAndSendPayout(agent.id, agent.pendingRake)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-black uppercase transition-all"
                    >
                      Pagar
                    </button>
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