// src/pages/login.tsx
import { useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "../components/ui/button";
import { signIn } from "../lib/api/auth";
import { useAuthStore } from "../stores/auth-store";
import { SEOHead } from "../components/seo/seo-head";
import { ArenaAuthFrame } from "../components/arena/arena-auth-frame";
import { translateAuthError } from "../lib/format"; // 👈 Importamos el traductor

export function LoginPage() {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 🛡️ Lógica de redirección: lee '?redirect=...' o va al dashboard por defecto
  const redirectTo = new URLSearchParams(location.search).get("redirect") ?? "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!captchaToken) {
      setError("Por favor, espera la verificación de seguridad.");
      return;
    }

    setLoading(true);

    try {
      const { session } = await signIn(email, password, captchaToken);
      if (session?.user) {
        const { getProfile } = await import("../lib/api/auth");
        const profile = await getProfile(session.user.id);
        
        useAuthStore.setState({
          user: session.user,
          profile,
          isAuthenticated: true,
          isLoading: false,
        });

        // 🚀 Navegamos a la herramienta que el usuario quería ver originalmente
        navigate(redirectTo);
      }
    } catch (err) {
      // 🔄 Aplicamos la traducción aquí para que no salga en inglés
      const rawMessage = err instanceof Error ? err.message : "";
      setError(translateAuthError(rawMessage)); 
      
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ArenaAuthFrame mode="login" title="Inicia sesión" description="Accede a tu cuenta para consultar tus herramientas, estadísticas y torneos registrados.">
      <SEOHead
        title="Iniciar sesión | Ranking y torneos de póker"
        description="Inicia sesión en Sharkania Arena para consultar rankings ELO, torneos de póker y herramientas de tu cuenta."
        path="/login"
      />
      <div className="arena-auth-form-stack">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="arena-login-email" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">
              Correo electrónico
            </label>
            <input
              id="arena-login-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent focus:shadow-[0_0_0_3px_var(--sk-accent-dim)]"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="arena-login-password" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">
              Contraseña
            </label>
            <input
              id="arena-login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent focus:shadow-[0_0_0_3px_var(--sk-accent-dim)]"
              placeholder="••••••••"
            />
            {/* 👇 AHORA: El enlace está aquí, justo debajo del campo de contraseña */}
            <div className="flex justify-end mt-1.5">
              <Link 
                to="/forgot-password" 
                className="text-[11px] text-sk-accent hover:underline font-medium"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

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
            <div role="alert" className="bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full"
            isLoading={loading}
            disabled={!captchaToken || loading}
          >
            Iniciar Sesión
          </Button>
        </form>

        <p className="text-center text-sk-sm text-sk-text-2 mt-6">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-sk-accent hover:opacity-80 font-semibold">
            Regístrate
          </Link>
        </p>

        <p className="text-center mt-3">
          <Link to="/" className="text-sk-xs text-sk-text-3 hover:text-sk-text-1">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </ArenaAuthFrame>
  );
}