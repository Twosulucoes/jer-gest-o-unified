import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  UtensilsCrossed,
  QrCode,
  AlertTriangle,
  Plus,
  Undo2,
} from "lucide-react";
import ReverseConsumptionDialog from "@/components/admin/ReverseConsumptionDialog";
import { ModuleStateBoundary } from "@/components/shared/ModuleStateBoundary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 20;
  const canOperate = hasRole("admin") || hasRole("secretaria") || hasRole("alimentacao");
  const canReverse = hasRole("admin");

  const [reverseTarget, setReverseTarget] = useState<{
    consumptionId: string;
    participantName: string | null;
    windowLabel: string | null;
  } | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedWindowId, statusFilter, searchTerm, operatorFilter]);

  const { data: mealTypes = [] } = useQuery({
    queryKey: ["meal_types", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];

      const { data, error } = await supabase
        .from("meal_types")
        .select("*")
        .eq("event_id", selectedEventId)
        .order("sort_order");

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedEventId,
  });

  const { data: windows = [], isLoading: windowsLoading } = useQuery({
    queryKey: ["meal_windows_consumo", selectedEventId, stageId],
    queryFn: async () => {
      if (!selectedEventId) return [];

      const { data, error } = await supabase
        .from("meal_windows")
        .select("*, meal_locations(name)")
        .eq("event_id", selectedEventId)
        .eq("is_active", true)
        .order("service_date")
        .order("start_time");

      if (error) throw error;

      const all = data ?? [];
      if (!isStageScoped || !stageId) return all;

      return all.filter((w: any) => w.event_stage_id === stageId);
    },
    enabled: !!selectedEventId,
  });

  useEffect(() => {
    if (!selectedEventId) return;

    // postgres_changes não filtra por evento diretamente (meal_consumptions
    // não tem event_id — só meal_window_id). Para não invalidar as queries
    // à toa quando outro evento tem atividade simultânea na mesma base,
    // ignoramos qualquer mudança cuja janela não pertença às janelas do
    // evento/etapa atualmente carregadas aqui.
    const windowIdSet = new Set(windows.map((w: any) => w.id));
    const isRelevant = (payload: any) => {
      const windowId = payload?.new?.meal_window_id ?? payload?.old?.meal_window_id;
      return !windowId || windowIdSet.has(windowId);
    };

    const channel = supabase
      .channel(`meal_consumptions_consumo_${selectedEventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_consumptions" },
        (payload) => {
          if (!isRelevant(payload)) return;
          void qc.invalidateQueries({ queryKey: ["meal_consumptions"] });
          void qc.invalidateQueries({ queryKey: ["meal_consumption_kpi_count"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_consumptions_unlinked" },
        (payload) => {
          if (!isRelevant(payload)) return;
          void qc.invalidateQueries({ queryKey: ["meal_consumptions"] });
          void qc.invalidateQueries({ queryKey: ["meal_consumption_kpi_count"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedEventId, qc, windows]);

  const stageWindowsCount = windows.length;
  const showingFallbackWindows = false;

  const mealTypesMap = new Map(mealTypes.map((m: any) => [m.id, m]));

  const {
    data: consumptions = [],
    isLoading: consumptionsLoading,
    isError: consumptionsError,
    error: consumptionsErrorObj,
    refetch: refetchConsumptions,
  } = useQuery({
    queryKey: ["meal_consumptions", selectedEventId, stageId, windows.length],
    queryFn: async () => {
      if (!selectedEventId || windows.length === 0) return [];

      const windowIds = windows.map((w: any) => w.id);

      const { data: linkedData, error: linkedError } = await supabase
        .from("meal_consumptions")
        .select(
          "*, participant:participants!participant_id(person:people!person_id(full_name, cpf, food_restrictions))",
        )
        .in("meal_window_id", windowIds)
        .order("consumed_at", { ascending: false })
        .limit(2000);

      if (linkedError) throw linkedError;

      const { data: unlinkedData, error: unlinkedError } = await (supabase as any)
        .from("meal_consumptions_unlinked")
        .select("*")
        .in("meal_window_id", windowIds)
        .order("consumed_at", { ascending: false })
        .limit(2000);

      if (unlinkedError) throw unlinkedError;

      const linked = (linkedData ?? []).map((c: any) => ({
        ...c,
        source_type: "linked",
        search_text: [
          c.participant?.person?.full_name,
          c.participant?.person?.cpf,
          c.participant_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      }));

      const unlinked = (unlinkedData ?? []).map((c: any) => ({
        ...c,
        source_type: "unlinked",
        participant: null,
        participant_id: null,
        search_text: [c.qr_code, c.id].filter(Boolean).join(" ").toLowerCase(),
      }));

      return [...linked, ...unlinked].sort(
        (a: any, b: any) =>
          new Date(b.consumed_at).getTime() - new Date(a.consumed_at).getTime(),
      );
    },
    enabled: !!selectedEventId && windows.length > 0,
  });

  const operatorIds = useMemo(
    () => [...new Set(consumptions.map((c: any) => c.registered_by).filter(Boolean))],
    [consumptions],
  );

  const { data: operatorProfiles = [] } = useQuery({
    queryKey: ["consumption-operators", operatorIds],
    queryFn: async () => {
      if (!operatorIds.length) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", operatorIds);

      if (error) throw error;
      return data ?? [];
    },
    enabled: operatorIds.length > 0,
  });

  const operatorMap = new Map(
    operatorProfiles.map((p: any) => [p.id, p.full_name ?? p.id.slice(0, 8)]),
  );

  const allFilteredConsumptions = useMemo(() => {
    return consumptions.filter((c: any) => {
      const matchesWindow =
        selectedWindowId === "all" || c.meal_window_id === selectedWindowId;

      const matchesStatus =
        statusFilter === "all" ||
        c.method === statusFilter ||
        (statusFilter === "unlinked" && c.source_type === "unlinked") ||
        (statusFilter === "linked" && c.source_type === "linked");

      const matchesOperator =
        operatorFilter === "all" || c.registered_by === operatorFilter;

      const term = searchTerm.trim().toLowerCase();

      const matchesSearch =
        !term || c.search_text?.includes(term) || c.qr_code?.toLowerCase().includes(term);

      return matchesWindow && matchesStatus && matchesSearch && matchesOperator;
    });
  }, [consumptions, selectedWindowId, statusFilter, searchTerm, operatorFilter]);

  const totalPages = Math.ceil(allFilteredConsumptions.length / itemsPerPage);

  const filteredConsumptions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return allFilteredConsumptions.slice(start, start + itemsPerPage);
  }, [allFilteredConsumptions, currentPage, itemsPerPage]);

  const selectedWindow = windows.find((w: any) => w.id === selectedWindowId);
  const selectedMealType = selectedWindow
    ? mealTypesMap.get((selectedWindow as any).meal_type_id)
    : null;

  // Contagem exata via count() — não depende da lista `consumptions`, que é
  // limitada a 2000 linhas por tabela (linkedData/unlinkedData acima) e por
  // isso não pode alimentar "Vinculados"/"Não vinculados": em eventos com
  // mais de 2000 registros numa das tabelas, esses dois números ficavam
  // subcontados e paravam de bater com "Consumos registrados" (kpiCount,
  // que já era exato). Agora os três vêm da mesma fonte exata.
  const { data: kpiCounts } = useQuery({
    queryKey: [
      "meal_consumption_kpi_count",
      selectedEventId,
      stageId,
      windows.length,
      selectedWindowId,
    ],
    queryFn: async () => {
      if (!selectedEventId || windows.length === 0) {
        return { total: 0, linked: 0, unlinked: 0 };
      }

      const windowIds =
        selectedWindowId === "all"
          ? windows.map((w: any) => w.id)
          : [selectedWindowId];

      let linkedQ = supabase
        .from("meal_consumptions")
        .select("id", { count: "exact", head: true });

      let unlinkedQ = (supabase as any)
        .from("meal_consumptions_unlinked")
        .select("id", { count: "exact", head: true });

      linkedQ =
        selectedWindowId === "all"
          ? (linkedQ as any).in("meal_window_id", windowIds)
          : (linkedQ as any).eq("meal_window_id", selectedWindowId);

      unlinkedQ =
        selectedWindowId === "all"
          ? unlinkedQ.in("meal_window_id", windowIds)
          : unlinkedQ.eq("meal_window_id", selectedWindowId);

      const [{ count: linkedCount, error: linkedError }, { count: unlinkedCount, error: unlinkedError }] =
        await Promise.all([linkedQ, unlinkedQ]);

      if (linkedError) throw linkedError;
      if (unlinkedError) throw unlinkedError;

      return {
        total: (linkedCount ?? 0) + (unlinkedCount ?? 0),
        linked: linkedCount ?? 0,
        unlinked: unlinkedCount ?? 0,
      };
    },
    enabled: !!selectedEventId && windows.length > 0,
  });

  const kpiCount = kpiCounts?.total ?? 0;
  const linkedTotal = kpiCounts?.linked ?? 0;
  const unlinkedTotal = kpiCounts?.unlinked ?? 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Controle de Refeições
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operação de alimentação — registrar e acompanhar consumos
        </p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Janela de Refeição
                {windows.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({windows.length} {windows.length === 1 ? "janela" : "janelas"}
                    {isStageScoped && stageId && stageWindowsCount > 0
                      ? " desta etapa"
                      : ""}
                    )
                  </span>
                )}
              </label>

              <div className="flex gap-2">
                <Select
                  value={selectedWindowId}
                  onValueChange={setSelectedWindowId}
                  disabled={!selectedEventId || windowsLoading}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue
                      placeholder={
                        windowsLoading
                          ? "Carregando…"
                          : windows.length === 0
                            ? "Nenhuma janela cadastrada"
                            : "Filtrar por janela"
                      }
                    />
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
                        const dateLabel = new Date(d + "T00:00:00").toLocaleDateString(
                          "pt-BR",
                          {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                          },
                        );

                        return (
                          <div key={d}>
                            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40">
                              {dateLabel}
                            </div>

                            {items.map((w: any) => {
                              const mt = mealTypesMap.get(w.meal_type_id);
                              const title = w.label || mt?.name || "Refeição";
                              const time = `${w.start_time?.slice(0, 5)}–${w.end_time?.slice(
                                0,
                                5,
                              )}`;
                              const stageHint =
                                isStageScoped && stageId && !w.event_stage_id
                                  ? " · sem etapa"
                                  : "";

                              return (
                                <SelectItem key={w.id} value={w.id}>
                                  <span className="font-medium">{title}</span>
                                  <span className="text-muted-foreground"> · {time}</span>
                                  {w.location ? (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      · {w.location}
                                    </span>
                                  ) : null}
                                  {stageHint && (
                                    <span className="text-warning text-xs">
                                      {stageHint}
                                    </span>
                                  )}
                                </SelectItem>
                              );
                            })}
                          </div>
                        );
                      });
                    })()}
                  </SelectContent>
                </Select>

                {canOperate && (
                  <Button
                    className="h-12 px-6 gap-2 shrink-0 shadow-lg shadow-primary/20"
                    onClick={() => {
                      window.location.href = "/pwa/alimentacao";
                    }}
                  >
                    <QrCode className="h-5 w-5" />
                    <span className="hidden sm:inline">Scanner (PWA)</span>
                    <span className="sm:hidden">Scanner</span>
                  </Button>
                )}
              </div>

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
                    variant="default"
                    size="sm"
                    className="w-fit gap-2"
                    onClick={() => {
                      window.location.href = `/admin/etapa/${stageId}/alimentacao/janelas`;
                    }}
                  >
                    <Plus className="h-4 w-4" /> Configurar Janelas agora
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedWindowId && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Refeição</p>
              <p className="text-lg font-bold text-foreground">
                {selectedWindowId === "all"
                  ? `Todas (${windows.length})`
                  : ((selectedMealType as any)?.name ?? "—")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Consumos registrados</p>
              <p className="text-2xl font-bold text-foreground">{kpiCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Vinculados</p>
              <p className="text-2xl font-bold text-green-500">{linkedTotal}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Não vinculados</p>
              <p className="text-2xl font-bold text-yellow-500">{unlinkedTotal}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Local</p>
              <p className="text-sm font-medium text-foreground">
                {selectedWindowId === "all"
                  ? "—"
                  : ((selectedWindow as any)?.meal_locations?.name ||
                    (selectedWindow as any)?.location ||
                    "Não definido")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

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
                    placeholder="Buscar por nome, CPF, ID ou QR..."
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[150px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="linked">Vinculados</SelectItem>
                    <SelectItem value="unlinked">Não vinculados</SelectItem>
                    <SelectItem value="qr_scan">QR Code</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>

                {operatorProfiles.length > 0 && (
                  <Select value={operatorFilter} onValueChange={setOperatorFilter}>
                    <SelectTrigger className="h-9 w-[160px]">
                      <SelectValue placeholder="Operador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos operadores</SelectItem>
                      {operatorProfiles.map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.full_name ?? o.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <ModuleStateBoundary
              isLoading={consumptionsLoading}
              isError={consumptionsError}
              error={consumptionsErrorObj}
              isEmpty={!filteredConsumptions.length}
              emptyMessage="Nenhum consumo encontrado com os filtros aplicados."
              onRetry={() => refetchConsumptions()}
              loadingFallback={
                <div className="p-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                  ))}
                </div>
              }
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participante / QR</TableHead>
                    <TableHead>Janela</TableHead>
                    <TableHead>Restrições</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Operador</TableHead>
                    {canReverse && <TableHead className="w-12 text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredConsumptions.map((c: any) => {
                    const isUnlinked = c.source_type === "unlinked";
                    const person = c.participant?.person;
                    const win = windows.find((w: any) => w.id === c.meal_window_id);
                    const mt = win ? mealTypesMap.get((win as any).meal_type_id) : null;

                    return (
                      <TableRow key={`${c.source_type}-${c.id}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {isUnlinked
                                ? `QR não vinculado: ${c.qr_code}`
                                : (person?.full_name ?? "—")}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono uppercase">
                              {isUnlinked
                                ? c.id.slice(0, 8)
                                : person?.cpf || c.participant_id?.slice(0, 8)}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">
                              {(win as any)?.label || (mt as any)?.name || "Refeição"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {(win as any)?.service_date
                                ? new Date(
                                    (win as any).service_date + "T00:00:00",
                                  ).toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                  })
                                : "—"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          {isUnlinked ? (
                            <Badge
                              variant="outline"
                              className="text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700 text-[10px] h-5"
                            >
                              QR não vinculado
                            </Badge>
                          ) : person?.food_restrictions ? (
                            <Badge
                              variant="outline"
                              className="text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700 text-[10px] h-5"
                            >
                              {person.food_restrictions}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-[10px] text-muted-foreground">
                          {new Date(c.consumed_at).toLocaleString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="text-[10px] h-5">
                            {isUnlinked
                              ? "QR não vinculado"
                              : c.method === "qr_scan" || c.method === "qr"
                                ? "QR"
                                : "Manual"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {c.registered_by
                            ? operatorMap.get(c.registered_by) ?? "—"
                            : "—"}
                        </TableCell>

                        {canReverse && (
                          <TableCell className="text-right">
                            {!isUnlinked ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                aria-label="Estornar consumo"
                                onClick={() =>
                                  setReverseTarget({
                                    consumptionId: c.id,
                                    participantName: person?.full_name ?? null,
                                    windowLabel:
                                      (win as any)?.label || (mt as any)?.name || null,
                                  })
                                }
                              >
                                <Undo2 className="h-3.5 w-3.5" aria-hidden />
                                <span className="ml-1 hidden md:inline text-xs">
                                  Estornar
                                </span>
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ModuleStateBoundary>
          </CardContent>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
              <div className="text-xs text-muted-foreground">
                Mostrando{" "}
                <span className="font-medium">
                  {(currentPage - 1) * itemsPerPage + 1}
                </span>{" "}
                a{" "}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, allFilteredConsumptions.length)}
                </span>{" "}
                de{" "}
                <span className="font-medium">
                  {allFilteredConsumptions.length}
                </span>{" "}
                registros
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-2"
                >
                  Anterior
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    let pageNum = i + 1;

                    if (totalPages > 5) {
                      if (currentPage > 3) pageNum = currentPage - 3 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }

                    if (pageNum <= 0) pageNum = i + 1;

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-8 px-2"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {!selectedEventId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <UtensilsCrossed className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      )}

      {selectedEventId && !selectedWindowId && windows.length > 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <UtensilsCrossed className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">
            Selecione uma janela de refeição
          </p>
        </div>
      )}

      <ReverseConsumptionDialog
        open={reverseTarget !== null}
        onOpenChange={(next) => {
          if (!next) setReverseTarget(null);
        }}
        consumptionId={reverseTarget?.consumptionId ?? null}
        participantName={reverseTarget?.participantName ?? null}
        windowLabel={reverseTarget?.windowLabel ?? null}
      />
    </div>
  );
}
