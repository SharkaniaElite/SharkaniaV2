// src/pages/lap-liquidations.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { CheckCircle2, AlertTriangle, History, Undo2, Calculator, Calendar, Wallet } from "lucide-react";

const SYSTEM_START_DATE = "2026-06-08T00:00:00Z";

export function LapLiquidationsPage() {
  const [report, setReport] = useState<any[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal de Pago
  const [payingAgent, setPayingAgent] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");

  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const loadFinancialReport = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const { data: agents } = await supabase.from("acc_agents").select("*").order("name");
      const { data: players } = (await supabase.from("acc_players").select("clubgg_id, agent_id, nickname")) as { data: any[] | null };
      
      const { data: transactions } = await supabase.from("acc_transactions").select("amount, date, agent_id, category, type, clubgg_id").in("category", ["Rakeback"]).gte("date", SYSTEM_START_DATE).limit(100000); 
      const { data: payouts } = await supabase.from("acc_payouts").select("id, amount, agent_id, created_at").gte("created_at", SYSTEM_START_DATE);
      const { data: configs } = await supabase.from("acc_player_promo_config").select("*");
      
      const { data: tourneys } = await supabase
        .from("tournaments")
        .select("id, created_at, start_datetime")
        .not("league_id", "is", null)
        .gte("created_at", SYSTEM_START_DATE);
        
      const tourneyIds = tourneys?.map((t: any) => t.id) || [];
      
      let tResults: any[] = [];
      if (tourneyIds.length > 0) {
        const { data: resData } = await supabase.from("tournament_results").select("tournament_id, player_id, buy_ins_count").in("tournament_id", tourneyIds).limit(100000);
        tResults = resData || [];
      }
      
      const { data: tPlayers } = await supabase.from("players").select("id, nickname").limit(100000);
      if (!agents) return;

      const history = payouts?.map((p: any) => {
        const ag = agents.find((a: any) => a.id === p.agent_id);
        return { ...p, agent_name: ag?.name || "Agente Desconocido" };
      }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];
      setPayoutHistory(history);

      const calculatedReport = agents.map((agent) => {
        const grossRakeHist = transactions?.filter((t) => t.category === "Rakeback" && ["Ingreso", "ingreso"].includes(t.type) && t.agent_id === agent.id).reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const grossRakePeriodo = transactions?.filter((t) => t.category === "Rakeback" && ["Ingreso", "ingreso"].includes(t.type) && t.agent_id === agent.id && t.date.slice(0,10) >= startDate && t.date.slice(0,10) <= endDate).reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        let buyinsHist = 0; 
        let buyinsPeriodo = 0;
        
        let totalWelcomeHist = 0; 
        let totalWelcomePeriodo = 0; 

        const myPlayers = players?.filter(p => p.agent_id === agent.id) || [];
        
        myPlayers.forEach(player => {
          const defaultCfg = { welcome_percentage: 30, welcome_max_amount: 100000, welcome_active: true };
          const cfg = configs?.find(c => c.clubgg_id === player.clubgg_id) || defaultCfg;
          const isWelcomeActive = cfg.welcome_active ?? true; 
          
          const matchingTPlayers = tPlayers?.filter(tp => tp.nickname.toLowerCase().trim() === player.nickname.toLowerCase().trim()) || [];
          const matchingPlayerIds = matchingTPlayers.map(tp => tp.id);
          
          let pBHist = 0; let pBPer = 0;

          if (matchingPlayerIds.length > 0 && tResults && tourneys) {
            tResults.filter(r => matchingPlayerIds.includes(r.player_id)).forEach(res => {
              const tourney = tourneys.find(t => t.id === res.tournament_id);
              if (tourney) {
                const targetDate = tourney.start_datetime || tourney.created_at;
                const tDateStr = new Date(targetDate).toISOString().slice(0, 10);
                
                let rawBuyins = Number(res.buy_ins_count);
                if (isNaN(rawBuyins) || rawBuyins <= 0) rawBuyins = 1;
                const buyins = rawBuyins;
                
                pBHist += buyins;
                if (tDateStr >= startDate && tDateStr <= endDate) pBPer += buyins;
              }
            });
          }

          buyinsHist += pBHist;
          buyinsPeriodo += pBPer;

          let pRakeGenHist = 0; let pRakeGenPeriodo = 0;
          transactions?.filter(t => t.clubgg_id === player.clubgg_id && ["Ingreso", "ingreso"].includes(t.type)).forEach(t => {
            const tDateStr = new Date(t.date).toISOString().slice(0, 10);
            const validStart = !cfg.welcome_start_date || tDateStr >= cfg.welcome_start_date.slice(0, 10);
            const validEnd = !cfg.welcome_expiry || tDateStr <= cfg.welcome_expiry.slice(0, 10);
            if (validStart && validEnd) {
              pRakeGenHist += Number(t.amount);
              if (tDateStr >= startDate && tDateStr <= endDate) pRakeGenPeriodo += Number(t.amount);
            }
          });

          // 🔥 HISTÓRICO DEL JUGADOR
          const pDeduccionBaseWHist = pBHist * 5000;
          const pRakeLiquidoWHist = Math.max(0, pRakeGenHist - pDeduccionBaseWHist);
          let pBonoWHist = isWelcomeActive ? (pRakeLiquidoWHist * (Number(cfg.welcome_percentage) / 100)) : 0;
          if (cfg.welcome_max_amount && pBonoWHist > Number(cfg.welcome_max_amount)) pBonoWHist = Number(cfg.welcome_max_amount);
          
          totalWelcomeHist += pBonoWHist;

          // 🔥 PERIODO DEL JUGADOR
          const pDeduccionBaseWPer = pBPer * 5000;
          const pRakeLiquidoWPer = Math.max(0, pRakeGenPeriodo - pDeduccionBaseWPer);
          let pBonoWPer = isWelcomeActive ? (pRakeLiquidoWPer * (Number(cfg.welcome_percentage) / 100)) : 0;
          if (cfg.welcome_max_amount && pBonoWPer > Number(cfg.welcome_max_amount)) pBonoWPer = Number(cfg.welcome_max_amount);
          
          totalWelcomePeriodo += pBonoWPer;
        });

        const dealPerc = Number(agent.deal_percentage || 0);

        // 🔥 MATEMÁTICA EXACTA DEL PERIODO
        const deduccionPozoPer = buyinsPeriodo * 5000;
        const rakeLiquidoPer = Math.max(0, grossRakePeriodo - deduccionPozoPer);
        const rakebackBrutoPer = rakeLiquidoPer * (dealPerc / 100);
        
        const totalPromosPeriodo = totalWelcomePeriodo; // Ahora solo es bono bienvenida
        const generadoPeriodo = rakebackBrutoPer - totalPromosPeriodo;

        // 🔥 MATEMÁTICA EXACTA HISTÓRICA
        const deduccionPozoHist = buyinsHist * 5000;
        const rakeLiquidoHist = Math.max(0, grossRakeHist - deduccionPozoHist);
        const rakebackBrutoHist = rakeLiquidoHist * (dealPerc / 100);
        
        const totalPromosHist = totalWelcomeHist;
        const generadoHist = rakebackBrutoHist - totalPromosHist;
        
        // Saldo Total
        const totalPaid = payouts?.filter((p) => p.agent_id === agent.id).reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const saldoTotal = generadoHist - totalPaid;

        return {
          id: agent.id,
          name: agent.name,
          deal: dealPerc,
          grossRakePeriodo, 
          deduccionPozoPeriodo: deduccionPozoPer,
          rakeLiquidoPeriodo: rakeLiquidoPer,
          rakebackBrutoPeriodo: rakebackBrutoPer,
          promosJugadoresPeriodo: totalPromosPeriodo, 
          generadoPeriodo, 
          saldoTotal,   
        };
      });

      setReport(calculatedReport);
    } catch (err: any) {
      setErrorMessage("Error al calcular: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]); 

  useEffect(() => {
    loadFinancialReport();
  }, [loadFinancialReport]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null); setSuccessMessage(null);
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) return setErrorMessage("Monto mayor a 0.");
    
    const maxAllowed = Math.max(payingAgent.saldoTotal, payingAgent.generadoPeriodo);
    if (amt > maxAllowed) return setErrorMessage("Supera deuda histórica y lo generado en el periodo.");

    try {
      const { error } = await supabase.from("acc_payouts").insert({ agent_id: payingAgent.id, amount: amt });
      if (error) throw error;
      
      setSuccessMessage(`Pago registrado a ${payingAgent.name}.`);
      setPayingAgent(null);
      setPayAmount("");
      loadFinancialReport(); 
    } catch (err: any) {
      setErrorMessage("Error: " + err.message);
    }
  };

  const handleRevertPayout = async (id: number) => {
    if (!window.confirm("¿Reversar este pago?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("acc_payouts").delete().eq("id", id);
      if (error) throw error;
      setSuccessMessage("Pago reversado.");
      loadFinancialReport(); 
    } catch (err: any) {
      setErrorMessage("Error: " + err.message);
      setLoading(false);
    }
  };

  const totalRakeBrutoPer = report.reduce((acc, a) => acc + a.grossRakePeriodo, 0);
  const totalDeduccionPozoPer = report.reduce((acc, a) => acc + a.deduccionPozoPeriodo, 0);
  const totalRakeLiquidoPer = report.reduce((acc, a) => acc + a.rakeLiquidoPeriodo, 0);
  const totalRakebackBrutoPer = report.reduce((acc, a) => acc + a.rakebackBrutoPeriodo, 0);
  const totalPromosJugadoresPer = report.reduce((acc, a) => acc + (a.promosJugadoresPeriodo || 0), 0);
  const totalGeneradoPer = report.reduce((acc, a) => acc + a.generadoPeriodo, 0);
  const totalSaldoTotal = report.reduce((acc, a) => acc + a.saldoTotal, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Calculator className="text-emerald-400" />
            Liquidaciones y Cuenta Corriente
          </h2>
          <p className="text-sm text-gray-400">Balance y lectura lineal exacta del rendimiento del Agente.</p>
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
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 overflow-x-auto shadow-xl">
          <table className="w-full text-left text-white min-w-[1300px]">
            <thead className="bg-gray-800 text-[10px] uppercase font-mono tracking-wider text-gray-400">
              <tr>
                <th className="p-4">Agente</th>
                <th className="p-4 text-right">Rake Bruto</th>
                <th className="p-4 text-right">Deducción Pozo ($5k)</th>
                <th className="p-4 text-right text-emerald-300">Rake Base</th>
                <th className="p-4 text-center">Deal</th>
                <th className="p-4 text-right text-blue-400">Rakeback Bruto</th>
                <th className="p-4 text-right text-rose-400">Promos Jugadores</th>
                <th className="p-4 text-right text-emerald-400">Generado Periodo</th>
                <th className="p-4 text-right text-amber-400 text-sm">Saldo Total</th>
                <th className="p-4 text-center">Acción</th>
              </tr>
              
              <tr className="bg-gray-950 border-b border-gray-700 font-mono text-[11px] font-bold text-white uppercase tracking-wider">
                <th className="py-3 px-4">TOTALES</th>
                <th className="py-3 px-4 text-right text-gray-300">${totalRakeBrutoPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4 text-right text-gray-500">-${totalDeduccionPozoPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4 text-right text-emerald-300">${totalRakeLiquidoPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4"></th>
                <th className="py-3 px-4 text-right text-blue-400">${totalRakebackBrutoPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4 text-right text-rose-400">-${totalPromosJugadoresPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4 text-right text-emerald-400">${totalGeneradoPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4 text-right text-amber-400">${totalSaldoTotal.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            
            <tbody className="text-sm divide-y divide-gray-800">
              {report.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 font-bold">{agent.name}</td>
                  <td className="p-4 text-right font-mono text-gray-300">${agent.grossRakePeriodo.toLocaleString("es-CL")}</td>
                  <td className="p-4 text-right font-mono text-gray-500">-${agent.deduccionPozoPeriodo.toLocaleString("es-CL")}</td>
                  <td className="p-4 text-right font-mono text-emerald-300 font-bold">${agent.rakeLiquidoPeriodo.toLocaleString("es-CL")}</td>
                  <td className="p-4 text-center font-bold text-emerald-500 bg-emerald-500/5">{agent.deal}%</td>
                  <td className="p-4 text-right font-mono text-blue-400 font-bold">${agent.rakebackBrutoPeriodo.toLocaleString("es-CL")}</td>
                  <td className="p-4 text-right font-mono text-rose-400 font-bold">
                    -${(agent.promosJugadoresPeriodo || 0).toLocaleString("es-CL")}
                  </td>
                  <td className="p-4 text-right font-mono text-emerald-400 font-black bg-emerald-500/5">
                    ${agent.generadoPeriodo.toLocaleString("es-CL")}
                  </td>
                  <td className="p-4 text-right font-mono text-amber-400 font-black bg-amber-500/10 text-base">
                    ${agent.saldoTotal.toLocaleString("es-CL")}
                  </td>
                  
                  <td className="p-4 text-center">
                    <Button 
                      variant="accent" 
                      size="sm" 
                      onClick={() => setPayingAgent(agent)} 
                      disabled={agent.generadoPeriodo <= 0 && agent.saldoTotal <= 0}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-8 text-xs border-none"
                    >
                      <Wallet size={14} className="mr-1.5" /> Pagar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-black text-white mb-2">Pagar a {payingAgent.name}</h3>
            
            <div className="bg-gray-950 p-3 rounded-lg border border-gray-800 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] text-gray-400 uppercase tracking-wider">Generado en Periodo:</span>
                <span className="text-emerald-400 font-bold font-mono">${payingAgent.generadoPeriodo.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gray-400 uppercase tracking-wider">Deuda Histórica Total:</span>
                <span className="text-amber-400 font-bold font-mono">${payingAgent.saldoTotal.toLocaleString("es-CL")}</span>
              </div>
              
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
                <Button type="button" variant="secondary" size="sm" className="flex-1 text-[10px] py-1 h-auto" onClick={() => setPayAmount(payingAgent.generadoPeriodo.toString())}>
                  Monto Periodo
                </Button>
                <Button type="button" variant="secondary" size="sm" className="flex-1 text-[10px] py-1 h-auto" onClick={() => setPayAmount(payingAgent.saldoTotal.toString())}>
                  Monto Histórico
                </Button>
              </div>
            </div>

            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono text-gray-400 mb-1 block">Monto a Liquidar</label>
                <input 
                  type="number" 
                  max={Math.max(payingAgent.saldoTotal, payingAgent.generadoPeriodo)} 
                  required 
                  className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none font-mono" 
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)} 
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setPayingAgent(null)}>Cancelar</Button>
                <Button variant="accent" type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white border-none">Registrar Pago</Button>
              </div>
            </form>
          </div>
        </div>
      )}

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