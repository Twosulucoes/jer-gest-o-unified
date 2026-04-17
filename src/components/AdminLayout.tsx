import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import EventSwitcher from "@/components/admin/EventSwitcher";
import RequireActiveEvent from "@/components/admin/RequireActiveEvent";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  LayoutDashboard, Calendar, LogOut, Menu, X, MapPin, Dumbbell, ListTree,
  Building2, Users, Upload, UserCheck, ScanLine, Bus, Route, Navigation,
  UtensilsCrossed, Clock, ClipboardList, Building, DoorOpen, KeyRound,
  Trophy, Swords, UsersRound, IdCard, ChevronDown,
  Shield, Settings, AlertTriangle, FileSearch, FileBarChart,
  Info, Zap, ClipboardCheck, ExternalLink, ChevronsLeft,
  ChevronsRight, User, FolderOpen, BadgeCheck, Truck, MessageSquare, Cog,
  Home,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getStatusEmoji } from "@/lib/systemMapHelpers";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles: AppRole[] | "all";
}

interface NavGroup {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  items: NavItem[];
  subGroups?: { label: string; items: NavItem[] }[];
}

const ADMIN_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica"];
const TRANSPORT_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "transporte"];
const FOOD_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "alimentacao"];
const LODGING_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica"];
const COMPETITION_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"];

const dashboardItem: NavItem = {
  label: "Dashboard",
  to: "/admin",
  icon: <Home className="h-4 w-4" />,
  roles: "all",
};

const navGroups: NavGroup[] = [
  {
    id: "preparacao", label: "Preparação", description: "Cadastros base do evento ativo.",
    icon: <FolderOpen className="h-4 w-4" />,
    items: [
      { label: "Eventos", to: "/admin/eventos", icon: <Calendar className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Delegações (Escolas)", to: "/admin/delegacoes", icon: <Users className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Participantes", to: "/admin/participantes", icon: <UsersRound className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Importação", to: "/admin/importacao", icon: <Upload className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Normalização", to: "/admin/normalizacao-provas", icon: <FileSearch className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Irregularidades", to: "/admin/irregularidades", icon: <AlertTriangle className="h-4 w-4" />, roles: ADMIN_ROLES },
    ],
  },
  {
    id: "credenciamento", label: "Credenciamento", description: "Emissão e validação de credenciais.",
    icon: <BadgeCheck className="h-4 w-4" />,
    items: [
      { label: "Busca e Emissão", to: "/admin/credenciamento", icon: <UserCheck className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Credenciamento Externo", to: "/admin/credenciamento-externo", icon: <ScanLine className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Validação QR", to: "/admin/validacao-qr", icon: <ScanLine className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao"] as AppRole[] },
      { label: "Modelos de Credencial", to: "/admin/credenciais/modelos", icon: <IdCard className="h-4 w-4" />, roles: ADMIN_ROLES },
    ],
  },
  {
    id: "competicao", label: "Competição", description: "Organização e execução da competição.",
    icon: <Trophy className="h-4 w-4" />,
    items: [
      { label: "Minhas Modalidades", to: "/admin/competicao/painel", icon: <Dumbbell className="h-4 w-4" />, roles: ["coordenador_modalidade"] as AppRole[] },
      { label: "Painel de Controle", to: "/admin/competicao/painel", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] as AppRole[] },
      { label: "Pré-validação", to: "/admin/competicao/pre-validacao", icon: <ClipboardCheck className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] as AppRole[] },
      { label: "Central da Competição", to: "/admin/competicao/central", icon: <Trophy className="h-4 w-4" />, roles: COMPETITION_ROLES },
      { label: "Partidas e Agenda", to: "/admin/competicao/partidas", icon: <Swords className="h-4 w-4" />, roles: COMPETITION_ROLES },
      { label: "Regras por Prova", to: "/admin/competicao/regras", icon: <Settings className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] as AppRole[] },
      { label: "Regras em Lote", to: "/admin/competicao/regras/lote", icon: <Zap className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] as AppRole[] },
      { label: "Resultados", to: "/admin/competicao/resultados", icon: <ClipboardList className="h-4 w-4" />, roles: COMPETITION_ROLES },
      { label: "Boletins Oficiais", to: "/admin/boletins", icon: <FileSearch className="h-4 w-4" />, roles: COMPETITION_ROLES },
    ],
  },
  {
    id: "logistica", label: "Logística", description: "Transporte, alimentação e alojamento.",
    icon: <Truck className="h-4 w-4" />,
    items: [],
    subGroups: [
      {
        label: "Transporte",
        items: [
          { label: "Saídas, Veículos e Linhas", to: "/admin/transporte", icon: <Bus className="h-4 w-4" />, roles: TRANSPORT_ROLES },
        ],
      },
      {
        label: "Alimentação",
        items: [
          { label: "Janelas e Tipos", to: "/admin/alimentacao", icon: <UtensilsCrossed className="h-4 w-4" />, roles: FOOD_ROLES },
          { label: "Registrar Consumo", to: "/admin/alimentacao/consumo", icon: <ClipboardList className="h-4 w-4" />, roles: FOOD_ROLES },
          { label: "Dashboard", to: "/admin/alimentacao/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, roles: FOOD_ROLES },
        ],
      },
      {
        label: "Alojamento",
        items: [
          { label: "Locais e Unidades", to: "/admin/alojamento", icon: <Building className="h-4 w-4" />, roles: LODGING_ROLES },
          { label: "Check-in / Check-out", to: "/admin/alojamento/ocupacao", icon: <KeyRound className="h-4 w-4" />, roles: LODGING_ROLES },
        ],
      },
    ],
  },
  {
    id: "relatorios", label: "Relatórios", description: "Relatórios consolidados por módulo.",
    icon: <FileBarChart className="h-4 w-4" />,
    items: [
      { label: "Competição", to: "/admin/relatorios", icon: <Trophy className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Transporte", to: "/admin/transporte/relatorios", icon: <Bus className="h-4 w-4" />, roles: TRANSPORT_ROLES },
      { label: "Alimentação", to: "/admin/alimentacao/relatorios", icon: <UtensilsCrossed className="h-4 w-4" />, roles: FOOD_ROLES },
      { label: "Alojamento", to: "/admin/alojamento/relatorios", icon: <Building className="h-4 w-4" />, roles: LODGING_ROLES },
    ],
  },
  {
    id: "ocorrencias", label: "Ocorrências", description: "Central de ocorrências operacionais.",
    icon: <AlertTriangle className="h-4 w-4" />,
    items: [
      { label: "Todas as Ocorrências", to: "/admin/ocorrencias", icon: <AlertTriangle className="h-4 w-4" />, roles: ADMIN_ROLES },
    ],
  },
  {
    id: "pesquisa", label: "Pesquisa de Satisfação", description: "Pesquisa de satisfação.",
    icon: <MessageSquare className="h-4 w-4" />,
    items: [
      { label: "Dashboard", to: "/admin/pesquisa", icon: <ClipboardCheck className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Eventos de Pesquisa", to: "/admin/pesquisa/eventos", icon: <Calendar className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Pesquisadores", to: "/admin/pesquisa/pesquisadores", icon: <Users className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
    ],
  },
  {
    id: "acessos", label: "Acessos", description: "Gestão de usuários e vínculos.",
    icon: <Users className="h-4 w-4" />,
    items: [
      { label: "Usuários Operacionais", to: "/admin/acessos/usuarios", icon: <KeyRound className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Links Externos", to: "/admin/links", icon: <ExternalLink className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Vínculos Delegação", to: "/admin/acessos/delegacoes", icon: <Shield className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
    ],
  },
  {
    id: "configuracoes", label: "Configurações", description: "Parâmetros e cadastros do evento.",
    icon: <Settings className="h-4 w-4" />,
    items: [
      { label: "Regras do Evento", to: "/admin/regras-evento", icon: <ListTree className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Locais de Competição", to: "/admin/locais", icon: <MapPin className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Modalidades", to: "/admin/modalidades", icon: <Dumbbell className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Categorias", to: "/admin/categorias", icon: <ListTree className="h-4 w-4" />, roles: ADMIN_ROLES },
    ],
  },
  {
    id: "sistema", label: "Sistema", description: "Ferramentas de diagnóstico e manutenção.",
    icon: <Cog className="h-4 w-4" />,
    items: [
      { label: "Diagnóstico do Sistema", to: "/admin/sistema/diagnostico", icon: <Info className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Demo/Seeds", to: "/admin/demo", icon: <Zap className="h-4 w-4" />, roles: ["admin", "coordenacao_tecnica"] as AppRole[] },
    ],
  },
];

function getRoleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    admin: "Administrador",
    super_admin: "Super Admin",
    secretaria: "Secretaria",
    transporte: "Transporte",
    alimentacao: "Alimentação",
    alojamento: "Alojamento",
    coordenacao_tecnica: "Coord. Técnica",
    coordenador_modalidade: "Coord. Modalidade",
    delegacao: "Delegação",
    arbitragem: "Arbitragem",
    cde: "CDE",
    mesario: "Mesário",
  };
  return labels[role] || role;
}

function getAllGroupRoutes(group: NavGroup): string[] {
  const routes = group.items.map((i) => i.to);
  if (group.subGroups) {
    group.subGroups.forEach((sg) => sg.items.forEach((i) => routes.push(i.to)));
  }
  return routes;
}

function NavItemLink({ item, collapsed, onClick }: { item: NavItem; collapsed?: boolean; onClick?: () => void }) {
  const navigate = useNavigate();
  const statusEmoji = getStatusEmoji(item.to);

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <NavLink
            to={item.to}
            end={item.to === "/admin"}
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
        <TooltipContent side="right" className="text-xs">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center group">
      <NavLink
        to={item.to}
        end={item.to === "/admin"}
        onClick={onClick}
        className={({ isActive }) =>
          `flex-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
            isActive
              ? "bg-sidebar-accent text-sidebar-primary shadow-app-sm"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }`
        }
      >
        {item.icon}
        <span className="truncate flex-1">{item.label}</span>
        {statusEmoji && <span className="text-[10px] leading-none opacity-60">{statusEmoji}</span>}
      </NavLink>
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/admin/sistema/diagnostico?route=${encodeURIComponent(item.to)}`);
        }}
        className="opacity-0 group-hover:opacity-50 hover:!opacity-100 p-1 transition-opacity text-sidebar-foreground/40"
        title="O que é isto?"
      >
        <Info className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function AdminLayout() {
  const { profile, roles, signOut, hasRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const isItemVisible = (item: NavItem) =>
    item.roles === "all" || item.roles.some((r) => hasRole(r));

  const isGroupVisible = (group: NavGroup) => {
    if (group.items.some(isItemVisible)) return true;
    if (group.subGroups?.some((sg) => sg.items.some(isItemVisible))) return true;
    return false;
  };

  const activeGroupId = useMemo(() => {
    const path = location.pathname;
    for (const group of navGroups) {
      if (getAllGroupRoutes(group).some((r) => path === r || (r !== "/admin" && path.startsWith(r)))) {
        return group.id;
      }
    }
    return null;
  }, [location.pathname]);

  const primaryRole = roles[0];
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-background">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${collapsed ? "w-16" : "w-64"}`}
        >
          {/* Logo */}
          <div className={`flex h-16 items-center border-b border-sidebar-border ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
            {collapsed ? (
              <img src="/brand/icon-dark.png" alt="JER's Gestão" className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <div className="flex items-center gap-2.5">
                <img src="/brand/icon-dark.png" alt="JER's Gestão" className="h-8 w-8 rounded-lg object-contain" />
                <span className="font-heading text-base font-bold text-sidebar-foreground">JER's Gestão</span>
              </div>
            )}
            <button onClick={closeSidebar} className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Event Switcher */}
          <div className={`border-b border-sidebar-border ${collapsed ? "px-2 py-2" : "px-3 py-3"}`}>
            {!collapsed && <EventSwitcher />}
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto py-3 space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
            {isItemVisible(dashboardItem) && (
              <NavItemLink item={dashboardItem} collapsed={collapsed} onClick={closeSidebar} />
            )}

            {navGroups.filter(isGroupVisible).map((group) => (
              <Collapsible key={group.id} defaultOpen={activeGroupId === group.id}>
                {collapsed ? (
                  <div className="mt-4 mb-1">
                    <div className="mx-auto h-px w-6 bg-sidebar-border" />
                  </div>
                ) : (
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors">
                    {group.label}
                    <ChevronDown className="h-3 w-3 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </CollapsibleTrigger>
                )}

                <CollapsibleContent className="space-y-0.5">
                  {group.items.filter(isItemVisible).map((item) => (
                    <NavItemLink key={item.to} item={item} collapsed={collapsed} onClick={closeSidebar} />
                  ))}

                  {group.subGroups?.map((subGroup) => {
                    const visibleItems = subGroup.items.filter(isItemVisible);
                    if (visibleItems.length === 0) return null;
                    return (
                      <div key={subGroup.label}>
                        {!collapsed && (
                          <p className="mt-2 mb-0.5 px-3 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/30">
                            {subGroup.label}
                          </p>
                        )}
                        {visibleItems.map((item) => (
                          <NavItemLink key={item.to} item={item} collapsed={collapsed} onClick={closeSidebar} />
                        ))}
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </nav>

          {/* Collapse toggle (desktop only) */}
          <div className="hidden lg:flex border-t border-sidebar-border p-2 justify-center">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center rounded-lg p-2 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* User footer */}
          {!collapsed && (
            <div className="border-t border-sidebar-border p-3">
              <div className="mb-2">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile?.full_name || "Usuário"}
                </p>
                {primaryRole && (
                  <p className="text-xs text-sidebar-primary/80">{getRoleLabel(primaryRole)}</p>
                )}
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
            </div>
          )}
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card/80 backdrop-blur-md px-4 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted-foreground hover:text-foreground lg:hidden transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h2 className="font-heading text-sm font-semibold text-foreground truncate">
              Jogos Escolares de Roraima
            </h2>

            <div className="flex-1" />

            <ThemeToggle className="text-muted-foreground" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  <User className="h-4 w-4" />
                  {hasRole("super_admin") && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[7px] font-bold text-black">S</span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{profile?.full_name || "Usuário"}</p>
                  {primaryRole && <p className="text-xs text-muted-foreground">{getRoleLabel(primaryRole)}</p>}
                </div>
                <DropdownMenuSeparator />
                {hasRole("super_admin") && (
                  <DropdownMenuItem asChild>
                    <Link to="/super" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4 text-amber-500" />
                      Painel Super
                    </Link>
                  </DropdownMenuItem>
                )}
                {roles.length >= 2 && (
                  <DropdownMenuItem asChild>
                    <Link to="/selecionar-modulo" className="cursor-pointer">
                      <Home className="mr-2 h-4 w-4" />
                      Trocar módulo
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 p-4 lg:p-6">
            {location.pathname === "/admin/eventos" ? (
              <Outlet />
            ) : (
              <RequireActiveEvent>
                <Outlet />
              </RequireActiveEvent>
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
