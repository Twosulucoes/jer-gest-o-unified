import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Bus, Users, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TripFormDialog, { type TripFormValues } from "@/components/admin/TripFormDialog";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  scheduled: { label: "Agendada", variant: "outline" },
  in_progress: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluída", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

export default function TransporteViagensPage() {
  const qc = useQueryClient();
  const { hasRole, user } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const selectedEventId = useActiveEventId();
  const { stageId, isStageScoped } = useStageScope();
  const canWrite = hasRole("admin") || hasRole("secretaria") || hasRole("transporte");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: routes = [] } = useQuery({
    queryKey: ["transport_routes", selectedEventId, stageId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("transport_routes").select("*").eq("event_id", selectedEventId).eq("is_active", true);
      if (isStageScoped && stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q.order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["transport_vehicles", selectedEventId, stageId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("transport_vehicles").select("*").eq("event_id", selectedEventId).eq("is_active", true);
      if (isStageScoped && stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q.order("plate");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: trips, isLoading } = useQuery({
    queryKey: ["transport_trips", selectedEventId, stageId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("transport_trips").select("*").eq("event_id", selectedEventId);
      if (isStageScoped && stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q.order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const routesMap = new Map(routes.map((r) => [r.id, r]));
  const vehiclesMap = new Map(vehicles.map((v) => [v.id, v]));

  const createMut = useMutation({
    mutationFn: async (v: TripFormValues) => {
      const payload: any = {
        event_id: selectedEventId,
        route_id: v.route_id,
        vehicle_id: v.vehicle_id || null,
        driver_name: v.driver_name || null,
        driver_phone: v.driver_phone || null,
        scheduled_at: v.scheduled_at || null,
        notes: v.notes || null,
        created_by: user?.id,
      };
      if (isStageScoped && stageId) payload.event_stage_id = stageId;
      const { error } = await supabase.from("transport_trips").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_trips"] }); toast.success("Viagem criada"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: TripFormValues & { id: string }) => {
      const { error } = await supabase.from("transport_trips").update({
        route_id: v.route_id,
        vehicle_id: v.vehicle_id || null,
        driver_name: v.driver_name || null,
        driver_phone: v.driver_phone || null,
        scheduled_at: v.scheduled_at || null,
        notes: v.notes || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_trips"] }); toast.success("Viagem atualizada"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = (v: TripFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Viagens</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de viagens de transporte</p>
        </div>
        {canWrite && selectedEventId && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!routes.length}>
            <Plus className="mr-2 h-4 w-4" />Nova viagem
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 max-w-xs">
            <label className="text-sm font-medium text-foreground">Evento</label>
            <Select value={selectedEventId} onValueChange={() => {}}>
              <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
              <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Bus className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !trips?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Bus className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma viagem cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre rotas e veículos antes de criar viagens.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((t) => {
                const route = routesMap.get(t.route_id);
                const vehicle = t.vehicle_id ? vehiclesMap.get(t.vehicle_id) : null;
                const st = STATUS_MAP[t.status] ?? { label: t.status, variant: "outline" as const };
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{route?.name ?? "—"}</TableCell>
                    <TableCell>{vehicle ? (vehicle.label || vehicle.plate) : "—"}</TableCell>
                    <TableCell>{t.driver_name || "—"}</TableCell>
                    <TableCell>{formatDate(t.scheduled_at)}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/transporte/embarque/${t.id}`)} title="Embarque">
                          <Users className="h-4 w-4" />
                        </Button>
                        {canWrite && (
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TripFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        trip={editing}
        routes={routes}
        vehicles={vehicles}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
