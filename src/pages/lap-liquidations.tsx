// src/pages/lap-liquidations.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";
import { Calculator, Calendar, TrendingUp, PieChart, Users } from "lucide-react";

export function LapLiquidationsPage() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const loadFinancialReport = useCallback(async () => {
    setLoading(true);
    try {
      const { data: agents } = await supabase.from("acc_agents").select("*").order("name");
      const { data: players } = await supabase.from("acc_players").select("clubgg_id, agent_id, nickname");
      
      // Límite de 100.000 agregado a TODAS las tablas para evitar el corte por defecto de Supabase
      const { data: transactions } = await supabase.from("acc_transactions")
        .select("amount, date, agent_id, category, type, clubgg_id")
        .eq("category", "Rakeback")
        .in("type", ["Ingreso", "ingreso"])
        .gte("date", `${startDate}T00:00:00Z`)
        .lte("date", `${endDate}T23:59:59Z`)
        .limit(100000); 
        
      const { data: configs } = await supabase.from("acc_player_promo_config").select("*").limit(100000);
      
      const { data: tourneys } = await supabase.from("tournaments")
        .select("id, created_at, start_datetime")
        .in("club_id", [
          "1da03414-0ed2-416e-b4f4-bd94caabd5c7", // Circuito Chileno de Póker
          "ccb5c5bc-efaf-4710-b9c5-b4e2baa17328"  // LatinAllinPoker
        ])
        .not("league_id", "is", null)
        .limit(100000);
        
      // 🔥 LA MAGIA ESTÁ AQUÍ: Filtramos los torneos en el cliente PRIMERO
      const validTourneys = tourneys?.filter(t => {
        const targetDate = t.start_datetime || t.created_at;
        const tDateStr = new Date(targetDate).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
        return tDateStr >= startDate && tDateStr <= endDate;
      }) || [];

      const tourneyIds = validTourneys.map(t => t.id);
      
      let tResults: any[] = [];
      if (tourneyIds.length > 0) {
        // Al pedir solo los torneos filtrados, no chocamos con el límite de 1000 filas
        const { data: resData } = await supabase.from("tournament_results")
          .select("tournament_id, player_id, buy_ins_count")
          .in("tournament_id", tourneyIds)
          .limit(100000);
        tResults = resData || [];
      }
      
      const { data: tPlayers } = await supabase.from("players").select("id, nickname").limit(100000);
      
      if (!agents) return;

      const calculatedReport = agents.map((agent) => {
        let grossRakePeriodo = 0;
        let deduccionPozoPeriodo = 0;
        let corteRedPeriodo = 0;
        let netoRepartirPeriodo = 0;
        let promosJugadoresPeriodo = 0;
        let agenteNetoPeriodo = 0;

        const myPlayers = players?.filter(p => p.agent_id === agent.id) || [];
        
        myPlayers.forEach(player => {
          // 1. Configuración del Bono
          const defaultCfg = { welcome_active: false };
          const cfg = configs?.find(c => c.clubgg_id === player.clubgg_id) || defaultCfg;
          const isWelcomeActive = cfg.welcome_active ?? false; 
          const isPromoValid = isWelcomeActive && (!cfg.welcome_expiry || endDate <= cfg.welcome_expiry.slice(0, 10));
          
          // 2. Cálculo Buy-ins (Liga CCP)
          const matchingTPlayers = tPlayers?.filter(tp => tp.nickname.toLowerCase().trim() === player.nickname.toLowerCase().trim()) || [];
          const matchingPlayerIds = matchingTPlayers.map(tp => tp.id);
          
          let pBPer = 0;

          if (matchingPlayerIds.length > 0 && tResults && tourneys) {
            tResults.filter(r => matchingPlayerIds.includes(r.player_id)).forEach(res => {
              const tourney = tourneys.find(t => t.id === res.tournament_id);
              if (tourney) {
                const targetDate = tourney.start_datetime || tourney.created_at;
                // Forzamos la lectura en hora de Santiago de Chile para que los torneos de las 21:00 NO salten al día siguiente
const tDateStr = new Date(targetDate).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
                
                let rawBuyins = Number(res.buy_ins_count);
                if (isNaN(rawBuyins) || rawBuyins <= 0) rawBuyins = 1;
                
                if (tDateStr >= startDate && tDateStr <= endDate) {
                  pBPer += rawBuyins;
                }
              }
            });
          }

          // 3. Cálculo de Rake en el Periodo
          let pRakeGenPeriodo = 0;
          transactions?.filter(t => t.clubgg_id === player.clubgg_id).forEach(t => {
             pRakeGenPeriodo += Number(t.amount);
          });

          // === MATEMÁTICA EN CASCADA LINEAL ===
          const pDeduccionLiga = pBPer * 5000;
          const pRakePostLiga = Math.max(0, pRakeGenPeriodo - pDeduccionLiga);
          const pCorteRed = pRakePostLiga * 0.20;
          const pNetoRepartir = pRakePostLiga - pCorteRed;

          let pPromo = 0;
          let pAgentCut = 0;

          if (isPromoValid) {
            // 30% Jugador / 35% Agente / 35% Club
            pPromo = pNetoRepartir * 0.30;
            pAgentCut = pNetoRepartir * 0.35;
          } else {
            // 50% Agente / 50% Club
            pPromo = 0;
            pAgentCut = pNetoRepartir * 0.50;
          }

          // Sumamos al total del Agente
          grossRakePeriodo += pRakeGenPeriodo;
          deduccionPozoPeriodo += pDeduccionLiga;
          corteRedPeriodo += pCorteRed;
          netoRepartirPeriodo += pNetoRepartir;
          promosJugadoresPeriodo += pPromo;
          agenteNetoPeriodo += pAgentCut;
        });

        return {
          id: agent.id,
          name: agent.name,
          grossRakePeriodo, 
          deduccionPozoPeriodo,
          corteRedPeriodo,
          netoRepartirPeriodo,
          promosJugadoresPeriodo, 
          agenteNetoPeriodo,   
        };
      });

      // Ordenamos por Agentes con mayor ganancia neta en el periodo
      setReport(calculatedReport.sort((a, b) => b.agenteNetoPeriodo - a.agenteNetoPeriodo));
    } catch (err: any) {
      console.error("Error al calcular liquidaciones:", err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]); 

  useEffect(() => {
    loadFinancialReport();
  }, [loadFinancialReport]);

  const totalRakeBrutoPer = report.reduce((acc, a) => acc + a.grossRakePeriodo, 0);
  const totalDeduccionPozoPer = report.reduce((acc, a) => acc + a.deduccionPozoPeriodo, 0);
  const totalCorteRedPer = report.reduce((acc, a) => acc + a.corteRedPeriodo, 0);
  const totalNetoRepartirPer = report.reduce((acc, a) => acc + a.netoRepartirPeriodo, 0);
  const totalPromosJugadoresPer = report.reduce((acc, a) => acc + a.promosJugadoresPeriodo, 0);
  const totalAgenteNetoPer = report.reduce((acc, a) => acc + a.agenteNetoPeriodo, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Calculator className="text-amber-400" />
            Liquidaciones de Agentes
          </h2>
          <p className="text-sm text-gray-400">Lectura exacta del rendimiento de agentes en el periodo seleccionado.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700 text-sm text-white shadow-inner">
          <Calendar size={16} className="text-gray-400" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
          <span className="text-gray-600">~</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 overflow-x-auto shadow-xl">
          <table className="w-full text-left text-white min-w-[1200px]">
            <thead className="bg-gray-800 text-[10px] uppercase font-mono tracking-wider text-gray-400">
              <tr>
                <th className="p-4">Agente</th>
                <th className="p-4 text-right">
                  <span className="flex items-center justify-end gap-1"><TrendingUp size={12}/> Rake Bruto</span>
                </th>
                <th className="p-4 text-right">Deducción Liga</th>
                <th className="p-4 text-right">
                  <span className="flex items-center justify-end gap-1"><PieChart size={12}/> Corte Red (20%)</span>
                </th>
                <th className="p-4 text-right text-blue-400">Neto a Repartir</th>
                <th className="p-4 text-right text-pink-400">Promos Jugador</th>
                <th className="p-4 text-right text-amber-400">
                  <span className="flex items-center justify-end gap-1"><Users size={12}/> Corte Agente (Neto)</span>
                </th>
              </tr>
              
              {/* FILA DE TOTALES GENERALES */}
              <tr className="bg-gray-950 border-b-2 border-gray-700 font-mono text-[11px] font-bold text-white uppercase tracking-wider shadow-sm">
                <th className="py-3 px-4">TOTALES DEL PERIODO</th>
                <th className="py-3 px-4 text-right text-gray-300">${totalRakeBrutoPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4 text-right text-orange-400/80">-${totalDeduccionPozoPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4 text-right text-red-400/80">-${totalCorteRedPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4 text-right text-blue-400">${totalNetoRepartirPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4 text-right text-pink-400">-${totalPromosJugadoresPer.toLocaleString("es-CL")}</th>
                <th className="py-3 px-4 text-right text-amber-400 text-sm">${totalAgenteNetoPer.toLocaleString("es-CL")}</th>
              </tr>
            </thead>
            
            <tbody className="text-sm divide-y divide-gray-800">
              {report.map((agent) => {
                if (agent.grossRakePeriodo === 0) return null; // Ocultamos agentes inactivos en el periodo

                return (
                  <tr key={agent.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="p-4 font-bold">{agent.name}</td>
                    <td className="p-4 text-right font-mono text-gray-300">${agent.grossRakePeriodo.toLocaleString("es-CL")}</td>
                    <td className="p-4 text-right font-mono text-orange-400/60">-${agent.deduccionPozoPeriodo.toLocaleString("es-CL")}</td>
                    <td className="p-4 text-right font-mono text-red-400/60">-${agent.corteRedPeriodo.toLocaleString("es-CL")}</td>
                    
                    <td className="p-4 text-right font-mono text-blue-400 font-bold bg-blue-500/5">
                      ${agent.netoRepartirPeriodo.toLocaleString("es-CL")}
                    </td>
                    
                    <td className="p-4 text-right font-mono text-pink-400">
                      {agent.promosJugadoresPeriodo > 0 
                        ? `-$${agent.promosJugadoresPeriodo.toLocaleString("es-CL")}` 
                        : "$0"}
                    </td>
                    
                    <td className="p-4 text-right font-mono text-amber-400 font-black bg-amber-500/10 text-base">
                      ${agent.agenteNetoPeriodo.toLocaleString("es-CL")}
                    </td>
                  </tr>
                );
              })}
              
              {report.every(a => a.grossRakePeriodo === 0) && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 text-sm">
                    No hay actividad de agentes registrada en las fechas seleccionadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}