import { useEventContext } from "@/contexts/EventContext";
import { Calendar } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Props {
  children: React.ReactNode;
}

export default function RequireActiveEvent({ children }: Props) {
  const { events, activeEventId, setActiveEventId, eventsLoading } = useEventContext();
  const [tempId, setTempId] = useState("");

  if (eventsLoading) return null;

  if (activeEventId) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-bold text-foreground mb-2">Selecione um evento para continuar</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Para operar os módulos administrativos, é necessário selecionar o evento ativo.
      </p>
      {events.length > 0 ? (
        <div className="flex items-center gap-3">
          <Select value={tempId} onValueChange={setTempId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecionar evento…" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button disabled={!tempId} onClick={() => setActiveEventId(tempId)}>
            Continuar
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum evento cadastrado. Acesse <strong>Eventos</strong> para criar um.
        </p>
      )}
    </div>
  );
}
