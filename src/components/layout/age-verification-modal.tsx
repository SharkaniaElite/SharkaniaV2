// src/components/layout/age-verification-modal.tsx
import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";

export function AgeVerificationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const verified = localStorage.getItem("sharkania_age_verified");
    if (!verified) {
      setIsOpen(true);
      // Bloquear el scroll del body
      document.body.style.overflow = "hidden";
    }
  }, []);

  const handleVerify = () => {
    localStorage.setItem("sharkania_age_verified", "true");
    setIsOpen(false);
    document.body.style.overflow = "auto";
  };

  const handleReject = () => {
    // Redirigir a un sitio seguro si no son mayores de edad
    window.location.href = "https://www.google.com";
  };

  if (!isClient || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-sk-bg-0/90 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-sk-bg-1 border border-sk-border-2 rounded-xl shadow-2xl p-6 overflow-hidden">
        {/* Decorative subtle top border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sk-bg-1 via-sk-accent to-sk-bg-1 opacity-50"></div>
        
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 bg-sk-bg-2 rounded-full flex items-center justify-center border border-sk-border-2">
            <AlertTriangle className="text-sk-accent w-6 h-6" />
          </div>
          
          <h2 className="text-xl font-bold text-sk-text-1">Verificación de Edad</h2>
          
          <div className="space-y-3 text-sk-sm text-sk-text-2">
            <p>
              Sharkania es una plataforma de analítica y ranking competitivo para jugadores de póker. 
            </p>
            <p>
              Debes tener al menos <span className="font-mono text-sk-text-1 font-bold">18 años</span> (o la mayoría de edad legal en tu jurisdicción) para acceder a este sitio.
            </p>
          </div>

          <div className="w-full pt-4 space-y-2">
            <Button 
              variant="accent" 
              className="w-full text-sk-sm font-semibold"
              onClick={handleVerify}
            >
              Sí, tengo 18 años o más
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-sk-sm text-sk-text-3 hover:text-sk-text-1"
              onClick={handleReject}
            >
              No, soy menor de edad
            </Button>
          </div>
          
          <p className="text-[10px] text-sk-text-4 mt-4 text-center max-w-xs">
            Al hacer clic en "Sí", aceptas nuestros <a href="/terms" className="underline hover:text-sk-text-2">Términos y Condiciones</a> y confirmas que el póker online es legal en tu ubicación.
          </p>
        </div>
      </div>
    </div>
  );
}