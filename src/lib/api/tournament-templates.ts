// src/lib/api/tournament-templates.ts
import { supabase } from "../supabase";

export interface TournamentTemplate {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  room_id: string;
  buy_in: number;
  currency: string;
  guaranteed_prize: number | null;
  late_registration_minutes: number | null;
  max_players: number | null;
  game_type: string;
  tournament_type: string;
  league_id: string | null;
  default_hour: string;       // "22:00"
  default_timezone: string;
  recurrence_days: number[] | null;  // [0=dom, 1=lun, ..., 6=sáb]
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joins
  poker_rooms?: { name: string };
  leagues?: { id: string; name: string } | null;
}

export interface TemplateFormData {
  name: string;
  description?: string;
  room_id: string;
  buy_in: number;
  currency: string;
  guaranteed_prize?: number | null;
  late_registration_minutes?: number | null;
  max_players?: number | null;
  game_type: string;
  tournament_type: string;
  league_id?: string | null;
  default_hour: string;
  default_timezone: string;
  recurrence_days?: number[] | null;
  is_active: boolean;
  sort_order?: number;
}

// ── CRUD ─────────────────────────────────────────────────

export async function getTemplatesByClub(clubId: string): Promise<TournamentTemplate[]> {
  const { data, error } = await supabase
    .from("tournament_templates")
    .select("*, poker_rooms(name), leagues(id, name)")
    .eq("club_id", clubId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data as TournamentTemplate[];
}

export async function createTemplate(
  clubId: string,
  formData: TemplateFormData
): Promise<TournamentTemplate> {
  const { data, error } = await supabase
    .from("tournament_templates")
    .insert({ club_id: clubId, ...formData })
    .select("*, poker_rooms(name), leagues(id, name)")
    .single();

  if (error) throw error;
  return data as TournamentTemplate;
}

export async function updateTemplate(
  id: string,
  formData: Partial<TemplateFormData>
): Promise<TournamentTemplate> {
  const { data, error } = await supabase
    .from("tournament_templates")
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, poker_rooms(name), leagues(id, name)")
    .single();

  if (error) throw error;
  return data as TournamentTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("tournament_templates")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function toggleTemplateActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("tournament_templates")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// ── Tournament creation from template ────────────────────

export async function createTournamentFromTemplate(
  templateId: string,
  startDatetime: string,
  overrides?: {
    name?: string;
    buy_in?: number;
    guaranteed_prize?: number;
  }
): Promise<string> {
  const { data, error } = await supabase.rpc("create_tournament_from_template", {
    p_template_id: templateId,
    p_start_datetime: startDatetime,
    p_name_override: overrides?.name ?? null,
    p_buy_in_override: overrides?.buy_in ?? null,
    p_guaranteed_override: overrides?.guaranteed_prize ?? null,
  });

  if (error) throw error;
  return data as string;
}

// ── Calendar generation ──────────────────────────────────

export async function generateCalendar(
  clubId: string,
  daysAhead: number = 30
): Promise<number> {
  const { data, error } = await supabase.rpc("generate_calendar_from_templates", {
    p_club_id: clubId,
    p_days_ahead: daysAhead,
  });

  if (error) throw error;
  return data as number;
}

// ── CSV calendar import ──────────────────────────────────

export interface CSVCalendarRow {
  template_name: string;
  date: string;       // YYYY-MM-DD
  time?: string;      // HH:mm (optional, uses template default)
  name_override?: string;
  buy_in_override?: string;
  guaranteed_override?: string;
}

export async function importCalendarFromCSV(
  clubId: string,
  rows: CSVCalendarRow[],
  templates: TournamentTemplate[]
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // +2 for header + 0-index

    // Find template by name (case-insensitive)
    const template = templates.find(
      (t) => t.name.toLowerCase().trim() === row.template_name.toLowerCase().trim()
    );

    if (!template) {
      errors.push(`Línea ${lineNum}: plantilla "${row.template_name}" no encontrada`);
      continue;
    }

    // Build datetime
    const time = row.time?.trim() || template.default_hour;
    const dateStr = `${row.date.trim()}T${time}:00`;

    // Validate date
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) {
      errors.push(`Línea ${lineNum}: fecha/hora inválida "${row.date} ${time}"`);
      continue;
    }

    try {
      await createTournamentFromTemplate(template.id, dt.toISOString(), {
        name: row.name_override?.trim() || undefined,
        buy_in: row.buy_in_override ? Number(row.buy_in_override) : undefined,
        guaranteed_prize: row.guaranteed_override ? Number(row.guaranteed_override) : undefined,
      });
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      errors.push(`Línea ${lineNum}: ${msg}`);
    }
  }

  return { created, errors };
}

// ── Day labels helper ────────────────────────────────────

export const DAY_LABELS: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

export const DAY_LABELS_FULL: Record<number, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};
