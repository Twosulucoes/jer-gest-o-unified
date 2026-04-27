import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useStageContext } from "@/contexts/StageContext";
import { useEventContext } from "@/contexts/EventContext";

export interface PwaAction {
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  description?: string;
  requireStage?: boolean;
}

/**
 * PwaActionGrid — grade compacta de atalhos (2 colunas), padrão das telas operacionais.
 * Cada item usa o accent do módulo para o ícone.
 */
export function PwaActionGrid({
  actions,
  columns = 2,
  className,
}: {
  actions: PwaAction[];
  columns?: 2 | 3;
  className?: string;
}) {
  const navigate = useNavigate();
  const { activeStageId } = useStageContext();
  const { activeEventId } = useEventContext();
  const cols = columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className={cn("grid gap-3", cols, className)}>
      {actions.map((a) => {
        const Icon = a.icon;
        const handle = () => {
          if (a.onClick) {
            a.onClick();
          } else if (a.to) {
            // Se o destino for um módulo e faltar contexto, redireciona para a configuração
            const needsConfig = a.requireStage !== false && 
                               a.to.startsWith("/pwa/") && 
                               a.to !== "/pwa/configuracao" && 
                               a.to !== "/pwa/install" && 
                               (!activeStageId || !activeEventId);
            
            if (needsConfig) {
              navigate("/pwa/configuracao", { 
                state: { from: { pathname: a.to }, reason: "missing_stage" } 
              });
            } else {
              navigate(a.to);
            }
          }
        };
        return (
          <button
            key={a.label}
            type="button"
            onClick={handle}
            className="op-card group relative flex flex-col items-center gap-2 px-3 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-module active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-module-soft text-module shadow-app-sm">
              <Icon className="h-6 w-6" />
            </div>
            <span className="text-sm font-semibold text-foreground">{a.label}</span>
            {a.description && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}