import React, { useState, useMemo } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStageContext } from "@/contexts/StageContext";
import { usePwaNavigation } from "@/hooks/pwa/usePwaNavigation";
import { PwaHeader } from "./PwaHeader";
import { PwaScreen } from "./PwaScreen";
import { OfflineSyncStatus } from "./OfflineSyncStatus";
import { VersionBadge } from "@/components/VersionBadge";
import { cn } from "@/lib/utils";
import { 
  Home, Scan, Search, History, ClipboardList, Users, 
  Calendar, Bus, Trophy, LayoutDashboard, Radio, LogOut, 
  Menu, ShieldCheck, AlertCircle, Settings
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

interface PwaLayoutProps {
  moduleTitle?: string;
  moduleIcon?: React.ElementType;
  backTo?: string;
  hideFooter?: boolean;
}

export default function PwaLayout({ 
  moduleTitle, 
  moduleIcon, 
  backTo,
  hideFooter = false 
}: PwaLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, roles, profile, signOut, hasRole } = useAuth();
  const { activeStage } = useStageContext();
  const path = location.pathname;

  // Detect which PWA module we are in based on path
  const currentModule = useMemo(() => {
    if (path.startsWith("/pwa/transporte")) return "transporte";
    if (path.startsWith("/pwa/alimentacao")) return "alimentacao";
    if (path.startsWith("/pwa/alojamento")) return "alojamento";
    if (path.startsWith("/pwa/coordenacao-tecnica")) return "coordenacao-tecnica";
    if (path.startsWith("/pwa/delegacao")) return "delegacao";
    if (path.startsWith("/pwa/credenciamento")) return "credenciamento";
    if (path.startsWith("/pwa/resultados")) return "resultados";
    if (path.startsWith("/aovivo")) return "aovivo";
    return null;
  }, [path]);

  const moduleConfig = {
    transporte: { title: "Transporte", icon: Bus, scanTo: "/pwa/transporte/scan", homeTo: "/pwa/transporte" },
    alimentacao: { title: "Alimentação", icon: UtensilsCrossed, scanTo: "/pwa/alimentacao/scan", homeTo: "/pwa/alimentacao" },
    alojamento: { title: "Alojamento", icon: Building, scanTo: "/pwa/alojamento/scan", homeTo: "/pwa/alojamento" },
    "coordenacao-tecnica": { title: "Coordenação", icon: Trophy, homeTo: "/pwa/coordenacao-tecnica", primaryAction: { icon: Search, to: "/pwa/coordenacao-tecnica/consulta", label: "Consultar" } },
    delegacao: { title: "Delegação", icon: Users, homeTo: "/pwa/delegacao" },
    credenciamento: { title: "Credenciamento", icon: IdCard, scanTo: "/pwa/credenciamento/vincular", homeTo: "/pwa/credenciamento" },
    resultados: { title: "Resultados", icon: Award, homeTo: "/pwa/resultados" },
    aovivo: { title: "JER Ao Vivo", icon: Radio, homeTo: "/aovivo" },
  };

  const config = currentModule ? moduleConfig[currentModule as keyof typeof moduleConfig] : null;
  const displayTitle = moduleTitle || config?.title || "JER Gestão";
  const DisplayIcon = moduleIcon || config?.icon;

  // Calculate available modules for switcher
  const availableModules = useMemo(() => {
    const all = [
      { role: "transporte", label: "Transporte", icon: Bus, to: "/pwa/transporte" },
      { role: "alimentacao", label: "Alimentação", icon: UtensilsCrossed, to: "/pwa/alimentacao" },
      { role: "alojamento", label: "Alojamento", icon: Building, to: "/pwa/alojamento" },
      { role: "coordenacao_tecnica", label: "Coord. Técnica", icon: Trophy, to: "/pwa/coordenacao-tecnica" },
      { role: "delegacao", label: "Delegação", icon: Users, to: "/pwa/delegacao" },
      { role: "secretaria", label: "Credenciamento", icon: IdCard, to: "/pwa/credenciamento" },
      { role: "mesario", label: "Ao Vivo", icon: Radio, to: "/aovivo" },
      { role: "arbitragem", label: "Ao Vivo", icon: ShieldCheck, to: "/aovivo" },
    ];
    
    const accessible = all.filter(m => hasRole(m.role as any) || (m.role === "secretaria" && hasRole("admin")));
    // Remove duplicates (like Ao Vivo having two roles)
    const unique = [];
    const seen = new Set();
    for (const m of accessible) {
      if (!seen.has(m.to)) {
        unique.push(m);
        seen.add(m.to);
      }
    }
    return unique;
  }, [roles, hasRole]);

  const showSwitcher = availableModules.length > 1 || hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <PwaScreen noPadding className="min-h-[100dvh]">
      <PwaHeader 
        title={displayTitle} 
        icon={DisplayIcon} 
        backTo={backTo}
        onSignOut={handleSignOut}
      />
      
      <main className={cn("flex-1 overflow-auto", !hideFooter && "pb-24")}>
        <Outlet />
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
                    {(hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica")) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate("/admin")} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer text-blue-600 dark:text-blue-400">
                          <Settings className="h-5 w-5" />
                          <span className="font-bold text-sm">Painel Admin Web</span>
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
    </PwaScreen>
  );
}

function OfflineFooterIndicator() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const update = () => {
      const c = getOfflineQueue().length + getVoucherQueue().filter(v => v.status === "pending").length;
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

// Re-export required icons that were imported but might be needed by other files using this component's config
const UtensilsCrossed = (props: any) => <UtensilsCrossedIcon {...props} />;
import { UtensilsCrossed as UtensilsCrossedIcon, Building, IdCard, Award } from "lucide-react";