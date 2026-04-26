import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import AuthLoadingScreen from "@/components/auth/AuthLoadingScreen";
import type { AppRole } from "@/config/accessControl";
import { VersionBadge } from "@/components/VersionBadge";

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
    <div className="op-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--module-accent) / 0.85), transparent)",
          }}
        />
        <div className="relative flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-module-soft text-module">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <span className="font-heading font-bold tracking-tight text-foreground">{moduleTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {profile?.full_name && (
              <span className="hidden text-xs text-muted-foreground sm:inline">{profile.full_name}</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-9 w-9 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <VersionBadge />
    </div>
  );
}
