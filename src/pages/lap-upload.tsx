// src/pages/lap-upload.tsx
import { useState } from "react";
import Papa from "papaparse";
import { Button } from "../components/ui/button";
import { BarChart3, Calendar } from "lucide-react";
import { supabase } from "../lib/supabase";

export function LapUploadPage() {
  const [statsFile, setStatsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const addLog = (msg: string) => setLog((prev) => [...prev, msg]);

  const processFile = async () => {
    if (!statsFile) return;
    setLoading(true);
    setLog([]);
    addLog(`⏳ Iniciando lectura inteligente para el periodo: ${reportMonth}...`);

    try {
      const [year, month] = reportMonth.split('-');
      const startDate = `${year}-${month}-01T00:00:00Z`;
      const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59).toISOString();

      addLog("🔄 Analizando base de datos para evitar duplicados...");
      const { data: existingTx, error: txErr } = await supabase
        .from('acc_transactions')
        .select('clubgg_id, amount')
        .eq('category', 'Rakeback')
        .eq('type', 'Ingreso')
        .gte('date', startDate)
        .lte('date', endDate);

      if (txErr) throw new Error("No se pudo leer el historial del mes: " + txErr.message);

      const rakeCache: Record<string, number> = {};
      if (existingTx) {
        existingTx.forEach(tx => {
          rakeCache[tx.clubgg_id] = (rakeCache[tx.clubgg_id] || 0) + Number(tx.amount);
        });
      }

      Papa.parse(statsFile, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const dataRows = results.data as Record<string, string>[];
            
            if (!dataRows || dataRows.length === 0) {
              addLog("❌ Error: El archivo está vacío o no se pudo leer.");
              setLoading(false);
              return;
            }

            let successCount = 0;
            let skippedCount = 0;

            for (const row of dataRows) {
              const keys = Object.keys(row);
              const playerKey = keys.find(k => k.toLowerCase().includes("player"));
              const rakeKey = keys.find(k => k.toLowerCase().includes("rake"));
              const agentKey = keys.find(k => k.toLowerCase().includes("agente"));

              if (!playerKey || !agentKey || !rakeKey) continue;

              const playerName = row[playerKey]?.trim();
              let agentName = row[agentKey]?.trim();
              const rakeStr = row[rakeKey]?.trim() || "0";

              if (!playerName) continue;

              // 🔥 MAGIA: Si viene sin agente, es para el Admin (GettingRIcher)
              if (!agentName || agentName === "") {
                agentName = "GettingRIcher";
              }

              let cleanRake = rakeStr.replace(/[^0-9.,-]/g, '');
              if (cleanRake.lastIndexOf(',') > cleanRake.lastIndexOf('.')) {
                cleanRake = cleanRake.replace(/\./g, '').replace(',', '.');
              } else {
                cleanRake = cleanRake.replace(/,/g, '');
              }
              const rakeVal = parseFloat(cleanRake) || 0;

              // Buscar Agente
              let { data: agent } = await supabase
                .from("acc_agents")
                .select("id")
                .eq("name", agentName)
                .maybeSingle();

              // 🔥 AUTO-CREACIÓN DEL ADMIN SI NO EXISTE
              if (!agent && agentName === "GettingRIcher") {
                const { data: newAgent } = await supabase
                  .from("acc_agents")
                  .insert({ name: "GettingRIcher", deal_percentage: 80 })
                  .select("id")
                  .single();
                agent = newAgent;
                addLog(`👑 Agente Admin (GettingRIcher) creado automáticamente.`);
              }

              if (!agent) {
                addLog(`⚠️ Omitido: El agente "${agentName}" no está registrado.`);
                continue;
              }

              const { data: player } = await supabase
                .from("acc_players")
                .select("clubgg_id")
                .eq("nickname", playerName)
                .maybeSingle();

              let currentClubggId = player?.clubgg_id;

              if (!player) {
                const { data: newPlayer, error: pErr } = await supabase
                  .from("acc_players")
                  .insert({ nickname: playerName, clubgg_id: playerName, agent_id: agent.id })
                  .select("clubgg_id")
                  .single();

                if (newPlayer) {
                  currentClubggId = newPlayer.clubgg_id;
                  addLog(`➕ Jugador registrado: ${playerName}`);
                } else if (pErr) {
                  addLog(`❌ Error al registrar jugador ${playerName}: ${pErr.message}`);
                  continue;
                }
              } else {
                await supabase
                  .from("acc_players")
                  .update({ agent_id: agent.id })
                  .eq("clubgg_id", currentClubggId);
              }

              if (currentClubggId) {
                const existingRake = rakeCache[currentClubggId] || 0;
                const difference = rakeVal - existingRake;

                if (difference > 0.01) {
                  const { error: tErr } = await supabase.from("acc_transactions").insert({
                    clubgg_id: currentClubggId,
                    agent_id: agent.id,
                    amount: difference, 
                    category: "Rakeback",
                    type: "Ingreso", 
                    date: new Date().toISOString(),
                    period: reportMonth,
                    balance_after: 0,
                    reconciled: false,
                    is_manual: false,
                    amount_paid: 0
                  });

                  if (!tErr) {
                    successCount++;
                    rakeCache[currentClubggId] = existingRake + difference; 
                  } else {
                    addLog(`❌ Error en transacción de ${playerName}: ${tErr.message}`);
                  }
                } else if (difference < -0.01) {
                   addLog(`⚠️ Ojo: El rake de ${playerName} en el CSV (${rakeVal}) es MENOR al que ya está en el sistema (${existingRake}).`);
                } else {
                  skippedCount++;
                }
              }
            }

            addLog(`\n✅ Carga finalizada.`);
            addLog(`📈 Nuevos registros (Diferencial): ${successCount}`);
            addLog(`⏭️ Registros omitidos (Ya estaban actualizados): ${skippedCount}`);
            
          } catch (err: any) {
            addLog(`❌ Error en procesamiento de filas: ${err.message}`);
          } finally {
            setLoading(false);
          }
        }
      });
    } catch (err: any) {
      addLog(`❌ Error crítico: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h2 className="text-2xl font-black text-white">Importación de Rake por Periodos</h2>
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
        <div className="bg-gray-900/50 border border-gray-700 p-4 rounded-lg mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-emerald-500" size={20} />
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Mes del Reporte CSV</label>
              <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="bg-transparent text-white font-mono focus:outline-none focus:text-emerald-400 cursor-pointer" />
            </div>
          </div>
          <div className="text-[10px] text-gray-500 max-w-[200px] text-right leading-tight">Se calculará automáticamente la diferencia con lo que ya se subió este mes.</div>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded bg-emerald-900/50 flex items-center justify-center text-emerald-400"><BarChart3 size={20} /></div>
          <div>
            <h3 className="text-lg font-bold text-white">Cargar Archivo CSV</h3>
            <p className="text-xs text-gray-400 font-mono">Lectura inteligente por nombres de encabezado</p>
          </div>
        </div>

        <input type="file" accept=".csv" onChange={(e) => setStatsFile(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 mb-4 cursor-pointer" />
        
        <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-black font-bold" disabled={!statsFile || loading} onClick={processFile}>
          {loading ? "Calculando diferenciales..." : "Subir y Consolidar Rake"}
        </Button>
      </div>

      <div className="bg-black p-4 rounded border border-gray-800 h-48 overflow-y-auto font-mono text-xs text-emerald-500 whitespace-pre-line">
        {log.map((entry, i) => <div key={i}>{entry}</div>)}
      </div>
    </div>
  );
}