// src/pages/lap-upload.tsx
import { useState, useEffect } from "react";
import Papa from "papaparse";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { BarChart3, Calendar, UploadCloud, Library, Save, Trash2, Edit } from "lucide-react";
import { supabase } from "../lib/supabase";

interface ParsedRow {
  id: number;
  player: string;
  agent: string;
  rake: string;
}

export function LapUploadPage() {
  const [view, setView] = useState<'upload' | 'library'>('upload');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  
  // ================= ESTADOS DE SUBIDA =================
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // ================= ESTADOS DE BIBLIOTECA =================
  const [reportDates, setReportDates] = useState<{date: string, period: string}[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const addLog = (msg: string) => setLog((prev) => [...prev, msg]);

  // 🔥 CARGAR HISTÓRICO Y FORMATEAR EL PERIODO
  const loadReportDates = async () => {
    try {
      const { data } = await supabase
        .from('acc_transactions')
        .select('date, period')
        .eq('category', 'Rakeback')
        .in('type', ['Ingreso', 'ingreso'])
        .order('date', { ascending: false });

      if (data) {
        const map = new Map<string, string>();
        
        data.forEach(d => {
          const dateOnly = d.date.split('T')[0];
          let displayPeriod = d.period || dateOnly; 
          
          if (d.period && d.period.includes('~')) {
            const parts = d.period.split('~').map((s: string) => s.trim());
            if (parts.length === 2) {
              const [sY, sM, sD] = parts[0].split('-');
              const [eY, eM, eD] = parts[1].split('-');
              if (sY && eY) {
                displayPeriod = `${sD}-${sM}-${sY.slice(2)} / ${eD}-${eM}-${eY.slice(2)}`;
              }
            }
          }

          if (!map.has(dateOnly)) {
            map.set(dateOnly, displayPeriod);
          }
        });
        
        const uniqueReports = Array.from(map.entries()).map(([date, period]) => ({ date, period }));
        setReportDates(uniqueReports);
      }
    } catch (err) {
      console.error("Error cargando fechas:", err);
    }
  };

  useEffect(() => {
    if (view === 'library') {
      loadReportDates();
    }
  }, [view]);

  // ================= LÓGICA DE SUBIDA (TAB 1) =================
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setLog([]);

    if (!file) {
      setParsedData([]);
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const dataRows = results.data as Record<string, string>[];
        if (!dataRows || dataRows.length === 0) {
          addLog("❌ Error: El archivo está vacío o no se pudo leer.");
          return;
        }

        const extracted: ParsedRow[] = dataRows.map((row, index) => {
          const keys = Object.keys(row);
          const playerKey = keys.find(k => k.toLowerCase().includes("player") || k.toLowerCase().includes("jugador"));
          const rakeKey = keys.find(k => k.toLowerCase().includes("rake"));
          const agentKey = keys.find(k => k.toLowerCase().includes("agente") || k.toLowerCase().includes("agent"));

          return {
            id: index,
            player: playerKey && row[playerKey] ? row[playerKey].trim() : "",
            agent: agentKey && row[agentKey] ? row[agentKey].trim() : "GettingRIcher",
            rake: rakeKey && row[rakeKey] ? row[rakeKey].trim() : "0"
          };
        }).filter(row => row.player !== ""); 

        setParsedData(extracted);
        addLog(`✅ Archivo leído. ${extracted.length} filas listas para revisión.`);
      }
    });
  };

  const updateParsedRow = (id: number, field: keyof ParsedRow, value: string) => {
    setParsedData(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const removeParsedRow = (id: number) => {
    setParsedData(prev => prev.filter(row => row.id !== id));
  };

  const clearData = () => {
    setParsedData([]);
    setLog([]);
    const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const calculateTotalRake = () => {
    return parsedData.reduce((sum, row) => {
      let cleanRake = row.rake.replace(/[^0-9.,-]/g, '');
      if (cleanRake.lastIndexOf(',') > cleanRake.lastIndexOf('.')) {
        cleanRake = cleanRake.replace(/\./g, '').replace(',', '.');
      } else {
        cleanRake = cleanRake.replace(/,/g, '');
      }
      return sum + (parseFloat(cleanRake) || 0);
    }, 0);
  };

  const processUpload = async () => {
    if (parsedData.length === 0) return;
    if (!startDate || !endDate) {
      addLog("❌ Error: Debes seleccionar las fechas de inicio y fin del periodo.");
      return;
    }
    if (startDate > endDate) {
      addLog("❌ Error: La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    setLoading(true);
    setLog([]);
    addLog(`⏳ Iniciando carga para el periodo: ${startDate} al ${endDate}...`);

    try {
      addLog("🔄 Analizando base de datos para evitar duplicados en este rango...");
      
      const { data: existingTx, error: txErr } = await supabase
        .from('acc_transactions')
        .select('clubgg_id, amount')
        .eq('category', 'Rakeback')
        .eq('type', 'Ingreso')
        .gte('date', `${startDate}T00:00:00Z`)
        .lte('date', `${endDate}T23:59:59Z`);

      if (txErr) throw new Error("No se pudo leer el historial: " + txErr.message);

      const rakeCache: Record<string, number> = {};
      const playersInPeriod = new Set<string>(); 
      
      if (existingTx) {
        existingTx.forEach(tx => {
          rakeCache[tx.clubgg_id] = (rakeCache[tx.clubgg_id] || 0) + Number(tx.amount);
          playersInPeriod.add(tx.clubgg_id);
        });
      }

      let successCount = 0;
      let skippedCount = 0;

      for (const row of parsedData) {
        const playerName = row.player;
        const agentName = row.agent || "GettingRIcher"; 
        
        let cleanRake = row.rake.replace(/[^0-9.,-]/g, '');
        if (cleanRake.lastIndexOf(',') > cleanRake.lastIndexOf('.')) {
          cleanRake = cleanRake.replace(/\./g, '').replace(',', '.');
        } else {
          cleanRake = cleanRake.replace(/,/g, '');
        }
        const rakeVal = parseFloat(cleanRake) || 0;

        // 🔥 CREACIÓN AUTOMÁTICA DE AGENTES
        let { data: agent } = await supabase.from("acc_agents").select("id").eq("name", agentName).maybeSingle();

        if (!agent) {
          const { data: newAgent, error: agErr } = await supabase.from("acc_agents").insert({ 
            name: agentName, 
            deal_percentage: 50 // Porcentaje por defecto (Ignorado en los nuevos reportes)
          }).select("id").single();
          
          if (newAgent) {
            agent = newAgent;
            addLog(agentName === "GettingRIcher" 
              ? `👑 Agente Admin (GettingRIcher) creado automáticamente.` 
              : `👤 Nuevo agente registrado automáticamente: ${agentName}`);
          } else if (agErr) {
            addLog(`❌ Error al crear agente ${agentName}: ${agErr.message}`);
            continue;
          }
        }

        // 🔥 CORRECCIÓN TYPESCRIPT: Validación de seguridad
        if (!agent || !agent.id) {
          addLog(`❌ Error crítico: No se pudo verificar ni crear el agente ${agentName}.`);
          continue;
        }

        const { data: player } = await supabase.from("acc_players").select("clubgg_id").eq("nickname", playerName).maybeSingle();
        let currentClubggId = player?.clubgg_id;

        if (!player) {
          const { data: newPlayer, error: pErr } = await supabase.from("acc_players").insert({ nickname: playerName, clubgg_id: playerName, agent_id: agent.id }).select("clubgg_id").single();
          if (newPlayer) {
            currentClubggId = newPlayer.clubgg_id;
            addLog(`➕ Jugador registrado: ${playerName}`);
          } else if (pErr) {
            addLog(`❌ Error al registrar jugador ${playerName}: ${pErr.message}`);
            continue;
          }
        } else {
          await supabase.from("acc_players").update({ agent_id: agent.id }).eq("clubgg_id", currentClubggId);
        }

        if (currentClubggId) {
          const existingRake = rakeCache[currentClubggId] || 0;
          const difference = rakeVal - existingRake;

          if (difference > 0.01 || (Math.abs(difference) <= 0.01 && !playersInPeriod.has(currentClubggId))) {
            const finalAmount = Math.max(0, difference); 

            const { error: tErr } = await supabase.from("acc_transactions").insert({
              clubgg_id: currentClubggId,
              agent_id: agent.id,
              amount: finalAmount, 
              category: "Rakeback",
              type: "Ingreso", 
              date: `${endDate}T23:59:59Z`, 
              period: `${startDate} ~ ${endDate}`, 
              balance_after: 0,
              reconciled: false,
              is_manual: false,
              amount_paid: 0
            });

            if (!tErr) {
              successCount++;
              rakeCache[currentClubggId] = existingRake + finalAmount; 
              playersInPeriod.add(currentClubggId); 
            } else {
              addLog(`❌ Error en transacción de ${playerName}: ${tErr.message}`);
            }
          } else if (difference < -0.01) {
             addLog(`⚠️ Ojo: El rake de ${playerName} en la tabla (${rakeVal}) es MENOR al que ya está en el sistema (${existingRake}).`);
             skippedCount++;
          } else {
            skippedCount++; 
          }
        }
      }

      addLog(`\n✅ Carga finalizada.`);
      addLog(`📈 Nuevos registros guardados: ${successCount}`);
      addLog(`⏭️ Registros omitidos (Ya actualizados): ${skippedCount}`);
      
      setTimeout(() => {
        if (successCount > 0) {
          setParsedData([]);
          const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
        }
      }, 2000);

    } catch (err: any) {
      addLog(`❌ Error crítico: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ================= LÓGICA DE BIBLIOTECA Y EDICIÓN (TAB 2) =================
  const loadReportDetails = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setLoading(true);
    setHasChanges(false);
    try {
      const start = `${dateStr}T00:00:00Z`;
      const end = `${dateStr}T23:59:59Z`;

      const { data, error } = await supabase
        .from('acc_transactions')
        .select(`
          id, amount, clubgg_id, agent_id,
          acc_players(nickname),
          acc_agents(name)
        `)
        .eq('category', 'Rakeback')
        .in('type', ['Ingreso', 'ingreso'])
        .gte('date', start)
        .lte('date', end);

      if (error) throw error;

      const formatted = data.map((tx: any) => ({
        id: tx.id,
        original_clubgg_id: tx.clubgg_id,
        nickname: tx.acc_players?.nickname || tx.clubgg_id,
        agent: tx.acc_agents?.name || "GettingRIcher",
        amount: tx.amount,
        isModified: false
      }));

      setReportRows(formatted);
    } catch (err: any) {
      alert("Error cargando detalles del reporte: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateLibraryRow = (id: number, field: string, value: string) => {
    setReportRows(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value, isModified: true };
      }
      return row;
    }));
    setHasChanges(true);
  };

  const deleteLibraryRow = async (id: number) => {
    if(!window.confirm("¿Seguro que quieres eliminar esta transacción del sistema? Esto afectará los cálculos.")) return;
    
    try {
      await supabase.from('acc_transactions').delete().eq('id', id);
      setReportRows(prev => prev.filter(r => r.id !== id));
      alert("Transacción eliminada con éxito.");
    } catch (err: any) {
      alert("Error eliminando: " + err.message);
    }
  };

  const deleteFullReport = async () => {
    if (!window.confirm("🚨 ¡ADVERTENCIA CRÍTICA!\n\n¿Estás seguro de eliminar TODO el informe de esta fecha?\nSe borrarán todas las transacciones de Rake asociadas a este día y se recalcularán los saldos. Esta acción NO se puede deshacer.")) return;
    
    setLoading(true);
    try {
      const start = `${selectedDate}T00:00:00Z`;
      const end = `${selectedDate}T23:59:59Z`;

      const { error } = await supabase
        .from('acc_transactions')
        .delete()
        .eq('category', 'Rakeback')
        .in('type', ['Ingreso', 'ingreso'])
        .gte('date', start)
        .lte('date', end);

      if (error) throw error;

      alert("🗑️ Informe completo eliminado exitosamente. Los saldos de caja se han actualizado.");
      setReportRows([]);
      setSelectedDate("");
      loadReportDates(); 
    } catch (err: any) {
      alert("Error eliminando el informe: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveReportChanges = async () => {
    const modifiedRows = reportRows.filter(r => r.isModified);
    if (modifiedRows.length === 0) return;

    if (!window.confirm(`Vas a modificar ${modifiedRows.length} registros en el sistema. Los cálculos globales se actualizarán. ¿Continuar?`)) return;

    setLoading(true);
    try {
      for (const row of modifiedRows) {
        let agentId = row.agent_id;
        const { data: agData } = await supabase.from('acc_agents').select('id').eq('name', row.agent).maybeSingle();
        if (!agData) {
          const { data: newAg } = await supabase.from('acc_agents').insert({ name: row.agent, deal_percentage: 50 }).select('id').single();
          agentId = newAg?.id;
        } else {
          agentId = agData.id;
        }

        let clubggId = row.original_clubgg_id;
        const { data: plData } = await supabase.from('acc_players').select('clubgg_id').eq('nickname', row.nickname).maybeSingle();
        if (!plData) {
          const newClubggId = row.nickname.replace(/\s+/g, '_').toLowerCase() + '_' + Math.floor(Math.random()*1000);
          const { data: newPl } = await supabase.from('acc_players').insert({
            nickname: row.nickname,
            clubgg_id: newClubggId,
            agent_id: agentId
          }).select('clubgg_id').single();
          clubggId = newPl?.clubgg_id;
        } else {
          clubggId = plData.clubgg_id;
          if (agentId) await supabase.from('acc_players').update({ agent_id: agentId }).eq('clubgg_id', clubggId);
        }

        const numericAmount = parseFloat(String(row.amount).replace(/,/g, '.')) || 0;
        await supabase.from('acc_transactions').update({
          amount: numericAmount,
          clubgg_id: clubggId,
          agent_id: agentId
        }).eq('id', row.id);
      }

      alert("¡Todos los cambios fueron guardados y el sistema ha recalculado los saldos!");
      setHasChanges(false);
      loadReportDetails(selectedDate);
    } catch (err: any) {
      alert("Error guardando cambios: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-2xl font-black text-white">Gestión de Rake</h2>
          <p className="text-sm text-gray-400">Sube nuevos reportes o audita/edita reportes históricos.</p>
        </div>
        
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
          <button 
            onClick={() => setView('upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-bold transition-all ${view === 'upload' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <UploadCloud size={16} /> Subir Informe
          </button>
          <button 
            onClick={() => setView('library')}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-bold transition-all ${view === 'library' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Library size={16} /> Biblioteca e Histórico
          </button>
        </div>
      </div>

      {/* ======================= PESTAÑA: SUBIR NUEVO ======================= */}
      {view === 'upload' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl max-w-4xl mx-auto">
            
            <div className="bg-gray-900/50 border border-gray-700 p-4 rounded-lg mb-6">
              <div className="flex items-center gap-2 mb-3 text-indigo-400">
                <Calendar size={18} />
                <h3 className="font-bold text-sm">Periodo del Reporte a Subir</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase font-mono text-gray-400 mb-1">Desde</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm outline-none focus:border-indigo-500" />
                </div>
                <div className="text-gray-500 font-bold mt-4">~</div>
                <div className="flex-1">
                  <label className="block text-[10px] uppercase font-mono text-gray-400 mb-1">Hasta (Fecha de Sello)</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm outline-none focus:border-indigo-500" />
                </div>
              </div>
            </div>

            {parsedData.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-700 rounded-lg bg-gray-900/50 hover:bg-gray-900 transition-colors">
                <BarChart3 size={48} className="text-indigo-500 mb-4 opacity-50" />
                <h3 className="text-lg font-bold text-white mb-2">Cargar Archivo CSV</h3>
                <p className="text-xs text-gray-400 font-mono mb-6 text-center max-w-md">
                  Asegúrate de que el archivo contenga las columnas "Player", "Agente" y "Rake". Los nuevos agentes se crearán solos.
                </p>
                <input 
                  id="csv-upload"
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileSelect} 
                  className="block w-full max-w-sm text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer" 
                />
              </div>
            )}

            {parsedData.length > 0 && (
              <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between items-end mb-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Edit size={16} className="text-indigo-400" /> Pre-visualización
                  </h3>
                  <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20">
                    Total Rake a Subir: <b>${calculateTotalRake().toLocaleString("es-CL")}</b>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden shadow-inner overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-white min-w-[600px] relative">
                    <thead className="bg-gray-950 text-[10px] uppercase font-mono tracking-wider text-gray-400 sticky top-0 z-10 shadow-md">
                      <tr>
                        <th className="p-3 w-1/3">Jugador (ID/Nick)</th>
                        <th className="p-3 w-1/3">Agente</th>
                        <th className="p-3 w-1/4">Rake Bruto</th>
                        <th className="p-3 w-16 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-800">
                      {parsedData.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="p-2">
                            <input type="text" value={row.player} onChange={(e) => updateParsedRow(row.id, 'player', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-950 rounded px-2 py-1 outline-none text-white font-semibold" />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.agent} onChange={(e) => updateParsedRow(row.id, 'agent', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-gray-700 focus:border-indigo-500 focus:bg-gray-950 rounded px-2 py-1 outline-none text-gray-300" />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.rake} onChange={(e) => updateParsedRow(row.id, 'rake', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-gray-700 focus:border-emerald-500 focus:bg-gray-950 rounded px-2 py-1 outline-none text-emerald-400 font-mono font-bold" />
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => removeParsedRow(row.id)} className="text-gray-600 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded" title="Ignorar fila">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button variant="secondary" className="flex-1 border-gray-700" onClick={clearData} disabled={loading}>
                    Cancelar y Limpiar
                  </Button>
                  <Button variant="accent" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold" disabled={loading} onClick={processUpload}>
                    {loading ? <><Spinner size="sm" className="mr-2" /> Insertando BD...</> : <><UploadCloud size={16} className="mr-2" /> Confirmar y Consolidar Rake</>}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {log.length > 0 && (
            <div className="bg-black p-4 rounded-xl border border-gray-800 h-48 overflow-y-auto font-mono text-xs text-emerald-500 whitespace-pre-line shadow-inner max-w-4xl mx-auto">
              {log.map((entry, i) => <div key={i}>{entry}</div>)}
            </div>
          )}
        </div>
      )}

      {/* ======================= PESTAÑA: BIBLIOTECA (TAB 2) ======================= */}
      {view === 'library' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 bg-gray-800 p-4 rounded-xl border border-gray-700 shadow">
            <div className="flex-1 w-full">
              <label className="flex items-center gap-1 text-[10px] uppercase font-mono text-emerald-400 mb-1">
                <Calendar size={12} /> Seleccionar Reporte Histórico
              </label>
              <select 
                value={selectedDate} 
                onChange={(e) => loadReportDetails(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-white text-sm outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="">-- Elige un reporte --</option>
                {reportDates.map(report => (
                  <option key={report.date} value={report.date}>Periodo: {report.period}</option>
                ))}
              </select>
            </div>
            
            {selectedDate && (
              <Button variant="secondary" onClick={deleteFullReport} className="border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition-all whitespace-nowrap">
                <Trash2 size={16} className="mr-2" /> Eliminar Informe Completo
              </Button>
            )}
          </div>

          {loading && <div className="flex justify-center py-10"><Spinner size="lg" /></div>}

          {!loading && selectedDate && reportRows.length === 0 && (
            <div className="text-center py-10 text-gray-500 text-sm">No se encontraron transacciones para esta fecha.</div>
          )}

          {!loading && reportRows.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden shadow-2xl">
              
              <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Edit size={18} className="text-amber-400" /> Edición Directa de Base de Datos
                </h3>
                {hasChanges && (
                  <Button variant="accent" size="sm" onClick={saveReportChanges} className="bg-amber-600 hover:bg-amber-500 text-white font-bold h-8 text-xs border-none shadow-lg animate-pulse">
                    <Save size={14} className="mr-1.5" /> Guardar Cambios
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-white min-w-[700px] relative">
                  <thead className="bg-gray-950 text-[10px] uppercase font-mono tracking-wider text-gray-400 sticky top-0 z-10 shadow-md">
                    <tr>
                      <th className="p-3 w-1/3">Jugador (Nickname)</th>
                      <th className="p-3 w-1/3">Agente Asignado</th>
                      <th className="p-3 w-1/4">Monto Rake ($)</th>
                      <th className="p-3 w-16 text-center">Eliminar</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-gray-800">
                    {reportRows.map((row) => (
                      <tr key={row.id} className={`transition-colors ${row.isModified ? 'bg-amber-900/10' : 'hover:bg-gray-800/30'}`}>
                        <td className="p-2 border-r border-gray-800/50">
                          <input 
                            type="text" 
                            value={row.nickname} 
                            onChange={(e) => updateLibraryRow(row.id, 'nickname', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-gray-700 focus:border-amber-500 focus:bg-gray-950 rounded px-2 py-1 outline-none text-white font-semibold transition-all"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-800/50">
                          <input 
                            type="text" 
                            value={row.agent} 
                            onChange={(e) => updateLibraryRow(row.id, 'agent', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-gray-700 focus:border-amber-500 focus:bg-gray-950 rounded px-2 py-1 outline-none text-gray-300 transition-all"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number" 
                            value={row.amount} 
                            onChange={(e) => updateLibraryRow(row.id, 'amount', e.target.value)}
                            className={`w-full bg-transparent border border-transparent hover:border-gray-700 focus:border-emerald-500 focus:bg-gray-950 rounded px-2 py-1 outline-none font-mono font-bold transition-all ${row.isModified ? 'text-amber-400' : 'text-emerald-400'}`}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button 
                            onClick={() => deleteLibraryRow(row.id)}
                            className="text-gray-600 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition-colors"
                            title="Eliminar fila del sistema"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="p-4 bg-gray-950 text-[10px] text-gray-500 text-center uppercase tracking-wider font-mono">
                La tabla muestra {reportRows.length} registros correspondientes al cierre de este periodo.
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}