// src/pages/promo-coinpoker.tsx
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { 
  Zap, Gift, Trophy, Coins, ShieldCheck, 
  ArrowRight, Flame, Wallet, PlayCircle 
} from "lucide-react";

// Enlace de Afiliado Centralizado
const AFFILIATE_LINK = "https://record.coinpokeraffiliates.com/_ZnRTLL6Lwv7UOsjNOfgKeWNd7ZgqdRLk/1/";

export function PromoCoinPokerPage() {
  return (
    <PageShell>
      <SEOHead 
        title="CoinPoker | Bono 150% y Rakeback Épico | Sharkania" 
        description="Únete a CoinPoker con Sharkania. Bono de bienvenida del 150% hasta $2.000, 15% de rakeback diario y cero bloqueos geográficos." 
      />
      <div className="selection:bg-red-500/30 bg-sk-bg-0">
        
        {/* ============================================================== 
            HERO SECTION (Cinemático y Agresivo)
        ============================================================== */}
        <section className="relative overflow-hidden pt-24 pb-32 lg:pt-36 lg:pb-40 border-b border-white/5">
          {/* Fondos y resplandores */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-red-600/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-sk-accent/10 blur-[150px] rounded-full pointer-events-none" />
          
          <div className="container mx-auto px-4 relative z-10 grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Copy Principal */}
            <div className="space-y-8 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono font-bold tracking-wider mb-2">
                <Flame size={14} className="animate-pulse" />
                SALA RECOMENDADA 2026
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-black text-white leading-[1.1] tracking-tight">
                LA EVOLUCIÓN <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-orange-500">
                  DEL POKER.
                </span>
              </h1>
              
              <p className="text-lg text-sk-text-3 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Cero bloqueos geográficos. Retiros en minutos. Únete a la sala crypto de mayor crecimiento mundial y domina mesas blandas con un rakeback sin competencia.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                <a href={AFFILIATE_LINK} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                  <Button variant="accent" size="lg" className="w-full bg-red-600 hover:bg-red-500 text-white border-none shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:shadow-[0_0_40px_rgba(220,38,38,0.6)] h-14 px-8 text-lg">
                    Reclamar Bono de $2.000 <ArrowRight size={20} className="ml-2" />
                  </Button>
                </a>
                <a href="/tutorial-coinpoker" className="w-full sm:w-auto text-sk-text-3 hover:text-white transition-colors flex items-center justify-center font-bold text-sm">
                  <PlayCircle size={18} className="mr-2" /> Ver tutorial de depósito
                </a>
              </div>
            </div>

            {/* ESPACIO PARA IMAGEN 1: HERO RENDER */}
            <div className="relative group perspective-[1000px]">
              <div className="aspect-[4/3] rounded-2xl border border-sk-border-2 bg-gradient-to-br from-sk-bg-2 to-sk-bg-1 flex flex-col items-center justify-center p-8 text-center overflow-hidden shadow-2xl relative">
                
                {<img src="/images/promos/hero-coinpoker.webp" alt="CoinPoker 3D Render" className="w-full h-full object-cover rounded-xl" />}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== 
            SHARKANIA EXCLUSIVE (El motivo para usar tu link)
        ============================================================== */}
        <section className="py-10 bg-sk-bg-1 border-b border-white/5 relative z-20">
          <div className="container mx-auto px-4">
            <div className="bg-gradient-to-r from-sk-bg-2 via-sk-bg-3 to-sk-bg-2 rounded-2xl border border-sk-border-2 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-full bg-sk-accent/5 blur-[50px]" />
              
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 rounded-full bg-sk-bg-0 border border-sk-accent/30 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                  <span className="text-2xl">🦈</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white mb-1">Beneficios Exclusivos Sharkania</h3>
                  <p className="text-sk-sm text-sk-text-3 m-0">
                    Registrándote con nuestro enlace accedes a <b>soporte VIP</b> para depósitos crypto y participas en futuros Freerolls privados de la comunidad.
                  </p>
                </div>
              </div>
              
              <div className="shrink-0 relative z-10 w-full md:w-auto">
                <a href={AFFILIATE_LINK} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" className="w-full md:w-auto border-sk-accent text-sk-accent hover:bg-sk-accent hover:text-sk-bg-0">
                    Registrarme bajo Sharkania
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== 
            PROMOCIONES GRID (Bono, Rakeback, Splash, Races)
        ============================================================== */}
        <section className="py-24 relative">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl lg:text-5xl font-black text-white mb-4">
                Rompiendo el Meta del Rakeback
              </h2>
              <p className="text-sk-text-3">
                CoinPoker reinvierte el 100% de las comisiones de microlímites en los jugadores. Conoce las cuatro vías de rentabilidad asegurada.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              
              {/* PROMO 1: BONO BIENVENIDA */}
              <div className="group bg-sk-bg-2 border border-sk-border-2 hover:border-red-500/50 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(220,38,38,0.15)] flex flex-col">
                <div className="h-48 bg-sk-bg-1 relative flex items-center justify-center border-b border-sk-border-2 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-red-900/40 to-transparent" />
                  <Gift size={64} className="text-red-500 relative z-10 group-hover:scale-110 transition-transform" />
                </div>
                <div className="p-8 flex-1 flex flex-col">
                  <div className="text-red-400 font-mono text-xs font-bold mb-2">SOLO PRIMER DEPÓSITO</div>
                  <h3 className="text-2xl font-black text-white mb-3">150% hasta $2.000</h3>
                  <p className="text-sk-text-3 text-sm flex-1 leading-relaxed">
                    Maximiza tu banca. Deposita desde $10 y desbloquea dinero real automáticamente mientras juegas. Sin necesidad de cumplir hitos inalcanzables: cada vez que te levantas de la mesa, el sistema te libera tu dinero en efectivo.
                  </p>
                </div>
              </div>

              {/* PROMO 2: COIN REWARDS */}
              <div className="group bg-sk-bg-2 border border-sk-border-2 hover:border-sk-accent/50 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(34,211,238,0.1)] flex flex-col">
                <div className="h-48 bg-sk-bg-1 relative flex items-center justify-center border-b border-sk-border-2 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-sk-accent/20 to-transparent" />
                  <Coins size={64} className="text-sk-accent relative z-10 group-hover:scale-110 transition-transform" />
                </div>
                <div className="p-8 flex-1 flex flex-col">
                  <div className="text-sk-accent font-mono text-xs font-bold mb-2">TOTALMENTE AUTOMÁTICO</div>
                  <h3 className="text-2xl font-black text-white mb-3">15% Diario Garantizado</h3>
                  <p className="text-sk-text-3 text-sm flex-1 leading-relaxed">
                    Recupera el 15% de todo el rake que generes en Cash y Torneos. Se calcula cada 24 horas y se deposita directamente en tu cajero al día siguiente a las 07:00 AM (UTC). Sin registros, sin condiciones ocultas.
                  </p>
                </div>
              </div>

              {/* PROMO 3: SPLASH POTS */}
              <div className="group bg-sk-bg-2 border border-sk-border-2 hover:border-yellow-500/50 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(234,179,8,0.1)] flex flex-col">
                <div className="h-48 bg-sk-bg-1 relative flex items-center justify-center border-b border-sk-border-2 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-yellow-600/20 to-transparent" />
                  <Zap size={64} className="text-yellow-500 relative z-10 group-hover:scale-110 transition-transform" />
                </div>
                <div className="p-8 flex-1 flex flex-col">
                  <div className="text-yellow-500 font-mono text-xs font-bold mb-2">HASTA NL50 / PLO50</div>
                  <h3 className="text-2xl font-black text-white mb-3">Splash Pots ($125K/sem)</h3>
                  <p className="text-sk-text-3 text-sm flex-1 leading-relaxed">
                    El cofre dorado puede aparecer en cualquier momento. Lluvia de dinero real directo en el bote, desde 50 BB hasta Mega Splashes de 1.000 BB. Si estás en la mano, tienes premio garantizado.
                  </p>
                </div>
              </div>

              {/* PROMO 4: COINRACES */}
              <div className="group bg-sk-bg-2 border border-sk-border-2 hover:border-purple-500/50 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(168,85,247,0.1)] flex flex-col">
                <div className="h-48 bg-sk-bg-1 relative flex items-center justify-center border-b border-sk-border-2 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-600/20 to-transparent" />
                  <Trophy size={64} className="text-purple-400 relative z-10 group-hover:scale-110 transition-transform" />
                </div>
                <div className="p-8 flex-1 flex flex-col">
                  <div className="text-purple-400 font-mono text-xs font-bold mb-2">CARRERAS CADA 2 HORAS</div>
                  <h3 className="text-2xl font-black text-white mb-3">CoinRaces ($1M/sem)</h3>
                  <p className="text-sk-text-3 text-sm flex-1 leading-relaxed">
                    Las tablas de clasificación más justas del mercado. No necesitas grindar 24/7. Las carreras de NLH y PLO se reinician cada 1 o 2 horas, premiando a miles de jugadores por su volumen en sesiones cortas.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ============================================================== 
            SECCIÓN DE FRICCIÓN (Destruyendo el miedo al Crypto)
        ============================================================== */}
        <section id="tutorial" className="py-24 bg-sk-bg-1 border-t border-sk-border-2">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              
              {/* ESPACIO PARA IMAGEN 2: APP MOCKUP */}
              <div className="order-2 lg:order-1">
                <div className="aspect-[4/4] max-w-md mx-auto rounded-3xl border-8 border-sk-bg-3 bg-sk-bg-0 flex flex-col items-center justify-center p-8 text-center overflow-hidden shadow-2xl relative">
                  <div className="absolute inset-4 border-2 border-dashed border-sk-border-3 rounded-xl flex flex-col items-center justify-center p-4 bg-black/60">
                    <span className="text-sk-accent mb-2">{<img src="/images/promos/app-mockup.webp" alt="CoinPoker 3D Render" className="w-full h-full object-cover rounded-xl" />}</span>
                  </div>
                </div>
              </div>

              {/* Texto Tutorial */}
              <div className="order-1 lg:order-2 space-y-8">
                <div>
                  <h2 className="text-3xl lg:text-5xl font-black text-white mb-4">
                    100% Crypto. <br />Cero dolores de cabeza.
                  </h2>
                  <p className="text-sk-text-3 text-lg leading-relaxed">
                    CoinPoker utiliza USDT (Tether) como moneda base, por lo que juegas con dólares estables, sin volatilidad. Depositar y retirar es más rápido que cualquier banco tradicional.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-sk-bg-2 border border-sk-border-2 flex items-center justify-center shrink-0 font-black text-white">1</div>
                    <div>
                      <h4 className="text-lg font-bold text-white mb-1">Crea tu cuenta gratis</h4>
                      <p className="text-sk-sm text-sk-text-3">Descarga la app en PC o móvil usando <a href={AFFILIATE_LINK} target="_blank" rel="noopener noreferrer" className="text-sk-accent hover:underline">nuestro enlace</a>. No requiere verificaciones complejas (No KYC).</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-sk-bg-2 border border-sk-border-2 flex items-center justify-center shrink-0 font-black text-white">2</div>
                    <div>
                      <h4 className="text-lg font-bold text-white mb-1">Obtén tus USDT (Tether)</h4>
                      <p className="text-sk-sm text-sk-text-3">Compra USDT fácilmente en Binance u otro exchange local usando tu moneda (Pesos o Dólares) vía P2P o tarjeta de crédito.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-sk-bg-2 border border-sk-border-2 flex items-center justify-center shrink-0 font-black text-white">3</div>
                    <div>
                      <h4 className="text-lg font-bold text-white mb-1">Transfiere por la red Polygon</h4>
                      <p className="text-sk-sm text-sk-text-3">Ve al Cajero de CoinPoker, copia tu dirección de depósito y envía los USDT desde tu exchange. <b>TIP PRO: Usa la red Polygon (MATIC)</b>, las comisiones de transferencia son de apenas centavos.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 pb-2">
                  <a href="/tutorial-coinpoker">
                    <Button variant="secondary" className="w-full sm:w-auto border-sk-border-2 hover:border-sk-accent hover:text-sk-accent bg-sk-bg-2">
                      <PlayCircle size={18} className="mr-2" /> Ver guía paso a paso con imágenes
                    </Button>
                  </a>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center gap-3 text-sk-sm text-sk-text-2 bg-sk-bg-2 py-3 px-4 rounded-lg border border-sk-border-2">
                    <ShieldCheck size={20} className="text-emerald-500" />
                    RNG Descentralizado Verificable
                  </div>
                  <div className="flex items-center gap-3 text-sk-sm text-sk-text-2 bg-sk-bg-2 py-3 px-4 rounded-lg border border-sk-border-2">
                    <Wallet size={20} className="text-sk-accent" />
                    Retiros instantáneos a tu Wallet
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== 
            BOTTOM CTA (Último impulso)
        ============================================================== */}
        <section className="py-24 relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-red-900/20" />
          <div className="container mx-auto px-4 relative z-10">
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-6">
              Las mesas más rentables te esperan
            </h2>
            <p className="text-xl text-sk-text-3 mb-10 max-w-2xl mx-auto">
              Únete a la evolución del poker online y reclama hoy tu bono de bienvenida de $2.000.
            </p>
            <a href={AFFILIATE_LINK} target="_blank" rel="noopener noreferrer">
              <Button variant="accent" size="lg" className="bg-red-600 hover:bg-red-500 text-white border-none shadow-[0_0_30px_rgba(220,38,38,0.4)] h-16 px-10 text-xl">
                Empezar a Jugar Ahora
              </Button>
            </a>
          </div>
        </section>

      </div>
    </PageShell>
  );
}