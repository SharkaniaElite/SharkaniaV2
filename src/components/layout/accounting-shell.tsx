// src/components/layout/accounting-shell.tsx
import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/auth-store";
import { supabase } from "../../lib/supabase";
import { PageShell } from "./page-shell";
import { Spinner } from "../ui/spinner";
// 🔥 Agregamos 'Wallet' a los íconos importados
import { BarChart3, Users, DollarSign, ArrowLeftRight, FileUp, ShieldAlert, Wallet, PiggyBank } from "lucide-react";

export function AccountingShell() {
  const { user } = useAuthStore();
  const location = useLocation();
  const [isManager, setIsManager] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkPermission() {
      if (!user) {
        setIsManager(false);
        return;
      }
      const { data } = await supabase
        .from("acc_managers")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      
      setIsManager(!!data);
    }
    checkPermission();
  }, [user]);

  if (isManager === null) {
    return (
      <PageShell>
        <div className="pt-20 min-h-screen flex items-center justify-center bg-sk-bg-1">
          <Spinner size="lg" />
        </div>
      </PageShell>
    );
  }

  if (!isManager) {
    return (
      <PageShell>
        <div className="pt-32 px-6 min-h-screen flex flex-col items-center justify-center bg-sk-bg-1 text-center">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-sk-xl font-black text-sk-text-1 mb-2">Área Restringida</h1>
          <p className="text-sk-sm text-sk-text-3 max-w-sm mb-6">
            No tienes los permisos de auditoría necesarios para ingresar al Backoffice Contable de LAP.
          </p>
          <Link to="/dashboard" className="text-sk-sm text-sk-accent hover:underline">Regresar al panel general</Link>
        </div>
      </PageShell>
    );
  }

  // 🔥 AQUÍ ESTÁ LA MAGIA: Agregamos el menú "Pago de Rake"
  const menuItems = [
    { label: "Dashboard", href: "/lap-admin", icon: <BarChart3 size={16} /> },
    { label: "Cargar Informes", href: "/lap-admin/upload", icon: <FileUp size={16} /> },
    { label: "Bancajes y Deals", href: "backing", icon: <PiggyBank size={16} /> },
    { label: "Caja de Fichas", href: "/lap-admin/transactions", icon: <ArrowLeftRight size={16} /> },
    { label: "Pago de Rake", href: "/lap-admin/liquidations", icon: <Wallet size={16} /> },
    { label: "Promos Jugadores", href: "/lap-admin/promotions", icon: <DollarSign size={16} /> },
    { label: "Agentes & Deals", href: "/lap-admin/agents", icon: <DollarSign size={16} /> },
    { label: "Jugadores", href: "/lap-admin/players", icon: <Users size={16} /> },
  ];

  return (
    <PageShell>
      <div className="pt-20 min-h-screen bg-sk-bg-1 border-t border-sk-border-2 flex flex-col md:flex-row">
        {/* Sidebar Interno */}
        <aside className="w-full md:w-64 bg-sk-bg-2 border-b md:border-b-0 md:border-r border-sk-border-2 p-6 shrink-0">
          <div className="mb-6">
            <p className="font-mono text-[10px] font-bold tracking-widest text-sk-purple uppercase">Backoffice Financiero</p>
            <h2 className="text-sk-md font-black text-sk-text-1">LatinAllinPoker</h2>
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-2.5 py-2 px-3 text-sk-sm rounded-md font-medium transition-colors ${
                    isActive 
                      ? "bg-sk-purple/10 text-sk-purple border border-sk-purple/20" 
                      : "text-sk-text-2 hover:bg-sk-bg-3 hover:text-sk-text-1 border border-transparent"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Contenedor Principal de Vistas */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </PageShell>
  );
}