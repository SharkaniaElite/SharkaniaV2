// src/components/ui/modal.tsx
import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handler);
      return () => {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handler);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-sk-fade-in"
        onClick={onClose}
      />

      {/* Content */}
      <div
        className={cn(
          "relative bg-sk-bg-2 border border-sk-border-2 rounded-xl shadow-sk-xl",
          "w-full max-w-lg max-h-[85vh] overflow-y-auto animate-sk-fade-up",
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-sk-border-2">
            <h3 className="text-sk-md font-bold text-sk-text-1">{title}</h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-sm flex items-center justify-center text-sk-text-3 hover:text-sk-text-1 hover:bg-white/[0.04] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
