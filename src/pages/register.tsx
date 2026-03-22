// src/pages/register.tsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { signUp } from "../lib/api/auth";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth-store";
import { getProfile } from "../lib/api/auth";

type RegistrationType = "player" | "club";

const COUNTRIES = [
  { code: "BR", label: "🇧🇷 Brasil" }, { code: "AR", label: "🇦🇷 Argentina" },
  { code: "MX", label: "🇲🇽 México" }, { code: "CL", label: "🇨🇱 Chile" },
  { code: "CO", label: "🇨🇴 Colombia" }, { code: "ES", label: "🇪🇸 España" },
  { code: "PE", label: "🇵🇪 Perú" }, { code: "UY", label: "🇺🇾 Uruguay" },
  { code: "VE", label: "🇻🇪 Venezuela" }, { code: "EC", label: "🇪🇨 Ecuador" },
  { code: "PY", label: "🇵🇾 Paraguay" }, { code: "BO", label: "🇧🇴 Bolivia" },
  { code: "CR", label: "🇨🇷 Costa Rica" }, { code: "PA", label: "🇵🇦 Panamá" },
  { code: "DO", label: "🇩🇴 Rep. Dominicana" }, { code: "US", label: "🇺🇸 Estados Unidos" },
];

export function RegisterPage() {
  const [regType, setRegType] = useState<RegistrationType | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubCountry, setClubCountry] = useState("");
  const [clubDescription, setClubDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = new URLSearchParams(location.search).get("redirect") ?? "/dashboard";

  const inputClass = "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2.5 px-3.5 text-sk-sm text-sk-text-1 placeholder:text-sk-text-3 focus:outline-none focus:border-sk-accent focus:shadow-[0_0_0_3px_var(--sk-accent-dim)]";
  const labelClass = "font-mono text-[11px] font-semibold uppercase tracking-wide text-sk-text-2 mb-1.5 block";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await signUp(email, password, displayName, "player");

      if (regType === "club" && result.user) {
        await supabase.from("club_registration_requests").insert({
          user_id: result.user.id,
          club_name: clubName,
          country_code: clubCountry || null,
          description: clubDescription || null,
        });
        setSuccess("¡Cuenta creada! Tu solicitud de club ha sido enviada. Un administrador la revisará pronto.");
      } else if (result.session?.user) {
        // Auto-login for player registration
        const profile = await getProfile(result.session.user.id);
        useAuthStore.setState({
          user: result.session.user,
          profile,
          isAuthenticated: true,
          isLoading: false,
        });
        navigate(redirectTo);
      } else {
        setSuccess("¡Cuenta creada! Revisa tu email para confirmar.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sk-bg-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-3xl">🦈</span>
            <span className="text-sk-xl font-extrabold text-sk-text-1 tracking-tight">Sharkania</span>
          </Link>
          <p className="text-sk-sm text-sk-text-2">Crea tu cuenta</p>
        </div>

        {/* Type selector */}
        {!regType && !success && (
          <div className="space-y-3">
            <button onClick={() => setRegType("player")} className="w-full bg-sk-bg-2 border border-sk-border-2 rounded-lg p-5 text-left hover:border-sk-accent hover:bg-sk-bg-3 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎮</span>
                <span className="text-sk-md font-bold text-sk-text-1">Soy Jugador</span>
              </div>
              <p className="text-sk-sm text-sk-text-2">Quiero ver mi ranking, stats y participar en torneos.</p>
            </button>
            <button onClick={() => setRegType("club")} className="w-full bg-sk-bg-2 border border-sk-border-2 rounded-lg p-5 text-left hover:border-sk-accent hover:bg-sk-bg-3 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🏛️</span>
                <span className="text-sk-md font-bold text-sk-text-1">Quiero Registrar un Club</span>
              </div>
              <p className="text-sk-sm text-sk-text-2">Soy organizador y quiero gestionar torneos y ligas.</p>
            </button>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-sk-green-dim border border-sk-green/20 rounded-lg p-5 text-center">
            <span className="text-3xl block mb-3">✅</span>
            <p className="text-sk-sm text-sk-green">{success}</p>
            <Link to="/login"><Button variant="accent" size="md" className="mt-4">Ir a Iniciar Sesión</Button></Link>
          </div>
        )}

        {/* Form */}
        {regType && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button type="button" onClick={() => setRegType(null)} className="text-sk-xs text-sk-text-2 hover:text-sk-text-1 mb-2">
              ← Cambiar tipo de registro
            </button>

            <div>
              <label className={labelClass}>Nombre</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className={inputClass} placeholder="Tu nombre" />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="tu@email.com" />
            </div>
            <div>
              <label className={labelClass}>Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputClass} placeholder="Mínimo 6 caracteres" />
            </div>

            {regType === "club" && (
              <>
                <div>
                  <label className={labelClass}>Nombre del Club *</label>
                  <input type="text" value={clubName} onChange={(e) => setClubName(e.target.value)} required className={inputClass} placeholder="Nombre de tu club" />
                </div>
                <div>
                  <label className={labelClass}>País del Club *</label>
                  <select value={clubCountry} onChange={(e) => setClubCountry(e.target.value)} required className={inputClass}>
                    <option value="">Seleccionar país</option>
                    {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Descripción</label>
                  <textarea value={clubDescription} onChange={(e) => setClubDescription(e.target.value)} className={`${inputClass} min-h-[80px] resize-y`} placeholder="Describe tu club..." />
                </div>
              </>
            )}

            {error && <div className="bg-sk-red-dim border border-sk-red/20 rounded-md p-3 text-sk-sm text-sk-red">{error}</div>}

            <Button type="submit" variant="accent" size="lg" className="w-full" isLoading={loading}>
              {regType === "player" ? "Crear Cuenta" : "Enviar Solicitud"}
            </Button>
          </form>
        )}

        <p className="text-center text-sk-sm text-sk-text-2 mt-6">
          ¿Ya tienes cuenta? <Link to="/login" className="text-sk-accent hover:opacity-80 font-semibold">Inicia sesión</Link>
        </p>
        <p className="text-center mt-3">
          <Link to="/" className="text-sk-xs text-sk-text-3 hover:text-sk-text-1">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}
