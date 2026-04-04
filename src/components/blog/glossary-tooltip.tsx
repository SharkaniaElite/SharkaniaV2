// src/components/blog/glossary-tooltip.tsx
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

interface GlossaryTooltipProps {
  term: string;
  slug: string;
  shortDefinition: string;
  children: React.ReactNode;
}

// 🧠 Motor Lógico: Asigna un tiburón (1 al 10) de forma consistente según la palabra
const getSharkVariant = (text: string) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (Math.abs(hash) % 10) + 1;
};

export function GlossaryTooltip({
  term,
  slug,
  shortDefinition,
  children,
}: GlossaryTooltipProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Determinamos qué pose de Sharky mostrar
  const sharkId = getSharkVariant(slug);
  const sharkImage = `/mascot/shark-${sharkId}.webp`;

  // Cerrar al hacer clic fuera (móviles)
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [open]);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(true), 200);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(false), 300);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  return (
    <span
      ref={containerRef}
      className="relative inline"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Palabra Subrayada */}
      <span
        onClick={handleClick}
        className="text-sk-accent cursor-help border-b border-dashed border-sk-accent/40 hover:border-sk-accent transition-colors"
        role="button"
        tabIndex={0}
        aria-describedby={`glossary-${slug}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
      >
        {children}
      </span>

      {/* 🦈 Tooltip popup con Sharky y Globo de Diálogo */}
      {open && (
        <span
          id={`glossary-${slug}`}
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-[360px] sm:w-[440px] pointer-events-auto flex items-end gap-1 sm:gap-2 animate-in fade-in zoom-in-95 duration-200 origin-bottom"
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {/* Contenedor de la Mascota: Mucho más grande, con margen negativo y z-index 10 */}
          <span className="shrink-0 w-28 h-32 sm:w-36 sm:h-40 relative -mb-2 z-10">
            <img
              src={sharkImage}
              alt="Sharky Mascot"
              className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]"
              // Fallback sutil por si la imagen aún no está cargada o falta alguna
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </span>

          {/* Globo de Diálogo (Speech Bubble) */}
          <span className="relative flex-1 block bg-sk-bg-3 border border-sk-border-3 rounded-2xl rounded-bl-sm shadow-sk-xl p-4 text-left z-0">
            {/* Picos del globo ajustados para apuntar más arriba (hacia el tiburón) */}
            <span className="absolute -left-[9px] bottom-[20px] w-0 h-0 border-t-[14px] border-t-transparent border-r-[10px] border-r-sk-border-3 border-b-[0px] border-b-transparent" />
            <span className="absolute -left-[7px] bottom-[21px] w-0 h-0 border-t-[12px] border-t-transparent border-r-[8px] border-r-sk-bg-3 border-b-[0px] border-b-transparent" />

            {/* Cabecera */}
            <span className="flex items-center gap-2 mb-2">
              <BookOpen size={12} className="text-sk-accent shrink-0" />
              <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-sk-accent">
                El experto dice...
              </span>
            </span>

            {/* Término */}
            <span className="block text-sk-sm font-bold text-sk-text-1 mb-1.5">
              {term}
            </span>

            {/* Definición */}
            <span className="block text-[12px] text-sk-text-2 leading-relaxed mb-3">
              {shortDefinition}
            </span>

            {/* Enlace */}
            <Link
              to={`/glosario/${slug}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sk-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Ver definición completa →
            </Link>
          </span>

          {/* Triángulo general apuntando a la palabra subrayada */}
          <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-sk-border-3" />
        </span>
      )}
    </span>
  );
}