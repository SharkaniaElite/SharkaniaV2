import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { ArrowLeft, ArrowRight, BookOpen, BrainCircuit, CheckCircle2, ChevronRight, CircleHelp, GitBranch, Info, Layers, RotateCcw, ShieldCheck, Target } from "lucide-react";

type Street = "flop" | "turn" | "river";
type Position = "ip" | "oop";
type ActionMode = "sin_apuesta" | "enfrento_apuesta";

type Question = { title: string; detail: string };
type Option = { title: string; when: string; caution: string };
type Example = { board: string; hero: string; story: string; analysis: string };
type Guide = {
  context: string;
  objective: string;
  questions: [Question, Question, Question];
  openOptions: Option[];
  faceOptions: Option[];
  next: string;
  avoid: string;
  example: Example;
};

const GUIDES: Record<Street, Record<Position, Guide>> = {
  flop: {
    ip: {
      context: "Ejemplo de referencia: BTN abrió preflop, BB pagó. BB pasa en un flop heads-up, 100bb efectivos.",
      objective: "No apuestes por reflejo: compara cuánto gana tu mano apostando frente a cuánto gana pasando.",
      questions: [
        { title: "¿Qué rangos llegaron a este board?", detail: "Identifica a quién favorece la textura. Una ventaja de rango puede permitir apostar más a menudo; no obliga a apostar cada combinación." },
        { title: "¿Qué función cumple MI mano?", detail: "Distingue valor, showdown, proyecto o farol. Una mano como A-high puede tener equity y showdown sin querer construir un pozo." },
        { title: "¿Qué responde BB a mi tamaño?", detail: "Piensa en calls peores, folds que niegan equity y posibles check-raises. Después compara esa apuesta con el EV del check." },
      ],
      openOptions: [
        { title: "BET por valor", when: "Manos peores continúan con suficiente frecuencia y el tamaño consigue pagarles.", caution: "Apostar demasiado grande puede expulsar justo a las manos que querías cobrar." },
        { title: "BET con protección o farol", when: "Los folds ganados, la equity negada y las calles futuras justifican el riesgo.", caution: "Foldear manos peores no basta: tal vez el check conserve más EV." },
        { title: "CHECK back", when: "Tienes showdown, quieres realizar equity barato o el rango que te paga te domina.", caution: "Permites una carta gratis: prepara cómo responder a turn." },
      ],
      faceOptions: [
        { title: "CALL", when: "La apuesta del rival incluye suficientes manos peores o proyectos y puedes continuar rentablemente.", caution: "Las pot odds del flop no bastan: faltan dos calles y puede haber nuevas apuestas." },
        { title: "RAISE", when: "Obtienes valor de calls peores o puedes generar folds rentables con equity de respaldo.", caution: "No subas solo porque el rival tomó la iniciativa." },
        { title: "FOLD", when: "Tu equity y las oportunidades futuras no justifican invertir más fichas.", caution: "Una apuesta pequeña no siempre indica fuerza; considera el rango completo." },
      ],
      next: "Antes de hacer c-bet, decide en qué turns seguirías apostando, cuáles pasarías y qué harías ante un check-raise.",
      avoid: "«Tengo iniciativa, así que debo apostar». La iniciativa preflop no convierte toda tu mano en una apuesta rentable.",
      example: {
        board: "K♠ 8♦ 2♣",
        hero: "A♥ T♣",
        story: "BB hace check. Puedes apostar 25–33% del pozo o pasar.",
        analysis: "Una apuesta pequeña puede hacer foldear QJ y negarle equity; un check conserva showdown y evita enfrentarte a un rango de call fuerte. La elección exacta depende de rangos y tamaños.",
      },
    },
    oop: {
      context: "Ejemplo de referencia: BB defendió contra BTN, pozo heads-up, 100bb efectivos. Actúas primero.",
      objective: "Defiende tu rango sin regalar botes ni inflar pozos con manos que solo quieren llegar al showdown.",
      questions: [
        { title: "¿Quién tuvo la iniciativa y quién conecta mejor?", detail: "Como BB defensor, comenzar pasando es una simplificación razonable en muchos flops; no significa rendirse." },
        { title: "¿Qué mano tengo dentro de mi rango?", detail: "Una pareja media puede preferir check-call; un set puede buscar check-raise; un proyecto con fold equity puede subir en algunas texturas." },
        { title: "¿Cómo suele apostar BTN aquí?", detail: "Diferencia su apuesta pequeña y frecuente de una apuesta grande y polarizada. El tamaño cambia las manos que puede representar." },
      ],
      openOptions: [
        { title: "CHECK como base", when: "Defendiste BB y esperas que el agresor preflop apueste con parte de su rango.", caution: "No conviertas check en check-fold automático." },
        { title: "BET de iniciativa (donk)", when: "La textura y la distribución de manos justifican que lideres; es una línea específica, no el plan general.", caution: "No lideres por miedo a que el rival pase." },
      ],
      faceOptions: [
        { title: "CHECK-CALL", when: "Tu mano tiene suficiente equity y puede realizarla frente al rango de apuesta.", caution: "Piensa en turns malos y barrels futuros, sobre todo sin posición." },
        { title: "CHECK-RAISE", when: "Tienes valor para construir el pozo o un semibluff con equity y folds potenciales.", caution: "Resubir solo para «saber dónde estás» suele ser un error." },
        { title: "CHECK-FOLD", when: "Tu mano está demasiado débil frente al rango que apuesta y no tiene plan rentable.", caution: "No bases el fold únicamente en que no conectaste pareja." },
      ],
      next: "Si pagas, anticipa cuáles turns ayudan a BTN, cuáles a BB y qué tamaños estarás dispuesto a enfrentar.",
      avoid: "Pagar automáticamente toda pareja contra c-bet o foldear demasiado por estar fuera de posición.",
      example: {
        board: "K♠ 8♦ 2♣",
        hero: "8♥ 7♥",
        story: "BB hace check y BTN apuesta pequeño.",
        analysis: "Tu segunda pareja puede defender contra una apuesta pequeña que incluye overcards y faroles. La decisión depende del rango, tamaño y turns futuros; no es un call universal.",
      },
    },
  },
  turn: {
    ip: {
      context: "Referencia: BTN con posición contra BB. La acción del flop determina qué manos quedan en cada rango.",
      objective: "La carta nueva y la acción previa deciden si conviene un segundo barrel, una apuesta retrasada o un check.",
      questions: [
        { title: "¿Qué cambió con la carta del turn?", detail: "Compara quién suma más proyectos, dobles parejas, sets y manos fuertes. Una carta que favorece a BB reduce ciertos faroles." },
        { title: "¿Cómo se filtró el rango rival en flop?", detail: "Tras pagar una c-bet, BB suele llegar con un rango más resistente que después de pasar flop sin apuestas." },
        { title: "¿Qué obtiene un nuevo bet?", detail: "Separa valor contra manos peores, folds de manos mejores y negación de equity. No apuestes por la inercia del flop." },
      ],
      openOptions: [
        { title: "BET por valor / segundo barrel", when: "Manos peores continúan pagando y las cartas futuras pueden justificar construir el pozo.", caution: "El rango que pagó flop es distinto del rango que llegó al flop." },
        { title: "BET como semibluff", when: "Tienes proyectos o blockers útiles y el rival puede abandonar suficientes manos mejores.", caution: "Si casi todo el rango rival sigue, el segundo barrel pierde atractivo." },
        { title: "CHECK back", when: "Una pareja media, A-high o un proyecto prefiere conservar equity y realizar showdown.", caution: "Prepárate para enfrentar una apuesta en river." },
      ],
      faceOptions: [
        { title: "CALL", when: "Tu mano conserva suficiente equity contra el rango que lidera y puedes afrontar river.", caution: "Considera la historia del flop: no pagues solo por tus outs aparentes." },
        { title: "RAISE", when: "Hay valor sólido o un semibluff con equity y suficientes folds plausibles.", caution: "Evita convertir de forma accidental una mano con showdown en farol." },
        { title: "FOLD", when: "El rango y tamaño rival hacen que continuar sea peor que abandonar.", caution: "No supongas que toda donk bet representa nuts." },
      ],
      next: "Antes de apostar turn, define tu plan para tres ríos: uno que te mejora, uno que completa proyectos y un blank.",
      avoid: "«Aposté flop, así que debo disparar turn». Cada barrel necesita una razón nueva.",
      example: {
        board: "K♠ 8♦ 2♣ 4♥",
        hero: "A♥ T♣",
        story: "Apostaste pequeño flop, BB pagó y vuelve a pasar turn.",
        analysis: "La apuesta de turn debe enfrentar el rango que pagó flop. Con A-high, check back puede conservar equity y evitar invertir contra un rango que continúa demasiado fuerte.",
      },
    },
    oop: {
      context: "Referencia: BB fuera de posición tras defender preflop. Distingue flop check-call de flop check-check.",
      objective: "No confundas haber pagado una vez con estar comprometido a pagar otra.",
      questions: [
        { title: "¿Flop fue check-call o check-check?", detail: "Después de check-check puedes considerar probe bet; después de check-call tu rango y el suyo son diferentes." },
        { title: "¿La carta nueva favorece a qué rango?", detail: "Evalúa pares, proyectos completados y manos fuertes; algunas cartas justifican liderar, otras favorecen seguir desde check." },
        { title: "¿Qué tamaño y rango espero enfrente?", detail: "Un segundo barrel grande suele presionar manos medias. Pregunta qué valor y qué faroles contiene." },
      ],
      openOptions: [
        { title: "CHECK y evaluar respuesta", when: "Tu rango se beneficia de que BTN actúe; puedes seguir con calls, raises y folds bien escogidos.", caution: "Check no implica abandonar: protege tus checks con manos capaces de continuar." },
        { title: "PROBE BET si pasaron flop", when: "El check back del rival y la carta de turn abren oportunidades de valor o farol.", caution: "No presupongas que un check back equivale a debilidad." },
        { title: "DONK selectivo", when: "La carta mejora especialmente las manos que BB conserva tras su línea anterior.", caution: "Es sensible al spot y no debe usarse como regla automática." },
      ],
      faceOptions: [
        { title: "CHECK-CALL", when: "Tu mano supera suficientes bluffs, tiene equity y tolera el escenario de river.", caution: "Una pareja no justifica por sí sola un segundo call." },
        { title: "CHECK-RAISE", when: "Representas valor creíble y obtienes pagos peores o folds suficientes con equity.", caution: "Revisa qué manos fuertes tienes realmente después de tu línea en flop." },
        { title: "CHECK-FOLD", when: "La combinación de rango, tamaño y cartas futuras hace que pagar pierda EV.", caution: "No tomes el tamaño como prueba absoluta de fuerza." },
      ],
      next: "Si pagas turn, apunta qué proyectos fallarán en river y qué valor puede apostar el rival por tercera vez.",
      avoid: "Decir «ya pagué flop, ahora no puedo foldear»; el dinero invertido ya no forma parte de la decisión.",
      example: {
        board: "K♠ 8♦ 2♣ 4♥",
        hero: "8♥ 7♥",
        story: "BB hizo check-call flop. En turn vuelve a pasar y BTN apuesta grande.",
        analysis: "La segunda pareja ya no se enfrenta al rango de c-bet flop, sino al de segundo barrel. Estima valor, faroles, tamaño y rivers antes de decidir.",
      },
    },
  },
  river: {
    ip: {
      context: "Referencia: BTN con posición contra BB. Ya no quedan cartas por aparecer.",
      objective: "En river la protección desaparece: apuesta por valor o por folds, y compara siempre con check.",
      questions: [
        { title: "¿Qué rango llega a river con esta línea?", detail: "Reconstruye quién apostó, quién pagó y qué proyectos se completaron o fallaron." },
        { title: "Si apuesto, ¿qué manos peores pagan?", detail: "Para value bet debes obtener suficientes calls de peor; no basta con llevar top pair." },
        { title: "Si faroleo, ¿qué manos mejores foldean?", detail: "Examina su rango de bluff-catchers, tamaño, blockers y tendencias rivales." },
      ],
      openOptions: [
        { title: "BET por valor", when: "El rango de call rival tiene suficientes manos peores frente a tu mano.", caution: "Una apuesta abre la opción de check-raise; analiza cuánto te perjudicaría." },
        { title: "BET de farol", when: "Tienes poco showdown y existe fold equity suficiente contra manos mejores.", caution: "Evita farolear sistemáticamente a jugadores que no foldean." },
        { title: "CHECK back", when: "Tienes valor de showdown pero pocas manos peores pagan, o el farol no compensa.", caution: "No conviertas automáticamente un bluff-catcher en value bet." },
      ],
      faceOptions: [
        { title: "CALL (bluff-catch)", when: "El porcentaje de veces que ganas frente a su rango de apuesta supera tus pot odds.", caution: "Cuenta combos de valor y faroles creíbles; no pagues solo porque «podría estar faroleando»." },
        { title: "RAISE por valor o farol", when: "Tienes una mano que gana a calls peores o un bluff con folds muy justificables.", caution: "Pagar puede superar a subir con muchas manos fuertes y medias." },
        { title: "FOLD", when: "El rango de bet rival contiene insuficientes faroles para tu precio.", caution: "Foldear una mano vistosa puede ser correcto ante un rango fuerte." },
      ],
      next: "No hay nueva calle: compara EV de bet, check, call, raise y fold usando la línea completa.",
      avoid: "Apostar river «para proteger»: no queda ninguna carta que proteger.",
      example: {
        board: "K♠ 8♦ 2♣ 4♥ 2♥",
        hero: "K♥ Q♦",
        story: "BB pasa river después de una secuencia previa que debes reconstruir.",
        analysis: "Top pair puede apostar por valor si 8x y Kx peores pagan lo suficiente, pero el valor de un check depende del rango que llegó a river y de la amenaza de check-raise.",
      },
    },
    oop: {
      context: "Referencia: BB fuera de posición. Actúas antes de que BTN decida si apuesta river.",
      objective: "Diferencia valor fino, check para cobrar faroles y check-fold frente a rangos de apuesta fuertes.",
      questions: [
        { title: "¿Qué manos fuertes tiene cada rango ahora?", detail: "Incluye sets, dobles, colores, escaleras y proyectos fallidos compatibles con la secuencia." },
        { title: "¿Quién paga o apuesta con peor?", detail: "A veces bet captura valor; otras veces check induce faroles de un rango que no pagaría tu apuesta." },
        { title: "¿Cómo cambia la decisión con el tamaño?", detail: "Enfrentar 25% y 150% de pozo requiere distintas frecuencias de victoria; observa polarización." },
      ],
      openOptions: [
        { title: "BET por valor", when: "Hay calls peores suficientes y el riesgo de raise es aceptable.", caution: "No apuestes una mano media solo por miedo a que BTN te apueste." },
        { title: "BET de farol", when: "Puedes hacer foldear manos mejores con una historia creíble y buen tamaño.", caution: "Sin reads, evita líneas grandes que dependan de folds improbables." },
        { title: "CHECK", when: "Deseas inducir faroles, proteger tu rango de check o llegar a showdown.", caution: "Decide previamente qué tamaños pagarás con tus bluff-catchers." },
      ],
      faceOptions: [
        { title: "CHECK-CALL", when: "Tu mano gana la proporción necesaria de veces frente a apuestas, incluyendo bluffs reales.", caution: "Las odds se calculan contra el rango de apuesta, no contra todo el rango rival." },
        { title: "CHECK-RAISE", when: "Puedes obtener calls de peor con valor o conseguir suficientes folds como farol.", caution: "No conviertas en raise una mano que gana solo a los faroles." },
        { title: "CHECK-FOLD", when: "El tamaño y la línea representan un rango donde no hay suficientes bluffs.", caution: "Un fold correcto no se invalida por descubrir luego que el rival faroleó una vez." },
      ],
      next: "En river la decisión termina aquí: registra el razonamiento y revisa la mano sin conocer el resultado primero.",
      avoid: "Usar «tengo una pareja» como argumento suficiente para pagar una tercera apuesta grande.",
      example: {
        board: "K♠ 8♦ 2♣ 4♥ 2♥",
        hero: "8♥ 7♥",
        story: "BB hizo check-call flop y turn. Hace check river; BTN apuesta 75% del pozo.",
        analysis: "Tu segunda pareja es bluff-catcher. Necesitas alrededor de 30% de equity frente al rango que apuesta, sin rake. Determina si el rival llega con suficientes faroles.",
      },
    },
  },
};

const STREET_ITEMS: { key: Street; label: string }[] = [
  { key: "flop", label: "1 · FLOP" },
  { key: "turn", label: "2 · TURN" },
  { key: "river", label: "3 · RIVER" },
];

const FORMAT_NOTES = [
  { label: "IP", meaning: "Con posición: actúas después del rival en las calles postflop." },
  { label: "OOP", meaning: "Fuera de posición: actúas antes del rival en las calles postflop." },
  { label: "Showdown", meaning: "Valor de ganar cuando se muestran las cartas, sin necesidad de apostar." },
  { label: "Equity", meaning: "Tu parte esperada del pozo si las manos llegan a revelarse, según las cartas futuras." },
];

const formatPercentage = (bet: number) => (100 * bet / (1 + 2 * bet)).toFixed(1).replace(".", ",");

export function DecisionTreePage() {
  const [street, setStreet] = useState<Street>("flop");
  const [position, setPosition] = useState<Position>("ip");
  const [actionMode, setActionMode] = useState<ActionMode>("sin_apuesta");
  const [betSize, setBetSize] = useState(0.75);
  const guide = GUIDES[street][position];
  const facing = actionMode === "enfrento_apuesta";
  const options = facing ? guide.faceOptions : guide.openOptions;
  const facingLabel = position === "oop" ? "Hice check y el rival apostó" : "El rival apostó antes de mí";
  const unbetLabel = position === "oop" ? "Soy primero en actuar" : "El rival pasó";
  const streetIndex = STREET_ITEMS.findIndex((item) => item.key === street);
  const nextStreet = STREET_ITEMS[Math.min(streetIndex + 1, 2)]?.key ?? "river";

  return (
    <PageShell variant="arena" showMarketing={false}>
      <SEOHead
        title="Árbol de decisiones de póker: flop, turn y river IP y OOP"
        description="Guía interactiva gratuita para tomar decisiones postflop en Texas Hold'em cash 6-max: aprende cuándo apostar, pasar, pagar, subir o foldear según rango, equity y posición."
        path="/tools/arbol-de-decisiones"
      />
      <div className="relative min-h-screen bg-[#070c10] text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-[radial-gradient(ellipse_at_70%_10%,rgba(34,211,238,0.11),transparent_64%)]" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
          <nav aria-label="Ruta de navegación" className="mb-6 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
            <Link to="/tools" className="inline-flex items-center gap-1 hover:text-cyan-300"><ArrowLeft size={14} /> Herramientas</Link>
            <ChevronRight size={13} aria-hidden="true" />
            <span className="text-cyan-300">Árbol de decisiones</span>
          </nav>

          <header className="relative isolate overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#0b171c] px-5 py-8 sm:px-9 sm:py-11">
            <div className="pointer-events-none absolute -right-12 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
            <div className="relative z-10 max-w-3xl sm:pr-40 lg:max-w-[75%] lg:pr-0">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold tracking-wide text-cyan-200">
                <GitBranch size={14} /> SHARKANIA · ENTRENAMIENTO POSTFLOP
              </p>
              <h1 className="max-w-2xl text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">Deja de adivinar. <span className="text-cyan-300">Aprende a decidir.</span></h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Tu árbol mental para Texas Hold'em: selecciona la calle, tu posición y la acción rival. Aprende qué preguntarte antes de apostar, pasar, pagar, subir o foldear.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-200">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">Cash 6-max</span>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">Heads-up · 100bb de referencia</span>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">Gratis · Sin registro</span>
              </div>
            </div>
            <img src="/mascot/shark-5.webp" width="208" height="245" alt="Mascota Sharkania, tu consejero estratégico" className="relative z-10 mx-auto mt-5 w-40 object-contain drop-shadow-[0_0_30px_rgba(34,211,238,0.20)] sm:absolute sm:bottom-0 sm:right-6 sm:mt-0 sm:w-44 lg:right-12 lg:w-52" />
          </header>

          <section aria-label="Configurar escenario" className="mt-7 rounded-2xl border border-white/10 bg-[#10171d] p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><Layers className="text-cyan-300" size={18} /> Elige tu situación</div>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <fieldset>
                <legend className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">1. Calle</legend>
                <div className="grid grid-cols-3 gap-2">
                  {STREET_ITEMS.map((item) => (
                    <button key={item.key} type="button" aria-pressed={street === item.key} onClick={() => setStreet(item.key)}
                      className={street === item.key
                        ? "min-h-12 rounded-xl border border-cyan-300 bg-cyan-400/15 px-2 text-sm font-extrabold text-cyan-200"
                        : "min-h-12 rounded-xl border border-white/10 bg-white/[0.04] px-2 text-sm font-semibold text-slate-300 hover:border-white/30 hover:text-white"}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">2. Posición</legend>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={position === "ip"} onClick={() => setPosition("ip")}
                    className={position === "ip"
                      ? "min-h-12 rounded-xl border border-cyan-300 bg-cyan-400/15 px-3 text-sm font-bold text-cyan-200"
                      : "min-h-12 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-300 hover:border-white/30"}>
                    IP · Con posición
                  </button>
                  <button type="button" aria-pressed={position === "oop"} onClick={() => setPosition("oop")}
                    className={position === "oop"
                      ? "min-h-12 rounded-xl border border-cyan-300 bg-cyan-400/15 px-3 text-sm font-bold text-cyan-200"
                      : "min-h-12 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-300 hover:border-white/30"}>
                    OOP · Sin posición
                  </button>
                </div>
              </fieldset>
            </div>
            <fieldset className="mt-5">
              <legend className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">3. ¿Qué acción enfrentas?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" aria-pressed={!facing} onClick={() => setActionMode("sin_apuesta")}
                  className={!facing
                    ? "min-h-12 rounded-xl border border-cyan-300 bg-cyan-400/15 px-4 text-left text-sm font-bold text-cyan-200"
                    : "min-h-12 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-left text-sm font-semibold text-slate-300 hover:border-white/30"}>
                  {unbetLabel}
                </button>
                <button type="button" aria-pressed={facing} onClick={() => setActionMode("enfrento_apuesta")}
                  className={facing
                    ? "min-h-12 rounded-xl border border-cyan-300 bg-cyan-400/15 px-4 text-left text-sm font-bold text-cyan-200"
                    : "min-h-12 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-left text-sm font-semibold text-slate-300 hover:border-white/30"}>
                  {facingLabel}
                </button>
              </div>
            </fieldset>
          </section>

          <section aria-live="polite" className="mt-7" aria-label="Árbol de razonamiento">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Tu ruta de pensamiento</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{street.toUpperCase()} <span className="text-cyan-300">· {position.toUpperCase()}</span></h2>
              </div>
              <button type="button" onClick={() => { setStreet("flop"); setPosition("ip"); setActionMode("sin_apuesta"); setBetSize(0.75); }}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white">
                <RotateCcw size={14} /> Reiniciar
              </button>
            </div>
            <p className="max-w-4xl text-sm leading-relaxed text-slate-300">{guide.context}</p>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4">
              <Target className="mt-0.5 shrink-0 text-cyan-300" size={20} />
              <p className="text-sm leading-relaxed text-cyan-50"><strong>Objetivo:</strong> {guide.objective}</p>
            </div>

            <h3 className="mt-8 flex items-center gap-2 text-xl font-extrabold text-white"><BrainCircuit className="text-cyan-300" size={21} /> Primero, tres preguntas</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {guide.questions.map((question, index) => (
                <article key={question.title} className="rounded-2xl border border-white/10 bg-[#111b21] p-5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 font-mono text-sm font-black text-cyan-200">{index + 1}</span>
                  <h4 className="mt-3 text-base font-extrabold leading-snug text-white">{question.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{question.detail}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2 text-cyan-300"><ArrowRight size={20} /><span className="text-xs font-bold uppercase tracking-widest">Si ya respondiste lo anterior</span></div>
            <h3 className="mt-2 text-xl font-extrabold text-white">Compara las acciones posibles</h3>
            <p className="mt-2 text-sm text-slate-300">{facing
              ? "Frente a una apuesta, compara call, raise y fold según el rango que apuesta y el precio que ofrece."
              : "Si todavía no enfrentas una apuesta, compara apostar con pasar según el beneficio real de cada alternativa."}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {options.map((option) => (
                <article key={option.title} className="rounded-2xl border border-white/10 bg-[#10191f] p-5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="shrink-0 text-cyan-300" size={20} />
                    <h4 className="text-base font-extrabold text-white">{option.title}</h4>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-200"><strong className="text-cyan-200">Cuándo:</strong> {option.when}</p>
                  <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-slate-400"><strong className="text-white">Cuidado:</strong> {option.caution}</p>
                </article>
              ))}
            </div>

            {facing && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-[#111b21] p-5">
                <div className="flex items-center gap-2"><CircleHelp size={19} className="text-cyan-300" /><h4 className="font-bold text-white">¿Cuánto necesitas ganar para pagar?</h4></div>
                <p className="mt-2 text-sm text-slate-300">Selecciona el tamaño apostado por el rival, expresado como porcentaje del pozo antes de su apuesta.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[0.25, 0.5, 0.75, 1, 1.5].map((size) => (
                    <button key={size} type="button" aria-pressed={size === betSize} onClick={() => setBetSize(size)}
                      className={size === betSize ? "rounded-lg border border-cyan-300 bg-cyan-400/15 px-3 py-2 text-sm font-bold text-cyan-200" : "rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:text-white"}>
                      {size * 100}%
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-200">Equity de equilibrio del call: <strong className="text-2xl font-black text-cyan-300">{formatPercentage(betSize)}%</strong></p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">Cálculo: apuesta ÷ (pozo previo + 2 × apuesta). Exacto en river sin rake y sin más apuestas. En flop o turn es solo una referencia: considera realización de equity, apuestas futuras, rake y posición.</p>
              </div>
            )}

            <div className="mt-7 grid gap-4 lg:grid-cols-2">
              <aside className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.055] p-5">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-white"><ShieldCheck size={20} className="text-emerald-300" /> Plan para continuar</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">{guide.next}</p>
              </aside>
              <aside className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-5">
                <h3 className="flex items-center gap-2 text-base font-extrabold text-white"><Info size={20} className="text-amber-300" /> Error que debes evitar</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">{guide.avoid}</p>
              </aside>
            </div>
          </section>

          <section className="mt-9 overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0d1b22] p-5 sm:p-7">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300"><BookOpen size={16} /> Ejemplo para practicar</div>
            <div className="mt-5 grid gap-6 md:grid-cols-[0.85fr_1.15fr] md:items-start">
              <div className="rounded-xl border border-white/10 bg-black/25 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Board</p>
                <p className="mt-2 font-mono text-2xl font-extrabold tracking-wide text-white sm:text-3xl">{guide.example.board}</p>
                <p className="mt-5 text-xs font-bold uppercase tracking-widest text-slate-400">Tu mano</p>
                <p className="mt-2 font-mono text-2xl font-extrabold text-cyan-200">{guide.example.hero}</p>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">¿Qué harías antes de ver el resultado?</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">{guide.example.story}</p>
                <details className="group mt-4 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.055] p-4">
                  <summary className="cursor-pointer font-bold text-cyan-200 marker:text-cyan-300">Ver razonamiento de la mascota</summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-200">{guide.example.analysis}</p>
                </details>
                <p className="mt-3 text-xs text-slate-400">Ejemplo conceptual, no una frecuencia extraída de solver ni una recomendación universal.</p>
              </div>
            </div>
          </section>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Link to="/academia" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"><BookOpen size={16} /> Explorar la Academia Sharkania</Link>
            {street !== "river" && <button type="button" onClick={() => { setStreet(nextStreet); setActionMode("sin_apuesta"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300 bg-cyan-400 px-4 py-2 text-sm font-black text-[#052027] hover:bg-cyan-300">
              Continuar al {nextStreet} <ArrowRight size={17} />
            </button>}
          </div>

          <section className="mt-12 border-t border-white/10 pt-8">
            <h2 className="text-xl font-extrabold text-white">Conceptos que debes dominar</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FORMAT_NOTES.map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <dt className="font-extrabold text-cyan-200">{item.label}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-slate-300">{item.meaning}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-7 max-w-4xl rounded-xl border border-white/10 bg-[#10171c] p-4 text-xs leading-relaxed text-slate-400">
              <p><strong className="text-white">Alcance de la guía:</strong> punto de partida educativo para Texas Hold'em cash online 6-max, especialmente pozos heads-up de 100bb. Las decisiones reales cambian con rangos preflop, stacks, rake, tamaño de apuestas, historial de la mano y tendencias rivales. IP/OOP no equivale por sí solo a ser agresor o defensor; los ejemplos usan BTN agresor contra BB defensor para fijar un contexto claro.</p>
              <p className="mt-3">Puedes estudiar estas preguntas fuera de la mesa. Esta guía no proporciona respuestas calculadas por un solver, porcentajes GTO exactos ni garantiza ganancias.</p>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
