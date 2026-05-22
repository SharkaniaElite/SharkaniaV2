// src/pages/lap-transactions.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, Search, Calendar, Plus, Edit2, Clock } from "lucide-react";

export function LapTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mPlayer, setMPlayer] = useState("");
  const [mType, setMType] = useState("Send Chips");
  const [mCategory, setMCategory] = useState("Depósito");
  const [mAmount, setMAmount] = useState("");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("acc_transactions")
        .select(`id, date, type, amount, amount_paid, balance_after, reconciled, clubgg_id, category, is_manual, acc_players (nickname)`)
        .gte("date", `${startDate}T00:00:00Z`)
        .lte("date", `${endDate}T23:59:59Z`)
        // 🔥 ESTA ES LA LÍNEA MÁGICA: Solo trae movimientos manuales de caja
        .in("type", ["Send Chips", "Receive Chips"]) 
        .order("date", { ascending: false });

      if (filterType !== "all") query = query.eq("type", filterType);

      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data || []);

      const { data: pData } = await supabase.from("acc_players").select("clubgg_id, nickname").order("nickname");
      setPlayers(pData || []);
    } catch (err: any) {
      console.error("Error cargando caja:", err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterType]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mPlayer || !mAmount) return;

    try {
      const { error } = await supabase.from("acc_transactions").insert([{
        date: new Date().toISOString(),
        clubgg_id: mPlayer,
        type: mType,
        category: mCategory,
        amount: Number(mAmount),
        balance_after: 0, 
        is_manual: true,
        reconciled: false,
        amount_paid: 0
      }]);
      if (error) throw error;
      
      setIsModalOpen(false);
      setMAmount("");
      fetchTransactions();
    } catch (err: any) {
      alert("Error al guardar: " + err.message);
    }
  };

  const handlePayment = async (t: any) => {
    const total = Number(t.amount);
    const currentPaid = Number(t.amount_paid);
    
    if (t.reconciled) {
      await updatePaymentDb(t.id, 0, false);
      return;
    }

    const input = window.prompt(`El monto total es $${total.toLocaleString("es-CL")}.\nIngresa el monto que se ha pagado hasta ahora:`, currentPaid.toString());
    
    if (input === null) return; 
    const num = Number(input.replace(/\./g, '').replace(/,/g, '')); 
    
    if (isNaN(num) || num < 0) return alert("Monto inválido");

    const isReconciled = num >= total;
    await updatePaymentDb(t.id, num, isReconciled);
  };

  const updatePaymentDb = async (id: number, amountPaid: number, isReconciled: boolean) => {
    try {
      const { error } = await supabase.from("acc_transactions").update({ amount_paid: amountPaid, reconciled: isReconciled }).eq("id", id);
      if (error) throw error;
      
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, amount_paid: amountPaid, reconciled: isReconciled } : t));
    } catch (err: any) {
      alert("Error al actualizar pago: " + err.message);
    }
  };

  // 🔥 NUEVO: Actualizar categoría directamente desde la tabla
  const updateCategoryDb = async (id: number, newCategory: string) => {
    try {
      const { error } = await supabase.from("acc_transactions").update({ category: newCategory }).eq("id", id);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, category: newCategory } : t));
    } catch (err: any) {
      alert("Error al actualizar categoría: " + err.message);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const nick = t.acc_players?.nickname?.toLowerCase() || "";
    const id = t.clubgg_id?.toLowerCase() || "";
    return nick.includes(search.toLowerCase()) || id.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-sk-2xl font-black text-sk-text-1 mb-1">Caja Chica de Fichas</h2>
          <p className="text-sk-sm text-sk-text-3">Historial de cargas, retiros, ingresos manuales y pagos parciales.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="accent" onClick={fetchTransactions} size="sm">Refrescar</Button>
          <Button variant="accent" onClick={() => setIsModalOpen(true)} size="sm">
            <Plus size={16} className="mr-1" /> Movimiento Manual
          </Button>
        </div>
      </div>

      {/* RESTAURADO: BARRA DE FILTROS */}
      <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 flex items-center gap-1">
            <Search size={12} /> Buscar Jugador
          </label>
          <input
            type="text"
            placeholder="Nick o ID ClubGG..."
            className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 focus:border-sk-accent focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 flex items-center gap-1">
            <Calendar size={12} /> Desde
          </label>
          <input
            type="date"
            className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 font-mono focus:border-sk-accent focus:outline-none"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 flex items-center gap-1">
            <Calendar size={12} /> Hasta
          </label>
          <input
            type="date"
            className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 font-mono focus:border-sk-accent focus:outline-none"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Tipo de Movimiento</label>
          <select
            className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 focus:border-sk-accent focus:outline-none cursor-pointer"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Todos los movimientos</option>
            <option value="Send Chips">Envíos (Cargas)</option>
            <option value="Receive Chips">Retiros (Cobros)</option>
          </select>
        </div>
      </div>

      {/* MODAL INGRESO MANUAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 w-full max-w-md shadow-sk-lg">
            <h3 className="text-sk-lg font-black text-sk-text-1 mb-4">Ingresar Movimiento Manual</h3>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Jugador</label>
                <select required className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 focus:border-sk-accent" value={mPlayer} onChange={e => setMPlayer(e.target.value)}>
  <option value="">Selecciona un jugador...</option>
  {players.map(p => <option key={p.clubgg_id} value={p.clubgg_id}>{p.nickname}</option>)}
</select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Tipo</label>
                  <select 
                    className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 focus:border-sk-accent cursor-pointer" 
                    value={mType} 
                    onChange={e => {
                      const nuevoTipo = e.target.value;
                      setMType(nuevoTipo);
                      // 🔥 Lógica de Auto-Selección:
                      if (nuevoTipo === "Receive Chips") {
                        setMCategory("Retiro");
                      } else {
                        setMCategory("Depósito");
                      }
                    }}
                  >
                    <option value="Send Chips">Carga a Jugador</option>
                    <option value="Receive Chips">Retiro de Jugador</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Categoría</label>
                  {mType === "Send Chips" ? (
                    <select 
                      className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 focus:border-sk-accent cursor-pointer" 
                      value={mCategory} 
                      onChange={e => setMCategory(e.target.value)}
                    >
                      <option value="Depósito">Depósito</option>
                      <option value="Rakeback">Rakeback</option>
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      disabled 
                      value="Retiro (N/A)" 
                      className="w-full bg-sk-bg-0/50 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-4 font-mono cursor-not-allowed select-none" 
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Monto (Fichas)</label>
                <input type="number" required min="1" className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 font-mono focus:border-sk-accent" value={mAmount} onChange={e => setMAmount(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-4">
                {/* CORRECCIÓN: Quitamos variant="outline" */}
                <Button variant="primary" className="flex-1 bg-sk-bg-3" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button variant="accent" type="submit" className="flex-1">Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TABLA DE MOVIMIENTOS */}
      <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Spinner size="md" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sk-bg-3 font-mono text-[11px] font-semibold tracking-wide uppercase text-sk-text-2 border-b border-sk-border-2">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Jugador</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-center">Estado de Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sk-border-2 font-medium text-sk-sm">
                {filteredTransactions.map((t) => {
                  const isSend = t.type === "Send Chips";
                  const isPartial = Number(t.amount_paid) > 0 && !t.reconciled;
                  
                  return (
                    <tr key={t.id} className="hover:bg-sk-bg-3/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-sk-text-3 text-sk-xs">
                        <div className="flex items-center gap-2">
                          {t.is_manual && (
                            <span title="Ingresado a mano (Esperando CSV)">
                              <Clock size={12} className="text-sk-accent" />
                            </span>
                          )}
                          {new Date(t.date).toLocaleString("es-CL", { timeZone: "America/Santiago", month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-sk-text-1">{t.acc_players?.nickname || "Desconocido"}</div>
                      </td>
                      <td className="py-3 px-4">
                        {isSend ? (
                          <div className="relative inline-block">
                            <ArrowDownLeft size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" />
                            <select
                              value={t.category && t.category !== "Regular" ? t.category : "Depósito"}
                              onChange={(e) => updateCategoryDb(t.id, e.target.value)}
                              className="appearance-none bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] uppercase font-bold tracking-wider text-emerald-400 py-1 pl-6 pr-6 focus:outline-none focus:border-emerald-400 cursor-pointer transition-colors hover:bg-emerald-500/20"
                            >
                              <option value="Depósito" className="bg-sk-bg-2 text-sk-text-1">Depósito</option>
                              <option value="Rakeback" className="bg-sk-bg-2 text-sk-text-1">Rakeback</option>
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-400 opacity-50">▼</div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            <ArrowUpRight size={10} /> Retiro (N/A)
                          </span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${isSend ? "text-emerald-400" : "text-amber-400"}`}>
                        {isSend ? "" : "+"}{Number(t.amount || 0).toLocaleString("es-CL")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handlePayment(t)}
                          className={`group relative inline-flex flex-col items-center justify-center px-3 py-1.5 rounded text-sk-xs font-bold border transition-all w-[100px] ${
                            t.reconciled ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30" : 
                            isPartial ? "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30" :
                            "bg-sk-bg-0 text-sk-text-4 border-sk-border-2 hover:border-sk-text-4 hover:text-sk-text-2"
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {t.reconciled ? <CheckCircle2 size={12} /> : isPartial ? <Edit2 size={12} /> : <XCircle size={12} />}
                            {t.reconciled ? "Saldado" : isPartial ? "Parcial" : "Pendiente"}
                          </span>
                          {isPartial && <span className="text-[9px] font-mono opacity-80">${Number(t.amount_paid).toLocaleString("es-CL")}</span>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}