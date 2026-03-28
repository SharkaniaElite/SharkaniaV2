import { useEffect } from "react";
import { PageShell } from "../components/layout/page-shell";
import { Button } from "../components/ui/button";
import { SEOHead } from "../components/seo/seo-head";
import { CreditCard, Zap, ShieldCheck, Trophy, ShieldAlert } from "lucide-react"; // 👈 Añadido ShieldAlert
import { useAuthStore } from "../stores/auth-store";

const PACKS = [
  {
    id: "ff26b792-4aa2-4c6b-b4b9-b73e6c2325ba",
    name: "Starter Pack",
    credits: 500,
    price: "4.99",
    url: "https://sharkania.lemonsqueezy.com/checkout/buy/ff26b792-4aa2-4c6b-b4b9-b73e6c2325ba?embed=1",
    accent: "default",
    description: "Ideal para probar herramientas"
  },
  {
    id: "f692615b-8677-4fd9-8561-3e384d8d4050",
    name: "Pro Pack",
    credits: 1200,
    price: "9.99",
    url: "https://sharkania.lemonsqueezy.com/checkout/buy/f692615b-8677-4fd9-8561-3e384d8d4050?embed=1",
    accent: "accent",
    recommended: true,
    description: "El mejor valor por tu dinero"
  },
  {
    id: "b6a55e86-0d7d-4a75-8dce-494f95aa1639",
    name: "Elite Pack",
    credits: 3500,
    price: "24.99",
    url: "https://sharkania.lemonsqueezy.com/checkout/buy/b6a55e86-0d7d-4a75-8dce-494f95aa1639?embed=1",
    accent: "gold",
    description: "Para jugadores avanzados"
  }
];

export function WalletPage() {
  const { user } = useAuthStore();
  
  useEffect(() => {
    // Cargar el script de Lemon Squeezy para el modal embed
    const script = document.createElement("script");
    script.src = "https://app.lemonsqueezy.com/js/lemon.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // 🚧 Manejador para la fase Beta
  const handleDemoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    alert("🚧 ¡Hola Tiburón! La pasarela de pagos oficial está en proceso de verificación. La recarga de SharkCoins estará disponible muy pronto.");
  };

  return (
    <PageShell>
      <SEOHead title="Billetera de Shark Coins" noIndex={true} />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-[1000px] mx-auto">
          
          {/* 🚨 BANNER FASE BETA 🚨 */}
          <div className="mb-10 bg-sk-accent-dim border border-sk-accent/30 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left shadow-[0_0_15px_rgba(0,255,204,0.1)]">
            <ShieldAlert className="text-sk-accent shrink-0" size={24} />
            <div>
              <p className="text-sk-sm text-sk-text-1 font-bold">Fase Beta: Cajero en Construcción</p>
              <p className="text-[12px] text-sk-text-2 mt-0.5">La compra de SharkCoins con dinero real está desactivada temporalmente hasta el lanzamiento oficial.</p>
            </div>
          </div>

          <div className="text-center mb-12">
            <h1 className="text-sk-3xl font-extrabold text-sk-text-1 mb-3">Recargar Shark Coins</h1>
            <p className="text-sk-text-2 max-w-lg mx-auto">
              Utiliza tus monedas para desbloquear análisis premium, tickets de torneos y personalización exclusiva.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {PACKS.map((pack) => (
              <div 
                key={pack.id}
                className={`relative flex flex-col bg-sk-bg-2 border-2 rounded-xl p-6 transition-all hover:translate-y-[-4px] ${
                  pack.recommended ? "border-sk-accent bg-sk-bg-3" : "border-sk-border-2"
                }`}
              >
                {pack.recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sk-accent text-sk-bg-0 text-[10px] font-bold uppercase px-3 py-1 rounded-full">
                    Más Popular
                  </span>
                )}
                
                <div className="mb-4">
                  <h3 className="text-sk-lg font-bold text-sk-text-1">{pack.name}</h3>
                  <p className="text-sk-xs text-sk-text-3">{pack.description}</p>
                </div>

                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-sk-3xl font-extrabold text-sk-text-1">
                    {pack.credits.toLocaleString()}
                  </span>
                  <span className="text-sk-sm font-mono text-sk-accent">Coins</span>
                </div>

                <div className="mt-auto">
                  <div className="text-sk-sm text-sk-text-2 mb-4">
                    Pago único de <span className="text-sk-text-1 font-bold">${pack.price} USD</span>
                  </div>
                  
                  {/* AQUÍ ESTÁ EL CAMBIO CLAVE 👇 */}
                  {/* <a 
                    href={`${pack.url}&checkout[custom][user_id]=${user?.id}&checkout[custom][pack_credits]=${pack.credits}`} 
                    className="lemonsqueezy-button"
                  > */}
                  <div onClick={handleDemoClick}>
                    <Button 
                      variant={pack.recommended ? "accent" : "ghost"} 
                      className="w-full justify-center gap-2 border border-sk-border-2 hover:border-sk-accent transition-colors"
                    >
                      <Zap size={16} /> Comprar Ahora
                    </Button>
                  </div>
                  {/* </a> */}
                </div>
              </div>
            ))}
          </div>

          {/* Trust section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 border-t border-sk-border-2 pt-12 text-center">
            <div className="flex flex-col items-center">
              <ShieldCheck className="text-sk-green mb-3" size={32} />
              <h4 className="text-sk-sm font-bold text-sk-text-1 mb-1">Pago Seguro</h4>
              <p className="text-sk-xs text-sk-text-2">Procesado por Lemon Squeezy con cifrado SSL</p>
            </div>
            <div className="flex flex-col items-center">
              <CreditCard className="text-sk-accent mb-3" size={32} />
              <h4 className="text-sk-sm font-bold text-sk-text-1 mb-1">Múltiples Métodos</h4>
              <p className="text-sk-xs text-sk-text-2">Aceptamos Tarjetas, Apple Pay y Google Pay</p>
            </div>
            <div className="flex flex-col items-center">
              <Trophy className="text-sk-gold mb-3" size={32} />
              <h4 className="text-sk-sm font-bold text-sk-text-1 mb-1">Acreditación Instantánea</h4>
              <p className="text-sk-xs text-sk-text-2">Tus monedas se sumarán a tu cuenta al finalizar</p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}