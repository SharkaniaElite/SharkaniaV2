// src/pages/update-password.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Lock, CheckCircle2 } from "lucide-react";
import { ArenaAuthFrame } from "../components/arena/arena-auth-frame";
import { isArenaPreviewAuthBlocked } from "../lib/arena-preview";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabase"; // 👈 Importado
import { translateAuthError } from "../lib/format"; // 👈 Importado

export function UpdatePasswordPage() {
  const previewBlocked = isArenaPreviewAuthBlocked();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewBlocked) return;
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Actualizamos la contraseña
      const { data, error: updateError } = await supabase.auth.updateUser({ 
        password: password 
      });
      
      if (updateError) throw updateError;

      // 2. Intentamos enviar el correo de confirmación
      // Si falla este paso, no bloqueamos el éxito del usuario
      const userEmail = data?.user?.email;
      if (userEmail) {
        try {
          await supabase.from("email_queue").insert({
            recipient_email: userEmail,
            subject: "Tu contraseña ha sido actualizada - Sharkania",
            body_html: `
              <div style="font-family:sans-serif;padding:20px;color:#333;">
                <h2 style="color:#10b981;">¡Seguridad actualizada!</h2>
                <p>Te informamos que la contraseña de tu cuenta ha sido cambiada con éxito.</p>
                <p>Si tú realizaste este cambio, no necesitas hacer nada más.</p>
              </div>
            `
          });
          fetch("https://sharkania-email-worker.duhauandres.workers.dev/").catch(() => {});
        } catch (dbErr) {
          console.error("Error al encolar correo de confirmación:", dbErr);
        }
      }

      setSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "";
      setError(translateAuthError(rawMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3 text-sk-sm text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent transition-colors";
  const labelClass = "block font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5";


  if (success) {
    return (
      <ArenaAuthFrame mode="reset" title="Contraseña actualizada" description="La actualización se completó. Volverás al inicio de sesión.">
        <SEOHead title="Actualizar contraseña" description="Actualización segura de la contraseña de Sharkania." path="/update-password" noIndex />
        <div role="status" className="arena-auth-status border border-sk-green/20 bg-sk-green-dim rounded-xl p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-sk-green-dim text-sk-green rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={30} aria-hidden="true" />
          </div>
          <p className="text-sk-sm text-sk-text-2">
            Tu contraseña ha sido cambiada con éxito. Serás redirigido al inicio de sesión.
          </p>
        </div>
      </ArenaAuthFrame>
    );
  }

  return (
    <ArenaAuthFrame mode="reset" title="Nueva contraseña" description="Define una clave segura y única para proteger el acceso a tu cuenta de Sharkania.">
      <SEOHead title="Actualizar contraseña" description="Actualiza de forma segura tu contraseña de Sharkania Arena." path="/update-password" noIndex />
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="arena-reset-password">Nueva contraseña</label>
          <input
            id="arena-reset-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Contraseña única y segura"
          />
          <p className="text-sk-xs text-sk-text-3 mt-2">Recomendamos una contraseña larga y única, idealmente de 16 caracteres o más.</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="arena-reset-confirm">Confirmar contraseña</label>
          <input
            id="arena-reset-confirm"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            placeholder="Repite la contraseña"
          />
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 bg-sk-red-dim border border-sk-red/20 rounded-md p-3">
            <AlertCircle size={16} className="text-sk-red mt-0.5 shrink-0" />
            <p className="text-sk-sm text-sk-red font-medium">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          variant="accent"
          className="w-full flex justify-center items-center gap-2"
          isLoading={isLoading}
          disabled={previewBlocked || isLoading}
        >
          Actualizar contraseña <Lock size={16} />
        </Button>
      </form>
    </ArenaAuthFrame>
  );
}
