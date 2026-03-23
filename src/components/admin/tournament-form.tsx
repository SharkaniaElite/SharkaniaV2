// src/components/admin/tournament-form.tsx
import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { supabase } from "../../lib/supabase";
import { usePokerRooms } from "../../hooks/use-clubs";
import type { Tournament } from "../../types";

interface TournamentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  clubId: string;
  tournament?: Tournament | null;
  leagueOptions?: Array<{ id: string; name: string }>;
}

// Monedas disponibles: globales + todas las latinoamericanas relevantes
const CURRENCIES = [
  { value: "USD", label: "USD — Dólar estadounidense" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "ARS", label: "ARS — Peso argentino" },
  { value: "BOB", label: "BOB — Boliviano" },
  { value: "BRL", label: "BRL — Real brasileño" },
  { value: "CLP", label: "CLP — Peso chileno" },
  { value: "COP", label: "COP — Peso colombiano" },
  { value: "CRC", label: "CRC — Colón costarricense" },
  { value: "CUP", label: "CUP — Peso cubano" },
  { value: "DOP", label: "DOP — Peso dominicano" },
  { value: "GTQ", label: "GTQ — Quetzal guatemalteco" },
  { value: "HNL", label: "HNL — Lempira hondureño" },
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "NIO", label: "NIO — Córdoba nicaragüense" },
  { value: "PAB", label: "PAB — Balboa panameño" },
  { value: "PEN", label: "PEN — Sol peruano" },
  { value: "PYG", label: "PYG — Guaraní paraguayo" },
  { value: "UYU", label: "UYU — Peso uruguayo" },
  { value: "VES", label: "VES — Bolívar venezolano" },
] as const;

export function TournamentForm({
  isOpen,
  onClose,
  onSaved,
  clubId,
  tournament,
  leagueOptions = [],
}: TournamentFormProps) {
  const { data: rooms } = usePokerRooms();
  const isEdit = !!tournament;

  const [form, setForm] = useState({
    name: "",
    description: "",
    room_id: "",
    league_id: "",
    buy_in: 0,
    currency: "USD",
    guaranteed_prize: 0,
    start_datetime: "",
    timezone: "America/Santiago",
    late_registration_minutes: 30,
    max_players: 0,
    game_type: "NLH" as const,
    tournament_type: "MTT" as const,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tournament) {
      setForm({
        name: tournament.name,
        description: tournament.description ?? "",
        room_id: tournament.room_id,
        league_id: tournament.league_id ?? "",
        buy_in: tournament.buy_in,
        currency: tournament.currency,
        guaranteed_prize: tournament.guaranteed_prize ?? 0,
        start_datetime: tournament.start_datetime.slice(0, 16),
        timezone: tournament.timezone,
        late_registration_minutes: tournament.late_registration_minutes ?? 30,
        max_players: tournament.max_players ?? 0,
        game_type: tournament.game_type,
        tournament_type: tournament.tournament_type,
      });
    } else {
      setForm({
        name: "", description: "", room_id: rooms?.[0]?.id ?? "", league_id: "",
        buy_in: 0, currency: "USD", guaranteed_prize: 0, start_datetime: "",
        timezone: "America/Santiago", late_registration_minutes: 30, max_players: 0,
        game_type: "NLH", tournament_type: "MTT",
      });
    }
  }, [tournament, rooms, isOpen]);

  const update = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name || !form.room_id || !form.start_datetime) {
      setError("Nombre, sala y fecha son obligatorios");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      club_id: clubId,
      name: form.name,
      description: form.description || null,
      room_id: form.room_id,
      league_id: form.league_id || null,
      buy_in: form.buy_in,
      currency: form.currency,
      guaranteed_prize: form.guaranteed_prize || null,
      start_datetime: new Date(form.start_datetime).toISOString(),
      timezone: form.timezone,
      late_registration_minutes: form.late_registration_minutes || null,
      max_players: form.max_players || null,
      game_type: form.game_type,
      tournament_type: form.tournament_type,
      status: "scheduled" as const,
    };

    try {
      if (isEdit && tournament) {
        const { error: err } = await supabase
          .from("tournaments")
          .update(payload)
          .eq("id", tournament.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("tournaments")
          .insert(payload);
        if (err) throw err;
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
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Editar Torneo" : "Crear Torneo"} className="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Nombre *</label>
          <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} placeholder="Sunday Million 🦈" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Sala *</label>
            <select value={form.room_id} onChange={(e) => update("room_id", e.target.value)} className={inputClass}>
              <option value="">Seleccionar</option>
              {rooms?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Liga (opcional)</label>
            <select value={form.league_id} onChange={(e) => update("league_id", e.target.value)} className={inputClass}>
              <option value="">Sin liga</option>
              {leagueOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Fecha y Hora *</label>
          <input type="datetime-local" value={form.start_datetime} onChange={(e) => update("start_datetime", e.target.value)} className={inputClass} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Buy-in</label>
            <input type="number" value={form.buy_in || ""} onChange={(e) => update("buy_in", Number(e.target.value))} className={inputClass} placeholder="0" min={0} />
          </div>
          <div>
            <label className={labelClass}>GTD Prize</label>
            <input type="number" value={form.guaranteed_prize || ""} onChange={(e) => update("guaranteed_prize", Number(e.target.value))} className={inputClass} placeholder="0" min={0} />
          </div>
          <div>
            <label className={labelClass}>Moneda</label>
            <select value={form.currency} onChange={(e) => update("currency", e.target.value)} className={inputClass}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tipo de Juego</label>
            <select value={form.game_type} onChange={(e) => update("game_type", e.target.value)} className={inputClass}>
              {["NLH", "PLO", "PLO5", "Mixed", "Other"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tipo de Torneo</label>
            <select value={form.tournament_type} onChange={(e) => update("tournament_type", e.target.value)} className={inputClass}>
              {["MTT", "SNG", "Satellite", "Freeroll", "Bounty", "KO_Progressive"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Late Reg (min)</label>
            <input type="number" value={form.late_registration_minutes || ""} onChange={(e) => update("late_registration_minutes", Number(e.target.value))} className={inputClass} placeholder="30" min={0} />
          </div>
          <div>
            <label className={labelClass}>Max Jugadores</label>
            <input type="number" value={form.max_players || ""} onChange={(e) => update("max_players", Number(e.target.value))} className={inputClass} placeholder="Ilimitado" min={0} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Descripción</label>
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} className={`${inputClass} min-h-[60px] resize-y`} placeholder="Opcional..." />
        </div>

        {error && (
          <div className="bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" size="sm" onClick={handleSave} isLoading={saving}>
            {isEdit ? "Guardar Cambios" : "Crear Torneo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}