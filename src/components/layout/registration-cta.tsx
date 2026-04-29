// src/components/layout/registration-cta.tsx
import { MessageCircle, Info } from "lucide-react";
import { Button } from "../ui/button";

export function RegistrationCTA({ className = "" }: { className?: string }) {
  const whatsappUrl = "https://wa.me/56963333871?text=Hola%20Roberto,%20quiero%20inscribirme%20en%20la%20Liga%20Poker%20Austral.";

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-sk-accent/10 border border-sk-accent/20 rounded-lg text-[11px] text-sk-accent animate-pulse">
        <Info size={14} />
        <span className="font-bold uppercase tracking-tight">
          Contacta al administrador para formalizar tu inscripción
        </span>
      </div>
      
      <a href={whatsappUrl} target="_blank" rel="noreferrer">
        <Button variant="accent" className="w-full shadow-[0_0_20px_rgba(17,202,160,0.3)] hover:shadow-[0_0_30px_rgba(17,202,160,0.5)] transition-all flex items-center justify-center gap-2 py-6 text-sk-md font-black italic uppercase">
          <MessageCircle size={20} className="fill-sk-bg-1" />
          Inscribirme con Roberto Flández
        </Button>
      </a>
    </div>
  );
}