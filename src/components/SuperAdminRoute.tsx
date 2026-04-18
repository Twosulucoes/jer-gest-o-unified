import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";
import AuthLoadingScreen from "@/components/auth/AuthLoadingScreen";

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

export default function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const { user, roles, loading, hasRole } = useAuth();
  const toastShown = useRef(false);

  const isSuperAdmin = hasRole("super_admin");

  useEffect(() => {
    if (!loading && user && roles.length > 0 && !isSuperAdmin && !toastShown.current) {
      toastShown.current = true;
      toast({ title: "Acesso negado", description: "Área restrita ao Super Admin.", variant: "destructive" });
    }
  }, [loading, user, roles, isSuperAdmin]);

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  return <>{children}</>;
}
