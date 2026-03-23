// src/components/layout/page-shell.tsx
import { type ReactNode } from "react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { AdminAccessBanner } from "./admin-access-banner";

interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-sk-bg-1 flex flex-col">
      <Navbar />

      {/* Spacer para compensar navbar (56px) */}
      <div style={{ height: "56px", flexShrink: 0 }} />

      <main className="flex-1">{children}</main>
      <Footer />

      <AdminAccessBanner />
    </div>
  );
}