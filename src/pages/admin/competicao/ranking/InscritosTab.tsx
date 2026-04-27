import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserX, UserCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface InscritosTabProps {
  sportEventId: string;
}

export function InscritosTab({ sportEventId }: InscritosTabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["participants_enrolled_ranking", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select(`
          id,
          status,
          participants (
            id,
            people (
              full_name,
              institutions (name)
            ),
            teams (
              name,
              institutions (name)
            )
          )
        `)
        .eq("sport_event_id", sportEventId);
      
      if (error) throw error;
      return data.map((item: any) => {
        const isTeam = !!item.participants?.teams;
        return {
          id: item.id,
          name: isTeam ? item.participants?.teams?.name : item.participants?.people?.full_name || "N/A",
          institution: isTeam 
            ? item.participants?.teams?.institutions?.name 
            : item.participants?.people?.institutions?.name || "N/A",
          status: item.status,
          isTeam
        };
      });
    },
    enabled: !!sportEventId,
  });

  const togglePresenceMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "absent" ? "confirmed" : "absent";
      const { error } = await supabase
        .from("participant_sport_events")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      return { id, newStatus };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants_enrolled_ranking", sportEventId] });
      toast.success("Status de presença atualizado");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar presença: " + error.message);
    }
  });

  const filtered = participants.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.institution.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (participants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-2 opacity-20" />
        <p>Nenhum participante inscrito nesta prova</p>
        <p className="text-xs">Inscrições são importadas via SIGECOM</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar participante ou escola..." 
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <th className="px-4 py-3 text-left font-medium">Participante</th>
              <th className="px-4 py-3 text-left font-medium">Escola</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((participant) => (
              <TableRow key={participant.id}>
                <TableCell className="font-medium">
                  {participant.name}
                  <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4 uppercase">
                    {participant.isTeam ? "Equipe" : "Atleta"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{participant.institution}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={participant.status === "absent" ? "destructive" : participant.status === "confirmed" ? "success" : "secondary"}>
                    {participant.status === "absent" ? "Ausente" : participant.status === "confirmed" ? "Presente" : "Inscrito"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => togglePresenceMutation.mutate({ id: participant.id, currentStatus: participant.status })}
                    title={participant.status === "absent" ? "Marcar como Presente" : "Marcar como Ausente"}
                  >
                    {participant.status === "absent" ? <UserCheck className="h-4 w-4 text-green-600" /> : <UserX className="h-4 w-4 text-destructive" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
