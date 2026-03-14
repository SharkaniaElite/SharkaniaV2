// src/components/layout/protected-route.tsx
import { Navigate } from "react-router-dom";
import { Spinner } from "../ui/spinner";
import { useAuthStore } from "../../stores/auth-store";
import type { UserRole } from "../../types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole[];
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, profile } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sk-bg-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && profile && !requiredRole.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
