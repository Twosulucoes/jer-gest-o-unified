import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Pencil, Clock, Search, Filter, Copy, Trash2, CheckCircle, XCircle, Calendar, Sparkles } from "lucide-react";
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
import MealWindowFormDialog, { type MealWindowFormValues } from "@/components/admin/MealWindowFormDialog";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";

export default function AlimentacaoJanelasPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const selectedEventId = useActiveEventId();
  const { stageId, isStageScoped } = useStageScope();
  const canWrite = hasRole("admin") || hasRole("secretaria");

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
      let q = (supabase as any).from("meal_windows").select("*, meal_locations(name)").eq("event_id", selectedEventId);
      if (isStageScoped && stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q.order("service_date").order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const mealTypesMap = useMemo(() => new Map(mealTypes.map((m) => [m.id, m])), [mealTypes]);

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
        meal_window_location_id: v.meal_window_location_id || null,
        is_active: v.is_active,
      };
      if (isStageScoped && stageId) payload.event_stage_id = stageId;
      
      const { data: window, error } = await supabase.from("meal_windows").insert(payload).select().single();
      if (error) throw error;

      if (v.restrict_eligibility && v.eligibility_rules && v.eligibility_rules.length > 0) {
        const rulesPayload = v.eligibility_rules.map(r => ({
          meal_window_id: window.id,
          eligibility_type: r.eligibility_type,
          participant_type_value: r.participant_type_value,
          reference_id: r.reference_id
        }));
        const { error: rulesError } = await (supabase as any).from("meal_window_eligibility").insert(rulesPayload);
        if (rulesError) throw rulesError;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_windows"] }); toast.success("Janela criada"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: MealWindowFormValues & { id: string }) => {
      const { error } = await (supabase as any).from("meal_windows").update({
        meal_type_id: v.meal_type_id,
        label: v.label || null,
        service_date: v.service_date,
        start_time: v.start_time,
        end_time: v.end_time,
        location: v.location || null,
        meal_window_location_id: v.meal_window_location_id || null,
        is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;

      // Sync rules
      await (supabase as any).from("meal_window_eligibility").delete().eq("meal_window_id", id);
      
      if (v.restrict_eligibility && v.eligibility_rules && v.eligibility_rules.length > 0) {
        const rulesPayload = v.eligibility_rules.map(r => ({
          meal_window_id: id,
          eligibility_type: r.eligibility_type,
          participant_type_value: r.participant_type_value,
          reference_id: r.reference_id
        }));
        const { error: rulesError } = await (supabase as any).from("meal_window_eligibility").insert(rulesPayload);
        if (rulesError) throw rulesError;
      }
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

  const generateDefaultWindows = async () => {
    if (!selectedEventId) return;
    const dateToUse = filterDate || new Date().toISOString().split('T')[0];
    
    setIsGenerating(true);
    try {
      const standards = [
        { slug: 'cafe', start: '06:00', end: '09:00', label: 'Café da Manhã' },
        { slug: 'almoco', start: '11:30', end: '14:30', label: 'Almoço' },
        { slug: 'janta', start: '18:30', end: '21:30', label: 'Jantar' },
      ];

      const toInsert = [];
      for (const std of standards) {
        const mType = mealTypes.find(t => t.slug?.toLowerCase() === std.slug);
        if (mType) {
          const alreadyExists = windows?.some(w => 
            w.service_date === dateToUse && 
            w.meal_type_id === mType.id
          );
          
          if (!alreadyExists) {
            toInsert.push({
              event_id: selectedEventId,
              event_stage_id: stageId || null,
              meal_type_id: mType.id,
              label: std.label,
              service_date: dateToUse,
              start_time: std.start,
              end_time: std.end,
              is_active: true
            });
          }
        }
      }

      if (toInsert.length === 0) {
        toast.info("Janelas padrão já existem para esta data");
        return;
      }

      const { error } = await supabase.from("meal_windows").insert(toInsert);
      if (error) throw error;

      toast.success(`${toInsert.length} janelas geradas para ${dateToUse}`);
      qc.invalidateQueries({ queryKey: ["meal_windows"] });
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredWindows = useMemo(() => {
    if (!windows) return [];
    return windows.filter((w: any) => {
      const mt = mealTypesMap.get(w.meal_type_id);
      const matchesSearch = !searchTerm || 
        mt?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.meal_locations?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && w.is_active) ||
        (statusFilter === "inactive" && !w.is_active);

      const matchesDate = !filterDate || w.service_date === filterDate;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [windows, searchTerm, statusFilter, filterDate, mealTypesMap]);

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
          <div className="flex gap-2">
            <Button variant="outline" onClick={generateDefaultWindows} disabled={!mealTypes.length || isGenerating || !filterDate}>
              <Sparkles className="mr-2 h-4 w-4" />Gerar Padrão
            </Button>
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!mealTypes.length}>
              <Plus className="mr-2 h-4 w-4" />Nova janela
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
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Calendar className="h-4 w-4 text-muted-foreground hidden md:block" />
          <Input 
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full md:w-[150px] h-10"
          />
          <Filter className="h-4 w-4 text-muted-foreground hidden md:block" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !filteredWindows?.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma janela encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            {filterDate 
              ? `Não existem janelas para o dia ${filterDate.split('-').reverse().join('/')}. Clique em 'Gerar Padrão' para criá-las.`
              : "Ajuste os filtros ou crie uma nova janela."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead>Data / Horário</TableHead>
                <TableHead className="hidden md:table-cell">Local</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                {canWrite && <TableHead className="w-[120px] text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWindows.map((w) => {
                const mt = mealTypesMap.get(w.meal_type_id);
                return (
                  <TableRow key={w.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-semibold text-primary">{mt?.name ?? "—"}</TableCell>
                    <TableCell className="max-w-[150px] truncate">{w.label || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{formatDate(w.service_date)}</span>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">{w.start_time?.slice(0, 5)} – {w.end_time?.slice(0, 5)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {w.meal_locations?.name || w.location || "—"}
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 hover:bg-transparent group"
                          onClick={() => toggleStatusMut.mutate({ id: w.id, is_active: !w.is_active })}
                        >
                          <Badge 
                            variant={w.is_active ? "default" : "secondary"}
                            className="flex items-center gap-1 cursor-pointer group-hover:ring-1 group-hover:ring-primary/30"
                          >
                            {w.is_active ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {w.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </Button>
                      ) : (
                        <Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Ativa" : "Inativa"}</Badge>
                      )}
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => { setEditing(w); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" onClick={() => { setEditing({ ...w, id: undefined, isCopy: true }); setDialogOpen(true); }}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Janela?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Isso removerá permanentemente a janela de serviço.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMut.mutate(w.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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