import { NavLink, Outlet, useLocation } from "react-router-dom";
import EventSwitcher from "@/components/admin/EventSwitcher";
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
  Users,
  Upload,
  UserCheck,
  ScanLine,
  Bus,
  Route,
  Navigation,
  UtensilsCrossed,
  Clock,
  ClipboardList,
  Building,
  DoorOpen,
  KeyRound,
  Trophy,
  Swords,
  CalendarDays,
  Layers,
  UsersRound,
  IdCard,
  ChevronDown,
  Shield,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  items: NavItem[];
  subGroups?: { label: string; items: NavItem[] }[];
}

const ADMIN_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica"];
const TRANSPORT_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "transporte"];
const FOOD_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica", "alimentacao"];
const LODGING_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica"];
const COMPETITION_ROLES: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica"];

// Dashboard — always visible, outside groups
const dashboardItem: NavItem = {
  label: "Dashboard",
  to: "/admin",
  icon: <LayoutDashboard className="h-4 w-4" />,
  roles: "all",
};

const navGroups: NavGroup[] = [
  {
    id: "preparacao",
    label: "Preparação",
    items: [
      { label: "Eventos", to: "/admin/eventos", icon: <Calendar className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Instituições", to: "/admin/instituicoes", icon: <Building2 className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Delegações", to: "/admin/delegacoes", icon: <Users className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Importação", to: "/admin/importacao", icon: <Upload className="h-4 w-4" />, roles: ["admin", "secretaria"] },
      { label: "Participantes", to: "/admin/participantes", icon: <UsersRound className="h-4 w-4" />, roles: ADMIN_ROLES },
    ],
  },
  {
    id: "credenciamento",
    label: "Credenciamento",
    items: [
      { label: "Credenciamento", to: "/admin/credenciamento", icon: <UserCheck className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Modelos de Credencial", to: "/admin/credenciais/modelos", icon: <IdCard className="h-4 w-4" />, roles: ADMIN_ROLES },
      { label: "Validação QR", to: "/admin/validacao-qr", icon: <ScanLine className="h-4 w-4" />, roles: ["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao"] },
    ],
  },
  {
    id: "competicao",
    label: "Competição",
    items: [
      { label: "Modalidades", to: "/admin/modalidades", icon: <Dumbbell className="h-4 w-4" />, roles: COMPETITION_ROLES },
      { label: "Categorias", to: "/admin/categorias", icon: <ListTree className="h-4 w-4" />, roles: COMPETITION_ROLES },
      { label: "Fases", to: "/admin/competicao/fases", icon: <Trophy className="h-4 w-4" />, roles: COMPETITION_ROLES },
      { label: "Grupos", to: "/admin/competicao/grupos", icon: <Layers className="h-4 w-4" />, roles: COMPETITION_ROLES },
      { label: "Equipes", to: "/admin/competicao/equipes", icon: <UsersRound className="h-4 w-4" />, roles: COMPETITION_ROLES },
      { label: "Partidas", to: "/admin/competicao/partidas", icon: <Swords className="h-4 w-4" />, roles: COMPETITION_ROLES },
      { label: "Agenda", to: "/admin/competicao/agenda", icon: <CalendarDays className="h-4 w-4" />, roles: COMPETITION_ROLES },
      { label: "Resultados", to: "/admin/competicao/resultados", icon: <ClipboardList className="h-4 w-4" />, roles: COMPETITION_ROLES },
    ],
  },
  {
    id: "logistica",
    label: "Logística",
    items: [],
    subGroups: [
      {
        label: "Transporte",
        items: [
          { label: "Veículos", to: "/admin/transporte/veiculos", icon: <Bus className="h-4 w-4" />, roles: TRANSPORT_ROLES },
          { label: "Rotas", to: "/admin/transporte/rotas", icon: <Route className="h-4 w-4" />, roles: TRANSPORT_ROLES },
          { label: "Viagens", to: "/admin/transporte/viagens", icon: <Navigation className="h-4 w-4" />, roles: TRANSPORT_ROLES },
        ],
      },
      {
        label: "Alimentação",
        items: [
          { label: "Refeições", to: "/admin/alimentacao/tipos", icon: <UtensilsCrossed className="h-4 w-4" />, roles: FOOD_ROLES },
          { label: "Janelas", to: "/admin/alimentacao/janelas", icon: <Clock className="h-4 w-4" />, roles: FOOD_ROLES },
          { label: "Consumo", to: "/admin/alimentacao/consumo", icon: <ClipboardList className="h-4 w-4" />, roles: FOOD_ROLES },
        ],
      },
      {
        label: "Alojamento",
        items: [
          { label: "Locais de Alojamento", to: "/admin/alojamento/locais", icon: <Building className="h-4 w-4" />, roles: LODGING_ROLES },
          { label: "Unidades do alojamento", to: "/admin/alojamento/unidades", icon: <DoorOpen className="h-4 w-4" />, roles: LODGING_ROLES },
          { label: "Ocupação", to: "/admin/alojamento/ocupacao", icon: <KeyRound className="h-4 w-4" />, roles: LODGING_ROLES },
        ],
      },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    items: [
      { label: "Locais de competição", to: "/admin/locais", icon: <MapPin className="h-4 w-4" />, roles: ADMIN_ROLES },
    ],
  },
  {
    id: "acessos",
    label: "Acessos",
    items: [
      { label: "Vínculos Delegação", to: "/admin/acessos/delegacoes", icon: <Shield className="h-4 w-4" />, roles: ["admin", "secretaria"] as AppRole[] },
    ],
  },
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

function getAllGroupRoutes(group: NavGroup): string[] {
  const routes = group.items.map((i) => i.to);
  if (group.subGroups) {
    group.subGroups.forEach((sg) => sg.items.forEach((i) => routes.push(i.to)));
  }
  return routes;
}

function NavItemLink({
  item,
  onClick,
}: {
  item: NavItem;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/admin"}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        }`
      }
    >
      {item.icon}
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export default function AdminLayout() {
  const { profile, roles, signOut, hasRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
          <span className="font-heading text-lg font-bold text-sidebar-primary">JER Gestão</span>
          <button onClick={closeSidebar} className="lg:hidden text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {/* Event Switcher */}
          <EventSwitcher />
          <div className="border-b border-sidebar-border mx-3 mb-2" />

          {/* Dashboard — always on top */}
          {isItemVisible(dashboardItem) && (
            <NavItemLink item={dashboardItem} onClick={closeSidebar} />
          )}

          {/* Groups */}
          {navGroups.filter(isGroupVisible).map((group) => (
            <Collapsible
              key={group.id}
              defaultOpen={activeGroupId === group.id}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 mt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground/80 transition-colors">
                {group.label}
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-0.5">
                {/* Direct items */}
                {group.items.filter(isItemVisible).map((item) => (
                  <NavItemLink key={item.to} item={item} onClick={closeSidebar} />
                ))}

                {/* Sub-groups (Logística) */}
                {group.subGroups?.map((subGroup) => {
                  const visibleItems = subGroup.items.filter(isItemVisible);
                  if (visibleItems.length === 0) return null;
                  return (
                    <div key={subGroup.label}>
                      <p className="mt-2 mb-0.5 px-3 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
                        {subGroup.label}
                      </p>
                      {visibleItems.map((item) => (
                        <NavItemLink key={item.to} item={item} onClick={closeSidebar} />
                      ))}
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </nav>

        {/* User footer */}
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
