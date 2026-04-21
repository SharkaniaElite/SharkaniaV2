import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { Download, Copy, CheckCircle2, ChevronRight, AlertCircle, MessageCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";

// ── DATOS DEL CLUB ──
const CLUB_DATA = {
  link: "https://clubgg.app.link/SY10IKXkw2b",
  refId: "9424-8605",
  clubId: "507587",
};

export function TutorialClubGGPage() {
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedClub, setCopiedClub] = useState(false);

  const copyToClipboard = (text: string, type: "ref" | "club") => {
    navigator.clipboard.writeText(text);
    if (type === "ref") {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    } else {
      setCopiedClub(true);
      setTimeout(() => setCopiedClub(false), 2000);
    }
  };

  const steps = [
    {
      title: "Recibe la Invitación",
      desc: "Ingresa al enlace oficial de descarga para unirte a Club LatinAllinPoker. Si te registras desde PC, ten a mano nuestro ID de recomendación.",
      img: "/tutorial/1.jpeg",
    },
    {
      title: "Instala ClubGG",
      desc: "Serás redirigido a la tienda de aplicaciones de tu dispositivo (Google Play o App Store). Presiona 'Instalar'.",
      img: "/tutorial/2.jpeg",
    },
    {
      title: "Abre la Aplicación",
      desc: "Una vez instalada, busca el ícono de ClubGG en tu pantalla de inicio y ábrelo.",
      img: "/tutorial/3.jpeg",
    },
    {
      title: "Inicia tu Registro",
      desc: "En la pantalla de bienvenida, selecciona el botón verde que dice 'Unirse'.",
      img: "/tutorial/4.jpeg",
    },
    {
      title: "Crea tu GGPass",
      desc: "Ingresa tu dirección de correo electrónico principal. Asegúrate de tener acceso a él.",
      img: "/tutorial/5.jpeg",
    },
    {
      title: "Verifica tu Correo",
      desc: "ClubGG te pedirá un código de 4 dígitos. Abre tu aplicación de correo electrónico para buscarlo.",
      img: "/tutorial/6.jpeg",
    },
    {
      title: "Copia el Código",
      desc: "Revisa tu bandeja de entrada (o Spam). Copia el código de verificación que te enviaron.",
      img: "/tutorial/7.jpeg",
    },
    {
      title: "Configura el Acceso Rápido",
      desc: "El sistema te ofrecerá opciones biométricas. Puedes elegir 'Usar contraseña' o darle a 'Siguiente' para usar rostro/huella.",
      img: "/tutorial/8.jpeg",
    },
    {
      title: "Establece tu Contraseña",
      desc: "Crea una contraseña segura (entre 8 y 20 caracteres, incluyendo al menos un número).",
      img: "/tutorial/9.jpeg",
    },
    {
      title: "Crea tu Perfil",
      desc: "Selecciona tu país de origen y elige el Nickname con el que jugarás en las mesas.",
      img: "/tutorial/10.jpeg",
    },
    { 
      title: "Encuesta Inicial (Opcional)", 
      desc: "La app te preguntará cómo te enteraste de ellos. Puedes elegir una opción y Confirmar, o simplemente tocar 'Saltar'.", 
      img: "/tutorial/11.jpeg" 
    },
    { 
      title: "Acepta los Términos", 
      desc: "Marca la casilla verde para aceptar los Términos del Servicio y la Política de Privacidad, luego presiona 'Confirmar'.", 
      img: "/tutorial/12.jpeg" 
    },
    { 
      title: "Cierra las Promociones", 
      desc: "Es posible que aparezca un anuncio global (como torneos WSOP). Ciérralo tocando fuera del recuadro o en la 'X' para ir al menú principal.", 
      img: "/tutorial/13.jpeg" 
    },
    { 
      title: "Buscador de Clubes", 
      desc: "En la pantalla principal, ignora el botón central y toca la barra superior que dice 'Buscar Club' (junto al ícono de la lupa).", 
      img: "/tutorial/14.jpeg" 
    },
    { 
      title: "Ingresa los IDs Oficiales", 
      desc: "Escribe nuestro ID del club (507587) en la primera casilla y el ID de recomendación (9424-8605) en la segunda. Presiona 'Buscar'.", 
      img: "/tutorial/15.jpeg" 
    },
    { 
      title: "Envía tu Solicitud", 
      desc: "Verás el escudo dorado de LatinAllinPoker. Puedes escribir un breve saludo en la información de verificación y darle al botón verde 'Unirse'. ¡Listo!", 
      img: "/tutorial/16.jpeg" 
    },
  ];

  return (
    <PageShell>
      <SEOHead
        title="Cómo jugar en Club LatinAllinPoker (ClubGG) | Tutorial"
        description="Guía paso a paso para descargar ClubGG, crear tu cuenta y unirte al Club LatinAllinPoker usando nuestro ID oficial."
        path="/como-jugar-en-clubgg"
      />
      
      <div className="pt-20 pb-16">
        <div className="max-w-[800px] mx-auto px-6">
          
          {/* ══ HERO SECTION ══ */}
          <div className="bg-sk-bg-2 border border-sk-accent/20 rounded-2xl p-6 md:p-10 mb-12 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group shadow-[0_0_40px_rgba(34,211,238,0.05)]">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-sk-accent/30 to-transparent" />

            <div className="shrink-0 relative z-10">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-sk-accent/10 blur-xl rounded-full scale-150 group-hover:bg-sk-accent/20 transition-colors duration-500" />
                <img
                  src="/mascot/shark-1.webp" 
                  alt="Sharkania Guide"
                  className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left relative z-10">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
                <span className="inline-block py-1 px-3 rounded-md bg-sk-accent-dim text-sk-accent font-mono text-[10px] font-bold uppercase tracking-widest border border-sk-accent/20">
                  TUTORIAL OFICIAL
                </span>
              </div>

              <h1 className="text-sk-3xl md:text-sk-4xl font-black tracking-tighter text-sk-text-1 mb-4 leading-tight">
                Cómo unirse a <br className="hidden md:block" />
                {/* El pr-2 evita que se corte la última letra */}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sk-accent to-blue-400 pr-2">
                  LatinAllinPoker
                </span>
              </h1>

              <p className="text-sk-sm md:text-sk-base text-sk-text-2 leading-relaxed">
                Sigue esta guía paso a paso para descargar la app en ClubGG, configurar tu cuenta correctamente y acceder a nuestras mesas privadas en minutos.
              </p>
            </div>
          </div>

          {/* ══ CAJA DE DATOS CLAVE (ATAJO) ══ */}
          <div className="bg-sk-bg-2 border border-sk-accent/30 rounded-2xl p-6 md:p-8 mb-16 shadow-[0_0_30px_rgba(34,211,238,0.05)]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 border-b border-sk-border-2 pb-4">
              <h3 className="text-sk-md font-bold text-sk-text-1 flex items-center gap-2">
                <AlertCircle size={20} className="text-sk-accent" />
                Datos de Acceso Directo
              </h3>
              {/* Aquí aparecerá el logo de Latin All In Poker */}
              <img src="/logos/latin-logo.png" alt="Latin All in Poker" className="h-12 object-contain drop-shadow-[0_2px_10px_rgba(34,211,238,0.2)]" />
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-mono text-sk-text-3 uppercase tracking-wide mb-1">ID del Club</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xl font-black text-sk-text-1 bg-sk-bg-0 px-3 py-1.5 rounded-md border border-sk-border-2 flex-1">
                      {CLUB_DATA.clubId}
                    </code>
                    <Button variant="secondary" size="sm" onClick={() => copyToClipboard(CLUB_DATA.clubId, "club")} className="h-[42px] px-4">
                      {copiedClub ? <CheckCircle2 size={16} className="text-sk-green" /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-mono text-sk-text-3 uppercase tracking-wide mb-1">ID de Recomendación</p>
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-bold text-sk-text-1 bg-sk-bg-0 px-3 py-1.5 rounded-md border border-sk-border-2 flex-1">
                      {CLUB_DATA.refId}
                    </code>
                    <Button variant="secondary" size="sm" onClick={() => copyToClipboard(CLUB_DATA.refId, "ref")} className="h-[40px] px-4">
                      {copiedRef ? <CheckCircle2 size={16} className="text-sk-green" /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <a href={CLUB_DATA.link} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <Button variant="accent" size="lg" className="w-full h-16 text-sk-sm font-extrabold shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]">
                    <Download size={20} className="mr-2" />
                    Descargar ClubGG
                  </Button>
                </a>
                <p className="text-[10px] text-sk-text-4 text-center mt-3">Enlace oficial y seguro. Disponible para iOS y Android.</p>
              </div>
            </div>
          </div>

          {/* ══ TIMELINE DE PASOS ══ */}
          <div className="relative">
            {/* Línea vertical de fondo */}
            <div className="absolute left-[23px] md:left-1/2 top-4 bottom-4 w-0.5 bg-sk-border-2 md:-translate-x-1/2" />

            <div className="space-y-12">
              {steps.map((step, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <div key={idx} className={cn("relative flex items-center md:justify-between w-full", isEven ? "md:flex-row" : "md:flex-row-reverse")}>
                    
                    {/* Número central */}
                    <div className="absolute left-0 md:left-1/2 w-12 h-12 rounded-full bg-sk-bg-2 border-2 border-sk-accent flex items-center justify-center font-mono font-black text-sk-lg text-sk-accent z-10 md:-translate-x-1/2 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                      {idx + 1}
                    </div>

                    {/* Contenido (Texto) */}
                    <div className={cn("w-full pl-16 md:pl-0 md:w-[45%]", isEven ? "md:text-right md:pr-8" : "md:text-left md:pl-8")}>
                      <h4 className="text-sk-lg font-bold text-sk-text-1 mb-2">{step.title}</h4>
                      <p className="text-sk-sm text-sk-text-3 leading-relaxed mb-4">{step.desc}</p>
                      
                      {/* Imagen Móvil (Visible solo en pantallas pequeñas) */}
                      <div className="md:hidden mt-4 rounded-xl overflow-hidden border border-sk-border-2 bg-sk-bg-0 shadow-md">
                        <img src={step.img} alt={`Paso ${idx + 1}`} className="w-full h-auto object-contain max-h-[400px]" />
                      </div>
                    </div>

                    {/* Contenido (Imagen Desktop) */}
                    <div className={cn("hidden md:block w-[45%]", isEven ? "pl-8" : "pr-8")}>
                      <div className="rounded-xl overflow-hidden border border-sk-border-2 bg-sk-bg-0 shadow-lg hover:border-sk-accent/50 transition-colors">
                        <img src={step.img} alt={`Paso ${idx + 1}`} className="w-full h-auto object-contain max-h-[500px]" />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* ══ MENSAJE DEL TIBURÓN: BENEFICIOS Y WHATSAPP ══ */}
          <div className="mt-20 bg-sk-bg-2 border border-sk-accent/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 shadow-[0_0_40px_rgba(34,211,238,0.05)] relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-sk-accent/10 blur-[50px] rounded-full pointer-events-none" />
            
            <div className="shrink-0 relative z-10">
              <img src="/mascot/shark-5.webp" alt="Beneficios Sharkania" className="w-40 h-40 md:w-56 md:h-56 object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] hover:scale-105 transition-transform duration-500" />
            </div>

            <div className="flex-1 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sk-gold/10 border border-sk-gold/20 rounded-md text-[10px] font-mono font-bold text-sk-gold uppercase tracking-widest mb-3">
                <Sparkles size={12} /> Zona VIP
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-sk-text-1 mb-4 leading-tight">
                Activa tus Beneficios de Alianza
              </h3>
              
              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-3 text-sk-sm text-sk-text-2">
                  <CheckCircle2 className="text-sk-green shrink-0 mt-0.5" size={18} /> 
                  <span><strong className="text-sk-text-1">Welcome Bono:</strong> 100% hasta 500k garantizado en tu primer depósito.</span>
                </li>
                <li className="flex items-start gap-3 text-sk-sm text-sk-text-2">
                  <CheckCircle2 className="text-sk-green shrink-0 mt-0.5" size={18} /> 
                  <span><strong className="text-sk-text-1">Ligas Exclusivas:</strong> Fechas especiales completamente libres de rake (Sin Rake).</span>
                </li>
                <li className="flex items-start gap-3 text-sk-sm text-sk-text-2">
                  <CheckCircle2 className="text-sk-green shrink-0 mt-0.5" size={18} /> 
                  <span><strong className="text-sk-text-1">Liquidez Inmediata:</strong> Retiros procesados en menos de 24 horas (usualmente al instante).</span>
                </li>
              </ul>

              <div className="bg-sk-bg-0 border border-sk-border-2 rounded-xl p-5 shadow-inner">
                <p className="text-sk-sm font-bold text-sk-text-1 mb-2">Paso Final: Envíame este protocolo para activar tu cuenta</p>
                <div className="text-[11px] md:text-xs text-sk-accent font-mono mb-4 bg-sk-accent/10 p-3 rounded-lg border border-sk-accent/20 inline-block font-bold">
                  Nombre y Apellido — Email — Teléfono
                </div>
                <a href="https://wa.me/56977910256?text=Hola!%20Vengo%20de%20Sharkania.%20Estos%20son%20mis%20datos%20para%20activar%20mi%20cuenta%20en%20LatinAllinPoker:%20" target="_blank" rel="noopener noreferrer" className="block sm:inline-block w-full sm:w-auto">
                  <button className="w-full sm:w-auto bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(37,211,102,0.3)] hover:shadow-[0_0_25px_rgba(37,211,102,0.5)]">
                    <MessageCircle size={20} />
                    Enviar datos al +56 9 7791 0256
                  </button>
                </a>
              </div>
            </div>
          </div>

          {/* ══ CTA FINAL ══ */}
          <div className="mt-8 bg-gradient-to-t from-sk-bg-2 to-sk-bg-3 border border-sk-border-2 rounded-2xl p-8 text-center shadow-sk-lg">
            <h3 className="text-2xl font-black text-sk-text-1 mb-3">¿Ya tienes tu cuenta configurada?</h3>
            <p className="text-sk-sm text-sk-text-3 mb-6 max-w-md mx-auto">
              No olvides vincular tu nickname de ClubGG en tu panel de Sharkania para acceder a tus estadísticas VIP.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button variant="accent" size="lg" onClick={() => window.location.href = "/dashboard"}>
                Vincular Nickname <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>

        </div>
      </div>
    </PageShell>
  );
}