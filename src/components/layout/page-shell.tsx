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
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
