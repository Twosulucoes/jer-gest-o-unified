import { ArrowLeft, LogOut, ArrowLeftRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

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
    <header className="relative overflow-hidden border-b bg-primary text-primary-foreground">
      {/* Gradient accent bar */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(212 84% 36%) 35%, hsl(174 87% 34%) 65%, hsl(133 55% 45%) 100%)",
        }}
      />
      <div className="relative flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          {backTo && (
            <button onClick={() => navigate(backTo)} className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {Icon && <Icon className="h-5 w-5" />}
          <span className="font-heading font-semibold tracking-tight">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {rightSlot}
          {showSwitcher && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/selecionar-modulo")} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" title="Trocar módulo">
              <ArrowLeftRight className="h-5 w-5" />
            </Button>
          )}
          {onSignOut && (
            <Button variant="ghost" size="icon" onClick={onSignOut} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
