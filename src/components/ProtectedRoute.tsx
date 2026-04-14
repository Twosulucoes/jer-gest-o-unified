import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If set, user must have at least one of these roles. If omitted, any authenticated user with at least one role passes. */
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

  // User is authenticated but has no roles at all → no admin access
  if (roles.length === 0) {
    return <Navigate to="/login" replace />;
  }

  // super_admin bypasses role checks (full access)
  if (hasRole("super_admin")) {
    return <>{children}</>;
  }

  // If specific roles required, check at least one matches
  if (allowedRoles && allowedRoles.length > 0) {
    const authorized = allowedRoles.some((r) => hasRole(r));
    if (!authorized) {
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
}
