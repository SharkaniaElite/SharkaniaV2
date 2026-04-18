import { useState, useMemo } from "react";
import { PageShell } from "../components/layout/page-shell";
import { Spinner } from "../components/ui/spinner";
import { Button } from "../components/ui/button";
import { SEOHead } from "../components/seo/seo-head";
import { useShopProducts, useUserPurchases, usePurchaseProduct, useSharkCoinsBalance } from "../hooks/use-shop";
import { useAuthStore } from "../stores/auth-store";
import { Lock, Sparkles, CheckCircle2, FlaskConical, Zap, Hammer, ExternalLink, Gift, Clock, AlertTriangle } from "lucide-react";
import { cn } from "../lib/cn";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { ShopProduct } from "../types";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

// ─── LISTA BLANCA: SOLO LO QUE ESTÁ PROGRAMADO Y FUNCIONANDO ───
const IMPLEMENTED_FEATURES = [
  "tool_icm",
  "tool_elo_sim",
  "bankroll_calculator",
  "tool_replayer",
  "cosmetic_extended_stats",
  "tool_quiz", // 👈 AÑADIDO EL QUIZ AQUÍ
];

// ─── CONFIGURACIÓN DE RUTAS Y FONDOS (/bg/...) ───
const TOOL_CONFIG: Record<string, { path: string; bgImage: string; label: string }> = {
  "tool_icm": { path: "/icm-calculator", bgImage: "/bg/icm.webp", label: "Ir a la Calculadora ICM" },
  "tool_elo_sim": { path: "/elo-simulator", bgImage: "/bg/elo.webp", label: "Ir al Simulador" },
  "bankroll_calculator": { path: "/bankroll-calculator", bgImage: "/bg/bankroll.webp", label: "Ir a Gestión de Banca" },
  "tool_replayer": { path: "/replayer", bgImage: "/bg/replayer.webp", label: "Ir al Replayer" },
  "cosmetic_extended_stats": { path: "/ranking", bgImage: "/bg/stats.webp", label: "Probar en el Ranking" },
  "tool_quiz": { path: "/tools/quiz", bgImage: "/bg/quiz.webp", label: "Ir al Quiz" }, // 👈 AÑADIDA RUTA DEL QUIZ
};

// ─── DATOS DUROS PARA LA PESTAÑA "EN DESARROLLO" ───
const UPCOMING_FEATURES = [
  {
    id: "cosmetic_glow",
    name: "Nickname Destacado (Glow)",
    icon: "✨",
    description: "Tu nombre brillará en los rankings globales. Demuestra tu estatus en el ecosistema.",
    tag: "Próximamente vía XP"
  },
  {
    id: "cosmetic_badge",
    name: "Badges de Logros",
    icon: "🏅",
    description: "Emblemas exclusivos junto a tu nombre por ganar ligas o torneos multitudinarios.",
    tag: "Próximamente vía XP"
  },
  {
    id: "cosmetic_banner",
    name: "Banners de Perfil Custom",
    icon: "🎨",
    description: "Personaliza tu perfil público con arte exclusivo de la bóveda de Sharkania.",
    tag: "Próximamente vía XP"
  },
  {
    id: "report_monthly",
    name: "Reporte Mensual Personalizado",
    icon: "📋",
    description: "Análisis detallado de tu rendimiento: evolución ELO, fugas detectadas y recomendaciones de estudio.",
    tag: "Laboratorio"
  },
  {
    id: "report_club_trends",
    name: "Tendencias de Club",
    icon: "🏦",
    description: "Dashboard avanzado para administradores: retención, crecimiento orgánico y horarios calientes.",
    tag: "Laboratorio"
  },
  {
    id: "tool_rival_analysis",
    name: "Rayos X de Rivales",
    icon: "👁️",
    description: "Selecciona a un jugador y obtén un análisis head-to-head completo y tendencias de explotación.",
    tag: "Laboratorio"
  },
  {
    id: "tool_elo_dna",
    name: "Radar ELO DNA",
    icon: "🧬",
    description: "Radar completo de tu estilo de juego y comparación directa con la élite del ranking global.",
    tag: "Laboratorio"
  }
];

// ─── COMPONENTE DE TARJETA AGRUPADA ───
function ProductCardGroup({
  group,
  activePurchase,
  balance,
  onPurchase,
  isPurchasing,
  isAuthenticated,
  navigate,
}: {
  group: { feature_key: string; name: string; description: string; icon: string; options: ShopProduct[]; free_tier: string | null };
  activePurchase: any;
  balance: number;
  onPurchase: (slug: string) => void;
  isPurchasing: boolean;
  isAuthenticated: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const defaultOptionId = group.options[group.options.length - 1]?.id;
  const [selectedId, setSelectedId] = useState(defaultOptionId);
  const selectedOption = group.options.find((o) => o.id === selectedId) || group.options[0];

  const currentPrice = selectedOption?.price_coins ?? 0;
  const canAfford = balance >= currentPrice;
  const config = TOOL_CONFIG[group.feature_key];

  // Consultar estado WPT
  const { data: wptStatus } = useQuery({
    queryKey: ["wpt-status", activePurchase?.user_id], 
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      if (!session.data.session?.user.id) return "none";
      const { data } = await supabase
        .from("players")
        .select("wpt_status")
        .eq("profile_id", session.data.session.user.id)
        .limit(1)
        .single();
      return data?.wpt_status || "none";
    },
    enabled: isAuthenticated,
  });

  const hasAccess = activePurchase || wptStatus === "verified";

  // Extraemos la descripción dinámica según el botón seleccionado
  const currentDescription = (selectedOption as any)?.premium_description || selectedOption?.description || group.description;

  const formatDuration = (days: number | null | undefined, index: number, total: number) => {
    if (days === 1) return "24 Hrs";
    if (days === 30) return "30 Días";
    if (days && days > 0) return `${days} Días`;
    
    // Fallback robusto si la DB arroja null
    if (total >= 2) return index === 0 ? "24 Hrs" : "30 Días";
    return "Ilimitado";
  };

  return (
    <div 
      className="bg-sk-bg-2 border border-sk-border-2 rounded-xl flex flex-col h-full hover:border-sk-accent/50 hover:shadow-[0_4px_30px_rgba(34,211,238,0.05)] transition-all duration-300 relative overflow-hidden group"
      style={config?.bgImage ? {
        backgroundImage: `linear-gradient(to bottom, rgba(12,13,16,0.65), rgba(12,13,16,0.98)), url('${config.bgImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      } : undefined}
    >
      <div className="p-6 flex flex-col h-full relative z-10">
        
        {group.free_tier && !activePurchase && (
          <div className="absolute top-0 right-0 bg-sk-green/10 text-sk-green text-[10px] font-bold px-3 py-1.5 rounded-bl-lg border-b border-l border-sk-green/20 flex items-center gap-1.5 shadow-sm">
            <Gift size={12} /> {group.free_tier}
          </div>
        )}

        <div className="flex items-center gap-4 mb-3 mt-1">
          <div className="w-12 h-12 rounded-lg bg-sk-bg-0/80 backdrop-blur-sm border border-sk-border-2 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
            {group.icon}
          </div>
          <h3 className="text-sk-md font-bold text-sk-text-1 leading-tight tracking-tight group-hover:text-sk-accent transition-colors">
            {group.name}
          </h3>
        </div>

        {/* Descripción Dinámica */}
        <p className="text-sk-sm text-sk-text-2 mb-6 flex-1 leading-relaxed min-h-[60px]">
          {currentDescription}
        </p>

        {!hasAccess && group.options.length > 1 && (
          <div className="flex bg-sk-bg-0/80 backdrop-blur-sm p-1 rounded-lg border border-sk-border-2 mb-5">
            {group.options.map((opt, idx) => (
              <button
                key={opt.id}
                onClick={() => setSelectedId(opt.id)}
                className={cn(
                  "flex-1 text-[11px] font-mono font-bold py-1.5 rounded-md transition-all uppercase tracking-widest",
                  selectedId === opt.id
                    ? "bg-sk-bg-3 text-sk-text-1 shadow-sm border border-sk-border-3"
                    : "text-sk-text-3 hover:text-sk-text-2 border border-transparent"
                )}
              >
                {formatDuration(opt.duration_days, idx, group.options.length)}
              </button>
            ))}
          </div>
        )}

        {/* 🔥 WPT UNLOCK BADGE DINÁMICO */}
        {!hasAccess && (
          <div className="mb-4 bg-sk-bg-3/50 border border-sk-border-2 rounded-lg p-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-sk-accent" />
            
            {wptStatus === "none" || !isAuthenticated ? (
              <>
                <p className="text-[11px] font-bold text-sk-text-1 flex items-center gap-1.5 mb-1.5">
                  <Gift size={12} className="text-sk-accent" /> Desbloqueo VIP Gratuito
                </p>
                <p className="text-[10px] text-sk-text-3 leading-snug mb-2">
                  1. Regístrate en WPT Global con el link a continuación y usa el código <strong className="text-sk-accent font-mono bg-sk-accent/10 px-1 py-0.5 rounded">FPHL</strong>.<br/>
                  2. Ingresa tu nickname en tu Panel de Jugador.
                </p>
                <div className="flex flex-col gap-1.5">
                  <a href="https://tracking.wptpartners.com/visit/?bta=35660&brand=wptglobal" target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="w-full text-[10px] h-7 border border-sk-accent/30 text-sk-accent hover:bg-sk-accent-dim">
                      Paso 1: Crear cuenta WPT <ExternalLink size={10} className="ml-1" />
                    </Button>
                  </a>
                  <Button variant="secondary" size="sm" className="w-full text-[10px] h-7" onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}>
                    Paso 2: Vincular en mi Panel
                  </Button>
                </div>
              </>
            ) : wptStatus === "pending" ? (
              <div className="text-center py-2">
                <Clock size={20} className="text-sk-orange mx-auto mb-1.5 animate-pulse" />
                <p className="text-[11px] font-bold text-sk-orange">Verificación en progreso...</p>
                <p className="text-[9px] text-sk-text-3 mt-1">El admin está validando tu registro en WPT. Esto puede demorar hasta 24h.</p>
              </div>
            ) : wptStatus === "rejected" ? (
              <div className="text-center py-2">
                <AlertTriangle size={20} className="text-sk-red mx-auto mb-1.5" />
                <p className="text-[11px] font-bold text-sk-red">Verificación denegada</p>
                <p className="text-[9px] text-sk-text-3 mt-1">El registro no se realizó con nuestro enlace o código. Revisa tu panel.</p>
                <Button variant="secondary" size="sm" className="w-full text-[10px] h-7 mt-2" onClick={() => navigate("/dashboard")}>
                  Revisar en mi Panel
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {hasAccess ? (
          <div className="mt-auto pt-4 border-t border-sk-border-2 bg-sk-bg-0/50 backdrop-blur-sm -mx-6 -mb-6 px-6 pb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sk-sm text-sk-green font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Acceso Activado
                </p>
                <p className="text-[10px] text-sk-text-3 font-mono mt-0.5">
                  {wptStatus === "verified" ? "— Beneficio WPT VIP" : `- ${currentPrice} SC descontados`}
                </p>
              </div>
              <div className="text-right">
                {wptStatus === "verified" || !activePurchase?.expires_at ? (
                  <p className="text-[11px] text-sk-green font-mono uppercase tracking-widest">Ilimitado</p>
                ) : (
                  <p className="text-[11px] text-sk-text-3 font-mono">
                    Expira: {format(new Date(activePurchase.expires_at), "dd MMM")}
                  </p>
                )}
              </div>
            </div>
            
            {config && (
              <Button variant="secondary" size="sm" className="w-full gap-2 hover:bg-sk-bg-3" onClick={() => navigate(config.path)}>
                <ExternalLink size={14} /> {config.label}
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-auto pt-5 border-t border-sk-border-2 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-sk-accent font-mono font-black text-xl bg-sk-bg-0/50 px-2 py-1 rounded-md">
                {currentPrice}
                <img
                  src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif"
                  alt="SC"
                  className="w-5 h-5 drop-shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                {group.free_tier && config && (
                  <Button variant="secondary" size="sm" onClick={() => navigate(config.path)} className="bg-sk-bg-0/80 backdrop-blur-sm hover:bg-sk-bg-3">
                    Probar
                  </Button>
                )}

                {!isAuthenticated ? (
                  <Button variant="accent" size="sm" onClick={() => navigate("/register")}>
                    Ingresar
                  </Button>
                ) : selectedOption ? (
                  <Button
                    variant="accent"
                    size="sm"
                    disabled={!canAfford || isPurchasing}
                    onClick={() => onPurchase(selectedOption.slug!)}
                    className="shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
                  >
                    {isPurchasing ? <Spinner size="sm" /> : canAfford ? "Adquirir" : "Sin Saldo"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ───
export function ShopPage() {
  const navigate = useNavigate();
  const [mascotId] = useState(() => Math.floor(Math.random() * 10) + 1);
  const [tab, setTab] = useState<"active" | "upcoming">("active");

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  
  const { data: products, isLoading } = useShopProducts();
  const { data: purchases } = useUserPurchases();
  const { data: balance } = useSharkCoinsBalance();
  const { mutate: purchase, isPending: isPurchasing } = usePurchaseProduct();

  // 1. Agrupar productos (100% Type-Safe / Bypassa noUncheckedIndexedAccess)
  const groupedProducts = useMemo(() => {
    if (!products) return [];
    
    const map = new Map<
      string,
      { feature_key: string; name: string; description: string; icon: string; options: ShopProduct[]; free_tier: string | null }
    >();

    products.forEach((p) => {
      // Ignoramos si no tiene feature_key o si no está activo
      if (!p.feature_key || !IMPLEMENTED_FEATURES.includes(p.feature_key)) {
        return;
      }

      const fKey = String(p.feature_key);

      // 1. Intentamos obtener el grupo directamente
      let group = map.get(fKey);

      // 2. Si no existe, lo creamos y lo asignamos a la variable al mismo tiempo
      if (!group) {
        // SOLUCIÓN AL NOMBRE: Garantizamos un texto de respaldo si el split[0] da undefined
        const safeName = p.name ? String(p.name) : "Herramienta";
        let cleanName = safeName.split(" — ")[0] || safeName;
        cleanName = cleanName.split(" - ")[0] || cleanName;
        
        const anyP = p as any;
        const rawDesc = anyP.premium_description || p.description;
        
        group = {
          feature_key: fKey,
          name: cleanName,
          description: rawDesc ? String(rawDesc) : "",
          icon: p.icon ? String(p.icon) : "⚙️",
          free_tier: p.free_tier_description ? String(p.free_tier_description) : null,
          options: [],
        };
        
        map.set(fKey, group);
      }

      // SOLUCIÓN AL UNDEFINED: TypeScript sabe que 'group' ya fue creado arriba si no existía.
      group.options.push(p);
    });

    const resultArray = Array.from(map.values());
    resultArray.forEach((g) => {
      g.options.sort((a, b) => (a.price_coins ?? 0) - (b.price_coins ?? 0));
    });

    return resultArray;
  }, [products]);

  // 2. Mapa de compras activas
  const activePurchasesMap = useMemo(() => {
    const map = new Map();
    if (purchases) {
      purchases.forEach((p) => {
        if (p.is_active && (!p.expires_at || new Date(p.expires_at) > new Date())) {
          const existing = map.get(p.feature_key);
          if (!existing || !existing.expires_at || (p.expires_at && new Date(p.expires_at) > new Date(existing.expires_at))) {
            map.set(p.feature_key, p);
          }
        }
      });
    }
    return map;
  }, [purchases]);

  return (
    <PageShell>
      <SEOHead
        title="La Bóveda — Arsenal Táctico"
        description="Adquiere herramientas de inteligencia de poker con tus Shark Coins."
        path="/shop"
      />
      <div className="pt-20 pb-16">
        <div className="max-w-[1000px] mx-auto px-6">
          
          {/* ══ HERO SECTION ══ */}
          <div className="bg-sk-bg-2 border border-sk-accent/20 rounded-2xl p-6 md:p-10 mb-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group shadow-[0_0_40px_rgba(34,211,238,0.05)]">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-sk-accent/30 to-transparent" />

            <div className="shrink-0 relative z-10">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-sk-accent/10 blur-xl rounded-full scale-150 group-hover:bg-sk-accent/20 transition-colors duration-500" />
                <img
                  src={`/mascot/shark-${mascotId}.webp`}
                  alt="Sharkania Quartermaster"
                  className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left relative z-10">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                <Lock className="text-sk-accent" size={16} />
                <p className="font-mono text-[11px] font-bold tracking-[0.15em] uppercase text-sk-accent">
                  INTENDENCIA · NIVEL ACCESO
                </p>
                <Sparkles className="text-sk-accent animate-pulse" size={16} />
              </div>

              <h1 className="text-sk-3xl md:text-sk-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-sk-text-1 to-sk-text-4 mb-4 leading-none">
                La Bóveda
              </h1>

              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed">
                El dinero real no sirve aquí. El ecosistema Sharkania funciona bajo estricta meritocracia. <strong className="text-sk-text-1">Estudia, compite y farmea Shark Coins</strong> para desbloquear herramientas que te darán una ventaja sobre el field.
              </p>
            </div>

            {user && (
              <div className="shrink-0 bg-sk-bg-0/50 backdrop-blur-md border border-sk-border-2 rounded-xl p-5 text-center min-w-[160px] relative z-10 group-hover:border-sk-accent/40 transition-colors">
                <p className="text-[10px] font-mono text-sk-text-3 font-bold uppercase tracking-widest mb-3">
                  Tu Reserva
                </p>
                <div className="flex items-center justify-center gap-2 text-sk-3xl font-black text-sk-accent tracking-tighter leading-none mb-1">
                  {balance ?? 0}
                  <img
                    src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif"
                    alt="SC"
                    className="w-7 h-7 drop-shadow-md"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ══ BANNER PARA NO LOGUEADOS CON FOMO (+100 SC) ══ */}
          {!isAuthenticated && (
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
              <div className="flex-1 text-center md:text-left">
                <p className="text-sk-base font-black text-sk-text-1 mb-1.5 flex items-center justify-center md:justify-start gap-2">
                  <Lock size={16} className="text-sk-text-3" />
                  Inicia sesión para abrir La Bóveda
                </p>
                <p className="text-sk-sm text-sk-text-3">
                  Crea tu cuenta gratis hoy y recibe <strong className="text-sk-accent font-bold">100 Shark Coins de regalo 🎁</strong> al instante. Completa misiones en la Academia y farmea más monedas para desbloquear este arsenal.
                </p>
              </div>
              <Button 
                variant="accent" 
                size="md" 
                onClick={() => navigate("/register")}
                className="shrink-0 w-full md:w-auto flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]"
              >
                <Gift size={16} />
                Reclamar mis 100 SC
              </Button>
            </div>
          )}

          {/* ══ CONTROLADOR DE PESTAÑAS ══ */}
          <div className="flex mb-8 border-b border-sk-border-2">
            <button
              onClick={() => setTab("active")}
              className={cn(
                "px-6 py-4 text-sk-sm font-bold transition-all relative",
                tab === "active"
                  ? "text-sk-accent"
                  : "text-sk-text-3 hover:text-sk-text-1"
              )}
            >
              <span className="flex items-center gap-2">
                <Zap size={16} /> Arsenal Disponible
              </span>
              {tab === "active" && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-sk-accent shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              )}
            </button>
            <button
              onClick={() => setTab("upcoming")}
              className={cn(
                "px-6 py-4 text-sk-sm font-bold transition-all relative",
                tab === "upcoming"
                  ? "text-sk-text-1"
                  : "text-sk-text-3 hover:text-sk-text-1"
              )}
            >
              <span className="flex items-center gap-2">
                <Hammer size={16} /> En Desarrollo
              </span>
              {tab === "upcoming" && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-sk-text-1" />
              )}
            </button>
          </div>

          {/* ══ CONTENIDO DE PESTAÑAS ══ */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {/* PESTAÑA: DISPONIBLES */}
              {tab === "active" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {groupedProducts.map((group) => (
                    <ProductCardGroup
                      key={group.feature_key}
                      group={group}
                      activePurchase={activePurchasesMap.get(group.feature_key)}
                      balance={balance ?? 0}
                      onPurchase={purchase}
                      isPurchasing={isPurchasing}
                      isAuthenticated={isAuthenticated}
                      navigate={navigate}
                    />
                  ))}
                </div>
              )}

              {/* PESTAÑA: EN DESARROLLO */}
              {tab === "upcoming" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {UPCOMING_FEATURES.map((feat) => (
                    <div key={feat.id} className="bg-sk-bg-2 border border-sk-border-2 border-dashed rounded-xl p-6 flex flex-col h-full relative overflow-hidden opacity-70 hover:opacity-100 transition-opacity">
                      
                      <div className="absolute -right-10 top-4 bg-sk-bg-3 border-y border-sk-border-2 text-sk-text-3 text-[9px] font-mono font-bold uppercase tracking-widest py-1 px-10 rotate-45 flex items-center gap-1.5">
                        <FlaskConical size={10} /> {feat.tag}
                      </div>

                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-sk-bg-0 border border-sk-border-2 flex items-center justify-center text-2xl shrink-0 grayscale">
                          {feat.icon}
                        </div>
                        <h3 className="text-sk-md font-bold text-sk-text-1 leading-tight tracking-tight">
                          {feat.name}
                        </h3>
                      </div>
                      <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-6">
                        {feat.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </PageShell>
  );
}