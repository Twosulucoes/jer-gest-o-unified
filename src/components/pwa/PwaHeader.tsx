import { ArrowLeft, LogOut, ArrowLeftRight, Layers } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getPwaLang, setPwaLang } from "@/lib/systemMessages";
import { useStageContext } from "@/contexts/StageContext";
import { usePwaNavigation, type PwaModule } from "@/hooks/pwa/usePwaNavigation";
import { PwaRefreshButton } from "./PwaRefreshButton";

interface PwaHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  backTo?: string;
  onBack?: () => void;
  onSignOut?: () => void;
  rightSlot?: React.ReactNode;
  /** Segunda linha sticky abaixo do header — para botões operacionais (Scan, Manual, Finalizar, etc.) */
  actionsBar?: React.ReactNode;
}

export function PwaHeader({ title, subtitle, icon: Icon, backTo, onBack, onSignOut, rightSlot, actionsBar }: PwaHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { roles } = useAuth();
  const { activeStage } = useStageContext();
  const { navigateToPwa } = usePwaNavigation();
  const showSwitcher = false; // Layout Switcher will be in the Footer

  const handleBack = () => {
    if (onBack) onBack();
    else if (backTo) {
      if (backTo.startsWith("/pwa/") && 
          backTo !== "/pwa/configuracao" && 
          backTo !== "/pwa/install") {
        const moduleMatch = backTo.match(/\/pwa\/([^/]+)/);
        const module = moduleMatch ? moduleMatch[1] as PwaModule : "configuracao" as PwaModule;
        const subPath = backTo.replace(`/pwa/${module}`, "");
        
        navigateToPwa(module, subPath);
      } else {
        navigate(backTo);
      }
    }
    else navigate(-1);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--module-accent) / 0.85), transparent)",
        }}
      />
      <div className="relative flex items-center justify-between gap-2 px-4 h-14">
        <div className="flex min-w-0 items-center gap-3">
          {(backTo || onBack) && (
            <button
              onClick={handleBack}
              className="-ml-2 flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-module-soft text-module">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-heading text-base font-bold tracking-tight text-foreground">
              {title}
            </p>
            {(subtitle || activeStage) && (
              <button 
                onClick={() => navigate("/pwa/configuracao", { state: { from: location } })}
                className="truncate text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors active:scale-95"
              >
                {activeStage && (
                  <>
                    <Layers className="h-2.5 w-2.5 inline shrink-0" />
                    <span className="font-bold">{activeStage.name}</span>
                    {subtitle && <span className="mx-1 opacity-40">•</span>}
                  </>
                )}
                {subtitle}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <PwaRefreshButton />
          {rightSlot}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const current = getPwaLang();
              setPwaLang(current === "pt" ? "es" : "pt");
              window.location.reload();
            }}
            className="h-9 px-2 text-[11px] font-bold uppercase text-muted-foreground hover:text-foreground"
          >
            {getPwaLang() === "pt" ? "PT" : "ES"}
          </Button>
          {showSwitcher && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/pwa")}
              className="h-9 w-9 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              title="Ir para o Início"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </Button>
          )}
          {onSignOut && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSignOut}
              className="h-9 w-9 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      {actionsBar && (
        <div className="border-t border-border/40 px-3 py-2">
          {actionsBar}
        </div>
      )}
    </header>
  );
}