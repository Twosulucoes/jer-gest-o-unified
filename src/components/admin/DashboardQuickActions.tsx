import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Info, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DashboardAction {
  label: string;
  to: string;
  icon: React.ReactNode;
  group: string;
}

interface DashboardQuickActionsProps {
  actions: DashboardAction[];
}

export function DashboardQuickActions({ actions }: DashboardQuickActionsProps) {
  if (actions.length === 0) return null;

  const isCredenciamentoAction = (label: string) => label === "Credenciamento";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          Acesso Rápido
        </h2>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {actions.map((action) => {
          const content = (
            <Link
              key={action.to}
              to={action.to}
              className="group relative flex flex-col items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 text-center transition-all duration-300 hover:shadow-md hover:border-primary/30 hover:-translate-y-1 active:scale-[0.96] w-full"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm group-hover:shadow-glow">
                {action.icon}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block">{action.label}</span>
                <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-tighter">{action.group}</span>
              </div>
              
              {isCredenciamentoAction(action.label) && (
                <div className="absolute top-2 right-2 text-muted-foreground/40 group-hover:text-primary/60 transition-colors">
                  <HelpCircle className="h-3.5 w-3.5" />
                </div>
              )}
            </Link>
          );

          if (isCredenciamentoAction(action.label)) {
            return (
              <Tooltip key={action.to}>
                <TooltipTrigger asChild>
                  {content}
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px] p-3 space-y-2">
                  <p className="font-semibold text-xs flex items-center gap-1.5">
                    <Info className="h-3 w-3 text-primary" /> Como funciona o acesso?
                  </p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Ao clicar, o sistema redireciona automaticamente para a <strong>última etapa que você acessou</strong> (armazenada no seu navegador).
                  </p>
                  <div className="pt-1 border-t border-border mt-1">
                    <p className="text-[10px] font-medium text-foreground">
                      Para trocar a etapa:
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Use o seletor no topo da tela ou clique no logo para voltar à lista geral.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          }

          return content;
        })}
      </div>
    </div>
  );
}
