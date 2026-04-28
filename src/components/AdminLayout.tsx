import { NavLink, Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import EventSwitcher from "@/components/admin/EventSwitcher";
import RequireActiveEvent from "@/components/admin/RequireActiveEvent";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Calendar, LogOut, Menu, X, MapPin, Dumbbell, ListTree, Trophy, Bus, UtensilsCrossed, Building2,
  Users, Upload, KeyRound, BadgeCheck, Gavel, ScanLine,
  UsersRound, ChevronDown,
  Shield, Settings, AlertTriangle, FileBarChart, Monitor, Database as DatabaseIcon,
  Info, ExternalLink, ChevronsLeft,
  ChevronsRight, User, FolderOpen, Cloud,
  Home, Bot, BookOpen, HelpCircle, LifeBuoy, ClipboardList, Radio, Layers,
} from "lucide-react";
import { useState, useMemo } from "react";
import StageFilterBanner from "@/components/admin/StageFilterBanner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getStatusEmoji } from "@/lib/systemMapHelpers";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Database } from "@/integrations/supabase/types";
import { NavigationHistoryTracker } from "@/hooks/useNavigationHistory";
import { useMobileBackGuard } from "@/hooks/useMobileBackGuard";
import { brand } from "@/theme/brand";
import { GlobalRefreshButton } from "@/components/admin/GlobalRefreshButton";
import { VersionBadge } from "@/components/VersionBadge";

type AppRole = Database["public"]["Enums"]["app_role"];

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles: AppRole[] | "all";
  hideIfRegistrosEnabled?: boolean;
  showOnlyIfRegistrosEnabled?: boolean;
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

const dashboardItem: NavItem = {
  label: "Painel de Gestão",
  to: "/admin",
  icon: <Home className="h-4 w-4" />,
  roles: "all",
};

const coordDashboardItem: NavItem = {
  label: "Painel Coordenador",
  to: "/admin/coordenador-modalidade",
  icon: <Home className="h-4 w-4" />,
  roles: ["coordenador_modalidade"],
};

const navGroups: NavGroup[] = [
  {
    id: "preparacao", label: "Preparação do Evento", description: "Cadastros base do evento.",
    icon: <FolderOpen className="h-4 w-4" />,
    items: [
      { label: "Eventos", to: "/admin/eventos", icon: <Calendar className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Participantes", to: "/admin/participantes", icon: <UsersRound className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Pessoas Eventuais", to: "/admin/pessoas/eventuais", icon: <Users className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Duplicidades de Pessoas", to: "/admin/participantes/duplicidades", icon: <Users className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Histórico do Participante", to: "/admin/participantes/historico", icon: <Trophy className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Delegações (Escolas)", to: "/admin/delegacoes", icon: <Building2 className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Credencial (Modelos)", to: "/admin/credenciais/modelos", icon: <BadgeCheck className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Vinculação de Credencial", to: "/admin/credenciamento-externo", icon: <ScanLine className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Validação Manual (Voucher)", to: "/admin/vouchers/validar-manual", icon: <BadgeCheck className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Importação", to: "/admin/importacao", icon: <Upload className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Irregularidades", to: "/admin/irregularidades", icon: <AlertTriangle className="h-4 w-4" />, roles: ADMIN_ROLES },
    ],
  },
  {
    id: "relatorios", label: "Relatórios", description: "Documentos oficiais e boletins.",
    icon: <FileBarChart className="h-4 w-4" />,
    items: [
      { label: "Central de Relatórios", to: "/admin/relatorios", icon: <FileBarChart className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Boletins por Modalidade", to: "/admin/relatorios/boletins", icon: <FileBarChart className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Quadro de Medalhas", to: "/admin/relatorios/quadro-medalhas", icon: <FileBarChart className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Prestação de Contas (OSC)", to: "/admin/relatorios/osc", icon: <FileBarChart className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
    ],
  },
  {
    id: "logistica-global", label: "Logística Global", description: "Visão e ferramentas de logística entre etapas.",
    icon: <Layers className="h-4 w-4" />,
    items: [
      { label: "Logística Consolidada", to: "/admin/etapas", icon: <Layers className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Clonar Logística entre Etapas", to: "/admin/clonar-logistica", icon: <Layers className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
    ],
  },
  {
    id: "comunicacao", label: "Comunicação e Visual", description: "Identidade, links e pesquisa.",
    icon: <Radio className="h-4 w-4" />,
    items: [
      { label: "Páginas e Links", to: "/admin/links", icon: <ExternalLink className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Identidade Visual", to: "/admin/configuracoes/identidade-visual", icon: <BadgeCheck className="h-4 w-4" />, roles: ["admin"] as AppRole[] },
      { label: "Pesquisa de Satisfação", to: "/admin/pesquisa", icon: <ClipboardList className="h-4 w-4" />, roles: ADMIN_ROLES },
    ],
    subGroups: [
      {
        label: "Links PWA (Mobile)",
        items: [
          { label: "Transporte", to: "/pwa/transporte", icon: <Bus className="h-4 w-4" />, roles: ADMIN_ROLES },
          { label: "Alimentação", to: "/pwa/alimentacao", icon: <UtensilsCrossed className="h-4 w-4" />, roles: ADMIN_ROLES },
          { label: "Alojamento", to: "/pwa/alojamento", icon: <Building2 className="h-4 w-4" />, roles: ADMIN_ROLES },
          { label: "Coord. Técnica", to: "/pwa/coordenacao-tecnica", icon: <Trophy className="h-4 w-4" />, roles: ADMIN_ROLES },
          { label: "Delegação", to: "/pwa/delegacao", icon: <Users className="h-4 w-4" />, roles: ADMIN_ROLES },
          { label: "JER Ao Vivo", to: "/aovivo", icon: <Radio className="h-4 w-4" />, roles: ADMIN_ROLES },
        ]
      }
    ]
  },
  {
    id: "acessos", label: "Acessos", description: "Usuários e permissões.",
    icon: <Users className="h-4 w-4" />,
    items: [
      { label: "Usuários e Perfis", to: "/admin/acessos/usuarios", icon: <KeyRound className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Acessos e Vínculos", to: "/admin/acessos/delegacoes", icon: <Shield className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Auditoria de Acessos PWA", to: "/admin/acessos/pwa", icon: <Monitor className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Auditoria do Sistema", to: "/admin/auditoria", icon: <Shield className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
      { label: "Evidências OSC", to: "/admin/evidencias-osc", icon: <BadgeCheck className="h-4 w-4" />, roles: ["admin", "secretaria", "alimentacao", "alojamento", "transporte", "coordenacao_tecnica"] as AppRole[] },
      { label: "Monitoramento DB", to: "/admin/monitoramento-db", icon: <DatabaseIcon className="h-4 w-4" />, roles: ["admin"] as AppRole[] },
      { label: "Conexão Supabase", to: "/admin/configuracoes/supabase", icon: <Cloud className="h-4 w-4" />, roles: ["admin"] as AppRole[] },

      { label: "Status do PWA", to: "/admin/pwa-status", icon: <Cloud className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },

      { label: "Resultados (Coord. Modalidade)", to: "/pwa/resultados", icon: <Trophy className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"] as AppRole[] },
    ],
  },
  {
    id: "competicao", label: "Competição", description: "Operação das modalidades e confrontos.",
    icon: <Trophy className="h-4 w-4" />,
    items: [
      { label: "Painel da Competição", to: "/admin/competicao/painel", icon: <Layers className="h-4 w-4" />, roles: ADMIN_ROLES, hideIfRegistrosEnabled: true },
      { label: "Publicação de Resultados", to: "/admin/competicao/publicacao", icon: <ExternalLink className="h-4 w-4" />, roles: ["admin", "secretaria"] },
      { label: "Central da Competição", to: "/admin/competicao/central", icon: <Trophy className="h-4 w-4" />, roles: ADMIN_ROLES, hideIfRegistrosEnabled: true },
      { label: "Registros de Partidas", to: "/admin/registros", icon: <ClipboardList className="h-4 w-4" />, roles: ADMIN_ROLES, showOnlyIfRegistrosEnabled: true },
      { label: "Boletins Oficiais", to: "/admin/competicao/boletins", icon: <FileBarChart className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Regras por Prova", to: "/admin/competicao/regras", icon: <ListTree className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Locais de Competição", to: "/admin/locais", icon: <MapPin className="h-4 w-4" />, roles: ADMIN_ROLES },
    ],
  },
  {
    id: "arbitragem", label: "Arbitragem", description: "Equipe, escalas e operação ao vivo.",
    icon: <Gavel className="h-4 w-4" />,
    items: [
      { label: "Equipe de Arbitragem", to: "/admin/competicao/arbitragem?tab=officials", icon: <Users className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] as AppRole[] },
      { label: "Escalas por etapa", to: "/admin/competicao/arbitragem?tab=sports", icon: <ListTree className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] as AppRole[] },
      { label: "Escala em Lote", to: "/admin/competicao/arbitragem?tab=lote", icon: <ClipboardList className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] as AppRole[] },
      { label: "AOVivo (PWA)", to: "/aovivo", icon: <Radio className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica"] as AppRole[] },
      { label: "Protestos (Fila CDE)", to: "/admin/protestos", icon: <Gavel className="h-4 w-4" />, roles: ["admin", "secretaria", "cde"] as AppRole[] },
    ],
  },
  {
    id: "configuracoes", label: "Configurações", description: "Regras e cadastros técnicos.",
    icon: <Settings className="h-4 w-4" />,
    items: [
      { label: "Regras do Evento", to: "/admin/regras", icon: <ListTree className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Normalização de Provas", to: "/admin/normalizacao-provas", icon: <Layers className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Locais de Competição", to: "/admin/locais", icon: <MapPin className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Modalidades", to: "/admin/modalidades", icon: <Dumbbell className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Categorias", to: "/admin/categorias", icon: <ListTree className="h-4 w-4" />, roles: ADMIN_ROLES },
    ],
  },
  {
    id: "ajuda", label: "Ajuda", description: "Manual e suporte com IA.",
    icon: <HelpCircle className="h-4 w-4" />,
    items: [
      { label: "Manual de Instruções", to: "/admin/ajuda/manual", icon: <BookOpen className="h-4 w-4" />, roles: "all" },
      { label: "Chat com IA", to: "/admin/ajuda/chat", icon: <Bot className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"] as AppRole[] },
      { label: "Abrir Chamado", to: "/admin/ajuda/chamados", icon: <LifeBuoy className="h-4 w-4" />, roles: "all" },
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
  const strip = (u: string) => u.split("?")[0];
  const routes = group.items.map((i) => strip(i.to));
  if (group.subGroups) {
    group.subGroups.forEach((sg) => sg.items.forEach((i) => routes.push(strip(i.to))));
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
  const { activeEvent } = useEventContext();
  const registrosMode = activeEvent?.registros_mode_enabled || false;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  useMobileBackGuard();

  const isItemVisible = (item: NavItem) => {
    if (item.hideIfRegistrosEnabled && registrosMode) return false;
    if (item.showOnlyIfRegistrosEnabled && !registrosMode) return false;
    return item.roles === "all" || item.roles.some((r) => hasRole(r));
  };

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

  const isStageRoute = location.pathname.includes("/admin/etapa/");
  
  // If we are in a stage route, we render a simpler layout to avoid double headers/sidebars.
  // The StageLayout itself provides its own header, sidebar and sub-navigation.
  if (isStageRoute) {
    return (
      <RequireActiveEvent>
        <NavigationHistoryTracker />
        <Outlet />
        <VersionBadge />
      </RequireActiveEvent>
    );
  }

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
          } ${collapsed ? "w-16" : "w-[86vw] max-w-80 lg:w-64"}`}
        >
          {/* Logo */}
          <div className={`flex h-16 items-center border-b border-sidebar-border ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
            {collapsed ? (
              <img src="/brand/icon-dark.png" alt="JER Gestão" className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <div className="flex items-center gap-2.5">
                <img src="/brand/icon-dark.png" alt="JER Gestão" className="h-8 w-8 rounded-lg object-contain" />
                <span className="font-heading text-base font-bold text-sidebar-foreground">JER Gestão</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button onClick={closeSidebar} className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Event Switcher */}
          <div className={`border-b border-sidebar-border ${collapsed ? "px-2 py-2" : "px-3 py-3"}`}>
            {!collapsed && <EventSwitcher />}
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto py-3 space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
            {isItemVisible(dashboardItem) && !hasRole("coordenador_modalidade") && (
              <NavItemLink item={dashboardItem} collapsed={collapsed} onClick={closeSidebar} />
            )}
            {isItemVisible(coordDashboardItem) && (
              <NavItemLink item={coordDashboardItem} collapsed={collapsed} onClick={closeSidebar} />
            )}

            {/* CTA único: Entrar na Etapa */}
            {(hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica") || hasRole("transporte") || hasRole("alimentacao") || hasRole("coordenador_modalidade")) && (
              collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink
                      to="/admin/etapas"
                      onClick={closeSidebar}
                      className="mt-2 flex items-center justify-center rounded-lg p-2.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-app-sm"
                    >
                      <ListTree className="h-4 w-4" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">Entrar na Etapa</TooltipContent>
                </Tooltip>
              ) : (
                <NavLink
                  to="/admin/etapas"
                  onClick={closeSidebar}
                  className="mt-2 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-app-sm"
                >
                  <ListTree className="h-4 w-4" />
                  Entrar na Etapa
                </NavLink>
              )
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
              <p className="mt-2 text-[10px] text-sidebar-foreground/30 text-center leading-tight">
                Desenvolvido por{" "}
                <a
                  href={brand.developer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-sidebar-foreground/60 transition-colors"
                >
                  {brand.developer.name}
                </a>
              </p>
            </div>
          )}
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 backdrop-blur-md px-3 sm:px-4 lg:h-14 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground lg:hidden transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <h2 className="font-heading text-sm font-semibold text-foreground truncate">
              Plataforma de Gestão do JERs
            </h2>

            <div className="flex-1" />

            <GlobalRefreshButton className="mr-2" />

            <ThemeToggle className="text-muted-foreground" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
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

          <StageFilterBanner />
          <NavigationHistoryTracker />

          <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 lg:pb-6">
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
      <VersionBadge />
    </TooltipProvider>
  );
}

