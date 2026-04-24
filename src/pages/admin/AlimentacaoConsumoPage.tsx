import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  UtensilsCrossed, QrCode, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";

export default function AlimentacaoConsumoPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const { isStageScoped, stageId } = useStageScope();
  const [selectedWindowId, setSelectedWindowId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const canOperate = hasRole("admin") || hasRole("secretaria") || hasRole("alimentacao");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
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

  const { data: windows = [], isLoading: windowsLoading } = useQuery({
    queryKey: ["meal_windows", selectedEventId, stageId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      // Carrega TODAS as janelas ativas do evento; filtramos por etapa em memória
      // para conseguir tolerar janelas legadas sem event_stage_id (fallback).
      const { data, error } = await supabase
        .from("meal_windows")
        .select("*")
        .eq("event_id", selectedEventId)
        .eq("is_active", true)
        .order("service_date")
        .order("start_time");
      if (error) throw error;
      const all = data ?? [];
      if (!isStageScoped || !stageId) return all;
      const ofStage = all.filter((w: any) => w.event_stage_id === stageId);
      const legacy = all.filter((w: any) => !w.event_stage_id);
      // Se a etapa tem janelas próprias, usa só elas + legadas (sem stage).
      // Se não tem nenhuma, mostra todas do evento como fallback (com aviso na UI).
      return ofStage.length > 0 ? [...ofStage, ...legacy] : all;
    },
    enabled: !!selectedEventId,
  });

  const stageWindowsCount = windows.filter((w: any) => w.event_stage_id === stageId).length;
  const showingFallbackWindows = isStageScoped && !!stageId && stageWindowsCount === 0 && windows.length > 0;

  const mealTypesMap = new Map(mealTypes.map((m) => [m.id, m]));

  // Load consumptions for all windows of the event/stage to allow "All Windows" filter
  const { data: consumptions = [], isLoading: consumptionsLoading } = useQuery({
    queryKey: ["meal_consumptions", selectedEventId, stageId, windows.length],
    queryFn: async () => {
      if (!selectedEventId || windows.length === 0) return [];
      
      const windowIds = windows.map(w => w.id);
      const { data, error } = await supabase
        .from("meal_consumptions")
        .select("*")
        .in("meal_window_id", windowIds)
        .order("consumed_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId && windows.length > 0,
  });

  // Load participant details for consumptions
  const consumptionParticipantIds = consumptions.map((c) => c.participant_id);
  const { data: consumptionParticipants = [] } = useQuery({
    queryKey: ["consumption-participants", consumptionParticipantIds],
    queryFn: async () => {
      if (!consumptionParticipantIds.length) return [];
      const { data, error } = await supabase.from("participants").select("id, person_id").in("id", consumptionParticipantIds);
      if (error) throw error;
      return data;
    },
    enabled: consumptionParticipantIds.length > 0,
  });

  const consumptionPersonIds = consumptionParticipants.map((p) => p.person_id);
  const { data: consumptionPeople = [] } = useQuery({
    queryKey: ["consumption-people", consumptionPersonIds],
    queryFn: async () => {
      if (!consumptionPersonIds.length) return [];
      const { data, error } = await supabase.from("people").select("id, full_name, cpf, food_restrictions").in("id", consumptionPersonIds);
      if (error) throw error;
      return data;
    },
    enabled: consumptionPersonIds.length > 0,
  });

  const partMap = new Map(consumptionParticipants.map((p) => [p.id, p]));
  const pplMap = new Map(consumptionPeople.map((p) => [p.id, p]));
  const getPersonForConsumption = (participantId: string) => {
    const pt = partMap.get(participantId);
    return pt ? pplMap.get(pt.person_id) : null;
  };

  const consumedParticipantIds = new Set(consumptions.map((c) => c.participant_id));

  const filteredConsumptions = useMemo(() => {
    return consumptions.filter((c) => {
      const matchesWindow = selectedWindowId === "all" || c.meal_window_id === selectedWindowId;
      const matchesStatus = statusFilter === "all" || c.method === statusFilter;
      
      const person = getPersonForConsumption(c.participant_id);
      const matchesSearch = !searchTerm || 
        person?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person?.cpf?.includes(searchTerm) ||
        c.participant_id.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesWindow && matchesStatus && matchesSearch;
    });
  }, [consumptions, selectedWindowId, statusFilter, searchTerm, pplMap, partMap]);

  const selectedWindow = windows.find((w) => w.id === selectedWindowId);
  const selectedMealType = selectedWindow ? mealTypesMap.get(selectedWindow.meal_type_id) : null;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Registro de Consumo</h1>
        <p className="text-sm text-muted-foreground mt-1">Operação de alimentação — registrar refeições</p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Janela de Refeição
                {windows.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({windows.length} {windows.length === 1 ? "janela" : "janelas"}
                    {isStageScoped && stageId && stageWindowsCount > 0 ? " desta etapa" : ""})
                  </span>
                )}
              </label>
              <Select value={selectedWindowId} onValueChange={setSelectedWindowId} disabled={!selectedEventId || windowsLoading}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={windowsLoading ? "Carregando…" : (windows.length === 0 ? "Nenhuma janela cadastrada" : "Filtrar por janela")} />
                </SelectTrigger>
                <SelectContent className="max-h-[360px]">
                  <SelectItem value="all">Todas as janelas (evento/etapa)</SelectItem>
                  {(() => {
                    const byDate = new Map<string, any[]>();
                    windows.forEach((w: any) => {
                      const k = w.service_date;
                      if (!byDate.has(k)) byDate.set(k, []);
                      byDate.get(k)!.push(w);
                    });
                    const dates = Array.from(byDate.keys()).sort();
                    return dates.map((d) => {
                      const items = byDate.get(d)!;
                      const dateLabel = new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
                      return (
                        <div key={d}>
                          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40">
                            {dateLabel}
                          </div>
                          {items.map((w: any) => {
                            const mt = mealTypesMap.get(w.meal_type_id);
                            const title = w.label || mt?.name || "Refeição";
                            const time = `${w.start_time?.slice(0, 5)}–${w.end_time?.slice(0, 5)}`;
                            const stageHint = isStageScoped && stageId && !w.event_stage_id ? " · sem etapa" : "";
                            return (
                              <SelectItem key={w.id} value={w.id}>
                                <span className="font-medium">{title}</span>
                                <span className="text-muted-foreground"> · {time}</span>
                                {w.location ? <span className="text-muted-foreground"> · {w.location}</span> : null}
                                {stageHint && <span className="text-warning text-xs">{stageHint}</span>}
                              </SelectItem>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
              {showingFallbackWindows && (
                <p className="text-xs text-warning flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Esta etapa não possui janelas próprias — exibindo todas do evento.
                </p>
              )}
              {!windowsLoading && windows.length === 0 && (
                <div className="flex flex-col gap-2 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Não há janelas configuradas para esta etapa.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-fit"
                    onClick={() => window.location.href = `/admin/etapa/${stageId}/alimentacao/janelas`}
                  >
                    Configurar Janelas agora
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedWindowId && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Refeição</p>
              <p className="text-lg font-bold text-foreground">{selectedMealType?.name ?? "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Consumos registrados</p>
              <p className="text-2xl font-bold text-foreground">{consumptions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Local</p>
              <p className="text-sm font-medium text-foreground">{selectedWindow?.location || "Não definido"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Registrar consumo - Substituído por botão para PWA */}
      {canOperate && selectedWindowId && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 pb-6 flex flex-col items-center text-center space-y-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-bold text-foreground">Registrar Consumo</h3>
              <p className="text-sm text-muted-foreground mt-1">
                A operação de registro de consumo agora deve ser realizada através do módulo PWA para melhor experiência em dispositivos móveis e suporte a leitura de QR Code.
              </p>
            </div>
            <Button 
              size="lg" 
              className="w-full max-w-xs"
              onClick={() => window.location.href = "/pwa/alimentacao"}
            >
              Ir para Registro (PWA)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Consumption history */}
      {(selectedWindowId !== "all" || consumptions.length > 0) && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-base flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" /> Consumos registrados
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full md:w-64">
                  <input
                    type="text"
                    placeholder="Buscar por nome, CPF ou ID..."
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[130px]">
                    <SelectValue placeholder="Método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Métodos</SelectItem>
                    <SelectItem value="qr">QR Code</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {consumptionsLoading ? (
              <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div>
            ) : !filteredConsumptions.length ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Nenhum consumo encontrado com os filtros aplicados.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante</TableHead>
                    <TableHead>Janela</TableHead>
                    <TableHead>Restrições</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Método</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConsumptions.map((c) => {
                    const person = getPersonForConsumption(c.participant_id);
                    const win = windows.find(w => w.id === c.meal_window_id);
                    const mt = win ? mealTypesMap.get(win.meal_type_id) : null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{person?.full_name ?? "—"}</span>
                            <span className="text-[10px] text-muted-foreground font-mono uppercase">{person?.cpf || c.participant_id.slice(0, 8)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">{win?.label || mt?.name || "Refeição"}</span>
                            <span className="text-[10px] text-muted-foreground">{win?.service_date ? new Date(win.service_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {person?.food_restrictions ? (
                            <Badge variant="outline" className="text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700 text-[10px] h-5">
                              {person.food_restrictions}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {new Date(c.consumed_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] h-5">{c.method === "qr" ? "QR" : "Manual"}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty states */}
      {!selectedEventId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <UtensilsCrossed className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      )}
      {selectedEventId && !selectedWindowId && windows.length > 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <UtensilsCrossed className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione uma janela de refeição</p>
        </div>
      )}
    </div>
  );
}
