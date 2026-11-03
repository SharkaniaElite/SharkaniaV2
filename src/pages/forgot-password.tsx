import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { AlertCircle, ArrowRight, Mail } from "lucide-react";
import { ArenaAuthFrame } from "../components/arena/arena-auth-frame";
import { isArenaPreviewAuthBlocked } from "../lib/arena-preview";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { resetPasswordForEmail } from "../lib/api/auth";
import { translateAuthError } from "../lib/format";

export function ForgotPasswordPage() {
  const previewBlocked = isArenaPreviewAuthBlocked();
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewBlocked) return;
    setError(null);

    if (!captchaToken) {
      setError("Por favor, espera a que se complete la verificación de seguridad.");
      return;
    }

    setIsLoading(true);

    try {
      // 🚀 Dispara el correo PRO configurado en Supabase Auth + Resend
      await resetPasswordForEmail(email, captchaToken);
      setSuccess(true);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "";
      setError(translateAuthError(rawMessage));
      
      // Reiniciar seguridad en caso de error
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3 text-sk-sm text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent transition-colors";
  const labelClass = "block font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5";


  if (success) {
    return (
      <ArenaAuthFrame mode="recovery" title="Revisa tu correo" description="Si tu dirección está registrada, recibirás instrucciones para recuperar el acceso.">
        <SEOHead title="Recuperar contraseña" description="Recuperación segura de acceso a Sharkania Arena." path="/forgot-password" noIndex />
        <div role="status" className="arena-auth-status border border-sk-green/20 bg-sk-green-dim rounded-xl p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-sk-accent-dim text-sk-accent rounded-full flex items-center justify-center mx-auto">
            <Mail size={28} aria-hidden="true" />
          </div>
          <p className="text-sk-sm text-sk-text-2 leading-relaxed">
            Si <strong className="text-sk-text-1">{email}</strong> está registrado, te hemos enviado un enlace para restablecer tu contraseña.
          </p>
          <Link to="/login" className="arena-recovery-link-primary">Volver al inicio de sesión <ArrowRight size={16}/></Link>
        </div>
      </ArenaAuthFrame>
    );
  }

  return (
    <ArenaAuthFrame mode="recovery" title="Recupera tu acceso" description="Indica el correo asociado a tu cuenta de Sharkania y revisa tu bandeja de entrada.">
      <SEOHead title="Recuperar contraseña" description="Recupera el acceso a tu cuenta de Sharkania Arena con un enlace de restablecimiento." path="/forgot-password" noIndex />
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelClass} htmlFor="arena-recovery-email">Correo electrónico</label>
          <input
            id="arena-recovery-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="tu@correo.com"
          />
        </div>

        {!previewBlocked && <div className="flex justify-center py-2 min-h-[65px]">
          <Turnstile
            ref={turnstileRef}
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
            onSuccess={(token) => setCaptchaToken(token)}
            onError={() => setError("Error en seguridad. Recarga la página.")}
            onExpire={() => setCaptchaToken(null)}
            options={{ theme: "dark" }}
          />
        </div>}

        {error && (
          <div role="alert" className="flex items-start gap-2 bg-sk-red-dim border border-sk-red/20 rounded-md p-3">
            <AlertCircle size={16} className="text-sk-red mt-0.5 shrink-0" />
            <p className="text-sk-sm text-sk-red">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          variant="accent"
          className="w-full flex justify-center items-center gap-2"
          isLoading={isLoading}
          disabled={previewBlocked || !captchaToken || isLoading}
        >
          Enviar enlace <ArrowRight size={16} />
        </Button>
      </form>
      <p className="text-center text-sk-sm text-sk-text-3 mt-6">
        <Link to="/login" className="text-sk-accent hover:underline font-medium">
          ← Volver al inicio de sesión
        </Link>
      </p>
    </ArenaAuthFrame>
  );
}
