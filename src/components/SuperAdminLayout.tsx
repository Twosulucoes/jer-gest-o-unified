import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Calendar, LogOut, Menu, X, ScrollText, Settings,
  ChevronsLeft, ChevronsRight, User, ChevronLeft, Activity, BookOpen, LifeBuoy, DatabaseZap,
  ShieldCheck, Database as DatabaseIcon, Info, CheckCircle, Layers, KeyRound, Upload, Monitor,
} from "lucide-react";
import { useState } from "react";
import { brand } from "@/theme/brand";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalRefreshButton } from "@/components/admin/GlobalRefreshButton";
import { VersionBadge } from "@/components/VersionBadge";

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/super", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Eventos", to: "/super/eventos", icon: <Calendar className="h-4 w-4" /> },
  { label: "Inferência de Famílias", to: "/super/registros/familias-inferidas", icon: <Layers className="h-4 w-4" /> },
  { label: "Monitor (PWA)", to: "/super/monitor", icon: <Activity className="h-4 w-4" /> },
  { label: "Manual de Instruções", to: "/super/manual", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Inspetor de Dados", to: "/super/inspector", icon: <DatabaseZap className="h-4 w-4" /> },
  { label: "Logs do Sistema", to: "/super/logs", icon: <ScrollText className="h-4 w-4" /> },
  { label: "Configurações", to: "/super/config", icon: <Settings className="h-4 w-4" /> },
  { label: "Permissões", to: "/super/permissoes", icon: <ShieldCheck className="h-4 w-4" /> },
  { label: "Central de Dados", to: "/super/dados", icon: <DatabaseIcon className="h-4 w-4" /> },
  { label: "Diagnóstico Sistema", to: "/super/diagnostico", icon: <Info className="h-4 w-4" /> },
  { label: "Validador de Schema", to: "/super/validador", icon: <CheckCircle className="h-4 w-4" /> },
  { label: "Clonar Logística", to: "/admin/clonar-logistica", icon: <Layers className="h-4 w-4" /> },
  { label: "Importação", to: "/admin/importacao", icon: <Upload className="h-4 w-4" /> },
  { label: "Usuários e Perfis", to: "/admin/acessos/usuarios", icon: <KeyRound className="h-4 w-4" /> },
  { label: "Acessos PWA", to: "/admin/acessos/pwa", icon: <Monitor className="h-4 w-4" /> },
  { label: "Vínculos de Importação", to: "/admin/importacao/aliases", icon: <Layers className="h-4 w-4" /> },
];

function NavItemLink({ item, collapsed, onClick }: { item: NavItem; collapsed?: boolean; onClick?: () => void }) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to={item.to}
            end={item.to === "/super"}
            onClick={onClick}
            className={({ isActive }) =>
              `flex items-center justify-center rounded-lg p-2.5 transition-all duration-150 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary shadow-app-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`
            }
          >
            {item.icon}
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === "/super"}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-sidebar-accent text-sidebar-primary shadow-app-sm"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }`
      }
    >
      {item.icon}
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export default function SuperAdminLayout() {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-background">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={closeSidebar} />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${collapsed ? "w-16" : "w-[86vw] max-w-80 lg:w-64"}`}
        >
          {/* Logo */}
          <div className={`flex h-16 items-center border-b border-sidebar-border ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
            {!collapsed && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-sidebar-foreground">Super Admin</span>
                  <p className="text-[10px] text-sidebar-foreground/50 leading-none">JER Gestão</p>
                </div>
              </div>
            )}
            {collapsed && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary">
                <Settings className="h-4 w-4" />
              </div>
            )}
            <button onClick={closeSidebar} className="lg:hidden text-sidebar-foreground/50 hover:text-sidebar-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto py-4 space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
            {navItems.map((item) => (
              <NavItemLink key={item.to} item={item} collapsed={collapsed} onClick={closeSidebar} />
            ))}
          </nav>

          {/* Back to Admin */}
          {!collapsed && (
            <div className="px-3 pb-2">
              <NavLink
                to="/admin"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                Voltar ao Admin
              </NavLink>
            </div>
          )}

          {/* Collapse toggle */}
          <div className="hidden lg:flex border-t border-sidebar-border p-2 justify-center">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center rounded-lg p-2 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* User footer */}
          {!collapsed && (
            <div className="border-t border-sidebar-border p-3">
              <div className="mb-2">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "Usuário"}</p>
                <p className="text-xs text-sidebar-primary/80">Super Admin</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
              <p className="mt-2 text-[10px] text-zinc-600 text-center leading-tight">
                Desenvolvido por{" "}
                <a
                  href={brand.developer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-400 transition-colors"
                >
                  {brand.developer.name}
                </a>
              </p>
            </div>
          )}
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 backdrop-blur-md px-3 sm:px-4 lg:h-14 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground lg:hidden transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-amber/15 px-2 py-0.5 text-[10px] font-semibold text-amber ring-1 ring-inset ring-amber/30">
                SUPER
              </span>
              <h2 className="text-sm font-semibold text-foreground truncate">Painel Super Admin</h2>
            </div>

            <div className="flex-1" />

            <GlobalRefreshButton />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  <User className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{profile?.full_name || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground">Super Admin</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <NavLink to="/admin" className="cursor-pointer">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Voltar ao Admin
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 lg:pb-6">
            <Outlet />
          </main>
        </div>
      </div>
      <VersionBadge />
    </TooltipProvider>
  );
}
