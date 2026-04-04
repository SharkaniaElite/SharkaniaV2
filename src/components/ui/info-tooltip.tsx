// src/components/ui/info-tooltip.tsx
import { useState, useRef, useEffect } from "react";

interface InfoTooltipProps {
  content: string;
  title?: string;
  position?: "top" | "bottom" | "left" | "right";
  size?: "sm" | "md";
}

// 🧠 Motor Lógico: Asigna un tiburón (1 al 10) de forma consistente según el texto
const getSharkVariant = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (Math.abs(hash) % 10) + 1;
};

/**
 * Info tooltip con icono 3D y Mascota Pop-out (Sharky)
 * Hover en escritorio, tap en móviles.
 */
export function InfoTooltip({ content, title, position = "top", size = "md" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera (móvil)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Determinamos qué pose de Sharky mostrar usando el título o el contenido
  const sharkId = getSharkVariant(title || content);
  const sharkImage = `/mascot/shark-${sharkId}.webp`;

  const iconSize = size === "sm" ? 16 : 20;

  // Clases de posicionamiento general del contenedor
  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div ref={ref} className="relative inline-flex">
      {/* Icono de Información Original 3D (Intacto) */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="group relative focus:outline-none"
        aria-label="Más información"
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          className="transition-transform duration-200 group-hover:scale-110"
        >
          <circle cx="12" cy="13" r="10" fill="rgba(34,211,238,0.08)" />
          <circle cx="12" cy="12" r="10" fill="url(#info-grad)" stroke="rgba(34,211,238,0.3)" strokeWidth="1" />
          <path
            d="M7 7.5 C8.5 4.5, 15.5 4.5, 17 7.5"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="12" cy="8.5" r="1.2" fill="#22d3ee" />
          <rect x="11" y="11" width="2" height="5.5" rx="1" fill="#22d3ee" />
          <defs>
            <radialGradient id="info-grad" cx="0.35" cy="0.35" r="0.65">
              <stop offset="0%" stopColor="rgba(34,211,238,0.12)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0.04)" />
            </radialGradient>
          </defs>
        </svg>
      </button>

      {/* Tooltip con Sharky y Globo de Diálogo */}
      {open && (
        <div
          className={`absolute z-50 ${positionClasses[position]} flex items-end gap-1 sm:gap-2 animate-in fade-in zoom-in-95 duration-200`}
          style={{ width: "max-content", maxWidth: "340px" }}
        >
          {/* Contenedor de la Mascota: Un poco más compacto que en el blog para no romper tablas */}
          <span className="shrink-0 w-20 h-24 sm:w-24 sm:h-28 relative -mb-2 z-10 pointer-events-none">
            <img
              src={sharkImage}
              alt="Sharky Mascot"
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </span>

          {/* Globo de Diálogo (Speech Bubble) */}
          <div className="relative flex-1 bg-sk-bg-3 border border-sk-border-3 rounded-2xl rounded-bl-sm shadow-xl p-3 text-left z-0">
            {/* Picos del globo apuntando a Sharky */}
            <span className="absolute -left-[9px] bottom-[16px] w-0 h-0 border-t-[12px] border-t-transparent border-r-[10px] border-r-sk-border-3 border-b-[0px] border-b-transparent" />
            <span className="absolute -left-[7px] bottom-[17px] w-0 h-0 border-t-[10px] border-t-transparent border-r-[8px] border-r-sk-bg-3 border-b-[0px] border-b-transparent" />

            {title && (
              <p className="text-[10px] font-bold text-sk-accent mb-1 uppercase tracking-wider font-mono">
                {title}
              </p>
            )}
            <p className="text-sk-xs text-sk-text-2 leading-relaxed">{content}</p>
          </div>
        </div>
      )}
    </div>
  );
}