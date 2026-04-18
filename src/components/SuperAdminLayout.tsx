import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  LayoutDashboard, Calendar, LogOut, Menu, X, ScrollText, Settings,
  ChevronsLeft, ChevronsRight, User, ChevronLeft, Activity,
} from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/super", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Eventos", to: "/super/eventos", icon: <Calendar className="h-4 w-4" /> },
  { label: "Monitor (PWA)", to: "/super/monitor", icon: <Activity className="h-4 w-4" /> },
  { label: "Logs do Sistema", to: "/super/logs", icon: <ScrollText className="h-4 w-4" /> },
  { label: "Configurações", to: "/super/config", icon: <Settings className="h-4 w-4" /> },
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
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
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
            ? "bg-zinc-700 text-white shadow-sm"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
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
      <div className="flex min-h-screen bg-zinc-950">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={closeSidebar} />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-zinc-900 text-zinc-300 border-r border-zinc-800 transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${collapsed ? "w-16" : "w-64"}`}
        >
          {/* Logo */}
          <div className={`flex h-16 items-center border-b border-zinc-800 ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
            {!collapsed && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-zinc-100">Super Admin</span>
                  <p className="text-[10px] text-zinc-500 leading-none">JER Gestão</p>
                </div>
              </div>
            )}
            {collapsed && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <Settings className="h-4 w-4" />
              </div>
            )}
            <button onClick={closeSidebar} className="lg:hidden text-zinc-500 hover:text-zinc-300">
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
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                Voltar ao Admin
              </NavLink>
            </div>
          )}

          {/* Collapse toggle */}
          <div className="hidden lg:flex border-t border-zinc-800 p-2 justify-center">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-all"
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* User footer */}
          {!collapsed && (
            <div className="border-t border-zinc-800 p-3">
              <div className="mb-2">
                <p className="text-sm font-medium text-zinc-200 truncate">{profile?.full_name || "Usuário"}</p>
                <p className="text-xs text-amber-400/80">Super Admin</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="w-full justify-start text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          )}
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md px-4 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-zinc-400 hover:text-zinc-200 lg:hidden transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/20">
                SUPER
              </span>
              <h2 className="text-sm font-semibold text-zinc-200 truncate">Painel Super Admin</h2>
            </div>

            <div className="flex-1" />

            <ThemeToggle className="text-zinc-400" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors">
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

          <main className="flex-1 p-4 lg:p-6 bg-zinc-950 text-zinc-100">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
