import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TeamFormDialog, { type TeamFormValues } from "@/components/admin/TeamFormDialog";
import TeamMembersDialog from "@/components/admin/TeamMembersDialog";

export default function CompeticaoEquipesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canWrite = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedSportEventId, setSelectedSportEventId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [membersTeam, setMembersTeam] = useState<any>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sportEvents = [] } = useQuery({
    queryKey: ["sport_events", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("sport_events").select("*").eq("event_id", selectedEventId).eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("delegations").select("*, institutions:institution_id(name)").eq("event_id", selectedEventId).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams", selectedEventId, selectedSportEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("teams").select("*").eq("event_id", selectedEventId).order("name");
      if (selectedSportEventId) q = q.eq("sport_event_id", selectedSportEventId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const sportEventsMap = new Map(sportEvents.map((se: any) => [se.id, se]));
  const delegationsMap = new Map(delegations.map((d: any) => [d.id, d]));

  const createMut = useMutation({
    mutationFn: async (v: TeamFormValues) => {
      const { error } = await supabase.from("teams").insert({
        event_id: selectedEventId,
        sport_event_id: v.sport_event_id,
        delegation_id: v.delegation_id,
        name: v.name,
        status: v.status,
        notes: v.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teams"] }); toast.success("Equipe criada"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: TeamFormValues & { id: string }) => {
      const { error } = await supabase.from("teams").update({
        sport_event_id: v.sport_event_id,
        delegation_id: v.delegation_id,
        name: v.name,
        status: v.status,
        notes: v.notes || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teams"] }); toast.success("Equipe atualizada"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = (v: TeamFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Equipes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de equipes para modalidades coletivas</p>
        </div>
        {canWrite && selectedEventId && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Nova equipe
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={(v) => { setSelectedEventId(v); setSelectedSportEventId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>{events.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Prova (filtro)</label>
              <Select value={selectedSportEventId || "__all__"} onValueChange={(v) => setSelectedSportEventId(v === "__all__" ? "" : v)} disabled={!selectedEventId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {sportEvents.map((se: any) => <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !teams?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma equipe cadastrada</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Prova</TableHead>
                <TableHead>Delegação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t: any) => {
                const se = sportEventsMap.get(t.sport_event_id);
                const del = delegationsMap.get(t.delegation_id);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{se?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{(del as any)?.institutions?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status === "active" ? "Ativa" : t.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canWrite && (
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setMembersTeam(t)}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TeamFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        team={editing}
        sportEvents={sportEvents}
        delegations={delegations}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />

      <TeamMembersDialog
        open={!!membersTeam}
        onOpenChange={(o) => { if (!o) setMembersTeam(null); }}
        team={membersTeam}
        canWrite={canWrite}
      />
    </div>
  );
}
