import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, AlertTriangle, ShieldAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  eventId: string;
  value: string | null;
  onChange: (id: string | null) => void;
}

export default function SportEventPicker({ eventId, value, onChange }: Props) {
  const { data: sportEvents = [], isLoading } = useQuery({
    queryKey: ["sport-events-picker", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select("id, name, slug, sport_id, category_id, sports(name, is_collective), categories(name)")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;

      // Fetch release status from sport_event_rules in the same query batch
      const { data: rules } = await supabase
        .from("sport_event_rules")
        .select("sport_event_id, released_at")
        .eq("event_id", eventId);

      const releaseMap = new Map(
        (rules ?? []).map((r: any) => [r.sport_event_id, r.released_at])
      );

      return (data ?? []).map((se: any) => ({
        ...se,
        released_at: releaseMap.get(se.id) ?? null,
      }));
    },
  });

  const counts = useMemo(() => {
    const total = sportEvents.length;
    const released = sportEvents.filter((se: any) => se.released_at).length;
    return { total, released };
  }, [sportEvents]);

  const selectedEvent = sportEvents.find((se: any) => se.id === value);
  const isSelectedReleased = selectedEvent?.released_at != null;

  return (
    <div className="space-y-3">
      {/* Callout: none released */}
      {counts.total > 0 && counts.released === 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma prova foi validada ainda.{" "}
            <Link to="/admin/competicao/pre-validacao" className="underline font-semibold">
              Acesse a Pré-validação
            </Link>{" "}
            para liberar as provas antes de iniciar a competição.
          </AlertDescription>
        </Alert>
      )}

      {/* Counter: partial */}
      {counts.total > 0 && counts.released > 0 && counts.released < counts.total && (
        <p className="text-sm text-muted-foreground">
          {counts.released} de {counts.total} provas liberadas para competição
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <Select
                value={value ?? ""}
                onValueChange={(v) => onChange(v || null)}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder={isLoading ? "Carregando provas..." : "Selecione uma prova..."} />
                </SelectTrigger>
                <SelectContent>
                  {sportEvents.map((se: any) => {
                    const released = se.released_at != null;
                    return (
                      <SelectItem key={se.id} value={se.id}>
                        <span className={!released ? "opacity-60" : ""}>
                          {se.name} — {se.sports?.name} {se.sports?.is_collective ? "(Coletiva)" : "(Individual)"} — {se.categories?.name}
                          {!released && " ⚠️"}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locked state for non-released */}
      {value && !isSelectedReleased && (
        <Alert className="border-warning/50 bg-warning/5">
          <ShieldAlert className="h-4 w-4 text-warning" />
          <AlertDescription className="flex items-center gap-2 flex-wrap">
            <Badge variant="warning">Aguardando validação</Badge>
            <span className="text-sm">
              Esta prova ainda não foi validada.{" "}
              <Link to="/admin/competicao/pre-validacao" className="underline font-semibold text-primary">
                Acesse a Pré-validação
              </Link>
            </span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
