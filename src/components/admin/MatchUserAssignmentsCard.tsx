import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ASSIGNMENT_ROLES = [
  { value: "mesario", label: "Mesário" },
  { value: "arbitro_principal", label: "Árbitro Principal" },
  { value: "arbitro_auxiliar", label: "Árbitro Auxiliar" },
  { value: "fiscal", label: "Fiscal" },
  { value: "anotador", label: "Anotador" },
];

interface Props {
  matchId: string;
  eventId: string;
  canWrite: boolean;
}

export default function MatchUserAssignmentsCard({ matchId, eventId, canWrite }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [removeId, setRemoveId] = useState<string | null>(null);

  const { data: assignments = [] } = useQuery({
    queryKey: ["match_user_assignments", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_user_assignments" as any)
        .select("*")
        .eq("match_id", matchId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const assignedUserIds = assignments.map((a: any) => a.user_id);
  const { data: assignedProfiles = [] } = useQuery({
    queryKey: ["profiles_for_assignments", assignedUserIds.length, assignedUserIds.slice(0, 3).join(",")],
    queryFn: async () => {
      if (!assignedUserIds.length) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", assignedUserIds);
      if (error) throw error;
      return data;
    },
    enabled: assignedUserIds.length > 0,
  });
  const profileMap = new Map(assignedProfiles.map((p) => [p.id, p]));

  const { data: searchResults = [] } = useQuery({
    queryKey: ["search_users_for_assignment", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .or(`full_name.ilike.%${search}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: search.length >= 2,
  });

  const { data: assignmentCounts = [] } = useQuery({
    queryKey: ["assignment_counts", eventId, assignedUserIds.length],
    queryFn: async () => {
      if (!assignedUserIds.length) return [];
      const { data, error } = await supabase
        .from("match_user_assignments" as any)
        .select("user_id")
        .eq("event_id", eventId);
      if (error) throw error;
      const counts = new Map<string, number>();
      (data as any[]).forEach((d: any) => {
        counts.set(d.user_id, (counts.get(d.user_id) || 0) + 1);
      });
      return Array.from(counts.entries()).map(([uid, count]) => ({ user_id: uid, count }));
    },
    enabled: assignedUserIds.length > 0,
  });
  const countMap = new Map(assignmentCounts.map((c: any) => [c.user_id, c.count]));

  const addMut = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !selectedRole) throw new Error("Selecione usuário e função");
      const { error } = await supabase.from("match_user_assignments" as any).insert({
        match_id: matchId,
        user_id: selectedUserId,
        role: selectedRole,
        event_id: eventId,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_user_assignments", matchId] });
      qc.invalidateQueries({ queryKey: ["assignment_counts", eventId] });
      toast.success("Designação adicionada");
      setSelectedUserId("");
      setSelectedRole("");
      setSearch("");
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("match_user_assignments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_user_assignments", matchId] });
      toast.success("Designação removida");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const getRoleLabel = (role: string) => ASSIGNMENT_ROLES.find((r) => r.value === role)?.label ?? role;

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />Designações de Oficiais
          </CardTitle>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => { setSearch(""); setSelectedUserId(""); setSelectedRole(""); setAddOpen(true); }}>
              <Plus className="mr-1 h-3.5 w-3.5" />Designar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum oficial designado.</p>
          ) : (
            <div className="space-y-1.5">
              {assignments.map((a: any) => {
                const profile = profileMap.get(a.user_id);
                const count = countMap.get(a.user_id) || 0;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-sm rounded-lg border p-2.5">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-medium">{profile?.full_name ?? "Usuário"}</span>
                      <Badge variant="secondary" className="text-[10px]">{getRoleLabel(a.role)}</Badge>
                      {count > 1 && (
                        <Badge variant="outline" className="text-[10px]">{count} partidas no evento</Badge>
                      )}
                    </div>
                    {canWrite && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setRemoveId(a.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Designar oficial</DialogTitle>
            <DialogDescription>Busque por nome e selecione a função.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Buscar usuário</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do usuário..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedUserId(""); }}
                  className="pl-9"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="border rounded-md max-h-[150px] overflow-y-auto divide-y">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${selectedUserId === u.id ? "bg-primary/10 font-medium" : ""}`}
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      {u.full_name ?? "Sem nome"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Função</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMut.mutate()} disabled={addMut.isPending || !selectedUserId || !selectedRole}>
              {addMut.isPending ? "Salvando..." : "Designar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeId} onOpenChange={(open) => { if (!open) setRemoveId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover designação?</AlertDialogTitle>
            <AlertDialogDescription>O oficial será removido desta partida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (removeId) removeMut.mutate(removeId); setRemoveId(null); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
