import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStageScope } from "@/hooks/useStageScope";
import { useStageInfo, useLodgingLocations, useLodgingUnits } from "@/hooks/useLodgingAdmin";
import { useLodgingOccupancy } from "@/hooks/useLodgingOccupancy";
import { toast } from "sonner";
import { Plus, Pencil, BedDouble, Accessibility, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LodgingUnitFormDialog, { type LodgingUnitFormValues } from "@/components/admin/LodgingUnitFormDialog";
import { genderRestrictionLabel } from "@/lib/alojamento/labels";

export default function AlojamentoUnidadesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const { stageId, isStageScoped } = useStageScope();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: stageInfo } = useStageInfo(stageId);
  const { data: locations = [] } = useLodgingLocations(stageId);
  const { data: units, isLoading } = useLodgingUnits(stageId);
  const { countsByUnit } = useLodgingOccupancy(stageId);
  const activeOccupancyByUnit = (unitId: string) =>
    countsByUnit.get(unitId)?.active ?? 0;

  const locationsMap = new Map(locations.map((l: any) => [l.id, l]));
  const genderLabel = (g: string) => genderRestrictionLabel(g);

  function buildPayload(v: LodgingUnitFormValues) {
    const features = v.is_accessible && v.accessible_features.length > 0
      ? { items: v.accessible_features }
      : null;
    return {
      location_id: v.location_id,
      name: v.name,
      capacity: v.capacity,
      gender_restriction: v.gender_restriction,
      notes: v.notes || null,
      is_active: v.is_active,
      floor: v.floor || null,
      is_accessible: v.is_accessible,
      accessible_features_json: features,
      gender_zone: v.gender_zone || null,
      min_age_policy: v.min_age_policy === "none" ? null : v.min_age_policy,
    };
  }

  const createMut = useMutation({
    mutationFn: async (v: LodgingUnitFormValues) => {
      const { error } = await (supabase.from("lodging_units") as any).insert({
        event_id: stageInfo!.event_id,
        event_stage_id: stageId,
        ...buildPayload(v),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_units"] }); toast.success("Quarto criado"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: LodgingUnitFormValues & { id: string }) => {
      const { error } = await (supabase.from("lodging_units") as any).update(buildPayload(v)).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_units"] }); toast.success("Quarto atualizado"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  // ----------------------------------------------------------
  // Filtros (Etapa 5)
  // ----------------------------------------------------------
  const [search, setSearch] = useState("");
  const [accessibilityFilter, setAccessibilityFilter] = useState<string>("all");
  const [floorFilter, setFloorFilter] = useState<string>("all");

  const floorOptions = useMemo(() => {
    const set = new Set<string>();
    (units ?? []).forEach((u: any) => {
      if (u.floor) set.add(String(u.floor));
    });
    return Array.from(set).sort();
  }, [units]);

  const filteredUnits = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (units ?? []).filter((u: any) => {
      if (term && !u.name.toLowerCase().includes(term)) return false;
      if (accessibilityFilter === "yes" && !u.is_accessible) return false;
      if (accessibilityFilter === "no" && u.is_accessible) return false;
      if (floorFilter !== "all" && String(u.floor ?? "") !== floorFilter) return false;
      return true;
    });
  }, [units, search, accessibilityFilter, floorFilter]);

  const accessibleCount = useMemo(
    () => (units ?? []).filter((u: any) => u.is_accessible).length,
    [units],
  );

  if (!isStageScoped || !stageId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
        <BedDouble className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Acesse pelo menu de uma etapa</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Quartos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quartos e unidades de hospedagem desta etapa
            {accessibleCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-blue-700 dark:text-blue-400">
                · <Accessibility className="h-3 w-3" /> {accessibleCount} PCD
              </span>
            )}
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!locations.length}>
            <Plus className="mr-2 h-4 w-4" /> Novo quarto
          </Button>
        )}
      </div>

      {locations.length === 0 && !isLoading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 text-sm text-amber-800 dark:text-amber-300">
          Cadastre ao menos um local (hotel/escola) antes de criar quartos. Acesse a aba <strong>Locais</strong>.
        </div>
      )}

      {/* Filtros */}
      {(units?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Input
              placeholder="Buscar por nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
            <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
          <Select value={accessibilityFilter} onValueChange={setAccessibilityFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Acessibilidade: todos</SelectItem>
              <SelectItem value="yes">Apenas PCD</SelectItem>
              <SelectItem value="no">Sem acessibilidade</SelectItem>
            </SelectContent>
          </Select>
          {floorOptions.length > 0 && (
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Andar: todos</SelectItem>
                {floorOptions.map((f) => (
                  <SelectItem key={f} value={f}>Andar {f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !units?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <BedDouble className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum quarto cadastrado para esta etapa</p>
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-12 text-center">
          <BedDouble className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">Nenhum quarto bate com os filtros aplicados</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarto</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Andar</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Ocupação</TableHead>
                <TableHead>Gênero</TableHead>
                <TableHead>PCD</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUnits.map((u: any) => {
                const occ = activeOccupancyByUnit(u.id);
                const full = occ >= u.capacity;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{locationsMap.get(u.location_id)?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.floor || "—"}</TableCell>
                    <TableCell>{u.capacity}</TableCell>
                    <TableCell><Badge variant={full ? "destructive" : "outline"}>{occ}/{u.capacity}</Badge></TableCell>
                    <TableCell>{genderLabel(u.gender_restriction)}</TableCell>
                    <TableCell>
                      {u.is_accessible ? (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-400"
                          title="Acessível para PCD"
                        >
                          <Accessibility className="h-4 w-4" />
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(u); setDialogOpen(true); }}>
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

      <LodgingUnitFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        unit={editing}
        locations={locations}
        onSubmit={(v) => editing ? updateMut.mutate({ id: editing.id, ...v }) : createMut.mutate(v)}
        isPending={createMut.isPending || updateMut.isPending}
        activeOccupancies={editing ? activeOccupancyByUnit(editing.id) : 0}
      />
    </div>
  );
}
