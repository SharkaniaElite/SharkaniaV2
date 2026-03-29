import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { useAuthStore } from "../stores/auth-store";
import { cn } from "../lib/cn";
import {
  Sparkles,
  Calculator,
  Brain,
  TrendingUp,
  Wallet,
  ChevronRight,
  Wrench,
  Play,
  Target,
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════

interface ToolCard {
  slug: string;
  title: string;
  description: string;
  image: string;
  icon: typeof Calculator;
  color: string;
  colorDim: string;
  badge?: string;
  available: boolean;
  requiresAuth?: boolean;
}

const TOOLS: ToolCard[] = [
  {
    slug: "/tools/perfilador-salas",
    title: "Matchmaker de Salas",
    description:
      "Descubre qué sala de poker online se adapta perfectamente a tu psicología, nivel y dispositivo en menos de 1 minuto.",
    image: "/images/tools/tool-sala-quiz.avif", // O una nueva imagen
    icon: Target,
    color: "#ec4899", // Rosa/Fucsia 
    colorDim: "rgba(236,72,153,0.10)",
    badge: "Exclusivo",
    available: true,
    requiresAuth: false, // ¡Esta debería ser pública para captar leads!
  },
  {
    slug: "/tools/quiz",
    title: "¿Qué tipo de jugador eres?",
    description:
      "10 situaciones reales de torneo. Descubre tu perfil competitivo y compártelo con tu mesa.",
    image: "/images/tools/tool-quiz.avif",
    icon: Brain,
    color: "#a78bfa",
    colorDim: "rgba(167,139,250,0.10)",
    badge: "Popular",
    available: true,
    requiresAuth: true,
  },
  {
    slug: "/tools/calculadora-icm",
    title: "Calculadora ICM",
    description:
      "Calcula tu equity en burbuja y mesa final. Ingresa los stacks y obtén el valor ICM de cada jugador.",
    image: "/images/tools/tool-icm.avif",
    icon: Calculator,
    color: "#22d3ee",
    colorDim: "rgba(34,211,238,0.10)",
    badge: "Nuevo",
    available: true,
    requiresAuth: true,
  },
  {
    slug: "/tools/simulador-elo",
    title: "Simulador de ELO",
    description:
      "¿Cuánto subiría tu ELO si ganas este torneo? Simula escenarios y entiende cómo funciona el sistema.",
    image: "/images/tools/tool-elo.avif",
    icon: TrendingUp,
    color: "#34d399",
    colorDim: "rgba(52,211,153,0.10)",
    badge: "Nuevo",
    available: true,
    requiresAuth: true,
  },
  {
    slug: "/tools/calculadora-banca",
    title: "Calculadora de Banca",
    description:
      "Ingresa tu bankroll y te decimos qué buy-ins puedes jugar, cuántas mesas y tu riesgo de ruina.",
    image: "/images/tools/tool-bankroll.avif",
    icon: Wallet,
    color: "#fbbf24",
    colorDim: "rgba(251,191,36,0.10)",
    badge: "Nuevo",
    available: true,
    requiresAuth: true,
  },
  {
    slug: "/tools/replayer",
    title: "Replayer de Manos",
    description:
      "Revive cualquier mano de torneo paso a paso. Analiza decisiones, detecta errores y comparte la acción.",
    image: "/images/tools/tool-replayer.avif",
    icon: Play,
    color: "#f87171",
    colorDim: "rgba(248,113,113,0.10)",
    badge: "Nuevo",
    available: true,
    requiresAuth: true,
  },
];

// ══════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════

function ToolCardComponent({ tool }: { tool: ToolCard }) {
  const { isAuthenticated } = useAuthStore();
  const redirectParam = encodeURIComponent(tool.slug);

  const content = (
    <div
      className={cn(
        "group relative bg-sk-bg-2 border border-sk-border-1 rounded-xl overflow-hidden transition-all duration-200",
        tool.available
          ? "hover:border-sk-border-3 hover:shadow-sk-md hover:-translate-y-0.5 cursor-pointer"
          : "opacity-60 cursor-default"
      )}
    >
      {/* Image Section */}
      <div className="relative w-full h-44 bg-sk-bg-3 overflow-hidden">
        <img
          src={tool.image}
          alt={tool.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sk-bg-2 via-sk-bg-2/20 to-transparent" />

        {/* Dynamic Badge */}
        {tool.badge && (
          <span
            className="absolute top-3 right-3 font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border backdrop-blur-md"
            style={{
              background: tool.available
                ? tool.colorDim.replace("0.10", "0.60")
                : "rgba(255,255,255,0.08)",
              color: tool.available ? tool.color : "#71717a",
              borderColor: tool.available ? `${tool.color}30` : "transparent",
            }}
          >
            {tool.badge}
          </span>
        )}
      </div>

      {/* Info Section */}
      <div className="p-5 pt-3">
        <h3 className="text-sk-md font-bold text-sk-text-1 mb-2 tracking-tight group-hover:text-sk-accent transition-colors">
          {tool.title}
        </h3>
        <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-4 min-h-[40px]">
          {tool.description}
        </p>

        {/* Login required hint */}
        {tool.requiresAuth && !isAuthenticated && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-sk-bg-4 border border-sk-border-2">
            <span className="text-[11px] text-sk-text-3">
              Requiere{" "}
              <Link
                to={`/login?redirect=${redirectParam}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sk-accent font-semibold hover:underline"
              >
                iniciar sesión
              </Link>
            </span>
          </div>
        )}

        {/* Action Link */}
        {tool.available ? (
          <div
            className="inline-flex items-center gap-1.5 text-sk-sm font-semibold transition-colors"
            style={{ color: tool.color }}
          >
            Abrir herramienta
            <ChevronRight
              size={14}
              className="transition-transform group-hover:translate-x-1"
            />
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sk-xs text-sk-text-4 font-medium">
            <Sparkles size={12} />
            En desarrollo
          </span>
        )}
      </div>
    </div>
  );

  return tool.available ? <Link to={tool.slug}>{content}</Link> : content;
}

// ══════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════

export function ToolsPage() {
  return (
    <PageShell>
      <SEOHead
        title="Herramientas de Poker"
        description="Analiza tu juego con herramientas profesionales: Calculadora ICM, gestión de banca y replayer de manos."
        path="/tools"
      />

      <div className="pt-20 pb-16">
        <div className="max-w-[1000px] mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sk-accent-dim border border-sk-accent/15 mb-4">
              <Wrench size={13} className="text-sk-accent" />
              <span className="font-mono text-[11px] font-semibold text-sk-accent uppercase tracking-widest">
                Suite de Análisis
              </span>
            </div>
            <h1 className="text-sk-3xl font-extrabold text-sk-text-1 tracking-tight mb-3">
              Mejora tu juego con datos
            </h1>
            <p className="text-sk-md text-sk-text-2 max-w-xl mx-auto leading-relaxed">
              Calculadoras, simuladores y herramientas de revisión diseñadas para 
              jugadores que buscan maximizar su ROI en las mesas.
            </p>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
            {TOOLS.map((tool) => (
              <ToolCardComponent key={tool.slug} tool={tool} />
            ))}
          </div>

          {/* Internal link — Blog */}
          <div className="mb-12 flex flex-col sm:flex-row gap-3">
            <Link
              to="/blog/como-leer-estadisticas-torneo-detectar-leaks-5-minutos"
              className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border border-sk-border-2 bg-sk-bg-2 hover:border-sk-accent/30 hover:bg-white/[0.02] transition-all group"
            >
              <span className="text-lg">📝</span>
              <div className="flex-1 min-w-0">
                <p className="text-sk-sm font-semibold text-sk-text-1 group-hover:text-sk-accent transition-colors">
                  Cómo detectar fugas de dinero en 5 minutos
                </p>
                <p className="text-[11px] text-sk-text-3">Artículo del blog — usa estas herramientas para analizar tu juego</p>
              </div>
            </Link>
          </div>

          {/* Sugerencias */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-8 text-center shadow-sk-lg">
            <span className="text-3xl mb-3 block">💡</span>
            <h3 className="text-sk-md font-bold text-sk-text-1 mb-2">
              ¿Necesitas otra herramienta?
            </h3>
            <p className="text-sk-sm text-sk-text-3 mb-6 max-w-md mx-auto leading-relaxed">
              Nuestro equipo de desarrollo está siempre escuchando a la comunidad. 
              Si tienes una idea, ¡queremos construirla contigo!
            </p>
            <a
              href="https://wa.me/56977910256?text=Hola%20Sharkania%2C%20tengo%20una%20idea%20para%20una%20herramienta%3A%20"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/25 text-[#25D366] text-sk-sm font-bold hover:bg-[#25D366]/20 transition-all"
            >
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </PageShell>
  );
}