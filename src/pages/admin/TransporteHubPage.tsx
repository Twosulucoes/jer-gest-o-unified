import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import {
  Plus, Pencil, Bus, Route, Navigation, Users, AlertTriangle, ArrowRight, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import VehicleFormDialog, { type VehicleFormValues, type StageContext } from "@/components/admin/VehicleFormDialog";
import RouteFormDialog, { type RouteFormValues } from "@/components/admin/RouteFormDialog";
import TripFormDialog, { type TripFormValues } from "@/components/admin/TripFormDialog";

const KIND_LABELS: Record<string, string> = {
  classificatoria: "Classificatória", semifinal: "Semifinal",
  final: "Final", legado: "Legado", outro: "Outro",
};

const TYPE_MAP: Record<string, string> = {
  bus: "Ônibus", van: "Van", micro: "Micro-ônibus", car: "Carro", outro: "Outro",
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  scheduled: { label: "Agendada", variant: "outline" },
  in_progress: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluída", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

type TabKey = "saidas" | "veiculos" | "linhas";

export default function TransporteHubPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { stageId } = useParams<{ stageId: string }>();
  const { hasRole, user } = useAuth();
  const selectedEventId = useActiveEventId();
  const canWrite = hasRole("admin") || hasRole("secretaria") || hasRole("transporte");

  const [tab, setTab] = useState<TabKey>("saidas");
  const [searchParams, setSearchParams] = useSearchParams();
  const stageParam = searchParams.get("stage") ?? "";
  
  // Use stageId from URL if available, otherwise fallback to query param or state
  const [selectedStageId, setSelectedStageIdState] = useState(stageId || stageParam);
  
  const setSelectedStageId = (id: string) => {
    setSelectedStageIdState(id);
    if (!stageId) {
      const next = new URLSearchParams(searchParams);
      if (id) next.set("stage", id); else next.delete("stage");
      setSearchParams(next, { replace: true });
    }
  };

  const [vehicleDialog, setVehicleDialog] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [routeDialog, setRouteDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);
  const [tripDialog, setTripDialog] = useState(false);
  const [editingTrip, setEditingTrip] = useState<any>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: stages = [], isLoading: loadingStages } = useQuery({
    queryKey: ["event_stages", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("event_stages").select("id, name, kind, event_id, starts_at, ends_at")
        .eq("event_id", selectedEventId).eq("status", "active").order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  useEffect(() => {
    // If we have a stageId in the URL, that's our source of truth
    if (stageId) {
      setSelectedStageIdState(stageId);
      return;
    }

    if (stages.length > 0 && !stages.find(s => s.id === selectedStageId)) {
      const fromUrl = stages.find(s => s.id === stageParam);
      setSelectedStageId(fromUrl ? fromUrl.id : stages[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages, stageParam, stageId]);

  const selectedStage = stages.find(s => s.id === selectedStageId);
  const stageContext: StageContext | undefined = selectedStage
    ? { id: selectedStage.id, name: selectedStage.name, kind: selectedStage.kind, event_id: selectedStage.event_id }
    : undefined;

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery({
    queryKey: ["transport_vehicles", selectedStageId],
    queryFn: async () => {
      if (!selectedStageId) return [];
      const { data, error } = await (supabase.from("transport_vehicles") as any).select("*")
        .eq("event_stage_id", selectedStageId).order("plate");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!selectedStageId,
  });

  const { data: routes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ["transport_routes", selectedStageId],
    queryFn: async () => {
      if (!selectedStageId) return [];
      const { data, error } = await (supabase.from("transport_routes") as any).select("*")
        .eq("event_stage_id", selectedStageId).order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!selectedStageId,
  });

  const { data: trips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ["transport_trips", selectedStageId],
    queryFn: async () => {
      if (!selectedStageId) return [];
      const { data, error } = await (supabase.from("transport_trips") as any).select("*")
        .eq("event_stage_id", selectedStageId).order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!selectedStageId,
  });

  const routesMap = new Map(routes.map(r => [r.id, r]));
  const vehiclesMap = new Map(vehicles.map(v => [v.id, v]));

  const createVehicle = useMutation({
    mutationFn: async (v: VehicleFormValues) => {
      const { error } = await (supabase.from("transport_vehicles") as any).insert({
        event_id: selectedStage!.event_id, event_stage_id: selectedStageId,
        plate: v.plate.toUpperCase(), label: v.label || null,
        capacity: v.capacity, vehicle_type: v.vehicle_type, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_vehicles"] }); toast.success("Veículo criado"); setVehicleDialog(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateVehicle = useMutation({
    mutationFn: async ({ id, ...v }: VehicleFormValues & { id: string }) => {
      const { error } = await supabase.from("transport_vehicles").update({
        plate: v.plate.toUpperCase(), label: v.label || null,
        capacity: v.capacity, vehicle_type: v.vehicle_type, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_vehicles"] }); toast.success("Veículo atualizado"); setVehicleDialog(false); setEditingVehicle(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRoute = useMutation({
    mutationFn: async (v: RouteFormValues) => {
      const { error } = await (supabase.from("transport_routes") as any).insert({
        event_id: selectedStage!.event_id, event_stage_id: selectedStageId,
        name: v.name, origin: v.origin || null,
        destination: v.destination || null, notes: v.notes || null, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_routes"] }); toast.success("Linha criada"); setRouteDialog(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRoute = useMutation({
    mutationFn: async ({ id, ...v }: RouteFormValues & { id: string }) => {
      const { error } = await supabase.from("transport_routes").update({
        name: v.name, origin: v.origin || null,
        destination: v.destination || null, notes: v.notes || null, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_routes"] }); toast.success("Linha atualizada"); setRouteDialog(false); setEditingRoute(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createTrip = useMutation({
    mutationFn: async (v: TripFormValues) => {
      const { error } = await (supabase.from("transport_trips") as any).insert({
        event_id: selectedStage!.event_id, event_stage_id: selectedStageId,
        route_id: v.route_id, vehicle_id: v.vehicle_id || null,
        driver_name: v.driver_name || null, driver_phone: v.driver_phone || null,
        scheduled_at: v.scheduled_at || null, notes: v.notes || null, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_trips"] }); toast.success("Saída criada"); setTripDialog(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTrip = useMutation({
    mutationFn: async ({ id, ...v }: TripFormValues & { id: string }) => {
      const { error } = await supabase.from("transport_trips").update({
        route_id: v.route_id, vehicle_id: v.vehicle_id || null,
        driver_name: v.driver_name || null, driver_phone: v.driver_phone || null,
        scheduled_at: v.scheduled_at || null, notes: v.notes || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transport_trips"] }); toast.success("Saída atualizada"); setTripDialog(false); setEditingTrip(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const addButtonLabel: Record<TabKey, string> = {
    saidas: "Nova saída", veiculos: "Novo veículo", linhas: "Nova linha",
  };

  const handleAdd = () => {
    if (!selectedStageId) return;
    if (tab === "saidas") { setEditingTrip(null); setTripDialog(true); }
    else if (tab === "veiculos") { setEditingVehicle(null); setVehicleDialog(true); }
    else { setEditingRoute(null); setRouteDialog(true); }
  };

  const canAdd = !!selectedStageId && canWrite && (tab !== "saidas" || routes.length > 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Transporte</h1>
          <p className="text-sm text-muted-foreground mt-1">Saídas, veículos e linhas por etapa</p>
        </div>
        {canWrite && (
          <Button onClick={handleAdd} disabled={!canAdd}>
            <Plus className="mr-2 h-4 w-4" />{addButtonLabel[tab]}
          </Button>
        )}
      </div>

      {/* Seletor de etapa */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
        <Layers className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Etapa:</span>
        {!selectedEventId ? (
          <span className="text-sm text-muted-foreground">Selecione um evento no seletor global acima</span>
        ) : loadingStages ? (
          <Skeleton className="h-8 w-48" />
        ) : stages.length === 0 ? (
          <span className="text-sm text-amber-600 dark:text-amber-400">
            Nenhuma etapa cadastrada.{" "}
            <a href="/admin/eventos/etapas" className="underline">Cadastrar etapas</a>
          </span>
        ) : (
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger className="h-8 w-auto min-w-[220px] border-0 bg-transparent font-medium focus:ring-0">
              <SelectValue placeholder="Selecione uma etapa..." />
            </SelectTrigger>
            <SelectContent>
              {stages.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  <span className="ml-1 text-muted-foreground text-xs">· {KIND_LABELS[s.kind] ?? s.kind}</span>
                  {s.starts_at && <span className="ml-1 text-muted-foreground text-xs">({s.starts_at})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedStageId ? (
        <EmptyState icon={<Bus className="h-10 w-10" />} message="Selecione uma etapa para visualizar ou cadastrar dados" />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="saidas" className="gap-1.5">
              <Navigation className="h-3.5 w-3.5" /> Saídas
              {trips.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">{trips.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="veiculos" className="gap-1.5">
              <Bus className="h-3.5 w-3.5" /> Veículos
              {vehicles.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">{vehicles.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="linhas" className="gap-1.5">
              <Route className="h-3.5 w-3.5" /> Linhas
              {routes.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">{routes.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Saídas */}
          <TabsContent value="saidas" className="mt-4">
            {routes.length === 0 ? (
              <NeedsDependency
                message="Cadastre ao menos uma linha de transporte antes de criar saídas."
                actionLabel="Cadastrar linha agora"
                onAction={() => { setEditingRoute(null); setRouteDialog(true); setTab("linhas"); }}
              />
            ) : loadingTrips ? <LoadingSkeleton /> : trips.length === 0 ? (
              <EmptyState icon={<Navigation className="h-10 w-10" />} message="Nenhuma saída para esta etapa">
                {canWrite && <Button size="sm" onClick={() => { setEditingTrip(null); setTripDialog(true); }} className="mt-3"><Plus className="h-4 w-4 mr-1" />Nova saída</Button>}
              </EmptyState>
            ) : (
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Data / Hora</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trips.map(t => {
                      const route = routesMap.get(t.route_id);
                      const vehicle = t.vehicle_id ? vehiclesMap.get(t.vehicle_id) : null;
                      const st = STATUS_MAP[t.status] ?? { label: t.status, variant: "outline" as const };
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">
                            {route?.name ?? "—"}
                            {route?.origin && <span className="text-xs text-muted-foreground block">{route.origin} → {route.destination}</span>}
                          </TableCell>
                          <TableCell>{vehicle ? (vehicle.label || vehicle.plate) : "—"}</TableCell>
                          <TableCell>{t.driver_name || "—"}</TableCell>
                          <TableCell className="text-sm">{formatDate(t.scheduled_at)}</TableCell>
                          <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" title="Embarque" onClick={() => navigate(`/admin/transporte/embarque/${t.id}`)}>
                                <Users className="h-4 w-4" />
                              </Button>
                              {canWrite && (
                                <Button variant="ghost" size="icon" onClick={() => { setEditingTrip(t); setTripDialog(true); }}>
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
          </TabsContent>

          {/* Veículos */}
          <TabsContent value="veiculos" className="mt-4">
            {loadingVehicles ? <LoadingSkeleton /> : vehicles.length === 0 ? (
              <EmptyState icon={<Bus className="h-10 w-10" />} message="Nenhum veículo para esta etapa">
                {canWrite && <Button size="sm" onClick={() => { setEditingVehicle(null); setVehicleDialog(true); }} className="mt-3"><Plus className="h-4 w-4 mr-1" />Novo veículo</Button>}
              </EmptyState>
            ) : (
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead>Identificação</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Capacidade</TableHead>
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead className="w-[60px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono font-medium">{v.plate}</TableCell>
                        <TableCell>{v.label || "—"}</TableCell>
                        <TableCell>{TYPE_MAP[v.vehicle_type] ?? v.vehicle_type}</TableCell>
                        <TableCell>{v.capacity} lugares</TableCell>
                        <TableCell><Badge variant={v.is_active ? "default" : "secondary"}>{v.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                        {canWrite && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingVehicle(v); setVehicleDialog(true); }}>
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
          </TabsContent>

          {/* Linhas */}
          <TabsContent value="linhas" className="mt-4">
            {loadingRoutes ? <LoadingSkeleton /> : routes.length === 0 ? (
              <EmptyState icon={<Route className="h-10 w-10" />} message="Nenhuma linha para esta etapa">
                {canWrite && <Button size="sm" onClick={() => { setEditingRoute(null); setRouteDialog(true); }} className="mt-3"><Plus className="h-4 w-4 mr-1" />Nova linha</Button>}
              </EmptyState>
            ) : (
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da linha</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead className="w-[60px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routes.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.origin || "—"}</TableCell>
                        <TableCell>{r.destination || "—"}</TableCell>
                        <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Ativa" : "Inativa"}</Badge></TableCell>
                        {canWrite && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingRoute(r); setRouteDialog(true); }}>
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
          </TabsContent>
        </Tabs>
      )}

      <VehicleFormDialog
        open={vehicleDialog}
        onOpenChange={(o) => { setVehicleDialog(o); if (!o) setEditingVehicle(null); }}
        vehicle={editingVehicle}
        events={events}
        stageContext={stageContext}
        onSubmit={(v) => editingVehicle ? updateVehicle.mutate({ id: editingVehicle.id, ...v }) : createVehicle.mutate(v)}
        isPending={createVehicle.isPending || updateVehicle.isPending}
      />
      <RouteFormDialog
        open={routeDialog}
        onOpenChange={(o) => { setRouteDialog(o); if (!o) setEditingRoute(null); }}
        route={editingRoute}
        events={events}
        stageContext={stageContext}
        onSubmit={(v) => editingRoute ? updateRoute.mutate({ id: editingRoute.id, ...v }) : createRoute.mutate(v)}
        isPending={createRoute.isPending || updateRoute.isPending}
      />
      <TripFormDialog
        open={tripDialog}
        onOpenChange={(o) => { setTripDialog(o); if (!o) setEditingTrip(null); }}
        trip={editingTrip}
        routes={routes}
        vehicles={vehicles}
        onSubmit={(v) => editingTrip ? updateTrip.mutate({ id: editingTrip.id, ...v }) : createTrip.mutate(v)}
        isPending={createTrip.isPending || updateTrip.isPending}
      />
    </div>
  );
}

function NeedsDependency({ message, actionLabel, onAction }: { message: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm text-amber-800 dark:text-amber-300">{message}</p>
        <Button size="sm" variant="outline" className="mt-2 gap-1 border-amber-300 text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700" onClick={onAction}>
          {actionLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ icon, message, children }: { icon: React.ReactNode; message: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
      <div className="text-muted-foreground mb-3">{icon}</div>
      <p className="text-muted-foreground font-medium">{message}</p>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
    </div>
  );
}
