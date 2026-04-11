import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, Link2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AcessosDelegacoesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDelegationId, setSelectedDelegationId] = useState("");

  const canManage = hasRole("admin") || hasRole("secretaria");

  // Fetch existing links
  const { data: links = [], isLoading } = useQuery({
    queryKey: ["user_delegations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_delegations")
        .select("id, user_id, delegation_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles (users with role delegacao)
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_delegacao"],
    queryFn: async () => {
      // Get user_ids with delegacao role
      const { data: roleData, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "delegacao");
      if (roleErr) throw roleErr;
      if (!roleData?.length) return [];

      const userIds = roleData.map((r) => r.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch delegations with institution name
  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations_for_link"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("id, event_id, institution_id, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: institutions = [] } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("id, name, year").order("year", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const institutionsMap = new Map(institutions.map((i) => [i.id, i.name]));
  const eventsMap = new Map(events.map((e) => [e.id, `${e.name} (${e.year})`]));
  const profilesMap = new Map(profiles.map((p) => [p.id, p.full_name || p.id]));
  const linkedUserIds = new Set(links.map((l) => l.user_id));

  const availableProfiles = profiles.filter((p) => !linkedUserIds.has(p.id));

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_delegations").insert({
        user_id: selectedUserId,
        delegation_id: selectedDelegationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_delegations"] });
      toast.success("Vínculo criado com sucesso");
      setDialogOpen(false);
      setSelectedUserId("");
      setSelectedDelegationId("");
    },
    onError: (err: Error) => {
      if (err.message?.includes("uq_user_delegations_user")) {
        toast.error("Este usuário já possui um vínculo de delegação.");
      } else {
        toast.error(`Erro ao criar vínculo: ${err.message}`);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_delegations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_delegations"] });
      toast.success("Vínculo removido");
    },
    onError: (err: Error) => toast.error(`Erro ao remover: ${err.message}`),
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Vínculos Delegação → Usuário</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Associe usuários com perfil <strong>delegação</strong> à sua delegação. O RLS restringe o acesso com base neste vínculo.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setDialogOpen(true)} disabled={!availableProfiles.length || !delegations.length}>
            <Plus className="mr-2 h-4 w-4" />
            Novo vínculo
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !links.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Link2 className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum vínculo configurado</p>
          <p className="text-sm text-muted-foreground mt-1">Vincule usuários com perfil delegação à sua delegação para restringir o acesso.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Delegação (Instituição)</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => {
                const delegation = delegations.find((d) => d.id === link.delegation_id);
                return (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">
                      {profilesMap.get(link.user_id) || link.user_id.slice(0, 8) + "…"}
                    </TableCell>
                    <TableCell>
                      {delegation ? institutionsMap.get(delegation.institution_id) || "—" : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {delegation ? eventsMap.get(delegation.event_id) || "—" : "—"}
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(link.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Usuário à Delegação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Usuário (perfil delegação)</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {availableProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.id.slice(0, 8) + "…"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Delegação</Label>
              <Select value={selectedDelegationId} onValueChange={setSelectedDelegationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma delegação" />
                </SelectTrigger>
                <SelectContent>
                  {delegations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {institutionsMap.get(d.institution_id) || "—"} — {eventsMap.get(d.event_id) || "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!selectedUserId || !selectedDelegationId || createMutation.isPending}
            >
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
