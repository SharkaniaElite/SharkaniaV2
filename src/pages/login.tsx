// src/pages/login.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { signIn } from "../lib/api/auth";
import { useAuthStore } from "../stores/auth-store";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { session } = await signIn(email, password);
      if (session?.user) {
        // Manually update the store instead of waiting for the listener
        const { getProfile } = await import("../lib/api/auth");
        const profile = await getProfile(session.user.id);
        useAuthStore.setState({
          user: session.user,
          profile,
          isAuthenticated: true,
          isLoading: false,
        });
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sk-bg-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-3xl">🦈</span>
            <span className="text-sk-xl font-extrabold text-sk-text-1 tracking-tight">
              Sharkania
            </span>
          </Link>
          <p className="text-sk-sm text-sk-text-2">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent focus:shadow-[0_0_0_3px_var(--sk-accent-dim)]"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent focus:shadow-[0_0_0_3px_var(--sk-accent-dim)]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full"
            isLoading={loading}
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
    </div>
  );
}
