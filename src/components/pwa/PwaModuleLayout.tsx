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
      <header className="relative overflow-hidden border-b bg-primary text-primary-foreground">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(212 84% 36%) 35%, hsl(174 87% 34%) 65%, hsl(133 55% 45%) 100%)",
          }}
        />
        <div className="relative flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5" />}
            <span className="font-heading font-semibold tracking-tight">{moduleTitle}</span>
          </div>
          <div className="flex items-center gap-3">
            {profile?.full_name && (
              <span className="text-xs text-primary-foreground/70 hidden sm:inline">{profile.full_name}</span>
            )}
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
