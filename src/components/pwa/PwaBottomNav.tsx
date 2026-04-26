import { Home, Scan, Search, History, ClipboardList, Users, Calendar, Bus, Trophy, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  match?: string; // Prefix to match for active state
}

export function PwaBottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const getModuleConfig = (): { items: NavItem[] } => {
    if (path.startsWith("/pwa/transporte")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/transporte" },
          { label: "Viagens", icon: Bus, path: "/pwa/transporte/viagens" },
          { label: "Scan", icon: Scan, path: "/pwa/transporte/scan" },
          { label: "Rotas", icon: ClipboardList, path: "/pwa/transporte/rotas" },
        ],
      };
    }
    if (path.startsWith("/pwa/alimentacao")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/alimentacao" },
          { label: "Scan", icon: Scan, path: "/pwa/alimentacao/scan" },
          { label: "Buscar", icon: Search, path: "/pwa/alimentacao/buscar" },
          { label: "Histórico", icon: History, path: "/pwa/alimentacao/historico" },
        ],
      };
    }
    if (path.startsWith("/pwa/alojamento")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/alojamento" },
          { label: "Scan", icon: Scan, path: "/pwa/alojamento/scan" },
          { label: "Buscar", icon: Search, path: "/pwa/alojamento/buscar" },
          { label: "Incidentes", icon: ClipboardList, path: "/pwa/alojamento/incidentes" },
        ],
      };
    }
    if (path.startsWith("/pwa/coordenacao-tecnica")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/coordenacao-tecnica" },
          { label: "Agenda", icon: Calendar, path: "/pwa/coordenacao-tecnica/agenda" },
          { label: "Resultados", icon: Trophy, path: "/pwa/coordenacao-tecnica/resultados" },
          { label: "Incidentes", icon: ClipboardList, path: "/pwa/coordenacao-tecnica/incidentes" },
        ],
      };
    }
    if (path.startsWith("/pwa/delegacao")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/delegacao" },
          { label: "Agenda", icon: Calendar, path: "/pwa/delegacao/agenda" },
          { label: "Membros", icon: Users, path: "/pwa/delegacao/participantes" },
          { label: "Logística", icon: Bus, path: "/pwa/delegacao/logistica" },
        ],
      };
    }
    if (path.startsWith("/pwa/credenciamento")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/credenciamento" },
          { label: "Vincular", icon: Scan, path: "/pwa/credenciamento/vincular" },
          { label: "Busca", icon: Search, path: "/pwa/credenciamento/busca" },
        ],
      };
    }
    if (path.startsWith("/pwa/pesquisa")) {
      return {
        items: [
          { label: "Início", icon: Home, path: "/pwa/pesquisa" },
          { label: "Eventos", icon: Trophy, path: "/pwa/pesquisa/eventos" },
          { label: "Sincronizar", icon: History, path: "/pwa/pesquisa/sync" },
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

  // Se o caminho for exatamente /pwa ou selecionar-modulo, podemos querer um comportamento diferente
  // Mas vamos manter a consistência por enquanto.

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {items.map((item) => {
          const isActive = path === item.path || (item.path !== "/pwa" && path.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
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
