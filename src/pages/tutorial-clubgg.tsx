import { useState, useRef } from "react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { Download, Copy, CheckCircle2, AlertCircle, UserPlus, Sparkles } from "lucide-react";
import { cn } from "../lib/cn";
import { useAuthStore } from "../stores/auth-store";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { signUp, getProfile } from "../lib/api/auth";
import { supabase } from "../lib/supabase";
import { translateAuthError } from "../lib/format";

const CLUB_DATA = { link: "https://clubgg.app.link/SY10IKXkw2b", refId: "9424-8605", clubId: "507587" };

const LATAM_COUNTRIES = [
  { code: "AR", label: "🇦🇷 Argentina" }, { code: "BO", label: "🇧🇴 Bolivia" }, { code: "BR", label: "🇧🇷 Brasil" },
  { code: "CL", label: "🇨🇱 Chile" }, { code: "CO", label: "🇨🇴 Colombia" }, { code: "CR", label: "🇨🇷 Costa Rica" },
  { code: "MX", label: "🇲🇽 México" }, { code: "PE", label: "🇵🇪 Perú" }, { code: "UY", label: "🇺🇾 Uruguay" },
  { code: "OTHER", label: "🌍 Otro país..." },
];

export function TutorialClubGGPage() {
  const { isAuthenticated, user, profile, refreshProfile } = useAuthStore();
  
  // Estados para copia de IDs
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedClub, setCopiedClub] = useState(false);

  // Estados del Formulario de Ingreso
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [clubggNick, setClubggNick] = useState("");
  const [wantsContact, setWantsContact] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: "ref" | "club") => {
    navigator.clipboard.writeText(text);
    if (type === "ref") { setCopiedRef(true); setTimeout(() => setCopiedRef(false), 2000); } 
    else { setCopiedClub(true); setTimeout(() => setCopiedClub(false), 2000); }
  };

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    
    if (!isAuthenticated && !captchaToken) {
      setError("Por favor, completa la verificación de seguridad."); return;
    }
    if (!clubggNick.trim()) { setError("El Nickname de ClubGG es obligatorio."); return; }

    setLoading(true);
    try {
      if (!isAuthenticated) {
        // 1. REGISTRAR NUEVO USUARIO
        const result = await signUp(email, password, displayName, "player", {
          country_code: countryCode === "OTHER" ? "OT" : countryCode,
          whatsapp,
        }, captchaToken!);

        if (result.user && (!result.user.identities || result.user.identities.length === 0)) {
          setError("Este email ya está registrado en Sharkania. Inicia sesión primero.");
          setLoading(false); return;
        }

        // 2. ACTUALIZAR SOLICITUD DE CLUBGG PARA EL NUEVO USUARIO
        if (result.user) {
          await supabase.from("profiles").update({ 
            latin_nickname: clubggNick.trim(),
            latin_status: "pending"
          }).eq("id", result.user.id);
          
          if (result.session?.user) {
            const newProfile = await getProfile(result.session.user.id);
            useAuthStore.setState({ user: result.session.user, profile: newProfile, isAuthenticated: true });
          }
          setSuccess("¡Cuenta creada y solicitud enviada! El administrador te contactará por WhatsApp en breve.");
        }
      } else {
        // USUARIO YA LOGUEADO: Solo actualizar perfil
        await supabase.from("profiles").update({ 
          latin_nickname: clubggNick.trim(),
          latin_status: "pending"
        }).eq("id", user!.id);
        await refreshProfile();
        setSuccess("¡Solicitud enviada! El administrador te contactará a tu WhatsApp registrado.");
      }
    } catch (err) {
      setError(translateAuthError(err instanceof Error ? err.message : ""));
      turnstileRef.current?.reset(); setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { 
      title: "Recibe la Invitación", 
      desc: (
        <>
          Ingresa al <a href="https://clubgg.app.link/SY10IKXkw2b" target="_blank" rel="noopener noreferrer" className="text-sk-accent font-bold hover:underline">enlace oficial de descarga</a> para unirte a Club LatinAllinPoker.
          <br /><br />
          <strong className="text-sk-text-2">¿Estás en PC?</strong> Presiona el botón rojo "Download" arriba a la derecha. 
          <span className="text-[11px] text-sk-text-4 block mt-1">
            (Nota: Las imágenes de este tutorial muestran el proceso en versión móvil).
          </span>
        </>
      ), 
      img: "/tutorial/1.jpeg" 
    },
    { title: "Instala ClubGG", desc: "Serás redirigido a la tienda de aplicaciones. Presiona 'Instalar'.", img: "/tutorial/2.jpeg" },
    { title: "Abre la Aplicación", desc: "Una vez instalada, abre el ícono de ClubGG.", img: "/tutorial/3.jpeg" },
    { title: "Inicia tu Registro", desc: "Selecciona el botón verde que dice 'Unirse'.", img: "/tutorial/4.jpeg" },
    { title: "Crea tu GGPass", desc: "Ingresa tu dirección de correo electrónico.", img: "/tutorial/5.jpeg" },
    { title: "Verifica tu Correo", desc: "ClubGG te pedirá un código de 4 dígitos.", img: "/tutorial/6.jpeg" },
    { title: "Copia el Código", desc: "Revisa tu bandeja de entrada y copia el código.", img: "/tutorial/7.jpeg" },
    { title: "Configura el Acceso Rápido", desc: "Puedes elegir contraseña o acceso biométrico.", img: "/tutorial/8.jpeg" },
    { title: "Establece tu Contraseña", desc: "Crea una contraseña segura.", img: "/tutorial/9.jpeg" },
    { title: "Crea tu Perfil", desc: "Selecciona tu país y elige el Nickname con el que jugarás.", img: "/tutorial/10.jpeg" },
    { title: "Encuesta Inicial (Opcional)", desc: "Puedes saltar esta encuesta.", img: "/tutorial/11.jpeg" },
    { title: "Acepta los Términos", desc: "Marca la casilla verde y presiona 'Confirmar'.", img: "/tutorial/12.jpeg" },
    { title: "Cierra las Promociones", desc: "Cierra cualquier anuncio inicial para ir al menú principal.", img: "/tutorial/13.jpeg" },
    { title: "Buscador de Clubes", desc: "Toca la barra superior que dice 'Buscar Club' (ícono de lupa).", img: "/tutorial/14.jpeg" },
    { title: "Ingresa los IDs Oficiales", desc: "Escribe nuestro ID de club (507587) y el ID de recomendación (9424-8605).", img: "/tutorial/15.jpeg" },
    { title: "Envía tu Solicitud", desc: "Verás nuestro escudo. Presiona 'Unirse' y ¡Listo!", img: "/tutorial/16.jpeg" },
  ];

  const inputClass = "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 px-3 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent";
  const labelClass = "font-mono text-[10px] font-semibold uppercase tracking-wide text-sk-text-3 mb-1.5 block";

  return (
    <PageShell>
      <SEOHead title="Cómo jugar en Club LatinAllinPoker | Tutorial" path="/como-jugar-en-clubgg" />
      
      <div className="pt-20 pb-16">
        <div className="max-w-[800px] mx-auto px-6">
          
          {/* ══ HERO SECTION ══ */}
          <div className="bg-sk-bg-2 border border-sk-accent/20 rounded-2xl p-6 md:p-10 mb-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden shadow-[0_0_40px_rgba(34,211,238,0.05)]">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
            <div className="shrink-0 relative z-10">
              <img src="/mascot/shark-1.webp" alt="Guía" className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]" />
            </div>
            <div className="flex-1 text-center md:text-left relative z-10">
              <div className="inline-block py-1 px-3 rounded-md bg-sk-accent-dim text-sk-accent font-mono text-[10px] font-bold uppercase tracking-widest border border-sk-accent/20 mb-3">
                TUTORIAL OFICIAL
              </div>
              <h1 className="text-sk-3xl md:text-sk-4xl font-black tracking-tighter text-sk-text-1 mb-3 leading-tight">
                Únete a <span className="text-transparent bg-clip-text bg-gradient-to-r from-sk-accent to-blue-400 pr-2">LatinAllinPoker</span>
              </h1>
              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed">
                Sigue esta guía paso a paso. <strong className="text-sk-accent">¿Ya tienes cuenta en ClubGG creada?</strong> <strong>DESPUÉS del paso 0</strong>,sáltate directo al <strong>Paso 14</strong>.
              </p>
            </div>
          </div>

          {/* ══ BENEFICIOS VIP (MENSAJE DEL TIBURÓN) ══ */}
          <div className="bg-sk-bg-2 border border-sk-accent/30 rounded-2xl p-6 md:p-8 mb-8 flex flex-col md:flex-row items-center gap-8 shadow-[0_0_40px_rgba(34,211,238,0.05)] relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
            
            <div className="shrink-0 relative z-10 hidden md:block">
              <img src="/mascot/shark-5.webp" alt="Beneficios Sharkania" className="w-40 h-40 md:w-48 md:h-48 object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] hover:scale-105 transition-transform duration-500" />
            </div>

            <div className="flex-1 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sk-gold/10 border border-sk-gold/20 rounded-md text-[10px] font-mono font-bold text-sk-gold uppercase tracking-widest mb-4">
                <Sparkles size={12} /> Zona VIP LatinAllinPoker
              </div>
              <h3 className="text-2xl font-black text-sk-text-1 mb-4 leading-tight">
                Completa el formulario de abajo para activar tu cuenta y desbloquear:
              </h3>
              
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sk-sm text-sk-text-2">
                  <CheckCircle2 className="text-sk-green shrink-0 mt-0.5" size={18} /> 
                  <span><strong className="text-sk-text-1">Welcome Bono:</strong> 100% hasta 500k garantizados en tu primer depósito.</span>
                </li>
                <li className="flex items-start gap-3 text-sk-sm text-sk-text-2">
  <CheckCircle2 className="text-sk-green shrink-0 mt-0.5" size={18} /> 
  <span>
    <strong className="text-sk-text-1">Liga Mensual libre de cargos (Abril y Mayo):</strong> 
    Juega todas las fechas de la liga (2 veces por semana) y Obtén $2.000 de descuento en cada entrada. 
    ¡Ahorra un mínimo de **$16.000 CLP al mes**! 
    <em>(Los reembolsos de cargos se abonan a tu cuenta 24 horas después de cada fecha)</em>.
  </span>
</li>
                <li className="flex items-start gap-3 text-sk-sm text-sk-text-2">
                  <CheckCircle2 className="text-sk-green shrink-0 mt-0.5" size={18} /> 
                  <span><strong className="text-sk-text-1">Liquidez Inmediata:</strong> Cargas y retiros procesados en tiempo récord de forma segura con nuestro administrador.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* ══ FORMULARIO OBLIGATORIO DE ONBOARDING ══ */}
          <div className="bg-gradient-to-b from-sk-bg-2 to-sk-bg-3 border-2 border-sk-accent/40 rounded-2xl p-6 md:p-8 mb-12 shadow-[0_0_30px_rgba(34,211,238,0.1)] relative">
            <div className="absolute -top-3 left-6 bg-sk-accent text-sk-bg-0 font-black text-[11px] uppercase tracking-widest px-3 py-1 rounded-sm flex items-center gap-1.5 shadow-lg">
              <UserPlus size={14} /> Paso 0: Obligatorio
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-start mb-6 pt-4 border-b border-sk-border-2 pb-6">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-sk-text-1 mb-2">Solicitud de Ingreso al Club</h2>
                <p className="text-sk-sm text-sk-text-3">
                  Para ser aceptado en nuestras mesas y gestionar tus cargas/retiros, debes registrar tu Nickname y activar tu canal de comunicación.
                </p>
              </div>
              <div className="bg-sk-bg-0 border border-sk-border-2 rounded-xl p-4 flex items-start gap-3 w-full md:w-64 shrink-0">
                <img src="/mascot/shark-3.webp" alt="Info" className="w-12 h-12 object-contain drop-shadow-md -mt-2" />
                <div>
                  <p className="text-[11px] text-sk-text-2 leading-tight">
                    <strong className="text-sk-gold">Atención:</strong> Es vital que pongas un <strong>WhatsApp real</strong>. El administrador te contactará por ahí en breve para activar tus depósitos y retiros.
                  </p>
                </div>
              </div>
            </div>

            {profile?.latin_status === "pending" || profile?.latin_status === "contacted" ? (
              <div className="bg-sk-green-dim border border-sk-green/30 rounded-xl p-6 text-center">
                <CheckCircle2 size={32} className="text-sk-green mx-auto mb-3" />
                <h3 className="text-lg font-bold text-sk-text-1 mb-1">¡Tu solicitud ya está en proceso!</h3>
                <p className="text-sk-sm text-sk-green">Tu nickname asociado es: <strong>{profile.latin_nickname}</strong>. El administrador te contactará pronto por WhatsApp.</p>
              </div>
            ) : success ? (
              <div className="bg-sk-green-dim border border-sk-green/30 rounded-xl p-6 text-center">
                <CheckCircle2 size={32} className="text-sk-green mx-auto mb-3" />
                <h3 className="text-lg font-bold text-sk-text-1 mb-1">¡Éxito!</h3>
                <p className="text-sk-sm text-sk-green">{success}</p>
              </div>
            ) : (
              <form onSubmit={handleRegistrationSubmit} className="space-y-5">
                {!isAuthenticated && (
                  <div className="grid md:grid-cols-2 gap-4 bg-sk-bg-1 p-4 rounded-lg border border-sk-border-2">
                    <div className="col-span-full mb-1"><p className="text-sk-xs font-bold text-sk-accent uppercase tracking-wide">1. Crea tu cuenta Sharkania</p></div>
                    <div><label className={labelClass}>Nombre y Apellido *</label><input type="text" required value={displayName} onChange={e=>setDisplayName(e.target.value)} className={inputClass} placeholder="Ej: Juan Pérez" /></div>
                    <div><label className={labelClass}>Email *</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className={inputClass} placeholder="tu@correo.com" /></div>
                    <div><label className={labelClass}>Contraseña *</label><input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" /></div>
                    <div>
                      <label className={labelClass}>País *</label>
                      <select required value={countryCode} onChange={e=>setCountryCode(e.target.value)} className={inputClass}>
                        <option value="">Selecciona tu país</option>
                        {LATAM_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                <div className="bg-sk-bg-1 p-4 rounded-lg border border-sk-accent/30 space-y-4">
                  <div className="mb-1"><p className="text-sk-xs font-bold text-sk-accent uppercase tracking-wide">{!isAuthenticated ? "2." : "1."} Datos del Club LatinAllinPoker</p></div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Nickname en ClubGG *</label>
                      <input type="text" required value={clubggNick} onChange={e=>setClubggNick(e.target.value)} className={inputClass} placeholder="El nick que creaste en la app" />
                    </div>
                    <div>
                      <label className={labelClass}>WhatsApp Real * <span className="text-sk-text-4 lowercase font-normal">(con código de país)</span></label>
                      <input type="tel" required value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} disabled={isAuthenticated && !!profile?.whatsapp} className={cn(inputClass, isAuthenticated && !!profile?.whatsapp && "opacity-50 cursor-not-allowed")} placeholder={isAuthenticated && profile?.whatsapp ? `+${profile.whatsapp}` : "+56 9 1234 5678"} />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 p-3 bg-sk-bg-0 border border-sk-border-2 rounded-lg cursor-pointer hover:border-sk-accent/50 transition-colors">
                    <input type="checkbox" required checked={wantsContact} onChange={e=>setWantsContact(e.target.checked)} className="mt-1 accent-sk-accent" />
                    <span className="text-sk-sm text-sk-text-2 leading-snug">
                      Quiero que me contacte el administrador por WhatsApp para abrir mi canal de carga y descarga de fichas, y acepto las condiciones del club.
                    </span>
                  </label>
                </div>

                {error && <p className="text-sk-sm text-sk-red bg-sk-red-dim p-3 rounded-md border border-sk-red/20">{error}</p>}

                {!isAuthenticated && (
                  <div className="flex justify-center"><Turnstile ref={turnstileRef} siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} options={{ theme: "dark" }} /></div>
                )}

                <Button type="submit" variant="accent" size="lg" className="w-full text-sk-md h-12 shadow-[0_0_20px_rgba(34,211,238,0.2)]" isLoading={loading} disabled={(!isAuthenticated && !captchaToken) || loading}>
                  Enviar Solicitud e Ingresar al Club
                </Button>
              </form>
            )}
          </div>

          {/* ══ CAJA DE DATOS CLAVE (ATAJO) ══ */}
          {/* ... Mismo código de tu caja de datos ... */}
          <div className="bg-sk-bg-2 border border-sk-accent/30 rounded-2xl p-6 md:p-8 mb-16 shadow-[0_0_30px_rgba(34,211,238,0.05)]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 border-b border-sk-border-2 pb-4">
              <h3 className="text-sk-md font-bold text-sk-text-1 flex items-center gap-2">
                <AlertCircle size={20} className="text-sk-accent" />
                Datos de Acceso Directo (Paso 14 y 15)
              </h3>
              <img src="/logos/latin-logo.png" alt="Latin All in Poker" className="h-12 object-contain drop-shadow-[0_2px_10px_rgba(34,211,238,0.2)]" />
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-mono text-sk-text-3 uppercase tracking-wide mb-1">ID del Club</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xl font-black text-sk-text-1 bg-sk-bg-0 px-3 py-1.5 rounded-md border border-sk-border-2 flex-1">{CLUB_DATA.clubId}</code>
                    <Button variant="secondary" size="sm" onClick={() => copyToClipboard(CLUB_DATA.clubId, "club")} className="h-[42px] px-4">{copiedClub ? <CheckCircle2 size={16} className="text-sk-green" /> : <Copy size={16} />}</Button>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-mono text-sk-text-3 uppercase tracking-wide mb-1">ID de Recomendación</p>
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-bold text-sk-text-1 bg-sk-bg-0 px-3 py-1.5 rounded-md border border-sk-border-2 flex-1">{CLUB_DATA.refId}</code>
                    <Button variant="secondary" size="sm" onClick={() => copyToClipboard(CLUB_DATA.refId, "ref")} className="h-[40px] px-4">{copiedRef ? <CheckCircle2 size={16} className="text-sk-green" /> : <Copy size={16} />}</Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <a href={CLUB_DATA.link} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <Button variant="accent" size="lg" className="w-full h-16 text-sk-sm font-extrabold shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                    <Download size={20} className="mr-2" />
                    Descargar ClubGG
                  </Button>
                </a>
                <p className="text-[10px] text-sk-text-4 text-center mt-3">Enlace oficial y seguro. Disponible para iOS y Android.</p>
              </div>
            </div>
          </div>

          {/* ══ TIMELINE DE PASOS ══ */}
          <div className="relative mb-20">
            <div className="absolute left-[23px] md:left-1/2 top-4 bottom-4 w-0.5 bg-sk-border-2 md:-translate-x-1/2" />
            <div className="space-y-12">
              {steps.map((step, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <div key={idx} className={cn("relative flex items-center md:justify-between w-full", isEven ? "md:flex-row" : "md:flex-row-reverse")}>
                    <div className="absolute left-0 md:left-1/2 w-12 h-12 rounded-full bg-sk-bg-2 border-2 border-sk-accent flex items-center justify-center font-mono font-black text-sk-lg text-sk-accent z-10 md:-translate-x-1/2 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                      {idx + 1}
                    </div>
                    <div className={cn("w-full pl-16 md:pl-0 md:w-[45%]", isEven ? "md:text-right md:pr-8" : "md:text-left md:pl-8")}>
                      <h4 className="text-sk-lg font-bold text-sk-text-1 mb-2">{step.title}</h4>
                      <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-4">{step.desc}</p>
                      <div className="md:hidden mt-4 rounded-xl overflow-hidden border border-sk-border-2 bg-sk-bg-0 shadow-md">
                        <img src={step.img} alt={`Paso ${idx + 1}`} className="w-full h-auto object-contain max-h-[400px]" />
                      </div>
                    </div>
                    <div className={cn("hidden md:block w-[45%]", isEven ? "pl-8" : "pr-8")}>
                      <div className="rounded-xl overflow-hidden border border-sk-border-2 bg-sk-bg-0 shadow-lg hover:border-sk-accent/50 transition-colors">
                        <img src={step.img} alt={`Paso ${idx + 1}`} className="w-full h-auto object-contain max-h-[500px]" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </PageShell>
  );
}