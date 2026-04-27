import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Trash2, Shield, Info } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ArbitragemTabProps {
  sportEventId: string;
}

const ROLES = [
  { id: "arbitro_central", label: "Árbitro Central / Juiz" },
  { id: "arbitro_lateral", label: "Árbitro Lateral" },
  { id: "mesa", label: "Mesa / Anotador" },
  { id: "arbitro_partida", label: "Árbitro de Partida (Xadrez)" },
  { id: "comissario", label: "Comissário" },
];

export function ArbitragemTab({ sportEventId }: ArbitragemTabProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("arbitro_central");

  // Fetch sport_id to filter referees
  const { data: eventInfo } = useQuery({
    queryKey: ["sport_event_info_ranking", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select("sport_id")
        .eq("id", sportEventId)
        .single();
      if (error) throw error;
      return data;
    }
  });

  // Fetch referees already assigned to any match of this sport event
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["arbitragem_assignments_ranking", sportEventId],
    queryFn: async () => {
      // Find all matches for this sport event
      const { data: matches } = await supabase
        .from("competition_matches")
        .select("id")
        .eq("sport_event_id", sportEventId);
      
      if (!matches || matches.length === 0) return [];
      
      const matchIds = matches.map(m => m.id);
      
      const { data, error } = await supabase
        .from("match_user_assignments" as any)
        .select(`
          id,
          user_id,
          role,
          profiles (full_name)
        `)
        .in("match_id", matchIds);
      
      if (error) throw error;
      
      // Unique assignments by user+role at sport event level
      const unique = new Map();
      (data as any[]).forEach(a => {
        const key = `${a.user_id}-${a.role}`;
        if (!unique.has(key)) {
          unique.set(key, {
            id: a.id,
            userId: a.user_id,
            role: a.role,
            name: a.profiles?.full_name || "N/A"
          });
        }
      });
      
      return Array.from(unique.values());
    },
    enabled: !!sportEventId,
  });

  // Fetch available referees
  const { data: availableReferees = [] } = useQuery({
    queryKey: ["available_referees_ranking", eventInfo?.sport_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!eventInfo?.sport_id
  });

  const addAssignmentMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
      const { data: eventData } = await supabase
        .from("sport_events")
        .select("event_id")
        .eq("id", sportEventId)
        .single();
      
      const eventId = eventData?.event_id;

      const { data: matches } = await supabase
        .from("competition_matches")
        .select("id")
        .eq("sport_event_id", sportEventId);
      
      if (!matches || matches.length === 0) {
        throw new Error("Não há partidas montadas para atribuir árbitros.");
      }

      const assignments = matches.map(m => ({
        match_id: m.id,
        user_id: userId,
        role: role,
        event_id: eventId
      }));

      const { error } = await supabase
        .from("match_user_assignments" as any)
        .insert(assignments);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arbitragem_assignments_ranking", sportEventId] });
      setShowAddModal(false);
      toast.success("Equipe de arbitragem atualizada");
    },
    onError: (error) => {
      toast.error("Erro ao atribuir árbitro: " + error.message);
    }
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string, role: string }) => {
      const { data: matches } = await supabase
        .from("competition_matches")
        .select("id")
        .eq("sport_event_id", sportEventId);
      
      if (!matches) return;

      const { error } = await supabase
        .from("match_user_assignments" as any)
        .delete()
        .in("match_id", matches.map(m => m.id))
        .eq("user_id", userId)
        .eq("role", role);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arbitragem_assignments_ranking", sportEventId] });
      toast.success("Árbitro removido da prova");
    }
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-heading font-semibold">Equipe de Arbitragem Designada</h3>
        </div>

        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" /> Designar Árbitro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Designar Árbitro para a Prova</DialogTitle>
              <DialogDescription>
                O árbitro selecionado será atribuído a todas as séries/partidas desta prova.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm">Árbitro</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione um oficial" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableReferees.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label className="text-right text-sm">Função</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(role => (
                      <SelectItem key={role.id} value={role.id}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancelar</Button>
              <Button 
                onClick={() => addAssignmentMutation.mutate({ userId: selectedUserId, role: selectedRole })}
                disabled={!selectedUserId || addAssignmentMutation.isPending}
              >
                Confirmar Designação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-muted/30 border rounded-lg p-3 flex gap-3 text-xs text-muted-foreground italic">
        <Info className="h-4 w-4 shrink-0" />
        <p>A equipe designada aqui é replicada para todas as séries e partidas da prova selecionada.</p>
      </div>

      {assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
          <Shield className="h-10 w-10 opacity-20 mb-3" />
          <p>Nenhum árbitro designado ainda</p>
          <p className="text-xs">Utilize o botão acima para montar sua equipe</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((a) => (
            <div key={`${a.userId}-${a.role}`} className="flex items-center justify-between p-3 bg-background border rounded-lg shadow-sm">
              <div className="space-y-1">
                <p className="font-semibold text-sm">{a.name}</p>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/30">
                  {ROLES.find(r => r.id === a.role)?.label || a.role}
                </Badge>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                onClick={() => removeAssignmentMutation.mutate({ userId: a.userId, role: a.role })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
