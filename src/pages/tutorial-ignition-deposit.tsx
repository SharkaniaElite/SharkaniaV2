// src/pages/tutorial-ignition-deposit.tsx
import { useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Link } from "react-router-dom";
import { 
  ExternalLink, ShieldCheck, CreditCard, Copy, 
  Send, PlayCircle, X, AlertTriangle, 
  ArrowRight, Info, CheckCircle2, Globe,
  Download, Banknote
} from "lucide-react";
import { Button } from "../components/ui/button";

export function TutorialIgnitionDepositPage() {
  const [zoomedImg, setZoomedImg] = useState<string | null>(null);

  const BINANCE_REF = "https://www.binance.com/referral/earn-together/refer2earn-usdc/claim?hl=es&ref=GRO_28502_9W9FH&utm_source=referral_entrance&utm_medium=web_share_copy";

  // Agrupamos las imágenes en 8 Fases Lógicas (Depósito y Retiro)
  const macroSteps = [
    {
      id: "fase1",
      number: "01",
      title: "Cuenta Binance",
      shortDesc: "Registro seguro",
      icon: <ShieldCheck className="text-yellow-500" size={24} />,
      intro: "Binance es la plataforma financiera global que te permitirá saltarte los bloqueos bancarios. Al ingresar con nuestro enlace, obtendrás recompensas exclusivas.",
      microSteps: [
        { img: "Paso1.png", desc: "Haz clic en nuestro enlace oficial y presiona el botón amarillo 'Potenciar ahora' para vincular tu cuenta con nuestros beneficios." },
        { img: "Paso2.png", desc: "Ingresa tu correo electrónico o número de teléfono. Sigue las instrucciones en pantalla para crear y verificar tu cuenta." }
      ]
    },
    {
      id: "fase2",
      number: "02",
      title: "Cargar Saldo",
      shortDesc: "Compra USDT",
      icon: <CreditCard className="text-yellow-500" size={24} />,
      intro: "Transformaremos tu moneda local en Dólar Digital (USDT). IMPORTANTE: Nuestro ejemplo usa Pesos Chilenos (CLP), pero Binance opera en todo el mundo. Si estás en otro país, simplemente busca tu moneda local (MXN, PEN, ARS, COP, etc.).",
      microSteps: [
        { img: "Paso3.png", desc: "En tu panel principal de Binance, haz clic en el botón amarillo 'Deposit' en la esquina superior derecha." },
        { img: "Paso4.png", desc: "En el menú desplegable, selecciona 'Buy with CLP' (o la moneda oficial de tu país)." },
        { img: "Paso5.png", desc: "Ingresa el monto que deseas depositar. Automáticamente verás cuántos USDT recibirás. Selecciona pago con Tarjeta (Card) y presiona 'Buy USDT'." },
        { img: "Paso6.png", desc: "Binance te avisará que la transacción se procesará de forma segura. Marca la casilla de términos y dale a 'Continue'." },
        { img: "Paso7.png", desc: "Revisa los detalles, añade tu tarjeta de débito/crédito si no lo has hecho, y presiona 'Pay'." },
        { img: "Paso9.png", desc: "Recibirás un SMS o notificación con un código de seguridad de 6 dígitos. Ingrésalo en la pantalla siguiente." },
        { img: "Paso8.png", desc: "El código es por seguridad, de tu banco o procesador (ej: MercadoPago) por eso te pedirá validar la compra con ese código." },
        { img: "Paso10.png", desc: "Confirma la cotización final presionando 'Accept Quote'." },
        { img: "Paso11.png", desc: "¡Compra exitosa! Verás el ticket verde. Presiona 'Back to Binance'." },
        { img: "Paso12.png", desc: "Espera un par de segundos y haz clic en 'Check Assets' para ir a tu billetera." },
        { img: "Paso13.png", desc: "¡Listo! Ya tienes tus USDT (Dólares Digitales) listos en tu Spot Account." }
      ]
    },
    {
      id: "fase3",
      number: "03",
      title: "Cajero Ignition",
      shortDesc: "Obtén tu dirección",
      icon: <Copy className="text-orange-500" size={24} />,
      intro: "Ahora vamos a Ignition Poker a buscar la 'dirección de destino' donde enviaremos esos dólares digitales.",
      microSteps: [
        { img: "Paso14.jfif", desc: "Abre el software o la web de Ignition Poker. Verás tu saldo en $0.00. Presiona el botón naranja gigante 'CAJERO'." },
        { img: "Paso15.png", desc: "Dentro del cajero, asegúrate de estar en la pestaña Depositar y selecciona la opción 'USDT'." },
        { img: "Paso16.png", desc: "¡PASO CRÍTICO! Ignition generará un código QR y una dirección larga que empieza con '0x'. Haz clic en 'Copiado'. Asegúrate de leer que la red es ERC-20 (Layer 1)." }
      ]
    },
    {
      id: "fase4",
      number: "04",
      title: "Enviar Fondos",
      shortDesc: "Retiro de Binance",
      icon: <Send className="text-yellow-500" size={24} />,
      intro: "Volvemos a Binance para hacer el envío. Presta mucha atención a la selección de la RED.",
      microSteps: [
        { img: "Paso17.png", desc: "En tu panel de Binance, busca el botón 'Withdraw' (Retirar) junto a tu saldo." },
        { img: "Paso18.png", desc: "Selecciona la moneda USDT. En 'Address' PEGA la dirección que copiaste de Ignition. En 'Network' (Red) debes elegir ESTRICTAMENTE 'ETH Ethereum (ERC20)'. Pon el monto a enviar y dale a 'Withdraw'." },
        { img: "Paso19.png", desc: "Aparecerá un resumen de la transacción detallando la comisión de red. Presiona 'Continue'." },
        { img: "Paso20.png", desc: "Por tu propia seguridad, Binance te pedirá el código de tu Authenticator App o un SMS para liberar los fondos. Ingrésalo y presiona 'Submit'." }
      ]
    },
    {
      id: "fase5",
      number: "05",
      title: "Confirmación",
      shortDesc: "Procesando en red",
      icon: <CheckCircle2 className="text-green-500" size={24} />,
      intro: "La transferencia ya está viajando por la red blockchain. Es un proceso automático.",
      microSteps: [
        { img: "Paso21.png", desc: "Verás una pantalla de éxito indicando la cantidad exacta enviada. Puedes presionar 'Withdraw Details'." },
        { img: "Paso22.png", desc: "El estado aparecerá como 'Awaiting Approval' o 'Processing'. Esto toma apenas entre 2 a 5 minutos en confirmarse en la red de Ethereum." }
      ]
    },
    {
      id: "fase6",
      number: "06",
      title: "¡A Jugar!",
      shortDesc: "Saldo en Ignition",
      icon: <PlayCircle className="text-orange-500" size={24} />,
      intro: "El paso final. Tu dinero ya está disponible para las mesas.",
      microSteps: [
        { img: "paso23.png", desc: "Vuelve a Ignition Poker. ¡Magia! Tu saldo para apostar ya refleja los USD depositados. Estás oficialmente listo para destrozar las mesas." }
      ]
    },
    {
      id: "fase7",
      number: "07",
      title: "Dirección Binance",
      shortDesc: "Para recibir fondos",
      icon: <Download className="text-blue-500" size={24} />,
      intro: "El proceso de retiro es el mismo, pero al revés. Primero necesitamos ir a Binance para obtener tu 'Dirección de Recepción'.",
      microSteps: [
        { img: "Paso28.png", desc: "Abre tu cuenta de Binance. Dirígete a la opción 'Deposit' (Depositar) en la parte superior derecha de tu pantalla." },
        { img: "Paso29.png", desc: "En el menú desplegable, selecciona 'Deposit Crypto' (Depositar Criptomonedas), ya que Ignition te pagará enviando USDT." },
        { img: "Paso30.png", desc: "¡PASO CRÍTICO! Selecciona la moneda USDT. En la Red (Network) elige ESTRICTAMENTE 'ETH Ethereum (ERC20)'. Copia la dirección '0x' generada." }
      ]
    },
    {
      id: "fase8",
      number: "08",
      title: "Retiro Ignition",
      shortDesc: "Cobra ganancias",
      icon: <Banknote className="text-green-500" size={24} />,
      intro: "Con tu dirección de Binance copiada, vamos al cajero de Ignition a solicitar el pago de tus ganancias.",
      microSteps: [
        { img: "Paso24.jfif", desc: "Ve al lobby principal de Ignition Poker y haz clic en el botón naranja gigante de 'CAJERO'." },
        { img: "Paso25.png", desc: "En el cajero, asegúrate de cambiar a la pestaña 'RETIRAR' (Withdraw) y selecciona 'USDT' como método de cobro." },
        { img: "Paso26.png", desc: "Ignition te mostrará tu saldo disponible para retiro. En la casilla de monto, ingresa la cantidad que deseas retirar." },
        { img: "Paso27.png", desc: "Verás que te solicita una 'USDT Dirección' para enviar los fondos." },
        { img: "Paso31.png", desc: "Pega la dirección de tu monedero Binance (la que copiaste en el paso anterior) y haz clic en 'Solicitar Retiro'." },
        { img: "Paso32.png", desc: "Por tu propia seguridad, Ignition te pedirá el PIN de 4 dígitos que configuraste al crear tu cuenta." },
        { img: "Paso33.png", desc: "¡Éxito! Verás la pantalla de confirmación. Tus USDT llegarán a Binance usualmente en unas pocas horas (hasta 24h). Luego puedes venderlos en Binance P2P directo a tu cuenta bancaria." }
      ]
    }
  ];

  return (
    <PageShell>
      <SEOHead 
        title="Mega Tutorial: Cómo Depositar en Ignition Poker (Vía Binance)" 
        description="Guía paso a paso definitiva (con más de 20 imágenes) para cargar saldo en Ignition Poker desde cualquier país usando Binance y USDT." 
      />
      
      <div className="pt-20 pb-16 min-h-screen bg-sk-bg-1">
        
        {/* ══ HERO SECTION ══ */}
        <div className="bg-gradient-to-b from-[#0a0f1a] to-sk-bg-1 border-b border-sk-border-2 pt-16 pb-12">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full text-blue-400 font-mono text-xs uppercase tracking-widest font-bold mb-6">
              <Globe size={14} />
              Válido para todos los países
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-6 leading-tight">
              Cómo Depositar y Retirar en <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-[#FCD535]">Ignition Poker vía Binance</span>
            </h1>
            <p className="text-sk-lg text-sk-text-2 mb-8 max-w-3xl mx-auto">
              El tutorial más detallado de internet. Te llevamos de la mano pantalla por pantalla para que cargues tu cuenta y retires tus ganancias usando USDT (Dólar Digital) de forma rápida, segura y sin bloqueos bancarios.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 mt-8">
          {/* ══ PREREQUISITO: AVISO IGNITION ══ */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg mb-16">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20 mt-1">
                <Info className="text-orange-500" size={20} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Paso Cero: ¿Ya creaste tu cuenta en Ignition?</h3>
                <p className="text-sk-text-3 text-sm">Si aún no te has registrado en Ignition Poker bajo nuestra liga, hazlo primero para asegurar tus bonos y acceso a torneos gratuitos.</p>
              </div>
            </div>
            <Link to="/tutorial-ignition" className="shrink-0 w-full md:w-auto">
              <Button variant="ghost" className="w-full border border-orange-500/50 text-orange-400 hover:bg-orange-500/10 bg-transparent">
                Tutorial de Registro <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
          </div>

          {/* ══ ROADMAP HORIZONTAL (NAVEGACIÓN) ══ */}
          <div className="hidden md:flex justify-between items-start mb-20 relative overflow-x-auto pb-4 scrollbar-hide">
            <div className="absolute top-5 left-8 right-8 h-0.5 bg-sk-border-2 z-0" />
            {macroSteps.map((fase) => (
              <a 
                href={`#${fase.id}`} 
                key={fase.id} 
                className="relative z-10 flex flex-col items-center group min-w-[5rem] md:w-24 text-center cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-sk-bg-1 border-2 border-sk-border-2 flex items-center justify-center mb-3 group-hover:border-sk-accent group-hover:scale-110 transition-all duration-300 shadow-md">
                  <span className="font-mono text-xs font-bold text-sk-text-3 group-hover:text-sk-accent">{fase.number}</span>
                </div>
                <h4 className="text-[10px] md:text-[11px] font-bold text-white uppercase tracking-wider mb-1 group-hover:text-sk-accent transition-colors">{fase.title}</h4>
                <p className="text-[9px] md:text-[10px] text-sk-text-4 leading-tight px-1">{fase.shortDesc}</p>
              </a>
            ))}
          </div>

          {/* ══ MACRO PASOS Y MICRO PASOS ══ */}
          <div className="space-y-24">
            {macroSteps.map((fase, index) => (
              <div id={fase.id} key={fase.id} className="scroll-mt-24">
                
                {/* Cabecera de la Fase */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-sk-bg-2 border border-sk-border-2 flex items-center justify-center shadow-lg">
                    {fase.icon}
                  </div>
                  <div>
                    <span className="text-sk-text-3 font-mono text-xs font-bold tracking-widest uppercase">Fase {fase.number}</span>
                    <h2 className="text-3xl font-black text-white">{fase.title}</h2>
                  </div>
                </div>
                
                <p className="text-sk-text-2 text-lg leading-relaxed mb-10 max-w-3xl">
                  {fase.intro}
                </p>

                {/* Botón especial para Binance en Fase 1 */}
                {fase.id === "fase1" && (
                  <div className="mb-12">
                    <a href={BINANCE_REF} target="_blank" rel="noopener noreferrer" className="inline-block">
                      <Button className="bg-[#FCD535] hover:bg-[#e0bd2e] text-black font-bold border-none shadow-[0_0_20px_rgba(252,213,53,0.3)] px-8 py-6 text-lg">
                        Crear cuenta en Binance <ExternalLink size={18} className="ml-2" />
                      </Button>
                    </a>
                  </div>
                )}

                {/* Alerta Roja especial para Redes ERC20 (Depósito y Retiro) */}
                {(fase.id === "fase3" || fase.id === "fase4" || fase.id === "fase7") && (
                  <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-5 flex items-start gap-4 mb-10 max-w-3xl">
                    <AlertTriangle className="text-red-500 shrink-0 mt-1" size={24} />
                    <div>
                      <h4 className="text-red-400 font-bold text-base mb-1">¡NUNCA TE EQUIVOQUES DE RED!</h4>
                      <p className="text-red-200/80 text-sm leading-relaxed">
                        Ignition Poker procesa los USDT <strong>EXCLUSIVAMENTE bajo la red de Ethereum (ERC-20)</strong>. Si seleccionas otra red (como Tron o BSC), <strong>perderás tu dinero permanentemente</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Grid de Micro Pasos (Imágenes) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {fase.microSteps.map((micro, mIdx) => (
                    <div key={mIdx} className="bg-sk-bg-2 border border-sk-border-2 rounded-xl overflow-hidden shadow-lg flex flex-col group">
                      <div 
                        className="relative h-48 overflow-hidden bg-black cursor-zoom-in border-b border-sk-border-2"
                        onClick={() => setZoomedImg(`/bg/${micro.img}`)}
                      >
                        <div className="absolute inset-0 bg-sk-accent/0 group-hover:bg-sk-accent/10 transition-colors z-10 pointer-events-none" />
                        <img 
                          src={`/bg/${micro.img}`} 
                          alt={`Detalle ${fase.id} - ${mIdx}`} 
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                          loading="lazy"
                        />
                        <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded shadow-md z-20">
                          Ampliar
                        </div>
                      </div>
                      <div className="p-5 flex-1">
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-sk-bg-3 border border-sk-border-3 flex items-center justify-center text-xs font-bold text-sk-text-3">
                            {mIdx + 1}
                          </span>
                          <p className="text-sk-text-2 text-sm leading-relaxed">{micro.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* LÍNEA DIVISORIA */}
                {index !== macroSteps.length - 1 && (
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-sk-border-2 to-transparent mt-24" />
                )}
              </div>
            ))}
          </div>

          {/* ══ CTA FINAL ══ */}
          <div className="mt-24 mb-10 text-center bg-[#0d1117] border border-orange-500/40 p-10 rounded-2xl shadow-2xl">
            <h2 className="text-3xl font-black text-white mb-4">
              ¿Todo listo? Nos vemos en las mesas
            </h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto text-lg leading-relaxed">
              Una vez que tienes saldo en tu cuenta, estás oficialmente preparado para participar en nuestras ligas, cazar bounties y escalar en el ranking de Sharkania.
            </p>
            <Link to="/calendar">
              <Button 
                size="lg" 
                className="!bg-orange-600 !text-white !border-none font-bold px-10 hover:!bg-orange-500 transition-colors"
              >
                Ver Calendario de Torneos
              </Button>
            </Link>
          </div>

        </div>
      </div>

      {/* ══ LIGHTBOX / ZOOM MODAL ══ */}
      {zoomedImg && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 md:p-8 animate-in fade-in duration-200"
          onClick={() => setZoomedImg(null)}
        >
          <button 
            className="absolute top-6 right-6 md:top-10 md:right-10 w-12 h-12 bg-sk-bg-3 border border-sk-border-2 rounded-full flex items-center justify-center text-white hover:bg-sk-accent hover:text-black transition-colors shadow-2xl z-10"
            onClick={() => setZoomedImg(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={zoomedImg} 
            alt="Paso ampliado" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] cursor-zoom-out" 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

    </PageShell>
  );
}