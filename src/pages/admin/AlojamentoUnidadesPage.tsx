import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStageScope } from "@/hooks/useStageScope";
import { toast } from "sonner";
import { Plus, Pencil, BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LodgingUnitFormDialog, { type LodgingUnitFormValues } from "@/components/admin/LodgingUnitFormDialog";

export default function AlojamentoUnidadesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const { stageId, isStageScoped } = useStageScope();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: stageInfo } = useQuery({
    queryKey: ["stage_info", stageId],
    queryFn: async () => {
      if (!stageId) return null;
      const { data } = await supabase.from("event_stages").select("id, name, kind, event_id").eq("id", stageId).maybeSingle();
      return data;
    },
    enabled: !!stageId,
  });

  const { data: locations = [] } = useQuery({
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

  const { data: units, isLoading } = useQuery({
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

  const locationsMap = new Map(locations.map((l: any) => [l.id, l]));
  const genderLabel = (g: string) => g === "male" ? "Masculino" : g === "female" ? "Feminino" : "Misto";

  const createMut = useMutation({
    mutationFn: async (v: LodgingUnitFormValues) => {
      const { error } = await (supabase.from("lodging_units") as any).insert({
        event_id: stageInfo!.event_id, event_stage_id: stageId,
        location_id: v.location_id, name: v.name, capacity: v.capacity,
        gender_restriction: v.gender_restriction, notes: v.notes || null, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_units"] }); toast.success("Quarto criado"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: LodgingUnitFormValues & { id: string }) => {
      const { error } = await supabase.from("lodging_units").update({
        location_id: v.location_id, name: v.name, capacity: v.capacity,
        gender_restriction: v.gender_restriction, notes: v.notes || null, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_units"] }); toast.success("Quarto atualizado"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

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
          <p className="text-sm text-muted-foreground mt-1">Quartos e unidades de hospedagem desta etapa</p>
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

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !units?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <BedDouble className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum quarto cadastrado para esta etapa</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarto</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Ocupação</TableHead>
                <TableHead>Gênero</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u: any) => {
                const occ = occCountMap.get(u.id) || 0;
                const full = occ >= u.capacity;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{locationsMap.get(u.location_id)?.name ?? "—"}</TableCell>
                    <TableCell>{u.capacity}</TableCell>
                    <TableCell><Badge variant={full ? "destructive" : "outline"}>{occ}/{u.capacity}</Badge></TableCell>
                    <TableCell>{genderLabel(u.gender_restriction)}</TableCell>
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
      />
    </div>
  );
}
