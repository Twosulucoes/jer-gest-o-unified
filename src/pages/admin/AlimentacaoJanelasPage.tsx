import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Clock, Search, Filter, Copy, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import MealWindowFormDialog, { type MealWindowFormValues } from "@/components/admin/MealWindowFormDialog";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";


export default function AlimentacaoJanelasPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const selectedEventId = useActiveEventId();
  const { stageId, isStageScoped } = useStageScope();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  // Removido query local de events - o contexto global de evento já deve estar provido pelo layout ou EventContext


  const { data: mealTypes = [] } = useQuery({
    queryKey: ["meal_types", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("meal_types").select("*").eq("event_id", selectedEventId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: windows, isLoading } = useQuery({
    queryKey: ["meal_windows", selectedEventId, stageId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("meal_windows").select("*").eq("event_id", selectedEventId);
      if (isStageScoped && stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q.order("service_date").order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const mealTypesMap = new Map(mealTypes.map((m) => [m.id, m]));

  const createMut = useMutation({
    mutationFn: async (v: MealWindowFormValues) => {
      const payload: any = {
        event_id: selectedEventId,
        meal_type_id: v.meal_type_id,
        label: v.label || null,
        service_date: v.service_date,
        start_time: v.start_time,
        end_time: v.end_time,
        location: v.location || null,
        is_active: v.is_active,
      };
      if (isStageScoped && stageId) payload.event_stage_id = stageId;
      const { error } = await supabase.from("meal_windows").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_windows"] }); toast.success("Janela criada"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: MealWindowFormValues & { id: string }) => {
      const { error } = await supabase.from("meal_windows").update({
        meal_type_id: v.meal_type_id,
        label: v.label || null,
        service_date: v.service_date,
        start_time: v.start_time,
        end_time: v.end_time,
        location: v.location || null,
        is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_windows"] }); toast.success("Janela atualizada"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_windows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_windows"] }); toast.success("Janela excluída"); },
    onError: (e: Error) => toast.error("Erro ao excluir: " + e.message),
  });

  const toggleStatusMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("meal_windows").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meal_windows"] }),
    onError: (e: Error) => toast.error("Erro ao alterar status: " + e.message),
  });

  const filteredWindows = useMemo(() => {
    if (!windows) return [];
    return windows.filter((w: any) => {
      const mt = mealTypesMap.get(w.meal_type_id);
      const matchesSearch = !searchTerm || 
        mt?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.location?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && w.is_active) ||
        (statusFilter === "inactive" && !w.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [windows, searchTerm, statusFilter, mealTypesMap]);

  const handleSubmit = (v: MealWindowFormValues) => {
    if (editing && !editing.isCopy) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };


  const formatDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Janelas de Refeição</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de janelas de serviço de alimentação</p>
        </div>
        {canWrite && selectedEventId && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!mealTypes.length}>
            <Plus className="mr-2 h-4 w-4" />Nova janela
          </Button>
        )}
      </div>

      {/* Removido card redundante de seleção de evento, pois o evento ativo já é controlado globalmente */}


      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !windows?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma janela cadastrada</p>
          <p className="text-sm text-muted-foreground mt-1">Cadastre tipos de refeição antes de criar janelas.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {windows.map((w) => {
                const mt = mealTypesMap.get(w.meal_type_id);
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{mt?.name ?? "—"}</TableCell>
                    <TableCell>{w.label || "—"}</TableCell>
                    <TableCell>{formatDate(w.service_date)}</TableCell>
                    <TableCell className="font-mono text-xs">{w.start_time?.slice(0, 5)} – {w.end_time?.slice(0, 5)}</TableCell>
                    <TableCell>{w.location || "—"}</TableCell>
                    <TableCell><Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Ativa" : "Inativa"}</Badge></TableCell>
                    {canWrite && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(w); setDialogOpen(true); }}>
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

      <MealWindowFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        window={editing}
        mealTypes={mealTypes}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
