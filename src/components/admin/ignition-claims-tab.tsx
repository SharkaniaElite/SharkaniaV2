import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Download, Users } from 'lucide-react';

interface IgnitionPlayer {
  id: string;
  display_name: string | null;
  email: string | null;
  ignition_nickname: string | null;
  ignition_email: string | null;
  created_at: string;
}

export function IgnitionClaimsTab() {
  const [players, setPlayers] = useState<IgnitionPlayer[]>([]);
  const [loading, setLoading] = useState(true); // 🔥 Ya arranca en true por defecto

  useEffect(() => {
    const fetchPlayers = async () => {
      // 🔥 ELIMINAMOS el setLoading(true) aquí para cumplir con las reglas de ESLint
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, ignition_nickname, ignition_email, created_at')
        .not('ignition_nickname', 'is', null) 
        .neq('ignition_nickname', '')         
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching ignition players:", error);
      } else {
        setPlayers(data || []);
      }
      
      setLoading(false); // Solo lo usamos de forma asíncrona al terminar
    };

    fetchPlayers();
  }, []);

  const exportToCSV = () => {
    if (players.length === 0) {
      alert("No hay jugadores para exportar.");
      return;
    }

    // Headers del CSV
    const headers = ['Email Sharkania', 'Nickname Ignition', 'Email Ignition', 'Fecha de Registro'];
    
    // Mapear los datos de los jugadores a filas del CSV
    const csvRows = players.map(player => [
      player.email || 'Sin email',
      player.ignition_nickname || '',
      player.ignition_email || '',
      new Date(player.created_at).toLocaleDateString()
    ]);

    // Combinar headers y filas
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Crear y descargar el archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Ignition_Players_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-sk-text-3 gap-3">
        <div className="w-8 h-8 border-4 border-sk-accent border-t-transparent rounded-full animate-spin"></div>
        <p>Cargando jugadores de Ignition...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER DEL TAB */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-sk-bg-2/50 p-6 rounded-xl border border-sk-border-2">
        <div>
          <h2 className="text-xl font-bold text-sk-text-1 flex items-center gap-2">
            <Users className="text-orange-500" size={24} />
            Data de Jugadores Ignition
          </h2>
          <p className="text-sm text-sk-text-3 mt-1">
            Muestra a todos los usuarios que han vinculado su Nickname y Email de Ignition Poker en su perfil.
          </p>
        </div>
        <Button 
          onClick={exportToCSV} 
          disabled={players.length === 0}
          className="bg-orange-500 text-white hover:bg-orange-600 flex items-center gap-2 shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all shrink-0"
        >
          <Download size={16} />
          Descargar CSV
        </Button>
      </div>

      {/* TABLA DE JUGADORES */}
      <Card className="bg-sk-bg-1 border-sk-border-2 overflow-hidden shadow-lg">
        <div className="flex items-center justify-between p-4 border-b border-sk-border-2 bg-sk-bg-2">
          <span className="text-sm font-semibold text-sk-text-2">
            Total Registrados: <span className="text-sk-accent">{players.length}</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-sk-bg-2/50 border-b border-sk-border-2">
                <th className="p-4 text-xs font-bold text-sk-text-3 uppercase tracking-wider">Usuario (Sharkania)</th>
                <th className="p-4 text-xs font-bold text-sk-text-3 uppercase tracking-wider">Nickname Ignition</th>
                <th className="p-4 text-xs font-bold text-sk-text-3 uppercase tracking-wider">Email Ignition</th>
                <th className="p-4 text-xs font-bold text-sk-text-3 uppercase tracking-wider text-right">Fecha Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sk-border-2">
              {players.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-sk-text-3">
                    No hay jugadores con datos de Ignition registrados aún.
                  </td>
                </tr>
              ) : (
                players.map((player) => (
                  <tr key={player.id} className="hover:bg-sk-bg-2/80 transition-colors">
                    <td className="p-4">
                      <div className="text-sm font-bold text-sk-text-1">{player.display_name || 'Sin Nombre'}</div>
                      <div className="text-xs text-sk-text-4 font-mono mt-0.5">{player.email}</div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        {player.ignition_nickname}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-sk-text-2 font-mono">
                      {player.ignition_email || '-'}
                    </td>
                    <td className="p-4 text-sm text-sk-text-3 text-right">
                      {new Date(player.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}