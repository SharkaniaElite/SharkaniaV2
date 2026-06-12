// src/pages/lap-promotions.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase"; 
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { Settings, Wallet, Search, ToggleLeft, ToggleRight, History, Undo2, Filter, Calendar as CalendarIcon } from "lucide-react"; 

const SYSTEM_START_DATE = "2026-06-08T00:00:00Z"; // Ampliado para atrapar todos los torneos

export function LapPromotionsPage() {
  const [report, setReport] = useState<any[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]); 
  const [agentsList, setAgentsList] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState("ALL"); 
  
  // Selector de Fechas
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Modales
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [payingPlayer, setPayingPlayer] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");

  // Estados del form de config
  const [cfgWActive, setCfgWActive] = useState(false);
  const [cfgPct, setCfgPct] = useState("30");
  const [cfgWMax, setCfgWMax] = useState(""); 
  const [cfgWStart, setCfgWStart] = useState("");
  const [cfgWEnd, setCfgWEnd] = useState("");

  const loadPromotionsData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dbAgents } = await supabase.from("acc_agents").select("*").order("name");
      if (dbAgents) setAgentsList(dbAgents);

      const { data: accPlayers } = await supabase.from("acc_players").select("*");
      const { data: configs } = await supabase.from("acc_player_promo_config").select("*");
      const { data: payouts } = await supabase.from("acc_player_promo_payouts").select("*");
      
      const { data: transactions } = await supabase
        .from("acc_transactions")
        .select("*")
        .eq("category", "Rakeback")
        .in("type", ["Ingreso", "ingreso"])
        .gte("date", SYSTEM_START_DATE)
        .limit(100000);
      
      // 🔥 FIX 1: Quitamos el filtro estricto de club_id. Cualquier torneo de liga cuenta.
      const { data: tourneys, error: errTourneys } = await supabase
        .from("tournaments")
        .select("id, created_at, start_datetime")
        .not("league_id", "is", null)
        .gte("created_at", SYSTEM_START_DATE);
      
      if (errTourneys) throw new Error("Error obteniendo torneos: " + errTourneys.message);

      const tourneyIds = tourneys?.map((t: any) => t.id) || [];
      
      let tResults: any[] = [];
      if (tourneyIds.length > 0) {
        // 🔥 FIX 2: Aumentamos el límite para que ningún jugador se quede fuera
        const { data: resData } = await supabase
          .from("tournament_results")
          .select("tournament_id, player_id, buy_ins_count")
          .in("tournament_id", tourneyIds)
          .limit(100000);
        tResults = resData || [];
      }

      const { data: tPlayers } = await supabase.from("players").select("id, nickname").limit(100000);

      if (!accPlayers) return;

      const calculatedData = accPlayers.map((player: any) => {
        const defaultCfg = {
          welcome_percentage: 30,
          welcome_max_amount: 100000,
          welcome_active: true
        };

        const databaseCfg = configs?.find((c: any) => c.clubgg_id === player.clubgg_id);
        const cfg = databaseCfg || defaultCfg;

        const isWelcomeActive = cfg.welcome_active ?? true; 

        // 🔥 FIX 3: Trim() para evitar que espacios en blanco rompan el cruce de jugadores
        const matchingTPlayers = tPlayers?.filter((tp: any) => tp.nickname.toLowerCase().trim() === player.nickname.toLowerCase().trim()) || [];
        const matchingPlayerIds = matchingTPlayers.map((tp: any) => tp.id);

        let ligaBuyinsHist = 0;
        let ligaBuyinsPer = 0;

        if (matchingPlayerIds.length > 0 && tResults && tourneys) {
          const playerResults = tResults.filter((r: any) => matchingPlayerIds.includes(r.player_id));
          playerResults.forEach((res: any) => {
            const tourney = tourneys.find((t: any) => t.id === res.tournament_id);
            if (tourney) {
              // Preferimos start_datetime si existe
              const targetDate = tourney.start_datetime || tourney.created_at;
              const tDateStr = new Date(targetDate).toISOString().slice(0, 10);
              
              // 🔥 FIX 4: Si no hay dato de recompra, asumimos 1 (la entrada inicial)
              let rawBuyins = Number(res.buy_ins_count);
              if (isNaN(rawBuyins) || rawBuyins <= 0) rawBuyins = 1;
              const buyins = rawBuyins;
              
              ligaBuyinsHist += buyins;
              if (tDateStr >= startDate && tDateStr <= endDate) {
                ligaBuyinsPer += buyins;
              }
            }
          });
        }
        
        let rakeGeneralPer = 0;
        let rakeGeneralHist = 0;

        if (transactions) {
          const pTrans = transactions.filter((t: any) => t.clubgg_id === player.clubgg_id);
          pTrans.forEach((t: any) => {
            const tDateStr = new Date(t.date).toISOString().slice(0, 10);
            const validStart = !cfg.welcome_start_date || tDateStr >= cfg.welcome_start_date.slice(0, 10);
            const validEnd = !cfg.welcome_expiry || tDateStr <= cfg.welcome_expiry.slice(0, 10);

            if (validStart && validEnd) {
              rakeGeneralHist += Number(t.amount);
              if (tDateStr >= startDate && tDateStr <= endDate) rakeGeneralPer += Number(t.amount);
            }
          });
        }

        const topeBienvenida = Number(cfg.welcome_max_amount) || 100000; 

        // 🔥 CÁLCULO PERIODO (Deduciendo el pozo de la unión: $5.000 x buyin)
        const costoLigaPer = ligaBuyinsPer * 5000;
        const rakeBaseBonoPer = Math.max(0, rakeGeneralPer - costoLigaPer); 
        const bonoBienvenidaBrutoPer = isWelcomeActive ? (rakeBaseBonoPer * (Number(cfg.welcome_percentage) / 100)) : 0;
        let bonoBienvenidaPer = bonoBienvenidaBrutoPer;
        let isCappedPer = false;
        if (topeBienvenida > 0 && bonoBienvenidaBrutoPer > topeBienvenida) {
          bonoBienvenidaPer = topeBienvenida; 
          isCappedPer = true; 
        }

        // 🔥 CÁLCULO HISTÓRICO
        const costoLigaHist = ligaBuyinsHist * 5000;
        const rakeBaseBonoHist = Math.max(0, rakeGeneralHist - costoLigaHist); 
        const bonoBienvenidaBrutoHist = isWelcomeActive ? (rakeBaseBonoHist * (Number(cfg.welcome_percentage) / 100)) : 0;
        let bonoBienvenidaHist = bonoBienvenidaBrutoHist;
        if (topeBienvenida > 0 && bonoBienvenidaBrutoHist > topeBienvenida) {
          bonoBienvenidaHist = topeBienvenida; 
        }
        
        const totalGeneradoPeriodo = bonoBienvenidaPer; 
        const totalGeneradoHist = bonoBienvenidaHist;
        
        const pPayouts = payouts?.filter((p: any) => p.clubgg_id === player.clubgg_id) || [];
        const totalPagado = pPayouts.reduce((sum: number, p: any) => sum + Number(p.total_paid), 0);
        
        const saldoPendiente = totalGeneradoHist - totalPagado;

        return {
          ...player,
          cfg: {
            ...cfg,
            welcome_active: isWelcomeActive
          },
          rakeBaseBono: rakeBaseBonoPer,
          bonoBienvenidaBruto: bonoBienvenidaBrutoPer, 
          bonoBienvenida: bonoBienvenidaPer,
          isCapped: isCappedPer, 
          totalGeneradoPeriodo, 
          totalPagado,
          saldoPendiente 
        };
      });

      const history = payouts?.map((p: any) => {
        const ply = accPlayers.find((ap: any) => ap.clubgg_id === p.clubgg_id);
        return {
          ...p,
          nickname: ply?.nickname || p.clubgg_id
        };
      }).sort((a: any, b: any) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()) || [];
      
      setPayoutHistory(history);

      const sorted = calculatedData.sort((a: any, b: any) => b.saldoPendiente - a.saldoPendiente);
      setReport(sorted);
    } catch (err: any) {
      alert("Error cargando promociones: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]); 

  useEffect(() => {
    loadPromotionsData();
  }, [loadPromotionsData]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        clubgg_id: editingConfig.clubgg_id,
        welcome_percentage: Number(cfgPct),
        welcome_max_amount: cfgWMax ? Number(cfgWMax) : null, 
        welcome_start_date: cfgWStart || null,
        welcome_expiry: cfgWEnd || null,
        welcome_active: cfgWActive
      };

      const { error } = await supabase.from("acc_player_promo_config").upsert(payload);
      if (error) throw error;
      
      setEditingConfig(null);
      loadPromotionsData();
    } catch (err: any) {
      alert("Error al guardar configuración: " + err.message);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) return alert("Monto inválido");
    
    const maxAllowed = Math.max(payingPlayer.saldoPendiente, payingPlayer.totalGeneradoPeriodo);
    if (amt > maxAllowed) return alert("El pago supera la deuda histórica y lo generado en el periodo.");

    try {
      const { error } = await supabase.from("acc_player_promo_payouts").insert({
        clubgg_id: payingPlayer.clubgg_id,
        total_paid: amt,
        date: new Date().toISOString()
      });
      if (error) throw error;

      setPayingPlayer(null);
      setPayAmount("");
      loadPromotionsData();
    } catch (err: any) {
      alert("Error al procesar pago: " + err.message);
    }
  };

  const handleRevertPayout = async (id: number) => {
    if (!window.confirm("⚠️ ¿Seguro que quieres reversar este pago? Se eliminará el registro y la deuda volverá a aparecer en el saldo del jugador.")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from("acc_player_promo_payouts").delete().eq("id", id);
      if (error) throw error;
      
      loadPromotionsData(); 
    } catch (err: any) {
      alert("Error al reversar la operación: " + err.message);
      setLoading(false);
    }
  };

  const openConfig = (p: any) => {
    setEditingConfig(p);
    setCfgWActive(p.cfg.welcome_active);
    setCfgPct(p.cfg.welcome_percentage?.toString() || "30");
    setCfgWMax(p.cfg.welcome_max_amount?.toString() || ""); 
    setCfgWStart(p.cfg.welcome_start_date?.split("T")[0] || "");
    setCfgWEnd(p.cfg.welcome_expiry?.split("T")[0] || "");
  };

  const filteredReport = report.filter((p: any) => {
    const matchesSearch = p.nickname.toLowerCase().includes(search.toLowerCase()) || 
                          p.clubgg_id.toLowerCase().includes(search.toLowerCase());
                          
    const matchesAgent = filterAgent === "ALL" || String(p.agent_id) === String(filterAgent);
    
    return matchesSearch && matchesAgent;
  });

  const totalRakeBasePer = filteredReport.reduce((acc, p) => acc + p.rakeBaseBono, 0);
  const totalGeneradoPer = filteredReport.reduce((acc, p) => acc + p.totalGeneradoPeriodo, 0);
  const totalDeudaHist = filteredReport.reduce((acc, p) => acc + p.saldoPendiente, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-sk-2xl font-black text-sk-text-1 mb-1">Promociones Jugadores</h2>
          <p className="text-sk-sm text-sk-text-3">Balance del periodo. El Saldo Pendiente es la deuda real histórica.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-sk-bg-2 p-2 rounded-lg border border-sk-border-2 text-sk-sm h-full">
          <CalendarIcon size={16} className="text-sk-text-3" />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-sk-text-1 outline-none cursor-pointer" />
          <span className="text-sk-text-4">~</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-sk-text-1 outline-none cursor-pointer" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-2xl">
        <div className="flex flex-1 items-center bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm">
          <Search size={16} className="text-sk-text-3 mr-2" />
          <input 
            type="text" 
            placeholder="Filtrar por nickname o ID..." 
            className="bg-transparent border-none outline-none text-sk-text-1 w-full"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex flex-1 items-center bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm">
          <Filter size={16} className="text-sk-text-3 mr-2" />
          <select 
            value={filterAgent} 
            onChange={e => setFilterAgent(e.target.value)}
            className="bg-transparent border-none outline-none text-sk-text-1 w-full cursor-pointer appearance-none"
          >
            <option value="ALL">Todos los Agentes</option>
            {agentsList.map(ag => (
              <option key={ag.id} value={ag.id} className="bg-sk-bg-2 text-sk-text-1">
                {ag.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-sk-bg-3 font-mono text-[10px] font-semibold tracking-wider uppercase text-sk-text-2 border-b border-sk-border-2">
                <th className="py-3 px-4">Jugador</th>
                <th className="py-3 px-4 text-center">Estado Promos</th>
                <th className="py-3 px-4 text-right">Rake Base (Sujeto a Bono)</th>
                <th className="py-3 px-4 text-right text-pink-400">Total Periodo (Bono)</th>
                <th className="py-3 px-4 text-right text-amber-400">Deuda Histórica</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
              
              <tr className="bg-sk-bg-0 border-b-2 border-sk-border-2 font-mono text-[11px] font-bold text-sk-text-1 uppercase tracking-wider">
                <th className="py-2.5 px-4" colSpan={2}>TOTALES (Filtrados)</th>
                <th className="py-2.5 px-4 text-right text-sk-text-3">${totalRakeBasePer.toLocaleString("es-CL")}</th>
                <th className="py-2.5 px-4 text-right text-pink-400">${totalGeneradoPer.toLocaleString("es-CL")}</th>
                <th className="py-2.5 px-4 text-right text-amber-400">${totalDeudaHist.toLocaleString("es-CL")}</th>
                <th className="py-2.5 px-4"></th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-sk-border-2 font-medium text-sk-sm">
              {filteredReport.map((p: any) => (
                <tr key={p.clubgg_id} className="hover:bg-sk-bg-3/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-sk-text-1">{p.nickname}</div>
                  </td>
                  <td className="py-3 px-4 text-center space-x-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.cfg.welcome_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-500/10 text-gray-500'}`}>
                      Bienvenida
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-sk-text-3 font-mono">${p.rakeBaseBono.toLocaleString("es-CL")}</td>
                  
                  <td className="py-3 px-4 text-right text-pink-400 font-mono font-bold bg-pink-500/5">
                    <div className="flex flex-col items-end">
                      <span className={`${p.isCapped ? "text-amber-400 font-bold" : "text-pink-400"}`}>
                        {p.cfg.welcome_max_amount ? (
                          `$${Math.floor(p.bonoBienvenidaBruto).toLocaleString("es-CL")} / $${Number(p.cfg.welcome_max_amount).toLocaleString("es-CL")}`
                        ) : (
                          `$${p.totalGeneradoPeriodo.toLocaleString("es-CL")}`
                        )}
                      </span>
                      
                      {p.cfg.welcome_active && (
                        <div className="text-[9px] text-pink-500/70 font-normal mt-0.5 tracking-tight flex flex-col items-end">
                          <span>({p.cfg.welcome_percentage}%)</span>
                          {p.isCapped && (
                            <span className="text-amber-400 font-bold bg-amber-500/10 px-1 rounded text-[8px] mt-0.5 animate-pulse">
                              ¡MÁXIMO ALCANZADO!
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right text-amber-400 font-mono font-bold bg-amber-500/5">${p.saldoPendiente.toLocaleString("es-CL")}</td>
                  <td className="py-3 px-4 text-center space-x-2 whitespace-nowrap">
                    <Button variant="secondary" size="sm" className="px-2" onClick={() => openConfig(p)}>
                      <Settings size={14} />
                    </Button>
                    <Button variant="accent" size="sm" className="px-2" onClick={() => setPayingPlayer(p)} disabled={p.totalGeneradoPeriodo <= 0 && p.saldoPendiente <= 0}>
                      <Wallet size={14} className="mr-1.5" /> Pagar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 w-full max-w-lg shadow-sk-lg">
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-4">Configurar Promociones: {editingConfig.nickname}</h3>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              
              <div className={`p-4 rounded-lg border transition-colors ${cfgWActive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-sk-bg-0 border-sk-border-2'}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Bono de Bienvenida</h4>
                  <button type="button" onClick={() => setCfgWActive(!cfgWActive)} className="text-sk-text-1 focus:outline-none">
                    {cfgWActive ? <ToggleRight size={28} className="text-emerald-400" /> : <ToggleLeft size={28} className="text-sk-text-4" />}
                  </button>
                </div>
                
                {cfgWActive && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 flex justify-between">
                        <span>% Devolución</span>
                      </label>
                      <input type="number" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={cfgPct} onChange={e => setCfgPct(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 flex justify-between">
                        <span>Tope Máximo ($)</span>
                        <span className="text-sk-text-4">Opcional</span>
                      </label>
                      <input type="number" placeholder="Sin límite" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={cfgWMax} onChange={e => setCfgWMax(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Desde</label>
                      <input type="date" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={cfgWStart} onChange={e => setCfgWStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Hasta (Límite)</label>
                      <input type="date" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={cfgWEnd} onChange={e => setCfgWEnd(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="secondary" className="flex-1" onClick={() => setEditingConfig(null)}>Cancelar</Button>
                <Button variant="accent" type="submit" className="flex-1">Guardar Reglas</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 w-full max-w-sm shadow-sk-lg">
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-2">Pagar a {payingPlayer.nickname}</h3>
            
            <div className="bg-sk-bg-0 p-3 rounded-lg border border-sk-border-2 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] text-sk-text-3 uppercase tracking-wider">Generado en Periodo:</span>
                <span className="text-pink-400 font-bold font-mono">${payingPlayer.totalGeneradoPeriodo.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-sk-text-3 uppercase tracking-wider">Deuda Histórica Total:</span>
                <span className="text-amber-400 font-bold font-mono">${payingPlayer.saldoPendiente.toLocaleString("es-CL")}</span>
              </div>
              
              <div className="flex gap-2 mt-3 pt-3 border-t border-sk-border-2">
                <Button type="button" variant="secondary" size="sm" className="flex-1 text-[10px] py-1 h-auto" onClick={() => setPayAmount(payingPlayer.totalGeneradoPeriodo.toString())}>
                  Monto Periodo
                </Button>
                <Button type="button" variant="secondary" size="sm" className="flex-1 text-[10px] py-1 h-auto" onClick={() => setPayAmount(payingPlayer.saldoPendiente.toString())}>
                  Monto Histórico
                </Button>
              </div>
            </div>

            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Monto a Liquidar</label>
                <input 
                  type="number" 
                  max={Math.max(payingPlayer.saldoPendiente, payingPlayer.totalGeneradoPeriodo)} 
                  required 
                  className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" 
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)} 
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setPayingPlayer(null)}>Cancelar</Button>
                <Button variant="accent" type="submit" className="flex-1">Registrar Pago</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!loading && (
        <div className="pt-8">
          <h3 className="text-sk-lg font-black text-sk-text-1 mb-4 flex items-center gap-2">
            <History size={20} className="text-sk-purple" />
            Historial de Pagos Recientes
          </h3>
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-sk-bg-3 font-mono text-[10px] font-semibold tracking-wider uppercase text-sk-text-2 border-b border-sk-border-2">
                  <th className="py-3 px-4">Fecha de Pago</th>
                  <th className="py-3 px-4">Jugador</th>
                  <th className="py-3 px-4 text-right">Monto Liquidado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sk-border-2 font-medium text-sk-sm">
                {payoutHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sk-text-4 text-xs">
                      No hay pagos de promociones registrados aún.
                    </td>
                  </tr>
                ) : (
                  payoutHistory.map((h: any) => (
                    <tr key={h.id} className="hover:bg-sk-bg-3/50 transition-colors">
                      <td className="py-3 px-4 text-sk-text-3 font-mono text-xs">
                        {new Date(h.date || h.created_at).toLocaleString("es-CL")}
                      </td>
                      <td className="py-3 px-4 font-bold text-sk-text-1">{h.nickname}</td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-mono font-bold">
                        ${Number(h.total_paid).toLocaleString("es-CL")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => handleRevertPayout(h.id)} 
                          className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 text-xs px-2 py-1 h-auto"
                        >
                          <Undo2 size={14} className="mr-1.5" /> Reversar
                        </Button>
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