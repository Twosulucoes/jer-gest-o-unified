import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RouteFormDialog, { type RouteFormValues } from "@/components/admin/RouteFormDialog";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";

export default function TransporteRotasPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const { stageId, isStageScoped } = useStageScope();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: routes, isLoading } = useQuery({
    queryKey: ["transport_routes", selectedEventId, stageId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("transport_routes").select("*").eq("event_id", selectedEventId);
      if (isStageScoped && stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const eventsMap = new Map(events.map((e) => [e.id, e]));

  const createMut = useMutation({
    mutationFn: async (v: RouteFormValues) => {
      const payload: any = {
        event_id: v.event_id, name: v.name, origin: v.origin || null,
        destination: v.destination || null, notes: v.notes || null, is_active: v.is_active,
      };
      if (isStageScoped && stageId) payload.event_stage_id = stageId;
      const { error } = await supabase.from("transport_routes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_routes"] }); toast.success("Rota criada"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: RouteFormValues & { id: string }) => {
      const { error } = await supabase.from("transport_routes").update({
        name: v.name, origin: v.origin || null,
        destination: v.destination || null, notes: v.notes || null, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_routes"] }); toast.success("Rota atualizada"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = (v: RouteFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Rotas</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro de rotas e trechos de transporte</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!events.length}>
            <Plus className="mr-2 h-4 w-4" />Nova rota
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !routes?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Route className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma rota cadastrada</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.origin || "—"}</TableCell>
                  <TableCell>{r.destination || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{eventsMap.get(r.event_id)?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Ativa" : "Inativa"}</Badge></TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setDialogOpen(true); }}>
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

      <RouteFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        route={editing}
        events={events}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
