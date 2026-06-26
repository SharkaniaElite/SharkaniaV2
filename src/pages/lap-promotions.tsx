// src/pages/lap-promotions.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase"; 
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { Settings, Search, ToggleLeft, ToggleRight, Filter, Calendar as CalendarIcon, Target, PieChart, Landmark, Gift } from "lucide-react"; 

export function LapPromotionsPage() {
  const [report, setReport] = useState<any[]>([]);
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

  // Modal Configuración
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [cfgWActive, setCfgWActive] = useState(false);
  const [cfgWStart, setCfgWStart] = useState("");
  const [cfgWEnd, setCfgWEnd] = useState("");

  const loadPromotionsData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dbAgents } = await supabase.from("acc_agents").select("*").order("name");
      if (dbAgents) setAgentsList(dbAgents);

      const { data: accPlayers } = await supabase.from("acc_players").select("*").limit(100000);
      const { data: configs } = await supabase.from("acc_player_promo_config").select("*").limit(100000);
      
      const { data: transactions } = await supabase
        .from("acc_transactions")
        .select("amount, date, clubgg_id")
        .eq("category", "Rakeback")
        .in("type", ["Ingreso", "ingreso"])
        .gte("date", `${startDate}T00:00:00Z`)
        .lte("date", `${endDate}T23:59:59Z`)
        .limit(100000);
      
      const { data: tourneys } = await supabase
        .from("tournaments")
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
        const defaultCfg = { welcome_active: false, welcome_start_date: null, welcome_expiry: null };
        const cfg = configs?.find((c: any) => c.clubgg_id === player.clubgg_id) || defaultCfg;
        const isWelcomeActive = cfg.welcome_active ?? false; 
        
        // Validación de fecha para el bono
        const isPromoValid = isWelcomeActive && (!cfg.welcome_expiry || endDate <= cfg.welcome_expiry.slice(0, 10));

        const matchingTPlayers = tPlayers?.filter((tp: any) => tp.nickname.toLowerCase().trim() === player.nickname.toLowerCase().trim()) || [];
        const matchingPlayerIds = matchingTPlayers.map((tp: any) => tp.id);

        let ligaBuyinsPer = 0;

        if (matchingPlayerIds.length > 0 && tResults && tourneys) {
          const playerResults = tResults.filter((r: any) => matchingPlayerIds.includes(r.player_id));
          playerResults.forEach((res: any) => {
            const tourney = tourneys.find((t: any) => t.id === res.tournament_id);
            if (tourney) {
              const targetDate = tourney.start_datetime || tourney.created_at;
              // Forzamos la lectura en hora de Santiago de Chile para que los torneos de las 21:00 NO salten al día siguiente
const tDateStr = new Date(targetDate).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
              
              let rawBuyins = Number(res.buy_ins_count);
              if (isNaN(rawBuyins) || rawBuyins <= 0) rawBuyins = 1;
              
              if (tDateStr >= startDate && tDateStr <= endDate) {
                ligaBuyinsPer += rawBuyins;
              }
            }
          });
        }
        
        let rakeGeneralPer = 0;
        if (transactions) {
          const pTrans = transactions.filter((t: any) => t.clubgg_id === player.clubgg_id);
          pTrans.forEach((t: any) => {
             rakeGeneralPer += Number(t.amount);
          });
        }

        // === MATEMÁTICA EN CASCADA ===
        const costoLigaPer = ligaBuyinsPer * 5000;
        const rakePostLiga = Math.max(0, rakeGeneralPer - costoLigaPer); 
        const corteRedPer = rakePostLiga * 0.20;
        const netoRepartir = rakePostLiga - corteRedPer;
        
        // Bono Fijo 30% del Neto si aplica
        const bonoBienvenidaPer = isPromoValid ? (netoRepartir * 0.30) : 0;

        return {
          ...player,
          cfg: {
            ...cfg,
            welcome_active: isWelcomeActive,
            isValid: isPromoValid
          },
          rakeBruto: rakeGeneralPer,
          deduccionLiga: costoLigaPer,
          corteRed: corteRedPer,
          netoRepartir: netoRepartir,
          bonoFinal: bonoBienvenidaPer
        };
      });

      // Ordenar por quienes generaron más bono
      const sorted = calculatedData.sort((a: any, b: any) => b.bonoFinal - a.bonoFinal);
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
        welcome_active: cfgWActive,
        welcome_start_date: cfgWStart || null,
        welcome_expiry: cfgWEnd || null,
        // Limpiamos los campos antiguos depreciados para evitar basura en DB
        welcome_percentage: 30,
        welcome_max_amount: null
      };

      const { error } = await supabase.from("acc_player_promo_config").upsert(payload);
      if (error) throw error;
      
      setEditingConfig(null);
      loadPromotionsData();
    } catch (err: any) {
      alert("Error al guardar configuración: " + err.message);
    }
  };

  const openConfig = (p: any) => {
    setEditingConfig(p);
    setCfgWActive(p.cfg.welcome_active);
    setCfgWStart(p.cfg.welcome_start_date?.split("T")[0] || "");
    setCfgWEnd(p.cfg.welcome_expiry?.split("T")[0] || "");
  };

  const filteredReport = report.filter((p: any) => {
    const matchesSearch = p.nickname.toLowerCase().includes(search.toLowerCase()) || 
                          p.clubgg_id.toLowerCase().includes(search.toLowerCase());
                          
    const matchesAgent = filterAgent === "ALL" || String(p.agent_id) === String(filterAgent);
    
    // Ocultar inactivos del periodo si no coinciden con la búsqueda
    if (!search && p.rakeBruto === 0) return false;
    
    return matchesSearch && matchesAgent;
  });

  const totalRakeBruto = filteredReport.reduce((acc, p) => acc + p.rakeBruto, 0);
  const totalDeduccionLiga = filteredReport.reduce((acc, p) => acc + p.deduccionLiga, 0);
  const totalCorteRed = filteredReport.reduce((acc, p) => acc + p.corteRed, 0);
  const totalNetoRepartir = filteredReport.reduce((acc, p) => acc + p.netoRepartir, 0);
  const totalBonoGenerado = filteredReport.reduce((acc, p) => acc + p.bonoFinal, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-sk-2xl font-black text-sk-text-1 mb-1">Promociones Jugadores</h2>
          <p className="text-sk-sm text-sk-text-3">Visualiza el 30% del Rake Neto aplicable a los jugadores con promociones válidas.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-sk-bg-2 p-2 rounded-lg border border-sk-border-2 text-sk-sm h-full shadow-inner">
          <CalendarIcon size={16} className="text-pink-400" />
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
        <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden overflow-x-auto shadow-xl">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-sk-bg-3 font-mono text-[10px] font-semibold tracking-wider uppercase text-sk-text-2 border-b border-sk-border-2">
                <th className="py-3 px-4">Jugador</th>
                <th className="py-3 px-4 text-center">Estado Promo</th>
                <th className="py-3 px-4 text-right">Rake Bruto</th>
                <th className="py-3 px-4 text-right"><span className="flex justify-end items-center gap-1"><Target size={12}/> Liga CCP</span></th>
                <th className="py-3 px-4 text-right"><span className="flex justify-end items-center gap-1"><PieChart size={12}/> Red 20%</span></th>
                <th className="py-3 px-4 text-right text-blue-400"><span className="flex justify-end items-center gap-1"><Landmark size={12}/> Neto Base</span></th>
                <th className="py-3 px-4 text-right text-pink-400"><span className="flex justify-end items-center gap-1"><Gift size={12}/> Bono (30%)</span></th>
                <th className="py-3 px-4 text-center">Configurar</th>
              </tr>
              
              <tr className="bg-sk-bg-0 border-b-2 border-sk-border-2 font-mono text-[11px] font-bold text-sk-text-1 uppercase tracking-wider">
                <th className="py-2.5 px-4" colSpan={2}>TOTALES (Filtrados)</th>
                <th className="py-2.5 px-4 text-right text-sk-text-3">${totalRakeBruto.toLocaleString("es-CL")}</th>
                <th className="py-2.5 px-4 text-right text-orange-400/60">-${totalDeduccionLiga.toLocaleString("es-CL")}</th>
                <th className="py-2.5 px-4 text-right text-red-400/60">-${totalCorteRed.toLocaleString("es-CL")}</th>
                <th className="py-2.5 px-4 text-right text-blue-400">${totalNetoRepartir.toLocaleString("es-CL")}</th>
                <th className="py-2.5 px-4 text-right text-pink-400">${totalBonoGenerado.toLocaleString("es-CL")}</th>
                <th className="py-2.5 px-4"></th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-sk-border-2 font-medium text-sk-sm">
              {filteredReport.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sk-text-4 text-sm">
                    No hay jugadores activos en el periodo seleccionado o la búsqueda no arrojó resultados.
                  </td>
                </tr>
              ) : (
                filteredReport.map((p: any) => (
                  <tr key={p.clubgg_id} className="hover:bg-sk-bg-3/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-sk-text-1">{p.nickname}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.cfg.isValid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-500/10 text-gray-500 border border-gray-600/30'}`}>
                        {p.cfg.isValid ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-sk-text-3 font-mono">${p.rakeBruto.toLocaleString("es-CL")}</td>
                    <td className="py-3 px-4 text-right text-orange-400/60 font-mono">-${p.deduccionLiga.toLocaleString("es-CL")}</td>
                    <td className="py-3 px-4 text-right text-red-400/60 font-mono">-${p.corteRed.toLocaleString("es-CL")}</td>
                    <td className="py-3 px-4 text-right text-blue-400 font-mono font-bold">${p.netoRepartir.toLocaleString("es-CL")}</td>
                    
                    <td className="py-3 px-4 text-right font-mono font-black bg-pink-500/5">
                      <span className={p.bonoFinal > 0 ? "text-pink-400" : "text-sk-text-4"}>
                        ${p.bonoFinal.toLocaleString("es-CL")}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <Button variant="secondary" size="sm" className="px-2" onClick={() => openConfig(p)}>
                        <Settings size={14} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Configuración Reducido */}
      {editingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 w-full max-w-sm shadow-sk-lg">
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-4">Configurar Promoción: {editingConfig.nickname}</h3>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              
              <div className={`p-4 rounded-lg border transition-colors ${cfgWActive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-sk-bg-0 border-sk-border-2'}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Bono 30% Fijo</h4>
                  <button type="button" onClick={() => setCfgWActive(!cfgWActive)} className="text-sk-text-1 focus:outline-none">
                    {cfgWActive ? <ToggleRight size={28} className="text-emerald-400" /> : <ToggleLeft size={28} className="text-sk-text-4" />}
                  </button>
                </div>
                
                {cfgWActive && (
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Vigente Desde</label>
                      <input type="date" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={cfgWStart} onChange={e => setCfgWStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Hasta (Caducidad)</label>
                      <input type="date" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={cfgWEnd} onChange={e => setCfgWEnd(e.target.value)} />
                    </div>
                    <p className="text-[10px] text-sk-text-4 italic mt-1 leading-tight">
                      Al estar activo y vigente, el sistema calculará el 30% del rake neto de este jugador para el bono.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="secondary" className="flex-1" onClick={() => setEditingConfig(null)}>Cancelar</Button>
                <Button variant="accent" type="submit" className="flex-1">Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}