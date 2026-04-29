import { useStageContext } from "@/contexts/StageContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ListTree, Loader2 } from "lucide-react";

export default function StageSwitcher() {
  const { stages, activeStageId, setActiveStageId, stagesLoading } = useStageContext();

  if (stagesLoading) {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 h-9 w-full rounded-md bg-sidebar-accent/40 px-3">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground italic">Carregando etapas...</span>
        </div>
      </div>
    );
  }

  if (!stages || stages.length === 0) {
    return null;
  }

  return (
    <div className="px-3 py-2 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <ListTree className="h-3 w-3" />
        Etapa ativa
      </div>
      <Select value={activeStageId ?? ""} onValueChange={setActiveStageId}>
        <SelectTrigger className="h-8 text-xs bg-sidebar-accent/30 border-sidebar-border focus:ring-1 focus:ring-primary/20">
          <SelectValue placeholder="Selecionar etapa…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none" className="text-xs italic text-muted-foreground">
            Sem etapa (Global)
          </SelectItem>
          {stages.map((s) => (
            <SelectItem key={s.id} value={s.id} className="text-xs">
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
