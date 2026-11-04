// src/components/layout/protected-route.tsx
import { Navigate, useLocation } from "react-router-dom"; // 👈 Añadido useLocation
import { Spinner } from "../ui/spinner";
import { useAuthStore } from "../../stores/auth-store";
import type { UserRole } from "../../types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole[];
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, profile } = useAuthStore();
  const location = useLocation(); // 👈 Capturamos la ubicación actual

  // UI fail-closed: Cloudflare Pages preview currently embeds Sharkania's
  // PRODUCTION Supabase URL. Never let an accidental login navigate into
  // authenticated management pages of this preview.
  // This is defense-in-depth only: RLS/server privileges remain authoritative.
  const previewUsingProduction = (
    typeof window !== "undefined" &&
    /\\.pages\\.dev$/i.test(window.location.hostname) &&
    /^https:\\/\\/nhpjzywfzljtlqaigzed\\.supabase\\.co\\/?$/i.test(
      String(import.meta.env.VITE_SUPABASE_URL ?? "")
    )
  );
  if (previewUsingProduction) {
    return (
      <main role="alert" className="min-h-screen bg-sk-bg-1 flex items-center justify-center p-6">
        <div className="max-w-xl rounded-xl border border-sk-border-2 bg-sk-bg-2 p-6 text-sk-text-1">
          <h1 className="text-xl font-bold mb-3">Administración bloqueada en este preview</h1>
          <p>Este preview de Cloudflare está conectado a la base de datos real.
          Por seguridad, las rutas autenticadas se han deshabilitado aquí.
          Usa el sitio oficial para la operación normal o un entorno QA
          completamente aislado para las pruebas.</p>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sk-bg-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // 🛡️ Redirigimos al login pasando la ruta actual en el parámetro 'redirect'
    // Usamos encodeURIComponent para asegurar que caracteres como '/' no rompan la URL
    return (
      <Navigate 
        to={`/login?redirect=${encodeURIComponent(location.pathname)}`} 
        replace 
      />
    );
  }

  if (requiredRole && (!profile || !requiredRole.includes(profile.role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}