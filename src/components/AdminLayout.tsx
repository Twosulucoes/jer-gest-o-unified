import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  LogOut,
  Menu,
  X,
  MapPin,
  Dumbbell,
  ListTree,
  Building2,
} from "lucide-react";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles: AppRole[] | "all";
}

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: <LayoutDashboard className="h-4 w-4" />, roles: "all" },
  { label: "Eventos", to: "/admin/eventos", icon: <Calendar className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] },
  { label: "Modalidades", to: "/admin/modalidades", icon: <Dumbbell className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] },
  { label: "Categorias", to: "/admin/categorias", icon: <ListTree className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] },
  { label: "Locais", to: "/admin/locais", icon: <MapPin className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] },
  { label: "Instituições", to: "/admin/instituicoes", icon: <Building2 className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] },
];

function getRoleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    admin: "Administrador",
    secretaria: "Secretaria",
    transporte: "Transporte",
    alimentacao: "Alimentação",
    coordenacao_tecnica: "Coord. Técnica",
    delegacao: "Delegação",
  };
  return labels[role] || role;
}

export default function AdminLayout() {
  const { profile, roles, signOut, hasRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleItems = navItems.filter(
    (item) => item.roles === "all" || item.roles.some((r) => hasRole(r))
  );

  const primaryRole = roles[0];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
          <span className="font-heading text-lg font-bold text-sidebar-primary">JER Gestão</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || "Usuário"}
            </p>
            {primaryRole && (
              <p className="text-xs text-sidebar-primary">{getRoleLabel(primaryRole)}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center border-b border-border bg-card px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mr-4 text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Jogos Escolares de Roraima
          </h2>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
