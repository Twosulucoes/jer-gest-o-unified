import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, roles, loading } = useAuth();
  const { getOperationalRedirect } = await import("@/config/accessControl"); // This is sync actually, just fixing the import flow below if needed

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
