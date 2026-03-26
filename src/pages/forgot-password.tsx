// src/pages/forgot-password.tsx
import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { AlertCircle, ArrowRight, Mail } from "lucide-react";
import { PageShell } from "../components/layout/page-shell";
import { Button } from "../components/ui/button";
import { resetPasswordForEmail } from "../lib/api/auth";

export function ForgotPasswordPage() {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!captchaToken) {
      setError("Por favor, espera a que se complete la verificación de seguridad.");
      return;
    }

    setIsLoading(true);

    try {
      await resetPasswordForEmail(email, captchaToken);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el correo.");
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
      <PageShell>
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
          <div className="w-full max-w-md bg-sk-bg-1 border border-sk-border-2 rounded-xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-sk-accent-dim text-sk-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={32} />
            </div>
            <h2 className="text-2xl font-bold text-sk-text-1">Revisa tu correo</h2>
            <p className="text-sk-sm text-sk-text-2">
              Si el correo <strong className="text-sk-text-1">{email}</strong> está registrado, te hemos enviado un enlace para restablecer tu contraseña.
            </p>
            <Link to="/login" className="block mt-6">
              <Button variant="accent" className="w-full">Volver al Login</Button>
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-sk-text-1 mb-2">Recuperar Contraseña</h1>
            <p className="text-sk-sm text-sk-text-3">
              Ingresa tu correo y te enviaremos instrucciones para volver a las mesas.
            </p>
          </div>

          <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelClass} htmlFor="email">Correo Electrónico</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="tu@correo.com"
                />
              </div>

              {/* Widget de Turnstile */}
              <div className="flex justify-center py-2 min-h-[65px]">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onError={() => setError("Error en seguridad. Recarga la página.")}
                  onExpire={() => setCaptchaToken(null)}
                  options={{ theme: "dark" }}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-sk-red-dim border border-sk-red/20 rounded-md p-3">
                  <AlertCircle size={16} className="text-sk-red mt-0.5 shrink-0" />
                  <p className="text-sk-sm text-sk-red">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                variant="accent"
                className="w-full flex justify-center items-center gap-2"
                isLoading={isLoading}
                disabled={!captchaToken || isLoading}
              >
                Enviar Enlace <ArrowRight size={16} />
              </Button>
            </form>
          </div>

          <p className="text-center text-sk-sm text-sk-text-3 mt-6">
            <Link to="/login" className="text-sk-accent hover:underline font-medium">
              ← Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    </PageShell>
  );
}