import { useEffect } from "react";
import { Instagram } from "lucide-react";

export function InstagramFeed() {
  useEffect(() => {
    // Inyección limpia y segura del script de EmbedSocial en React
    const scriptId = "EmbedSocialHashtagScript";
    if (!document.getElementById(scriptId)) {
      const js = document.createElement("script");
      js.id = scriptId;
      js.src = "https://embedsocial.com/cdn/ht.js";
      js.async = true;
      document.head.appendChild(js);
    }
  }, []);

  return (
    <section className="relative py-24 bg-sk-bg-1 border-t border-sk-border-2 overflow-hidden">
      {/* Efecto de luz de fondo con los colores de Instagram */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-[#f09433]/10 via-[#dc2743]/10 to-[#bc1888]/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] shadow-[0_0_20px_rgba(220,39,67,0.3)]">
            <Instagram size={28} className="text-white" />
          </div>
          <h2 className="text-sk-3xl sm:text-sk-4xl font-black text-sk-text-1 tracking-tight mb-4 uppercase">
            Únete a la <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888]">Comunidad</span>
          </h2>
          <p className="text-sk-md text-sk-text-3 max-w-2xl mx-auto">
            Sigue nuestra actividad en tiempo real! 
          </p>
        </div>

        {/* WIDGET DE EMBEDSOCIAL (Ajustado para React) */}
        <div className="bg-sk-bg-2 border border-sk-border-2 rounded-2xl p-2 shadow-sk-lg min-h-[300px]">
          <div className="embedsocial-hashtag" data-ref="96f5f9f97f902f514e3424a72bd599c9b041c99f">
            <a 
              className="feed-powered-by-es feed-powered-by-es-feed-img es-widget-branding" 
              href="https://embedsocial.com/instagram-widget/" 
              target="_blank" 
              rel="noopener noreferrer"
              title="Instagram widget"
            >
              <img src="https://embedsocial.com/cdn/icon/embedsocial-logo.webp" alt="EmbedSocial" />
              <div className="es-widget-branding-text">Instagram widget</div>
            </a>
          </div>
        </div>

        <div className="mt-10 text-center">
          {/* Reemplaza con tu link real de Instagram si lo tienes */}
          <a 
            href="https://instagram.com/sharkania_oficial" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-black font-bold uppercase tracking-wider px-8 py-4 rounded-xl hover:scale-105 transition-transform"
          >
            <Instagram size={18} /> Seguir en Instagram
          </a>
        </div>
      </div>
    </section>
  );
}