import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { SEOHead } from "../components/seo/seo-head";

type VerificationState = "checking" | "verified" | "pending" | "unknown";

export default function WelcomePage() {
  const [status, setStatus] = useState<VerificationState>("checking");
  const [userName, setUserName] = useState("Jugador");

  useEffect(() => {
    let active = true;

    async function checkConfirmedEmail() {
      try {
        // A server-validated user response is required; local session presence
        // or simply visiting /welcome is not evidence of email confirmation.
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;

        if (error || !data.user) {
          setStatus("unknown");
          return;
        }

        if (!data.user.email_confirmed_at) {
          setStatus("pending");
          return;
        }

        const displayName = data.user.user_metadata?.display_name;
        if (typeof displayName === "string" && displayName.trim()) {
          setUserName(displayName.trim());
        }
        setStatus("verified");
      } catch {
        if (active) setStatus("unknown");
      }
    }

    void checkConfirmedEmail();
    return () => { active = false; };
  }, []);

  const verified = status === "verified";

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
      <SEOHead
        title="Confirmación de correo"
        description="Consulta el estado de confirmación de tu cuenta de Sharkania."
        path="/welcome"
        noIndex
      />
      <div className="max-w-md w-full bg-[#18181b] border border-white/10 rounded-2xl p-8 text-center shadow-2xl"
        data-auth-confirmation-state={status} aria-busy={status === "checking"}>
        <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-cyan-500/20">
          <span className="text-4xl" aria-hidden="true">🦈</span>
        </div>
        <div role="status" aria-live="polite">
          {status === "checking" && (
            <>
              <h1 className="text-3xl font-bold text-white mb-2">Verificando tu cuenta</h1>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Estamos comprobando con Sharkania si tu correo está confirmado.
              </p>
            </>
          )}
          {verified && (
            <>
              <h1 className="text-3xl font-bold text-white mb-2">¡Correo confirmado!</h1>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Bienvenido a la arena, <strong className="text-cyan-400">{userName}</strong>.
                Tu correo está confirmado y puedes continuar a tu panel.
              </p>
            </>
          )}
          {status === "pending" && (
            <>
              <h1 className="text-3xl font-bold text-white mb-2">Tu correo está pendiente</h1>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Esta cuenta aún no registra la confirmación de correo en Sharkania.
                Revisa el enlace que recibiste por email y vuelve a abrirlo para confirmar tu cuenta.
              </p>
            </>
          )}
          {status === "unknown" && (
            <>
              <h1 className="text-3xl font-bold text-white mb-2">No pudimos comprobar tu cuenta</h1>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                No encontramos una sesión válida con la que verificar tu correo.
                Si acabas de abrir el enlace de confirmación, inténtalo nuevamente
                desde el email o inicia sesión. No significa necesariamente que tu cuenta siga pendiente.
              </p>
            </>
          )}
        </div>
        {status !== "checking" && (
          <div className="flex flex-col gap-4">
            <Link
              to={verified ? "/dashboard" : "/login"}
              className="w-full bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold py-3 px-4 rounded-lg transition-colors duration-200"
            >
              {verified ? "Ir a mi Panel" : "Ir a Iniciar Sesión"}
            </Link>
            <Link
              to="/"
              className="w-full bg-transparent hover:bg-white/5 text-zinc-300 border border-zinc-700 font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
            >
              Volver al Inicio
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
