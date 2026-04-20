import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import VehicleFormDialog, { type VehicleFormValues } from "@/components/admin/VehicleFormDialog";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";

const TYPE_MAP: Record<string, string> = {
  bus: "Ônibus", van: "Van", micro: "Micro-ônibus", car: "Carro", outro: "Outro",
};

export default function TransporteVeiculosPage() {
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

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["transport_vehicles", selectedEventId, stageId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("transport_vehicles").select("*").eq("event_id", selectedEventId);
      if (isStageScoped && stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q.order("plate");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const eventsMap = new Map(events.map((e) => [e.id, e]));

  const createMut = useMutation({
    mutationFn: async (v: VehicleFormValues) => {
      const { error } = await supabase.from("transport_vehicles").insert({
        event_id: v.event_id, plate: v.plate.toUpperCase(), label: v.label || null,
        capacity: v.capacity, vehicle_type: v.vehicle_type, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_vehicles"] }); toast.success("Veículo criado"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: VehicleFormValues & { id: string }) => {
      const { error } = await supabase.from("transport_vehicles").update({
        plate: v.plate.toUpperCase(), label: v.label || null,
        capacity: v.capacity, vehicle_type: v.vehicle_type, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_vehicles"] }); toast.success("Veículo atualizado"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = (v: VehicleFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Veículos</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro de veículos do transporte</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!events.length}>
            <Plus className="mr-2 h-4 w-4" />Novo veículo
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !vehicles?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Bus className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum veículo cadastrado</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono font-medium">{v.plate}</TableCell>
                  <TableCell>{v.label || "—"}</TableCell>
                  <TableCell>{TYPE_MAP[v.vehicle_type] ?? v.vehicle_type}</TableCell>
                  <TableCell>{v.capacity}</TableCell>
                  <TableCell className="text-muted-foreground">{eventsMap.get(v.event_id)?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={v.is_active ? "default" : "secondary"}>{v.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(v); setDialogOpen(true); }}>
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

      <VehicleFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        vehicle={editing}
        events={events}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
