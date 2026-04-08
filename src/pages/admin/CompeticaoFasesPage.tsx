import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Trophy, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CompetitionPhaseFormDialog, { type PhaseFormValues } from "@/components/admin/CompetitionPhaseFormDialog";

export default function CompeticaoFasesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedEventId, setSelectedEventId] = useState("");
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

  const { data: phases, isLoading } = useQuery({
    queryKey: ["competition_phases", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("competition_phases").select("*").eq("event_id", selectedEventId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const sportEventsMap = new Map(sportEvents.map((se) => [se.id, se]));

  const phaseTypeLabel = (t: string) => {
    const m: Record<string, string> = { group: "Grupos", knockout: "Eliminatória", final: "Final", single: "Prova única" };
    return m[t] || t;
  };
  const statusLabel = (s: string) => {
    const m: Record<string, string> = { pending: "Pendente", in_progress: "Em andamento", finished: "Finalizada" };
    return m[s] || s;
  };
  const statusVariant = (s: string): "default" | "secondary" | "outline" => s === "in_progress" ? "default" : s === "finished" ? "secondary" : "outline";

  const createMut = useMutation({
    mutationFn: async (v: PhaseFormValues) => {
      const { error } = await supabase.from("competition_phases").insert({
        event_id: selectedEventId,
        sport_event_id: v.sport_event_id,
        name: v.name,
        phase_type: v.phase_type,
        sort_order: v.sort_order,
        status: v.status,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_phases"] }); toast.success("Fase criada"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: PhaseFormValues & { id: string }) => {
      const { error } = await supabase.from("competition_phases").update({
        name: v.name, phase_type: v.phase_type, sort_order: v.sort_order, status: v.status,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_phases"] }); toast.success("Fase atualizada"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = (v: PhaseFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Fases da Competição</h1>
          <p className="text-sm text-muted-foreground mt-1">Estrutura de fases por prova esportiva</p>
        </div>
        {canWrite && selectedEventId && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!sportEvents.length}>
            <Plus className="mr-2 h-4 w-4" />Nova fase
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 max-w-xs">
            <label className="text-sm font-medium text-foreground">Evento</label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
              <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
            </Select>
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
      ) : !phases?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Layers className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma fase cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre provas esportivas antes de criar fases.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prova</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {phases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{sportEventsMap.get(p.sport_event_id)?.name ?? "—"}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{phaseTypeLabel(p.phase_type)}</TableCell>
                  <TableCell>{p.sort_order}</TableCell>
                  <TableCell><Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge></TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setDialogOpen(true); }}>
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

      <CompetitionPhaseFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        phase={editing}
        sportEvents={sportEvents}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
