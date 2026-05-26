// src/pages/lap-dashboard.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { 
  TrendingUp, Landmark, Users, DollarSign, 
  CheckCircle2, Clock, Gift, Calendar as CalendarIcon, History, CreditCard
} from "lucide-react";

export function LapDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(7); // Por defecto 7 días (1 semana)
  
  // Métricas del Periodo Seleccionado
  const [metrics, setMetrics] = useState({
    rakeBruto: 0,
    unionCut: 0,   
    agentsCut: 0,  
    promosPaid: 0, 
    adminNet: 0,   
    activePlayers: 0
  });

  // Deudas Históricas (Globales, no dependen de la fecha)
  const [pending, setPending] = useState({
    union: 0,
    agents: 0,
    players: 0
  });

  // Listados
  const [unionHistory, setUnionHistory] = useState<any[]>([]);
  const [recentFeed, setRecentFeed] = useState<any[]>([]);

  // Pago Unión
  const [unionPayAmount, setUnionPayAmount] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startDate = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000).toISOString();

      // 1. TRAER TODA LA DATA BASE (Sin límite de fecha para cálculos históricos)
      const { data: allTxs } = await supabase.from("acc_transactions").select("*").in("category", ["Rakeback", "Pago Union"]).limit(10000);
      const { data: agents } = await supabase.from("acc_agents").select("*");
      const { data: players } = await supabase.from("acc_players").select("*");
      const { data: allAgentPayouts } = await supabase.from("acc_payouts").select("*");
      const { data: allPromoPayouts } = await supabase.from("acc_player_promo_payouts").select("*");
      
      // Data para calcular promos adeudadas a jugadores (Histórico)
      const { data: configs } = await supabase.from("acc_player_promo_config").select("*");
      
      const { data: tourneys } = await supabase
        .from("tournaments")
        .select("id, created_at")
        .in("club_id", ["ccb5c5bc-efaf-4710-b9c5-b4e2baa17328", "1da03414-0ed2-416e-b4f4-bd94caabd5c7"])
        .not("league_id", "is", null);
        
      const tourneyIds = tourneys?.map((t: any) => t.id) || [];
      
      let tResults: any[] = [];
      if (tourneyIds.length > 0) {
        const { data: resData } = await supabase
          .from("tournament_results")
          .select("tournament_id, player_id, buy_ins_count")
          .in("tournament_id", tourneyIds)
          .limit(10000); // 🔥 Levantamos el límite
        tResults = resData || [];
      }
      
      const { data: tPlayers } = await supabase.from("players").select("id, nickname").limit(10000); // 🔥 Levantamos el límite

      if (allTxs && agents && players) {
        const periodTxs = allTxs.filter(t => t.category === "Rakeback" && ["Ingreso", "ingreso"].includes(t.type) && t.date >= startDate);
        const brutoPeriodo = periodTxs.reduce((sum, t) => sum + Number(t.amount), 0);

        let totalPozoUnionPeriodo = 0;
        let totalPozoUnionHistorico = 0;
        let totalPlayerPromosPeriodo = 0;
        let totalPlayerPromosHistorico = 0;
        let pendingPlayers = 0;

        // 1. Cálculos Globales para Unión y Jugadores
        players.forEach(player => {
          const cfg = configs?.find(c => c.clubgg_id === player.clubgg_id) || { welcome_percentage: 30, liga_active: true };
          const isLigaActive = cfg.liga_active ?? true;
          const isWelcomeActive = cfg.welcome_active ?? false;
          const tPlayer = tPlayers?.find(tp => tp.nickname.toLowerCase() === player.nickname.toLowerCase());

          let ligaBuyInsPeriodo = 0;
          let ligaBuyInsHistorico = 0;

          if (tPlayer && tResults && tourneys) {
            tResults.filter(r => r.player_id === tPlayer.id).forEach(res => {
              const tourney = tourneys.find(t => t.id === res.tournament_id);
              if (tourney && tourney.created_at) {
                const tDateStr = new Date(tourney.created_at).toISOString().slice(0, 10);
                
                // 🔥 CANDADO: Ignoramos la basura vieja (Igual que en Liquidaciones)
                const SYSTEM_START_DATE = "2026-05-18"; 
                if (tDateStr < SYSTEM_START_DATE) return;
                
                const validStart = !cfg.liga_start_date || tDateStr >= cfg.liga_start_date.slice(0, 10);
                const validEnd = !cfg.liga_expiry || tDateStr <= cfg.liga_expiry.slice(0, 10);
                
                if (validStart && validEnd) {
                  const buyins = Number(res.buy_ins_count) || 0;
                  ligaBuyInsHistorico += buyins;
                  if (tDateStr >= startDate.slice(0, 10)) ligaBuyInsPeriodo += buyins;
                }
              }
            });
          }

          // 🔥 Aportes a la Unión (5000 por entry)
          totalPozoUnionHistorico += (ligaBuyInsHistorico * 5000);
          totalPozoUnionPeriodo += (ligaBuyInsPeriodo * 5000);

          // Promos Reales para Jugador (2000 Liga + % Bienvenida)
          const bonoLigaHistorico = isLigaActive ? ligaBuyInsHistorico * 2000 : 0;
          const bonoLigaPeriodo = isLigaActive ? ligaBuyInsPeriodo * 2000 : 0;

          let rakeGenPeriodo = 0;
          let rakeGenHistorico = 0;

          allTxs.filter(t => t.category === "Rakeback" && t.clubgg_id === player.clubgg_id && ["Ingreso", "ingreso"].includes(t.type)).forEach(t => {
            const tDateStr = new Date(t.date).toISOString().slice(0, 10);
            const validStart = !cfg.welcome_start_date || tDateStr >= cfg.welcome_start_date.slice(0, 10);
            const validEnd = !cfg.welcome_expiry || tDateStr <= cfg.welcome_expiry.slice(0, 10);
            
            if (validStart && validEnd) {
              const amt = Number(t.amount);
              rakeGenHistorico += amt;
              if (tDateStr >= startDate.slice(0, 10)) rakeGenPeriodo += amt;
            }
          });

          const costoLigaTotalHist = ligaBuyInsHistorico * 7000;
          const rakeOtrosHist = Math.max(0, rakeGenHistorico - costoLigaTotalHist);
          let bonoBienvenidaHist = isWelcomeActive ? (rakeOtrosHist * (Number(cfg.welcome_percentage) / 100)) : 0;
          if (cfg.welcome_max_amount && bonoBienvenidaHist > Number(cfg.welcome_max_amount)) bonoBienvenidaHist = Number(cfg.welcome_max_amount);

          const costoLigaTotalPer = ligaBuyInsPeriodo * 7000;
          const rakeOtrosPer = Math.max(0, rakeGenPeriodo - costoLigaTotalPer);
          let bonoBienvenidaPer = isWelcomeActive ? (rakeOtrosPer * (Number(cfg.welcome_percentage) / 100)) : 0;
          if (cfg.welcome_max_amount && bonoBienvenidaPer > Number(cfg.welcome_max_amount)) bonoBienvenidaPer = Number(cfg.welcome_max_amount);

          const totalPromosJugadorHist = bonoLigaHistorico + bonoBienvenidaHist;
          totalPlayerPromosHistorico += totalPromosJugadorHist;
          totalPlayerPromosPeriodo += (bonoLigaPeriodo + bonoBienvenidaPer);

          const pPaid = allPromoPayouts?.filter(p => p.clubgg_id === player.clubgg_id).reduce((sum, p) => sum + Number(p.total_paid), 0) || 0;
          const pDebt = totalPromosJugadorHist - pPaid;
          if (pDebt > 0) pendingPlayers += pDebt;
        });

        // 🔥 NUEVA REGLA UNIÓN: 20% Rake + $5000 por cada entry
        const unionPeriodo = (brutoPeriodo * 0.20) + totalPozoUnionPeriodo;

        let agentsNetPeriodo = 0;
        let pendingAgents = 0;
        
        // 2. Cálculos por Agente
        agents.forEach(ag => {
          if (ag.name === "GettingRIcher") return;

          let agDeduccionTotalPeriodo = 0;
          let agDeduccionTotalHistorico = 0;

          players.filter(p => p.agent_id === ag.id).forEach(player => {
            const cfg = configs?.find(c => c.clubgg_id === player.clubgg_id) || { welcome_percentage: 30, liga_active: true };
            const isLigaActive = cfg.liga_active ?? true;
            const isWelcomeActive = cfg.welcome_active ?? false;
            const tPlayer = tPlayers?.find(tp => tp.nickname.toLowerCase() === player.nickname.toLowerCase());

            let lBuyPeriodo = 0;
            let lBuyHistorico = 0;
            if (tPlayer && tResults && tourneys) {
              tResults.filter(r => r.player_id === tPlayer.id).forEach(res => {
                const tourney = tourneys.find(t => t.id === res.tournament_id);
                if (tourney && tourney.created_at) {
                  const tDateStr = new Date(tourney.created_at).toISOString().slice(0, 10);
                  const SYSTEM_START_DATE = "2026-05-18";
                  if (tDateStr < SYSTEM_START_DATE) return;
                  const validStart = !cfg.liga_start_date || tDateStr >= cfg.liga_start_date.slice(0, 10);
                  const validEnd = !cfg.liga_expiry || tDateStr <= cfg.liga_expiry.slice(0, 10);
                  if (validStart && validEnd) {
                    lBuyHistorico += Number(res.buy_ins_count) || 0;
                    if (tDateStr >= startDate.slice(0, 10)) lBuyPeriodo += Number(res.buy_ins_count) || 0;
                  }
                }
              });
            }

            const pUnionHist = lBuyHistorico * 5000;
            const pUnionPer = lBuyPeriodo * 5000;
            const bLigaHist = isLigaActive ? lBuyHistorico * 2000 : 0;
            const bLigaPer = isLigaActive ? lBuyPeriodo * 2000 : 0;

            let rGenPer = 0;
            let rGenHist = 0;
            allTxs.filter(t => t.category === "Rakeback" && t.clubgg_id === player.clubgg_id && ["Ingreso", "ingreso"].includes(t.type)).forEach(t => {
              const tDateStr = new Date(t.date).toISOString().slice(0, 10);
              const validStart = !cfg.welcome_start_date || tDateStr >= cfg.welcome_start_date.slice(0, 10);
              const validEnd = !cfg.welcome_expiry || tDateStr <= cfg.welcome_expiry.slice(0, 10);
              if (validStart && validEnd) {
                rGenHist += Number(t.amount);
                if (tDateStr >= startDate.slice(0, 10)) rGenPer += Number(t.amount);
              }
            });

            const costHist = lBuyHistorico * 7000;
            let bBienvHist = isWelcomeActive ? (Math.max(0, rGenHist - costHist) * (Number(cfg.welcome_percentage) / 100)) : 0;
            if (cfg.welcome_max_amount && bBienvHist > Number(cfg.welcome_max_amount)) bBienvHist = Number(cfg.welcome_max_amount);

            const costPer = lBuyPeriodo * 7000;
            let bBienvPer = isWelcomeActive ? (Math.max(0, rGenPer - costPer) * (Number(cfg.welcome_percentage) / 100)) : 0;
            if (cfg.welcome_max_amount && bBienvPer > Number(cfg.welcome_max_amount)) bBienvPer = Number(cfg.welcome_max_amount);

            agDeduccionTotalHistorico += (pUnionHist + bLigaHist + bBienvHist);
            agDeduccionTotalPeriodo += (pUnionPer + bLigaPer + bBienvPer);
          });

          // Métricas Agente Periodo
          const agDeal = Number(ag.deal_percentage) / 100;
          const agPeriodRake = periodTxs.filter(t => t.agent_id === ag.id).reduce((s, t) => s + Number(t.amount), 0);
          const agGrossPeriod = agPeriodRake * agDeal;
          agentsNetPeriodo += (agGrossPeriod - agDeduccionTotalPeriodo);

          // Deuda Histórica Agente
          const agRakeHist = allTxs.filter(t => t.category === "Rakeback" && t.agent_id === ag.id && ["Ingreso", "ingreso"].includes(t.type)).reduce((s, t) => s + Number(t.amount), 0);
          const agGrossHist = agRakeHist * agDeal;
          const agPaid = allAgentPayouts?.filter(p => p.agent_id === ag.id).reduce((s, p) => s + Number(p.amount), 0) || 0;
          const debt = agGrossHist - agPaid - agDeduccionTotalHistorico;
          if (debt > 0) pendingAgents += debt;
        });

        // 3. Utilidad Neta del Admin
        const netPeriodo = brutoPeriodo - unionPeriodo - agentsNetPeriodo - totalPlayerPromosPeriodo;
        const uniquePlayers = new Set(periodTxs.map(t => t.clubgg_id)).size;

        setMetrics({
          rakeBruto: brutoPeriodo,
          unionCut: unionPeriodo,
          agentsCut: agentsNetPeriodo,
          promosPaid: totalPlayerPromosPeriodo, // Promos Asumidas en este periodo para que la matemática cierre perfecta
          adminNet: netPeriodo,
          activePlayers: uniquePlayers
        });

        // 4. Deuda Total Unión
        const totalRakeHistorico = allTxs.filter(t => t.category === "Rakeback" && ["Ingreso", "ingreso"].includes(t.type)).reduce((sum, t) => sum + Number(t.amount), 0);
        const pendingUnion = (totalRakeHistorico * 0.20) + totalPozoUnionHistorico - allTxs.filter(t => t.category === "Pago Union").reduce((sum, t) => sum + Number(t.amount), 0);

        setPending({ union: pendingUnion, agents: pendingAgents, players: pendingPlayers });

        // --- HISTORIALES PARA TABLAS ---
        const unionTxs = allTxs.filter(t => t.category === "Pago Union").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setUnionHistory(unionTxs);
      }

      // 4. Últimos movimientos generales
      const { data: recent } = await supabase.from("acc_transactions").select("id, amount, date, category, type, is_manual, acc_players(nickname)").order("date", { ascending: false }).limit(6);
      setRecentFeed(recent || []);

    } catch (err: any) {
      console.error("Error cargando dashboard:", err.message);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

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
      loadDashboardData(); // Refresca los saldos y el historial
    } catch (err: any) {
      alert("Error registrando pago: " + err.message);
    } finally {
      setIsPaying(false);
    }
  };

  if (loading && metrics.rakeBruto === 0) return <div className="py-20 flex justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      
      {/* HEADER Y SELECTOR DE FECHAS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Dashboard Financiero</h2>
          <p className="text-sm text-gray-400">Rendimiento, comisiones y control de deudas.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-xs text-emerald-500 bg-emerald-900/30 px-3 py-2 rounded-lg border border-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={14} /> Sistema Sincronizado
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-1 flex items-center">
            <CalendarIcon size={16} className="text-gray-400 ml-2 mr-1" />
            <select 
              className="bg-transparent text-sm text-white font-bold outline-none cursor-pointer p-1"
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
            >
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 3 meses</option>
              <option value={180}>Últimos 6 meses</option>
              <option value={365}>Último Año</option>
            </select>
          </div>
        </div>
      </div>

      {/* SECCIÓN 1: FOTOGRAFÍA DEL PERIODO (KPIs) */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Utilidad del Periodo ({dateRange} días)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64} /></div>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Rake Bruto</p>
            <h3 className="text-2xl font-black text-white font-mono">${metrics.rakeBruto.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-gray-500 mt-2">{metrics.activePlayers} jugadores activos</p>
          </div>

          <div className="bg-indigo-900/40 border border-indigo-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-400"><Landmark size={64} /></div>
            <p className="text-[11px] text-indigo-300 font-bold uppercase tracking-wider mb-1">Corte CCP (20%)</p>
            <h3 className="text-2xl font-black text-indigo-400 font-mono">-${metrics.unionCut.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-indigo-500/70 mt-2">Deducción de la red</p>
          </div>

          <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-400"><Users size={64} /></div>
            <p className="text-[11px] text-amber-300/80 font-bold uppercase tracking-wider mb-1">Agentes (Neto)</p>
            <h3 className="text-2xl font-black text-amber-400 font-mono">-${metrics.agentsCut.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-amber-500/50 mt-2">Rake - Promos asimiladas</p>
          </div>

          <div className="bg-pink-900/20 border border-pink-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-pink-400"><Gift size={64} /></div>
            <p className="text-[11px] text-pink-300 font-bold uppercase tracking-wider mb-1">Promos Pagadas</p>
            <h3 className="text-2xl font-black text-pink-400 font-mono">-${metrics.promosPaid.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-pink-500/60 mt-2">Dinero devuelto a jugadores</p>
          </div>

          <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden ring-1 ring-emerald-500/30">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-400"><DollarSign size={64} /></div>
            <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Utilidad Club</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono">${metrics.adminNet.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-emerald-500/60 mt-2">100% libre de compromisos</p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: DEUDAS HISTÓRICAS */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Saldos Pendientes (Histórico)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* DEUDA UNIÓN CCP */}
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
              <Button variant="accent" className="bg-indigo-600 hover:bg-indigo-500 text-white" disabled={isPaying || !unionPayAmount} onClick={handlePayUnion}>
                {isPaying ? <Spinner size="sm" /> : <CreditCard size={16} />}
              </Button>
            </div>
          </div>

          {/* DEUDA AGENTES */}
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

          {/* DEUDA JUGADORES */}
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

      {/* SECCIÓN 3: HISTORIALES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* TABLA PAGOS CCP */}
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

        {/* FEED DE ACTIVIDAD */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-blue-400" />
            Actividad Reciente en Caja
          </h3>
          <div className="space-y-3">
            {recentFeed.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No hay movimientos.</p>
            ) : (
              recentFeed.map((tx, i) => {
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