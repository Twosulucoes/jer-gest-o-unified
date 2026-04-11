import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, UserMinus } from "lucide-react";
import { isParticipationLimitError, PARTICIPATION_LIMIT_MESSAGE } from "@/lib/participationLimitError";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: any | null;
  canWrite: boolean;
}

export default function TeamMembersDialog({ open, onOpenChange, team, canWrite }: Props) {
  const qc = useQueryClient();
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [newRole, setNewRole] = useState("titular");
  const [newJersey, setNewJersey] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["team_members", team?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", team!.id)
        .order("is_active", { ascending: false })
        .order("role")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!team?.id,
  });

  // Get participants from same event for adding
  const { data: eventParticipants = [] } = useQuery({
    queryKey: ["participants_for_team", team?.event_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, person_id, participant_type")
        .eq("event_id", team!.event_id)
        .eq("is_active", true)
        .eq("participant_type", "athlete");
      if (error) throw error;
      return data;
    },
    enabled: !!team?.event_id,
  });

  const memberParticipantIds = new Set(members.map((m: any) => m.participant_id));
  const availableParticipants = eventParticipants.filter((p: any) => !memberParticipantIds.has(p.id));

  const personIds = [...new Set([...eventParticipants, ...members.map((m: any) => ({ person_id: m.participant_id }))].map((p: any) => p.person_id).filter(Boolean))];
  const allParticipantIds = [...new Set([...eventParticipants.map((p: any) => p.id), ...members.map((m: any) => m.participant_id)])];

  const { data: participants = [] } = useQuery({
    queryKey: ["participants_lookup", allParticipantIds.length],
    queryFn: async () => {
      if (!allParticipantIds.length) return [];
      const { data, error } = await supabase.from("participants").select("id, person_id").in("id", allParticipantIds);
      if (error) throw error;
      return data;
    },
    enabled: allParticipantIds.length > 0,
  });

  const participantPersonMap = new Map(participants.map((p: any) => [p.id, p.person_id]));
  const allPersonIds = [...new Set(participants.map((p: any) => p.person_id))];

  const { data: people = [] } = useQuery({
    queryKey: ["people_for_team", allPersonIds.length],
    queryFn: async () => {
      if (!allPersonIds.length) return [];
      const { data, error } = await supabase.from("people").select("id, full_name").in("id", allPersonIds);
      if (error) throw error;
      return data;
    },
    enabled: allPersonIds.length > 0,
  });

  const peopleMap = new Map(people.map((p: any) => [p.id, p.full_name]));

  const getPersonName = (participantId: string) => {
    const personId = participantPersonMap.get(participantId);
    if (!personId) return "—";
    return peopleMap.get(personId) ?? "—";
  };

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_members").insert({
        team_id: team!.id,
        participant_id: selectedParticipantId,
        role: newRole,
        jersey_number: newJersey ? parseInt(newJersey) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_members", team?.id] });
      toast.success("Membro adicionado");
      setSelectedParticipantId("");
      setNewJersey("");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const toggleActiveMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("team_members").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_members", team?.id] });
      toast.success("Membro atualizado");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_members", team?.id] });
      toast.success("Membro removido");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const roleLabel = (r: string) => {
    const m: Record<string, string> = { titular: "Titular", reserva: "Reserva", capitao: "Capitão" };
    return m[r] || r;
  };

  if (!team) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Composição — {team.name}</DialogTitle>
          <DialogDescription>Gerencie os membros desta equipe.</DialogDescription>
        </DialogHeader>

        {canWrite && availableParticipants.length > 0 && (
          <div className="flex items-end gap-2 border rounded-lg p-3 bg-muted/30">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Participante</label>
              <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {availableParticipants.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{getPersonName(p.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Função</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="titular">Titular</SelectItem>
                  <SelectItem value="reserva">Reserva</SelectItem>
                  <SelectItem value="capitao">Capitão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-20 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nº</label>
              <Input type="number" placeholder="—" value={newJersey} onChange={(e) => setNewJersey(e.target.value)} />
            </div>
            <Button size="sm" disabled={!selectedParticipantId || addMut.isPending} onClick={() => addMut.mutate()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum membro cadastrado.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Situação</TableHead>
                  {canWrite && <TableHead className="w-[80px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => (
                  <TableRow key={m.id} className={!m.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{getPersonName(m.participant_id)}</TableCell>
                    <TableCell>{roleLabel(m.role)}</TableCell>
                    <TableCell className="font-mono text-sm">{m.jersey_number ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={m.is_active ? "default" : "secondary"}>
                        {m.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={m.is_active ? "Inativar" : "Reativar"}
                            onClick={() => toggleActiveMut.mutate({ id: m.id, is_active: !m.is_active })}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeMut.mutate(m.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
