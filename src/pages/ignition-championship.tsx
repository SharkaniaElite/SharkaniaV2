// src/pages/ignition-championship.tsx
import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "../components/ui/button";
import { signUp, getProfile } from "../lib/api/auth";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/auth-store";
import { translateAuthError } from "../lib/format";
import { 
  Flame, 
  Download, 
  Mail, 
  Gamepad2, 
  Trophy, 
  AlertCircle, 
  LogIn, 
  UserPlus,
  Gift,           // 🔥 Nuevos iconos para los beneficios
  Percent, 
  Shield, 
  ChevronRight,
  MonitorPlay,  // 🔥 Nuevo
  CalendarDays, // 🔥 Nuevo
  History       // 🔥 Nuevo
} from "lucide-react";
import { SEOHead } from "../components/seo/seo-head";
import { PageShell } from "../components/layout/page-shell";
import { ArenaRouteTrail } from "../components/arena/arena-route-trail";
import { cn } from "../lib/cn";

const LATAM_COUNTRIES = [
  { code: "AR", label: "🇦🇷 Argentina" },
  { code: "BO", label: "🇧🇴 Bolivia" },
  { code: "BR", label: "🇧🇷 Brasil" },
  { code: "CL", label: "🇨🇱 Chile" },
  { code: "CO", label: "🇨🇴 Colombia" },
  { code: "CR", label: "🇨🇷 Costa Rica" },
  { code: "CU", label: "🇨🇺 Cuba" },
  { code: "DO", label: "🇩🇴 Rep. Dominicana" },
  { code: "EC", label: "🇪🇨 Ecuador" },
  { code: "SV", label: "🇸🇻 El Salvador" },
  { code: "ES", label: "🇪🇸 España" },
  { code: "GT", label: "🇬🇹 Guatemala" },
  { code: "HN", label: "🇭🇳 Honduras" },
  { code: "MX", label: "🇲🇽 México" },
  { code: "NI", label: "🇳🇮 Nicaragua" },
  { code: "PA", label: "🇵🇦 Panamá" },
  { code: "PY", label: "🇵🇾 Paraguay" },
  { code: "PE", label: "🇵🇪 Perú" },
  { code: "PR", label: "🇵🇷 Puerto Rico" },
  { code: "UY", label: "🇺🇾 Uruguay" },
  { code: "VE", label: "🇻🇪 Venezuela" },
  { code: "OTHER", label: "🌍 Otro país..." },
];

export function IgnitionChampionshipPage() {
  const [isExistingUser, setIsExistingUser] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countryOther, setCountryOther] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const turnstileRef = useRef<TurnstileInstance>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const inputClass = "w-full bg-black/40 border border-orange-500/30 rounded-md py-3 px-4 text-sk-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500 focus:shadow-[0_0_15px_rgba(249,115,22,0.3)] transition-all";
  const labelClass = "font-mono text-[11px] font-bold uppercase tracking-widest text-orange-200/80 mb-2 block";

  const resolveCountry = (code: string, other: string): string => {
    if (code === "OTHER") return other.trim() || "OTHER";
    return code;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isExistingUser && !captchaToken) {
      setError("Por favor, espera a que se complete la verificación de seguridad.");
      return;
    }

    setLoading(true);

    try {
      // El inicio de sesión no debe modificar una vinculación previa.
      if (isExistingUser) {
        // FLUJO 1: LOGIN
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken: captchaToken ?? undefined }
        });

        if (loginError) {
          setError(translateAuthError(loginError.message));
          setLoading(false);
          turnstileRef.current?.reset();
          setCaptchaToken(null);
          return;
        }

        // Un jugador que ya tenía cuenta (incluso de ligas anteriores) solo
        // inicia sesión. No se vuelve a vincular ni se cambia su estado
        // verified/pending. El panel permite solicitar la vinculación si falta.
        if (!data.session?.user) {
          throw new Error("No se pudo recuperar tu sesión. Intenta nuevamente.");
        }
        const profile = await getProfile(data.session.user.id);
        useAuthStore.setState({
          user: data.session.user,
          profile,
          isAuthenticated: true,
          isLoading: false,
        });
        navigate("/dashboard?highlight=ignition");

      } else {
        // FLUJO 2: SIGN UP
        if (!countryCode) { setError("El país es obligatorio"); setLoading(false); return; }
        if (countryCode === "OTHER" && !countryOther.trim()) { setError("Escribe tu país"); setLoading(false); return; }

        const finalCountry = resolveCountry(countryCode, countryOther);

        const result = await signUp(email, password, displayName, "player", {
          country_code: finalCountry,
          whatsapp,
          ignition_league_player: true,
          ignition_email: email,
          ignition_nickname: displayName
        }, captchaToken!);

        if (result.user && (!result.user.identities || result.user.identities.length === 0)) {
          setError("Este email ya está registrado en Sharkania. Selecciona 'Ya tengo cuenta' arriba para iniciar sesión.");
          setLoading(false);
          turnstileRef.current?.reset();
          setCaptchaToken(null);
          return;
        }

        if (result.session?.user) {
          const profile = await getProfile(result.session.user.id);
          useAuthStore.setState({
            user: result.session.user,
            profile,
            isAuthenticated: true,
            isLoading: false,
          });
          navigate("/dashboard?highlight=ignition");
        } else {
          setSuccess("¡Registro recibido! Revisa tu correo para confirmar tu cuenta de SHARKANIA. Tu nickname debe quedar vinculado y revisado para optar al bounty y a los premios mensuales.");
        }
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "";
      setError(translateAuthError(rawMessage));
      if (!isExistingUser) {
        turnstileRef.current?.reset();
        setCaptchaToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell variant="arena">
      <div className="arena-public-bridge arena-partner-route arena-ignition-route min-h-screen text-white relative font-sans">
        <SEOHead 
          title="Liga SHARKANIA Noviembre 2026 en Ignition Poker"
          description="Liga SHARKANIA: jueves 5, 12, 19 y 26 de noviembre a las 21:00 hora de Chile. US$100 garantizados por fecha, buy-in US$3,30, reentry y registro tardío de 60 minutos." 
          path="/ignition"
        />
        <ArenaRouteTrail section="Promociones de póker" current="Ignition Poker · Liga Sharkania" />

        {/* Única creatividad publicitaria permitida en esta ruta: Ignition Poker. */}
        <aside className="arena-ignition-sponsor" aria-label="Publicidad de Ignition Poker">
          <div className="arena-ignition-sponsor-label">
            <span>PUBLICIDAD · IGNITION POKER</span>
            <span>+18 · Sujeto a condiciones y disponibilidad por país</span>
          </div>
          <a
            href="https://record.revenuenetwork.com/_s_OAdmC6KUdsTNBL-wo7tGNd7ZgqdRLk/1/"
            target="_blank"
            rel="sponsored noopener noreferrer"
            aria-label="Consultar Ignition Poker y sus condiciones oficiales"
          >
            <img
              src="https://media.revenuenetwork.com/GIF/Ignition%20Poker/Spanish/Poker/728x90.jpg"
              alt="Banner promocional Ignition Poker"
              width={728}
              height={90}
              decoding="async"
            />
          </a>
        </aside>

        {/* Efectos visuales de fondo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-orange-600/20 blur-[150px] rounded-full pointer-events-none opacity-60" />
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/20 blur-[100px] rounded-full pointer-events-none opacity-40" />

        {/* ══ HERO SECTION ══ */}
        <div className="arena-ignition-hero relative z-10 max-w-7xl mx-auto px-6 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start mt-8">
          
          {/* COLUMNA IZQUIERDA: Copy & Explicación */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500/20 to-red-500/10 border border-orange-500/30 px-3 py-1.5 rounded-full text-orange-400 font-mono text-xs uppercase tracking-widest font-bold">
              <Flame size={14} className="animate-pulse" />
              TORNEOS DE PÓKER / LIGA SHARKANIA · NOVIEMBRE 2026
            </div>
            
            <h1 className="text-5xl sm:text-6xl font-black leading-tight tracking-tight">
              LIGA DE PÓKER <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
                SHARKANIA
              </span>
            </h1>

            {/* 🔥 NUEVO: Logo Patrocinador */}
            <div className="flex flex-col items-start gap-2 animate-in fade-in zoom-in duration-700 delay-200">
              <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest">
                Liga Patrocinada por
              </span>
              <a 
                href="https://record.revenuenetwork.com/_s_OAdmC6KUdsTNBL-wo7tGNd7ZgqdRLk/1/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:scale-105 transition-transform duration-300 block"
              >
                <img 
                  src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/logo-ignition-poker.png" 
                  alt="Ignition Poker" 
                  className="h-16 sm:h-20 object-contain drop-shadow-[0_0_20px_rgba(249,115,22,0.5)]" 
                />
              </a>
            </div>
            
            <p className="text-lg text-gray-300 leading-relaxed max-w-lg">
              La Liga SHARKANIA comienza el jueves 5 de noviembre de 2026 en Ignition Poker.
              Cada jueves a las <strong className="text-orange-300">21:00 hora de Chile</strong> compite por un pozo garantizado de US$100,
              el bounty al host y los premios mensuales son exclusivos para quienes se inscribieron a la Liga SHARKANIA a través de este sitio y vincularon su nickname.
              Si eres nuevo, utiliza el enlace de Sharkania para descargar Ignition y crear tu cuenta.
              Si ya te registraste para la liga y tu vinculación está guardada, no necesitas registrarte otra vez.
            </p>

            <section aria-labelledby="ignition-exclusive-prizes-title" className="rounded-xl border-2 border-amber-400/65 bg-amber-400/10 p-5 sm:p-6 shadow-[0_0_24px_rgba(251,191,36,0.08)]">
              <div className="flex items-start gap-3">
                <Trophy size={23} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-amber-300">Condición obligatoria para premios adicionales</p>
                  <h2 id="ignition-exclusive-prizes-title" className="text-xl font-extrabold leading-snug text-white">
                    Bounty de cada fecha y premios de fin de mes: exclusivos para inscritos mediante SHARKANIA
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-gray-200">
                    Solo pueden optar al <strong className="text-white">bounty al host</strong> y a los
                    <strong className="text-white"> premios del ranking mensual</strong> los jugadores que
                    se hayan inscrito a la Liga SHARKANIA a través de este sitio y tengan su nickname
                    de Ignition correctamente vinculado para acreditar su participación.
                    <strong className="text-amber-200"> Jugar el torneo en Ignition sin registrarte en SHARKANIA no te habilita para esos premios.</strong>
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">
                    Si ya te registraste y vinculaste tu nickname en una edición anterior, no tienes que volver
                     a inscribirte: entra a tu panel y comprueba el estado de tu vinculación. Si figura pendiente, su verificación debe revisarse antes de adjudicar premios adicionales.
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-gray-400">
                    El pozo garantizado regular de cada torneo se rige por las condiciones de Ignition Poker.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-orange-400/40 bg-orange-500/[.08] p-5 space-y-4" aria-label="Cómo participar si eres nuevo o ya estabas inscrito">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-orange-300 mb-2">¿Primera vez en Ignition?</p>
                <h2 className="text-lg font-extrabold text-white">Descarga Ignition desde el enlace de SHARKANIA</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-300">
                  Si todavía no tienes cuenta en Ignition, utiliza nuestro enlace para descargar la plataforma y registrarte. Después vincula tu nickname con SHARKANIA para el ranking.
                </p>
                <a href="https://record.revenuenetwork.com/_s_OAdmC6KUdsTNBL-wo7tGNd7ZgqdRLk/1/" target="_blank" rel="sponsored noopener noreferrer"
                  className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-3 text-sm font-extrabold text-black hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  <Download size={17} aria-hidden="true" /> Descargar Ignition desde SHARKANIA
                </a>
              </div>
              <div className="border-t border-orange-400/25 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-orange-200 mb-1">¿Ya participaste o te registraste antes?</p>
                <h2 className="text-lg font-extrabold text-white">No necesitas registrarte nuevamente</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-300">
                  Si ya tienes una cuenta SHARKANIA con tu nickname de Ignition vinculado o pendiente de revisión, inicia sesión con la misma cuenta y consulta su estado en tu panel. No crees una cuenta duplicada ni envíes otra solicitud.
                </p>
                <a href="#vincular-nickname" onClick={() => setIsExistingUser(true)}
                  className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-orange-400/40 px-4 py-2 text-sm font-bold text-orange-200 hover:bg-orange-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Ya tengo cuenta: iniciar sesión <ChevronRight size={16} aria-hidden="true" />
                </a>
              </div>
            </section>

            <a href="#vincular-nickname" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-3 text-center text-sm font-extrabold text-black shadow-lg shadow-orange-500/15 transition-colors hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Ir al formulario de vinculación <ChevronRight size={17} aria-hidden="true" />
            </a>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/50 border border-white/5 rounded-xl p-4 backdrop-blur-sm hover:border-orange-500/50 transition-colors">
                <div className="text-orange-500 mb-2"><Trophy size={24} /></div>
                <p className="text-xs font-mono text-gray-500 uppercase mb-1">Garantizado por fecha</p>
                <p className="text-xl font-bold text-white">US$100 GTD</p>
                <p className="text-xs text-gray-400 mt-1">Pozo de premios del torneo</p>
              </div>
              <div className="bg-black/50 border border-white/5 rounded-xl p-4 backdrop-blur-sm hover:border-red-500/50 transition-colors">
                <div className="text-red-500 mb-2"><Gamepad2 size={24} /></div>
                <p className="text-xs font-mono text-gray-500 uppercase mb-1">Buy-in / Reentry</p>
                <p className="text-xl font-bold text-white">US$3,30</p>
                <p className="text-xs text-gray-400 mt-1">Reentry y registro tardío: 60 min</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-orange-300 mb-2">
                Fechas de noviembre de 2026 · 21:00 Chile
              </p>
              <div className="grid grid-cols-4 gap-2 text-center text-sm font-bold">
                {["Jue 5", "Jue 12", "Jue 19", "Jue 26"].map(fecha => (
                  <span key={fecha} className="rounded-lg border border-orange-500/25 bg-orange-500/10 py-2 text-orange-100">{fecha}</span>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Todos los torneos comienzan a las <strong className="text-white">21:00 de Chile (America/Santiago)</strong>.
                La distribución de los US$100 garantizados se informa en el lobby de Ignition Poker.
              </p>
              <Link to="/leagues/liga-sharkania-noviembre-2026" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-orange-400 hover:text-orange-300">
                Ver ranking y fechas de la Liga SHARKANIA <ChevronRight size={16} />
              </Link>
            </div>

            {/* Premios por fecha y ranking mensual */}
            <div className="mt-8 bg-gradient-to-br from-orange-950/40 to-black border border-orange-500/30 rounded-xl p-6 shadow-lg">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div>
                   <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2 uppercase tracking-wide">
                     <Trophy className="text-orange-500" size={16} /> PREMIOS POR FECHA (Jueves)
                   </h3>
                   <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-4 mb-3">
                     <p className="text-2xl font-black text-white">US$100 garantizados</p>
                     <p className="mt-1 text-xs text-gray-300">
                       Pozo de premios del torneo. La distribución por posiciones se determina según la estructura publicada por Ignition Poker.
                     </p>
                   </div>
                   <ul className="space-y-2 text-sm text-gray-300">
                     <li className="flex justify-between border-b border-white/5 pb-2"><span>Buy-in</span> <span className="font-bold text-orange-400">US$3,30</span></li>
                     <li className="flex justify-between border-b border-white/5 pb-2"><span>Registro tardío y reentry</span> <span className="font-bold text-orange-400">60 minutos</span></li>
                     <li className="flex justify-between pt-1 text-red-400 font-bold"><span>¡Bounty al host!</span> <span>Ticket US$22</span></li>
                   </ul>
                 </div>
                 
                 <div>
                   <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2 uppercase tracking-wide">
                     <Flame className="text-red-500" size={16} /> Ranking Mensual
                   </h3>
                   <ul className="space-y-2 text-sm text-gray-300">
                     <li className="flex justify-between border-b border-white/5 pb-1"><span>1° de la Liga</span> <span className="font-bold text-red-400">$325 TT para el $100,000 High Roller</span></li>
                     <li className="flex justify-between border-b border-white/5 pb-1"><span>2° de la Liga</span> <span className="font-bold text-red-400">$162 TT para el $200.000 GTD</span></li>
                     <li className="flex justify-between border-b border-white/5 pb-1"><span>3° de la Liga</span> <span className="font-bold text-red-400">$162 TT para el $200.000 GTD</span></li>
                   </ul>
                   <p className="text-[10px] text-gray-500 mt-3 leading-tight">
                     * El ranking suma los resultados de las cuatro fechas de noviembre. Debes estar registrado y vinculado en Sharkania para calificar.
                   </p>
                 </div>
               </div>
            </div>

            <div className="space-y-6 pt-4 border-t border-white/10 mt-8">
              <h3 className="text-xl font-bold pb-2">¿Cómo participar?</h3>
              
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold shrink-0">1</div>
                <div>
                  <h4 className="font-bold text-white">Descarga Ignition desde SHARKANIA</h4>
                  <p className="text-sm text-gray-400 mt-1">Si eres nuevo en Ignition, descarga y crea tu cuenta usando el enlace de SHARKANIA. Si ya tienes cuenta en la sala, no necesitas descargarla ni crear otra.</p>
                  <a href="https://record.revenuenetwork.com/_s_OAdmC6KUdsTNBL-wo7tGNd7ZgqdRLk/1/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 mt-2 font-semibold bg-orange-500/10 px-3 py-1.5 rounded border border-orange-500/20 transition-all hover:bg-orange-500/20">
                    <Download size={14} /> Crear cuenta en Ignition
                  </a>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold shrink-0">2</div>
                <div>
                  <h4 className="font-bold text-white">Vincula tu nickname una sola vez</h4>
                  <p className="text-sm text-gray-400 mt-1">Si eres nuevo en SHARKANIA, crea tu cuenta y vincula tu nickname. Si ya estabas registrado, inicia sesión: no repitas el registro y revisa el estado de tu vinculación en el panel.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold shrink-0">3</div>
                <div>
                  <h4 className="font-bold text-white">Recibe el acceso a la liga</h4>
                  <p className="text-sm text-gray-400 mt-1">Cada jueves recibirás la información de acceso al torneo en el correo registrado. Revisa también la carpeta de spam.</p>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: Formulario */}
          <div id="vincular-nickname" className="relative scroll-mt-24">
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-red-600 rounded-2xl blur-xl opacity-20 animate-pulse" />
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6 sm:p-8 relative shadow-2xl">
              
              {isAuthenticated ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
                    <Trophy size={28} />
                  </div>
                  <h2 className="mb-3 text-2xl font-bold text-white">Ya tienes cuenta en SHARKANIA</h2>
                  <p className="mb-6 text-sm leading-relaxed text-gray-400">
                    No tienes que registrarte otra vez para la liga. En tu panel puedes comprobar
                    si el nickname de Ignition ya está verificado, si sigue en revisión o si
                    todavía debes solicitar la vinculación.
                  </p>
                  <Link to="/dashboard?highlight=ignition" className="inline-block">
                    <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-600 border-none font-bold text-white">
                      Ir a mi panel de Ignition <ChevronRight size={16} className="ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Accede a SHARKANIA</h2>
                <p className="mb-4 text-xs leading-relaxed text-gray-400">
                  Si ya tenías cuenta, selecciona «Ya tengo cuenta». Iniciar sesión no vuelve a registrar tu nickname ni modifica su verificación.
                </p>
                
                {/* TABS DE LOGIN VS REGISTRO */}
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/10 mb-6">
                  <button
                    type="button"
                    onClick={() => { setIsExistingUser(false); setError(""); setSuccess(""); }}
                    className={cn(
                      "flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2",
                      !isExistingUser ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                    )}
                  >
                    <UserPlus size={16} /> Nuevo en Sharkania
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsExistingUser(true); setError(""); setSuccess(""); }}
                    className={cn(
                      "flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2",
                      isExistingUser ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg" : "text-gray-400 hover:text-white"
                    )}
                  >
                    <LogIn size={16} /> Ya tengo cuenta
                  </button>
                </div>
              </div>

              {success ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">¡Inscripción Recibida!</h3>
                  <p className="text-gray-400 mb-6">{success}</p>
                  <Link to="/login">
                    <Button variant="accent" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 border-none text-white w-full shadow-lg">
                      Ir a Iniciar Sesión
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  
                  {/* CAMPOS COMUNES */}
                  <div>
                    <label className={labelClass}>Correo Electrónico *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={inputClass}
                      placeholder={isExistingUser ? "Tu correo de Sharkania" : "El correo que usas en Ignition"}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{isExistingUser ? "Contraseña *" : "Crea una contraseña para Sharkania *"}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className={inputClass}
                      placeholder={isExistingUser ? "Ingresa tu clave actual" : "Mínimo 6 caracteres"}
                    />
                    {!isExistingUser && (
                      <p className="text-[10px] text-gray-500 mt-1.5 leading-tight">
                        * Crea una contraseña nueva para tu cuenta en Sharkania. (No uses la de Ignition por seguridad).
                      </p>
                    )}
                  </div>

                  {/* CAMPOS EXCLUSIVOS PARA USUARIOS NUEVOS */}
                  {!isExistingUser && (
                    <>
                      <div className="bg-orange-950/30 border border-orange-500/30 rounded-lg p-3 flex gap-3 items-start mt-4">
                        <AlertCircle className="text-orange-400 shrink-0 mt-0.5" size={18} />
                        <p className="text-xs text-orange-200/80 leading-relaxed">
                          Como eres nuevo, crearemos tu cuenta en Sharkania y la dejaremos vinculada de inmediato a la liga.
                        </p>
                      </div>

                      <div>
                        <label className={labelClass}>Tu Nickname de Ignition (El del lobby) *</label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          required
                          className={inputClass}
                          placeholder="Ej: SharkPro99"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className={labelClass}>WhatsApp *</label>
                          <input
                            type="tel"
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(e.target.value)}
                            required
                            className={inputClass}
                            placeholder="+56912345678"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>País *</label>
                          <select
                            value={countryCode}
                            onChange={(e) => { setCountryCode(e.target.value); setCountryOther(""); }}
                            required
                            className={`${inputClass} appearance-none`}
                          >
                            <option value="" className="bg-gray-900">Seleccionar país</option>
                            {LATAM_COUNTRIES.map((c) => (
                              <option key={c.code} value={c.code} className="bg-gray-900">{c.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {countryCode === "OTHER" && (
                        <div>
                          <input
                            type="text"
                            value={countryOther}
                            onChange={(e) => setCountryOther(e.target.value)}
                            required
                            className={inputClass}
                            placeholder="Escribe tu país"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* EL CAPTCHA SIEMPRE VISIBLE */}
                  <div className="flex justify-center py-2 min-h-[65px] opacity-80 hover:opacity-100 transition-opacity">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onError={() => setError("Error en la verificación de seguridad. Recarga la página.")}
                      onExpire={() => setCaptchaToken(null)}
                      options={{ theme: "dark" }}
                    />
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                      <p className="text-sm text-red-400 font-semibold">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 border-none text-white font-bold text-lg shadow-[0_0_20px_rgba(249,115,22,0.4)]"
                    isLoading={loading}
                    disabled={(!isExistingUser && !captchaToken) || loading}
                  >
                    {isExistingUser ? "Iniciar sesión y revisar mi vinculación" : "Registrarme mediante SHARKANIA"}
                  </Button>
                </form>
              )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ══ BENEFICIOS Y CONDICIONES DE IGNITION ══ */}
        <div className="arena-ignition-benefits relative z-10 border-t border-white/5 py-24 shadow-[inset_0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4 uppercase tracking-tight">
                Mucho más que una Liga
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed mb-8">
                Al jugar en Ignition Poker a través de Sharkania no solo participas por los premios garantizados de la liga, sino que también accedes a todos los beneficios nativos de la sala.
              </p>
              

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1: Bono de Bienvenida */}
              <div className="bg-gradient-to-b from-orange-500/10 to-transparent border border-orange-500/30 p-8 rounded-2xl relative overflow-hidden group flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 blur-3xl group-hover:bg-orange-500/30 transition-colors" />
                <Gift className="text-orange-500 mb-6" size={40} />
                <h3 className="text-xl font-bold text-white mb-3">Paquete de Bienvenida</h3>
                <p className="text-gray-400 mb-6 leading-relaxed text-sm flex-1">
                  Duplica tu primer depósito hasta $1,000 USD, obtén 50 Free Spins y entradas a 4 torneos Freerolls de $1,200 garantizados.
                </p>
                <Link to="/promociones/ignition-bonus" className="inline-flex items-center text-orange-400 hover:text-orange-300 font-bold text-[11px] uppercase tracking-wider transition-colors mt-auto w-fit">
                  Ver detalles del bono <ChevronRight size={16} className="ml-1" />
                </Link>
              </div>

              {/* Card 2: Cashback del Bono */}
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-white/20 transition-colors flex flex-col">
                <Percent className="text-gray-300 mb-6" size={40} />
                <h3 className="text-xl font-bold text-white mb-3">50% de Cashback Inicial</h3>
                <p className="text-gray-400 leading-relaxed text-sm flex-1">
                  Mientras liberas tu bono de bienvenida, estarás recuperando $5 USD directamente a tu cajero por cada $10 USD que generes en rake en las mesas de Cash o Torneos.
                </p>
              </div>

              {/* Card 3: Mesas Anónimas / Ecosistema Blando */}
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-white/20 transition-colors flex flex-col">
                <Shield className="text-gray-300 mb-6" size={40} />
                <h3 className="text-xl font-bold text-white mb-3">Mesas Anónimas</h3>
                <p className="text-gray-400 leading-relaxed text-sm flex-1">
                  Ignition Poker utiliza un sistema de mesas 100% anónimas, lo que protege a los jugadores recreacionales y mantiene un ecosistema muy blando, ideal para generar ganancias.
                </p>
              </div>

              {/* Card 4: Live Stream con Premios */}
              <Link to="/live" className="bg-gradient-to-b from-[#0f172a] to-transparent border border-blue-500/20 p-8 rounded-2xl hover:border-blue-500/40 transition-colors flex flex-col relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl group-hover:bg-blue-500/20 transition-colors" />
                <MonitorPlay className="text-blue-400 mb-6" size={40} />
                <h3 className="text-xl font-bold text-white mb-3">Live Stream de la Liga</h3>
                <p className="text-gray-400 leading-relaxed text-sm flex-1 mb-6">
                  Sigue cada fecha de la liga en nuestro Live Stream oficial. Disfruta del análisis, interactúa en el chat y gana premios sorpresa durante la transmisión.
                </p>
                <span className="inline-flex items-center text-blue-400 hover:text-blue-300 font-bold text-[11px] uppercase tracking-wider transition-colors mt-auto w-fit">
                  Ir al Stream <ChevronRight size={16} className="ml-1" />
                </span>
              </Link>

              {/* Card 5: Ranking y Calendario */}
              <Link to="/calendar" className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-white/20 transition-colors flex flex-col group">
                <CalendarDays className="text-sk-accent mb-6" size={40} />
                <h3 className="text-xl font-bold text-white mb-3">Ranking y Calendario</h3>
                <p className="text-gray-400 leading-relaxed text-sm flex-1 mb-6">
                  Accede al calendario completo de torneos en Sharkania. Acumula puntos fecha a fecha y sigue tu posición en el ranking actual e histórico en tiempo real.
                </p>
                <span className="inline-flex items-center text-sk-accent hover:text-cyan-300 font-bold text-[11px] uppercase tracking-wider transition-colors mt-auto w-fit">
                  Ver Calendario <ChevronRight size={16} className="ml-1" />
                </span>
              </Link>

              {/* Card 6: Historial de Resultados */}
              <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-white/20 transition-colors flex flex-col">
                <History className="text-gray-300 mb-6" size={40} />
                <h3 className="text-xl font-bold text-white mb-3">Historial Permanente</h3>
                <p className="text-gray-400 leading-relaxed text-sm flex-1">
                  Tu carrera queda grabada. Mantén un registro inmutable de todos los torneos que juegues, tus lugares alcanzados y premios obtenidos para siempre en tu perfil de Sharkania.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </PageShell>
  );
}