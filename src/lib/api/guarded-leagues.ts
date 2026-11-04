import { supabase } from "../supabase";

/**
 * League membership security cutover is NOT deployed.
 *
 * Keep this OFF until the coordinated league RLS/GRANT proposal is installed
 * on a non-production Supabase QA instance and league create/duplicate/admin
 * pages are migrated. A frontend flag is not a permission boundary.
 */
export const GUARDED_LEAGUE_RPC_ENABLED =
  import.meta.env.VITE_LEAGUE_GUARDED_RPC === "true";

const UUID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function assertGuardedLeagueEnabled() {
  if (!GUARDED_LEAGUE_RPC_ENABLED) {
    throw new Error(
      "La administración protegida de ligas todavía no está habilitada.",
    );
  }
}

function requireUuid(id: string, label: string) {
  if (!UUID_PATTERN.test(id)) {
    throw new Error(`Identificador inválido: ${label}.`);
  }
  return id;
}

/** Create the league and primary club association atomically on the server. */
export async function createLeagueGuarded(input: {
  primaryClubId: string;
  name: string;
  slug: string;
}): Promise<string> {
  assertGuardedLeagueEnabled();
  const primaryClubId = requireUuid(input.primaryClubId, "club organizador");
  const name = input.name.trim();
  const slug = input.slug.trim();
  if (name.length < 3 || name.length > 150 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) {
    throw new Error("Nombre o URL de liga inválidos.");
  }

  const { data, error } = await supabase.rpc("create_league_guarded", {
    p_primary_club_id: primaryClubId,
    p_name: name,
    p_slug: slug,
  });
  if (error) {
    throw new Error("No se pudo crear la liga. Verifica permisos y URL.");
  }
  if (typeof data !== "string" || !UUID_PATTERN.test(data)) {
    throw new Error("La creación no devolvió un identificador válido.");
  }
  return data;
}

export interface GuardedLeagueFormFields {
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  rules_url: string | null;
  total_dates: number | null;
  best_dates_to_count: number | null;
  status: "upcoming" | "active" | "finished";
}

/**
 * Save the league metadata, primary organizer and full room list in ONE RPC.
 * No automatic fallback to the old three-call browser sequence.
 */
export async function saveLeagueGuarded(input: {
  leagueId: string | null;
  primaryClubId: string;
  name: string;
  slug: string;
  fields: GuardedLeagueFormFields;
  roomIds: readonly string[];
}): Promise<string> {
  assertGuardedLeagueEnabled();
  const clubId = requireUuid(input.primaryClubId, "club principal");
  const leagueId = input.leagueId ? requireUuid(input.leagueId, "liga") : null;
  const name = input.name.trim();
  const slug = input.slug.trim();
  if (name.length < 3 || name.length > 150 ||
      slug.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Nombre o URL de liga inválidos.");
  }
  if (input.roomIds.length > 32 ||
      input.roomIds.some((id) => !UUID_PATTERN.test(id)) ||
      new Set(input.roomIds).size !== input.roomIds.length) {
    throw new Error("Salas duplicadas o inválidas.");
  }
  const { data, error } = await supabase.rpc("save_league_guarded", {
    p_league_id: leagueId,
    p_primary_club_id: clubId,
    p_name: name,
    p_slug: slug,
    p_fields: input.fields,
    p_room_ids: [...input.roomIds],
  });
  if (error) {
    if (error.code === "PT409" || error.code === "23505") {
      throw new Error("Ya existe una liga con esa URL o se produjo un conflicto de edición.");
    }
    if (error.code === "42501") {
      throw new Error("No tienes autorización sobre el club organizador de esta liga.");
    }
    throw new Error("No se pudo guardar la liga en una sola operación. No se aplicaron cambios parciales.");
  }
  if (typeof data !== "string" || !UUID_PATTERN.test(data)) {
    throw new Error("Respuesta inesperada del servidor. Revisa la liga antes de reintentar.");
  }
  return data;
}

/**
 * Clone settings and room associations atomically, but NOT membership of
 * secondary clubs. New secondary clubs must independently be authorized.
 */
export async function duplicateLeagueGuarded(
  sourceLeagueId: string,
  name: string,
  slug: string,
): Promise<string> {
  assertGuardedLeagueEnabled();
  const source = requireUuid(sourceLeagueId, "liga de origen");
  const cleanName = name.trim();
  const cleanSlug = slug.trim();
  if (cleanName.length < 3 || cleanName.length > 150 ||
      cleanSlug.length > 160 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
    throw new Error("Nombre o URL de la liga duplicada inválidos.");
  }
  const { data, error } = await supabase.rpc("duplicate_league_guarded", {
    p_source_league_id: source,
    p_new_name: cleanName,
    p_new_slug: cleanSlug,
  });
  if (error) {
    throw new Error("No se pudo duplicar la liga. Comprueba la propiedad, los permisos y la URL.");
  }
  if (typeof data !== "string" || !UUID_PATTERN.test(data)) {
    throw new Error("La duplicación no devolvió un identificador válido. Verifica el estado antes de reintentar.");
  }
  return data;
}

/**
 * Coordinated membership requires a superadmin or a user who administers
 * BOTH the organizer and the new club. General invitation is a later feature.
 */
export async function addLeagueClubGuarded(
  leagueId: string,
  clubId: string,
): Promise<boolean> {
  assertGuardedLeagueEnabled();
  const { data, error } = await supabase.rpc("add_league_club_guarded", {
    p_league_id: requireUuid(leagueId, "liga"),
    p_club_id: requireUuid(clubId, "club"),
  });
  if (error || typeof data !== "boolean") {
    throw new Error("No se autorizó vincular este club con la liga.");
  }
  return data;
}

/** Replace the complete room selection in one atomic authorized operation. */
export async function setLeagueRoomsGuarded(
  leagueId: string,
  roomIds: readonly string[],
): Promise<number> {
  assertGuardedLeagueEnabled();
  requireUuid(leagueId, "liga");
  if (roomIds.length > 32 || roomIds.some((id) => !UUID_PATTERN.test(id)) ||
      new Set(roomIds).size !== roomIds.length) {
    throw new Error("La selección de salas contiene identificadores inválidos.");
  }
  const { data, error } = await supabase.rpc("set_league_rooms_guarded", {
    p_league_id: leagueId,
    p_room_ids: [...roomIds],
  });
  if (error || !Number.isSafeInteger(data) || data !== roomIds.length) {
    throw new Error("No se pudo guardar la selección de salas de la liga.");
  }
  return data;
}
