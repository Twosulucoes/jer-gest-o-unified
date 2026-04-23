import { useEventContext } from "@/contexts/EventContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";

export default function EventSwitcher() {
  const { events, activeEventId, setActiveEventId, eventsLoading } = useEventContext();

  if (eventsLoading) {
    return (
      <div className="px-3 py-2">
        <div className="h-9 w-full animate-pulse rounded-md bg-sidebar-accent/40" />
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        Nenhum evento cadastrado
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Calendar className="h-3 w-3" />
        Evento ativo
      </div>
      <Select value={activeEventId ?? ""} onValueChange={setActiveEventId}>
        <SelectTrigger className="h-8 text-xs bg-sidebar-accent/30 border-sidebar-border">
          <SelectValue placeholder="Selecionar evento…" />
        </SelectTrigger>
        <SelectContent>
          {events.map((e) => (
            <SelectItem key={e.id} value={e.id} className="text-xs">
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
