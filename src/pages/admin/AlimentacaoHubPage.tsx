import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import {
  Plus, Pencil, UtensilsCrossed, Clock, ClipboardList, LayoutDashboard, AlertTriangle, ArrowRight, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MealTypeFormDialog, { type MealTypeFormValues } from "@/components/admin/MealTypeFormDialog";
import MealWindowFormDialog, { type MealWindowFormValues } from "@/components/admin/MealWindowFormDialog";
import type { StageContext } from "@/components/admin/VehicleFormDialog";

const KIND_LABELS: Record<string, string> = {
  classificatoria: "Classificatória", semifinal: "Semifinal",
  final: "Final", legado: "Legado", outro: "Outro",
};

type TabKey = "janelas" | "tipos";

export default function AlimentacaoHubPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { stageId } = useParams<{ stageId: string }>();
  const { hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const canWrite = hasRole("admin") || hasRole("secretaria");

  const [tab, setTab] = useState<TabKey>("janelas");
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

  const [typeDialog, setTypeDialog] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [windowDialog, setWindowDialog] = useState(false);
  const [editingWindow, setEditingWindow] = useState<any>(null);

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

  const { data: mealTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ["meal_types", selectedStageId],
    queryFn: async () => {
      if (!selectedStageId) return [];
      const { data, error } = await (supabase.from("meal_types") as any).select("*")
        .eq("event_stage_id", selectedStageId).order("sort_order");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!selectedStageId,
  });

  const { data: windows = [], isLoading: loadingWindows } = useQuery({
    queryKey: ["meal_windows", selectedStageId],
    queryFn: async () => {
      if (!selectedStageId) return [];
      const { data, error } = await (supabase.from("meal_windows") as any).select("*")
        .eq("event_stage_id", selectedStageId).order("service_date").order("start_time");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!selectedStageId,
  });

  const typesMap = new Map(mealTypes.map(m => [m.id, m]));

  const createType = useMutation({
    mutationFn: async (v: MealTypeFormValues) => {
      const { error } = await (supabase.from("meal_types") as any).insert({
        event_id: selectedStage!.event_id, event_stage_id: selectedStageId,
        name: v.name, slug: v.slug, sort_order: v.sort_order, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_types"] }); toast.success("Tipo criado"); setTypeDialog(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateType = useMutation({
    mutationFn: async ({ id, ...v }: MealTypeFormValues & { id: string }) => {
      const { error } = await supabase.from("meal_types").update({
        name: v.name, slug: v.slug, sort_order: v.sort_order, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_types"] }); toast.success("Tipo atualizado"); setTypeDialog(false); setEditingType(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createWindow = useMutation({
    mutationFn: async (v: MealWindowFormValues) => {
      const { error } = await (supabase.from("meal_windows") as any).insert({
        event_id: selectedStage!.event_id, event_stage_id: selectedStageId,
        meal_type_id: v.meal_type_id, label: v.label || null,
        service_date: v.service_date, start_time: v.start_time, end_time: v.end_time,
        location: v.location || null, is_active: v.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_windows"] }); toast.success("Janela criada"); setWindowDialog(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateWindow = useMutation({
    mutationFn: async ({ id, ...v }: MealWindowFormValues & { id: string }) => {
      const { error } = await supabase.from("meal_windows").update({
        meal_type_id: v.meal_type_id, label: v.label || null,
        service_date: v.service_date, start_time: v.start_time, end_time: v.end_time,
        location: v.location || null, is_active: v.is_active,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meal_windows"] }); toast.success("Janela atualizada"); setWindowDialog(false); setEditingWindow(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const formatDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
  const addLabel: Record<TabKey, string> = { janelas: "Nova janela", tipos: "Novo tipo" };

  const handleAdd = () => {
    if (!selectedStageId) return;
    if (tab === "janelas") { setEditingWindow(null); setWindowDialog(true); }
    else { setEditingType(null); setTypeDialog(true); }
  };

  const canAdd = !!selectedStageId && canWrite && (tab !== "janelas" || mealTypes.length > 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Alimentação</h1>
          <p className="text-sm text-muted-foreground mt-1">Janelas de serviço e tipos de refeição por etapa</p>
        </div>
        {canWrite && (
          <Button onClick={handleAdd} disabled={!canAdd}>
            <Plus className="mr-2 h-4 w-4" />{addLabel[tab]}
          </Button>
        )}
      </div>

      {/* Seletor de etapa - Oculto se já estivermos no contexto de uma etapa via URL */}
      {!stageId && (
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
      )}

      {/* Atalhos operacionais */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/admin/alimentacao/consumo")}>
          <CardContent className="flex items-center gap-3 p-4">
            <ClipboardList className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm">Registrar consumo</p>
              <p className="text-xs text-muted-foreground">Operação diária de refeições</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/admin/alimentacao/dashboard")}>
          <CardContent className="flex items-center gap-3 p-4">
            <LayoutDashboard className="h-8 w-8 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm">Dashboard</p>
              <p className="text-xs text-muted-foreground">Totais e estatísticas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!selectedStageId ? (
        <EmptyState icon={<UtensilsCrossed className="h-10 w-10" />} message="Selecione uma etapa para visualizar ou cadastrar dados" />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-2 max-w-xs">
            <TabsTrigger value="janelas" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Janelas
              {windows.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">{windows.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="tipos" className="gap-1.5">
              <UtensilsCrossed className="h-3.5 w-3.5" /> Tipos
              {mealTypes.length > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">{mealTypes.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="janelas" className="mt-4">
            {mealTypes.length === 0 ? (
              <NeedsDependency
                message="Cadastre ao menos um tipo de refeição (ex: Almoço) antes de criar janelas."
                actionLabel="Cadastrar tipo agora"
                onAction={() => { setEditingType(null); setTypeDialog(true); setTab("tipos"); }}
              />
            ) : loadingWindows ? <LoadingSkeleton /> : windows.length === 0 ? (
              <EmptyState icon={<Clock className="h-10 w-10" />} message="Nenhuma janela para esta etapa">
                {canWrite && <Button size="sm" onClick={() => { setEditingWindow(null); setWindowDialog(true); }} className="mt-3"><Plus className="h-4 w-4 mr-1" />Nova janela</Button>}
              </EmptyState>
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
                    {windows.map(w => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{typesMap.get(w.meal_type_id)?.name ?? "—"}</TableCell>
                        <TableCell>{w.label || "—"}</TableCell>
                        <TableCell>{formatDate(w.service_date)}</TableCell>
                        <TableCell className="font-mono text-xs">{w.start_time?.slice(0, 5)} – {w.end_time?.slice(0, 5)}</TableCell>
                        <TableCell>{w.location || "—"}</TableCell>
                        <TableCell><Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Ativa" : "Inativa"}</Badge></TableCell>
                        {canWrite && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingWindow(w); setWindowDialog(true); }}>
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

          <TabsContent value="tipos" className="mt-4">
            {loadingTypes ? <LoadingSkeleton /> : mealTypes.length === 0 ? (
              <EmptyState icon={<UtensilsCrossed className="h-10 w-10" />} message="Nenhum tipo para esta etapa">
                {canWrite && <Button size="sm" onClick={() => { setEditingType(null); setTypeDialog(true); }} className="mt-3"><Plus className="h-4 w-4 mr-1" />Novo tipo</Button>}
              </EmptyState>
            ) : (
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead className="w-[60px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mealTypes.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{m.slug}</TableCell>
                        <TableCell>{m.sort_order}</TableCell>
                        <TableCell><Badge variant={m.is_active ? "default" : "secondary"}>{m.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                        {canWrite && (
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingType(m); setTypeDialog(true); }}>
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

      <MealTypeFormDialog
        open={typeDialog}
        onOpenChange={(o) => { setTypeDialog(o); if (!o) setEditingType(null); }}
        mealType={editingType}
        events={events}
        stageContext={stageContext}
        onSubmit={(v) => editingType ? updateType.mutate({ id: editingType.id, ...v }) : createType.mutate(v)}
        isPending={createType.isPending || updateType.isPending}
      />
      <MealWindowFormDialog
        open={windowDialog}
        onOpenChange={(o) => { setWindowDialog(o); if (!o) setEditingWindow(null); }}
        window={editingWindow}
        mealTypes={mealTypes}
        onSubmit={(v) => editingWindow ? updateWindow.mutate({ id: editingWindow.id, ...v }) : createWindow.mutate(v)}
        isPending={createWindow.isPending || updateWindow.isPending}
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
