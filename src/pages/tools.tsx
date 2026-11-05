import { Link, useNavigate } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { ArenaPageHero } from "../components/arena/arena-page-hero";
import { SEOHead } from "../components/seo/seo-head";
import { useAuthStore } from "../stores/auth-store";
import { useSharkCoinsBalance } from "../hooks/use-shop";
import { Button } from "../components/ui/button";
import { cn } from "../lib/cn";
import {
  Sparkles,
  Calculator,
  Brain,
  TrendingUp,
  Wallet,
  ChevronRight,
  Play,
  Target,
  Eye,
  Gift,
  Lock,
  Wrench
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════

interface ToolCard {
  slug: string;
  title: string;
  description: string;
  image: string;
  icon: any;
  color: string;
  badge?: string;
  available: boolean;
  requiresAuth: boolean;
  priceLabel: string;
  freeTierLabel?: string;
}

const TOOLS: ToolCard[] = [
  {
    slug: "/tools/perfilador-salas",
    title: "Matchmaker de Salas",
    description:
      "Descubre qué sala de poker online se adapta perfectamente a tu psicología, nivel y dispositivo en menos de 1 minuto.",
    image: "/images/tools/tool-sala-quiz.avif",
    icon: Target,
    color: "#ec4899", // Fucsia
    badge: "Público",
    available: true,
    requiresAuth: false,
    priceLabel: "Gratis",
    freeTierLabel: "Acceso Libre",
  },
  {
    slug: "/tools/quiz",
    title: "¿Qué tipo de jugador eres?",
    description:
      "Enfréntate a 10 situaciones reales de torneo. Descubre tu perfil competitivo, tus debilidades estructurales y compártelo.",
    image: "/bg/quiz.webp", // 👈 AQUÍ ACTUALIZAMOS LA RUTA DE LA IMAGEN
    icon: Brain,
    color: "#a78bfa", // Purple
    badge: "Popular",
    available: true,
    requiresAuth: true,
    priceLabel: "Desde 30",
    freeTierLabel: "1 Uso Diario Gratis",
  },
  {
    slug: "/tools/calculadora-icm",
    title: "Calculadora ICM",
    description:
      "Convierte tus fichas en dinero real. Calcula tu equity exacta en burbuja y mesa final usando el algoritmo Malmuth-Harville.",
    image: "/bg/icm.webp",
    icon: Calculator,
    color: "#22d3ee", // Cyan
    available: true,
    requiresAuth: true,
    priceLabel: "Desde 50",
    freeTierLabel: "1 Uso Diario Gratis",
  },
  {
    slug: "/tools/simulador-elo",
    title: "Simulador de ELO",
    description:
      "Proyecta cómo cambiaría tu ranking global según tu posición en distintos torneos. Simula escenarios contra cualquier field.",
    image: "/bg/elo.webp",
    icon: TrendingUp,
    color: "#34d399", // Green
    available: true,
    requiresAuth: true,
    priceLabel: "Desde 30",
    freeTierLabel: "1 Simulación Diaria Gratis",
  },
  {
    slug: "/tools/calculadora-banca",
    title: "Calculadora de Banca",
    description:
      "Ingresa tu bankroll y perfil de riesgo. Te dictamos qué buy-ins jugar y calculamos tu riesgo de ruina matemático con precisión.",
    image: "/bg/bankroll.webp",
    icon: Wallet,
    color: "#fbbf24", // Gold
    available: true,
    requiresAuth: true,
    priceLabel: "Desde 50",
  },
  {
    slug: "/tools/replayer",
    title: "Replayer de Manos",
    description:
      "Sube tu historial y revive cualquier mano paso a paso. Analiza tamaños de apuesta, detecta fugas de dinero y comparte la acción.",
    image: "/bg/replayer.webp",
    icon: Play,
    color: "#f87171", // Red
    available: true,
    requiresAuth: true,
    priceLabel: "Desde 300",
    freeTierLabel: "1 Análisis Diario Gratis",
  },
  {
    slug: "/ranking",
    title: "Stats Espía (Rayos X)",
    description:
      "Desbloquea las estadísticas ocultas del field: Cashes, ITM%, ROI y Profit. Ve lo que tus rivales no quieren que veas.",
    image: "/bg/stats.webp",
    icon: Eye,
    color: "#a855f7", // Purple-500
    badge: "Exclusivo",
    available: true,
    requiresAuth: true,
    priceLabel: "100 / mes",
    freeTierLabel: "Ranking Básico Gratis",
  },
];

// ══════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════

function ToolCardComponent({ tool }: { tool: ToolCard }) {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const redirectParam = encodeURIComponent(tool.slug);

  const handleLoginClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/login?redirect=${redirectParam}`);
  };

  const content = (
    <div
      className={cn(
        "group relative border border-sk-border-2 rounded-xl flex flex-col h-full min-h-[340px] overflow-hidden transition-all duration-300",
        tool.available
          ? "hover:border-sk-accent/50 hover:shadow-[0_4px_30px_rgba(34,211,238,0.05)] cursor-pointer"
          : "opacity-60 grayscale-[50%] cursor-default"
      )}
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(12,13,16,0.65), rgba(12,13,16,0.98)), url('${tool.image}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="p-6 flex flex-col h-full relative z-10">
        {/* Top Badges */}
        <div className="flex justify-between items-start mb-6">
          {tool.badge ? (
            <span
              className="bg-sk-bg-0/80 backdrop-blur-md border border-sk-border-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm"
              style={{ color: tool.color }}
            >
              {tool.badge}
            </span>
          ) : (
            <div />
          )}

          {tool.freeTierLabel && (
            <div className="bg-sk-green/10 border border-sk-green/20 text-sk-green text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm shadow-sm">
              <Gift size={12} /> {tool.freeTierLabel}
            </div>
          )}
        </div>

        {/* Icon & Title */}
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-lg bg-sk-bg-0/80 backdrop-blur-sm border border-sk-border-2 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner">
            <tool.icon size={24} style={{ color: tool.color }} />
          </div>
          <h3 className="text-sk-md font-bold text-sk-text-1 leading-tight tracking-tight group-hover:text-white transition-colors">
            {tool.title}
          </h3>
        </div>

        {/* Description */}
        <p className="text-sk-sm text-sk-text-2 mb-6 flex-1 leading-relaxed">
          {tool.description}
        </p>

        {/* Bottom Actions / Pricing */}
        <div className="mt-auto pt-5 border-t border-sk-border-2/50 flex items-center justify-between gap-4">
          
          {/* Price Tag */}
          <div
            className="flex items-center gap-1.5 font-mono font-black text-lg bg-sk-bg-0/50 backdrop-blur-md px-2 py-1 rounded-md"
            style={{ color: tool.priceLabel === "Gratis" ? "#34d399" : "#22d3ee" }}
          >
            {tool.priceLabel !== "Gratis" && tool.priceLabel !== "Premium" && (
              <img
                src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif"
                alt="SC"
                className="w-4 h-4 drop-shadow-sm"
              />
            )}
            {tool.priceLabel}
          </div>

          {/* Action Button */}
          {tool.requiresAuth && !isAuthenticated ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLoginClick}
              className="bg-sk-bg-0/80 backdrop-blur-sm hover:bg-sk-bg-3 gap-2"
            >
              <Lock size={14} /> Iniciar sesión
            </Button>
          ) : tool.available ? (
            <div
              className="inline-flex items-center gap-1.5 text-sk-sm font-semibold transition-colors"
              style={{ color: tool.color }}
            >
              Abrir{" "}
              <ChevronRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sk-xs text-sk-text-4 font-medium">
              <Sparkles size={12} /> Próximamente
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return tool.available ? (
    <Link to={tool.slug} className="block h-full">
      {content}
    </Link>
  ) : (
    <div className="h-full">{content}</div>
  );
}

// ══════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════

export function ToolsPage() {
  const user = useAuthStore((s) => s.user);
  const { data: balance } = useSharkCoinsBalance();

  return (
    <PageShell variant="arena">
      <SEOHead
        title="Herramientas Tácticas"
        description="Analiza tu juego con herramientas de poker profesionales: Calculadora ICM, simulador de ELO, gestión de banca y replayer de manos."
        path="/tools"
      />

      <div className="arena-interior arena-editorial">
        <div className="arena-interior-container">
          
          <ArenaPageHero section="tools" eyebrow="LABORATORIO / HERRAMIENTAS"
            heading="HERRAMIENTAS" highlight="DE PÓKER." icon={Wrench}
            description="Calculadoras, simuladores, replayer y recursos para estudiar decisiones de póker. Cada herramienta informa sus condiciones de acceso."
            count={TOOLS.filter(t => t.available).length} countLabel="Herramientas disponibles"
            action={<Link to="/sistema-elo">Conoce nuestro sistema ELO <ChevronRight size={16}/></Link>} />
          {user && <div className="arena-utility-strip" aria-label="Saldo de Shark Coins">
            <p>Tus accesos se administran en <Link to="/shop">La Bóveda</Link>.</p>
            <span className="arena-wallet-balance">{balance ?? 0}
              <img src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/shark-coin-pro.avif"
                alt="Shark Coins" loading="lazy" decoding="async" width={22} height={22}/>
            </span>
          </div>}
          {/* Tools Grid */}
          <div className="arena-tools-grid grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            {TOOLS.map((tool) => (
              <ToolCardComponent key={tool.slug} tool={tool} />
            ))}
          </div>

          {/* Sugerencias */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-8 text-center shadow-sk-lg">
            <span className="text-3xl mb-3 block">💡</span>
            <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">
              ¿Necesitas otra herramienta?
            </h3>
            <p className="text-sk-sm text-sk-text-3 mb-6 max-w-md mx-auto leading-relaxed">
              Nuestro laboratorio está siempre trabajando. Si tienes una idea
              matemática para destruir a tus rivales, ¡queremos construirla
              contigo!
            </p>
            <a
              href="https://wa.me/56977910256?text=Hola%20Sharkania%2C%20tengo%20una%20idea%20para%20una%20herramienta%3A%20"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/25 text-[#25D366] text-sk-sm font-bold hover:bg-[#25D366]/20 transition-all"
            >
              Contactar al equipo
            </a>
          </div>
        </div>
      </div>
    </PageShell>
  );
}