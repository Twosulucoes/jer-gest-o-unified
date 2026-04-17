import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import {
  Plus, Pencil, Building, DoorOpen, KeyRound, AlertTriangle, ArrowRight, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LodgingLocationFormDialog, { type LodgingLocationFormValues } from "@/components/admin/LodgingLocationFormDialog";
import LodgingUnitFormDialog, { type LodgingUnitFormValues } from "@/components/admin/LodgingUnitFormDialog";
import type { StageContext } from "@/components/admin/VehicleFormDialog";

const KIND_LABELS: Record<string, string> = {
  classificatoria: "Classificatória", semifinal: "Semifinal",
  final: "Final", legado: "Legado", outro: "Outro",
};

type TabKey = "unidades" | "locais";

export default function AlojamentoHubPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const [tab, setTab] = useState<TabKey>("unidades");
  const [selectedStageId, setSelectedStageId] = useState("");

  const [locationDialog, setLocationDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [unitDialog, setUnitDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);

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
        .from("event_stages").select("id, name, kind, event_id, starts_at")
        .eq("event_id", selectedEventId).eq("status", "active").order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  useEffect(() => {
    if (stages.length > 0 && !stages.find(s => s.id === selectedStageId)) {
      setSelectedStageId(stages[0].id);
    }
  }, [stages, selectedStageId]);

  const selectedStage = stages.find(s => s.id === selectedStageId);
  const stageContext: StageContext | undefined = selectedStage
    ? { id: selectedStage.id, name: selectedStage.name, kind: selectedStage.kind, event_id: selectedStage.event_id }
    : undefined;

  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ["lodging_locations", selectedStageId],
    queryFn: async () => {
      if (!selectedStageId) return [];
      const { data, error } = await supabase.from("lodging_locations").select("*")
        .eq("event_stage_id", selectedStageId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStageId,
  });

  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ["lodging_units", selectedStageId],
    queryFn: async () => {
      if (!selectedStageId) return [];
      const { data, error } = await supabase.from("lodging_units").select("*")
        .eq("event_stage_id", selectedStageId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStageId,
  });

  const { data: occupancyCounts = [] } = useQuery({
    queryKey: ["lodging_occupancy_counts", selectedStageId],
    queryFn: async () => {
      if (!selectedStageId) return [];
      const { data, error } = await supabase
        .from("lodging_occupancies").select("unit_id")
        .eq("event_stage_id", selectedStageId).in("status", ["allocated", "checked_in"]);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStageId,
  });

  const occCountMap = new Map<string, number>();
  occupancyCounts.forEach(o => {
    occCountMap.set(o.unit_id, (occCountMap.get(o.unit_id) || 0) + 1);
  });

  const locationsMap = new Map(locations.map(l => [l.id, l]));
  const genderLabel = (g: string) => g === "male" ? "Masculino" : g === "female" ? "Feminino" : "Misto";

  const createLocation = useMutation({
    mutationFn: async (v: LodgingLocationFormValues) => {
      const { error } = await supabase.from("lodging_locations").insert({
        event_id: selectedStage!.event_id, event_stage_id: selectedStageId,
        name: v.name, address: v.address || null, notes: v.notes || null, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_locations"] }); toast.success("Local criado"); setLocationDialog(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLocation = useMutation({
    mutationFn: async ({ id, ...v }: LodgingLocationFormValues & { id: string }) => {
      const { error } = await supabase.from("lodging_locations").update({
        name: v.name, address: v.address || null, notes: v.notes || null, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_locations"] }); toast.success("Local atualizado"); setLocationDialog(false); setEditingLocation(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createUnit = useMutation({
    mutationFn: async (v: LodgingUnitFormValues) => {
      const { error } = await supabase.from("lodging_units").insert({
        event_id: selectedStage!.event_id, event_stage_id: selectedStageId,
        location_id: v.location_id, name: v.name, capacity: v.capacity,
        gender_restriction: v.gender_restriction, notes: v.notes || null, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_units"] }); toast.success("Unidade criada"); setUnitDialog(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateUnit = useMutation({
    mutationFn: async ({ id, ...v }: LodgingUnitFormValues & { id: string }) => {
      const { error } = await supabase.from("lodging_units").update({
        location_id: v.location_id, name: v.name, capacity: v.capacity,
        gender_restriction: v.gender_restriction, notes: v.notes || null, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_units"] }); toast.success("Unidade atualizada"); setUnitDialog(false); setEditingUnit(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addLabel: Record<TabKey, string> = { unidades: "Nova unidade", locais: "Novo local" };

  const handleAdd = () => {
    if (!selectedStageId) return;
    if (tab === "unidades") { setEditingUnit(null); setUnitDialog(true); }
    else { setEditingLocation(null); setLocationDialog(true); }
  };

  const canAdd = !!selectedStageId && canWrite && (tab !== "unidades" || locations.length > 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Alojamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Locais e unidades de hospedagem por etapa</p>
        </div>
        {canWrite && (
          <Button onClick={handleAdd} disabled={!canAdd}>
            <Plus className="mr-2 h-4 w-4" />{addLabel[tab]}
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
          <span className="text-sm text-amber-600 dark:text-amber-400">Nenhuma etapa cadastrada para este evento</span>
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
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Atalho operacional */}
      <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/admin/alojamento/ocupacao")}>
        <CardContent className="flex items-center gap-3 p-4">
          <KeyRound className="h-8 w-8 text-primary shrink-0" />
          <div>
            <p className="font-medium text-sm">Check-in / Check-out</p>
            <p className="text-xs text-muted-foreground">Operação de hospedagem em tempo real</p>
          </div>
        </CardContent>
      </Card>

      {!selectedStageId ? (
        <EmptyState icon={<Building className="h-10 w-10" />} message="Selecione uma etapa para visualizar ou cadastrar dados" />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-2 max-w-xs">
            <TabsTrigger value="unidades" className="gap-1.5">
              <DoorOpen className="h-3.5 w-3.5" /> Unidades
              {units.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">{units.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="locais" className="gap-1.5">
              <Building className="h-3.5 w-3.5" /> Locais
              {locations.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">{locations.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unidades" className="mt-4">
            {locations.length === 0 ? (
              <NeedsDependency
                message="Cadastre o local de hospedagem (ex: Hotel Central) antes de criar os quartos."
                actionLabel="Cadastrar local agora"
                onAction={() => { setEditingLocation(null); setLocationDialog(true); setTab("locais"); }}
              />
            ) : loadingUnits ? <LoadingSkeleton /> : units.length === 0 ? (
              <EmptyState icon={<DoorOpen className="h-10 w-10" />} message="Nenhuma unidade para esta etapa">
                {canWrite && <Button size="sm" onClick={() => { setEditingUnit(null); setUnitDialog(true); }} className="mt-3"><Plus className="h-4 w-4 mr-1" />Nova unidade</Button>}
              </EmptyState>
            ) : (
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Capacidade</TableHead>
                      <TableHead>Ocupação</TableHead>
                      <TableHead>Gênero</TableHead>
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead className="w-[60px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {units.map(u => {
                      const occ = occCountMap.get(u.id) || 0;
                      const full = occ >= u.capacity;
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell className="text-muted-foreground">{locationsMap.get(u.location_id)?.name ?? "—"}</TableCell>
                          <TableCell>{u.capacity}</TableCell>
                          <TableCell><Badge variant={full ? "destructive" : "outline"}>{occ}/{u.capacity}</Badge></TableCell>
                          <TableCell>{genderLabel(u.gender_restriction)}</TableCell>
                          <TableCell><Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Ativa" : "Inativa"}</Badge></TableCell>
                          {canWrite && (
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => { setEditingUnit(u); setUnitDialog(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="locais" className="mt-4">
            {loadingLocations ? <LoadingSkeleton /> : locations.length === 0 ? (
              <EmptyState icon={<Building className="h-10 w-10" />} message="Nenhum local para esta etapa">
                {canWrite && <Button size="sm" onClick={() => { setEditingLocation(null); setLocationDialog(true); }} className="mt-3"><Plus className="h-4 w-4 mr-1" />Novo local</Button>}
              </EmptyState>
            ) : (
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Unidades</TableHead>
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead className="w-[60px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.map(l => {
                      const unitCount = units.filter(u => u.location_id === l.id).length;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell className="text-muted-foreground">{l.address || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{unitCount} unidade{unitCount !== 1 ? "s" : ""}</Badge></TableCell>
                          <TableCell><Badge variant={l.is_active ? "default" : "secondary"}>{l.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                          {canWrite && (
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => { setEditingLocation(l); setLocationDialog(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <LodgingLocationFormDialog
        open={locationDialog}
        onOpenChange={(o) => { setLocationDialog(o); if (!o) setEditingLocation(null); }}
        location={editingLocation}
        events={events}
        stageContext={stageContext}
        onSubmit={(v) => editingLocation ? updateLocation.mutate({ id: editingLocation.id, ...v }) : createLocation.mutate(v)}
        isPending={createLocation.isPending || updateLocation.isPending}
      />
      <LodgingUnitFormDialog
        open={unitDialog}
        onOpenChange={(o) => { setUnitDialog(o); if (!o) setEditingUnit(null); }}
        unit={editingUnit}
        locations={locations}
        onSubmit={(v) => editingUnit ? updateUnit.mutate({ id: editingUnit.id, ...v }) : createUnit.mutate(v)}
        isPending={createUnit.isPending || updateUnit.isPending}
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
