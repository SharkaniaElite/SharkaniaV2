// src/components/layout/admin-access-banner.tsx
import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/auth-store";
import { Settings, Zap } from "lucide-react";

/**
 * Floating admin access button that appears for club_admin and super_admin users.
 * Hidden on admin pages themselves.
 * 
 * INTEGRATION: Add this component inside your PageShell, after the Navbar:
 * 
 * import { AdminAccessBanner } from "./admin-access-banner";
 * 
 * export function PageShell({ children }: PageShellProps) {
 *   return (
 *     <div className="min-h-screen bg-sk-bg-1 flex flex-col">
 *       <Navbar />
 *       <AdminAccessBanner />     ← ADD HERE
 *       ... rest
 *     </div>
 *   );
 * }
 */
export function AdminAccessBanner() {
  const { isAuthenticated, profile } = useAuthStore();
  const location = useLocation();

  // Don't show if not logged in
  if (!isAuthenticated || !profile) return null;

  // Don't show on admin pages
  if (location.pathname.startsWith("/admin")) return null;

  const isSuperAdmin = profile.role === "super_admin";
  const isClubAdmin = profile.role === "club_admin";

  // Only show for admin roles
  if (!isSuperAdmin && !isClubAdmin) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
      {/* Super admin button */}
      {isSuperAdmin && (
        <Link
          to="/admin"
          className="group flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500/90 to-orange-500/90 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:scale-[1.03] transition-all duration-200 backdrop-blur-sm border border-white/10"
        >
          <div className="relative">
            <Zap size={18} className="drop-shadow-sm" />
            {/* Pulse dot */}
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-bold tracking-wide leading-none">Super Admin</span>
            <span className="text-[9px] opacity-70 leading-tight">Panel general</span>
          </div>
        </Link>
      )}

      {/* Club admin button — visible for both club_admin AND super_admin */}
      <Link
        to="/admin/club"
        className="group flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.03] transition-all duration-200 backdrop-blur-sm border border-white/10"
      >
        <div className="relative">
          {/* 3D-style gear icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="drop-shadow-sm">
            {/* Shadow for depth */}
            <circle cx="12" cy="13" r="7" fill="rgba(0,0,0,0.15)" />
            {/* Gear body */}
            <path
              d="M12 15a3 3 0 100-6 3 3 0 000 6z"
              fill="rgba(255,255,255,0.9)"
            />
            <path
              d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
              fill="none"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Highlight for 3D */}
            <circle cx="12" cy="11" r="6" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
          </svg>
          {/* Notification dot if there are pending actions */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold tracking-wide leading-none">
            {isSuperAdmin ? "Gestionar Clubes" : "Mi Panel de Club"}
          </span>
          <span className="text-[9px] opacity-70 leading-tight">
            {isSuperAdmin ? "Torneos, plantillas, resultados" : "Torneos, calendario, resultados"}
          </span>
        </div>
      </Link>
    </div>
  );
}
