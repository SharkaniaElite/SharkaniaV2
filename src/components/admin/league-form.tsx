// src/components/admin/league-form.tsx
import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { supabase } from "../../lib/supabase";
import { usePokerRooms } from "../../hooks/use-clubs";
import type { League } from "../../types";

interface LeagueFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  clubId: string;
  league?: League | null;
}

export function LeagueForm({ isOpen, onClose, onSaved, clubId, league }: LeagueFormProps) {
  const { data: rooms } = usePokerRooms();
  const isEdit = !!league;

  const [form, setForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    rules_url: "",
    room_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (league) {
      setForm({
        name: league.name,
        description: league.description ?? "",
        start_date: league.start_date ?? "",
        end_date: league.end_date ?? "",
        rules_url: league.rules_url ?? "",
        room_ids: [],
      });
      // Load existing rooms
      supabase
        .from("league_rooms")
        .select("room_id")
        .eq("league_id", league.id)
        .then(({ data }) => {
          if (data) setForm((prev) => ({ ...prev, room_ids: data.map((r) => r.room_id) }));
        });
    } else {
      setForm({ name: "", description: "", start_date: "", end_date: "", rules_url: "", room_ids: [] });
    }
  }, [league, isOpen]);

  const update = (field: string, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleRoom = (roomId: string) => {
    setForm((prev) => ({
      ...prev,
      room_ids: prev.room_ids.includes(roomId)
        ? prev.room_ids.filter((r) => r !== roomId)
        : [...prev.room_ids, roomId],
    }));
  };

  const handleSave = async () => {
    if (!form.name) {
      setError("Nombre es obligatorio");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        rules_url: form.rules_url || null,
        status: "upcoming" as const,
      };

      let leagueId: string;

      if (isEdit && league) {
        const { error: err } = await supabase.from("leagues").update(payload).eq("id", league.id);
        if (err) throw err;
        leagueId = league.id;

        // Update rooms
        await supabase.from("league_rooms").delete().eq("league_id", leagueId);
      } else {
        const { data, error: err } = await supabase.from("leagues").insert(payload).select("id").single();
        if (err) throw err;
        leagueId = data.id;

        // Link club as primary
        await supabase.from("league_clubs").insert({
          league_id: leagueId,
          club_id: clubId,
          is_primary: true,
        });
      }

      // Insert rooms
      if (form.room_ids.length > 0) {
        await supabase.from("league_rooms").insert(
          form.room_ids.map((room_id) => ({ league_id: leagueId, room_id }))
        );
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent";
  const labelClass = "font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Editar Liga" : "Crear Liga"}>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Nombre *</label>
          <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} placeholder="Copa LATAM Season 3" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Fecha Inicio</label>
            <input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Fecha Fin</label>
            <input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Salas</label>
          <div className="flex flex-wrap gap-2">
            {rooms?.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRoom(r.id)}
                className={`text-sk-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  form.room_ids.includes(r.id)
                    ? "bg-sk-accent-dim border-sk-accent text-sk-accent"
                    : "bg-sk-bg-3 border-sk-border-2 text-sk-text-2 hover:border-sk-border-3"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>URL de Reglas</label>
          <input type="url" value={form.rules_url} onChange={(e) => update("rules_url", e.target.value)} className={inputClass} placeholder="https://..." />
        </div>

        <div>
          <label className={labelClass}>Descripción</label>
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} className={`${inputClass} min-h-[60px] resize-y`} placeholder="Descripción de la liga..." />
        </div>

        {error && <div className="bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" size="sm" onClick={handleSave} isLoading={saving}>{isEdit ? "Guardar" : "Crear Liga"}</Button>
        </div>
      </div>
    </Modal>
  );
}
