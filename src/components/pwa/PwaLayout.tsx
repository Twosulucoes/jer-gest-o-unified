/**
 * PWA Layout Component for JER Gestão.
 * Provides the mobile-first shell for operational modules (Transport, Food, Lodging, etc.).
 * Includes a contextual bottom navigation bar, header with module-specific actions,
 * and offline synchronization indicators.
 */
import React, { useState, useMemo, useEffect, useContext } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStageContext } from "@/contexts/StageContext";
import { useEventContext } from "@/contexts/EventContext";
import { getModuleByPath, APP_MODULES } from "@/constants/modules";

import { usePwaNavigation } from "@/hooks/pwa/usePwaNavigation";
import { PwaHeader } from "./PwaHeader";
import { PwaScreen } from "./PwaScreen";
import { OfflineSyncStatus } from "./OfflineSyncStatus";
import { VersionBadge } from "@/components/VersionBadge";
import { cn } from "@/lib/utils";
import {
  Home, Scan, Search, History, ClipboardList, Users,
  Calendar, Bus, Trophy, LayoutDashboard, Radio, LogOut,
  Menu, ShieldCheck, AlertCircle, Settings, Layers, Plus,
  UtensilsCrossed, Building, IdCard, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { getOfflineQueue } from "@/lib/offlineQueue";
import { getVoucherQueue } from "@/lib/voucherOffline";
import { getAlojamentoQueue } from "@/hooks/useAlojamentoOffline";
import { PwaLayoutCtx, type PwaLayoutCtxValue } from "./PwaLayoutContext";
import { logPwaEvent } from "@/utils/pwaTelemetry";


interface PwaLayoutProps {
  moduleTitle?: string;
  moduleIcon?: React.ElementType;
  backTo?: string;
  hideFooter?: boolean;
  onBack?: () => void;
  children?: React.ReactNode;
}

export default function PwaLayout({
  moduleTitle,
  moduleIcon,
  backTo,
  hideFooter = false,
  onBack,
  children
}: PwaLayoutProps) {
  const parentCtx = useContext(PwaLayoutCtx);
  const location = useLocation();
  const navigate = useNavigate();

  // Override state for when a nested layout/header pushes config up
  const [titleOverride, setTitleOverride] = useState<string | undefined>(undefined);
  const [iconOverride, setIconOverride] = useState<React.ElementType | undefined>(undefined);
  const [backToOverride, setBackToOverride] = useState<string | undefined>(undefined);
  const [onBackOverride, setOnBackOverride] = useState<(() => void) | undefined>(undefined);
  const { user, roles, profile, signOut, hasRole } = useAuth();
  const { activeStage } = useStageContext();
  const { activeEvent } = useEventContext();
  const registrosMode = activeEvent?.registros_mode_enabled || false;

  const path = location.pathname;

  // Detect which PWA module we are in based on central mapping
  const currentModule = useMemo(() => {
    const moduleId = getModuleByPath(path);
    return moduleId === "other" ? null : moduleId;
  }, [path]);

  const moduleConfig = {
    transporte: { title: "Transporte", icon: Bus, scanTo: "/pwa/transporte/scan", homeTo: "/pwa/transporte" },
    alimentacao: { title: "Alimentação", icon: UtensilsCrossed, scanTo: "/pwa/alimentacao/scan", homeTo: "/pwa/alimentacao" },
    alojamento: { title: "Alojamento", icon: Building, scanTo: "/pwa/alojamento/scan", homeTo: "/pwa/alojamento" },
    "coordenacao-tecnica": { title: "Coordenação", icon: Trophy, homeTo: "/pwa/coordenacao-tecnica", primaryAction: { icon: Search, to: "/pwa/coordenacao-tecnica/consulta", label: "Consultar" } },
    delegacao: { title: "Delegação", icon: Users, homeTo: "/pwa/delegacao" },
    arbitragem: { title: "Arbitragem", icon: ShieldCheck, homeTo: "/pwa/arbitragem", primaryAction: { icon: Calendar, to: "/pwa/arbitragem/agenda", label: "Agenda" } },
    credenciamento: { title: "Credenciamento", icon: IdCard, scanTo: "/pwa/credenciamento/vincular", homeTo: "/pwa/credenciamento" },
    resultados: { title: "Resultados", icon: Award, homeTo: "/pwa/resultados" },
    registros: { title: "Registros", icon: Trophy, homeTo: "/pwa/registros", primaryAction: { icon: Plus, to: "/pwa/registros", label: "Novo" } },
    aovivo: { title: "JER Ao Vivo", icon: Radio, homeTo: "/aovivo" },
  };

  const config = currentModule ? moduleConfig[currentModule as keyof typeof moduleConfig] : null;
  const displayTitle = titleOverride ?? moduleTitle ?? config?.title ?? "JER Gestão";
  const DisplayIcon = iconOverride ?? moduleIcon ?? config?.icon;

  // Calculate available modules for switcher
  const availableModules = useMemo(() => {
    const all = [
      { role: "transporte", label: "Transporte", icon: Bus, to: "/pwa/transporte" },
      { role: "alimentacao", label: "Alimentação", icon: UtensilsCrossed, to: "/pwa/alimentacao" },
      { role: "alojamento", label: "Alojamento", icon: Building, to: "/pwa/alojamento" },
      { role: "coordenacao_tecnica", label: "Coord. Técnica", icon: Trophy, to: "/pwa/coordenacao-tecnica" },
      { role: "delegacao", label: "Delegação", icon: Users, to: "/pwa/delegacao" },
      { role: "secretaria", label: "Credenciamento", icon: IdCard, to: "/pwa/credenciamento/vincular" },
      { role: "mesario", label: "Ao Vivo", icon: Radio, to: "/aovivo" },
      { role: "mesario", label: "Registros", icon: Trophy, to: "/pwa/registros", showOnlyIfRegistrosEnabled: true },
      { role: "arbitragem", label: "Arbitragem", icon: ShieldCheck, to: "/pwa/arbitragem" },
      { role: "arbitragem", label: "Ao Vivo", icon: Radio, to: "/pwa/resultados" },
    ] as const;
    
    const isSuperOrAdmin = hasRole("admin") || hasRole("super_admin");
    
    const accessible = all.filter(m => {
      if ('showOnlyIfRegistrosEnabled' in m && m.showOnlyIfRegistrosEnabled && !registrosMode) return false;
      return hasRole(m.role as any) || isSuperOrAdmin;
    });

    // Remove duplicates based on URL
    const seen = new Set<string>();
    return accessible.filter(m => {
      if (seen.has(m.to)) return false;
      seen.add(m.to);
      return true;
    });
  }, [hasRole, registrosMode]);

  // Show switcher if user has multiple modules OR if they need to be able to switch stages (always true in PWA)
  const showSwitcher = true;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  // If we're nested inside another PwaLayout, communicate our config upward and skip chrome
  const outerCtx = useContext(PwaLayoutCtx);
  useEffect(() => {
    // Telemetry: Log if we are in a /pwa route but no module was identified
    // (Excluding landing page and common pages)
    if (path.startsWith("/pwa") && 
        path !== "/pwa" && 
        path !== "/pwa/" && 
        !path.startsWith("/pwa/configuracao") && 
        !path.startsWith("/pwa/install") && 
        !currentModule) {
      logPwaEvent({
        action: "route_not_found",
        reason: "Module not identified in PwaLayout",
        metadata: { path },
        event_id: activeEvent?.id,
        stage_id: activeStage?.id
      });

    }

    if (!outerCtx.isActive) return;
    outerCtx.setTitle(moduleTitle);
    outerCtx.setIcon(moduleIcon);
    outerCtx.setBackTo(backTo);
    outerCtx.setOnBack(onBack);
    return () => {
      outerCtx.setTitle(undefined);
      outerCtx.setIcon(undefined);
      outerCtx.setBackTo(undefined);
      outerCtx.setOnBack(undefined);
    };
  }, [outerCtx.isActive, moduleTitle, moduleIcon, backTo, onBack, path, currentModule]);


  const ownCtxValue = useMemo<PwaLayoutCtxValue>(() => ({
    isActive: true,
    setTitle: setTitleOverride,
    setIcon: setIconOverride,
    setBackTo: setBackToOverride,
    setOnBack: (f) => setOnBackOverride(() => f),
  }), []);

  if (outerCtx.isActive) {
    // Already inside a PwaLayout — skip chrome, just render content
    return <PwaLayoutCtx.Provider value={ownCtxValue}>{children || <Outlet />}</PwaLayoutCtx.Provider>;
  }

  return (
    <PwaScreen noPadding className="min-h-[100dvh]">
      {path !== "/pwa" && path !== "/pwa/" && (
        <PwaHeader
          title={displayTitle}
          icon={DisplayIcon}
          backTo={backToOverride ?? backTo}
          onBack={onBackOverride ?? onBack}
          onSignOut={handleSignOut}
        />
      )}
      <PwaLayoutCtx.Provider value={ownCtxValue}>
        {/* Banner de Etapa Ativa para segurança operacional (Alojamento/Alimentação) */}
        {(currentModule === "alojamento" || currentModule === "alimentacao") && activeStage && (
          <div className="sticky top-14 z-10 bg-amber-500/20 dark:bg-amber-500/10 border-b border-amber-500/40 px-4 py-2.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-amber-800 dark:text-amber-400 backdrop-blur-md shadow-sm">
            <div className="flex items-center gap-2 truncate mr-3">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-500">
                <Layers className="h-3 w-3" />
              </div>
              <span className="truncate">
                ETAPA: <span className="font-black text-amber-900 dark:text-amber-300">{activeStage.name}</span>
              </span>
            </div>
            <div className="shrink-0 flex items-center gap-1 font-mono text-[9px] font-bold opacity-90 bg-background/60 dark:bg-black/30 px-2 py-0.5 rounded border border-amber-500/30 tabular-nums text-amber-900 dark:text-amber-200">
              <span className="opacity-50 font-normal">ID:</span>
              <span>{activeStage.id.slice(0, 8)}</span>
            </div>
          </div>
        )}
        <main className={cn("flex-1 overflow-auto", !hideFooter && "pb-24")}>
          {children || <Outlet />}
        </main>

      {!hideFooter && (
        <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_10px_rgba(0,0,0,0.1)]">
          <div className="mx-auto flex h-20 max-w-md items-center justify-between px-4">
            
            {/* Left Zone: Offline & Home */}
            <div className="flex items-center gap-4 flex-1">
              <OfflineFooterIndicator />
              <Link 
                to={config?.homeTo || "/pwa"} 
                className={cn(
                  "flex flex-col items-center gap-1 transition-all active:scale-90",
                  path === config?.homeTo ? "text-module" : "text-muted-foreground"
                )}
              >
                <Home className="h-6 w-6" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Home</span>
              </Link>
            </div>

            {/* Central Zone: Primary Action (Scanner) */}
            <div className="relative -top-4 px-2">
              <PrimaryActionButton config={config} />
            </div>

            {/* Right Zone: Switcher & Conflict */}
            <div className="flex items-center gap-4 flex-1 justify-end">
              {showSwitcher && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex flex-col items-center gap-1 text-muted-foreground transition-all active:scale-90">
                      <LayoutDashboard className="h-6 w-6" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Trocar</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-app-lg">
                    <DropdownMenuLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-3 py-2">
                      Módulos Disponíveis
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableModules.map(m => (
                      <DropdownMenuItem 
                        key={m.to} 
                        onClick={() => navigate(m.to)}
                        className={cn("flex items-center gap-3 p-3 rounded-xl cursor-pointer", path.startsWith(m.to) && "bg-module-soft text-module")}
                      >
                        <m.icon className="h-5 w-5" />
                        <span className="font-bold text-sm">{m.label}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => navigate("/pwa/configuracao", { state: { from: location } })}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer text-amber-600 dark:text-amber-400"
                    >
                      <Layers className="h-5 w-5" />
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">Trocar Etapa</span>
                        <span className="text-[10px] opacity-80 uppercase font-black">{activeStage?.name || "Nenhuma Selecionada"}</span>
                      </div>
                    </DropdownMenuItem>
                    {(hasRole("admin") || hasRole("super_admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica")) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate("/admin")} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer text-indigo-600 dark:text-indigo-400">
                          <LayoutDashboard className="h-5 w-5" />
                          <span className="font-bold text-sm">Painel Administrativo</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <ConflictFooterIndicator />
            </div>

          </div>
        </footer>
      )}
      
      <VersionBadge />
      </PwaLayoutCtx.Provider>
    </PwaScreen>
  );
}

function OfflineFooterIndicator() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const update = () => {
      const c = getOfflineQueue().filter(i => i.status === "pending" || i.status === "failed").length + 
                getVoucherQueue().filter(v => v.status === "pending" || v.status === "failed").length +
                getAlojamentoQueue().filter(a => a.status === "pending" || a.status === "failed").length;
      setCount(c);
    };
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return <div className="w-6" />;

  return (
    <button className="flex flex-col items-center gap-1 text-amber-500 animate-pulse transition-all active:scale-90">
      <div className="relative">
        <History className="h-6 w-6" />
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white ring-2 ring-background">
          {count}
        </span>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter">Sync</span>
    </button>
  );
}

function ConflictFooterIndicator() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const update = () => {
      const c = getVoucherQueue().filter(v => v.status === "conflict").length;
      setCount(c);
    };
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return <div className="w-6" />;

  return (
    <button className="flex flex-col items-center gap-1 text-destructive animate-bounce transition-all active:scale-90">
      <div className="relative">
        <AlertCircle className="h-6 w-6" />
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-black text-white ring-2 ring-background">
          {count}
        </span>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter">Erro</span>
    </button>
  );
}

function PrimaryActionButton({ config }: { config: any }) {
  const navigate = useNavigate();
  
  if (!config) return null;

  const Icon = config.scanTo ? Scan : (config.primaryAction?.icon || Scan);
  const to = config.scanTo || config.primaryAction?.to || config.homeTo;
  const label = config.scanTo ? "Scan" : (config.primaryAction?.label || "Ação");

  return (
    <Button 
      size="icon" 
      onClick={() => navigate(to)}
      className="h-16 w-16 rounded-full bg-module text-white shadow-xl shadow-module/40 border-4 border-background transition-all active:scale-90 hover:scale-105"
    >
      <div className="flex flex-col items-center">
        <Icon className="h-7 w-7" />
        <span className="text-[8px] font-black uppercase tracking-widest mt-0.5">{label}</span>
      </div>
    </Button>
  );
}

