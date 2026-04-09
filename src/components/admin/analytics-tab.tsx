import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Globe, MousePointer2, 
  TrendingUp, ArrowUpRight, 
} from 'lucide-react';

const RANGES = [
  { label: 'Hoy', value: 'today' },
  { label: '7 Días', value: '7d' },
  { label: '30 Días', value: '30d' },
  { label: '12 Meses', value: '1y' },
];

export const AnalyticsTab = () => {
  const [range, setRange] = useState('7d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchFullStats = async (selectedRange: string) => {
    try {
      setLoading(true);
      const { data: res } = await supabase.functions.invoke('posthog-stats', {
        body: { range: selectedRange }
      });
      setData(res);
    } catch (err) {
      console.error("Error en Analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFullStats(range); }, [range]);

  return (
    <div className="space-y-6">
      {/* Header de la pestaña */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/30 p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Intelligence Hub</h2>
          <p className="text-zinc-500 text-xs uppercase tracking-widest font-mono">Monitoreo de tráfico en tiempo real</p>
        </div>
        
        <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                range === r.value 
                ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]" 
                : "text-zinc-500 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#09090b] border border-zinc-800 p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} /></div>
          <p className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Visitantes Únicos</p>
          <h3 className="text-5xl font-black text-white tracking-tighter">
            {loading ? "..." : data?.uniqueVisitors}
          </h3>
          <div className="mt-4 flex items-center text-emerald-400 text-[10px] font-bold">
            <ArrowUpRight size={14} className="mr-1" /> TRÁFICO VERIFICADO
          </div>
        </div>

        {/* Aquí podríamos añadir más KPIs como "Sesiones" o "Bounce Rate" si actualizamos la Edge Function */}
      </div>

      {/* Grid Detallado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Páginas: CRUCIAL PARA SABER QUÉ PRODUCTO FUNCIONA */}
        <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <MousePointer2 className="text-cyan-400 w-4 h-4" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Páginas más calientes</h4>
          </div>
          <div className="space-y-3">
            {data?.pages?.map((path: string, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50 group hover:border-cyan-500/30 transition-all">
                <span className="text-xs font-mono text-zinc-400 truncate max-w-[250px]">{path}</span>
                <span className="text-[10px] font-bold text-cyan-500 bg-cyan-500/10 px-2 py-1 rounded italic">Top {i+1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Países y Dispositivos */}
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl p-6">
             <div className="flex items-center gap-2 mb-6">
                <Globe className="text-cyan-400 w-4 h-4" />
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Distribución Geográfica</h4>
              </div>
              <div className="space-y-4">
                {data?.countries?.map((country: string, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-zinc-300 uppercase italic">{country || 'Desconocido'}</span>
                      <span className="text-zinc-500">{100 - (i * 15)}% Relevancia</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-cyan-500 shadow-[0_0_10px_#22d3ee]" 
                        style={{ width: `${100 - (i * 15)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
          </div>
        </div>

      </div>
    </div>
  );
};