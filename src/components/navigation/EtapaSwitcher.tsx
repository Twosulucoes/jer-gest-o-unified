import { useNavigate } from "react-router-dom";
import { Layers, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useStageContext } from "@/contexts/StageContext";

interface EtapaSwitcherProps {
  /**
   * Path within the stage to preserve when switching (e.g. "competicao").
   * If omitted, navigates to the stage home.
   */
  subPath?: string;
  className?: string;
}

/**
 * Dropdown that lets the user switch between event stages without leaving the
 * current sub-module (preserves `subPath`).
 */
export function EtapaSwitcher({ subPath, className }: EtapaSwitcherProps) {
  const navigate = useNavigate();
  const { stages, stagesLoading, activeStage } = useStageContext();

  if (stagesLoading) {
    return <Skeleton className={`h-8 w-40 ${className ?? ""}`} />;
  }

  if (stages.length === 0) return null;

  const handleSelect = (stageId: string) => {
    const base = `/admin/etapa/${stageId}`;
    navigate(subPath ? `${base}/${subPath}` : base);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={`gap-1.5 max-w-[220px] ${className ?? ""}`}>
          <Layers className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{activeStage?.name ?? "Selecionar etapa"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Trocar de etapa
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {stages.map((s) => {
          const isActive = s.id === activeStage?.id;
          return (
            <DropdownMenuItem
              key={s.id}
              onClick={() => handleSelect(s.id)}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{s.name}</span>
              {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default EtapaSwitcher;
