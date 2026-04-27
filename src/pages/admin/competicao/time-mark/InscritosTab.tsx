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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface InscritosTabProps {
  sportEventId: string;
}

export function InscritosTab({ sportEventId }: InscritosTabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ["athletes_enrolled", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select(`
          id,
          status,
          proof_or_weight_snapshot,
          participants (
            id,
            people (
              full_name,
              institutions (name)
            )
          )
        `)
        .eq("sport_event_id", sportEventId);
      
      if (error) throw error;
      return data.map((item: any) => ({
        id: item.id,
        name: item.participants?.people?.full_name || "N/A",
        institution: item.participants?.people?.institutions?.name || "N/A",
        status: item.status,
        entryMark: item.proof_or_weight_snapshot?.entry_mark || "-",
        isAllocated: !!item.seed_tag, // Placeholder logic for allocation
      }));
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
      queryClient.invalidateQueries({ queryKey: ["athletes_enrolled", sportEventId] });
      toast.success("Status de presença atualizado");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar presença: " + error.message);
    }
  });

  const filteredAthletes = athletes.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.institution.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (athletes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-2 opacity-20" />
        <p>Nenhum atleta inscrito nesta prova</p>
        <p className="text-xs">Inscrições são importadas via SIGECOM</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar atleta ou escola..." 
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <th className="px-4 py-3 text-left font-medium">Atleta</th>
              <th className="px-4 py-3 text-left font-medium">Escola</th>
              <th className="px-4 py-3 text-center font-medium">Marca Insc.</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAthletes.map((athlete) => (
              <TableRow key={athlete.id}>
                <TableCell className="font-medium">{athlete.name}</TableCell>
                <TableCell className="text-muted-foreground">{athlete.institution}</TableCell>
                <TableCell className="text-center font-mono text-xs">{athlete.entryMark}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={athlete.status === "absent" ? "destructive" : athlete.status === "confirmed" ? "success" : "secondary"}>
                    {athlete.status === "absent" ? "Ausente" : athlete.status === "confirmed" ? "Presente" : "Inscrito"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => togglePresenceMutation.mutate({ id: athlete.id, currentStatus: athlete.status })}
                    title={athlete.status === "absent" ? "Marcar como Presente" : "Marcar como Ausente"}
                  >
                    {athlete.status === "absent" ? <UserCheck className="h-4 w-4 text-green-600" /> : <UserX className="h-4 w-4 text-destructive" />}
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
