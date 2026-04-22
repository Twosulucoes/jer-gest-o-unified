import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import AuthLoadingScreen from "@/components/auth/AuthLoadingScreen";
import type { AppRole } from "@/config/accessControl";

interface PwaModuleLayoutProps {
  children: React.ReactNode;
  moduleTitle: string;
  moduleIcon?: React.ElementType;
  allowedRoles: AppRole[];
}

export default function PwaModuleLayout({ children, moduleTitle, moduleIcon: Icon, allowedRoles }: PwaModuleLayoutProps) {
  const { user, roles, loading, hasRole, profile } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/pwa/login" replace />;
  }

  const authorized = hasRole("admin") || hasRole("secretaria") || allowedRoles.some((r) => hasRole(r));
  if (!authorized) {
    return <Navigate to="/pwa/acesso-negado" replace />;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="relative overflow-hidden border-b border-border/90 bg-card text-card-foreground shadow-app-sm">
        <div
          className="absolute inset-x-0 top-0 h-0.5"
          style={{
            background: "hsl(var(--module-accent))",
          }}
        />
        <div className="relative flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5" style={{ color: "hsl(var(--module-accent))" }} />}
            <span className="font-heading font-semibold tracking-tight">{moduleTitle}</span>
          </div>
          <div className="flex items-center gap-3">
            {profile?.full_name && (
              <span className="text-xs text-muted-foreground hidden sm:inline">{profile.full_name}</span>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground hover:bg-muted">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
