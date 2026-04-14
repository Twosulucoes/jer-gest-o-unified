import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface PwaRouteGuardProps {
  children: React.ReactNode;
  /** Roles allowed to access this PWA module. If empty, any authenticated user passes. */
  allowedRoles?: AppRole[];
}

export default function PwaRouteGuard({ children, allowedRoles }: PwaRouteGuardProps) {
  const { user, roles, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/pwa/login" replace />;
  }

  // If specific roles required, check. Admin always passes.
  if (allowedRoles && allowedRoles.length > 0) {
    const authorized = hasRole("admin" as AppRole) || allowedRoles.some((r) => hasRole(r));
    if (!authorized) {
      return <Navigate to="/pwa/acesso-negado" replace />;
    }
  }

  return <>{children}</>;
}
