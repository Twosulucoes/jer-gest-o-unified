import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar as CalendarIcon, MapPin, Clock, Save } from "lucide-react";
import { useState, useEffect } from "react";

interface AgendaTabProps {
  sportEventId: string;
}

export function AgendaTab({ sportEventId }: AgendaTabProps) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [locationId, setLocationId] = useState("");

  const { data: sportEvent, isLoading } = useQuery({
    queryKey: ["sport_event_agenda", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select("id, start_date, start_time, location_id")
        .eq("id", sportEventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sportEventId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (sportEvent) {
      setDate(sportEvent.start_date || "");
      setTime(sportEvent.start_time || "");
      setLocationId(sportEvent.location_id || "");
    }
  }, [sportEvent]);

  const updateAgendaMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("sport_events")
        .update({
          start_date: date || null,
          start_time: time || null,
          location_id: locationId || null,
        })
        .eq("id", sportEventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sport_event_agenda", sportEventId] });
      toast.success("Agenda atualizada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar agenda: " + error.message);
    },
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  return (
    <div className="max-w-2xl bg-card border rounded-lg p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" /> Data da Prova
          </Label>
          <Input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" /> Hora Prevista
          </Label>
          <Input 
            type="time" 
            value={time} 
            onChange={(e) => setTime(e.target.value)} 
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" /> Local de Competição
          </Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um local" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button 
          onClick={() => updateAgendaMutation.mutate()} 
          disabled={updateAgendaMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {updateAgendaMutation.isPending ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}
