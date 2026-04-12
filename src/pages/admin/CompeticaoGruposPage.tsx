import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Layers, Trophy, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CompetitionGroupFormDialog, { type GroupFormValues } from "@/components/admin/CompetitionGroupFormDialog";
import GroupStandingsTable from "@/components/admin/competition/GroupStandingsTable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useActiveEventId } from "@/contexts/EventContext";

export default function CompeticaoGruposPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const selectedEventId = useActiveEventId();
  const [selectedSportEventId, setSelectedSportEventId] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const canWrite = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

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

  const { data: phases = [] } = useQuery({
    queryKey: ["competition_phases", selectedEventId, selectedSportEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("competition_phases").select("*").eq("event_id", selectedEventId).order("sort_order");
      if (selectedSportEventId) q = q.eq("sport_event_id", selectedSportEventId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: groups, isLoading } = useQuery({
    queryKey: ["competition_groups", selectedEventId, selectedPhaseId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("competition_groups").select("*").eq("event_id", selectedEventId).order("sort_order");
      if (selectedPhaseId) q = q.eq("phase_id", selectedPhaseId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const phasesMap = new Map(phases.map((p) => [p.id, p]));
  const sportEventsMap = new Map(sportEvents.map((se) => [se.id, se]));

  // Filter phases by selected sport event
  const filteredPhases = selectedSportEventId
    ? phases.filter((p) => p.sport_event_id === selectedSportEventId)
    : phases;

  // Filter groups by selected sport event (via phase) when no specific phase is selected
  const filteredGroups = (() => {
    if (!groups) return [];
    if (selectedPhaseId) return groups; // already filtered by query
    if (selectedSportEventId) {
      const phaseIdsForSE = new Set(filteredPhases.map((p) => p.id));
      return groups.filter((g) => phaseIdsForSE.has(g.phase_id));
    }
    return groups;
  })();

  const createMut = useMutation({
    mutationFn: async (v: GroupFormValues) => {
      if (!selectedPhaseId) throw new Error("Selecione uma fase");
      const { error } = await supabase.from("competition_groups").insert({
        event_id: selectedEventId,
        phase_id: selectedPhaseId,
        name: v.name,
        sort_order: v.sort_order,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_groups"] }); toast.success("Grupo criado"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: GroupFormValues & { id: string }) => {
      const { error } = await supabase.from("competition_groups").update({
        name: v.name,
        sort_order: v.sort_order,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_groups"] }); toast.success("Grupo atualizado"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = (v: GroupFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  const getPhaseLabel = (phaseId: string) => {
    const phase = phasesMap.get(phaseId);
    if (!phase) return "—";
    const se = sportEventsMap.get(phase.sport_event_id);
    return `${se?.name ?? "—"} → ${phase.name}`;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Grupos / Chaves</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerenciar grupos e chaves por fase da competição</p>
        </div>
        {canWrite && selectedPhaseId && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Novo grupo
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={(v) => { setSelectedSportEventId(""); setSelectedPhaseId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Prova / Modalidade</label>
              <Select value={selectedSportEventId || "__all__"} onValueChange={(v) => { setSelectedSportEventId(v === "__all__" ? "" : v); setSelectedPhaseId(""); }} disabled={!selectedEventId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {sportEvents.map((se) => <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Fase</label>
              <Select value={selectedPhaseId || "__all__"} onValueChange={(v) => setSelectedPhaseId(v === "__all__" ? "" : v)} disabled={!selectedEventId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {filteredPhases.map((p) => {
                    const se = sportEventsMap.get(p.sport_event_id);
                    return <SelectItem key={p.id} value={p.id}>{se?.name ? `${se.name} — ` : ""}{p.name}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !filteredGroups.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Layers className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum grupo/chave cadastrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedPhaseId ? "Crie um grupo para esta fase." : "Selecione uma fase para criar grupos."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prova → Fase</TableHead>
                <TableHead>Grupo/Chave</TableHead>
                <TableHead>Ordem</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="text-muted-foreground text-sm">{getPhaseLabel(g.phase_id)}</TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="font-mono text-sm">{g.sort_order}</TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(g); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CompetitionGroupFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        group={editing}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
