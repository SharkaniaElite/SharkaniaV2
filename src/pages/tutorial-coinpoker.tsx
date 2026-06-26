// src/pages/tutorial-coinpoker.tsx
import { useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { 
  ArrowRight, Wallet, ExternalLink, CreditCard, ShieldAlert, CheckCircle2, X
} from "lucide-react";

// Enlace de Afiliado Centralizado
const AFFILIATE_LINK = "https://record.coinpokeraffiliates.com/_ZnRTLL6Lwv7UOsjNOfgKeWNd7ZgqdRLk/1/";

export function TutorialCoinPokerPage() {
  // Estado para controlar la imagen maximizada
  const [maximizedImage, setMaximizedImage] = useState<string | null>(null);

  // Clases comunes para todas las imágenes para que sean clickeables
  const imageClasses = "w-full rounded-lg border border-sk-border-2 mb-4 cursor-zoom-in hover:opacity-80 transition-opacity duration-200";

  return (
    <PageShell>
      <SEOHead 
        title="Cómo Depositar en CoinPoker | Tutorial Paso a Paso" 
        description="Aprende a registrarte, reclamar tu bono de $2.000 y depositar USDT en CoinPoker desde Binance u otros métodos." 
      />
      <div className="bg-sk-bg-0 text-sk-text-1 pb-20 relative">
        
        {/* HEADER */}
        <div className="bg-sk-bg-1 border-b border-sk-border-2 pt-24 pb-12">
          <div className="container mx-auto px-4 text-center max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sk-accent/10 border border-sk-accent/30 text-sk-accent text-xs font-mono font-bold tracking-wider mb-4">
              <Wallet size={14} />
              GUÍA DE DEPÓSITO
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              Cómo jugar en CoinPoker
            </h1>
            <p className="text-lg text-sk-text-3">
              Sigue estos sencillos pasos para crear tu cuenta, reclamar tu bono del 150% y fondear tu billetera usando USDT o tarjetas bancarias.
            </p>
            <div className="mt-6">
              <a href={AFFILIATE_LINK} target="_blank" rel="noopener noreferrer">
                <Button variant="accent" size="lg" className="bg-red-600 hover:bg-red-500 text-white border-none shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                  Abrir cuenta en CoinPoker <ExternalLink size={18} className="ml-2" />
                </Button>
              </a>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 mt-12 max-w-4xl space-y-16">
          
          {/* FASE 1: REGISTRO */}
          <section>
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <span className="bg-sk-bg-2 border border-sk-border-2 w-10 h-10 flex items-center justify-center rounded-full text-sk-accent">1</span>
              Registro y Verificación
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/tutorial/Step1-emailypass.jpeg" 
                  alt="Ingresar email y contraseña" 
                  className={imageClasses} 
                  onClick={() => setMaximizedImage("/tutorial/Step1-emailypass.jpeg")}
                />
                <h3 className="font-bold text-white mb-2">1. Ingresa tus datos</h3>
                <p className="text-sm text-sk-text-3">Introduce tu correo electrónico y crea una contraseña segura. Asegúrate de haber usado nuestro enlace para acceder a los beneficios.</p>
              </div>
              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/tutorial/Step2-alemailnumero.jpeg" 
                  alt="Verificación OTP" 
                  className={imageClasses}
                  onClick={() => setMaximizedImage("/tutorial/Step2-alemailnumero.jpeg")}
                />
                <h3 className="font-bold text-white mb-2">2. Verifica tu correo</h3>
                <p className="text-sm text-sk-text-3">CoinPoker te enviará un código (OTP) de 6 dígitos a tu correo. Ingrésalo para verificar y activar tu cuenta.</p>
              </div>
            </div>
          </section>

          {/* FASE 2: PREPARAR EL DEPÓSITO Y BONO */}
          <section>
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <span className="bg-sk-bg-2 border border-sk-border-2 w-10 h-10 flex items-center justify-center rounded-full text-sk-accent">2</span>
              Configurar Depósito y Bono
            </h2>
            
            <div className="bg-sk-bg-2 border border-sk-border-2 p-4 rounded-xl mb-8 flex items-start gap-4">
              <CreditCard size={24} className="text-sk-accent shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-white mb-1">Múltiples métodos de pago</h4>
                <p className="text-sm text-sk-text-3">Aunque este tutorial se enfoca en USDT (Cripto), notarás que CoinPoker también acepta depósitos mediante <b>Tarjetas Bancarias (Visa/Mastercard)</b> y la billetera electrónica <b>Luxon Pay</b>. ¡Elige el que más te acomode!</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/tutorial/Step3-lobbypincharbilletera.jpeg" 
                  alt="Lobby CoinPoker" 
                  className={imageClasses}
                  onClick={() => setMaximizedImage("/tutorial/Step3-lobbypincharbilletera.jpeg")}
                />
                <h3 className="font-bold text-white text-sm mb-1">1. Ve a tu Cartera</h3>
                <p className="text-xs text-sk-text-3">En el lobby principal, haz clic en el ícono rojo de la billetera arriba a la derecha.</p>
              </div>
              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/tutorial/Step4-clickendepositar.jpeg" 
                  alt="Botón Depositar" 
                  className={imageClasses}
                  onClick={() => setMaximizedImage("/tutorial/Step4-clickendepositar.jpeg")}
                />
                <h3 className="font-bold text-white text-sm mb-1">2. Iniciar Depósito</h3>
                <p className="text-xs text-sk-text-3">Haz clic en el botón rojo que dice "DEPÓSITO" en tu saldo total.</p>
              </div>
              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/tutorial/Step5-SelectMetodoDeposito.jpeg" 
                  alt="Seleccionar Método" 
                  className={imageClasses}
                  onClick={() => setMaximizedImage("/tutorial/Step5-SelectMetodoDeposito.jpeg")}
                />
                <h3 className="font-bold text-white text-sm mb-1">3. Selecciona USDT y Red</h3>
                <p className="text-xs text-sk-text-3">Asegúrate de marcar "Cripto". En Token elige <b>USDT</b> y en Chain (Red) elige <b>Ethereum</b>.</p>
              </div>
              
              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/tutorial/Step6-SeleccionarBono.jpeg" 
                  alt="Seleccionar Bono" 
                  className={imageClasses}
                  onClick={() => setMaximizedImage("/tutorial/Step6-SeleccionarBono.jpeg")}
                />
                <h3 className="font-bold text-white text-sm mb-1">4. ¡No olvides el Bono!</h3>
                <p className="text-xs text-sk-text-3">Abre el menú desplegable y selecciona <b>"Poker Welcome Bonus: 150% up to $2000"</b> antes de continuar.</p>
              </div>
              
              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/tutorial/Step7-CopiarDireccion.jpeg" 
                  alt="Copiar Dirección" 
                  className={imageClasses}
                  onClick={() => setMaximizedImage("/tutorial/Step7-CopiarDireccion.jpeg")}
                />
                <h3 className="font-bold text-white text-sm mb-1">5. Copia tu Dirección</h3>
                <p className="text-xs text-sk-text-3">Aparecerá una dirección alfanumérica. Haz clic en el ícono de los cuadrados para <b>copiarla</b>. Es la dirección que pegarás en el retiro desde binance.</p>
              </div>
            </div>
          </section>

          {/* FASE 3: ENVIAR DESDE BINANCE */}
          <section>
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <span className="bg-sk-bg-2 border border-sk-border-2 w-10 h-10 flex items-center justify-center rounded-full text-sk-accent">3</span>
              Enviar desde Binance
            </h2>
            
            {/* BANNER REFERIDO BINANCE */}
            <div className="bg-[#FCD535]/10 border border-[#FCD535]/30 p-5 rounded-xl mb-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_5px_30px_rgba(252,213,53,0.05)]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#FCD535] flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(252,213,53,0.4)]">
                  <span className="text-black font-black text-3xl leading-none -mt-1">B</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white mb-1">¿Aún no tienes USDT o cuenta en Binance?</h4>
                  <p className="text-sm text-sk-text-3">
                    Regístrate gratis, compra USDT vía P2P o con Tarjeta de Crédito de forma segura y obtén bonos USDC de recompensa.
                  </p>
                </div>
              </div>
              <a href="https://www.binance.com/referral/earn-together/refer2earn-usdc/claim?hl=es&ref=GRO_28502_9W9FH&utm_source=referral_entrance&utm_medium=web_share_copy" target="_blank" rel="noopener noreferrer" className="w-full md:w-auto shrink-0">
                <Button variant="secondary" className="w-full md:w-auto bg-[#FCD535] hover:bg-[#F0B90B] text-black border-none font-bold shadow-lg h-12">
                  Crear cuenta en Binance <ExternalLink size={18} className="ml-2" />
                </Button>
              </a>
            </div>

            <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl mb-8 flex items-start gap-4">
              <ShieldAlert size={24} className="text-red-400 shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-red-400 mb-1">Atención con la RED (Network)</h4>
                <p className="text-sm text-sk-text-3">Si elegiste USDT en la red Ethereum en CoinPoker, <b>debes asegurarte de enviar por la red ERC20 en Binance</b>. Si envías por una red distinta, perderás los fondos.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/bg/Paso17.png" 
                  alt="Binance Withdraw" 
                  className={imageClasses}
                  onClick={() => setMaximizedImage("/bg/Paso17.png")}
                />
                <h3 className="font-bold text-white mb-2">1. Ir a Retiros</h3>
                <p className="text-sm text-sk-text-3">En tu panel de Binance, busca el botón <b>'Withdraw' (Retirar)</b> junto a tu saldo general.</p>
              </div>
              
              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/bg/Paso18.png" 
                  alt="Formulario Retiro" 
                  className={imageClasses}
                  onClick={() => setMaximizedImage("/bg/Paso18.png")}
                />
                <h3 className="font-bold text-white mb-2">2. Configura el Envío</h3>
                <p className="text-sm text-sk-text-3">
                  Selecciona la moneda <b>USDT</b>.<br/>
                  En 'Address' <b>PEGA</b> la dirección que copiaste de CoinPoker.<br/>
                  En 'Network' elige ESTRICTAMENTE <b>'ETH Ethereum (ERC20)'</b>.<br/>
                  Pon el monto y dale a 'Withdraw'.
                </p>
              </div>

              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/bg/Paso19.png" 
                  alt="Resumen Transacción" 
                  className={imageClasses}
                  onClick={() => setMaximizedImage("/bg/Paso19.png")}
                />
                <h3 className="font-bold text-white mb-2">3. Confirmar Detalles</h3>
                <p className="text-sm text-sk-text-3">Aparecerá un resumen de la transacción detallando la dirección y la comisión de red. Presiona <b>'Continue'</b>.</p>
              </div>

              <div className="bg-sk-bg-1 border border-sk-border-2 rounded-xl p-4 shadow-lg">
                <img 
                  src="/bg/Paso20.png" 
                  alt="Seguridad" 
                  className={imageClasses}
                  onClick={() => setMaximizedImage("/bg/Paso20.png")}
                />
                <h3 className="font-bold text-white mb-2">4. Verificación de Seguridad</h3>
                <p className="text-sm text-sk-text-3">Binance te pedirá el código de tu Authenticator App, Email o un SMS para liberar los fondos. Ingrésalo y presiona <b>'Submit'</b>.</p>
              </div>
            </div>
          </section>

          {/* CIERRE */}
          <div className="bg-gradient-to-r from-sk-bg-2 to-sk-bg-3 border border-sk-border-2 rounded-2xl p-8 text-center mt-16 shadow-2xl">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-white mb-2">¡Todo listo para jugar!</h3>
            <p className="text-sk-text-3 mb-6 max-w-lg mx-auto">
              La transferencia cripto suele tardar entre 3 y 10 minutos dependiendo de la congestión de la red. Una vez los fondos lleguen a tu cuenta, tu Bono de Bienvenida se activará.
            </p>
            <a href={AFFILIATE_LINK} target="_blank" rel="noopener noreferrer">
              <Button variant="accent" size="lg" className="bg-red-600 hover:bg-red-500 text-white border-none">
                Ir a CoinPoker <ArrowRight size={18} className="ml-2" />
              </Button>
            </a>
          </div>

        </div>

        {/* LIGHTBOX / MODAL PARA IMÁGENES MAXIMIZADAS */}
        {maximizedImage && (
          <div 
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setMaximizedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 text-white hover:text-sk-accent bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors z-50"
              onClick={() => setMaximizedImage(null)}
            >
              <X size={32} />
            </button>
            
            <img 
              src={maximizedImage} 
              alt="Vista Maximizada" 
              className="max-w-full max-h-[90vh] object-contain rounded-xl border border-sk-border-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        )}

      </div>
    </PageShell>
  );
}