// src/pages/tutorial-ignition.tsx
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, Gamepad2, Gift, MousePointerClick, Download, CheckCircle2, Wallet } from "lucide-react";
import { Button } from "../components/ui/button";

export function TutorialIgnitionPage() {
  const steps = [
    {
      id: 1,
      title: "Reclama tu Bono de Bienvenida",
      description: "Al ingresar desde nuestro enlace oficial, llegarás a la pantalla del 100% Bono de Bienvenida. Simplemente presiona el botón naranja que dice JUEGA AHORA.",
      image: "/image_937461.jpg",
      icon: <Gift className="text-orange-500" size={24} />
    },
    {
      id: 2,
      title: "Llena el formulario de registro",
      description: "Aparecerá el formulario ÚNETE GRATIS. Completa todos los campos con tus datos reales (Nombre, Apellido, Fecha de nacimiento, Teléfono, etc.) y crea tu cuenta.",
      image: "/image_9373af.png",
      icon: <MousePointerClick className="text-orange-500" size={24} />
    },
    {
      id: 3,
      title: "El Cajero (Puedes omitirlo por ahora)",
      description: "Inmediatamente después te mostrará la pantalla para depositar. Si quieres depositar y aprovechar el bono hazlo, pero si solo quieres explorar, ve hasta abajo y selecciona la opción POR AHORA NO.",
      image: "/image_93691f.png",
      icon: <ArrowRight className="text-orange-500" size={24} />
    },
    {
      id: 4,
      title: "Ingresa a la sección de Póker",
      description: "Ya estás dentro del lobby principal de Ignition. En el menú superior, selecciona la opción POKER para ver todas las mesas disponibles.",
      image: "/image_936868.jpg",
      icon: <Gamepad2 className="text-orange-500" size={24} />
    },
    {
      id: 5,
      title: "Juega en el navegador o descarga la App",
      description: "Tendrás dos opciones: puedes jugar inmediatamente desde tu navegador web presionando JUEGA AHORA, o puedes descargar el software oficial (PC, MAC o Móvil) haciendo clic en DESCARGAR AHORA.",
      image: "/image_93646a.jpg",
      icon: <Download className="text-orange-500" size={24} />
    }
  ];

  return (
    <PageShell>
      <SEOHead 
        title="Tutorial: Cómo crear cuenta en Ignition Poker" 
        description="Sigue este paso a paso para crear tu cuenta en Ignition Poker y unirte a la liga de Sharkania." 
      />
      
      <div className="pt-20 pb-16 min-h-screen bg-sk-bg-1">
        
        {/* HERO SECTION */}
        <div className="bg-gradient-to-b from-[#1a0f0a] to-sk-bg-1 border-b border-orange-500/10 pt-16 pb-12">
          <div className="max-w-[800px] mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-4 py-1.5 rounded-full text-orange-400 font-mono text-xs uppercase tracking-widest font-bold mb-6">
              <CheckCircle2 size={14} />
              Guía Oficial
            </div>
            <h1 className="text-sk-4xl sm:text-5xl font-black text-white tracking-tight mb-6 leading-tight">
              Cómo crear tu cuenta en <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">Ignition Poker</span>
            </h1>
            <p className="text-sk-lg text-sk-text-2 mb-8 max-w-2xl mx-auto">
              Sigue estos 5 sencillos pasos para registrarte correctamente, reclamar tu bono de bienvenida y empezar a jugar en nuestras ligas exclusivas.
            </p>
            
            <a 
              href="https://record.revenuenetwork.com/_s_OAdmC6KUepsRaI0hkgHmNd7ZgqdRLk/1/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold text-lg px-8 py-4 rounded-md shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all hover:scale-105"
            >
              Comenzar Enlace Oficial de Registro <ExternalLink size={20} />
            </a>
          </div>
        </div>

        {/* STEPS SECTION */}
        <div className="max-w-[800px] mx-auto px-6 mt-12 space-y-16">
          {steps.map((step, index) => (
            <div key={step.id} className="relative">
              {/* Línea conectora (excepto en el último) */}
              {index !== steps.length - 1 && (
                <div className="absolute left-6 top-16 bottom-[-4rem] w-0.5 bg-gradient-to-b from-orange-500/30 to-transparent md:left-8 z-0 hidden md:block" />
              )}
              
              <div className="relative z-10 flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                {/* Indicador de número */}
                <div className="shrink-0 w-12 h-12 md:w-16 md:h-16 rounded-full bg-sk-bg-2 border-2 border-orange-500/30 flex items-center justify-center shadow-lg mx-auto md:mx-0">
                  <span className="text-xl md:text-2xl font-black text-orange-500">{step.id}</span>
                </div>
                
                {/* Contenido del paso */}
                <div className="flex-1 bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-6 md:p-8 shadow-xl">
                  <div className="flex items-center gap-3 mb-4">
                    {step.icon}
                    <h3 className="text-xl md:text-2xl font-bold text-sk-text-1">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-sk-text-2 mb-6 text-base md:text-lg leading-relaxed">
                    {step.description}
                  </p>
                  
                  {/* 🔥 Botón insertado solo en el paso 3 */}
                  {step.id === 3 && (
                    <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <Link to="/tutorial-ignition-deposit">
                        <Button className="w-full sm:w-auto bg-gradient-to-r from-orange-600 to-red-700 hover:from-orange-500 hover:to-red-600 text-white font-bold shadow-lg shadow-orange-900/20">
                          <Wallet size={18} className="mr-2" /> Ir al tutorial de cómo depositar
                        </Button>
                      </Link>
                    </div>
                  )}
                  
                  {/* Imagen del paso */}
                  <div className="rounded-xl overflow-hidden border border-sk-border-2 shadow-inner bg-black/50">
                    <img 
                      src={step.image} 
                      alt={`Paso ${step.id}: ${step.title}`} 
                      className="w-full h-auto object-contain max-h-[400px]"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* BOTTOM CTA */}
        <div className="max-w-[800px] mx-auto px-6 mt-20">
          <div className="bg-gradient-to-r from-orange-900/40 to-sk-bg-2 border border-orange-500/30 rounded-2xl p-8 md:p-12 text-center shadow-2xl">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
              ¿Ya creaste tu cuenta en Ignition?
            </h2>
            <p className="text-sk-text-2 mb-8 max-w-lg mx-auto text-lg">
              El último paso indispensable es vincular tu nuevo usuario en nuestro sistema para poder enviarte las contraseñas de los torneos gratuitos.
            </p>
            <Link to="/ignition">
              <Button size="lg" variant="accent" className="bg-orange-500 hover:bg-orange-400 text-white border-none shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                Vincular cuenta en Sharkania
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </PageShell>
  );
}