import { ArrowLeft, LogOut, ArrowLeftRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getPwaLang, setPwaLang } from "@/lib/pwa-messages";

interface PwaHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  backTo?: string;
  onSignOut?: () => void;
  rightSlot?: React.ReactNode;
}

export function PwaHeader({ title, subtitle, icon: Icon, backTo, onSignOut, rightSlot }: PwaHeaderProps) {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const showSwitcher = roles.length >= 2;

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
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
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
            {subtitle && (
              <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
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
              onClick={() => navigate("/selecionar-modulo")}
              className="h-9 w-9 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              title="Trocar módulo"
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
    </header>
  );
}
