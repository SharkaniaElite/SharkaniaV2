// src/pages/lap-dashboard.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";
import { 
  TrendingUp, Landmark, Users, DollarSign, 
  CheckCircle2, Clock, Gift, Calendar as CalendarIcon,
  Target, PieChart
} from "lucide-react";

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
    deduccionLiga: 0,
    corteRed: 0,
    netoRepartir: 0,
    totalUnion: 0,
    agentesNeto: 0,
    promosJugadores: 0,
    utilidadClub: 0,
    activePlayers: 0
  });

  const [recentFeed, setRecentFeed] = useState<any[]>([]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Límite de 100.000 agregado a TODAS las tablas para evitar el corte por defecto de Supabase
      const { data: allTxs } = await supabase.from("acc_transactions")
        .select("id, amount, date, category, type, clubgg_id, is_manual, acc_players(nickname)")
        .eq("category", "Rakeback")
        .in("type", ["Ingreso", "ingreso"])
        .gte("date", `${startDate}T00:00:00Z`)
        .lte("date", `${endDate}T23:59:59Z`)
        .limit(100000);
        
      const { data: players } = await supabase.from("acc_players").select("*").limit(100000);
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
        // Al pedir solo los torneos filtrados, no chocamos con el límite de 1000 filas en los resultados
        const { data: resData } = await supabase.from("tournament_results")
          .select("tournament_id, player_id, buy_ins_count")
          .in("tournament_id", tourneyIds)
          .limit(100000);
        tResults = resData || [];
      }
      
      const { data: tPlayers } = await supabase.from("players").select("id, nickname").limit(100000);

      if (allTxs && players) {
        
        let gRakeBruto = 0;
        let gDeduccionLiga = 0;
        let gCorteRed = 0;
        let gNetoRepartir = 0;
        
        let gPromosJugadores = 0;
        let gAgentesNeto = 0;
        let gUtilidadClub = 0;
        
        const activePlayersSet = new Set();

        players.forEach(player => {
          // 1. Configuración de Promoción del Jugador
          const defaultCfg = { welcome_active: false };
          const cfg = configs?.find(c => c.clubgg_id === player.clubgg_id) || defaultCfg;
          const isWelcomeActive = cfg.welcome_active ?? false;
          
          // Se evalúa si el bono es válido comparando la fecha de fin del filtro con la caducidad del bono
          const isPromoValid = isWelcomeActive && (!cfg.welcome_expiry || endDate <= cfg.welcome_expiry.slice(0, 10));

          // 2. Cálculo de Buy-ins de Liga en el periodo
          const matchingTPlayers = tPlayers?.filter(tp => tp.nickname.toLowerCase().trim() === player.nickname.toLowerCase().trim()) || [];
          const matchingPlayerIds = matchingTPlayers.map(tp => tp.id);

          let pBuyinsPer = 0;
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
                  pBuyinsPer += rawBuyins;
                }
              }
            });
          }

          // 3. Cálculo del Rake Base en el periodo
          let pRakeGenPer = 0;
          const playerTxs = allTxs.filter(t => t.clubgg_id === player.clubgg_id);
          
          playerTxs.forEach(t => {
            pRakeGenPer += Number(t.amount);
            activePlayersSet.add(player.clubgg_id); 
          });

          // == MATEMÁTICA EN CASCADA LINEAL ==
          // Paso 1: Deducción de Liga ($5000 por buy-in)
          const pDeduccionLiga = pBuyinsPer * 5000;
          
          // Paso 2: Rake Remanente post-liga
          const pRakePostLiga = Math.max(0, pRakeGenPer - pDeduccionLiga);
          
          // Paso 3: Corte de Red (20%) calculado sobre el remanente
          const pCorteRed = pRakePostLiga * 0.20;
          
          // Paso 4: Rake Neto a Repartir
          const pNetoRepartir = pRakePostLiga - pCorteRed;

          // Paso 5: Distribución Fija (Con o Sin Bono)
          let pPromo = 0;
          let pAgentCut = 0;
          let pClubCut = 0;

          if (isPromoValid) {
            // Repartición 30% Jugador / 35% Agente / 35% Club
            pPromo = pNetoRepartir * 0.30;
            pAgentCut = pNetoRepartir * 0.35;
            pClubCut = pNetoRepartir * 0.35;
          } else {
            // Repartición 50% Agente / 50% Club
            pPromo = 0;
            pAgentCut = pNetoRepartir * 0.50;
            pClubCut = pNetoRepartir * 0.50;
          }

          // Sumatoria de totales globales
          gRakeBruto += pRakeGenPer;
          gDeduccionLiga += pDeduccionLiga;
          gCorteRed += pCorteRed;
          gNetoRepartir += pNetoRepartir;
          gPromosJugadores += pPromo;
          gAgentesNeto += pAgentCut;
          gUtilidadClub += pClubCut;
        });

        const gTotalUnion = gDeduccionLiga + gCorteRed;

        setMetrics({
          rakeBruto: gRakeBruto,
          deduccionLiga: gDeduccionLiga,
          corteRed: gCorteRed,
          netoRepartir: gNetoRepartir,
          totalUnion: gTotalUnion,
          agentesNeto: gAgentesNeto,
          promosJugadores: gPromosJugadores,
          utilidadClub: gUtilidadClub,
          activePlayers: activePlayersSet.size
        });
      }

      // Feed de actividad reciente (Solo para vista rápida)
      const { data: recent } = await supabase.from("acc_transactions")
        .select("id, amount, date, category, type, is_manual, acc_players(nickname)")
        .order("date", { ascending: false })
        .limit(6);
        
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

  if (loading && metrics.rakeBruto === 0) return <div className="py-20 flex justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10 animate-in fade-in duration-300">
      
      {/* Cabecera y Filtros */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-2xl font-black text-white">Dashboard Financiero</h2>
          <p className="text-sm text-gray-400">Lectura exacta y distribución del Rake en el periodo seleccionado.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="text-[11px] sm:text-xs text-emerald-500 bg-emerald-900/30 px-3 py-2 rounded-lg border border-emerald-800 flex items-center gap-2 font-bold">
            <CheckCircle2 size={14} /> Sistema Sincronizado
          </div>
          
          <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700 text-sm text-white h-full shadow-inner">
            <CalendarIcon size={16} className="text-indigo-400" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none cursor-pointer text-gray-300" />
            <span className="text-gray-600">~</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none cursor-pointer text-gray-300" />
          </div>
        </div>
      </div>

      {/* BLOQUE 1: CÁLCULO BASE (CASCADA) */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-400"/> Cascada de Cálculo (Periodo)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">1. Rake Bruto Total</p>
            <h3 className="text-2xl font-black text-white font-mono">${metrics.rakeBruto.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-gray-500 mt-2">{metrics.activePlayers} jugadores generaron rake</p>
          </div>

          <div className="bg-orange-900/10 border border-orange-800/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <p className="text-[11px] text-orange-400/80 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Target size={12}/> 2. Pozo Liga (Unión)</p>
            <h3 className="text-2xl font-black text-orange-400 font-mono">-${metrics.deduccionLiga.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-orange-500/60 mt-2">$5.000 x Entrada Registrada</p>
          </div>

          <div className="bg-red-900/10 border border-red-800/30 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <p className="text-[11px] text-red-400/80 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><PieChart size={12}/> 3. Corte Red (Unión)</p>
            <h3 className="text-2xl font-black text-red-400 font-mono">-${metrics.corteRed.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-red-500/60 mt-2">20% del remanente post-liga</p>
          </div>

          <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden ring-1 ring-blue-500/30">
            <p className="text-[11px] text-blue-300 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Landmark size={12}/> 4. Neto a Repartir</p>
            <h3 className="text-2xl font-black text-blue-400 font-mono">${metrics.netoRepartir.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-blue-500/70 mt-2">Fondo para Club, Agentes y Jugadores</p>
          </div>

        </div>
      </div>

      {/* BLOQUE 2: DISTRIBUCIÓN FINAL */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
          <DollarSign size={16} className="text-emerald-400"/> Distribución Final
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          
          <div className="bg-indigo-900/20 border border-indigo-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-indigo-400"><Landmark size={64} /></div>
            <p className="text-[11px] text-indigo-300 font-bold uppercase tracking-wider mb-1">Total Unión CCP</p>
            <h3 className="text-2xl font-black text-indigo-400 font-mono">${metrics.totalUnion.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-indigo-500/70 mt-2">Pozo Liga + Corte 20%</p>
          </div>

          <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-400"><Users size={64} /></div>
            <p className="text-[11px] text-amber-300/80 font-bold uppercase tracking-wider mb-1">Total Agentes</p>
            <h3 className="text-2xl font-black text-amber-400 font-mono">${metrics.agentesNeto.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-amber-500/50 mt-2">50% regular o 35% con promo</p>
          </div>

          <div className="bg-pink-900/20 border border-pink-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-pink-400"><Gift size={64} /></div>
            <p className="text-[11px] text-pink-300 font-bold uppercase tracking-wider mb-1">Bonos Jugadores</p>
            <h3 className="text-2xl font-black text-pink-400 font-mono">${metrics.promosJugadores.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-pink-500/60 mt-2">30% del neto (promos activas)</p>
          </div>

          <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden ring-1 ring-emerald-500/30">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-400"><DollarSign size={64} /></div>
            <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Utilidad Club LatinAllin</p>
            <h3 className="text-2xl font-black text-emerald-400 font-mono">${metrics.utilidadClub.toLocaleString("es-CL")}</h3>
            <p className="text-[10px] text-emerald-500/60 mt-2">50% regular o 35% con promo</p>
          </div>

        </div>
      </div>

      {/* BLOQUE 3: ACTIVIDAD RECIENTE */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            Actividad Reciente en el Sistema
          </h3>
          <div className="space-y-3">
            {recentFeed.length === 0 ? (
              <p className="text-xs text-gray-500 py-4">No hay movimientos recientes.</p>
            ) : (
              recentFeed.map((tx: any, i: number) => {
                const isIngreso = tx.type === "Ingreso" || tx.type === "Send Chips";
                return (
                  <div key={i} className="flex justify-between items-center border-b border-gray-700/50 last:border-0 pb-2 last:pb-0">
                    <div>
                      <p className="text-xs font-bold text-gray-300">{tx.acc_players?.nickname || "Sistema"}</p>
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider">{tx.category} {tx.is_manual ? '(Manual)' : '(CSV)'}</p>
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