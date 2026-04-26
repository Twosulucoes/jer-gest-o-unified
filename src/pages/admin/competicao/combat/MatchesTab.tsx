import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Calendar, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MatchCombatFormDrawer } from "@/components/admin/competition/MatchCombatFormDrawer";

interface MatchesTabProps {
  sportEventId: string;
}

export function MatchesTab({ sportEventId }: MatchesTabProps) {
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: sportEvent } = useQuery({
    queryKey: ["sport_event_basic", sportEventId],
    queryFn: async () => {
      const { data } = await supabase.from('sport_events').select('sport_id').eq('id', sportEventId).single();
      return data;
    }
  });
    queryKey: ["combat-matches", sportEventId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("competition_matches") as any)
        .select(`
          id,
          match_number,
          match_date,
          start_time,
          status,
          phase:competition_phases(name),
          venue:venues(name),
          entries:competition_match_entries(
            id,
            side,
            participant:participant_sport_events(
              id,
              participant:participants(
                persons(name),
                delegations(institutions(name))
              )
            )
          ),
          results:competition_match_results(
            id,
            result_status,
            points,
            outcome
          )
        `)
        .eq("sport_event_id", sportEventId)
        .order("match_number");
      
      if (error) throw error;
      return data;
    },
  });

  const getMatchStatus = (m: any) => {
    const hasResults = (m.results?.length || 0) > 0;
    const validated = m.results?.every((r: any) => r.result_status === "resultado_validado" || r.result_status === "publicado");
    
    if (validated) return { label: "Homologado", color: "bg-green-600" };
    if (hasResults) return { label: "Lançado", color: "bg-amber-500" };
    if (m.status === "in_progress") return { label: "Em andamento", color: "bg-orange-500" };
    return { label: "Agendado", color: "bg-muted text-muted-foreground border" };
  };

  if (isLoading) return <div>Carregando lutas...</div>;

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[80px]">Nº</TableHead>
              <TableHead>Fase</TableHead>
              <TableHead>Atleta A</TableHead>
              <TableHead className="text-center">vs</TableHead>
              <TableHead>Atleta B</TableHead>
              <TableHead>Agenda</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  Nenhuma luta gerada para esta categoria. Monte a chave primeiro.
                </TableCell>
              </TableRow>
            ) : (
              matches.map((m: any) => {
                const athleteA = m.entries?.find((e: any) => e.side === "A")?.participant?.participant;
                const athleteB = m.entries?.find((e: any) => e.side === "B")?.participant?.participant;
                const status = getMatchStatus(m);
                
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">
                      #{m.match_number}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {m.phase?.name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-semibold">{athleteA?.persons?.name || "BYE"}</div>
                      <div className="text-[10px] text-muted-foreground">{athleteA?.delegations?.institutions?.name}</div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground font-bold italic">
                      VS
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-semibold">{athleteB?.persons?.name || "BYE"}</div>
                      <div className="text-[10px] text-muted-foreground">{athleteB?.delegations?.institutions?.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-[10px]">
                        {m.match_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(m.match_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {m.start_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {m.start_time.substring(0, 5)}
                          </span>
                        )}
                        {m.venue?.name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {m.venue.name}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block font-medium ${status.color}`}>
                        {status.label}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
