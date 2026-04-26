import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthLoadingScreen from "@/components/auth/AuthLoadingScreen";
import { getOperationalRedirect, type AppRole } from "@/config/accessControl";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If set, user must have at least one of these roles. If omitted, any authenticated user with admin access passes. */
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, roles, loading, hasRole } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated but has no roles at all → no access
  if (roles.length === 0) {
    return <Navigate to="/login" replace />;
  }

  // super_admin bypasses all checks
  if (hasRole("super_admin")) {
    return <>{children}</>;
  }

  // Block operational-only users from /admin
  const operationalTarget = getOperationalRedirect(roles);
  if (operationalTarget) {
    return <Navigate to={operationalTarget} replace />;
  }

  // If specific roles required on a sub-route, check at least one matches
  if (allowedRoles && allowedRoles.length > 0) {
    const authorized = allowedRoles.some((r) => hasRole(r));
    if (!authorized) {
      return <Navigate to="/acesso-negado" replace />;
    }
  }

  return <>{children}</>;
}
