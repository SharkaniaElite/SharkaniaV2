import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ArenaLeagueDialogProps {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Native modal dialog: browser-provided focus trapping, Escape key and
 * focus restoration. Portal avoids clipping in overflow-x tables.
 */
export function ArenaLeagueDialog({ title, eyebrow, onClose, children, footer }: ArenaLeagueDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="arena-league-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={onClose}
    >
      <div className="arena-league-dialog-heading">
        <div>
          <p>{eyebrow}</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar desglose de puntos">
          <X size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="arena-league-dialog-body">{children}</div>
      <div className="arena-league-dialog-footer">
        {footer}
        <button type="button" onClick={onClose}>Cerrar detalle</button>
      </div>
    </dialog>,
    document.body
  );
}
