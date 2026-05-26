// src/pages/lap-liquidations.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";
import { CheckCircle2, AlertTriangle, History, Undo2, Calculator } from "lucide-react";

export function LapLiquidationsPage() {
  const [report, setReport] = useState<any[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [inputAmounts, setInputAmounts] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadFinancialReport = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data: agents } = await supabase.from("acc_agents").select("*").neq("name", "GettingRIcher").order("name");
      const { data: players } = (await supabase.from("acc_players").select("clubgg_id, agent_id, nickname")) as { data: any[] | null };
      
      const { data: transactions } = await supabase
        .from("acc_transactions")
        .select("amount, date, agent_id, category, type, clubgg_id") 
        .in("category", ["Rakeback"])
        .limit(10000); 

      const { data: payouts } = await supabase.from("acc_payouts").select("id, amount, agent_id, created_at");
      
      const { data: configs } = await supabase.from("acc_player_promo_config").select("*");
      const { data: tourneys } = await supabase.from("tournaments").select("id, created_at").in("club_id", ["ccb5c5bc-efaf-4710-b9c5-b4e2baa17328", "1da03414-0ed2-416e-b4f4-bd94caabd5c7"]).not("league_id", "is", null);
      const tourneyIds = tourneys?.map((t: any) => t.id) || [];
      
      let tResults: any[] = [];
      if (tourneyIds.length > 0) {
        const { data: resData } = await supabase.from("tournament_results").select("tournament_id, player_id, buy_ins_count").in("tournament_id", tourneyIds).limit(10000);
        tResults = resData || [];
      }
      
      const { data: tPlayers } = await supabase.from("players").select("id, nickname").limit(10000);

      if (!agents) return;

      const history = payouts?.map((p: any) => {
        const ag = agents.find((a: any) => a.id === p.agent_id);
        return {
          ...p,
          agent_name: ag?.name || "Agente Desconocido"
        };
      }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];
      
      setPayoutHistory(history);

      const calculatedReport = agents.map((agent) => {
        // 1. Rake Histórico Total
        const historicalRake = transactions
          ?.filter((t) => t.category === "Rakeback" && ["Ingreso", "ingreso"].includes(t.type) && t.agent_id === agent.id)
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        // 2. Promociones Históricas Totales Asumidas
        let promosGeneradasHistorico = 0;
        const myPlayers = players?.filter(p => p.agent_id === agent.id) || [];
        
        myPlayers.forEach(player => {
          const cfg = configs?.find(c => c.clubgg_id === player.clubgg_id) || { welcome_percentage: 30, liga_active: true };
          const isLigaActive = cfg.liga_active ?? true;
          const isWelcomeActive = cfg.welcome_active ?? false;
          
          const tPlayer = tPlayers?.find(tp => tp.nickname.toLowerCase() === player.nickname.toLowerCase());
          
          let ligaBuyInsHistorico = 0;

          if (tPlayer && tResults && tourneys) {
            tResults.filter(r => r.player_id === tPlayer.id).forEach(res => {
              const tourney = tourneys.find(t => t.id === res.tournament_id);
              if (tourney && tourney.created_at) {
                const tDateStr = new Date(tourney.created_at).toISOString().slice(0, 10);
                const validStart = !cfg.liga_start_date || tDateStr >= cfg.liga_start_date.slice(0, 10);
                const validEnd = !cfg.liga_expiry || tDateStr <= cfg.liga_expiry.slice(0, 10);
                
                if (validStart && validEnd) {
                  ligaBuyInsHistorico += (Number(res.buy_ins_count) || 0);
                }
              }
            });
          }

          // 7000 por entry (5000 pozo + 2000 jugador)
          const deduccionLigaHistorico = (ligaBuyInsHistorico * 5000) + (isLigaActive ? ligaBuyInsHistorico * 2000 : 0);

          let rakeGenHistorico = 0;

          transactions?.filter(t => t.clubgg_id === player.clubgg_id && ["Ingreso", "ingreso"].includes(t.type)).forEach(t => {
            const tDateStr = new Date(t.date).toISOString().slice(0, 10);
            const validStart = !cfg.welcome_start_date || tDateStr >= cfg.welcome_start_date.slice(0, 10);
            const validEnd = !cfg.welcome_expiry || tDateStr <= cfg.welcome_expiry.slice(0, 10);
            
            if (validStart && validEnd) {
              rakeGenHistorico += Number(t.amount);
            }
          });

          const costoLigaTotalHist = ligaBuyInsHistorico * 7000;
          const rakeOtrosHist = Math.max(0, rakeGenHistorico - costoLigaTotalHist);
          let bonoBienvenidaHist = isWelcomeActive ? (rakeOtrosHist * (Number(cfg.welcome_percentage) / 100)) : 0;
          if (cfg.welcome_max_amount && bonoBienvenidaHist > Number(cfg.welcome_max_amount)) bonoBienvenidaHist = Number(cfg.welcome_max_amount);

          promosGeneradasHistorico += (deduccionLigaHistorico + bonoBienvenidaHist);
        });

        // 3. Pagos Históricos al Agente
        const totalPaid = payouts?.filter((p) => p.agent_id === agent.id).reduce((sum, p) => sum + Number(p.amount), 0) || 0;

        // 4. Matemática Final
        const dealPerc = Number(agent.deal_percentage || 0);
        const historicalCommission = historicalRake * (dealPerc / 100);
        const pendingRake = historicalCommission - promosGeneradasHistorico - totalPaid;

        return {
          id: agent.id,
          name: agent.name,
          deal: dealPerc,
          historicalRake,
          historicalCommission,
          promosPaid: promosGeneradasHistorico, 
          totalPaid,
          pendingRake,
        };
      });

      setReport(calculatedReport);
    } catch (err: any) {
      setErrorMessage("Error al calcular cuenta corriente: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
      setErrorMessage("🚫 Operación denegada: Estás intentando pagarle más dinero del que se le adeuda históricamente.");
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

  const handleRevertPayout = async (id: number) => {
    if (!window.confirm("⚠️ ¿Seguro que quieres reversar este pago al agente? El registro se eliminará y el monto volverá a sumarse a su saldo pendiente.")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from("acc_payouts").delete().eq("id", id);
      if (error) throw error;
      
      setSuccessMessage("✅ Pago reversado y saldo restaurado correctamente.");
      loadFinancialReport(); 
    } catch (err: any) {
      setErrorMessage("Error al reversar el pago: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Calculator className="text-emerald-400" />
            Cuenta Corriente de Agentes
          </h2>
          <p className="text-sm text-gray-400">Balance acumulativo histórico. El saldo pendiente es la deuda real actual.</p>
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
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 overflow-x-auto shadow-xl">
          <table className="w-full text-left text-white min-w-[1000px]">
            <thead className="bg-gray-800 text-[10px] uppercase font-mono tracking-wider text-gray-400">
              <tr>
                <th className="p-4">Agente</th>
                <th className="p-4 text-right">Rake Total</th>
                <th className="p-4 text-center">Deal</th>
                <th className="p-4 text-right">Comisión Total</th>
                <th className="p-4 text-right text-rose-400">Promos Asumidas</th>
                <th className="p-4 text-right text-blue-400">Ya Pagado</th>
                <th className="p-4 text-right text-amber-400 text-sm">Saldo Pendiente</th>
                <th className="p-4 text-center">Abonar a Saldo</th>
                <th className="p-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-800">
              {report.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 font-bold">{agent.name}</td>
                  <td className="p-4 text-right font-mono text-gray-300">${agent.historicalRake.toLocaleString("es-CL")}</td>
                  <td className="p-4 text-center font-bold text-emerald-500 bg-emerald-500/5">{agent.deal}%</td>
                  <td className="p-4 text-right font-mono text-emerald-400 font-bold">${agent.historicalCommission.toLocaleString("es-CL")}</td>
                  
                  <td className="p-4 text-right font-mono text-rose-400 font-bold">
                    -${(agent.promosPaid || 0).toLocaleString("es-CL")}
                  </td>

                  <td className="p-4 text-right font-mono text-blue-400 font-bold">
                    -${agent.totalPaid.toLocaleString("es-CL")}
                  </td>

                  <td className="p-4 text-right font-mono text-amber-400 font-black bg-amber-500/10 text-base">
                    ${agent.pendingRake.toLocaleString("es-CL")}
                  </td>
                  
                  <td className="p-4 text-center">
                    <input
                      type="number"
                      placeholder="$0"
                      value={inputAmounts[agent.id] || ""}
                      onChange={(e) => handleAmountChange(agent.id, e.target.value)}
                      className="w-24 bg-gray-950 border border-gray-700 rounded p-1.5 text-right font-mono text-white focus:border-emerald-500 outline-none text-sm"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => validateAndSendPayout(agent.id, agent.pendingRake)}
                      disabled={agent.pendingRake <= 0}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1.5 rounded text-xs font-black uppercase transition-all"
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

      {/* 🔥 HISTORIAL DE PAGOS A AGENTES */}
      {!loading && (
        <div className="pt-8">
          <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
            <History size={20} className="text-blue-400" />
            Historial de Pagos Recientes
          </h3>
          <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 overflow-x-auto shadow-xl">
            <table className="w-full text-left text-white min-w-[600px]">
              <thead className="bg-gray-800 text-[11px] uppercase font-mono tracking-wider text-gray-400">
                <tr>
                  <th className="p-4">Fecha de Pago</th>
                  <th className="p-4">Agente</th>
                  <th className="p-4 text-right">Monto Liquidado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-800">
                {payoutHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500 text-xs">
                      No hay registros de pagos a agentes aún.
                    </td>
                  </tr>
                ) : (
                  payoutHistory.map((h: any) => (
                    <tr key={h.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="p-4 text-gray-400 font-mono text-xs">
                        {new Date(h.created_at).toLocaleString("es-CL")}
                      </td>
                      <td className="p-4 font-bold">{h.agent_name}</td>
                      <td className="p-4 text-right font-mono text-blue-400 font-bold">
                        ${Number(h.amount).toLocaleString("es-CL")}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleRevertPayout(h.id)} 
                          className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/50 text-xs px-3 py-1.5 rounded flex items-center justify-center gap-1.5 mx-auto transition-all"
                        >
                          <Undo2 size={14} /> Reversar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}