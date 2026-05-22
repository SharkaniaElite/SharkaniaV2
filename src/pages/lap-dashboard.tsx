// src/pages/lap-dashboard.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";
import { 
  TrendingUp, Landmark, Users, DollarSign, 
  AlertTriangle, Activity, CheckCircle2, Clock 
} from "lucide-react";

export function LapDashboardPage() {
  const [loading, setLoading] = useState(true);
  
  // Métricas del Mes Actual
  const [metrics, setMetrics] = useState({
    rakeBruto: 0,
    unionCut: 0,   // 20% Fijo
    agentsCut: 0,  // Variable según deal
    adminNet: 0,   // Lo que queda para el Club/Promos
    activePlayers: 0
  });

  // Datos para Gráfico
  const [chartData, setChartData] = useState<{date: string, amount: number}[]>([]);
  
  // Alertas
  const [alerts, setAlerts] = useState({ agentsInDebt: 0, totalDebt: 0 });
  
  // Última Actividad
  const [recentFeed, setRecentFeed] = useState<any[]>([]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // 1. TRAER RAKE DEL MES ACTUAL
      const { data: monthTxs } = await supabase
        .from("acc_transactions")
        .select("amount, date, agent_id, clubgg_id")
        .eq("category", "Rakeback")
        .in("type", ["Ingreso", "ingreso"])
        .gte("date", firstDayOfMonth)
        .lte("date", lastDayOfMonth);

      // 2. TRAER AGENTES PARA CALCULAR COMISIONES
      const { data: agents } = await supabase.from("acc_agents").select("*");

      // 3. TRAER HISTÓRICO PARA CALCULAR DEUDAS A AGENTES
      const { data: allTxs } = await supabase.from("acc_transactions").select("amount, agent_id").eq("category", "Rakeback").in("type", ["Ingreso", "ingreso"]);
      const { data: allPayouts } = await supabase.from("acc_payouts").select("amount, agent_id");

      // 4. TRAER ÚLTIMOS 5 MOVIMIENTOS GENERALES
      const { data: recent } = await supabase
        .from("acc_transactions")
        .select("id, amount, date, category, type, is_manual, acc_players(nickname)")
        .order("date", { ascending: false })
        .limit(6);

      if (monthTxs && agents) {
        // --- MATEMÁTICA DEL MES ---
        const bruto = monthTxs.reduce((sum, t) => sum + Number(t.amount), 0);
        const union = bruto * 0.20; // 🔥 20% INTOCABLE DE LA UNIÓN

        // Calcular el corte de agentes (EXCLUYENDO a GettingRIcher)
        let agentsTotal = 0;
        monthTxs.forEach(tx => {
          const agent = agents.find(a => a.id === tx.agent_id);
          // 🔥 Si es el admin (GettingRIcher), NO va a deuda de agentes, se absorbe en el Neto Club
          if (agent && agent.name !== "GettingRIcher") {
            const deal = Number(agent.deal_percentage) / 100;
            agentsTotal += Number(tx.amount) * deal;
          }
        });

        // Lo que queda para el Club (Admin)
        const net = bruto - union - agentsTotal;

        // Jugadores Únicos
        const uniquePlayers = new Set(monthTxs.map(t => t.clubgg_id)).size;

        setMetrics({
          rakeBruto: bruto,
          unionCut: union,
          agentsCut: agentsTotal,
          adminNet: net,
          activePlayers: uniquePlayers
        });

        // --- MATEMÁTICA DE GRÁFICO (Últimos 14 días) ---
        const last14Days = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          
          const dayTotal = monthTxs
            .filter(t => t.date.startsWith(dateStr))
            .reduce((sum, t) => sum + Number(t.amount), 0);
            
          last14Days.push({ date: d.toLocaleDateString("es-CL", { day: '2-digit', month: 'short' }), amount: dayTotal });
        }
        setChartData(last14Days);

        // --- MATEMÁTICA DE ALERTAS (Deudas a Agentes) ---
        let agentsInDebt = 0;
        let totalDebt = 0;
        
        agents.forEach(ag => {
          // 🔥 El admin no se debe plata a sí mismo, ignorarlo de la alerta de deudas
          if (ag.name === "GettingRIcher") return; 
          
          const hisRake = allTxs?.filter(t => t.agent_id === ag.id).reduce((s, t) => s + Number(t.amount), 0) || 0;
          const hisPaid = allPayouts?.filter(p => p.agent_id === ag.id).reduce((s, p) => s + Number(p.amount), 0) || 0;
          const commission = hisRake * (Number(ag.deal_percentage) / 100);
          const pending = commission - hisPaid;
          
          if (pending > 1) { 
            agentsInDebt++;
            totalDebt += pending;
          }
        });

        setAlerts({ agentsInDebt, totalDebt });
      }

      setRecentFeed(recent || []);
    } catch (err: any) {
      console.error("Error cargando dashboard:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Encontrar el valor máximo para escalar el gráfico
  const maxChartValue = Math.max(...chartData.map(d => d.amount), 1);

  if (loading) return <div className="py-20 flex justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-white">Dashboard Financiero</h2>
          <p className="text-sm text-gray-400">Resumen operativo del mes en curso.</p>
        </div>
        <div className="text-xs text-emerald-500 bg-emerald-900/30 px-3 py-1.5 rounded-full border border-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={14} /> Sistema Sincronizado
        </div>
      </div>

      {/* 4 KPIs PRINCIPALES (LA FOTOGRAFÍA FINANCIERA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RAKE BRUTO */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64} /></div>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Rake Bruto (Mes)</p>
          <h3 className="text-2xl font-black text-white font-mono">${metrics.rakeBruto.toLocaleString("es-CL")}</h3>
          <p className="text-[10px] text-gray-500 mt-2">{metrics.activePlayers} jugadores activos este mes</p>
        </div>

        {/* UNION CCP */}
        <div className="bg-indigo-900/40 border border-indigo-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-400"><Landmark size={64} /></div>
          <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-1">Unión CCP (20%)</p>
          <h3 className="text-2xl font-black text-indigo-400 font-mono">-${metrics.unionCut.toLocaleString("es-CL")}</h3>
          <p className="text-[10px] text-indigo-500/70 mt-2">Deducción fija por red</p>
        </div>

        {/* AGENTES */}
        <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-400"><Users size={64} /></div>
          <p className="text-xs text-amber-300/80 font-bold uppercase tracking-wider mb-1">Comisión Agentes</p>
          <h3 className="text-2xl font-black text-amber-400 font-mono">-${metrics.agentsCut.toLocaleString("es-CL")}</h3>
          <p className="text-[10px] text-amber-500/50 mt-2">Deducción variable por deals</p>
        </div>

        {/* NETO ADMIN */}
        <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden ring-1 ring-emerald-500/30">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-400"><DollarSign size={64} /></div>
          <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1">Neto Club (Admin)</p>
          <h3 className="text-2xl font-black text-emerald-400 font-mono">${metrics.adminNet.toLocaleString("es-CL")}</h3>
          <p className="text-[10px] text-emerald-500/60 mt-2">Disponible para caja y promociones</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRÁFICO DE BARRAS (2 Columnas de ancho) */}
        <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
            <Activity size={16} className="text-emerald-500" />
            Rake Generado (Últimos 14 días)
          </h3>
          
          <div className="h-48 flex items-end gap-2 px-2">
            {chartData.map((day, i) => {
              const height = day.amount > 0 ? Math.max((day.amount / maxChartValue) * 100, 5) : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                  {/* Tooltip Hover */}
                  <div className="absolute -top-8 bg-gray-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono pointer-events-none whitespace-nowrap z-10 border border-gray-700">
                    ${day.amount.toLocaleString("es-CL")}
                  </div>
                  
                  {/* Barra */}
                  <div 
                    className={`w-full rounded-t-sm transition-all duration-500 ${day.amount > 0 ? 'bg-emerald-500/60 group-hover:bg-emerald-400' : 'bg-gray-700/30'}`}
                    style={{ height: `${height}%` }}
                  ></div>
                  
                  {/* Etiqueta Día */}
                  <span className="text-[8px] text-gray-500 rotate-45 origin-left whitespace-nowrap overflow-visible">
                    {day.date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMNA DERECHA: ALERTAS Y FEED */}
        <div className="space-y-6">
          
          {/* PANEL DE ALERTAS */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              Alertas del Sistema
            </h3>
            
            <div className="space-y-3">
              {alerts.agentsInDebt > 0 ? (
                <div className="bg-amber-900/20 border border-amber-800/50 p-3 rounded-lg flex items-start gap-3">
                  <div className="bg-amber-900/50 p-1.5 rounded text-amber-500 mt-0.5"><Users size={14} /></div>
                  <div>
                    <p className="text-xs font-bold text-amber-400">Deudas a Agentes</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Tienes <span className="text-white font-bold">{alerts.agentsInDebt}</span> agente(s) con saldos sin liquidar. Total pendiente: <span className="text-amber-400 font-mono font-bold">${alerts.totalDebt.toLocaleString("es-CL")}</span>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900/50 border border-gray-700 p-3 rounded-lg flex items-center gap-3">
                  <div className="text-emerald-500"><CheckCircle2 size={16} /></div>
                  <p className="text-xs text-gray-400">Las comisiones de todos los agentes están al día.</p>
                </div>
              )}

              <div className="bg-gray-900/50 border border-gray-700 p-3 rounded-lg flex items-start gap-3">
                 <div className="bg-gray-800 p-1.5 rounded text-emerald-500 mt-0.5"><DollarSign size={14} /></div>
                 <div>
                    <p className="text-xs font-bold text-gray-300">Promociones Activas</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Revisa la pestaña de "Promos Jugadores" regularmente para liquidar bonos y revisar topes.</p>
                 </div>
              </div>
            </div>
          </div>

          {/* ÚLTIMOS MOVIMIENTOS */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={16} className="text-blue-400" />
              Actividad Reciente
            </h3>
            
            <div className="space-y-3">
              {recentFeed.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No hay movimientos recientes.</p>
              ) : (
                recentFeed.map((tx, i) => {
                  const isIngreso = tx.type === "Ingreso" || tx.type === "Send Chips";
                  return (
                    <div key={i} className="flex justify-between items-center border-b border-gray-700/50 last:border-0 pb-2 last:pb-0">
                      <div>
                        <p className="text-xs font-bold text-gray-300">
                          {tx.acc_players?.nickname || "Sistema"}
                        </p>
                        <p className="text-[9px] text-gray-500">
                          {tx.category} {tx.is_manual ? '(Manual)' : '(CSV)'}
                        </p>
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
    </div>
  );
}