// src/components/admin/template-form.tsx
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";
import { X, Save } from "lucide-react";
import {
  type TournamentTemplate,
  type TemplateFormData,
  createTemplate,
  updateTemplate,
  DAY_LABELS,
} from "../../lib/api/tournament-templates";

interface TemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  clubId: string;
  template: TournamentTemplate | null; // null = create, object = edit
  leagueOptions: { id: string; name: string }[];
}

const GAME_TYPES = ["NLH", "PLO", "PLO5", "Mixed", "Other"] as const;
const TOURNAMENT_TYPES = ["MTT", "SNG", "Satellite", "Freeroll", "Bounty", "KO_Progressive"] as const;
const TIMEZONES = [
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "America/Sao_Paulo", label: "Brasil (São Paulo)" },
  { value: "America/Caracas", label: "Venezuela (Caracas)" },
  { value: "America/New_York", label: "US Eastern" },
  { value: "America/Los_Angeles", label: "US Pacific" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
];

export function TemplateForm({ isOpen, onClose, onSaved, clubId, template, leagueOptions }: TemplateFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [buyIn, setBuyIn] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [guaranteedPrize, setGuaranteedPrize] = useState("");
  const [lateRegMinutes, setLateRegMinutes] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [gameType, setGameType] = useState<string>("NLH");
  const [tournamentType, setTournamentType] = useState<string>("MTT");
  const [leagueId, setLeagueId] = useState("");
  const [defaultHour, setDefaultHour] = useState("22:00");
  const [defaultTimezone, setDefaultTimezone] = useState("America/Santiago");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Load poker rooms
  const { data: rooms } = useQuery({
    queryKey: ["poker-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("poker_rooms").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Populate form on edit
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description ?? "");
      setRoomId(template.room_id);
      setBuyIn(String(template.buy_in));
      setCurrency(template.currency);
      setGuaranteedPrize(template.guaranteed_prize ? String(template.guaranteed_prize) : "");
      setLateRegMinutes(template.late_registration_minutes ? String(template.late_registration_minutes) : "");
      setMaxPlayers(template.max_players ? String(template.max_players) : "");
      setGameType(template.game_type);
      setTournamentType(template.tournament_type);
      setLeagueId(template.league_id ?? "");
      setDefaultHour(template.default_hour.slice(0, 5)); // "22:00:00" → "22:00"
      setDefaultTimezone(template.default_timezone);
      setRecurrenceDays(template.recurrence_days ?? []);
      setIsActive(template.is_active);
    } else {
      // Reset for create
      setName("");
      setDescription("");
      setRoomId(rooms?.[0]?.id ?? "");
      setBuyIn("0");
      setCurrency("USD");
      setGuaranteedPrize("");
      setLateRegMinutes("30");
      setMaxPlayers("");
      setGameType("NLH");
      setTournamentType("MTT");
      setLeagueId("");
      setDefaultHour("22:00");
      setDefaultTimezone("America/Santiago");
      setRecurrenceDays([]);
      setIsActive(true);
    }
    setError(null);
  }, [template, rooms]);

  const toggleDay = (day: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    if (!roomId) { setError("Selecciona una sala."); return; }

    setSaving(true);
    setError(null);

    const formData: TemplateFormData = {
      name: name.trim(),
      description: description.trim() || undefined,
      room_id: roomId,
      buy_in: Number(buyIn) || 0,
      currency,
      guaranteed_prize: guaranteedPrize ? Number(guaranteedPrize) : null,
      late_registration_minutes: lateRegMinutes ? Number(lateRegMinutes) : null,
      max_players: maxPlayers ? Number(maxPlayers) : null,
      game_type: gameType,
      tournament_type: tournamentType,
      league_id: leagueId || null,
      default_hour: defaultHour,
      default_timezone: defaultTimezone,
      recurrence_days: recurrenceDays.length > 0 ? recurrenceDays : null,
      is_active: isActive,
    };

    try {
      if (template) {
        await updateTemplate(template.id, formData);
      } else {
        await createTemplate(clubId, formData);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent";
  const labelClass = "font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-3 mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-sk-bg-1 border border-sk-border-2 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-sk-border-2">
          <h2 className="text-sk-md font-bold text-sk-text-1">
            {template ? "Editar Plantilla" : "Nueva Plantilla de Torneo"}
          </h2>
          <button onClick={onClose} className="text-sk-text-2 hover:text-sk-text-1 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className={labelClass}>Nombre de la plantilla *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Freeroll Nocturno, $5.50 Freezeout..."
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Descripción</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional — detalles del torneo"
              className={inputClass}
            />
          </div>

          {/* Row: Room + Game Type + Tournament Type */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Sala *</label>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={inputClass}>
                <option value="">Seleccionar...</option>
                {(rooms ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Juego</label>
              <select value={gameType} onChange={(e) => setGameType(e.target.value)} className={inputClass}>
                {GAME_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Formato</label>
              <select value={tournamentType} onChange={(e) => setTournamentType(e.target.value)} className={inputClass}>
                {TOURNAMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Buy-in + Currency + GTD */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Buy-in</label>
              <input type="number" min="0" step="0.01" value={buyIn} onChange={(e) => setBuyIn(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Moneda</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                <option value="USD">USD</option>
                <option value="CLP">CLP</option>
                <option value="ARS">ARS</option>
                <option value="MXN">MXN</option>
                <option value="BRL">BRL</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Garantizado</label>
              <input type="number" min="0" step="1" value={guaranteedPrize} onChange={(e) => setGuaranteedPrize(e.target.value)} placeholder="Sin GTD" className={inputClass} />
            </div>
          </div>

          {/* Row: Late reg + Max players + League */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Late reg (min)</label>
              <input type="number" min="0" value={lateRegMinutes} onChange={(e) => setLateRegMinutes(e.target.value)} placeholder="30" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Máx. jugadores</label>
              <input type="number" min="0" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} placeholder="Sin límite" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Liga</label>
              <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} className={inputClass}>
                <option value="">Sin liga</option>
                {leagueOptions.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-sk-border-2 my-2" />

          {/* Schedule section */}
          <p className="font-mono text-[11px] font-bold tracking-[0.08em] uppercase text-sk-accent">Horario y recurrencia</p>

          {/* Row: Hour + Timezone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Hora default</label>
              <input type="time" value={defaultHour} onChange={(e) => setDefaultHour(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Zona horaria</label>
              <select value={defaultTimezone} onChange={(e) => setDefaultTimezone(e.target.value)} className={inputClass}>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Recurrence days */}
          <div>
            <label className={labelClass}>Días de repetición (opcional)</label>
            <p className="text-[11px] text-sk-text-4 mb-2">Si seleccionas días, podrás generar el calendario automáticamente.</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`w-10 h-10 rounded-md text-sk-xs font-bold transition-all ${
                    recurrenceDays.includes(day)
                      ? "bg-sk-accent text-sk-bg-0"
                      : "bg-sk-bg-3 border border-sk-border-2 text-sk-text-3 hover:border-sk-border-3"
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`relative w-9 h-5 rounded-full transition-colors ${
                isActive ? "bg-sk-accent" : "bg-sk-bg-4"
              }`}
              onClick={() => setIsActive(!isActive)}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  isActive ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-sk-sm text-sk-text-2">Plantilla activa</span>
          </label>

          {/* Error */}
          {error && (
            <div className="bg-sk-red-dim border border-sk-red/20 rounded-md p-3">
              <p className="text-sk-xs text-sk-red">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-sk-border-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" size="sm" onClick={handleSave} isLoading={saving}>
            <Save size={14} /> {template ? "Guardar Cambios" : "Crear Plantilla"}
          </Button>
        </div>
      </div>
    </div>
  );
}
