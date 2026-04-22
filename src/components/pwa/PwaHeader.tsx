import { ArrowLeft, LogOut, ArrowLeftRight, Languages } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getPwaLang, setPwaLang } from "@/lib/pwa-messages";

interface PwaHeaderProps {
  title: string;
  icon?: React.ElementType;
  backTo?: string;
  onSignOut?: () => void;
  rightSlot?: React.ReactNode;
}

export function PwaHeader({ title, icon: Icon, backTo, onSignOut, rightSlot }: PwaHeaderProps) {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const showSwitcher = roles.length >= 2;

  return (
    <header className="relative overflow-hidden border-b border-border/90 bg-card text-card-foreground shadow-app-sm">
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{
          background: "hsl(var(--module-accent))",
        }}
      />
      <div className="relative flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          {backTo && (
            <button onClick={() => navigate(backTo)} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {Icon && <Icon className="h-5 w-5" style={{ color: "hsl(var(--module-accent))" }} />}
          <span className="font-heading font-semibold tracking-tight">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {rightSlot}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const current = getPwaLang();
              setPwaLang(current === "pt" ? "es" : "pt");
              window.location.reload();
            }}
            className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
          >
            {getPwaLang() === "pt" ? "PT" : "ES"}
          </Button>
          {showSwitcher && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/selecionar-modulo")} className="text-muted-foreground hover:text-foreground hover:bg-muted" title="Trocar módulo">
              <ArrowLeftRight className="h-5 w-5" />
            </Button>
          )}
          {onSignOut && (
            <Button variant="ghost" size="icon" onClick={onSignOut} className="text-muted-foreground hover:text-foreground hover:bg-muted">
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
