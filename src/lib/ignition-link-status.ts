import type { Profile } from "../types";

export type IgnitionFlowStatus = "linked" | "pending" | "needs-link";

/** Only the trusted profiles row can confirm an Ignition link. Never use editable user_metadata. */
export function ignitionFlowStatus(profile: Pick<Profile, "ignition_status" | "ignition_league_player"> | null | undefined): IgnitionFlowStatus {
  if (profile?.ignition_league_player === true && profile.ignition_status === "verified") return "linked";
  if (profile?.ignition_league_player === true && profile.ignition_status === "pending") return "pending";
  return "needs-link";
}

export const ignitionNotices: Record<IgnitionFlowStatus,{title:string;description:string}> = {
  linked: {
    title: "¡Tu cuenta Ignition ya está vinculada!",
    description: "No necesitas registrar ni vincular nuevamente tu cuenta. Puedes participar en la Liga SHARKANIA y optar a sus premios según las bases. Las contraseñas de cada fecha se comunicarán al correo confirmado de tu cuenta Sharkania durante el día del torneo, cuando la organización realice el envío. Revisa también la carpeta de spam.",
  },
  pending: {
    title: "Tu vinculación está en revisión",
    description: "Recibimos tu solicitud para vincular Ignition. Cuando tu correo esté confirmado y el equipo valide tu nickname, podrás recibir las contraseñas de la liga y optar a los premios según las bases. No es necesario enviar la misma solicitud otra vez.",
  },
  "needs-link": {
    title: "Vincula tu cuenta Ignition para participar en la Liga SHARKANIA",
    description: "Inicia el proceso ingresando aquí tu correo y nickname de Ignition. Sin una vinculación verificada, no recibirás por email las contraseñas de los torneos ni podrás optar a los premios bounty o a los premios finales del ranking de la Liga SHARKANIA. También debes cumplir las demás condiciones de las bases oficiales.",
  },
};
