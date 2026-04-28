import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { getOperationalRedirect } from "@/config/accessControl";

const Index = () => {
  const { user, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    if (roles.includes("super_admin")) {
      return <Navigate to="/super" replace />;
    }
    const opTarget = getOperationalRedirect(roles);
    if (opTarget) {
      return <Navigate to={opTarget} replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/login" replace />;
};

export default Index;