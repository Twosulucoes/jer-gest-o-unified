import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStageScope } from "@/hooks/useStageScope";
import { useStageInfo, useLodgingLocations } from "@/hooks/useLodgingAdmin";
import { toast } from "sonner";
import { Plus, Pencil, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LodgingLocationFormDialog, { type LodgingLocationFormValues } from "@/components/admin/LodgingLocationFormDialog";
import type { StageContext } from "@/components/admin/VehicleFormDialog";

export default function AlojamentoLocaisPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const { stageId, isStageScoped } = useStageScope();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: stageInfo } = useStageInfo(stageId);
  const stageContext: StageContext | undefined = stageInfo
    ? { id: stageInfo.id, name: stageInfo.name, kind: stageInfo.kind, event_id: stageInfo.event_id }
    : undefined;

  const { data: locations, isLoading } = useLodgingLocations(stageId);

  const createMut = useMutation({
    mutationFn: async (v: LodgingLocationFormValues) => {
      const { error } = await (supabase.from("lodging_locations") as any).insert({
        event_id: stageInfo!.event_id, event_stage_id: stageId,
        name: v.name, address: v.address || null, notes: v.notes || null, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_locations"] }); toast.success("Local criado"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: LodgingLocationFormValues & { id: string }) => {
      const { error } = await supabase.from("lodging_locations").update({
        name: v.name, address: v.address || null, notes: v.notes || null, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lodging_locations"] }); toast.success("Local atualizado"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  if (!isStageScoped || !stageId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
        <Building className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Acesse pelo menu de uma etapa</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Locais de Alojamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Hotéis, escolas e demais locais de hospedagem desta etapa</p>
        </div>
        {canWrite && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo local
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !locations?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Building className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum local cadastrado para esta etapa</p>
          {canWrite && (
            <Button size="sm" className="mt-3" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Cadastrar local
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Quartos</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.address || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{(l.units ?? []).length} quarto{(l.units ?? []).length !== 1 ? "s" : ""}</Badge>
                  </TableCell>
                  <TableCell><Badge variant={l.is_active ? "default" : "secondary"}>{l.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(l); setDialogOpen(true); }}>
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

      <LodgingLocationFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        location={editing}
        events={[]}
        stageContext={stageContext}
        onSubmit={(v) => editing ? updateMut.mutate({ id: editing.id, ...v }) : createMut.mutate(v)}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
