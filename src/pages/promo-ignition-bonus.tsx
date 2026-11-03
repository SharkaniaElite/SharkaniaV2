// src/pages/promo-ignition-bonus.tsx
import { PageShell } from "../components/layout/page-shell";
import { ArenaRouteTrail } from "../components/arena/arena-route-trail";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { Link } from "react-router-dom";
import { 
  Gift, 
  Gamepad2, 
  DollarSign, 
  ChevronRight, 
  ShieldCheck, 
  Banknote,
  HelpCircle,
  ExternalLink
} from "lucide-react";
import { cn } from "../lib/cn";
import { useState } from "react";

// Componente para las FAQs expansibles
function FAQItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-sk-border-2 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex items-center justify-between text-left focus:outline-none"
      >
        <h3 className="text-sk-sm font-bold text-sk-text-1 pr-4">{question}</h3>
        <ChevronRight 
          size={18} 
          className={cn(
            "text-sk-accent shrink-0 transition-transform duration-300", 
            isOpen && "rotate-90"
          )} 
        />
      </button>
      <div 
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-96 pb-4 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="text-sk-sm text-sk-text-3 leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}

export function PromoIgnitionBonusPage() {
  const AFFILIATE_LINK = "https://record.revenuenetwork.com/_s_OAdmC6KUepsRaI0hkgHmNd7ZgqdRLk/1/";

  return (
    <PageShell variant="arena" showMarketing>
      <SEOHead 
        title="Bono de Bienvenida $1,000 USD - Ignition Poker x Sharkania" 
        description="Consulta información sobre el bono de bienvenida en Ignition Poker, las condiciones oficiales, la elegibilidad y los requisitos de liberación." 
        path="/promociones/ignition-bonus"
      />
      
      <div className="arena-public-bridge arena-partner-route arena-ignition-route">
        <ArenaRouteTrail section="Promociones de póker" current="Bono Ignition Poker" />
      {/* 1. HERO SECTION */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden bg-sk-bg-0">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a0f0a] to-sk-bg-0" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none" />
        </div>
        
        <div className="max-w-[1200px] mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full text-orange-400 font-mono text-xs uppercase tracking-widest font-bold mb-6">
            <Gift size={14} />
            Oferta para nuevos jugadores
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6 leading-tight uppercase font-heading">
            El Fuego Llega a Sharkania <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">
              Bono 100% hasta $1,000 USD
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-sk-text-2 mb-10 max-w-3xl mx-auto">
            El bono se desbloquea conforme generas comisiones de póker elegibles. Revisa los requisitos, la disponibilidad regional y el plazo antes de depositar.
          </p>
          
          <p className="text-xs text-sk-text-3 max-w-3xl mx-auto mb-6">Oferta general, no exclusiva de Sharkania. Información revisada el 2 de noviembre de 2026; próxima revisión editorial: 2 de diciembre de 2026. La revisión no equivale al vencimiento oficial. Contenido comercial: Sharkania puede obtener una comisión. +18 · Juego responsable.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={AFFILIATE_LINK} target="_blank" rel="sponsored noopener noreferrer">
              <Button size="xl" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white border-none shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:scale-105 transition-transform w-full sm:w-auto px-10">
                ¡Lo Quiero Ahora! <ExternalLink size={18} className="ml-2" />
              </Button>
            </a>
            <Link to="/tutorial-ignition">
              <Button size="xl" variant="secondary" className="w-full sm:w-auto">
                Ver Tutorial de Registro
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. PAQUETE DE BIENVENIDA (LOS 3 REGALOS) */}
      <section className="py-16 bg-sk-bg-1 border-y border-sk-border-2">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-sk-text-1 uppercase font-heading">En un solo depósito obtén:</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-sk-bg-2 border border-sk-border-2 p-8 rounded-xl text-center shadow-lg hover:border-orange-500/50 transition-colors group">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <DollarSign size={32} className="text-orange-500" />
              </div>
              <p className="text-sk-sm font-mono text-sk-text-3 font-bold uppercase tracking-wider mb-2">Bono Cash</p>
              <h3 className="text-2xl font-black text-sk-text-1 leading-tight">100% HASTA <br /><span className="text-orange-500">$1,000 USD</span></h3>
            </div>
            
            <div className="bg-sk-bg-2 border border-sk-border-2 p-8 rounded-xl text-center shadow-lg hover:border-orange-500/50 transition-colors group relative overflow-hidden">
              <div className="absolute -right-4 -top-4 text-[100px] opacity-[0.03] pointer-events-none font-black text-white">🎟️</div>
              <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Gamepad2 size={32} className="text-orange-500" />
              </div>
              <p className="text-sk-sm font-mono text-sk-text-3 font-bold uppercase tracking-wider mb-2">Tickets de Torneos</p>
              <h3 className="text-xl font-black text-sk-text-1 leading-tight">Sujeto a <br /><span className="text-orange-500 text-2xl">calendario oficial</span></h3>
            </div>
            
            <div className="bg-sk-bg-2 border border-sk-border-2 p-8 rounded-xl text-center shadow-lg hover:border-orange-500/50 transition-colors group">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Gift size={32} className="text-orange-500" />
              </div>
              <p className="text-sk-sm font-mono text-sk-text-3 font-bold uppercase tracking-wider mb-2">Free Spins</p>
              <h3 className="text-2xl font-black text-sk-text-1 leading-tight">50 GIROS PARA <br /><span className="text-orange-500">777 DELUXE</span></h3>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CÓMO OBTENERLO (PASOS) */}
      <section className="py-20 bg-sk-bg-0">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-sk-text-1 uppercase font-heading mb-4">Solo tienes que seguir estos pasos:</h2>
            <p className="text-sk-text-3">Consulta previamente los términos del bono, los requisitos de liberación y las restricciones de tu país.</p>
          </div>

          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-sk-border-2 before:to-transparent">
            
            {/* Paso 1 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-sk-bg-0 bg-sk-bg-2 text-orange-500 font-black shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">1</div>
              <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] bg-sk-bg-2 p-6 rounded-xl border border-sk-border-2 shadow-sm">
                <h3 className="font-bold text-sk-text-1 text-lg mb-2">Regístrate en Ignition</h3>
                <p className="text-sk-sm text-sk-text-3 leading-relaxed">
                  Haz clic en el botón de abajo y ve a la sección “Regístrate” en la parte superior derecha del sitio. Esto tomará solamente dos minutos usando datos reales.
                </p>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-sk-bg-0 bg-sk-bg-2 text-orange-500 font-black shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">2</div>
              <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] bg-sk-bg-2 p-6 rounded-xl border border-sk-border-2 shadow-sm">
                <h3 className="font-bold text-sk-text-1 text-lg mb-2">Selecciona tu Bono</h3>
                <p className="text-sk-sm text-sk-text-3 leading-relaxed">
                  Dentro de tu perfil en Ignition, dirígete a la sección “Depositar” y asegúrate de <strong>seleccionar tu Bono de Bienvenida (100% Poker)</strong> antes de proceder al pago.
                </p>
              </div>
            </div>

            {/* Paso 3 */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-sk-bg-0 bg-sk-bg-2 text-orange-500 font-black shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">3</div>
              <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] bg-sk-bg-2 p-6 rounded-xl border border-sk-border-2 shadow-sm">
                <h3 className="font-bold text-sk-text-1 text-lg mb-2">Deposita y Juega</h3>
                <p className="text-sk-sm text-sk-text-3 leading-relaxed">
                  Realiza tu primer depósito utilizando tu método de pago favorito (Confirma antes los costos y plazos de cada método) y siéntate en las mesas.
                </p>
              </div>
            </div>

            {/* Paso 4 (Sharkania Extra) */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-sk-bg-0 bg-orange-500 text-white font-black shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <ShieldCheck size={18} />
              </div>
              <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] bg-gradient-to-r from-orange-900/30 to-sk-bg-2 p-6 rounded-xl border border-orange-500/30 shadow-sm relative overflow-hidden">
                <h3 className="font-bold text-white text-lg mb-2">Vincúlalo en Sharkania</h3>
                <p className="text-sk-sm text-sk-text-3 leading-relaxed">
                  Una vez creada tu cuenta, vuelve a Sharkania y vincula tu usuario de Ignition en tu Perfil. Así podremos enviarte las contraseñas de nuestros torneos exclusivos.
                </p>
              </div>
            </div>
            
          </div>
          
          <div className="mt-12 text-center">
            <a href={AFFILIATE_LINK} target="_blank" rel="sponsored noopener noreferrer">
              <Button size="xl" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold border-none shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:scale-105 transition-all px-12">
                Deposita y Activa el Bono Ahora
              </Button>
            </a>
          </div>
        </div>
      </section>

      <div className="text-center text-xs text-sk-text-3 px-6 py-4 bg-sk-bg-0">
        Condiciones oficiales: <a href="https://www.ignitionpoker.com/en/bonus-terms-conditions" target="_blank" rel="noopener noreferrer" className="underline hover:text-sk-accent">Bonos Ignition Poker</a>. Bono del 100% hasta US$1.000 para el primer depósito, sujeto a liberación y elegibilidad.
      </div>
      {/* 4. PREGUNTAS FRECUENTES Y MÉTODOS DE PAGO */}
      <section className="py-20 bg-sk-bg-1 border-t border-sk-border-2">
        <div className="max-w-[1000px] mx-auto px-6 grid lg:grid-cols-12 gap-12">
          
          {/* FAQs */}
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3 mb-8">
              <HelpCircle className="text-orange-500" size={24} />
              <h2 className="text-2xl font-black text-sk-text-1 uppercase font-heading">Preguntas Frecuentes</h2>
            </div>
            
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl px-6">
              <FAQItem 
                question="¿Cómo libero mi bono de $1,000 USD?" 
                answer={
                  <>
                    El bono se desbloquea gradualmente a medida que juegas. Ganas <strong>15 Ignition Miles (Coins) por cada $1 USD de rake</strong> que generes en Cash Games o en fees de torneos.
                    <br /><br />
                    Dado que por cada <strong>150 Coins</strong> acumuladas se liberan <strong>$5 USD en dinero real</strong> directo a tu cajero, la liberación equivale a US$5 por cada US$10 de rake elegible, <strong>solo hasta agotar el saldo promocional</strong>. No es un rakeback permanente. El plazo oficial de liberación es de 30 días desde el depósito seleccionado.
                  </>
                } 
              />
              <FAQItem 
                question="¿Voy a poder jugar los Freerolls de $1,200 de Ignition?" 
                answer="Los tickets incluidos dependen de las condiciones promocionales y del calendario vigente. Ignition indica la posible acreditación de un ticket para un torneo gratuito de US$10.000, pero no confirma cuatro entradas Sunday FreeRolling de US$1.200. Revisa el bono de tu cuenta." 
              />
              <FAQItem 
                question="¿Puedo usar el bono de las 50 Free Spins de inmediato?" 
                answer="Las condiciones publicadas incluyen 50 giros para 777 Deluxe en ciertos paquetes elegibles. El beneficio está sujeto a disponibilidad, un límite de ganancia de US$10 como bono y requisitos de rollover de casino. Consulta su aplicación en tu cuenta." 
              />
              <FAQItem 
                question="¿El bono está disponible para jugadores de Latinoamérica?" 
                answer="Ignition puede restringir ofertas por país y por cuenta. No podemos asegurar elegibilidad de todos los países latinoamericanos. Confirma el acceso y la bonificación en la plataforma antes de registrarte." 
              />
              <FAQItem 
                question="¿Puedo jugar desde mi celular?" 
                answer="Ignition Poker tiene un excelente cliente web responsivo. Puedes jugar desde el navegador de tu computadora, tablet o teléfono celular sin necesidad de instalar una app que ocupe espacio." 
              />
            </div>
          </div>

          {/* Info Lateral (Pagos & Disclaimer) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6">
              <h3 className="font-bold text-sk-text-1 mb-4 flex items-center gap-2">
                <Banknote className="text-green-500" size={18} />
                Métodos de Pago
              </h3>
              <p className="text-xs text-sk-text-3 mb-4">
                Los métodos disponibles y sus tiempos pueden variar según país y cuenta; compruébalos en el cajero.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Bitcoin", "Ethereum", "Tether (USDT)", "Litecoin", "Tarjetas (Visa/MC)"].map(metodo => (
                  <span key={metodo} className="bg-sk-bg-3 border border-sk-border-1 text-sk-text-2 text-[10px] uppercase font-bold px-2 py-1 rounded">
                    {metodo}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-[#1a1208] border border-orange-500/20 rounded-xl p-6">
              <h3 className="font-bold text-orange-500 mb-2 text-sm uppercase">Términos Clave</h3>
              <ul className="text-[11px] text-sk-text-3 space-y-2 list-disc pl-3">
                <li>Bono válido solo para el primer depósito.</li>
                <li>Los depósitos vía Vouchers no califican para la promo.</li>
                <li>Los tickets de torneo se acreditan los viernes.</li>
                <li>Free Spins tienen un cap de ganancia de $10 (pagados como bono de casino con rollover x30).</li>
                <li>El uso de múltiples cuentas puede provocar pérdida de beneficios y restricciones según los términos de Ignition.</li>
              </ul>
            </div>
          </div>

        </div>
      </section>
      </div>
    </PageShell>
  );
}