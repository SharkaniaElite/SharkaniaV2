// src/pages/lap-backing.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { Search, Settings, ArrowUpRight, Target, PiggyBank, Smartphone, Ticket } from "lucide-react";

export function LapBackingPage() {
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modales
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [loadingMoney, setLoadingMoney] = useState<any>(null);
  const [updatingBalance, setUpdatingBalance] = useState<any>(null);

  // Estados Formulario Deal
  const [cpPct, setCpPct] = useState("50");
  const [clPct, setClPct] = useState("50");
  const [tpPct, setTpPct] = useState("50");
  const [tlPct, setTlPct] = useState("0");
  const [tMakeup, setTMakeup] = useState(false);
  const [tTickets, setTTickets] = useState("0");

  // Estados Formulario Movimiento
  const [loadAmount, setLoadAmount] = useState("");
  const [loadType, setLoadType] = useState("Carga");
  
  // Estado Formulario Saldo App
  const [appBalanceInput, setAppBalanceInput] = useState("");

  const loadBackingData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: players } = await supabase.from("acc_players").select("*");
      const { data: deals } = await supabase.from("acc_backing_deals").select("*");
      const { data: tPlayers } = await supabase.from("players").select("id, nickname");
      
      const { data: txs } = await supabase.from("acc_transactions").select("*").eq("category", "Bancaje");

      const { data: tourneys } = await supabase
        .from("tournaments")
        .select("id, created_at, buy_in")
        .in("club_id", [
          "ccb5c5bc-efaf-4710-b9c5-b4e2baa17328", 
          "1da03414-0ed2-416e-b4f4-bd94caabd5c7"
        ])
        .not("league_id", "is", null);

      const tourneyIds = tourneys?.map((t: any) => t.id) || [];
      let tResults: any[] = [];
      if (tourneyIds.length > 0) {
        const { data: resData } = await supabase
          .from("tournament_results")
          .select("tournament_id, player_id, buy_ins_count, prize_won, bounties_won")
          .in("tournament_id", tourneyIds);
        tResults = resData || [];
      }

      if (!players) return;

      const calculated = players.map(p => {
        const deal = deals?.find(d => d.clubgg_id === p.clubgg_id) || null;
        
        // 1. Calcular Capital en Efectivo (Cargas)
        const pTxs = txs?.filter(t => t.clubgg_id === p.clubgg_id) || [];
        const totalCargado = pTxs.filter(t => t.type === "Carga").reduce((s, t) => s + Number(t.amount), 0);
        const totalRetirado = pTxs.filter(t => t.type === "Retiro").reduce((s, t) => s + Number(t.amount), 0);
        const cashCapital = totalCargado - totalRetirado;

        // 2. Calcular Torneos (MTT) y Valor de Tickets
        let tourneyProfit = 0;
        let tourneyBuyins = 0;
        let tourneyWinnings = 0;
        const ticketsCount = deal?.league_tickets ? Number(deal.league_tickets) : 0;
        const ticketsValue = ticketsCount * 22000; // 🔥 El ticket es Inversión/Capital

        const totalInvestment = cashCapital + ticketsValue; // Efectivo + Tickets

        const tPlayer = tPlayers?.find((tp: any) => tp.nickname.toLowerCase() === p.nickname.toLowerCase());
        if (tPlayer && tResults) {
          const pResults = tResults.filter(r => r.player_id === tPlayer.id);
          pResults.forEach(r => {
            const tourney = tourneys?.find(t => t.id === r.tournament_id);
            const tourneyCost = tourney?.buy_in ? Number(tourney.buy_in) : 22000; 
            
            const buyins = (Number(r.buy_ins_count) || 0) * tourneyCost; 
            const winnings = (Number(r.prize_won) || 0) + (Number(r.bounties_won) || 0);
            tourneyBuyins += buyins;
            tourneyWinnings += winnings;
          });
          
          tourneyProfit = tourneyWinnings - tourneyBuyins;
        }

        // 3. Calcular Cash Games (Magia Inversa)
        const appBalance = deal?.current_balance ? Number(deal.current_balance) : 0;
        
        // ¿Cuánto cash salió realmente de la caja para pagar torneos? (Costo total menos lo cubierto por tickets)
        const cashSpentOnMTT = Math.max(0, tourneyBuyins - ticketsValue);
        const netCashChangeFromMTT = tourneyWinnings - cashSpentOnMTT;
        
        const expectedCashBeforeCashGames = cashCapital + netCashChangeFromMTT;
        const cashProfit = appBalance - expectedCashBeforeCashGames;

        // 4. Distribuir las Ganancias/Pérdidas (P/L) según el Deal
        let playerTourneyNet = 0;
        let adminTourneyNet = 0;
        let playerCashNet = 0;
        let adminCashNet = 0;

        if (deal) {
          // --- DEAL TORNEOS ---
          if (tourneyProfit > 0) {
            playerTourneyNet = tourneyProfit * (Number(deal.tourney_profit_pct) / 100);
          } else {
            playerTourneyNet = tourneyProfit * (Number(deal.tourney_loss_pct) / 100);
            if (!deal.has_makeup) playerTourneyNet = 0;
          }
          adminTourneyNet = tourneyProfit - playerTourneyNet;

          // --- DEAL CASH ---
          if (cashProfit > 0) {
            playerCashNet = cashProfit * (Number(deal.cash_profit_pct) / 100);
          } else {
            playerCashNet = cashProfit * (Number(deal.cash_loss_pct) / 100);
          }
          adminCashNet = cashProfit - playerCashNet;
        }

        const playerTotalNet = playerTourneyNet + playerCashNet;
        const adminTotalNet = adminTourneyNet + adminCashNet;

        return {
          ...p,
          deal,
          cashCapital,
          ticketsValue,
          totalInvestment,
          appBalance,
          ticketsCount,
          tourneyProfit,
          cashProfit,
          playerTotalNet,
          adminTotalNet
        };
      });

      const sorted = calculated.sort((a, b) => b.totalInvestment - a.totalInvestment);
      setReport(sorted);

    } catch (err: any) {
      alert("Error cargando bancajes: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackingData();
  }, [loadBackingData]);

  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        clubgg_id: editingDeal.clubgg_id,
        cash_profit_pct: Number(cpPct),
        cash_loss_pct: Number(clPct),
        tourney_profit_pct: Number(tpPct),
        tourney_loss_pct: Number(tlPct),
        has_makeup: tMakeup,
        league_tickets: Number(tTickets) 
      };
      const { error } = await supabase.from("acc_backing_deals").upsert(payload);
      if (error) throw error;
      setEditingDeal(null);
      loadBackingData();
    } catch (err: any) {
      alert("Error guardando deal: " + err.message);
    }
  };

  const handleLoadMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(loadAmount);
    if (isNaN(amt) || amt <= 0) return alert("Monto inválido");

    try {
      const { error } = await supabase.from("acc_transactions").insert({
        clubgg_id: loadingMoney.clubgg_id,
        amount: amt,
        category: "Bancaje",
        type: loadType,
        date: new Date().toISOString(),
        is_manual: true,
        balance_after: 0,
        reconciled: false,
        amount_paid: 0
      });
      if (error) throw error;
      setLoadingMoney(null);
      setLoadAmount("");
      loadBackingData();
    } catch (err: any) {
      alert("Error registrando transacción: " + err.message);
    }
  };

  const handleUpdateAppBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(appBalanceInput);
    if (isNaN(balance)) return alert("Monto inválido");

    try {
      if (updatingBalance.deal) {
        const { error } = await supabase.from("acc_backing_deals").update({ current_balance: balance }).eq("clubgg_id", updatingBalance.clubgg_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("acc_backing_deals").insert({ clubgg_id: updatingBalance.clubgg_id, current_balance: balance });
        if (error) throw error;
      }
      
      setUpdatingBalance(null);
      setAppBalanceInput("");
      loadBackingData();
    } catch (err: any) {
      alert("Error actualizando saldo de la app: " + err.message);
    }
  };

  const openDeal = (p: any) => {
    setEditingDeal(p);
    setCpPct(p.deal?.cash_profit_pct?.toString() || "50");
    setClPct(p.deal?.cash_loss_pct?.toString() || "50");
    setTpPct(p.deal?.tourney_profit_pct?.toString() || "50");
    setTlPct(p.deal?.tourney_loss_pct?.toString() || "0");
    setTMakeup(p.deal?.has_makeup || false);
    setTTickets(p.deal?.league_tickets?.toString() || "0"); 
  };

  const filteredReport = report.filter(p => {
    const matchSearch = p.nickname.toLowerCase().includes(search.toLowerCase());
    if (search) return matchSearch;
    return p.deal || p.totalInvestment > 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sk-2xl font-black text-sk-text-1 mb-1">Control de Bancajes</h2>
          <p className="text-sk-sm text-sk-text-3">Gestiona el capital entregado a jugadores y acuerdos de riesgo.</p>
        </div>
        <div className="flex items-center gap-2 bg-sk-bg-2 border border-sk-border-2 rounded p-2">
          <Search size={16} className="text-sk-text-3" />
          <input 
            type="text" 
            placeholder="Buscar jugador para bancar..." 
            className="bg-transparent border-none outline-none text-sk-text-1 text-sm w-56"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Spinner size="md" /></div>
      ) : (
        <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-sk-bg-3 font-mono text-[10px] font-semibold tracking-wider uppercase text-sk-text-2 border-b border-sk-border-2">
                <th className="py-3 px-4">Jugador</th>
                <th className="py-3 px-4 text-center">Deal</th>
                <th className="py-3 px-4 text-right text-blue-400">Capital (Inversión)</th>
                <th className="py-3 px-4 text-right text-emerald-400">Saldo App</th>
                <th className="py-3 px-4 text-center border-l border-sk-border-2">P/L Global (MTT vs Cash)</th>
                <th className="py-3 px-4 text-right border-l border-sk-border-2">Neto Jugador</th>
                <th className="py-3 px-4 text-right">Neto Backer</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sk-border-2 font-medium text-sk-sm">
              {filteredReport.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sk-text-4 text-sm">
                    No hay jugadores bancados. Busca un jugador arriba para agregarlo.
                  </td>
                </tr>
              ) : (
                filteredReport.map((p: any) => (
                  <tr key={p.clubgg_id} className="hover:bg-sk-bg-3/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-sk-text-1">{p.nickname}</td>
                    <td className="py-3 px-4 text-center">
                      {p.deal ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Cash: {p.deal.cash_profit_pct}%/{p.deal.cash_loss_pct}%
                          </span>
                          <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 flex items-center gap-1">
                            MTT: {p.deal.tourney_profit_pct}%/{p.deal.tourney_loss_pct}% 
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-sk-text-4 italic">Sin Configurar</span>
                      )}
                    </td>
                    
                    {/* 🔥 CAPITAL MOSTRANDO EFECTIVO + TICKETS */}
                    <td className="py-3 px-4 text-right font-mono text-blue-400">
                      <div className="font-bold">${p.totalInvestment.toLocaleString("es-CL")}</div>
                      {p.ticketsValue > 0 && (
                        <div className="text-[9px] text-sk-text-4 tracking-tight mt-0.5">
                          Cash: ${p.cashCapital.toLocaleString()} | Tkt: ${p.ticketsValue.toLocaleString()}
                        </div>
                      )}
                    </td>
                    
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 bg-emerald-500/5 group">
                      <div className="flex items-center justify-end gap-2">
                        <span>${p.appBalance.toLocaleString("es-CL")}</span>
                        <button onClick={() => {
                           setUpdatingBalance(p);
                           setAppBalanceInput(p.appBalance.toString());
                        }} className="text-sk-text-4 hover:text-emerald-400 transition-colors">
                          <Smartphone size={14} />
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center font-mono border-l border-sk-border-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-[10px] ${p.tourneyProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          MTT: {p.tourneyProfit >= 0 ? "+" : ""}${p.tourneyProfit.toLocaleString("es-CL")}
                        </span>
                        <span className={`text-[10px] ${p.cashProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          Cash: {p.cashProfit >= 0 ? "+" : ""}${p.cashProfit.toLocaleString("es-CL")}
                        </span>
                      </div>
                    </td>

                    <td className={`py-3 px-4 text-right font-mono font-black border-l border-sk-border-2 ${p.playerTotalNet >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {p.playerTotalNet >= 0 ? "+" : ""}${p.playerTotalNet.toLocaleString("es-CL")}
                    </td>
                    
                    <td className={`py-3 px-4 text-right font-mono font-black bg-sk-bg-0 ${p.adminTotalNet >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {p.adminTotalNet >= 0 ? "+" : ""}${p.adminTotalNet.toLocaleString("es-CL")}
                    </td>
                    
                    <td className="py-3 px-4 text-center space-x-1">
                      <Button variant="secondary" size="sm" className="px-2" onClick={() => openDeal(p)}>
                        <Settings size={14} />
                      </Button>
                      <Button variant="accent" size="sm" className="px-2" onClick={() => setLoadingMoney(p)}>
                        <PiggyBank size={14} /> Cargar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Configurar Deal */}
      {editingDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 w-full max-w-lg shadow-sk-lg">
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-4">Deal de Bancaje: {editingDeal.nickname}</h3>
            <form onSubmit={handleSaveDeal} className="space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-sk-border-2 rounded-lg bg-sk-bg-0">
                  <h4 className="text-xs font-bold text-emerald-400 mb-3 flex items-center gap-1"><ArrowUpRight size={14}/> CASH GAMES</h4>
                  <label className="text-[10px] uppercase text-sk-text-3 mb-1 block">Ganancia (Jugador %)</label>
                  <input type="number" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 mb-3" value={cpPct} onChange={e => setCpPct(e.target.value)} />
                  <label className="text-[10px] uppercase text-sk-text-3 mb-1 block">Pérdida (Jugador asume %)</label>
                  <input type="number" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={clPct} onChange={e => setClPct(e.target.value)} />
                </div>

                <div className="p-4 border border-sk-border-2 rounded-lg bg-sk-bg-0 relative">
                  <h4 className="text-xs font-bold text-indigo-400 mb-3 flex items-center gap-1"><Target size={14}/> TORNEOS (MTT)</h4>
                  <label className="text-[10px] uppercase text-sk-text-3 mb-1 block">Ganancia (Jugador %)</label>
                  <input type="number" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 mb-3" value={tpPct} onChange={e => setTpPct(e.target.value)} />
                  <label className="text-[10px] uppercase text-sk-text-3 mb-1 block">Pérdida (Jugador asume %)</label>
                  <input type="number" className="w-full bg-sk-bg-2 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 mb-3" value={tlPct} onChange={e => setTlPct(e.target.value)} />
                  
                  <div className="mt-4 pt-4 border-t border-sk-border-2">
                    <label className="text-[10px] uppercase text-indigo-400 font-bold mb-1 flex items-center gap-1"><Ticket size={12}/> Tickets Usados</label>
                    <input type="number" className="w-full bg-sk-bg-2 border border-indigo-500/50 rounded p-2 text-sk-sm text-indigo-400 font-bold mb-3" value={tTickets} onChange={e => setTTickets(e.target.value)} />
                  </div>

                  <label className="flex items-center gap-2 text-[10px] uppercase text-sk-text-3 cursor-pointer">
                    <input type="checkbox" checked={tMakeup} onChange={e => setTMakeup(e.target.checked)} className="accent-indigo-500 w-4 h-4" />
                    Aplicar Memoria (Makeup)
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setEditingDeal(null)}>Cancelar</Button>
                <Button variant="accent" type="submit" className="flex-1">Guardar Acuerdo</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cargas de Dinero */}
      {loadingMoney && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 w-full max-w-sm shadow-sk-lg">
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-2">Movimiento de Capital</h3>
            <p className="text-sk-sm text-sk-text-3 mb-4">Jugador: <span className="font-bold text-white">{loadingMoney.nickname}</span></p>
            <form onSubmit={handleLoadMoney} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Tipo de Movimiento</label>
                <select className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={loadType} onChange={e => setLoadType(e.target.value)}>
                  <option value="Carga">Cargar Capital (Entregar Dinero)</option>
                  <option value="Retiro">Retirar Capital (Cobrar Ganancia)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Monto en CLP</label>
                <input type="number" required className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1" value={loadAmount} onChange={e => setLoadAmount(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setLoadingMoney(null)}>Cancelar</Button>
                <Button variant="accent" type="submit" className="flex-1">Registrar Movimiento</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Saldo de Fichas App */}
      {updatingBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 w-full max-w-sm shadow-sk-lg">
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-2 flex items-center gap-2">
              <Smartphone size={20} className="text-emerald-400" /> Saldo en ClubGG
            </h3>
            <p className="text-sk-sm text-sk-text-3 mb-4">
              Ingresa la cantidad de fichas exactas que <span className="font-bold text-white">{updatingBalance.nickname}</span> tiene actualmente en su cuenta.
            </p>
            <form onSubmit={handleUpdateAppBalance} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Fichas Actuales</label>
                <input type="number" required className="w-full bg-sk-bg-0 border border-emerald-500/50 rounded p-3 font-mono text-lg text-emerald-400 focus:border-emerald-400 focus:outline-none" value={appBalanceInput} onChange={e => setAppBalanceInput(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setUpdatingBalance(null)}>Cancelar</Button>
                <Button variant="accent" type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white">Actualizar Caja</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}