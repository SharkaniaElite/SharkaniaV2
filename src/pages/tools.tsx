// src/pages/tools.tsx
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { useAuthStore } from "../stores/auth-store";
import {
  Sparkles,
  Calculator,
  Brain,
  TrendingUp,
  Wallet,
  ChevronRight,
  Wrench,
  Play,
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
      "Revive cualquier mano de torneo paso a paso. Analiza decisiones, detecta errores y comparte la acción con tu coach o compañeros.",
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
      className={`group relative bg-sk-bg-2 border border-sk-border-1 rounded-xl overflow-hidden transition-all duration-200 ${
        tool.available
          ? "hover:border-sk-border-3 hover:shadow-sk-md hover:-translate-y-0.5 cursor-pointer"
          : "opacity-60 cursor-default"
      }`}
    >
      {/* Image */}
      <div className="relative w-full h-40 bg-sk-bg-3 overflow-hidden">
        <img
          src={tool.image}
          alt={tool.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sk-bg-2 via-transparent to-transparent opacity-60" />

        {/* Badge */}
        {tool.badge && (
          <span
            className="absolute top-3 right-3 font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-sm"
            style={{
              background: tool.available
                ? tool.colorDim.replace("0.10", "0.70")
                : "rgba(255,255,255,0.08)",
              color: tool.available ? tool.color : "#71717a",
            }}
          >
            {tool.badge}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5 pt-3">
        <h3 className="text-sk-md font-bold text-sk-text-1 mb-2 tracking-tight">
          {tool.title}
        </h3>
        <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-4">
          {tool.description}
        </p>

        {/* Auth required notice — solo si no está autenticado */}
        {tool.requiresAuth && !isAuthenticated && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-sk-bg-4 border border-sk-border-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sk-text-3 shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span className="text-[11px] text-sk-text-3">
              Requiere{" "}
              <Link
                to={`/login?redirect=${redirectParam}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sk-accent font-semibold hover:underline"
              >
                iniciar sesión
              </Link>
              {" "}·{" "}
              <Link
                to={`/register?redirect=${redirectParam}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sk-accent font-semibold hover:underline"
              >
                crear cuenta gratis
              </Link>
            </span>
          </div>
        )}

        {/* Action */}
        {tool.available ? (
          <span
            className="inline-flex items-center gap-1.5 text-sk-sm font-semibold transition-colors"
            style={{ color: tool.color }}
          >
            Usar herramienta
            <ChevronRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sk-xs text-sk-text-4 font-medium">
            <Sparkles size={12} />
            En desarrollo
          </span>
        )}
      </div>
    </div>
  );

  if (tool.available) {
    return <Link to={tool.slug}>{content}</Link>;
  }
  return content;
}

// ══════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════

export function ToolsPage() {
  return (
    <PageShell>
      <SEOHead
        title="Herramientas de Poker"
        description="Calculadoras y herramientas gratuitas para jugadores de poker. ICM, ELO, bankroll, quiz de perfil, replayer de manos y más."
        path="/tools"
      />

      <div className="pt-20 pb-16">
        <div className="max-w-[1000px] mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sk-accent-dim border border-sk-accent/15 mb-4">
              <Wrench size={13} className="text-sk-accent" />
              <span className="font-mono text-[11px] font-semibold text-sk-accent uppercase tracking-widest">
                Herramientas Gratuitas
              </span>
            </div>
            <h1 className="text-sk-3xl font-extrabold text-sk-text-1 tracking-tight mb-3">
              Mejora tu juego con datos
            </h1>
            <p className="text-sk-md text-sk-text-2 max-w-xl mx-auto leading-relaxed">
              Calculadoras, simuladores y tests diseñados para jugadores de
              poker competitivo. Gratis, sin registro, y con el rigor
              de Sharkania.
            </p>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            {TOOLS.map((tool) => (
              <ToolCardComponent key={tool.slug} tool={tool} />
            ))}
          </div>

          {/* Suggest a tool */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 text-center">
            <span className="text-2xl mb-2 block">💡</span>
            <h3 className="text-sk-md font-bold text-sk-text-1 mb-1">
              ¿Qué herramienta te gustaría?
            </h3>
            <p className="text-sk-sm text-sk-text-3 mb-4 max-w-md mx-auto">
              Estamos construyendo nuevas herramientas constantemente.
              Si hay algo que necesitas para tu juego, queremos saberlo.
            </p>
            <a
              href="https://wa.me/56912345678?text=Hola%20Sharkania%2C%20me%20gustaría%20sugerir%20una%20herramienta%3A%20"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/25 text-[#25D366] text-sk-sm font-semibold hover:bg-[#25D366]/20 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Sugerir una herramienta
            </a>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
