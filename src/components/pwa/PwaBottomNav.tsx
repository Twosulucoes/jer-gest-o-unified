import { Home, Scan, Search, History, ClipboardList, Users, Calendar, Bus, Trophy, LayoutDashboard, Radio, LogOut } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useStageContext } from "@/contexts/StageContext";
import { useEventContext } from "@/contexts/EventContext";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  match?: string; // Prefix to match for active state
  requireStage?: boolean;
}

export function PwaBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { activeStageId } = useStageContext();
  const { activeEventId } = useEventContext();

  const getModuleConfig = (): { items: NavItem[] } => {
    if (path.startsWith("/pwa/transporte")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/transporte", requireStage: true },
          { label: "Viagens", icon: Bus, path: "/pwa/transporte/viagens", requireStage: true },
          { label: "Scan", icon: Scan, path: "/pwa/transporte/scan", requireStage: true },
          { label: "Rotas", icon: ClipboardList, path: "/pwa/transporte/rotas", requireStage: true },
        ],
      };
    }
    if (path.startsWith("/pwa/alimentacao")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/alimentacao", requireStage: true },
          { label: "Scan", icon: Scan, path: "/pwa/alimentacao/scan", requireStage: true },
          { label: "Buscar", icon: Search, path: "/pwa/alimentacao/buscar", requireStage: true },
          { label: "Histórico", icon: History, path: "/pwa/alimentacao/historico", requireStage: true },
        ],
      };
    }
    if (path.startsWith("/pwa/alojamento")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/alojamento", requireStage: true },
          { label: "Scan", icon: Scan, path: "/pwa/alojamento/scan", requireStage: true },
          { label: "Buscar", icon: Search, path: "/pwa/alojamento/buscar", requireStage: true },
          { label: "Incidentes", icon: ClipboardList, path: "/pwa/alojamento/incidentes", requireStage: true },
        ],
      };
    }
    if (path.startsWith("/pwa/coordenacao-tecnica")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/coordenacao-tecnica", requireStage: true },
          { label: "Agenda", icon: Calendar, path: "/pwa/coordenacao-tecnica/agenda", requireStage: true },
          { label: "Resultados", icon: Trophy, path: "/pwa/coordenacao-tecnica/resultados", requireStage: true },
          { label: "Incidentes", icon: ClipboardList, path: "/pwa/coordenacao-tecnica/incidentes", requireStage: true },
        ],
      };
    }
    if (path.startsWith("/pwa/delegacao")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/delegacao", requireStage: true },
          { label: "Agenda", icon: Calendar, path: "/pwa/delegacao/agenda", requireStage: true },
          { label: "Membros", icon: Users, path: "/pwa/delegacao/participantes", requireStage: true },
          { label: "Logística", icon: Bus, path: "/pwa/delegacao/logistica", requireStage: true },
        ],
      };
    }
    if (path.startsWith("/pwa/credenciamento")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/credenciamento", requireStage: true },
          { label: "Vincular", icon: Scan, path: "/pwa/credenciamento/vincular", requireStage: true },
          { label: "Busca", icon: Search, path: "/pwa/credenciamento/busca", requireStage: true },
        ],
      };
    }
    if (path.startsWith("/pwa/pesquisa")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/pesquisa", requireStage: true },
          { label: "Eventos", icon: Trophy, path: "/pwa/pesquisa/eventos", requireStage: true },
          { label: "Sincronizar", icon: History, path: "/pwa/pesquisa/sync", requireStage: true },
        ],
      };
    }
    if (path.startsWith("/aovivo")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/aovivo" },
          { label: "Partidas", icon: Radio, path: "/aovivo" },
          { label: "Sair", icon: LogOut, path: "/login" },
        ],
      };
    }

    // Default or Landing Page
    return {
      items: [
        { label: "Módulos", icon: LayoutDashboard, path: "/pwa" },
        { label: "Admin", icon: Trophy, path: "/admin" },
      ],
    };
  };

  const { items } = getModuleConfig();

  const handleNavigate = (e: React.MouseEvent, item: NavItem) => {
    if (item.requireStage && (!activeStageId || !activeEventId)) {
      e.preventDefault();
      navigate("/pwa/configuracao", { 
        state: { 
          from: { pathname: item.path }, 
          reason: !activeEventId ? "missing_event" : "missing_stage" 
        } 
      });
      return;
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {items.map((item) => {
          const isActive = path === item.path || (item.path !== "/pwa" && path.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={(e) => handleNavigate(e, item)}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-1 transition-all active:scale-95",
                isActive ? "text-module" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
              <span className={cn("text-[10px] font-medium tracking-tight", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 h-1 w-1 rounded-full bg-module" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
