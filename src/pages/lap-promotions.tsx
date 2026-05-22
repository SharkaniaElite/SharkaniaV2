// src/pages/lap-promotions.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase"; 
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { Settings, Wallet, Search, ToggleLeft, ToggleRight } from "lucide-react"; 

export function LapPromotionsPage() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modales
  const [editingConfig, setEditingConfig] = useState<any>(null);
  const [payingPlayer, setPayingPlayer] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");

  // Estados del form de config
  const [cfgWActive, setCfgWActive] = useState(false);
  const [cfgLActive, setCfgLActive] = useState(true); // 🔥 Inicializado en true por defecto
  const [cfgPct, setCfgPct] = useState("30");
  const [cfgWMax, setCfgWMax] = useState(""); 
  const [cfgWStart, setCfgWStart] = useState("");
  const [cfgWEnd, setCfgWEnd] = useState("");
  const [cfgLStart, setCfgLStart] = useState("");
  const [cfgLEnd, setCfgLEnd] = useState("");

  const loadPromotionsData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: accPlayers } = await supabase.from("acc_players").select("*");
      const { data: configs } = await supabase.from("acc_player_promo_config").select("*");
      const { data: payouts } = await supabase.from("acc_player_promo_payouts").select("*");
      
      const { data: transactions } = await supabase
        .from("acc_transactions")
        .select("*")
        .eq("category", "Rakeback")
        .in("type", ["Ingreso", "ingreso"])
        .limit(10000);
      
      const { data: tourneys, error: errTourneys } = await supabase
        .from("tournaments")
        .select("id, created_at")
        .in("club_id", [
          "ccb5c5bc-efaf-4710-b9c5-b4e2baa17328", 
          "1da03414-0ed2-416e-b4f4-bd94caabd5c7"  
        ])
        .not("league_id", "is", null);
      
      if (errTourneys) throw new Error("Error obteniendo torneos: " + errTourneys.message);

      const tourneyIds = tourneys?.map((t: any) => t.id) || [];
      
      let tResults: any[] = [];
      if (tourneyIds.length > 0) {
        const { data: resData } = await supabase
          .from("tournament_results")
          .select("tournament_id, player_id, buy_ins_count")
          .in("tournament_id", tourneyIds)
          .limit(10000);
        tResults = resData || [];
      }

      const { data: tPlayers } = await supabase.from("players").select("id, nickname").limit(10000);

      if (!accPlayers) return;

      const calculatedData = accPlayers.map((player: any) => {
        // Encontrar configuración o crear valores base
        const databaseCfg = configs?.find((c: any) => c.clubgg_id === player.clubgg_id);
        
        const cfg = databaseCfg || {
          welcome_percentage: 30,
          welcome_max_amount: null, 
          welcome_start_date: null, welcome_expiry: null,
          liga_start_date: null, liga_expiry: null,
          welcome_active: false,
          liga_active: true // 🔥 LIGA ACTIVA POR DEFECTO SI NO EXISTE REGISTRO
        };

        // Si el registro existe pero la columna liga_active viene null, asegurar que sea true
        const isLigaActive = cfg.liga_active ?? true;
        const isWelcomeActive = cfg.welcome_active ?? false;

        const tPlayer = tPlayers?.find((tp: any) => tp.nickname.toLowerCase() === player.nickname.toLowerCase());

        // A. CÁLCULO DE LIGA CCP
        let ligaBuyIns = 0;
        if (tPlayer && tResults && tourneys) {
          const playerResults = tResults.filter((r: any) => r.player_id === tPlayer.id);
          playerResults.forEach((res: any) => {
            const tourney = tourneys.find((t: any) => t.id === res.tournament_id);
            if (tourney && tourney.created_at) {
              const tDate = new Date(tourney.created_at);
              const validStart = !cfg.liga_start_date || tDate >= new Date(cfg.liga_start_date);
              
              let validEnd = true;
              if (cfg.liga_expiry) {
                const expDate = new Date(cfg.liga_expiry);
                expDate.setHours(23, 59, 59, 999);
                validEnd = tDate <= expDate;
              }

              if (validStart && validEnd) {
                ligaBuyIns += (Number(res.buy_ins_count) || 0);
              }
            }
          });
        }
        
        const bonoLigaBase = ligaBuyIns * 2000;
        const bonoLiga = isLigaActive ? bonoLigaBase : 0; // 🔥 Aplica según el estado por defecto o manual

        // B. CÁLCULO DE RAKE GENERAL
        let rakeGeneral = 0;
        if (transactions) {
          const pTrans = transactions.filter((t: any) => t.clubgg_id === player.clubgg_id);
          pTrans.forEach((t: any) => {
            const tDate = new Date(t.date);
            const validStart = !cfg.welcome_start_date || tDate >= new Date(cfg.welcome_start_date);
            
            let validEnd = true;
            if (cfg.welcome_expiry) {
              const expDate = new Date(cfg.welcome_expiry);
              expDate.setHours(23, 59, 59, 999);
              validEnd = tDate <= expDate;
            }

            if (validStart && validEnd) {
              rakeGeneral += Number(t.amount);
            }
          });
        }

        // C. MATEMÁTICA INDEPENDIENTE CON TOPE MÁXIMO
        const rakeOtrosJuegos = Math.max(0, rakeGeneral - bonoLigaBase);
        const bonoBienvenidaBruto = isWelcomeActive ? (rakeOtrosJuegos * (Number(cfg.welcome_percentage) / 100)) : 0;
        
        const topeBienvenida = Number(cfg.welcome_max_amount) || 0;
        let bonoBienvenida = bonoBienvenidaBruto;
        let isCapped = false;

        if (topeBienvenida > 0 && bonoBienvenidaBruto > topeBienvenida) {
          bonoBienvenida = topeBienvenida; 
          isCapped = true; 
        }
        
        const totalGenerado = bonoLiga + bonoBienvenida;
        
        const pPayouts = payouts?.filter((p: any) => p.clubgg_id === player.clubgg_id) || [];
        const totalPagado = pPayouts.reduce((sum: number, p: any) => sum + Number(p.total_paid), 0);
        const saldoPendiente = totalGenerado - totalPagado;

        return {
          ...player,
          cfg: {
            ...cfg,
            liga_active: isLigaActive,
            welcome_active: isWelcomeActive
          },
          rakeGeneral,
          bonoLiga,
          rakeOtrosJuegos,
          bonoBienvenidaBruto, 
          bonoBienvenida,
          isCapped, 
          totalGenerado,
          totalPagado,
          saldoPendiente
        };
      });

      const sorted = calculatedData.sort((a: any, b: any) => b.saldoPendiente - a.saldoPendiente);
      setReport(sorted);
    } catch (err: any) {
      alert("Error cargando promociones: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
        liga_start_date: cfgLStart || null,
        liga_expiry: cfgLEnd || null,
        welcome_active: cfgWActive,
        liga_active: cfgLActive
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
    if (amt > payingPlayer.saldoPendiente) return alert("El pago supera el saldo pendiente.");

    try {
      const { error } = await supabase.from("acc_player_promo_payouts").insert({
        clubgg_id: payingPlayer.clubgg_id,
        total_paid: amt
      });
      if (error) throw error;

      setPayingPlayer(null);
      setPayAmount("");
      loadPromotionsData();
    } catch (err: any) {
      alert("Error al procesar pago: " + err.message);
    }
  };

  const openConfig = (p: any) => {
    setEditingConfig(p);
    setCfgWActive(p.cfg.welcome_active);
    setCfgLActive(p.cfg.liga_active); // 🔥 Respeta la regla por defecto o guardada
    setCfgPct(p.cfg.welcome_percentage?.toString() || "30");
    setCfgWMax(p.cfg.welcome_max_amount?.toString() || ""); 
    setCfgWStart(p.cfg.welcome_start_date?.split("T")[0] || "");
    setCfgWEnd(p.cfg.welcome_expiry?.split("T")[0] || "");
    setCfgLStart(p.cfg.liga_start_date?.split("T")[0] || "");
    setCfgLEnd(p.cfg.liga_expiry?.split("T")[0] || "");
  };

  const filteredReport = report.filter((p: any) => {
    return p.nickname.toLowerCase().includes(search.toLowerCase()) || 
           p.clubgg_id.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-sk-2xl font-black text-sk-text-1 mb-1">Promociones Jugadores</h2>
          <p className="text-sk-sm text-sk-text-3">Listado completo de jugadores del club y promociones de juego.</p>
        </div>
        <div className="flex items-center gap-2 bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm">
          <Search size={16} className="text-sk-text-3" />
          <input 
            type="text" 
            placeholder="Filtrar por nickname o ID..." 
            className="bg-transparent border-none outline-none text-sk-text-1"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-sk-bg-3 font-mono text-[10px] font-semibold tracking-wider uppercase text-sk-text-2 border-b border-sk-border-2">
                <th className="py-3 px-4">Jugador</th>
                <th className="py-3 px-4 text-center">Estado Promos</th>
                <th className="py-3 px-4 text-right">Bono Liga CCP<br/><span className="text-[9px] text-sk-text-4 font-normal">(Buy-ins × $2.000)</span></th>
                <th className="py-3 px-4 text-right">Rake Otros J.</th>
                <th className="py-3 px-4 text-right">Bono Bienvenida</th>
                <th className="py-3 px-4 text-right text-amber-400">Saldo Pendiente</th>
                <th className="py-3 px-4 text-center">Acciones</th>
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
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.cfg.liga_active ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-gray-500/10 text-gray-500'}`}>
                      Liga CCP
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-sk-text-2 font-mono">${p.bonoLiga.toLocaleString("es-CL")}</td>
                  <td className="py-3 px-4 text-right text-sk-text-3 font-mono">${p.rakeOtrosJuegos.toLocaleString("es-CL")}</td>
                  
                  <td className="py-3 px-4 text-right text-sk-text-2 font-mono">
                    <div className="flex flex-col items-end">
                      <span className={`${p.isCapped ? "text-amber-400 font-bold" : "text-sk-text-1"}`}>
                        {p.cfg.welcome_max_amount ? (
                          `$${Math.floor(p.bonoBienvenidaBruto).toLocaleString("es-CL")} / $${Number(p.cfg.welcome_max_amount).toLocaleString("es-CL")}`
                        ) : (
                          `$${p.bonoBienvenida.toLocaleString("es-CL")}`
                        )}
                      </span>
                      
                      {p.cfg.welcome_active && (
                        <div className="text-[9px] text-sk-text-4 font-normal mt-0.5 tracking-tight flex flex-col items-end">
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
                  <td className="py-3 px-4 text-center space-x-2">
                    <Button variant="secondary" size="sm" className="px-2" onClick={() => openConfig(p)}>
                      <Settings size={14} />
                    </Button>
                    <Button variant="accent" size="sm" className="px-2" onClick={() => setPayingPlayer(p)} disabled={p.saldoPendiente <= 0}>
                      <Wallet size={14} /> Pagar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Configuración */}
      {editingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 w-full max-w-lg shadow-sk-lg">
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-4">Configurar Promociones: {editingConfig.nickname}</h3>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              
              {/* BLOQUE BIENVENIDA */}
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

              {/* BLOQUE LIGA */}
              <div className={`p-4 rounded-lg border transition-colors ${cfgLActive ? 'bg-blue-500/5 border-blue-500/20' : 'bg-sk-bg-0 border-sk-border-2'}`}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Liga CCP ($2.000 x Buyin)</h4>
                  <button type="button" onClick={() => setCfgLActive(!cfgLActive)} className="text-sk-text-1 focus:outline-none">
                    {cfgLActive ? <ToggleRight size={28} className="text-blue-400" /> : <ToggleLeft size={28} className="text-sk-text-4" />}
                  </button>
                </div>
                
                {cfgLActive && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Desde (Fecha 6)</label>
                      <input type="date" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={cfgLStart} onChange={e => setCfgLStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Hasta (Límite)</label>
                      <input type="date" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={cfgLEnd} onChange={e => setCfgLEnd(e.target.value)} />
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

      {/* Modal de Pago */}
      {payingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 w-full max-w-sm shadow-sk-lg">
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-2">Pagar a {payingPlayer.nickname}</h3>
            <p className="text-sk-sm text-amber-400 mb-4">Deuda Actual: ${payingPlayer.saldoPendiente.toLocaleString("es-CL")}</p>
            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Monto a Liquidar</label>
                <input type="number" max={payingPlayer.saldoPendiente} required className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setPayingPlayer(null)}>Cancelar</Button>
                <Button variant="accent" type="submit" className="flex-1">Registrar Pago</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}