import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** Roles that grant access to /admin */
const ADMIN_ACCESS_ROLES: AppRole[] = ["admin", "secretaria", "super_admin", "coordenacao_tecnica", "coordenador_modalidade", "cde"];

/** Map of operational-only roles to their PWA redirect target */
const OPERATIONAL_REDIRECT: Partial<Record<AppRole, string>> = {
  transporte: "/pwa/transporte",
  alimentacao: "/pwa/alimentacao",
  alojamento: "/pwa/alojamento",
  delegacao: "/pwa/delegacao",
  mesario: "/aovivo",
  arbitragem: "/aovivo",
};

/**
 * Returns the PWA redirect path for a user whose roles are ALL operational
 * (i.e. none of ADMIN_ACCESS_ROLES). Returns null if user can access admin.
 */
function getOperationalRedirect(roles: AppRole[]): string | null {
  // If user has ANY admin-level role, they can access /admin
  if (roles.some((r) => ADMIN_ACCESS_ROLES.includes(r))) return null;

  // Find the first operational role with a redirect target
  for (const role of roles) {
    const target = OPERATIONAL_REDIRECT[role];
    if (target) return target;
  }

  // Fallback for unknown operational-only roles
  return "/pwa";
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If set, user must have at least one of these roles. If omitted, any authenticated user with admin access passes. */
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, roles, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
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

  // --- CRITICAL: Block operational-only users from /admin ---
  const operationalTarget = getOperationalRedirect(roles);
  if (operationalTarget) {
    return <Navigate to={operationalTarget} replace />;
  }

  // If specific roles required on a sub-route, check at least one matches
  if (allowedRoles && allowedRoles.length > 0) {
    const authorized = allowedRoles.some((r) => hasRole(r));
    if (!authorized) {
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
}
