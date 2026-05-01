import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Info, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
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

  const isStageDependent = (label: string) => 
    ["Credenciamento", "Vinculação", "Consumo", "Ocupação", "Viagens", "Agenda", "Resultados", "Validação QR"].includes(label);

  const globalActions = actions.filter(a => !isStageDependent(a.label));
  const stageActions = actions.filter(a => isStageDependent(a.label));

  const renderAction = (action: DashboardAction) => {
    const isSpecialHelp = isStageDependent(action.label);
    const isCredenciamento = action.label === "Credenciamento" || action.label === "Vinculação" || action.label === "Validação QR";
    const isConsumo = ["Consumo", "Ocupação", "Viagens", "Agenda", "Resultados"].includes(action.label);
    
    return (
      <div key={action.to} className="relative group flex">
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
          {isSpecialHelp && (
            <TooltipContent side="bottom" className="text-[10px]">
              Ação vinculada à etapa selecionada
            </TooltipContent>
          )}
        </Tooltip>

        {isSpecialHelp && (
          <div className="absolute top-2 right-2 z-10">
            <Popover>
              <PopoverTrigger asChild>
                <button 
                  className="p-1.5 rounded-full text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onClick={(e) => e.preventDefault()}
                  aria-label="Ajuda sobre o acesso"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" className="max-w-[280px] p-4 space-y-3 z-50 shadow-xl border-primary/20 animate-in fade-in zoom-in-95">
                <div className="space-y-1.5">
                  <p className="font-bold text-sm flex items-center gap-2 text-primary">
                    <Info className="h-4 w-4" /> Filtro por etapa
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {isCredenciamento && (
                      <>Este acesso redireciona para a <strong>última etapa acessada</strong> no seu navegador.</>
                    )}
                    {isConsumo && (
                      <>Este módulo exibe dados baseados na <strong>etapa atualmente selecionada</strong> no topo da tela.</>
                    )}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-border mt-2 space-y-2">
                  <p className="text-[11px] font-bold text-foreground">
                    Para trocar a etapa:
                  </p>
                  <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc pl-3">
                    <li>Use o seletor no topo da tela.</li>
                    <li>Ou clique no logo para ver todas as etapas.</li>
                  </ul>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {globalActions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary/40" />
              Configuração Global do Evento
            </h2>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {globalActions.map(renderAction)}
          </div>
        </div>
      )}

      {stageActions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-orange-500/40" />
              Operação por Etapa Selecionada
            </h2>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {stageActions.map(renderAction)}
          </div>
        </div>
      )}
    </div>
  );
}
