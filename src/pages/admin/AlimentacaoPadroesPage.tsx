import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Clock, Search, Copy, Trash2, CheckCircle, XCircle, Layers, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useActiveEventId } from "@/contexts/EventContext";
import MealWindowPatternFormDialog, { type MealWindowPatternFormValues } from "@/components/admin/MealWindowPatternFormDialog";

export default function AlimentacaoPadroesPage() {
  const qc = useQueryClient();
  const { hasRole, user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStageId, setSelectedStageId] = useState<string>("all");
  const selectedEventId = useActiveEventId();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: stages = [] } = useQuery({
    queryKey: ["event_stages", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("event_stages").select("id, name").eq("event_id", selectedEventId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

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

  const { data: patterns, isLoading } = useQuery({
    queryKey: ["meal_window_patterns", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("meal_window_patterns")
        .select("*, meal_locations(name), meal_types(name), event_stages(name)")
        .eq("event_id", selectedEventId)
        .order("event_stage_id", { nullsFirst: true })
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const createMut = useMutation({
    mutationFn: async (v: MealWindowPatternFormValues) => {
      const payload: any = {
        event_id: selectedEventId,
        event_stage_id: selectedStageId === "all" ? null : selectedStageId,
        meal_type_id: v.meal_type_id,
        label: v.label || null,
        start_time: v.start_time,
        end_time: v.end_time,
        meal_window_location_id: v.meal_window_location_id || null,
        is_active: v.is_active,
        created_by: user?.id
      };
      
      const { error } = await supabase.from("meal_window_patterns").insert(payload);
      if (error) throw error;

      // Audit log
      await supabase.from("db_operation_logs").insert({
        user_id: user?.id,
        module_name: "alimentacao",
        table_name: "meal_window_patterns",
        operation: "CREATE",
        event_id: selectedEventId,
        is_success: true,
        metadata: { payload }
      });
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["meal_window_patterns"] }); 
      toast.success("Padrão criado"); 
      setDialogOpen(false); 
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: MealWindowPatternFormValues & { id: string }) => {
      const payload = {
        meal_type_id: v.meal_type_id,
        label: v.label || null,
        start_time: v.start_time,
        end_time: v.end_time,
        meal_window_location_id: v.meal_window_location_id || null,
        is_active: v.is_active,
      };
      const { error } = await supabase.from("meal_window_patterns").update(payload).eq("id", id);
      if (error) throw error;

      // Audit log
      await supabase.from("db_operation_logs").insert({
        user_id: user?.id,
        module_name: "alimentacao",
        table_name: "meal_window_patterns",
        operation: "UPDATE",
        event_id: selectedEventId,
        is_success: true,
        metadata: { id, payload }
      });
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["meal_window_patterns"] }); 
      toast.success("Padrão atualizado"); 
      setDialogOpen(false); 
      setEditing(null); 
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meal_window_patterns").delete().eq("id", id);
      if (error) throw error;

      // Audit log
      await supabase.from("db_operation_logs").insert({
        user_id: user?.id,
        module_name: "alimentacao",
        table_name: "meal_window_patterns",
        operation: "DELETE",
        event_id: selectedEventId,
        is_success: true,
        metadata: { id }
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_window_patterns"] }); toast.success("Padrão excluído"); },
    onError: (e: Error) => toast.error("Erro ao excluir: " + e.message),
  });

  const duplicateFromStageMut = useMutation({
    mutationFn: async ({ fromStageId, toStageId }: { fromStageId: string; toStageId: string }) => {
      if (fromStageId === toStageId) throw new Error("Estágio de origem e destino devem ser diferentes");
      
      const { data: sourcePatterns, error: fetchError } = await supabase
        .from("meal_window_patterns")
        .select("*")
        .eq("event_stage_id", fromStageId === "global" ? null : fromStageId)
        .eq("event_id", selectedEventId);
      
      if (fetchError) throw fetchError;
      if (!sourcePatterns || sourcePatterns.length === 0) throw new Error("Nenhum padrão encontrado no estágio de origem");

      const toInsert = sourcePatterns.map(p => ({
        event_id: selectedEventId,
        event_stage_id: toStageId === "global" ? null : toStageId,
        meal_type_id: p.meal_type_id,
        label: p.label,
        start_time: p.start_time,
        end_time: p.end_time,
        meal_window_location_id: p.meal_window_location_id,
        is_active: p.is_active,
        created_by: user?.id
      }));

      const { error: insertError } = await supabase.from("meal_window_patterns").insert(toInsert);
      if (insertError) throw insertError;

      // Audit log
      await supabase.from("db_operation_logs").insert({
        user_id: user?.id,
        module_name: "alimentacao",
        table_name: "meal_window_patterns",
        operation: "DUPLICATE",
        event_id: selectedEventId,
        is_success: true,
        metadata: { fromStageId, toStageId, count: toInsert.length }
      });
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ["meal_window_patterns"] }); 
      toast.success("Padrões duplicados com sucesso"); 
    },
    onError: (e: Error) => toast.error("Erro ao duplicar: " + e.message),
  });

  const filteredPatterns = useMemo(() => {
    if (!patterns) return [];
    return patterns.filter((p: any) => {
      const matchesSearch = !searchTerm || 
        p.meal_types?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.meal_locations?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStage = selectedStageId === "all" || 
        (selectedStageId === "global" && !p.event_stage_id) ||
        p.event_stage_id === selectedStageId;

      return matchesSearch && matchesStage;
    });
  }, [patterns, searchTerm, selectedStageId]);

  const handleSubmit = (v: MealWindowPatternFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Padrões de Janelas</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure horários padrão para geração automática</p>
        </div>
        {canWrite && selectedEventId && (
          <div className="flex gap-2">
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!mealTypes.length}>
              <Plus className="mr-2 h-4 w-4" />Novo Padrão
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por tipo, rótulo ou local..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Estágio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Estágios</SelectItem>
              <SelectItem value="global">Global (Sem Estágio)</SelectItem>
              {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {canWrite && selectedEventId && selectedStageId !== "all" && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Duplicar padrões</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">Copie padrões de outro estágio para o estágio selecionado</p>
            </div>
          </div>
          <Select onValueChange={(val) => duplicateFromStageMut.mutate({ fromStageId: val, toStageId: selectedStageId })}>
            <SelectTrigger className="w-[200px] bg-white dark:bg-slate-950">
              <SelectValue placeholder="Duplicar de..." />
            </SelectTrigger>
            <SelectContent>
              {selectedStageId !== "global" && <SelectItem value="global">Global (Sem Estágio)</SelectItem>}
              {stages.filter(s => s.id !== selectedStageId).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !filteredPatterns?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum padrão encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Crie um novo padrão ou mude os filtros.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Estágio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Rótulo Padrão</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Local Padrão</TableHead>
                <TableHead>Status</TableHead>
                {canWrite && <TableHead className="w-[100px] text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatterns.map((p: any) => (
                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground">
                    {p.event_stages?.name || <Badge variant="outline" className="font-normal">Global</Badge>}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">{p.meal_types?.name}</TableCell>
                  <TableCell>{p.label || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.start_time?.slice(0, 5)} – {p.end_time?.slice(0, 5)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.meal_locations?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Padrão?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não afetará janelas já geradas, apenas futuras gerações.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMut.mutate(p.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MealWindowPatternFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        pattern={editing}
        mealTypes={mealTypes}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
        eventId={selectedEventId!}
      />
    </div>
  );
}
