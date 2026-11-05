import { useEffect } from "react";
import type { IgnitionFlowStatus } from "../../lib/ignition-link-status";
import { ignitionNotices } from "../../lib/ignition-link-status";

/** Accessible post-login modal, based on the verified profiles row. */
export function IgnitionLinkNotice({ status, onClose, onProceed }: {
  status: IgnitionFlowStatus;
  onClose: () => void;
  onProceed: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const notice = ignitionNotices[status];
  const isLinked = status === "linked";
  const needsLink = status === "needs-link";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto px-4 py-8"
      data-ignition-notice={status}>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <section role="dialog" aria-modal="true" aria-labelledby="ignition-notice-title"
        aria-describedby="ignition-notice-description"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-orange-500/30 bg-[#101820] p-6 shadow-2xl sm:p-8">
        <button type="button" onClick={onClose} aria-label="Cerrar aviso de Ignition"
          className="absolute right-4 top-4 rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-white/10 hover:text-white">×</button>
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/10 text-2xl"
          aria-hidden="true">{isLinked ? "✅" : status === "pending" ? "⏳" : "🦈"}</div>
        <h2 id="ignition-notice-title" className="mb-3 pr-5 text-2xl font-bold text-white">{notice.title}</h2>
        <p id="ignition-notice-description" className="text-sm leading-7 text-slate-300">{notice.description}</p>
        <p className="mt-4 text-xs text-slate-400">
          Consulta los requisitos de elegibilidad y el reglamento en{" "}
          <a href="/noticias/bases-oficiales-liga-sharkania-noviembre-2026"
            className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-100">las bases oficiales de la liga</a>.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onProceed} autoFocus
            className="flex-1 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 px-5 py-3 text-sm font-bold text-white hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
            {needsLink ? "Vincular mi cuenta Ignition" : "Entendido"}
          </button>
          {needsLink && <button type="button" onClick={onClose}
            className="rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5">
            Más tarde
          </button>}
        </div>
      </section>
    </div>
  );
}
