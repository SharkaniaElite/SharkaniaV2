import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Globe, MousePointer2, Smartphone, Loader2, BarChart3} from 'lucide-react';

const RANGES = [
  { label: 'Hoy', value: 'today' },
  { label: '7 Días', value: '7d' },
  { label: '15 Días', value: '15d' },
  { label: '30 Días', value: '30d' },
  { label: '3 Meses', value: '3m' },
  { label: '6 Meses', value: '6m' },
  { label: '1 Año', value: '1y' },
];

export const PostHogStatsCard = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7d');

  const fetchStats = async (selectedRange: string) => {
    try {
      setLoading(true);
      const { data: res } = await supabase.functions.invoke('posthog-stats', {
        body: { range: selectedRange }
      });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(range); }, [range]);

  return (
    <div className="bg-[#09090b] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-full min-h-[320px]">
      {/* Header con Selector */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sharkania Intelligence</span>
        </div>
        
        <select 
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="bg-zinc-800 border-none text-zinc-300 text-[10px] font-bold uppercase py-1 px-2 rounded cursor-pointer outline-none hover:bg-zinc-700 transition-colors"
        >
          {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
        </div>
      ) : (
        <div className="p-5 flex flex-col gap-6">
          {/* KPI Grande */}
          <div className="flex items-end gap-3">
            <span className="text-5xl font-black text-white tracking-tighter leading-none">{data?.uniqueVisitors}</span>
            <div className="flex flex-col">
              <span className="text-cyan-400 text-[10px] font-bold uppercase">Visitantes Únicos</span>
              <span className="text-zinc-500 text-[10px] uppercase">{RANGES.find(r => r.value === range)?.label}</span>
            </div>
          </div>

          {/* Grid de Insights */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <Globe className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase">Top Mercados</span>
              </div>
              {data?.countries?.map((c: string, i: number) => (
                <div key={i} className="flex items-center justify-between group">
                  <span className="text-[11px] text-zinc-300 truncate max-w-[80px]">{c || 'Desconocido'}</span>
                  <div className="h-[2px] flex-1 mx-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500/50" style={{ width: `${100 - (i * 20)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-zinc-500 mb-1">
                <Smartphone className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase">Tecnología</span>
              </div>
              {data?.devices?.map((d: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  <span className="text-[11px] text-zinc-300 capitalize">{d || 'Desktop'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Páginas */}
          <div className="pt-2 border-t border-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <MousePointer2 className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase">Contenido más visto</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data?.pages?.map((p: string, i: number) => {
                const url = new URL(p, 'https://sharkania.com');
                const path = url.pathname === '/' ? 'Home' : url.pathname;
                return (
                  <span key={i} className="text-[9px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-md">
                    {path.substring(0, 20)}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};