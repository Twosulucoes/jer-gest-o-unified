import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthLoadingScreen from "@/components/auth/AuthLoadingScreen";
import type { AppRole } from "@/config/accessControl";

interface PwaRouteGuardProps {
  children: React.ReactNode;
  /** Roles allowed to access this PWA module. If empty, any authenticated user passes. */
  allowedRoles?: AppRole[];
}

export default function PwaRouteGuard({ children, allowedRoles }: PwaRouteGuardProps) {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/pwa/login" replace />;
  }

  // If specific roles required, check. Admin/secretaria always pass.
  if (allowedRoles && allowedRoles.length > 0) {
    const authorized = hasRole("admin") || hasRole("secretaria") || allowedRoles.some((r) => hasRole(r));
    if (!authorized) {
      return <Navigate to="/pwa/acesso-negado" replace />;
    }
  }

  return <>{children}</>;
}
