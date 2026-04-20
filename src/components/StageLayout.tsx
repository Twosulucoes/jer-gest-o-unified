import { NavLink, Outlet, useLocation, useNavigate, useParams, Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, BadgeCheck, Trophy, Building, UtensilsCrossed, Bus,
  AlertTriangle, ClipboardList, FileBarChart, Layers, Menu, X,
  ChevronsLeft, ChevronsRight, LogOut, User, Home,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { StageProvider } from "@/contexts/StageContext";
import type { EventStage } from "@/contexts/StageContext";
import { StagePageScaffold } from "@/components/admin/stage/StagePageScaffold";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Database } from "@/integrations/supabase/types";
import { NavigationHistoryTracker } from "@/hooks/useNavigationHistory";
import { EtapaSwitcher } from "@/components/navigation/EtapaSwitcher";
import { BackButton } from "@/components/navigation/BackButton";

type AppRole = Database["public"]["Enums"]["app_role"];

interface StageNavItem {
  label: string;
  to: string;          // relativo a /admin/etapa/:stageId
  icon: React.ReactNode;
  roles: AppRole[];
}

const ALL_OPS: AppRole[] = ["admin", "secretaria", "coordenacao_tecnica"];

const STAGE_NAV: StageNavItem[] = [
  { label: "Visão Geral", to: "", icon: <Home className="h-4 w-4" />, roles: [...ALL_OPS, "transporte", "alimentacao"] },
  { label: "Credenciamento", to: "credenciamento", icon: <BadgeCheck className="h-4 w-4" />, roles: ALL_OPS },
  { label: "Competição", to: "competicao", icon: <Trophy className="h-4 w-4" />, roles: [...ALL_OPS, "coordenador_modalidade"] },
  { label: "Alojamento", to: "alojamento", icon: <Building className="h-4 w-4" />, roles: [...ALL_OPS, "alojamento"] },
  { label: "Alimentação", to: "alimentacao", icon: <UtensilsCrossed className="h-4 w-4" />, roles: [...ALL_OPS, "alimentacao"] },
  { label: "Transporte", to: "transporte", icon: <Bus className="h-4 w-4" />, roles: [...ALL_OPS, "transporte"] },
  { label: "Ocorrências", to: "ocorrencias", icon: <AlertTriangle className="h-4 w-4" />, roles: ALL_OPS },
  { label: "Pesquisa de Satisfação", to: "pesquisa", icon: <ClipboardList className="h-4 w-4" />, roles: ALL_OPS },
  { label: "Relatórios da Etapa", to: "relatorios", icon: <FileBarChart className="h-4 w-4" />, roles: ALL_OPS },
];

const KIND_LABELS: Record<string, string> = {
  classificatoria: "Classificatória",
  regional: "Regional",
  final: "Final",
  geral: "Geral",
};

export default function StageLayout() {
  const { stageId } = useParams<{ stageId: string }>();
  const eventId = useActiveEventId();
  const { profile, hasRole, signOut, roles } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { data: stage, isLoading, isError } = useQuery({
    queryKey: ["event_stage", stageId, eventId],
    enabled: !!stageId && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_stages" as never) as any)
        .select("*")
        .eq("id", stageId)
        .eq("event_id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data as EventStage | null;
    },
  });

  const visibleNav = useMemo(
    () => STAGE_NAV.filter((it) => it.roles.some((r) => hasRole(r))),
    [hasRole, roles],
  );

  // Persist last active stage (used by RedirectToEtapas to keep user in context)
  // and emit stage_enter/stage_exit audit events.
  useEffect(() => {
    if (!stage?.id || !eventId) return;
    try { localStorage.setItem("jer_last_active_stage_id", stage.id); } catch {}

    void supabase.from("audit_events").insert({
      action: "stage_enter",
      table_name: "event_stages",
      record_id: stage.id,
      payload: { event_id: eventId, stage_name: stage.name, stage_kind: stage.kind },
    });

    return () => {
      void supabase.from("audit_events").insert({
        action: "stage_exit",
        table_name: "event_stages",
        record_id: stage.id,
        payload: { event_id: eventId, stage_name: stage.name },
      });
    };
  }, [stage?.id, eventId, stage?.name, stage?.kind]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <h2 className="text-lg font-semibold">Erro ao carregar etapa</h2>
        <p className="text-sm text-muted-foreground">Não foi possível carregar os dados desta etapa.</p>
        <Button asChild><Link to="/admin/etapas">← Voltar para Etapas</Link></Button>
      </div>
    );
  }

  if (!stage) {
    return <Navigate to="/admin/etapas" replace />;
  }

  if (visibleNav.length <= 1) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <h2 className="text-lg font-semibold">Sem permissão</h2>
        <p className="text-sm text-muted-foreground">Seu perfil não tem acesso aos módulos desta etapa.</p>
        <Button asChild><Link to="/admin">← Voltar ao Geral</Link></Button>
      </div>
    );
  }

  const basePath = `/admin/etapa/${stage.id}`;
  const closeSidebar = () => setSidebarOpen(false);
  const primaryRole = roles[0];

  return (
    <StageProvider>
      <TooltipProvider delayDuration={200}>
        <div className="flex min-h-screen bg-background">
          {sidebarOpen && (
            <div className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={closeSidebar} />
          )}

          <aside
            className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } ${collapsed ? "w-16" : "w-[86vw] max-w-80 lg:w-64"}`}
          >
            {/* Brand + close on mobile */}
            <div className={`flex h-16 items-center border-b border-sidebar-border ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}>
              {collapsed ? (
                <Layers className="h-6 w-6 text-sidebar-primary" />
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="h-5 w-5 text-sidebar-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 leading-none">Etapa</p>
                    <p className="font-semibold text-sm text-sidebar-foreground truncate">{stage.name}</p>
                  </div>
                </div>
              )}
              <button onClick={closeSidebar} className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Voltar ao Geral — botão DEDICADO e sempre visível */}
            <div className={`border-b border-sidebar-border ${collapsed ? "p-2" : "p-3"}`}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate("/admin")}
                      className="w-full flex items-center justify-center rounded-lg p-2.5 bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Voltar ao Geral</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={() => navigate("/admin")}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao Geral
                </button>
              )}
            </div>

            {/* Stage status badge (only when expanded) */}
            {!collapsed && (
              <div className="px-3 pt-3 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {KIND_LABELS[stage.kind] ?? stage.kind}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {stage.status}
                  </Badge>
                </div>
              </div>
            )}

            {/* Nav */}
            <nav className={`flex-1 overflow-y-auto py-3 space-y-0.5 ${collapsed ? "px-2" : "px-3"}`}>
              {visibleNav.map((item) => {
                const to = item.to ? `${basePath}/${item.to}` : basePath;
                const node = (
                  <NavLink
                    key={to}
                    to={to}
                    end={item.to === ""}
                    onClick={closeSidebar}
                    className={({ isActive }) =>
                      collapsed
                        ? `flex items-center justify-center rounded-lg p-2.5 transition-colors ${
                            isActive
                              ? "bg-sidebar-accent text-sidebar-primary"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          }`
                        : `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-sidebar-accent text-sidebar-primary shadow-app-sm"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          }`
                    }
                  >
                    {item.icon}
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
                return collapsed ? (
                  <Tooltip key={to}>
                    <TooltipTrigger asChild>{node}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  node
                );
              })}
            </nav>

            {/* Collapse toggle */}
            <div className="hidden lg:flex border-t border-sidebar-border p-2 justify-center">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="rounded-lg p-2 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
                aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              >
                {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* User footer */}
            {!collapsed && (
              <div className="border-t border-sidebar-border p-3">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile?.full_name || "Usuário"}
                </p>
                {primaryRole && (
                  <p className="text-xs text-sidebar-primary/80 mb-2">{primaryRole}</p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  className="w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </Button>
              </div>
            )}
          </aside>

          {/* Main */}
          <div className="flex flex-1 flex-col min-w-0">
            <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 backdrop-blur-md px-3 sm:px-4 lg:h-14 lg:px-6">
              <button
                onClick={() => setSidebarOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Contexto sempre visível */}
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="default" className="shrink-0">Etapa</Badge>
                <span className="font-semibold text-sm truncate">{stage.name}</span>
                <Badge variant="outline" className="hidden sm:inline-flex text-[10px]">{stage.status}</Badge>
              </div>

              <div className="flex-1" />

              <EtapaSwitcher className="hidden md:inline-flex" />

              <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="hidden lg:inline-flex">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Geral
              </Button>

              <ThemeToggle className="text-muted-foreground" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20">
                    <User className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium truncate">{profile?.full_name || "Usuário"}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Geral</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>

            <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 lg:pb-6">
              <NavigationHistoryTracker />
              <StageWrappedOutlet key={location.pathname} />
            </main>
          </div>
        </div>
      </TooltipProvider>
    </StageProvider>
  );
}

/**
 * Envolve cada rota filha do StageLayout com o scaffold de etapa
 * (mini-dash + tabs do módulo). Para a Visão Geral (rota índice) e
 * páginas de detalhe (ex.: partida/:matchId, embarque/:tripId),
 * o scaffold se omite/oculta as tabs automaticamente.
 */
function StageWrappedOutlet() {
  const location = useLocation();
  const { stageId } = useParams<{ stageId: string }>();

  const base = `/admin/etapa/${stageId}`;
  const isHome = location.pathname === base || location.pathname === `${base}/`;
  // páginas de detalhe não devem mostrar as tabs
  const isDetail = /\/(partida|embarque|form|pessoa)\/[^/]+/.test(location.pathname);

  if (isHome) {
    // A home já é uma página de visão geral própria — não envolve.
    return <Outlet />;
  }

  return (
    <StagePageScaffold hideTabs={isDetail}>
      <Outlet />
    </StagePageScaffold>
  );
}
