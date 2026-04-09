import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Globe, MousePointer2, TrendingUp, ArrowUpRight, Loader2 } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);

  const fetchFullStats = async (selectedRange: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data: res, error: funcError } = await supabase.functions.invoke('posthog-stats', {
        body: { range: selectedRange }
      });
      
      if (funcError) throw funcError;
      setData(res);
    } catch (err: any) {
      console.error("Error en Analytics:", err);
      setError(err.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFullStats(range); }, [range]);

  if (error) return (
    <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 font-mono text-xs">
      ⚠️ ERROR: {error}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Selector de Rango */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#09090b] p-4 rounded-xl border border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Sharkania Intelligence</h2>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-mono">Tráfico Global del Sitio</p>
        </div>
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                range === r.value ? "bg-cyan-500 text-black shadow-lg" : "text-zinc-500 hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-cyan-500" size={32} />
          <span className="text-zinc-500 text-[10px] uppercase font-bold animate-pulse">Consultando PostHog...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#09090b] border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp size={60} />
              </div>
              <p className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Visitantes Únicos</p>
              <h3 className="text-5xl font-black text-white tracking-tighter">{data?.uniqueVisitors}</h3>
              <div className="mt-4 flex items-center text-cyan-400 text-[10px] font-bold uppercase tracking-wider">
                <ArrowUpRight size={14} className="mr-1" /> Datos en tiempo real
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Páginas */}
            <div className="bg-[#09090b] border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                <MousePointer2 className="text-cyan-400 w-4 h-4" />
                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Contenido más visto</h4>
              </div>
              <div className="space-y-2">
                {data?.pages?.length > 0 ? data.pages.map((path: string, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-zinc-900/30 rounded-lg border border-zinc-800 group hover:border-cyan-500/30 transition-all">
                    <span className="text-[11px] font-mono text-zinc-400 truncate max-w-[200px]">{path || '/'}</span>
                    <span className="text-[10px] font-bold text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded">#{i+1}</span>
                  </div>
                )) : <p className="text-zinc-600 text-xs italic">No hay datos suficientes</p>}
              </div>
            </div>

            {/* Países */}
            <div className="bg-[#09090b] border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-4">
                <Globe className="text-cyan-400 w-4 h-4" />
                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Mercados Principales</h4>
              </div>
              <div className="space-y-4">
                {data?.countries?.length > 0 ? data.countries.map((country: string, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-zinc-300 italic">{country || 'Global'}</span>
                      <span className="text-zinc-500">Tier {i+1}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.5)]" style={{ width: `${100 - (i*15)}%` }} />
                    </div>
                  </div>
                )) : <p className="text-zinc-600 text-xs italic">No hay datos suficientes</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};