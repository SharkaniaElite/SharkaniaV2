// src/pages/update-password.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Lock, CheckCircle2 } from "lucide-react";
import { PageShell } from "../components/layout/page-shell";
import { Button } from "../components/ui/button";
import { updateUserPassword } from "../lib/api/auth";

export function UpdatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 🛡️ Traductor de errores de Supabase
  const translateError = (message: string): string => {
    if (message.includes("New password should be different")) {
      return "La nueva contraseña debe ser diferente a la anterior.";
    }
    if (message.includes("at least 6 characters")) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }
    if (message.includes("Link has expired") || message.includes("invalid or has expired")) {
      return "El enlace de recuperación ha expirado. Por favor, solicita uno nuevo.";
    }
    
    // Si es un error desconocido, devolvemos un mensaje genérico amable
    return "Ocurrió un error al actualizar la contraseña. Inténtalo de nuevo.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await updateUserPassword(password);
      setSuccess(true);
      // Redirigir al login después de 3 segundos
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      // 🔄 Aplicamos la traducción aquí
      const rawMessage = err instanceof Error ? err.message : "";
      setError(translateError(rawMessage));
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
            <div className="w-16 h-16 bg-sk-green-dim text-sk-green rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-2xl font-bold text-sk-text-1">¡Contraseña actualizada!</h2>
            <p className="text-sk-sm text-sk-text-2">
              Tu contraseña ha sido cambiada con éxito. Redirigiendo al inicio de sesión...
            </p>
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
            <h1 className="text-3xl font-bold text-sk-text-1 mb-2">Nueva Contraseña</h1>
            <p className="text-sk-sm text-sk-text-3">
              Ingresa tu nueva clave para asegurar tu cuenta de Sharkania.
            </p>
          </div>

          <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelClass} htmlFor="password">Nueva Contraseña</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="confirm-password">Confirmar Contraseña</label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Repite la contraseña"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-sk-red-dim border border-sk-red/20 rounded-md p-3 transition-all">
                  <AlertCircle size={16} className="text-sk-red mt-0.5 shrink-0" />
                  <p className="text-sk-sm text-sk-red font-medium">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                variant="accent"
                className="w-full flex justify-center items-center gap-2"
                isLoading={isLoading}
              >
                Actualizar Contraseña <Lock size={16} />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </PageShell>
  );
}