import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import {
  BrainCircuit,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Target,
  Trophy,
  Shield,
  MonitorSmartphone,
  ChevronRight,
  Swords,
  EyeOff,
  CheckCircle2,
  Bitcoin // 👈 Icono nuevo para ACR
} from "lucide-react";

// ══════════════════════════════════════════════════════════
// ALGORITHM DATA
// ══════════════════════════════════════════════════════════

type RoomKey = "ps" | "gg" | "wpt" | "bodog" | "acr";

interface RoomProfile {
  id: RoomKey;
  name: string;
  tagline: string;
  description: string;
  color: string;
  icon: any;
  pros: string[];
  cons: string[];
  link: string; // Links de afiliado reales
}

const ROOMS: Record<RoomKey, RoomProfile> = {
  gg: {
    id: "gg",
    name: "GGPoker",
    tagline: "El Ecosistema Moderno",
    description: "Tráfico masivo, torneos millonarios y un software diseñado para divertir y proteger al jugador recreacional.",
    color: "#d94600",
    icon: Trophy,
    pros: ["Tráfico #1 del mundo", "Software increíble (staking, emojis)", "Sin HUDs externos permitidos"],
    cons: ["Rake (comisión) elevado", "Estructuras de torneos muy turbo"],
    link: "https://signup.ggpass.com?qtag1=RFGG1370722&lang=en&brand-id=GGPCOM"
  },
  ps: {
    id: "ps",
    name: "PokerStars",
    tagline: "El Paraíso del Grinder",
    description: "El software más estable del mercado, ideal para jugar muchas mesas simultáneas y usar software de apoyo (HUD).",
    color: "#e3000f",
    icon: Target,
    pros: ["Software perfecto para PC", "Permite HUDs (PokerTracker/H2N)", "Torneos clásicos legendarios"],
    cons: ["El nivel de jugadores es el más duro", "Menos rakeback para casuales"],
    link: "https://www.pokerstars.com/"
  },
  wpt: {
    id: "wpt",
    name: "WPT Global",
    tagline: "El Campo de Valor",
    description: "Una sala nueva llena de jugadores de casino y tráfico asiático. Es, sin duda, la sala más rentable hoy en día.",
    color: "#f97316",
    icon: MonitorSmartphone,
    pros: ["El field (nivel) más fácil del mundo", "Excelente App para celular", "Torneos con overlay (dinero gratis)"],
    cons: ["Software de PC muy básico", "Límite de mesas simultáneas"],
    link: "https://tracking.wptpartners.com/visit/?bta=35660&nci=8074"
  },
  bodog: {
    id: "bodog",
    name: "Bodog / Ignition",
    tagline: "El Refugio Anónimo",
    description: "Las mesas son 100% anónimas. Nadie sabe quién eres, lo que ahuyenta a los regulares profesionales y atrae a recreacionales.",
    color: "#ef4444",
    icon: EyeOff,
    pros: ["Mesas anónimas = cero regulares acosando", "Excelente para Cash Games", "Pagos rápidos con cripto"],
    cons: ["No hay chat ni interacción", "Poca oferta de torneos masivos"],
    link: "https://record.revenuenetwork.com/_s_OAdmC6KUcrlHQ6khlGiGNd7ZgqdRLk/1/"
  },
  acr: {
    id: "acr",
    name: "Americas Cardroom",
    tagline: "El Paraíso Crypto & MTTs",
    description: "Famosa por sus torneos masivos (como The Venom) y su integración total con criptomonedas. Un ecosistema rudo pero extremadamente lucrativo.",
    color: "#0ea5e9", // Azul Cyan
    icon: Bitcoin,
    pros: ["Garantizados gigantes (The Venom)", "Depósitos y retiros ultra rápidos en Cripto", "Permite uso de HUDs"],
    cons: ["Registro tardío (Late Reg) interminable", "Muchos regulares europeos del este"],
    link: "https://go.wpnaffiliates.com/visit/?bta=236696&brand=americascardroom"
  }
};

interface Answer {
  text: string;
  icon: any;
  scores: Record<RoomKey, number>;
}

interface Question {
  title: string;
  subtitle: string;
  answers: Answer[];
}

const QUESTIONS: Question[] = [
  {
    title: "¿Cuál es tu relación con los HUDs (Estadísticas en vivo)?",
    subtitle: "Programas como Holdem Manager o Hand2Note.",
    answers: [
      { text: "Son vitales. Necesito ver los números de mis rivales para explotarlos.", icon: Target, scores: { ps: 3, acr: 2, bodog: -2, gg: -1, wpt: -1 } },
      { text: "Los odio. Prefiero que nadie tenga ventajas por usar software externo.", icon: Shield, scores: { gg: 2, wpt: 2, bodog: 2, ps: -3, acr: -2 } },
      { text: "Me dan igual, confío en mi intuición y lecturas.", icon: BrainCircuit, scores: { wpt: 1, bodog: 1, gg: 1, ps: 0, acr: 0 } },
    ]
  },
  {
    title: "Si tuvieras que elegir tu ecosistema ideal...",
    subtitle: "Sacrificarías una cosa por la otra.",
    answers: [
      { text: "Prefiero un software impecable aunque me enfrente a jugadores muy buenos.", icon: Swords, scores: { ps: 3, gg: 1, acr: 1, wpt: -2, bodog: -1 } },
      { text: "Prefiero jugar contra 'peces' (malos), aunque el software sea básico o lento.", icon: Trophy, scores: { wpt: 3, bodog: 2, gg: 0, ps: -2, acr: -2 } },
      { text: "Busco torneos con premios millonarios, sin importar lo demás.", icon: Trophy, scores: { gg: 3, acr: 3, ps: 2, wpt: -1, bodog: -2 } },
    ]
  },
  {
    title: "¿Desde dónde juegas principalmente?",
    subtitle: "Tu estación de batalla.",
    answers: [
      { text: "En mi PC, abro 6 o más mesas al mismo tiempo.", icon: MonitorSmartphone, scores: { ps: 3, acr: 2, gg: 1, wpt: -3, bodog: 0 } },
      { text: "En el celular o tablet. Juego 1 o 2 mesas mientras hago otras cosas.", icon: MonitorSmartphone, scores: { wpt: 3, gg: 2, bodog: 1, ps: -1, acr: -2 } },
      { text: "En PC, pero solo 2 a 4 mesas bien concentrado.", icon: MonitorSmartphone, scores: { bodog: 2, wpt: 1, gg: 1, ps: 1, acr: 1 } },
    ]
  },
  {
    title: "¿Qué formato te apasiona más?",
    subtitle: "El pan de cada día.",
    answers: [
      { text: "Torneos Multimesa (MTT) de inicio a fin.", icon: Trophy, scores: { acr: 3, gg: 2, ps: 2, wpt: 1, bodog: -1 } },
      { text: "Cash Games (Mesas de dinero real).", icon: Target, scores: { bodog: 3, wpt: 2, gg: 0, ps: -1, acr: 0 } },
      { text: "Spin & Gos o torneos ultrarrápidos.", icon: Swords, scores: { gg: 2, ps: 2, wpt: -1, acr: -1, bodog: -2 } },
    ]
  }
];

// ══════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════

export function RoomProfilerPage() {
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [scores, setScores] = useState<Record<RoomKey, number>>({ ps: 0, gg: 0, wpt: 0, bodog: 0, acr: 0 });
  const [finished, setFinished] = useState(false);

  const handleAnswer = (answerScores: Partial<Record<RoomKey, number>>) => {
    const newScores = { ...scores };
    Object.entries(answerScores).forEach(([room, points]) => {
      newScores[room as RoomKey] += points as number;
    });
    setScores(newScores);

    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setFinished(true);
    }
  };

  const handleReset = () => {
    setStarted(false);
    setCurrentQ(0);
    setScores({ ps: 0, gg: 0, wpt: 0, bodog: 0, acr: 0 });
    setFinished(false);
  };

  // 🔥 Calculamos siempre y evitamos el estado 'null' para no tener errores de TypeScript
  const getResults = (): { topRoom: RoomProfile; runnerUp: RoomProfile } => {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    const topKey = (sorted[0]?.[0] as RoomKey) || "gg";
    const runnerKey = (sorted[1]?.[0] as RoomKey) || "wpt";
    
    return { 
      topRoom: ROOMS[topKey], 
      runnerUp: ROOMS[runnerKey] 
    };
  };

  const { topRoom, runnerUp } = getResults();

  return (
    <PageShell>
      <SEOHead
        title="Perfilador de Salas de Poker — Sharkania"
        description="Descubre qué sala de poker online se adapta mejor a tu perfil psicológico, nivel de habilidad y preferencias tecnológicas."
        path="/tools/perfilador-salas"
      />

      <div className="pt-20 pb-16 min-h-[90vh] flex flex-col">
        <div className="max-w-[700px] mx-auto w-full px-6 flex-1 flex flex-col justify-center">
          
          {/* Header persistente (excepto en intro) */}
          {started && !finished && (
            <div className="mb-8 animate-in fade-in slide-in-from-top-4">
              <Link to="/tools" className="inline-flex items-center gap-1.5 text-sk-sm text-sk-text-3 hover:text-sk-text-1 transition-colors mb-6">
                <ArrowLeft size={14} /> Herramientas
              </Link>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sk-xs font-mono font-bold text-sk-accent uppercase tracking-widest">
                  Pregunta {currentQ + 1} de {QUESTIONS.length}
                </span>
              </div>
              <div className="h-1.5 bg-sk-bg-3 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sk-accent transition-all duration-500 ease-out" 
                  style={{ width: `${((currentQ) / QUESTIONS.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* 1. ESTADO: INTRODUCCIÓN */}
          {!started && (
            <div className="text-center animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 mx-auto bg-sk-accent/10 border border-sk-accent/20 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
                <BrainCircuit size={36} className="text-sk-accent" />
              </div>
              <h1 className="text-sk-3xl sm:text-4xl font-extrabold text-sk-text-1 tracking-tight mb-4">
                El 80% del éxito en poker es elegir la <span className="text-transparent bg-clip-text bg-gradient-to-r from-sk-accent to-sk-purple">sala correcta</span>.
              </h1>
              <p className="text-sk-md text-sk-text-2 mb-8 max-w-lg mx-auto leading-relaxed">
                No juegues donde juegan los profesionales si buscas divertirte. No juegues en salas básicas si eres un analista de datos. Descubre tu hábitat natural en menos de 1 minuto.
              </p>
              <Button variant="accent" size="lg" onClick={() => setStarted(true)} className="px-8 text-lg shadow-sk-lg shadow-sk-accent/20">
                Iniciar Test <ArrowRight size={18} className="ml-2" />
              </Button>
            </div>
          )}

          {/* 2. ESTADO: PREGUNTAS */}
          {started && !finished && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-sk-xl sm:text-2xl font-extrabold text-sk-text-1 mb-2 leading-tight">
                {QUESTIONS[currentQ].title}
              </h2>
              <p className="text-sk-sm text-sk-text-3 mb-8">
                {QUESTIONS[currentQ].subtitle}
              </p>

              <div className="space-y-3">
                {QUESTIONS[currentQ].answers.map((answer, idx) => {
                  const Icon = answer.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(answer.scores)}
                      className="w-full flex items-center gap-4 p-4 sm:p-5 rounded-xl bg-sk-bg-2 border border-sk-border-2 hover:border-sk-accent/50 hover:bg-sk-accent/5 transition-all text-left group"
                    >
                      <div className="w-10 h-10 shrink-0 rounded-lg bg-sk-bg-3 border border-sk-border-1 flex items-center justify-center group-hover:bg-sk-accent/10 group-hover:border-sk-accent/20 transition-colors">
                        <Icon size={18} className="text-sk-text-3 group-hover:text-sk-accent transition-colors" />
                      </div>
                      <span className="text-sk-sm font-medium text-sk-text-1 flex-1">
                        {answer.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. ESTADO: RESULTADOS */}
          {finished && (
            <div className="animate-in zoom-in-95 duration-500 pb-10">
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sk-green/10 text-sk-green font-mono text-[10px] font-bold uppercase tracking-widest border border-sk-green/20 mb-4">
                  <CheckCircle2 size={12} /> Test Completado
                </span>
                <h2 className="text-sk-3xl font-extrabold text-sk-text-1 tracking-tight">
                  Tu ecosistema ideal
                </h2>
              </div>

              {/* Top Room Card */}
              <div className="relative bg-sk-bg-2 border-2 rounded-2xl p-1 overflow-hidden shadow-sk-xl mb-6" style={{ borderColor: topRoom.color }}>
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: topRoom.color }} />
                <div className="bg-sk-bg-1 rounded-xl p-6 sm:p-8 relative">
                  
                  {/* Badge Match */}
                  <div className="absolute top-4 right-4 rotate-12">
                    <div className="bg-sk-bg-0 text-sk-text-1 font-extrabold text-lg px-3 py-1.5 rounded-lg border-2 shadow-lg" style={{ borderColor: topRoom.color }}>
                      98% MATCH
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white" style={{ background: topRoom.color }}>
                      {topRoom.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-2xl font-extrabold text-sk-text-1">{topRoom.name}</h3>
                      <p className="text-sk-xs font-mono text-sk-text-3 uppercase tracking-wider">{topRoom.tagline}</p>
                    </div>
                  </div>

                  <p className="text-sk-sm text-sk-text-2 mb-6 leading-relaxed">
                    {topRoom.description}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-6 mb-8">
                    <div>
                      <h4 className="text-sk-xs font-bold text-sk-green uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Lo que te encantará
                      </h4>
                      <ul className="space-y-2">
                        {topRoom.pros.map((pro, i) => (
                          <li key={i} className="text-sk-sm text-sk-text-2 flex items-start gap-2">
                            <span className="text-sk-green mt-1 text-[10px]">■</span> {pro}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sk-xs font-bold text-sk-red uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <Shield size={14} /> A tener en cuenta
                      </h4>
                      <ul className="space-y-2">
                        {topRoom.cons.map((con, i) => (
                          <li key={i} className="text-sk-sm text-sk-text-2 flex items-start gap-2">
                            <span className="text-sk-red mt-1 text-[10px]">■</span> {con}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 🚀 BOTÓN MODIFICADO PARA AFILIADOS (ABRE EXTERNO) */}
                  <a 
                    href={topRoom.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button variant="accent" size="lg" className="w-full text-sk-bg-0 font-bold text-md" style={{ background: topRoom.color, borderColor: topRoom.color }}>
                      Crear cuenta en {topRoom.name} <ChevronRight size={18} />
                    </Button>
                  </a>

                </div>
              </div>

              {/* Runner up */}
              <a 
                href={runnerUp.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5 flex items-center justify-between mb-8 opacity-80 hover:opacity-100 transition-opacity cursor-pointer block"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: runnerUp.color }}>
                    {runnerUp.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-sk-text-4 uppercase tracking-widest">Opción B (Alternativa)</p>
                    <h4 className="text-sk-sm font-bold text-sk-text-1">{runnerUp.name}</h4>
                  </div>
                </div>
                <ChevronRight size={16} className="text-sk-text-4" />
              </a>

              <div className="text-center">
                <button onClick={handleReset} className="inline-flex items-center gap-2 text-sk-xs text-sk-text-3 hover:text-sk-text-1 transition-colors">
                  <RotateCcw size={12} /> Rehacer Test
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </PageShell>
  );
}