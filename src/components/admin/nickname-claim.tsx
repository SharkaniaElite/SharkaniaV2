// src/components/admin/nickname-claim.tsx
import { useState, useRef, useEffect } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Modal } from "../ui/modal";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth-store";
import { cn } from "../../lib/cn";
import { Search, Upload, X, Plus } from "lucide-react";
import type { Player } from "../../types";

interface NicknameClaimProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimed: () => void;
}

interface SearchResult extends Player {
  poker_rooms: { name: string };
}

export function NicknameClaim({ isOpen, onClose, onClaimed }: NicknameClaimProps) {
  const { user } = useAuthStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<SearchResult[]>([]);
  const [whatsapp, setWhatsapp] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Búsqueda en vivo con debounce de 300ms
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("players")
        .select("*, poker_rooms(name)")
        .ilike("nickname", `%${query}%`)
        .limit(10);
      setResults((data as SearchResult[]) ?? []);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const addPlayer = (player: SearchResult) => {
    if (selectedPlayers.some((p) => p.id === player.id)) return;
    setSelectedPlayers([...selectedPlayers, player]);
    setQuery("");
    setResults([]);
  };

  const removePlayer = (playerId: string) => {
    setSelectedPlayers(selectedPlayers.filter((p) => p.id !== playerId));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // 1. Validar tamaño (200 KB)
    const MAX_SIZE = 200 * 1024;
    if (file.size > MAX_SIZE) {
      setMessage({ 
        text: "⚠️ La imagen supera los 200 KB. Por favor redúcela antes de subirla.", 
        type: "error" 
      });
      e.target.value = "";
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const ext = file.name.split(".").pop();
      // Guardamos en el bucket nickverify, carpeta con ID del usuario
      const path = `${user.id}/${Date.now()}.${ext}`;

      // 2. Subida al bucket nickverify
      const { error: uploadError } = await supabase.storage
        .from("nickverify")
        .upload(path, file);

      if (uploadError) throw uploadError;

      // 3. Obtener URL Pública para que el Admin pueda verla
      const { data: urlData } = supabase.storage
        .from("nickverify")
        .getPublicUrl(path);

      setScreenshotUrl(urlData.publicUrl);
    } catch (err) {
      console.error("Error subiendo archivo:", err);
      setMessage({ text: "Error al subir la imagen a nickverify", type: "error" });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (selectedPlayers.length === 0) {
      setMessage({ text: "Selecciona al menos un nickname para reclamar", type: "error" });
      return;
    }
    if (!whatsapp.trim()) {
      setMessage({ text: "WhatsApp es obligatorio", type: "error" });
      return;
    }
    if (!screenshotUrl) {
      setMessage({ text: "Debes subir un screenshot como prueba", type: "error" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      // Actualizamos el WhatsApp en el perfil
      await supabase.from("profiles").update({ whatsapp: whatsapp.trim() }).eq("id", user.id);

      // Creamos los reclamos con la URL pública que obtuvimos en handleFileUpload
      const claims = selectedPlayers.map((p) => ({
        user_id: user.id,
        player_id: p.id,
        screenshot_url: screenshotUrl, // Esta ya es la URL pública de nickverify
        status: "pending" as const,
      }));

      const { error } = await supabase.from("nickname_claims").insert(claims);
      if (error) throw error;

      setMessage({
        text: `✅ Solicitud enviada. Un administrador revisará la captura en nickverify.`,
        type: "success",
      });

      setTimeout(() => {
        onClaimed();
        onClose();
      }, 2500);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Error al enviar", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent";
  const labelClass = "font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reclamar Nickname" className="max-w-lg">
      <div className="space-y-4">
        <p className="text-sk-sm text-sk-text-2">
          Busca tu nickname en el sistema. Puedes reclamar nicknames de distintas salas. Un admin revisará tu solicitud.
        </p>

        {/* Search — en vivo */}
        <div>
          <label className={labelClass}>Buscar Nickname</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sk-text-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe tu nickname..."
              className={`${inputClass} pl-9 pr-9`}
              autoComplete="off"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-3.5 h-3.5 border-2 border-sk-accent/30 border-t-sk-accent rounded-full animate-spin" />
              </div>
            )}
            {query && !searching && (
              <button
                onClick={() => { setQuery(""); setResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sk-text-3 hover:text-sk-text-1 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {query.length === 1 && (
            <p className="text-[11px] text-sk-text-3 mt-1">Escribe al menos 2 caracteres...</p>
          )}
        </div>

        {/* Resultados en vivo */}
        {results.length > 0 && (
          <div className="border border-sk-border-2 rounded-md overflow-hidden max-h-48 overflow-y-auto">
            {results.map((p) => {
              const isSelected = selectedPlayers.some((sp) => sp.id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => addPlayer(p)}
                  disabled={isSelected}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-left border-b border-sk-border-2 last:border-b-0 transition-colors",
                    isSelected ? "bg-sk-accent-dim opacity-60" : "hover:bg-white/[0.03]"
                  )}
                >
                  <div>
                    <p className="text-sk-sm font-semibold text-sk-text-1">{p.nickname}</p>
                    <p className="text-[11px] text-sk-text-2">{p.poker_rooms?.name ?? "—"}</p>
                  </div>
                  {isSelected ? (
                    <Badge variant="accent">Seleccionado</Badge>
                  ) : (
                    <Plus size={14} className="text-sk-text-3" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Sin resultados */}
        {query.length >= 2 && !searching && results.length === 0 && (
          <p className="text-[11px] text-sk-text-3 text-center py-2">
            No se encontraron nicknames para "{query}"
          </p>
        )}

        {/* Nicknames seleccionados */}
        {selectedPlayers.length > 0 && (
          <div>
            <label className={labelClass}>Nicknames a Reclamar ({selectedPlayers.length})</label>
            <div className="space-y-2">
              {selectedPlayers.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-sk-bg-3 rounded-md px-3 py-2">
                  <div>
                    <span className="text-sk-sm font-semibold text-sk-text-1">{p.nickname}</span>
                    <span className="text-[11px] text-sk-text-2 ml-2">({p.poker_rooms?.name})</span>
                  </div>
                  <button onClick={() => removePlayer(p.id)} className="text-sk-text-3 hover:text-sk-red transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WhatsApp */}
        <div>
          <label className={labelClass}>WhatsApp *</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={inputClass}
            placeholder="+56 9 1234 5678"
          />
        </div>

        {/* Screenshot */}
        <div>
          <label className={labelClass}>Screenshot de la Sala *</label>
          <p className="text-[11px] text-sk-text-2 mb-2">
            Sube una captura de pantalla de la sala mostrando tu cuenta y nickname.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          {screenshotUrl ? (
            <div className="flex items-center gap-2 bg-sk-green-dim border border-sk-green/20 rounded-md p-3">
              <Badge variant="green">✓ Archivo subido</Badge>
              <button onClick={() => setScreenshotUrl("")} className="text-sk-text-3 hover:text-sk-red ml-auto">
                <X size={14} />
              </button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} isLoading={uploading}>
              <Upload size={14} /> Subir Screenshot
            </Button>
          )}
        </div>

        {/* Mensaje */}
        {message && (
          <div className={cn(
            "rounded-md p-3 text-sk-sm",
            message.type === "success"
              ? "bg-sk-green-dim border border-sk-green/20 text-sk-green"
              : "bg-sk-red-dim border border-sk-red/20 text-sk-red"
          )}>
            {message.text}
          </div>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" size="sm" onClick={handleSubmit} isLoading={submitting}>
            Enviar Solicitud
          </Button>
        </div>
      </div>
    </Modal>
  );
}
