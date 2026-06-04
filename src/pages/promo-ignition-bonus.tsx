// src/pages/promo-ignition-bonus.tsx
import { PageShell } from "../components/layout/page-shell";
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
    <PageShell>
      <SEOHead 
        title="Bono de Bienvenida $1,000 USD - Ignition Poker x Sharkania" 
        description="Recibe un bono de bienvenida del 100% hasta $1,000 USD en tu primer depósito en Ignition Poker. Además, obtén 50 Free Spins y tickets para torneos." 
      />
      
      {/* 1. HERO SECTION */}
      <section className="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden bg-sk-bg-0">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a0f0a] to-sk-bg-0" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none" />
        </div>
        
        <div className="max-w-[1200px] mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full text-orange-400 font-mono text-xs uppercase tracking-widest font-bold mb-6">
            <Gift size={14} />
            Promoción Exclusiva
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6 leading-tight uppercase font-heading">
            El Fuego Llega a Sharkania <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">
              Bono 100% hasta $1,000 USD
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-sk-text-2 mb-10 max-w-3xl mx-auto">
            Solo hay algo mejor que un bono gigante para comenzar a jugar al póker: <strong>RECIBIR REGALOS EXTRA.</strong> Únete a Ignition Poker a través de Sharkania y desata tu potencial en las mesas.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={AFFILIATE_LINK} target="_blank" rel="noopener noreferrer">
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
              <p className="text-sk-sm font-mono text-sk-text-3 font-bold uppercase tracking-wider mb-2">4 Tickets Exclusivos</p>
              <h3 className="text-xl font-black text-sk-text-1 leading-tight">SUNDAY FREEROLLING <br /><span className="text-orange-500 text-2xl">$1,200 USD</span></h3>
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
            <p className="text-sk-text-3">Es un proceso rápido y seguro diseñado para que estés en las mesas en minutos.</p>
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
                  Realiza tu primer depósito utilizando tu método de pago favorito (Recomendamos Criptomonedas para retiros más rápidos) y siéntate en las mesas.
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
            <a href={AFFILIATE_LINK} target="_blank" rel="noopener noreferrer">
              <Button size="xl" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold border-none shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:scale-105 transition-all px-12">
                Deposita y Activa el Bono Ahora
              </Button>
            </a>
          </div>
        </div>
      </section>

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
                    Dado que por cada <strong>150 Coins</strong> acumuladas se liberan <strong>$5 USD en dinero real</strong> directo a tu cajero, estarás obteniendo un espectacular <strong>50% de Rakeback efectivo</strong> mientras liberas tu bono. Tienes 30 días para aprovecharlo al máximo.
                  </>
                } 
              />
              <FAQItem 
                question="¿Voy a poder jugar los Freerolls de $1,200 de Ignition?" 
                answer="¡Sí! Con tu primer depósito aseguras tu participación gratuita en los próximos cuatro torneos 'Sunday FreeRolling' de $1,200 USD garantizados, que se disputan cada domingo. Son $4,800 USD en premios que puedes jugar gratis." 
              />
              <FAQItem 
                question="¿Puedo usar el bono de las 50 Free Spins de inmediato?" 
                answer="Totalmente. Las 50 Free Spins para el juego '777 Deluxe' se acreditan de forma automática tras tu depósito. Ve a la sección de Casino, busca el juego y utilízalos." 
              />
              <FAQItem 
                question="¿El bono está disponible para jugadores de Latinoamérica?" 
                answer="Sí, la promoción es válida para jugadores de Argentina, Chile, Brasil, Colombia, México, Ecuador, Perú y casi toda América Latina." 
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
                Ignition acepta una gran variedad de métodos en Latam. Recomendamos Cripto para velocidad total.
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
                <li>La creación de múltiples cuentas resultará en baneos permanentes de ambas plataformas.</li>
              </ul>
            </div>
          </div>

        </div>
      </section>

    </PageShell>
  );
}