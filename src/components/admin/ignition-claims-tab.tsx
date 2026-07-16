// src/components/admin/ignition-claims-tab.tsx
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Mail, Filter, RefreshCw, Send, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface IgnitionPlayer {
  id: string;
  display_name: string | null;
  email: string | null;
  ignition_nickname: string | null;
  ignition_email: string | null;
  created_at: string;
  ignition_password_sent: boolean;
}

export function IgnitionClaimsTab() {
  const [players, setPlayers] = useState<IgnitionPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ── ESTADOS DEL PANEL DE CORREOS ──
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('pending');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState('');

  const fetchPlayers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, ignition_nickname, ignition_email, created_at, ignition_password_sent')
      .eq('ignition_league_player', true) // Solo los que están en la liga
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching ignition players:", error);
    } else {
      setPlayers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  // ── LÓGICA DE FILTRADO Y SELECCIÓN ──
  const filteredPlayers = useMemo(() => {
    if (filter === 'pending') return players.filter(p => !p.ignition_password_sent);
    if (filter === 'sent') return players.filter(p => p.ignition_password_sent);
    return players;
  }, [players, filter]);

  const handleSelectAll = () => {
    if (selectedIds.size === filteredPlayers.length) {
      setSelectedIds(new Set()); // Deseleccionar todos
    } else {
      setSelectedIds(new Set(filteredPlayers.map(p => p.id))); // Seleccionar todos los filtrados
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  // 🔥 PLANTILLA HTML EXCLUSIVA PARA IGNITION
  const generatePasswordEmailHtml = (nickname: string, messageContent: string) => {
    return `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; background-color: #09090b; color: #ffffff; padding: 20px; border-radius: 10px;">
        <div style="text-align: center; border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
          <h1 style="color: #f97316; margin: 0;">Liga Ignition x Sharkania</h1>
        </div>
        <p style="font-size: 16px;">Hola <strong>${nickname}</strong>,</p>
        <div style="background-color: #18181b; border: 1px solid #333; border-radius: 8px; margin-top: 25px; padding: 20px;">
          <p style="color: #e4e4e7; font-size: 15px; line-height: 1.6; margin: 0;">${messageContent.replace(/\n/g, '<br/>')}</p>
        </div>
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; color: #666; font-size: 12px;">
          <p>Nos vemos en las mesas. ¡Mucho éxito!</p>
          <p>© ${new Date().getFullYear()} Sharkania Platform</p>
        </div>
      </div>
    `;
  };

  // ── ACCIONES A LA BASE DE DATOS ──
  const handleSendEmails = async () => {
    if (selectedIds.size === 0) return alert("Selecciona al menos un jugador.");
    if (!subject || !content) return alert("El asunto y el mensaje son obligatorios.");

    setIsSending(true);
    setMessage("");

    try {
      // 1. Preparamos a los jugadores seleccionados
      const selectedPlayers = players.filter(p => selectedIds.has(p.id) && p.email);

      // 2. Armamos el paquete para la cola de correos (Igual que en admin-broadcast)
      const queuePayload = selectedPlayers.map((u) => ({
        recipient_email: u.email,
        subject: subject,
        body_html: generatePasswordEmailHtml(u.display_name || u.ignition_nickname || "Jugador", content),
        status: "pending", 
        created_at: new Date().toISOString(),
      }));

      // 3. Insertamos en email_queue
      const { error: insertErr } = await supabase.from("email_queue").insert(queuePayload);
      if (insertErr) throw insertErr;

      // 4. Marcamos a los seleccionados como "Enviados" en tu base de datos
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ ignition_password_sent: true })
        .in('id', Array.from(selectedIds));

      if (updateErr) throw updateErr;

      setMessage(`✅ ¡Contraseña encolada exitosamente para ${selectedIds.size} jugadores!`);
      setSubject('');
      setContent('');
      setSelectedIds(new Set());
      await fetchPlayers(); // Recargamos la tabla para que pasen a "Ya Enviados"

    } catch (err: any) {
      console.error(err);
      setMessage(`❌ Error al enviar: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleWeeklyReset = async () => {
    if (!confirm("¿Estás seguro? Esto volverá a poner a TODOS los jugadores de Ignition como 'Pendiente' (No enviado). Úsalo solo cuando empiece una nueva fecha.")) return;

    setIsResetting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ignition_password_sent: false })
        .eq('ignition_league_player', true);

      if (error) throw error;
      
      setSelectedIds(new Set());
      setFilter('pending');
      await fetchPlayers();
      setMessage("🔄 ¡Reinicio semanal completado! Todos están listos para la nueva contraseña.");
    } catch (err) {
      console.error(err);
      setMessage("❌ Error al reiniciar los estados.");
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* ── PANEL DE REDACCIÓN DE CORREO ── */}
      <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 shadow-sm">
        <h3 className="text-sk-lg font-bold text-sk-text-1 mb-4 flex items-center gap-2">
          <Mail className="text-sk-accent" size={20} /> Enviar Contraseña (Ignition)
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-[11px] font-mono font-bold text-sk-text-3 uppercase mb-1.5">Asunto del Correo</label>
              <input 
                type="text" 
                placeholder="Ej: Contraseña Fecha 2 - Liga Ignition"
                className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 focus:border-sk-accent outline-none"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold text-sk-text-3 uppercase mb-1.5">Mensaje y Contraseña</label>
              <textarea 
                rows={4} 
                placeholder="Hola, la contraseña para el torneo de hoy es: TIBURON2026..."
                className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 focus:border-sk-accent outline-none"
                value={content}
                onChange={e => setContent(e.target.value)}
              />
            </div>
          </div>
          
          <div className="bg-sk-bg-3 border border-sk-border-2 rounded-lg p-5 flex flex-col justify-center">
            <p className="text-sk-sm text-sk-text-2 mb-4 text-center">
              Se enviará a <strong className="text-sk-text-1">{selectedIds.size} jugadores</strong> seleccionados en la tabla.
            </p>
            <Button 
              variant="accent" 
              className="w-full font-bold shadow-md shadow-sk-accent/20"
              onClick={handleSendEmails}
              disabled={isSending || selectedIds.size === 0}
            >
              {isSending ? <Spinner size="sm" className="mr-2" /> : <Send size={16} className="mr-2" />}
              {isSending ? "Enviando..." : "Enviar Contraseñas"}
            </Button>
            
            {message && (
              <div className={`mt-4 p-3 rounded text-[11px] font-bold text-center ${message.includes('❌') ? 'bg-sk-red-dim text-sk-red' : 'bg-sk-green-dim text-sk-green'}`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BARRA DE FILTROS Y RESET SEMANAL ── */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-sk-bg-1 p-4 rounded-lg border border-sk-border-2">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-sk-text-3 mr-2" />
          <Button variant={filter === 'pending' ? 'accent' : 'secondary'} size="sm" onClick={() => setFilter('pending')}>
            Falta Enviar ({players.filter(p => !p.ignition_password_sent).length})
          </Button>
          <Button variant={filter === 'sent' ? 'accent' : 'secondary'} size="sm" onClick={() => setFilter('sent')}>
            Ya Enviados ({players.filter(p => p.ignition_password_sent).length})
          </Button>
          <Button variant={filter === 'all' ? 'accent' : 'secondary'} size="sm" onClick={() => setFilter('all')}>
            Todos ({players.length})
          </Button>
        </div>

        <Button 
          variant="secondary" 
          size="sm" 
          className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
          onClick={handleWeeklyReset}
          disabled={isResetting}
        >
          {isResetting ? <Spinner size="sm" className="mr-2"/> : <RefreshCw size={14} className="mr-2" />}
          Reset Semanal (Nueva Fecha)
        </Button>
      </div>

      {/* ── TABLA DE JUGADORES ── */}
      <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sk-bg-3 border-b border-sk-border-2">
                <th className="p-4 w-12">
                  <button onClick={handleSelectAll} className="text-sk-text-3 hover:text-sk-accent transition-colors">
                    {selectedIds.size === filteredPlayers.length && filteredPlayers.length > 0 
                      ? <CheckCircle2 size={20} className="text-sk-accent" /> 
                      : <Circle size={20} />
                    }
                  </button>
                </th>
                <th className="p-4 text-[10px] font-mono font-bold uppercase tracking-widest text-sk-text-3">Jugador / Email</th>
                <th className="p-4 text-[10px] font-mono font-bold uppercase tracking-widest text-sk-text-3">Ignition Nickname</th>
                <th className="p-4 text-[10px] font-mono font-bold uppercase tracking-widest text-sk-text-3 text-center">Estado Contraseña</th>
                <th className="p-4 text-[10px] font-mono font-bold uppercase tracking-widest text-sk-text-3 text-right">Vinculado el</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-sk-text-3">
                    <AlertCircle size={32} className="mx-auto mb-3 opacity-50" />
                    No hay jugadores en este filtro.
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player) => {
                  const isSelected = selectedIds.has(player.id);
                  return (
                    <tr 
                      key={player.id} 
                      className={`transition-colors border-b border-sk-border-2/50 last:border-0 cursor-pointer ${isSelected ? 'bg-sk-accent/5' : 'hover:bg-sk-bg-3/50'}`}
                      onClick={() => toggleSelect(player.id)}
                    >
                      <td className="p-4">
                        {isSelected 
                          ? <CheckCircle2 size={20} className="text-sk-accent" /> 
                          : <Circle size={20} className="text-sk-text-4" />
                        }
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-bold text-sk-text-1">{player.display_name || player.ignition_nickname}</div>
                        <div className="text-xs text-sk-text-4 font-mono mt-0.5">{player.email}</div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          {player.ignition_nickname}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {player.ignition_password_sent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded bg-sk-green-dim text-sk-green border border-sk-green/20">
                            ✓ Enviada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded bg-sk-bg-4 text-sk-text-3 border border-sk-border-2">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-sk-text-3 text-right">
                        {new Date(player.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}