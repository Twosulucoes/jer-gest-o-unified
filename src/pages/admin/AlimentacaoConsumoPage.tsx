import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredentialLookup } from "@/hooks/useCredentialLookup";
import { toast } from "sonner";
import {
  UtensilsCrossed, Search, Loader2, CheckCircle2, AlertTriangle, QrCode, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { ParticipantReviewDialog } from "@/components/admin/ParticipantReviewDialog";

export default function AlimentacaoConsumoPage() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const { isStageScoped, stageId, participantIds: stageParticipantIds } = useStageScope();
  const [selectedWindowId, setSelectedWindowId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [qrResult, setQrResult] = useState<{ name: string; participantId: string; cpf: string | null; type: string; foodRestrictions: string | null; photo_url?: string | null; institution?: string | null; birth_date?: string | null } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const { lookupByQrCode, loading: qrLoading } = useCredentialLookup();
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

  // Load consumptions for selected window
  const { data: consumptions = [], isLoading: consumptionsLoading } = useQuery({
    queryKey: ["meal_consumptions", selectedWindowId],
    queryFn: async () => {
      if (!selectedWindowId) return [];
      const { data, error } = await supabase.from("meal_consumptions").select("*").eq("meal_window_id", selectedWindowId).order("consumed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedWindowId,
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

  // Search participants — restrito à etapa quando aplicável
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["search-participants-food", selectedEventId, searchTerm, stageId, stageParticipantIds?.size ?? -1],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2 || !selectedEventId) return [];
      const { data: ppl, error: pplErr } = await supabase
        .from("people")
        .select("id, full_name, cpf, food_restrictions")
        .or(`full_name.ilike.%${searchTerm}%,cpf.eq.${searchTerm}`)
        .limit(20);
      if (pplErr) throw pplErr;
      if (!ppl.length) return [];

      const personIds = ppl.map((p) => p.id);
      let pq = supabase
        .from("participants")
        .select("id, person_id, status, participant_type")
        .eq("event_id", selectedEventId)
        .eq("is_active", true)
        .in("person_id", personIds);
      if (isStageScoped && stageParticipantIds) {
        if (stageParticipantIds.size === 0) return [];
        pq = pq.in("id", Array.from(stageParticipantIds));
      }
      const { data: parts, error: partsErr } = await pq;
      if (partsErr) throw partsErr;

      const mapped = parts.map((pt) => ({
        ...pt,
        person: ppl.find((p) => p.id === pt.person_id),
      }));
      if (isStageScoped && stageParticipantIds) {
        return mapped.filter((pt) => stageParticipantIds.has(pt.id));
      }
      return mapped;
    },
    enabled: !!searchTerm && searchTerm.length >= 2 && !!selectedEventId && (!isStageScoped || !!stageParticipantIds),
  });

  // Register consumption
  const consumeMut = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase.from("meal_consumptions").insert({
        meal_window_id: selectedWindowId,
        participant_id: participantId,
        consumed_at: new Date().toISOString(),
        registered_by: user!.id,
        method: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meal_consumptions", selectedWindowId] });
      toast.success("Consumo registrado!");
    },
    onError: (e: any) => {
      const msg = e?.message ?? "";
      const code = e?.code ?? "";
      if (code === "23505" || msg.includes("uq_meal_consumption_participant_window") || msg.includes("duplicate key") || msg.includes("unique constraint")) {
        toast.error("Consumo já registrado para este participante nesta janela.");
      } else {
        toast.error("Falha ao registrar consumo. Tente novamente.");
      }
    },
  });

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={(v) => { setSelectedWindowId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
              </Select>
            </div>
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
                <SelectTrigger>
                  <SelectValue placeholder={windowsLoading ? "Carregando…" : (windows.length === 0 ? "Nenhuma janela cadastrada" : "Selecione a janela")} />
                </SelectTrigger>
                <SelectContent className="max-h-[360px]">
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
                <p className="text-xs text-muted-foreground">
                  Cadastre janelas em <span className="font-medium">Alimentação → Janelas</span>.
                </p>
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

      {/* Search to register */}
      {canOperate && selectedWindowId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Registrar consumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* QR Code lookup */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                <QrCode className="h-3 w-3" /> Busca por QR Code
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Escanear ou colar código QR..."
                  value={qrCode}
                  onChange={(e) => { setQrCode(e.target.value); setQrResult(null); setQrError(null); }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && qrCode.trim() && selectedEventId) {
                      const { data, error } = await lookupByQrCode(qrCode.trim(), selectedEventId);
                      if (error) { setQrError(error.message); setQrResult(null); }
                      else if (data) {
                        setQrResult({ name: data.person_name, participantId: data.participant_id, cpf: data.person_cpf, type: data.participant_type, foodRestrictions: data.food_restrictions ?? null });
                        setQrError(null);
                      }
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!qrCode.trim() || qrLoading}
                  onClick={async () => {
                    if (qrCode.trim() && selectedEventId) {
                      const { data, error } = await lookupByQrCode(qrCode.trim(), selectedEventId);
                      if (error) { setQrError(error.message); setQrResult(null); }
                      else if (data) {
                        setQrResult({ name: data.person_name, participantId: data.participant_id, cpf: data.person_cpf, type: data.participant_type, foodRestrictions: data.food_restrictions ?? null });
                        setQrError(null);
                      }
                    }
                  }}
                >
                  {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>
              {qrError && (
                <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" /> {qrError}
                </div>
              )}
              {qrResult && (
                <div className="mt-2 rounded-lg border px-4 py-2.5 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{qrResult.name}</p>
                      <p className="text-xs text-muted-foreground">{qrResult.cpf ?? "Sem CPF"} • {qrResult.type === "athlete" ? "Atleta" : qrResult.type}</p>
                      {qrResult.foodRestrictions && (
                        <p className="text-xs mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                          <span className="text-destructive font-medium">Restrição: {qrResult.foodRestrictions}</span>
                        </p>
                      )}
                    </div>
                    {consumedParticipantIds.has(qrResult.participantId) ? (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Já consumiu
                      </Badge>
                    ) : (
                      <Button size="sm" onClick={() => { consumeMut.mutate(qrResult.participantId); setQrCode(""); setQrResult(null); }} disabled={consumeMut.isPending}>
                        <UtensilsCrossed className="mr-1 h-3 w-3" /> Registrar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Manual search */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                <Search className="h-3 w-3" /> Busca manual por nome/CPF
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {searching && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</div>}
            {searchResults.length > 0 && (
              <div className="rounded-lg border divide-y max-h-60 overflow-y-auto">
                {searchResults.map((sr) => {
                  const alreadyConsumed = consumedParticipantIds.has(sr.id);
                  const hasRestrictions = !!sr.person?.food_restrictions;
                  return (
                    <div key={sr.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">{sr.person?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {sr.person?.cpf ?? "Sem CPF"} • {sr.participant_type === "athlete" ? "Atleta" : sr.participant_type}
                        </p>
                        {hasRestrictions && (
                          <p className="text-xs mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            <span className="text-destructive font-medium">Restrição: {sr.person?.food_restrictions}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {alreadyConsumed ? (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Já consumiu
                          </Badge>
                        ) : (
                          <Button size="sm" onClick={() => consumeMut.mutate(sr.id)} disabled={consumeMut.isPending}>
                            <UtensilsCrossed className="mr-1 h-3 w-3" /> Registrar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Consumption history */}
      {selectedWindowId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" /> Consumos registrados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {consumptionsLoading ? (
              <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div>
            ) : !consumptions.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Nenhum consumo registrado nesta janela.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Restrições</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Método</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptions.map((c) => {
                    const person = getPersonForConsumption(c.participant_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{person?.cpf ?? "—"}</TableCell>
                        <TableCell>
                          {person?.food_restrictions ? (
                            <Badge variant="outline" className="text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-700">
                              {person.food_restrictions}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(c.consumed_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell><Badge variant="outline">{c.method === "qr" ? "QR" : "Manual"}</Badge></TableCell>
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
