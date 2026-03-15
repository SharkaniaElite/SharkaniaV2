// src/components/layout/page-shell.tsx
import { type ReactNode } from "react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-sk-bg-1 flex flex-col">
      <Navbar />

      {/* Beta banner — fijo justo debajo del navbar (top-14 = 56px) */}
      <div
        style={{
          position: "fixed",
          top: "56px",
          left: 0,
          right: 0,
          zIndex: 90,
          background: "rgba(251,191,36,0.10)",
          borderBottom: "1px solid rgba(251,191,36,0.22)",
          color: "#fbbf24",
        }}
      >
        <p className="text-center text-[11px] font-medium py-1.5 px-6">
          ⚠️ <strong>Beta:</strong> Los datos actuales son de demostración.
          Los datos reales se irán cargando a medida que los clubes se inscriban.
        </p>
      </div>

      {/* Spacer para compensar navbar (56px) + banner (~32px) */}
      <div style={{ height: "88px", flexShrink: 0 }} />

      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
