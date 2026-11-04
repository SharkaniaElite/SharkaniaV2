import { supabase } from "../supabase";

/**
 * Server-side ELO cutover is deliberately OFF until the SQL proposal,
 * role grants, full Supabase QA, and the admin re-edit flow all pass.
 * Setting the flag alone never installs the RPC or relaxes row permissions.
 * On any RPC failure we fail closed: NO fallback to client-side writes.
 */
export const GUARDED_ELO_RPC_ENABLED = import.meta.env.VITE_ELO_GUARDED_RPC === "true";

type GuardedEloResult = {
  success: true;
  already_processed: boolean;
  tournament_id: string;
  players_processed?: number;
};

export async function calculateEloThroughGuardedRpc(
  tournamentId: string,
): Promise<{ success: boolean; message: string }> {
  if (!GUARDED_ELO_RPC_ENABLED) {
    return { success: false, message: "El cálculo ELO protegido todavía no está activado." };
  }

  try {
    const { data, error } = await supabase.rpc("calculate_tournament_elo_guarded", {
      p_tournament_id: tournamentId,
    });

    if (error) {
      return {
        success: false,
        message: "Falló el cálculo ELO protegido. Verifica el torneo en administración antes de reintentar.",
      };
    }

    const result = data as Partial<GuardedEloResult> | null;
    if (!result || result.success !== true || result.tournament_id !== tournamentId) {
      return {
        success: false,
        message: "Respuesta inválida del motor ELO protegido. Revisa el estado del torneo.",
      };
    }

    if (result.already_processed === true) {
      return { success: true, message: "Este torneo ya tenía su ELO calculado; no se duplicaron estadísticas." };
    }
    if (result.already_processed !== false ||
        !Number.isSafeInteger(result.players_processed) ||
        (result.players_processed ?? 0) < 2) {
      return { success: false, message: "La respuesta del motor ELO no confirmó los jugadores procesados." };
    }
    return { success: true, message: `ELO calculado en el servidor para ${result.players_processed} jugadores.` };
  } catch {
    return {
      success: false,
      message: "El motor ELO protegido no está disponible. No se ejecutó el cálculo alternativo desde el navegador.",
    };
  }
}
