// src/pages/lap-dashboard.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { 
  TrendingUp, Landmark, Users, DollarSign, 
  CheckCircle2, Clock, Gift, Calendar as CalendarIcon, History, CreditCard,
  Target
} from "lucide-react";

const SYSTEM_START_DATE = "2026-06-08T00:00:00Z";

export function LapDashboardPage() {
  const [loading, setLoading] = useState(true);
  
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  
  const [metrics, setMetrics] = useState({
    rakeBruto: 0,
    premiosLiga: 0,
    unionRakeLiquido: 0,
    totalUnion: 0,
    agentesNeto: 0,
    promosJugadores: 0,
    adminNet: 0,
    activePlayers: 0
  });

  const [pending, setPending] = useState({
    union: 0,
    agents: 0,
    players: 0
  });

  const [unionHistory, setUnionHistory] = useState<any[]>([]);
  const [recentFeed, setRecentFeed] = useState<any[]>([]);
  const [unionPayAmount, setUnionPayAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: allTxs } = await supabase.from("acc_transactions").select("*").in("category", ["Rakeback", "Pago Union"]).gte("date", SYSTEM_START_DATE).limit(100000);
      const { data: agents } = await supabase.from("acc_agents").select("*");
      const { data: players } = await supabase.from("acc_players").select("*");
      const { data: allAgentPayouts } = await supabase.from("acc_payouts").select("*").gte("created_at", SYSTEM_START_DATE);
      const { data: allPromoPayouts } = await supabase.from("acc_player_promo_payouts").select("*");
      const { data: configs } = await supabase.from("acc_player_promo_config").select("*");
      const { data: tourneys } = await supabase.from("tournaments").select("id, created_at, start_datetime").not("league_id", "is", null).gte("created_at", SYSTEM_START_DATE);
        
      const tourneyIds = tourneys?.map((t: any) => t.id) || [];
      
      let tResults: any[] = [];
      if (tourneyIds.length > 0) {
        const { data: resData } = await supabase.from("tournament_results").select("tournament_id, player_id, buy_ins_count").in("tournament_id", tourneyIds).limit(100000);
        tResults = resData || [];
      }
      
      const { data: tPlayers } = await supabase.from("players").select("id, nickname").limit(100000);

      if (allTxs && agents && players) {
        
        let gRakeBrutoPer = 0; let gRakeBrutoHist = 0;
        let gBuyinsPer = 0; let gBuyinsHist = 0;
        
        let gAgentsGrossPer = 0;
        let gTotalWelcomeBonoPer = 0;
        
        let gPendingAgents = 0;
        let gPendingPlayers = 0;

        const activePlayersSet = new Set();

        agents.forEach(agent => {
          let agentRakeBrutoHist = 0; let agentRakeBrutoPer = 0;
          let agBuyHist = 0; let agBuyPer = 0;
          let agWelcomeBonoHist = 0; 

          const myPlayers = players.filter(p => p.agent_id === agent.id);

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
                  if (tDateStr >= startDate && tDateStr <= endDate) {
                    pBPer += buyins;
                  }
                }
              });
            }

            agBuyHist += pBHist; 
            agBuyPer += pBPer;

            let pRakeGenHist = 0; let pRakeGenPer = 0;
            allTxs.filter(t => t.clubgg_id === player.clubgg_id && ["Ingreso", "ingreso"].includes(t.type)).forEach(t => {
              const tDateStr = new Date(t.date).toISOString().slice(0, 10);
              const validStart = !cfg.welcome_start_date || tDateStr >= cfg.welcome_start_date.slice(0, 10);
              const validEnd = !cfg.welcome_expiry || tDateStr <= cfg.welcome_expiry.slice(0, 10);
              
              if (validStart && validEnd) {
                pRakeGenHist += Number(t.amount);
                if (tDateStr >= startDate && tDateStr <= endDate) {
                  pRakeGenPer += Number(t.amount);
                  activePlayersSet.add(player.clubgg_id); 
                }
              }
            });

            agentRakeBrutoHist += pRakeGenHist; agentRakeBrutoPer += pRakeGenPer;

            // Histórico Promos Jugador
            const pDeduccionHist = pBHist * 5000;
            let pBonoWHist = isWelcomeActive ? (Math.max(0, pRakeGenHist - pDeduccionHist) * (Number(cfg.welcome_percentage) / 100)) : 0;
            if (cfg.welcome_max_amount && pBonoWHist > Number(cfg.welcome_max_amount)) pBonoWHist = Number(cfg.welcome_max_amount);
            agWelcomeBonoHist += pBonoWHist;

            const pTotalGeneradoHist = pBonoWHist; // Solo Bono Bienvenida
            const pPaid = allPromoPayouts?.filter((p) => p.clubgg_id === player.clubgg_id).reduce((sum, p) => sum + Number(p.total_paid), 0) || 0;
            const pDebt = pTotalGeneradoHist - pPaid;
            if (pDebt > 0) gPendingPlayers += pDebt;

            // Periodo Promos Jugador
            const pDeduccionPer = pBPer * 5000;
            let pBonoWPer = isWelcomeActive ? (Math.max(0, pRakeGenPer - pDeduccionPer) * (Number(cfg.welcome_percentage) / 100)) : 0;
            if (cfg.welcome_max_amount && pBonoWPer > Number(cfg.welcome_max_amount)) pBonoWPer = Number(cfg.welcome_max_amount);
            
            gTotalWelcomeBonoPer += pBonoWPer;
          });

          gRakeBrutoHist += agentRakeBrutoHist; gRakeBrutoPer += agentRakeBrutoPer;
          gBuyinsHist += agBuyHist; gBuyinsPer += agBuyPer;

          const dealPerc = Number(agent.deal_percentage || 0);
          
          // Histórico Agente
          const agDeduccionHist = agBuyHist * 5000;
          const agRakeLiqHist = Math.max(0, agentRakeBrutoHist - agDeduccionHist);
          const aRecibirHist = agRakeLiqHist * (dealPerc / 100);
          const agGeneradoHist = aRecibirHist - agWelcomeBonoHist; 
          
          const agPaid = allAgentPayouts?.filter((p) => p.agent_id === agent.id).reduce((sum, p) => sum + Number(p.amount), 0) || 0;
          const agDebt = agGeneradoHist - agPaid;
          if (agDebt > 0) gPendingAgents += agDebt;

          // Periodo Agente
          const agDeduccionPer = agBuyPer * 5000;
          const agRakeLiqPer = Math.max(0, agentRakeBrutoPer - agDeduccionPer);
          const agGrossPeriod = agRakeLiqPer * (dealPerc / 100);
          gAgentsGrossPer += agGrossPeriod; 
        });

        // 🔥 MATEMÁTICA CORREGIDA DE LA UNIÓN
        const premiosLigaPer = gBuyinsPer * 5000; 
        
        // Rake Líquido Global = Rake Bruto - Premios ($5000)
        const unionRakeLiquidoPer = Math.max(0, gRakeBrutoPer - premiosLigaPer);
        const corteRedPer = unionRakeLiquidoPer * 0.20; 
        
        const totalUnionPer = premiosLigaPer + corteRedPer;

        // Distribución a Agentes y Jugadores
        const totalPromosJugadoresPer = gTotalWelcomeBonoPer; // Solo Bono Bienvenida
        const totalAgentesNetoPer = gAgentsGrossPer - gTotalWelcomeBonoPer;

        // Utilidad Final Club
        const adminNetPer = gRakeBrutoPer - totalUnionPer - totalAgentesNetoPer - totalPromosJugadoresPer;

        setMetrics({
          rakeBruto: gRakeBrutoPer,
          premiosLiga: premiosLigaPer,
          unionRakeLiquido: unionRakeLiquidoPer,
          totalUnion: totalUnionPer,
          agentesNeto: totalAgentesNetoPer,
          promosJugadores: totalPromosJugadoresPer,
          adminNet: adminNetPer,
          activePlayers: activePlayersSet.size
        });

        // 🔥 DEUDA HISTÓRICA UNIÓN
        const premiosLigaHist = gBuyinsHist * 5000;
        const unionRakeLiquidoHist = Math.max(0, gRakeBrutoHist - premiosLigaHist);
        
        const unionCutHistTotal = (unionRakeLiquidoHist * 0.20) + premiosLigaHist;
        const unionPaid = allTxs.filter(t => t.category === "Pago Union").reduce((sum, t) => sum + Number(t.amount), 0);
        const gPendingUnion = unionCutHistTotal - unionPaid;

        setPending({ union: gPendingUnion, agents: gPendingAgents, players: gPendingPlayers });

        const unionTxs = allTxs.filter(t => t.category === "Pago Union").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setUnionHistory(unionTxs);
      }

      const { data: recent } = await supabase.from("acc_transactions").select("id, amount, date, category, type, is_manual, acc_players(nickname)").order("date", { ascending: false }).limit(6);
      setRecentFeed(recent || []);

    } catch (err: any) {
      console.error("Error cargando dashboard:", err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handlePayUnion = async () => {
    if (!unionPayAmount || isNaN(Number(unionPayAmount)) || Number(unionPayAmount) <= 0) return alert("Monto inválido");
    setIsPaying(true);
    try {
      const { error } = await supabase.from("acc_transactions").insert({
        amount: Number(unionPayAmount),
        category: "Pago Union",
        type: "Egreso",
        is_manual: true,
        date: new Date().toISOString()
      });
      if (error) throw error;
      setUnionPayAmount("");
      loadDashboardData(); 
    } catch (err: any) {
      alert("Error registrando pago: " + err.message);
    } finally {
      setIsPaying(false);
    }
  };

  if (loading && metrics.rakeBruto === 0) return <div className="py-20 flex justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Dashboard Financiero</h2>
          <p className="text-sm text-gray-400">Rendimiento, comisiones y control de deudas.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="text-[11px] sm:text-xs text-emerald-500 bg-emerald-900/30 px-3 py-2 rounded-lg border border-emerald-800 flex items-center gap-2 font-bold">
            <CheckCircle2 size={14} /> Sistema Sincronizado
          </div>
          
          <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700 text-sm text-white h-full">
            <CalendarIcon size={16} className="text-gray-400" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
            <span className="text-gray-600">~</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none cursor-pointer" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Cálculo Base (Fecha Seleccionada)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64} /></div>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Rake Bruto</p>
            <h3 className="text-2xl font-black text-white font-mono">${metrics.rakeBruto.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-gray-500 mt-2">{metrics.activePlayers} jugadores activos</p>
          </div>

          <div className="bg-orange-900/20 border border-orange-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-orange-400"><Target size={64} /></div>
            <p className="text-[11px] text-orange-300 font-bold uppercase tracking-wider mb-1">Deducción Premios de Liga</p>
            <h3 className="text-2xl font-black text-orange-400 font-mono">-${metrics.premiosLiga.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-orange-500/70 mt-2">Deducción de Pozo ($5k x Entrada)</p>
          </div>

          <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-400"><Landmark size={64} /></div>
            <p className="text-[11px] text-blue-300 font-bold uppercase tracking-wider mb-1">Rake Base</p>
            <h3 className="text-2xl font-black text-blue-400 font-mono">${metrics.unionRakeLiquido.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-blue-500/70 mt-2">Base de repartición porcentual</p>
          </div>

          <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden ring-1 ring-emerald-500/30">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-400"><DollarSign size={64} /></div>
            <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Utilidad Club</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono">${metrics.adminNet.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-emerald-500/60 mt-2">100% libre de compromisos</p>
          </div>

        </div>

        <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Desglose a Pagar (Distribución del Periodo)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="bg-indigo-900/40 border border-indigo-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-400"><Landmark size={64} /></div>
            <p className="text-[11px] text-indigo-300 font-bold uppercase tracking-wider mb-1">Total Unión CCP</p>
            <h3 className="text-2xl font-black text-indigo-400 font-mono">-${metrics.totalUnion.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-indigo-500/70 mt-2">20% Corte Red + Pozo Liga</p>
          </div>

          <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-400"><Users size={64} /></div>
            <p className="text-[11px] text-amber-300/80 font-bold uppercase tracking-wider mb-1">Agentes (Neto)</p>
            <h3 className="text-2xl font-black text-amber-400 font-mono">-${metrics.agentesNeto.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-amber-500/50 mt-2">Comisiones menos promos</p>
          </div>

          <div className="bg-pink-900/20 border border-pink-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-pink-400"><Gift size={64} /></div>
            <p className="text-[11px] text-pink-300 font-bold uppercase tracking-wider mb-1">Promos Jugadores</p>
            <h3 className="text-2xl font-black text-pink-400 font-mono">-${metrics.promosJugadores.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-pink-500/60 mt-2">Bono Bienvenida</p>
          </div>

        </div>
      </div>

      <div className="pt-4">
        <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Saldos Pendientes (Histórico Intocable)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-indigo-400 font-bold">
                <Landmark size={20} /> Unión CCP
              </div>
              {pending.union > 0 && <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-500/30 animate-pulse">Deuda Activa</span>}
            </div>
            <h3 className="text-3xl font-black text-white font-mono mb-4">${pending.union.toLocaleString("es-CL")}</h3>
            <div className="flex gap-2">
              <input 
                type="number" 
                placeholder="Monto a pagar" 
                value={unionPayAmount}
                onChange={e => setUnionPayAmount(e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-indigo-500"
              />
              <Button variant="accent" className="bg-indigo-600 hover:bg-indigo-500 text-white border-none" disabled={isPaying || !unionPayAmount} onClick={handlePayUnion}>
                {isPaying ? <Spinner size="sm" /> : <CreditCard size={16} />}
              </Button>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <Users size={20} /> Comisiones Agentes
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-1">Monto global sin liquidar:</p>
              <h3 className="text-3xl font-black text-white font-mono mb-4">${pending.agents.toLocaleString("es-CL")}</h3>
            </div>
            <a href="/lap-admin/liquidations" className="text-xs text-amber-400 hover:text-amber-300 text-center bg-amber-500/10 py-2 rounded-lg border border-amber-500/20 transition-colors">
              Ir a Panel de Liquidaciones
            </a>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-pink-400 font-bold">
                  <Gift size={20} /> Promos Jugadores
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-1">Bonos pendientes por entregar:</p>
              <h3 className="text-3xl font-black text-white font-mono mb-4">${pending.players.toLocaleString("es-CL")}</h3>
            </div>
            <a href="/lap-admin/promotions" className="text-xs text-pink-400 hover:text-pink-300 text-center bg-pink-500/10 py-2 rounded-lg border border-pink-500/20 transition-colors">
              Ir a Pagar Promociones
            </a>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <History size={16} className="text-indigo-400" />
            Historial de Pagos a Unión CCP
          </h3>
          <div className="space-y-3">
            {unionHistory.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">No hay pagos registrados.</p>
            ) : (
              unionHistory.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex justify-between items-center border-b border-gray-700/50 last:border-0 pb-3 last:pb-0">
                  <div>
                    <p className="text-xs font-bold text-gray-300">Pago registrado</p>
                    <p className="text-[10px] text-gray-500">{new Date(tx.date).toLocaleString("es-CL")}</p>
                  </div>
                  <div className="text-sm font-mono font-bold text-emerald-400">
                    ${Number(tx.amount).toLocaleString("es-CL")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-blue-400" />
            Actividad Reciente en Caja
          </h3>
          <div className="space-y-3">
            {recentFeed.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No hay movimientos.</p>
            ) : (
              recentFeed.map((tx: any, i: number) => {
                const isIngreso = tx.type === "Ingreso" || tx.type === "Send Chips";
                return (
                  <div key={i} className="flex justify-between items-center border-b border-gray-700/50 last:border-0 pb-2 last:pb-0">
                    <div>
                      <p className="text-xs font-bold text-gray-300">{tx.acc_players?.nickname || "Sistema"}</p>
                      <p className="text-[9px] text-gray-500">{tx.category} {tx.is_manual ? '(Manual)' : '(CSV)'}</p>
                    </div>
                    <div className={`text-xs font-mono font-bold ${isIngreso ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isIngreso ? '+' : '-'}${Number(tx.amount).toLocaleString("es-CL")}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}