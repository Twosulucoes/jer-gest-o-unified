import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { toast } from "sonner";
import {
  Plus, Pencil, Building, DoorOpen, KeyRound, BedDouble, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LodgingLocationFormDialog, { type LodgingLocationFormValues } from "@/components/admin/LodgingLocationFormDialog";
import LodgingUnitFormDialog, { type LodgingUnitFormValues } from "@/components/admin/LodgingUnitFormDialog";
import type { StageContext } from "@/components/admin/VehicleFormDialog";

export default function AlojamentoHubPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const { stageId, isStageScoped } = useStageScope();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const [locationDialog, setLocationDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [unitDialog, setUnitDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);

  // Stage info for form context
  const { data: stageInfo } = useQuery({
    queryKey: ["stage_info", stageId],
    queryFn: async () => {
      if (!stageId) return null;
      const { data } = await supabase
        .from("event_stages").select("id, name, kind, event_id")
        .eq("id", stageId).maybeSingle();
      return data;
    },
    enabled: !!stageId,
  });

  const stageContext: StageContext | undefined = stageInfo
    ? { id: stageInfo.id, name: stageInfo.name, kind: stageInfo.kind, event_id: stageInfo.event_id }
    : undefined;

  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ["lodging_locations", stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await (supabase.from("lodging_locations") as any)
        .select("*").eq("event_stage_id", stageId).order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!stageId,
  });

  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ["lodging_units", stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await (supabase.from("lodging_units") as any)
        .select("*").eq("event_stage_id", stageId).order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!stageId,
  });

  const { data: occupancyCounts = [] } = useQuery({
    queryKey: ["lodging_occupancy_counts", stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await (supabase.from("lodging_occupancies") as any)
        .select("unit_id").eq("event_stage_id", stageId).in("status", ["allocated", "checked_in"]);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!stageId,
  });

  const occCountMap = new Map<string, number>();
  occupancyCounts.forEach((o: any) => {
    occCountMap.set(o.unit_id, (occCountMap.get(o.unit_id) || 0) + 1);
  });

  const totalCapacity = units.reduce((sum: number, u: any) => sum + (u.capacity || 0), 0);
  const totalOccupied = occupancyCounts.length;
  const genderLabel = (g: string) => g === "male" ? "Masc." : g === "female" ? "Fem." : "Misto";

  const createLocation = useMutation({
    mutationFn: async (v: LodgingLocationFormValues) => {
      const { error } = await (supabase.from("lodging_locations") as any).insert({
        event_id: stageInfo!.event_id, event_stage_id: stageId,
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
      const { error } = await (supabase.from("lodging_units") as any).insert({
        event_id: stageInfo!.event_id, event_stage_id: stageId,
        location_id: v.location_id, name: v.name, capacity: v.capacity,
        gender_restriction: v.gender_restriction, notes: v.notes || null, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_units"] }); toast.success("Quarto criado"); setUnitDialog(false); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_units"] }); toast.success("Quarto atualizado"); setUnitDialog(false); setEditingUnit(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isStageScoped || !stageId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
        <Building className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Acesse pelo menu de uma etapa</p>
        <p className="text-sm text-muted-foreground mt-1">Selecione uma etapa na barra lateral para ver o alojamento.</p>
      </div>
    );
  }

  const isLoading = loadingLocations || loadingUnits;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Alojamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral dos locais e quartos desta etapa</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setEditingLocation(null); setLocationDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo local
            </Button>
            <Button onClick={() => { setEditingUnit(null); setUnitDialog(true); }} disabled={locations.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Novo quarto
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold">{locations.length}</p>
              <p className="text-xs text-muted-foreground">Locais</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BedDouble className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold">{units.length}</p>
              <p className="text-xs text-muted-foreground">Quartos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="text-2xl font-bold">{totalCapacity}</p>
              <p className="text-xs text-muted-foreground">Capacidade total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DoorOpen className="h-8 w-8 text-amber-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{totalOccupied}<span className="text-sm text-muted-foreground font-normal">/{totalCapacity}</span></p>
              <p className="text-xs text-muted-foreground">Ocupados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Check-in shortcut */}
      <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("ocupacao")}>
        <CardContent className="flex items-center gap-3 p-4">
          <KeyRound className="h-8 w-8 text-primary shrink-0" />
          <div>
            <p className="font-medium text-sm">Check-in / Check-out</p>
            <p className="text-xs text-muted-foreground">Operação de hospedagem em tempo real</p>
          </div>
        </CardContent>
      </Card>

      {/* Locais + Quartos nested */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Building className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum local cadastrado para esta etapa</p>
          {canWrite && (
            <Button size="sm" className="mt-3" onClick={() => { setEditingLocation(null); setLocationDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Cadastrar local
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {locations.map((loc: any) => {
            const locUnits = units.filter((u: any) => u.location_id === loc.id);
            const locCapacity = locUnits.reduce((s: number, u: any) => s + (u.capacity || 0), 0);
            const locOccupied = locUnits.reduce((s: number, u: any) => s + (occCountMap.get(u.id) || 0), 0);

            return (
              <Card key={loc.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base">{loc.name}</CardTitle>
                      {loc.address && <span className="text-xs text-muted-foreground">· {loc.address}</span>}
                      <Badge variant={loc.is_active ? "default" : "secondary"} className="text-[10px]">
                        {loc.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{locOccupied}/{locCapacity} vagas</Badge>
                      {canWrite && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingLocation(loc); setLocationDialog(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canWrite && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEditingUnit({ location_id: loc.id }); setUnitDialog(true); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Quarto
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {locUnits.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">Nenhum quarto cadastrado neste local.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {locUnits.map((u: any) => {
                        const occ = occCountMap.get(u.id) || 0;
                        const full = occ >= u.capacity;
                        return (
                          <div
                            key={u.id}
                            onClick={() => navigate(`ocupacao?unitId=${u.id}`)}
                            className={`rounded-md border p-2.5 flex flex-col gap-1 cursor-pointer transition-all hover:ring-2 hover:ring-primary/20 ${full ? "border-destructive/40 bg-destructive/5" : "bg-muted/30 hover:bg-muted/50"}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-sm font-medium truncate">{u.name}</span>
                              {canWrite && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5 shrink-0" 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setEditingUnit(u); 
                                    setUnitDialog(true); 
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              <Badge variant={full ? "destructive" : "outline"} className="text-[10px] h-4 px-1">
                                {occ}/{u.capacity}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{genderLabel(u.gender_restriction)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <LodgingLocationFormDialog
        open={locationDialog}
        onOpenChange={(o) => { setLocationDialog(o); if (!o) setEditingLocation(null); }}
        location={editingLocation}
        events={[]}
        stageContext={stageContext}
        onSubmit={(v) => editingLocation ? updateLocation.mutate({ id: editingLocation.id, ...v }) : createLocation.mutate(v)}
        isPending={createLocation.isPending || updateLocation.isPending}
      />
      <LodgingUnitFormDialog
        open={unitDialog}
        onOpenChange={(o) => { setUnitDialog(o); if (!o) setEditingUnit(null); }}
        unit={editingUnit}
        locations={locations}
        onSubmit={(v) => editingUnit?.id ? updateUnit.mutate({ id: editingUnit.id, ...v }) : createUnit.mutate(v)}
        isPending={createUnit.isPending || updateUnit.isPending}
      />
    </div>
  );
}
