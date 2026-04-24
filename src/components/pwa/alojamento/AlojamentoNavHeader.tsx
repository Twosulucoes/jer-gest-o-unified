import { useNavigate } from "react-router-dom";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator 
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ChevronRight, Home, LayoutDashboard, FileText, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AlojamentoNavHeaderProps {
  currentPathLabel?: string;
  showQuickNav?: boolean;
}

export function AlojamentoNavHeader({ currentPathLabel, showQuickNav = true }: AlojamentoNavHeaderProps) {
  const navigate = useNavigate();
  const { activeEvent } = useEventContext();
  const { activeStage } = useStageContext();

  return (
    <div className="bg-card border-b border-border/60 px-4 py-3 sticky top-0 z-20 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="max-w-md mx-auto space-y-3">
        {/* Fixed Summary */}
        <div className="flex items-center justify-between gap-2 overflow-hidden bg-muted/30 p-2.5 rounded-xl border border-border/40">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 truncate">
              {activeEvent?.name || "Evento"}
            </p>
            <h2 className="text-[13px] font-bold text-foreground truncate">
              {activeStage?.name || "Sem Etapa Ativa"}
            </h2>
          </div>
          {activeStage && (
            <Badge variant="outline" className="shrink-0 bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5 py-0 font-bold uppercase">
              Ativa
            </Badge>
          )}
        </div>

        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList className="flex-nowrap overflow-x-auto pb-1 no-scrollbar">
            <BreadcrumbItem>
              <BreadcrumbLink 
                onClick={() => navigate("/pwa")} 
                className="flex items-center gap-1 cursor-pointer text-xs"
              >
                <Home className="h-3 w-3" />
                <span>Início</span>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator><ChevronRight className="h-3 w-3 text-muted-foreground/40" /></BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink 
                onClick={() => navigate("/pwa/alojamento")} 
                className="cursor-pointer text-xs"
              >
                Alojamento
              </BreadcrumbLink>
            </BreadcrumbItem>
            {currentPathLabel && (
              <>
                <BreadcrumbSeparator><ChevronRight className="h-3 w-3 text-muted-foreground/40" /></BreadcrumbSeparator>
                <BreadcrumbItem>
                  <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                    {currentPathLabel}
                  </span>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {/* Quick Nav Buttons */}
        {showQuickNav && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 h-9 text-[11px] font-bold gap-2 rounded-xl border-border/80 hover:bg-muted"
              onClick={() => navigate("/pwa/alojamento")}
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
              Visão Geral
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 h-9 text-[11px] font-bold gap-2 rounded-xl border-border/80 hover:bg-muted"
              onClick={() => navigate("/pwa/alojamento/lista-completa")}
            >
              <FileText className="h-3.5 w-3.5 text-purple-500" />
              Hóspedes
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 shrink-0 rounded-xl bg-muted/40 hover:bg-muted"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
