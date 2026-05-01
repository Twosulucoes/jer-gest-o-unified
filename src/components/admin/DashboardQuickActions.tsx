import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Info, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
          const isCredenciamento = isCredenciamentoAction(action.label);
          
          return (
            <div key={action.to} className="relative group flex">
              <TooltipProvider>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Link
                      to={action.to}
                      className="flex flex-col items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 text-center transition-all duration-300 hover:shadow-md hover:border-primary/30 hover:-translate-y-1 active:scale-[0.96] w-full"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-sm group-hover:shadow-glow">
                        {action.icon}
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-foreground block">{action.label}</span>
                        <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-tighter">{action.group}</span>
                      </div>
                    </Link>
                  </TooltipTrigger>
                  {isCredenciamento && (
                    <TooltipContent side="bottom" className="text-[10px]">
                      Explicação do critério de acesso
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>

              {isCredenciamento && (
                <div className="absolute top-2 right-2 z-10">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        className="p-1.5 rounded-full text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                        onClick={(e) => e.preventDefault()} // Impede navegação ao clicar no ícone
                        aria-label="Ajuda sobre o credenciamento"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" className="max-w-[280px] p-4 space-y-3 z-50 shadow-xl border-primary/20 animate-in fade-in zoom-in-95">
                      <div className="space-y-1.5">
                        <p className="font-bold text-sm flex items-center gap-2 text-primary">
                          <Info className="h-4 w-4" /> Como funciona o acesso?
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Ao clicar, o sistema redireciona automaticamente para a <strong>última etapa que você acessou</strong> (armazenada no seu navegador).
                        </p>
                      </div>
                      
                      <div className="pt-2 border-t border-border mt-2 space-y-2">
                        <p className="text-[11px] font-bold text-foreground">
                          Para trocar a etapa:
                        </p>
                        <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc pl-3">
                          <li>Use o seletor de etapa no topo da tela.</li>
                          <li>Ou clique no logo para voltar à lista geral de etapas.</li>
                        </ul>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
