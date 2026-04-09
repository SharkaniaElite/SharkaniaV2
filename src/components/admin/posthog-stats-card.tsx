// src/components/admin/posthog-stats-card.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, AlertCircle, Loader2 } from 'lucide-react';

export const PostHogStatsCard = () => {
  const [uniqueVisitors, setUniqueVisitors] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(false);
      
      const { data, error: funcError } = await supabase.functions.invoke('posthog-stats');

      if (funcError) throw funcError;

      // Extraemos el conteo del primer set de resultados
      const count = data?.results?.[0]?.count || 0;
      setUniqueVisitors(count);
    } catch (err) {
      console.error("Error cargando stats de PostHog:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="bg-[#09090b] border border-zinc-800 p-6 rounded-xl shadow-2xl relative overflow-hidden group">
      {/* Glow Efecto Sharkania */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 blur-3xl group-hover:bg-cyan-500/20 transition-all" />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em]">
          Visitantes Únicos (7d)
        </h3>
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <Users className="text-cyan-400 w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        {loading ? (
          <Loader2 className="w-8 h-8 text-zinc-700 animate-spin" />
        ) : error ? (
          <div className="flex items-center text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 mr-1" /> Error de conexión
          </div>
        ) : (
          <>
            <span className="text-4xl font-black text-white tracking-tighter">
              {uniqueVisitors}
            </span>
            <span className="text-zinc-500 text-sm font-medium">Visitantes</span>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
          Tráfico Total del Sitio
        </div>
        <button 
          onClick={fetchStats}
          className="text-[10px] text-cyan-500 hover:text-cyan-400 font-bold uppercase tracking-widest transition-colors"
        >
          Refrescar
        </button>
      </div>
    </div>
  );
};