import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, MapPin, Save, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgendaTabProps {
  sportEventId: string;
}

export function AgendaTab({ sportEventId }: AgendaTabProps) {
  const queryClient = useQueryClient();
  const [editingMatches, setEditingMatches] = useState<Record<string, { date: string, time: string, venueId: string }>>({});

  // Fetch all matches/heats (for ranking there's usually just one match per sport_event)
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["competition_matches_agenda_ranking", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          id,
          match_date,
          start_time,
          venue_id,
          competition_phases (name)
        `)
        .eq("sport_event_id", sportEventId);
      
      if (error) throw error;
      return data as any[];
    },
    enabled: !!sportEventId,
  });

  // Fetch venues for the select
  const { data: venues = [] } = useQuery({
    queryKey: ["venues_ranking"],
    queryFn: async () => {
      const { data, error } = await supabase.from("venues" as any).select("id, name");
      if (error) throw error;
      return data as any[];
    }
  });

  const saveMutation = useMutation({
    mutationFn: async ({ matchId, data }: { matchId: string, data: any }) => {
      const { error } = await supabase
        .from("competition_matches")
        .update({
          match_date: data.date || null,
          start_time: data.time || null,
          venue_id: data.venueId || null
        })
        .eq("id", matchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competition_matches_agenda_ranking", sportEventId] });
      toast.success("Agenda atualizada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar agenda: " + error.message);
    }
  });

  const handleFieldChange = (matchId: string, field: string, value: string) => {
    const current = editingMatches[matchId] || { 
      date: matches.find(m => m.id === matchId)?.match_date || "", 
      time: matches.find(m => m.id === matchId)?.start_time || "", 
      venueId: matches.find(m => m.id === matchId)?.venue_id || "" 
    };
    setEditingMatches({
      ...editingMatches,
      [matchId]: { ...current, [field]: value }
    });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-muted-foreground text-center px-4">
        <CalendarIcon className="h-8 w-8 mb-2 opacity-20" />
        <p>Nenhuma partida ou prova única montada para agendar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Fase / Prova</th>
              <th className="px-4 py-3 text-left font-medium">Data</th>
              <th className="px-4 py-3 text-left font-medium">Hora</th>
              <th className="px-4 py-3 text-left font-medium">Local</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-background">
            {matches.map((match: any) => {
              const edit = editingMatches[match.id] || { 
                date: match.match_date || "", 
                time: match.start_time || "", 
                venueId: match.venue_id || "" 
              };
              const isDirty = editingMatches[match.id] !== undefined;

              return (
                <tr key={match.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs">{match.competition_phases?.name || "Prova Única"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        type="date" 
                        value={edit.date} 
                        onChange={(e) => handleFieldChange(match.id, "date", e.target.value)}
                        className="h-8 text-xs w-36"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        type="time" 
                        value={edit.time} 
                        onChange={(e) => handleFieldChange(match.id, "time", e.target.value)}
                        className="h-8 text-xs w-28"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select 
                        value={edit.venueId} 
                        onValueChange={(val) => handleFieldChange(match.id, "venueId", val)}
                      >
                        <SelectTrigger className="h-8 text-xs w-48">
                          <SelectValue placeholder="Selecione o local" />
                        </SelectTrigger>
                        <SelectContent>
                          {venues.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors",
                        isDirty && !saveMutation.isPending
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                      disabled={!isDirty || saveMutation.isPending}
                      onClick={() => saveMutation.mutate({ matchId: match.id, data: edit })}
                    >
                      <Save className="h-3.5 w-3.5" /> Salvar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Add missing import for cn
import { cn } from "@/lib/utils";
