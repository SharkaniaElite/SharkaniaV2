import { useState, useRef, useEffect } from "react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { 
  Download, Copy, CheckCircle2, AlertCircle, UserPlus, 
  ShieldCheck, Coins, HeadphonesIcon, Zap, ArrowRight,
  Flame, MessageCircle, CalendarDays, CalendarOff, Layers
} from "lucide-react";
import { cn } from "../lib/cn";
import { useAuthStore } from "../stores/auth-store";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import { signUp, getProfile } from "../lib/api/auth";
import { supabase } from "../lib/supabase";
import { translateAuthError } from "../lib/format";

// Importaciones del Calendario
import { useUpcomingTournaments } from "../hooks/use-tournaments";
import { TournamentCard } from "../components/calendar/tournament-card";
import { TournamentDetailModal } from "../components/calendar/tournament-detail-modal";
import { Spinner } from "../components/ui/spinner";
import type { TournamentWithDetails } from "../types";

const CLUB_DATA = { 
  link: "https://clubgg.app.link/181zE713U5b", 
  refId: "9424-8605", 
  clubId: "507587" 
};

// 🔥 MESAS DE CASH REALES DEL CLUB LATIN ALLIN / SIETECUATRO
const CASH_TABLES = [
  // NLH
  { id: 1, type: "NLH", name: "NLH 6max (BBJ)", stakes: "100/200", maxPlayers: 6, features: ["BBJ"] },
  { id: 2, type: "NLH", name: "NLH 6max (BBJ)", stakes: "250/500", maxPlayers: 6, features: ["BBJ"] },
  { id: 3, type: "NLH", name: "NLH Deep", stakes: "500/1.000", maxPlayers: 6, features: ["DEEP"] },
  { id: 4, type: "NLH", name: "NLH 8max (Straddle & BBJ)", stakes: "100/200", maxPlayers: 8, features: ["STRADDLE", "BBJ"] },
  { id: 5, type: "NLH", name: "NLH 8max (Straddle & BBJ)", stakes: "250/500", maxPlayers: 8, features: ["STRADDLE", "BBJ"] },
  { id: 6, type: "NLH", name: "NLH Straddle", stakes: "500/1.000", maxPlayers: 8, features: ["STRADDLE"] },
  { id: 7, type: "NLH", name: "NLH High Stakes", stakes: "1.000/2.000", maxPlayers: 8, features: [] },

  // PLO6 (5MAX)
  { id: 8, type: "PLO6", name: "PLO6 Bombpot Deep", stakes: "100/200", maxPlayers: 5, features: ["BOMBPOT", "DEEP"] },
  { id: 9, type: "PLO6", name: "PLO6 Bombpot", stakes: "100/200", maxPlayers: 5, features: ["BOMBPOT"] },
  { id: 10, type: "PLO6", name: "PLO6 Bombpot", stakes: "250/500", maxPlayers: 5, features: ["BOMBPOT"] },
  { id: 11, type: "PLO6", name: "PLO6 Bombpot Deep", stakes: "250/500", maxPlayers: 5, features: ["BOMBPOT", "DEEP"] },

  // PLO5 (6MAX)
  { id: 12, type: "PLO5", name: "PLO5 Straddle & BBJ", stakes: "100/200", maxPlayers: 6, features: ["STRADDLE", "BBJ"] },
  { id: 13, type: "PLO5", name: "PLO5 Bombpot", stakes: "100/200", maxPlayers: 6, features: ["BOMBPOT"] },
  { id: 14, type: "PLO5", name: "PLO5 Bombpot", stakes: "250/500", maxPlayers: 6, features: ["BOMBPOT"] },
  { id: 15, type: "PLO5", name: "PLO5 Straddle & BBJ", stakes: "250/500", maxPlayers: 6, features: ["STRADDLE", "BBJ"] },
  { id: 16, type: "PLO5", name: "PLO5 Bombpot", stakes: "500/1.000", maxPlayers: 6, features: ["BOMBPOT"] },
  { id: 17, type: "PLO5", name: "PLO5 Straddle & BBJ", stakes: "500/1.000", maxPlayers: 6, features: ["STRADDLE", "BBJ"] },
];

// 🔥 LISTA GLOBAL DE PAÍSES Y PREFIJOS
const WORLD_COUNTRIES = [
  { code: "AF", label: "🇦🇫 Afganistán", phone: "+93" },
  { code: "AL", label: "🇦🇱 Albania", phone: "+355" },
  { code: "DE", label: "🇩🇪 Alemania", phone: "+49" },
  { code: "AD", label: "🇦🇩 Andorra", phone: "+376" },
  { code: "AO", label: "🇦🇴 Angola", phone: "+244" },
  { code: "AG", label: "🇦🇬 Antigua y Barbuda", phone: "+1" },
  { code: "SA", label: "🇸🇦 Arabia Saudita", phone: "+966" },
  { code: "DZ", label: "🇩🇿 Argelia", phone: "+213" },
  { code: "AR", label: "🇦🇷 Argentina", phone: "+54" },
  { code: "AM", label: "🇦🇲 Armenia", phone: "+374" },
  { code: "AU", label: "🇦🇺 Australia", phone: "+61" },
  { code: "AT", label: "🇦🇹 Austria", phone: "+43" },
  { code: "AZ", label: "🇦🇿 Azerbaiyán", phone: "+994" },
  { code: "BS", label: "🇧🇸 Bahamas", phone: "+1" },
  { code: "BH", label: "🇧🇭 Bahréin", phone: "+973" },
  { code: "BD", label: "🇧🇩 Bangladesh", phone: "+880" },
  { code: "BB", label: "🇧🇧 Barbados", phone: "+1" },
  { code: "BE", label: "🇧🇪 Bélgica", phone: "+32" },
  { code: "BZ", label: "🇧🇿 Belice", phone: "+501" },
  { code: "BJ", label: "🇧🇯 Benín", phone: "+229" },
  { code: "BY", label: "🇧🇾 Bielorrusia", phone: "+375" },
  { code: "BO", label: "🇧🇴 Bolivia", phone: "+591" },
  { code: "BA", label: "🇧🇦 Bosnia y Herzegovina", phone: "+387" },
  { code: "BW", label: "🇧🇼 Botsuana", phone: "+267" },
  { code: "BR", label: "🇧🇷 Brasil", phone: "+55" },
  { code: "BG", label: "🇧🇬 Bulgaria", phone: "+359" },
  { code: "BF", label: "🇧🇫 Burkina Faso", phone: "+226" },
  { code: "BI", label: "🇧🇮 Burundi", phone: "+257" },
  { code: "BT", label: "🇧🇹 Bután", phone: "+975" },
  { code: "CV", label: "🇨🇻 Cabo Verde", phone: "+238" },
  { code: "KH", label: "🇰🇭 Camboya", phone: "+855" },
  { code: "CM", label: "🇨🇲 Camerún", phone: "+237" },
  { code: "CA", label: "🇨🇦 Canadá", phone: "+1" },
  { code: "QA", label: "🇶🇦 Catar", phone: "+974" },
  { code: "TD", label: "🇹🇩 Chad", phone: "+235" },
  { code: "CL", label: "🇨🇱 Chile", phone: "+56" },
  { code: "CN", label: "🇨🇳 China", phone: "+86" },
  { code: "CY", label: "🇨🇾 Chipre", phone: "+357" },
  { code: "CO", label: "🇨🇴 Colombia", phone: "+57" },
  { code: "KM", label: "🇰🇲 Comoras", phone: "+269" },
  { code: "KR", label: "🇰🇷 Corea del Sur", phone: "+82" },
  { code: "CR", label: "🇨🇷 Costa Rica", phone: "+506" },
  { code: "HR", label: "🇭🇷 Croacia", phone: "+385" },
  { code: "CU", label: "🇨🇺 Cuba", phone: "+53" },
  { code: "DK", label: "🇩🇰 Dinamarca", phone: "+45" },
  { code: "EC", label: "🇪🇨 Ecuador", phone: "+593" },
  { code: "EG", label: "🇪🇬 Egipto", phone: "+20" },
  { code: "SV", label: "🇸🇻 El Salvador", phone: "+503" },
  { code: "AE", label: "🇦🇪 Emiratos Árabes Unidos", phone: "+971" },
  { code: "SK", label: "🇸🇰 Eslovaquia", phone: "+421" },
  { code: "SI", label: "🇸🇮 Eslovenia", phone: "+386" },
  { code: "ES", label: "🇪🇸 España", phone: "+34" },
  { code: "US", label: "🇺🇸 Estados Unidos", phone: "+1" },
  { code: "EE", label: "🇪🇪 Estonia", phone: "+372" },
  { code: "ET", label: "🇪🇹 Etiopía", phone: "+251" },
  { code: "PH", label: "🇵🇭 Filipinas", phone: "+63" },
  { code: "FI", label: "🇫🇮 Finlandia", phone: "+358" },
  { code: "FR", label: "🇫🇷 Francia", phone: "+33" },
  { code: "GA", label: "🇬🇦 Gabón", phone: "+241" },
  { code: "GM", label: "🇬🇲 Gambia", phone: "+220" },
  { code: "GE", label: "🇬🇪 Georgia", phone: "+995" },
  { code: "GH", label: "🇬🇭 Ghana", phone: "+233" },
  { code: "GR", label: "🇬🇷 Grecia", phone: "+30" },
  { code: "GT", label: "🇬🇹 Guatemala", phone: "+502" },
  { code: "GN", label: "🇬🇳 Guinea", phone: "+224" },
  { code: "GQ", label: "🇬🇶 Guinea Ecuatorial", phone: "+240" },
  { code: "GW", label: "🇬🇼 Guinea-Bisáu", phone: "+245" },
  { code: "GY", label: "🇬🇾 Guyana", phone: "+592" },
  { code: "HT", label: "🇭🇹 Haití", phone: "+509" },
  { code: "HN", label: "🇭🇳 Honduras", phone: "+504" },
  { code: "HU", label: "🇭🇺 Hungría", phone: "+36" },
  { code: "IN", label: "🇮🇳 India", phone: "+91" },
  { code: "ID", label: "🇮🇩 Indonesia", phone: "+62" },
  { code: "IQ", label: "🇮🇶 Irak", phone: "+964" },
  { code: "IR", label: "🇮🇷 Irán", phone: "+98" },
  { code: "IE", label: "🇮🇪 Irlanda", phone: "+353" },
  { code: "IS", label: "🇮🇸 Islandia", phone: "+354" },
  { code: "IL", label: "🇮🇱 Israel", phone: "+972" },
  { code: "IT", label: "🇮🇹 Italia", phone: "+39" },
  { code: "JM", label: "🇯🇲 Jamaica", phone: "+1" },
  { code: "JP", label: "🇯🇵 Japón", phone: "+81" },
  { code: "JO", label: "🇯🇴 Jordania", phone: "+962" },
  { code: "KZ", label: "🇰🇿 Kazajistán", phone: "+7" },
  { code: "KE", label: "🇰🇪 Kenia", phone: "+254" },
  { code: "KG", label: "🇰🇬 Kirguistán", phone: "+996" },
  { code: "KW", label: "🇰🇼 Kuwait", phone: "+965" },
  { code: "LA", label: "🇱🇦 Laos", phone: "+856" },
  { code: "LV", label: "🇱🇻 Letonia", phone: "+371" },
  { code: "LB", label: "🇱🇧 Líbano", phone: "+961" },
  { code: "LY", label: "🇱🇾 Libia", phone: "+218" },
  { code: "LT", label: "🇱🇹 Lituania", phone: "+370" },
  { code: "LU", label: "🇱🇺 Luxemburgo", phone: "+352" },
  { code: "MG", label: "🇲🇬 Madagascar", phone: "+261" },
  { code: "MY", label: "🇲🇾 Malasia", phone: "+60" },
  { code: "MW", label: "🇲🇼 Malaui", phone: "+265" },
  { code: "MV", label: "🇲🇻 Maldivas", phone: "+960" },
  { code: "ML", label: "🇲🇱 Malí", phone: "+223" },
  { code: "MT", label: "🇲🇹 Malta", phone: "+356" },
  { code: "MA", label: "🇲🇦 Marruecos", phone: "+212" },
  { code: "MU", label: "🇲🇺 Mauricio", phone: "+230" },
  { code: "MR", label: "🇲🇷 Mauritania", phone: "+222" },
  { code: "MX", label: "🇲🇽 México", phone: "+52" },
  { code: "MD", label: "🇲🇩 Moldavia", phone: "+373" },
  { code: "MC", label: "🇲🇨 Mónaco", phone: "+377" },
  { code: "MN", label: "🇲🇳 Mongolia", phone: "+976" },
  { code: "ME", label: "🇲🇪 Montenegro", phone: "+382" },
  { code: "MZ", label: "🇲🇿 Mozambique", phone: "+258" },
  { code: "NA", label: "🇳🇦 Namibia", phone: "+264" },
  { code: "NP", label: "🇳🇵 Nepal", phone: "+977" },
  { code: "NI", label: "🇳🇮 Nicaragua", phone: "+505" },
  { code: "NE", label: "🇳🇪 Níger", phone: "+227" },
  { code: "NG", label: "🇳🇬 Nigeria", phone: "+234" },
  { code: "NO", label: "🇳🇴 Noruega", phone: "+47" },
  { code: "NZ", label: "🇳🇿 Nueva Zelanda", phone: "+64" },
  { code: "OM", label: "🇴🇲 Omán", phone: "+968" },
  { code: "NL", label: "🇳🇱 Países Bajos", phone: "+31" },
  { code: "PK", label: "🇵🇰 Pakistán", phone: "+92" },
  { code: "PA", label: "🇵🇦 Panamá", phone: "+507" },
  { code: "PY", label: "🇵🇾 Paraguay", phone: "+595" },
  { code: "PE", label: "🇵🇪 Perú", phone: "+51" },
  { code: "PL", label: "🇵🇱 Polonia", phone: "+48" },
  { code: "PT", label: "🇵🇹 Portugal", phone: "+351" },
  { code: "PR", label: "🇵🇷 Puerto Rico", phone: "+1" },
  { code: "GB", label: "🇬🇧 Reino Unido", phone: "+44" },
  { code: "DO", label: "🇩🇴 República Dominicana", phone: "+1" },
  { code: "RO", label: "🇷🇴 Rumania", phone: "+40" },
  { code: "RU", label: "🇷🇺 Rusia", phone: "+7" },
  { code: "SN", label: "🇸🇳 Senegal", phone: "+221" },
  { code: "RS", label: "🇷🇸 Serbia", phone: "+381" },
  { code: "SG", label: "🇸🇬 Singapur", phone: "+65" },
  { code: "SY", label: "🇸🇾 Siria", phone: "+963" },
  { code: "ZA", label: "🇿🇦 Sudáfrica", phone: "+27" },
  { code: "SD", label: "🇸🇩 Sudán", phone: "+249" },
  { code: "SE", label: "🇸🇪 Suecia", phone: "+46" },
  { code: "CH", label: "🇨🇭 Suiza", phone: "+41" },
  { code: "TH", label: "🇹🇭 Tailandia", phone: "+66" },
  { code: "TW", label: "🇹🇼 Taiwán", phone: "+886" },
  { code: "TZ", label: "🇹🇿 Tanzania", phone: "+255" },
  { code: "TN", label: "🇹🇳 Túnez", phone: "+216" },
  { code: "TR", label: "🇹🇷 Turquía", phone: "+90" },
  { code: "UA", label: "🇺🇦 Ucrania", phone: "+380" },
  { code: "UG", label: "🇺🇬 Uganda", phone: "+256" },
  { code: "UY", label: "🇺🇾 Uruguay", phone: "+598" },
  { code: "VE", label: "🇻🇪 Venezuela", phone: "+58" },
  { code: "VN", label: "🇻🇳 Vietnam", phone: "+84" },
  { code: "YE", label: "🇾🇪 Yemen", phone: "+967" },
  { code: "ZM", label: "🇿🇲 Zambia", phone: "+260" },
  { code: "ZW", label: "🇿🇼 Zimbabue", phone: "+263" }
];

export function TutorialClubGGPage() {
  const { isAuthenticated, user, profile, refreshProfile } = useAuthStore();
  
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedClub, setCopiedClub] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  
  // 🔥 ESTADOS PARA EL TELÉFONO SEPARADO
  const [phonePrefix, setPhonePrefix] = useState("+56");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [existingAccount, setExistingAccount] = useState(false);
  
  const [countryCode, setCountryCode] = useState("");
  const [clubggNick, setClubggNick] = useState("");
  const [wantsContact, setWantsContact] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [selectedTournament, setSelectedTournament] = useState<TournamentWithDetails | null>(null);
  
  // 🔥 ESTADOS PARA EL LOBBY
  const [lobbyTab, setLobbyTab] = useState<"mtt" | "cash">("mtt");
  const [cashTab, setCashTab] = useState<"NLH" | "PLO">("NLH"); // PLO agrupará PLO5 y PLO6
  const [showAllMtt, setShowAllMtt] = useState(false);

  // ESTADOS DINÁMICOS PARA EL ADMIN
  const [clubStats, setClubStats] = useState({
    usdToClp: 916,
    bbjClp: 8594561,
    lastUpdate: "26 de agosto de 2026 a las 09:00"
  });

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "latin_club_stats").maybeSingle()
      .then(({ data, error }) => {
        if (data?.value && !error) setClubStats(prev => ({ ...prev, ...data.value }));
      });
  }, []);

  const { data: upcomingTournaments, isLoading: loadingTournaments } = useUpcomingTournaments();
  
  const clubTournaments = (upcomingTournaments ?? []).filter((t) => {
    const clubName = (t.clubs as any)?.name?.toLowerCase() || "";
    return clubName.includes("circuito chileno") || clubName.includes("latin allin");
  });
  
  const displayedTournaments = showAllMtt ? clubTournaments : clubTournaments.slice(0, 8);
  
  // Filtramos por NLH o cualquier variante de PLO
  const filteredCashTables = CASH_TABLES.filter(t => t.type.startsWith(cashTab));

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

    // Validar número si no está logueado o si está logueado pero no tiene wsp
    if ((!isAuthenticated || !profile?.whatsapp) && !phoneNumber.trim()) {
      setError("El número de WhatsApp es obligatorio."); return;
    }

    // Unimos el prefijo con el número para guardar en base de datos (Ej: "56912345678")
    const finalWhatsapp = isAuthenticated && profile?.whatsapp 
      ? profile.whatsapp 
      : `${phonePrefix.replace('+', '')}${phoneNumber}`;

    setLoading(true);
    try {
      if (!isAuthenticated) {
        const result = await signUp(email, password, displayName, "player", {
          country_code: countryCode === "OTHER" ? "OT" : countryCode,
          whatsapp: finalWhatsapp,
        }, captchaToken!);

        if (result.user && (!result.user.identities || result.user.identities.length === 0)) {
          // 🔥 Novedad: En lugar de un error de texto, activamos la vista especial
          setExistingAccount(true);
          setLoading(false); 
          return;
        }

        if (result.user) {
          // 🔥 LLAMAMOS AL NUEVO RPC PARA SALTAR EL BLOQUEO DE SEGURIDAD (RLS)
          const { error: rpcError } = await supabase.rpc("update_latin_onboarding", {
            p_user_id: result.user.id,
            p_latin_nickname: clubggNick.trim(),
            p_whatsapp: finalWhatsapp
          });

          if (rpcError) throw new Error("No se pudo registrar la solicitud: " + rpcError.message);
          
          if (result.session?.user) {
            const newProfile = await getProfile(result.session.user.id);
            useAuthStore.setState({ user: result.session.user, profile: newProfile, isAuthenticated: true });
          }
          setSuccess("¡Cuenta creada y solicitud enviada! El cajero te contactará por WhatsApp.");
        }
      } else {
        // 🔥 LLAMAMOS AL MISMO RPC PARA USUARIOS EXISTENTES
        const { error: rpcError } = await supabase.rpc("update_latin_onboarding", {
          p_user_id: user!.id,
          p_latin_nickname: clubggNick.trim(),
          p_whatsapp: !profile?.whatsapp ? finalWhatsapp : null
        });

        if (rpcError) throw new Error("No se pudo actualizar la solicitud: " + rpcError.message);

        await refreshProfile();
        setSuccess("¡Solicitud enviada! El cajero te contactará a tu WhatsApp registrado.");
      }
    } catch (err) {
      setError(translateAuthError(err instanceof Error ? err.message : ""));
      turnstileRef.current?.reset(); setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: "Instala ClubGG", desc: "Descarga la app en tu celular o PC e inicia la instalación.", img: "/tutorial/2.jpeg" },
    { title: "Crea tu Cuenta", desc: "Abre la app, presiona 'Unirse' y regístrate con tu correo.", img: "/tutorial/4.jpeg" },
    { title: "Verifica tu Correo", desc: "Ingresa el código de 4 dígitos enviado a tu email.", img: "/tutorial/6.jpeg" },
    { title: "Configura tu Perfil", desc: "Elige una contraseña, tu país y tu Nickname de juego.", img: "/tutorial/10.jpeg" },
    { title: "Buscador de Clubes", desc: "En el menú principal, toca la lupa para 'Buscar Club'.", img: "/tutorial/14.jpeg" },
    { title: "Envía tu Solicitud", desc: "Ingresa nuestros IDs y presiona 'Unirse' al ver nuestro escudo.", img: "/tutorial/16.jpeg" },
  ];

  const inputClass = "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-3 px-4 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent transition-colors";
  const labelClass = "font-mono text-[10px] font-bold uppercase tracking-widest text-sk-text-3 mb-1.5 block";

  return (
    <PageShell>
      <SEOHead title="Club LatinAllinPoker en ClubGG | Sharkania" description="Únete al Club LatinAllinPoker en ClubGG. Fichas en CLP, soporte 24/7, Bad Beat Jackpot activo y retiros garantizados." path="/como-jugar-en-clubgg" />
      
      {/* 🔥 WIDGET FLOTANTE DE CAJERO DE WHATSAPP (SIEMPRE ABIERTO) */}
      <a 
        href="https://wa.me/56977910256?text=Hola,%20me%20gustar%C3%ADa%20realizar%20una%20recarga%20en%20el%20Club%20LatinAllinPoker" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[100] bg-emerald-500 hover:bg-emerald-600 text-white rounded-full p-3 shadow-[0_10px_30px_rgba(16,185,129,0.4)] hover:shadow-[0_10px_40px_rgba(16,185,129,0.6)] hover:-translate-y-1 transition-all duration-300 flex items-center gap-3 animate-bounce-subtle border-2 border-emerald-400"
      >
        <div className="relative shrink-0 ml-1">
          <MessageCircle size={26} />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-emerald-500 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-emerald-500 rounded-full" />
        </div>
        <div className="flex flex-col pr-3 whitespace-nowrap overflow-hidden">
          <span className="text-[10px] uppercase tracking-widest font-bold opacity-90 leading-tight">Habla con nosotros</span>
          <span className="font-black leading-tight text-sm">Cajeros en Línea 24/7</span>
        </div>
      </a>

      <div className="pt-20 pb-16">
        <div className="max-w-[1000px] mx-auto px-6">
          
          {/* ══ HERO SECTION (PERFIL DEL CLUB) ══ */}
          <div className="bg-gradient-to-br from-sk-bg-2 to-sk-bg-3 border border-sk-border-2 rounded-3xl p-8 mb-6 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sk-accent to-transparent opacity-50" />
            
            <div className="shrink-0 relative z-10 hidden md:block">
              <img src="/logos/latin-logo.png" alt="Latin All in Poker" className="w-36 h-36 object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] hover:scale-105 transition-transform duration-500" />
            </div>
            
            <div className="flex-1 text-center md:text-left relative z-10 w-full">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sk-bg-1 border border-sk-border-2 text-[10px] font-bold text-sk-text-2 uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-sk-green animate-pulse" /> Club Activo 24/7
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                  <ShieldCheck size={12} /> Unión CCP
                </span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
                LatinAllinPoker Club
              </h1>
              <p className="text-sk-text-2 text-lg leading-relaxed max-w-2xl mx-auto md:mx-0">
                Tu puerta de entrada a la mejor acción de Póker en Latinoamérica. Acción 24/7 en NLH, PLO5 y Torneos Garantizados.
              </p>
            </div>
          </div>

          {/* 🔥 SECCIÓN GIGANTE DEL BAD BEAT JACKPOT (EN CLP) */}
          <div className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/40 via-sk-bg-2 to-sk-bg-3 border border-red-500/30 rounded-3xl p-8 mb-10 flex flex-col items-center text-center shadow-[0_0_40px_rgba(239,68,68,0.15)] relative overflow-hidden group hover:border-red-500/50 transition-colors">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-red-500/20 blur-[60px] pointer-events-none group-hover:bg-red-500/30 transition-colors" />
            
            <Flame className="text-red-500 mb-3 relative z-10 animate-pulse" size={40} />
            <h3 className="text-xl md:text-2xl font-black text-white mb-1 relative z-10 tracking-tight uppercase">
              Bad Beat Jackpot Activo
            </h3>
            
            <div className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-orange-400 to-red-500 mb-3 relative z-10 drop-shadow-sm tracking-tighter">
              ${clubStats.bbjClp.toLocaleString("es-CL")} CLP
            </div>
            
            <div className="inline-flex items-center gap-2 bg-black/40 border border-white/10 px-4 py-2 rounded-lg font-mono text-sm md:text-base text-sk-text-2 relative z-10 mb-4">
              <span>Equivalente:</span>
              <strong className="text-emerald-400 font-bold">
                ${Math.round(clubStats.bbjClp / clubStats.usdToClp).toLocaleString("en-US")} USD
              </strong>
            </div>

            <span className="text-[10px] text-sk-text-4 uppercase tracking-widest relative z-10 font-mono">
              Última actualización: {clubStats.lastUpdate}
            </span>
          </div>

          {/* ══ STATS BAR (CONFIANZA) ══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-sk-accent/50 transition-colors">
              <ShieldCheck className="text-sk-accent mb-2" size={28} />
              <strong className="text-white font-bold block">100% Garantizado</strong>
              <span className="text-[11px] text-sk-text-4">Depósitos y Retiros</span>
            </div>
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-sk-accent/50 transition-colors">
              <Zap className="text-yellow-400 mb-2" size={28} />
              <strong className="text-white font-bold block">Liquidación Inmediata</strong>
              <span className="text-[11px] text-sk-text-4">Cargas automáticas</span>
            </div>
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-sk-accent/50 transition-colors">
              <HeadphonesIcon className="text-blue-400 mb-2" size={28} />
              <strong className="text-white font-bold block">Soporte 24/7</strong>
              <span className="text-[11px] text-sk-text-4">Cajeros siempre activos</span>
            </div>
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:border-sk-accent/50 transition-colors">
              <Coins className="text-emerald-400 mb-2" size={28} />
              <strong className="text-white font-bold block">Fichas = CLP</strong>
              <span className="text-[11px] text-sk-text-4">Juega en tu moneda</span>
            </div>
          </div>

          <h2 className="text-3xl font-black text-center text-white mb-10">Empieza a jugar en 3 simples pasos</h2>

          {/* ══ FUNNEL DE 3 PASOS ══ */}
          <div className="grid lg:grid-cols-3 gap-6 mb-16">
            
            {/* PASO 1 */}
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-6 flex flex-col relative pt-10">
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-sk-bg-1 border-2 border-sk-accent text-sk-accent font-black flex items-center justify-center text-lg">1</div>
              <h3 className="text-xl font-bold text-white mb-2">Descarga ClubGG</h3>
              <p className="text-sm text-sk-text-3 mb-6 flex-1">Instala la app oficial gratuita en tu dispositivo y crea tu cuenta nueva.</p>
              <div className="space-y-3 mt-auto">
                <a href={CLUB_DATA.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-white transition-colors">
                  <Download size={18} /> iOS / Android / PC
                </a>
              </div>
            </div>

            {/* PASO 2 */}
            <div className="bg-sk-bg-2 border-2 border-sk-accent/40 shadow-[0_0_30px_rgba(249,115,22,0.1)] rounded-2xl p-6 flex flex-col relative pt-10">
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-sk-accent text-white font-black flex items-center justify-center text-lg shadow-lg">2</div>
              <h3 className="text-xl font-bold text-white mb-2">Ingresa los IDs</h3>
              <p className="text-sm text-sk-text-3 mb-6 flex-1">En la app, presiona <strong>"Buscar Club"</strong> (ícono de lupa) y copia estos datos exactos:</p>
              
              <div className="space-y-4 mt-auto">
                <div>
                  <label className="text-[10px] font-mono text-sk-text-4 uppercase tracking-widest mb-1 block">ID del Club</label>
                  <div className="flex bg-sk-bg-0 border border-sk-border-2 rounded-lg overflow-hidden">
                    <span className="flex-1 px-4 py-3 font-black text-lg text-white">{CLUB_DATA.clubId}</span>
                    <button onClick={() => copyToClipboard(CLUB_DATA.clubId, "club")} className="px-5 bg-sk-bg-3 hover:bg-sk-border-2 transition-colors border-l border-sk-border-2 flex items-center justify-center">
                      {copiedClub ? <CheckCircle2 size={20} className="text-sk-green" /> : <Copy size={20} className="text-sk-text-2 hover:text-white" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono text-sk-text-4 uppercase tracking-widest mb-1 block">ID de Recomendación</label>
                  <div className="flex bg-sk-bg-0 border border-sk-border-2 rounded-lg overflow-hidden">
                    <span className="flex-1 px-4 py-3 font-black text-lg text-white">{CLUB_DATA.refId}</span>
                    <button onClick={() => copyToClipboard(CLUB_DATA.refId, "ref")} className="px-5 bg-sk-bg-3 hover:bg-sk-border-2 transition-colors border-l border-sk-border-2 flex items-center justify-center">
                      {copiedRef ? <CheckCircle2 size={20} className="text-sk-green" /> : <Copy size={20} className="text-sk-text-2 hover:text-white" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* PASO 3 */}
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-6 flex flex-col relative pt-10">
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-sk-bg-1 border-2 border-sk-accent text-sk-accent font-black flex items-center justify-center text-lg">3</div>
              <h3 className="text-xl font-bold text-white mb-2">Verificación y Cajero</h3>
              <p className="text-sm text-sk-text-3 mb-6 flex-1">Completa el formulario que está justo abajo. Te aceptaremos en el club y un cajero te contactará por WhatsApp para cargar tus fichas.</p>
              <div className="mt-auto bg-sk-bg-0 p-4 rounded-xl border border-sk-border-2 text-center">
                <AlertCircle className="text-sk-accent mx-auto mb-2" size={24} />
                <p className="text-[11px] text-sk-text-3 font-bold uppercase tracking-widest">Paso vital para seguridad</p>
              </div>
            </div>

          </div>

          {/* ══ CAJA DE MONEDA Y CAJERO ══ */}
          <div className="bg-gradient-to-r from-emerald-900/30 to-sk-bg-2 border border-emerald-500/30 rounded-2xl p-6 md:p-8 mb-16 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_30px_rgba(16,185,129,0.05)]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Coins size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white mb-1">El club opera en Pesos Chilenos (CLP)</h3>
                <p className="text-sm text-sk-text-2 mb-3">Tus fichas en la mesa equivalen directamente a dinero real chileno (1 Ficha = $1 CLP).</p>
                <div className="inline-flex flex-wrap items-center gap-3 bg-sk-bg-0 border border-sk-border-2 px-4 py-2 rounded-lg font-mono text-sm">
                  <span className="text-sk-text-3">1 USD / 1 USDT</span>
                  <ArrowRight size={14} className="text-sk-text-4" />
                  <strong className="text-emerald-400 text-lg">${clubStats.usdToClp} CLP</strong>
                </div>
              </div>
            </div>
            <div className="text-left md:text-right shrink-0">
              <p className="text-xs text-sk-text-3 mb-2 font-bold uppercase tracking-wider">Métodos de pago aceptados</p>
              <div className="flex gap-2">
                <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white font-semibold">Transferencia</span>
                <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white font-semibold">USDT Crypto</span>
              </div>
            </div>
          </div>

          {/* ══ FORMULARIO DE ONBOARDING ══ */}
          <div className="max-w-2xl mx-auto mb-20">
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-3xl p-6 md:p-10 shadow-2xl relative">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-sk-accent/10 text-sk-accent mb-4">
                  <UserPlus size={28} />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">Formulario de Ingreso</h2>
                <p className="text-sk-sm text-sk-text-3">Necesitamos registrar tu cuenta para habilitarte en nuestras mesas privadas de ClubGG.</p>
              </div>

              {profile?.latin_status === "pending" || profile?.latin_status === "contacted" ? (
                <div className="bg-sk-green-dim border border-sk-green/30 rounded-xl p-8 text-center">
                  <CheckCircle2 size={48} className="text-sk-green mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">¡Tu solicitud está en proceso!</h3>
                  <p className="text-sk-sm text-sk-green">Tu nickname asociado es: <strong className="text-white">{profile.latin_nickname}</strong></p>
                  <p className="text-sk-sm text-sk-green mt-2">El cajero te hablará muy pronto a tu WhatsApp para coordinar tus primeras fichas.</p>
                </div>
              ) : existingAccount ? (
                <div className="bg-sk-bg-1 border border-sk-accent/30 rounded-xl p-8 text-center space-y-4 shadow-[0_0_20px_rgba(249,115,22,0.1)]">
                  <AlertCircle size={48} className="text-sk-accent mx-auto mb-2" />
                  <h3 className="text-2xl font-black text-white">¡Ya tienes una cuenta!</h3>
                  <p className="text-sk-sm text-sk-text-2">
                    El correo <strong className="text-white">{email}</strong> ya está registrado en Sharkania.
                  </p>
                  <p className="text-sk-sm text-sk-text-3 mb-6">
                    No necesitas registrarte de nuevo. Haz clic abajo para contactar al cajero por WhatsApp, indícale que ya tienes cuenta y dale tu Nickname de ClubGG para habilitarte.
                  </p>
                  <a 
                    href={`https://wa.me/56977910256?text=Hola,%20ya%20tengo%20cuenta%20en%20Sharkania%20con%20el%20correo%20${email}%20y%20quiero%20entrar%20al%20club%20LatinAllinPoker.%20Mi%20nickname%20en%20ClubGG%20es:%20`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-lg transition-colors w-full shadow-lg"
                  >
                    <MessageCircle size={20} />
                    Contactar Cajero por WhatsApp
                  </a>
                  <Button variant="ghost" className="w-full mt-4 text-sk-text-4" onClick={() => setExistingAccount(false)}>
                    Volver al formulario
                  </Button>
                </div>
              ) : success ? (
                <div className="bg-sk-green-dim border border-sk-green/30 rounded-xl p-8 text-center">
                  <CheckCircle2 size={48} className="text-sk-green mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">¡Solicitud Enviada con Éxito!</h3>
                  <p className="text-sk-sm text-sk-green">{success}</p>
                </div>
              ) : (
                <form onSubmit={handleRegistrationSubmit} className="space-y-6">
                  {!isAuthenticated && (
                    <div className="space-y-4 bg-sk-bg-1 p-6 rounded-xl border border-sk-border-2">
                      <h4 className="text-sm font-bold text-sk-accent uppercase tracking-wider mb-2 border-b border-sk-border-2 pb-2">1. Crea tu perfil en Sharkania</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div><label className={labelClass}>Nombre Real *</label><input type="text" required value={displayName} onChange={e=>setDisplayName(e.target.value)} className={inputClass} placeholder="Ej: Juan Pérez" /></div>
                        <div><label className={labelClass}>Email *</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className={inputClass} placeholder="tu@correo.com" /></div>
                        <div><label className={labelClass}>Contraseña *</label><input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" /></div>
                        <div>
                          <label className={labelClass}>País *</label>
                          <select required value={countryCode} onChange={e=>setCountryCode(e.target.value)} className={inputClass}>
                            <option value="">Selecciona tu país</option>
                            {WORLD_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 bg-sk-bg-1 p-6 rounded-xl border border-sk-accent/30 shadow-[0_0_15px_rgba(249,115,22,0.05)]">
                    <h4 className="text-sm font-bold text-sk-accent uppercase tracking-wider mb-2 border-b border-sk-border-2 pb-2">{!isAuthenticated ? "2." : "1."} Datos de Jugador VIP</h4>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nickname en ClubGG *</label>
                        <input type="text" required value={clubggNick} onChange={e=>setClubggNick(e.target.value)} className={inputClass} placeholder="Tu nick en la app" />
                      </div>
                      
                      {/* 🔥 WHATSAPP MEJORADO CON PREFIJO SEPARADO */}
                      <div>
                        <label className={labelClass}>WhatsApp Real *</label>
                        {isAuthenticated && !!profile?.whatsapp ? (
                          <input 
                            type="tel" 
                            disabled 
                            value={`+${profile.whatsapp}`} 
                            className={cn(inputClass, "opacity-50 cursor-not-allowed")} 
                          />
                        ) : (
                          <div className="flex gap-2">
                            <select 
                              value={phonePrefix} 
                              onChange={e => setPhonePrefix(e.target.value)} 
                              className="bg-sk-bg-0 border border-sk-border-2 rounded-md py-3 px-2 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent transition-colors w-[105px] shrink-0"
                            >
                              {WORLD_COUNTRIES.map(p => (
                                <option key={p.code} value={p.phone}>{p.label.split(' ')[0]} {p.phone}</option>
                              ))}
                            </select>
                            <input 
                              type="tel" 
                              required 
                              value={phoneNumber} 
                              onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))} 
                              className={inputClass} 
                              placeholder="9 1234 5678" 
                            />
                          </div>
                        )}
                        <span className="text-[10px] text-sk-text-4 mt-1 block">
                          {isAuthenticated && !!profile?.whatsapp 
                            ? "Número ya registrado en tu cuenta." 
                            : "Ingresa tu número sin el código de país."}
                        </span>
                      </div>
                    </div>

                    <label className="flex items-start gap-3 p-4 bg-sk-bg-0 border border-sk-border-2 rounded-xl cursor-pointer hover:border-sk-accent/50 transition-colors mt-4">
                      <input type="checkbox" required checked={wantsContact} onChange={e=>setWantsContact(e.target.checked)} className="mt-1 w-4 h-4 accent-sk-accent" />
                      <span className="text-xs text-sk-text-2 leading-relaxed">
                        Acepto que un administrador me contacte por WhatsApp para abrir mi canal seguro de carga y descargas, y para ser agregado al grupo VIP de la comunidad.
                      </span>
                    </label>
                  </div>

                  {error && <p className="text-sm text-sk-red bg-sk-red-dim p-4 rounded-xl border border-sk-red/20 font-medium text-center">{error}</p>}

                  {!isAuthenticated && (
                    <div className="flex justify-center my-4"><Turnstile ref={turnstileRef} siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} options={{ theme: "dark" }} /></div>
                  )}

                  <Button type="submit" variant="accent" size="lg" className="w-full text-lg h-14 font-black tracking-wider uppercase shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] transition-all" isLoading={loading} disabled={(!isAuthenticated && !captchaToken) || loading}>
                    Enviar y Conectar Cajero
                  </Button>
                </form>
              )}
            </div>
          </div>

          {/* ══ LOBBY INTERACTIVO (MTT Y CASH) ══ */}
          <div className="mb-24">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-3">
                <Layers className="text-sk-accent" size={32} />
                <div className="flex flex-col text-center md:text-left">
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-none">Lobby del Club</h2>
                  <span className="text-xs text-sk-text-3 font-mono mt-1">Explora la acción disponible en LatinAllinPoker</span>
                </div>
              </div>

              {/* Pestañas del Lobby */}
              <div className="flex bg-sk-bg-0 p-1.5 rounded-xl border border-sk-border-2 w-full md:w-auto shrink-0">
                <button 
                  onClick={() => setLobbyTab("mtt")} 
                  className={cn("flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all", lobbyTab === "mtt" ? "bg-sk-bg-3 text-white shadow-md" : "text-sk-text-3 hover:text-white")}
                >
                  <CalendarDays size={16} /> Torneos MTT
                </button>
                <button 
                  onClick={() => setLobbyTab("cash")} 
                  className={cn("flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all", lobbyTab === "cash" ? "bg-sk-bg-3 text-white shadow-md" : "text-sk-text-3 hover:text-white")}
                >
                  <Coins size={16} /> Mesas Cash
                </button>
              </div>
            </div>

            {/* CONTENIDO MTT */}
            {lobbyTab === "mtt" && (
              <>
                {loadingTournaments ? (
                  <div className="flex justify-center py-10">
                    <Spinner size="lg" />
                  </div>
                ) : clubTournaments.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {displayedTournaments.map((t) => (
                        <TournamentCard 
                          key={t.id} 
                          tournament={t} 
                          onInfoClick={() => setSelectedTournament(t)}
                        />
                      ))}
                    </div>
                    {clubTournaments.length > 8 && !showAllMtt && (
                      <div className="mt-8 flex justify-center">
                        <Button variant="secondary" onClick={() => setShowAllMtt(true)} className="border-sk-border-2 hover:border-sk-accent/50 text-sk-text-2 hover:text-white">
                          Mostrar {clubTournaments.length - 8} torneos más ↓
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-12 text-center flex flex-col items-center justify-center">
                    <CalendarOff className="text-sk-text-4 mb-4 opacity-50" size={48} />
                    <h3 className="text-sk-lg font-bold text-sk-text-1 mb-2">No hay torneos próximos</h3>
                    <p className="text-sk-text-3 text-sk-sm max-w-md mx-auto">
                      No hay torneos programados para los próximos días en este club. Vuelve más tarde.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* CONTENIDO CASH GAMES */}
            {lobbyTab === "cash" && (
              <div className="animate-fade-in">
                {/* Sub-Pestañas Cash */}
                <div className="flex gap-2 mb-6 justify-center md:justify-start">
                  <button 
                    onClick={() => setCashTab("NLH")} 
                    className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border", cashTab === "NLH" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" : "bg-sk-bg-2 text-sk-text-3 border-sk-border-2 hover:border-sk-text-3")}
                  >
                    NLH (Hold'em)
                  </button>
                  <button 
                    onClick={() => setCashTab("PLO")} 
                    className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors border", cashTab === "PLO" ? "bg-blue-500/20 text-blue-400 border-blue-500/50" : "bg-sk-bg-2 text-sk-text-3 border-sk-border-2 hover:border-sk-text-3")}
                  >
                    PLO (Omaha 5 & 6)
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCashTables.map(table => (
                    <div key={table.id} className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5 relative overflow-hidden group hover:border-sk-accent/50 transition-colors shadow-lg flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className={cn("text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-sm inline-flex items-center gap-1", table.type === "NLH" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400")}>
                            {table.type} ({table.maxPlayers}max)
                          </span>
                          
                          <div className="flex items-center gap-1.5 bg-sk-bg-0 px-2 py-1 rounded border border-sk-border-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sk-green animate-pulse" />
                            <span className="text-xs font-mono text-sk-text-2">Activa 24/7</span>
                          </div>
                        </div>

                        <h4 className="text-white font-bold mb-3 text-base">{table.name}</h4>

                        {/* Badges de características especiales (BBJ, Bombpot, Straddle, Deep) */}
                        <div className="flex flex-wrap gap-1 mb-4">
                          {table.features.map((feat, fIdx) => (
                            <span key={fIdx} className={cn("text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider", 
                              feat === "BBJ" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                              feat === "BOMBPOT" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                              feat === "STRADDLE" ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                              "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                            )}>
                              {feat}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-sk-border-2 pt-3 mt-auto">
                        <div>
                          <p className="text-[10px] text-sk-text-4 uppercase tracking-widest mb-0.5">Ciegas (CLP)</p>
                          <p className="text-lg font-black text-sk-gold">{table.stakes}</p>
                        </div>
                        <a 
                          href="https://wa.me/56977910256?text=Hola,%20me%20gustaría%20sentarme%20en%20una%20mesa%20de%20cash"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-sk-accent/10 hover:bg-sk-accent/20 border border-sk-accent/30 rounded-lg text-xs font-bold text-sk-accent transition-colors"
                        >
                          Sentarse ➔
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ══ GUÍA VISUAL DETALLADA (COLLAPSIBLE / SECTION FINAL) ══ */}
          <div className="border-t border-sk-border-2 pt-16">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-white mb-2">¿Necesitas ayuda visual?</h2>
              <p className="text-sk-text-3">Aquí tienes la guía paso a paso con imágenes de la aplicación de ClubGG.</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {steps.map((step, idx) => (
                <div key={idx} className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden group">
                  <div className="p-3 border-b border-sk-border-2 bg-sk-bg-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-sk-bg-3 text-[10px] font-bold text-white flex items-center justify-center">{idx + 1}</span>
                    <h4 className="text-[11px] font-bold text-white truncate">{step.title}</h4>
                  </div>
                  <div className="relative overflow-hidden aspect-[9/16] bg-black">
                    <img src={step.img} alt={`Paso ${idx + 1}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <TournamentDetailModal
        tournament={selectedTournament}
        isOpen={!!selectedTournament}
        onClose={() => setSelectedTournament(null)}
      />
    </PageShell>
  );
}