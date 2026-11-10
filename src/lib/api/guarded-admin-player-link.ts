import { supabase } from "../supabase";
import { GUARDED_INDEPENDENT_RESULTS_RPC_ENABLED } from "./guarded-independent-results";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Replaces direct players.profile_id UPDATE when the full guarded cutover is active. */
export async function adminLinkPlayerGuarded(
  playerId: string,
  profileId: string | null,
  claimId: string | null = null,
): Promise<void> {
  if (!GUARDED_INDEPENDENT_RESULTS_RPC_ENABLED) {
    throw new Error("La vinculación protegida no está habilitada.");
  }
  if (!UUID.test(playerId) || (profileId !== null && !UUID.test(profileId)) ||
    (claimId !== null && !UUID.test(claimId))) {
    throw new Error("Identificador de jugador, perfil o solicitud inválido.");
  }

  const { data, error } = await supabase.rpc("admin_link_player_profile_guarded", {
    p_player_id: playerId,
    p_profile_id: profileId,
    p_claim_id: claimId,
  });
  if (error) {
    if (error.code === "42501") {
      throw new Error("Solo el superadministrador puede vincular nicknames.");
    }
    if (error.code === "PT409") {
      throw new Error("El nickname ya está vinculado a otro perfil o la solicitud cambió de estado.");
    }
    throw new Error("No se confirmó la vinculación. Verifica el perfil antes de reintentar.");
  }
  const receipt = data as Record<string, unknown> | null;
  if (!receipt || (receipt.status !== "linked" && receipt.status !== "unlinked")) {
    throw new Error("El servidor no confirmó la vinculación.");
  }
  // Never fall back to players.update or separate claim UPDATE on RPC errors.
}
