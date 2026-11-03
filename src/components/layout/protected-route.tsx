// src/components/layout/protected-route.tsx
import { Navigate, useLocation } from "react-router-dom"; // 👈 Añadido useLocation
import { Spinner } from "../ui/spinner";
import { useAuthStore } from "../../stores/auth-store";
import type { UserRole } from "../../types";
import { isArenaPreviewAuthBlocked } from "../../lib/arena-preview";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole[];
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, profile } = useAuthStore();
  const location = useLocation(); // 👈 Capturamos la ubicación actual

  // Never render authenticated production-backed pages in public preview deployments.
  // The synthetic QA route remains public and uses no account data.
  if (isArenaPreviewAuthBlocked()) {
    return <Navigate to="/__arena-qa" replace />;
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