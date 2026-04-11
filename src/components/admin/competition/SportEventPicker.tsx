import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dumbbell } from "lucide-react";

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
      return data;
    },
  });

  return (
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
                {sportEvents.map((se: any) => (
                  <SelectItem key={se.id} value={se.id}>
                    {se.name} — {se.sports?.name} {se.sports?.is_collective ? "(Coletiva)" : "(Individual)"} — {se.categories?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
