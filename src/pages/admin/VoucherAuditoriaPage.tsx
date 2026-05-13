import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { format } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  History,
  ArrowLeft,
  FileSpreadsheet,
  Zap,
  User,
  Layers,
  UtensilsCrossed,
  Bus,
  BedDouble,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { voucherErrorMessage } from "@/lib/voucherMessages";

type ServiceFilter = "all" | "meals" | "transport" | "lodging";
type OriginFilter = "all" | "online" | "offline";
type EmissionTypeFilter = "all" | "issue" | "reissue" | "revoke" | "expire";

const EMISSION_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  issue:    { label: "Emissão",    color: "border-green-500 text-green-700 bg-green-50" },
  reissue:  { label: "Reemissão",  color: "border-blue-500 text-blue-700 bg-blue-50" },
  revoke:   { label: "Revogação",  color: "border-destructive text-destructive" },
  expire:   { label: "Expiração",  color: "border-gray-400 text-gray-600 bg-gray-50" },
  unrevoke: { label: "Reativação", color: "border-amber-500 text-amber-700 bg-amber-50" },
};

const SERVICE_ICON: Record<string, React.ReactNode> = {
  meals:     <UtensilsCrossed className="h-3 w-3" />,
  transport: <Bus className="h-3 w-3" />,
  lodging:   <BedDouble className="h-3 w-3" />,
};

const SERVICE_LABEL: Record<string, string> = {
  meals: "Alimentação",
  transport: "Transporte",
  lodging: "Alojamento",
};

function serviceFromPayload(payload: any): string {
  if (payload?.scope_meals) return "meals";
  if (payload?.scope_transport) return "transport";
  if (payload?.scope_lodging) return "lodging";
  return "—";
}

export default function VoucherAuditoriaPage() {
  const eventId = useActiveEventId();
  const { stageId } = useStageScope();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("tentativas");

  // ---- Tentativas (usage attempts) state ----
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all");
  const [dayFilter, setDayFilter] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [operatorFilter, setOperatorFilter] = useState<string>("all");

  // ---- Emissões state ----
  const [emissionSearch, setEmissionSearch] = useState("");
  const [emissionTypeFilter, setEmissionTypeFilter] = useState<EmissionTypeFilter>("all");
  const [emissionServiceFilter, setEmissionServiceFilter] = useState<ServiceFilter>("all");
  const [emissionDayFilter, setEmissionDayFilter] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [emissionOperatorFilter, setEmissionOperatorFilter] = useState<string>("all");

  // ---- Instances (shared) ----
  const { data: instances = { meals: [], trips: [], locations: [] } } = useQuery({
    queryKey: ["voucher-audit-instances", eventId, stageId],
    queryFn: async () => {
      let mealsQ = supabase
        .from("meal_windows")
        .select("id, label, service_date")
        .eq("event_id", eventId);
      let tripsQ = supabase
        .from("transport_trips")
        .select("id, scheduled_at, route_id, routes(name)")
        .eq("event_id", eventId);
      let locsQ = supabase
        .from("lodging_locations")
        .select("id, name")
        .eq("event_id", eventId);
      if (stageId) {
        mealsQ = mealsQ.eq("event_stage_id", stageId);
        tripsQ = tripsQ.eq("event_stage_id", stageId);
        locsQ = locsQ.eq("event_stage_id", stageId);
      }
      const [meals, trips, locations] = await Promise.all([mealsQ, tripsQ, locsQ]);
      return {
        meals: meals.data ?? [],
        trips: (trips.data as any[]) ?? [],
        locations: locations.data ?? [],
      };
    },
    enabled: !!eventId,
  });

  // ---- Tentativas de uso (existing) ----
  const { data: operations = [], isLoading } = useQuery({
    queryKey: [
      "voucher-audit-ops",
      eventId,
      stageId,
      outcomeFilter,
      serviceFilter,
      originFilter,
      dayFilter,
      operatorFilter,
    ],
    queryFn: async () => {
      let q = (supabase.from("service_voucher_attempts") as any)
        .select(
          `
          *,
          voucher:service_vouchers(
            qr_code_value,
            is_nominal,
            event_stage_id,
            target_meal_window_id,
            target_trip_id,
            target_facility_id,
            target_date,
            eventual_person:service_eventual_people(full_name),
            batch:service_voucher_batches(label)
          ),
          operator:profiles(full_name)
        `,
        )
        .eq("event_id", eventId)
        .order("attempted_at", { ascending: false })
        .limit(1000);

      if (stageId) q = q.eq("event_stage_id", stageId);
      if (outcomeFilter !== "all") q = q.eq("outcome", outcomeFilter);
      if (serviceFilter !== "all") q = q.eq("service_kind", serviceFilter);
      if (originFilter === "online") q = q.eq("is_offline", false);
      if (originFilter === "offline") q = q.eq("is_offline", true);
      if (operatorFilter !== "all") q = q.eq("attempted_by", operatorFilter);
      if (dayFilter) {
        const start = `${dayFilter}T00:00:00.000Z`;
        const end = `${dayFilter}T23:59:59.999Z`;
        q = q.gte("attempted_at", start).lte("attempted_at", end);
      }

      const { data, error } = await q;
      if (error) throw error;

      return (data || []).map((a: any) => ({
        id: a.id,
        timestamp: a.attempted_at,
        type: a.outcome === "success" ? "CONSUMO" : "TENTATIVA RECUSADA",
        service: a.service_kind,
        details:
          a.outcome === "success"
            ? "Sucesso"
            : voucherErrorMessage(a.reason, "pt", {
                used_at: a.metadata?.used_at,
                operator_name: a.metadata?.operator_name,
                correct_instance: a.metadata?.correct_instance,
                revocation_reason: a.metadata?.revocation_reason,
                valid_until: a.metadata?.valid_until,
              }).text,
        identifier:
          a.voucher?.eventual_person?.full_name ||
          a.voucher?.batch?.label ||
          a.voucher?.qr_code_value ||
          a.qr_value,
        operator_id: a.attempted_by,
        operator: a.operator?.full_name || "Sistema",
        is_offline: a.is_offline,
        offline_at: a.offline_at,
        tone: a.outcome === "success" ? "success" : "destructive",
      }));
    },
    enabled: !!eventId,
  });

  const operatorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    operations.forEach((op: any) => {
      if (op.operator_id && !seen.has(op.operator_id)) {
        seen.set(op.operator_id, op.operator);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [operations]);

  const filtered = operations.filter(
    (op: any) =>
      !search ||
      op.identifier?.toLowerCase().includes(search.toLowerCase()) ||
      op.operator?.toLowerCase().includes(search.toLowerCase()),
  );

  // ---- Emissões: service_voucher_audit ----
  const { data: auditRaw = [], isLoading: loadingEmissions } = useQuery({
    queryKey: ["voucher-audit-emissions", eventId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("service_voucher_audit") as any)
        .select("id, event_id, issuer_id, voucher_type, payload, status, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });

  // Busca nomes de operadores das emissões
  const emissionIssuerIds = useMemo(
    () => [...new Set((auditRaw as any[]).map((r: any) => r.issuer_id).filter(Boolean))],
    [auditRaw],
  );
  const { data: emissionProfiles = [] } = useQuery({
    queryKey: ["emission-profiles", emissionIssuerIds],
    queryFn: async () => {
      if (emissionIssuerIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", emissionIssuerIds);
      if (error) throw error;
      return data || [];
    },
    enabled: emissionIssuerIds.length > 0,
  });
  const profileMap = useMemo(
    () => new Map((emissionProfiles as any[]).map((p: any) => [p.id, p.full_name])),
    [emissionProfiles],
  );

  // Busca nomes de eventuals nominais nas emissões
  const nominalPersonIds = useMemo(() => {
    const ids = (auditRaw as any[])
      .map((r: any) => r.payload?.eventual_person_id)
      .filter(Boolean);
    return [...new Set(ids)];
  }, [auditRaw]);
  const { data: nominalPersons = [] } = useQuery({
    queryKey: ["emission-nominal-persons", nominalPersonIds],
    queryFn: async () => {
      if (nominalPersonIds.length === 0) return [];
      const { data, error } = await supabase
        .from("service_eventual_people")
        .select("id, full_name")
        .in("id", nominalPersonIds);
      if (error) throw error;
      return data || [];
    },
    enabled: nominalPersonIds.length > 0,
  });
  const nominalMap = useMemo(
    () => new Map((nominalPersons as any[]).map((p: any) => [p.id, p.full_name])),
    [nominalPersons],
  );

  // Busca labels de lotes referenciados nas emissões
  const batchIds = useMemo(() => {
    const ids = (auditRaw as any[])
      .map((r: any) => r.payload?.batch_id)
      .filter(Boolean);
    return [...new Set(ids)];
  }, [auditRaw]);
  const { data: batchLabels = [] } = useQuery({
    queryKey: ["emission-batch-labels", batchIds],
    queryFn: async () => {
      if (batchIds.length === 0) return [];
      const { data, error } = await supabase
        .from("service_voucher_batches")
        .select("id, label")
        .in("id", batchIds);
      if (error) throw error;
      return data || [];
    },
    enabled: batchIds.length > 0,
  });
  const batchLabelMap = useMemo(
    () => new Map((batchLabels as any[]).map((b: any) => [b.id, b.label])),
    [batchLabels],
  );

  // Enriquece e filtra registros de emissão
  const enrichedEmissions = useMemo(() => {
    return (auditRaw as any[]).map((r: any) => {
      const p = r.payload || {};
      const service = serviceFromPayload(p);
      const personName = p.eventual_person_id ? nominalMap.get(p.eventual_person_id) : null;
      const batchLabel = p.batch_id ? (batchLabelMap.get(p.batch_id) || `Lote`) : null;
      const isBatchRecord = !!p.batch_id;
      return {
        id: r.id,
        created_at: r.created_at,
        event_type: p.event_type || "issue",
        qr_code: p.qr_code_value || "—",
        service,
        event_stage_id: p.event_stage_id,
        is_nominal: p.is_nominal,
        person_name: personName,
        batch_label: batchLabel,
        is_batch_record: isBatchRecord,
        operator_id: r.issuer_id,
        operator: profileMap.get(r.issuer_id) || "Sistema",
        voucher_type: r.voucher_type,
      };
    });
  }, [auditRaw, profileMap, nominalMap, batchLabelMap]);

  const filteredEmissions = useMemo(() => {
    return enrichedEmissions.filter((e) => {
      if (stageId && e.event_stage_id && e.event_stage_id !== stageId) return false;
      if (emissionTypeFilter !== "all" && e.event_type !== emissionTypeFilter) return false;
      if (emissionServiceFilter !== "all" && e.service !== emissionServiceFilter) return false;
      if (emissionOperatorFilter !== "all" && e.operator_id !== emissionOperatorFilter) return false;
      if (emissionDayFilter) {
        const d = e.created_at?.slice(0, 10);
        if (d !== emissionDayFilter) return false;
      }
      if (emissionSearch) {
        const term = emissionSearch.toLowerCase();
        if (
          !e.qr_code.toLowerCase().includes(term) &&
          !(e.person_name || "").toLowerCase().includes(term) &&
          !(e.batch_label || "").toLowerCase().includes(term) &&
          !e.operator.toLowerCase().includes(term)
        ) return false;
      }
      return true;
    });
  }, [enrichedEmissions, stageId, emissionTypeFilter, emissionServiceFilter, emissionOperatorFilter, emissionDayFilter, emissionSearch]);

  const emissionOperatorOptions = useMemo(() => {
    const seen = new Map<string, string>();
    enrichedEmissions.forEach((e: any) => {
      if (e.operator_id && !seen.has(e.operator_id)) {
        seen.set(e.operator_id, e.operator);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [enrichedEmissions]);

  // ---- Handlers ----
  const handleExportAttempts = () => {
    toast.info("Exportação para CSV iniciada...");
    const headers = ["Data/Hora", "Tipo", "Origem", "Serviço", "Identificador", "Detalhes", "Operador"];
    const rows = filtered.map((f: any) => [
      format(new Date(f.timestamp), "dd/MM/yyyy HH:mm"),
      f.type,
      f.is_offline ? "OFFLINE" : "ONLINE",
      f.service,
      f.identifier,
      f.details,
      f.operator,
    ]);
    const csv = "﻿" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `auditoria-vouchers-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exportado com sucesso");
  };

  const handleExportEmissions = () => {
    toast.info("Exportando emissões...");
    const headers = ["Data/Hora", "Tipo", "QR Code", "Serviço", "Pessoa/Lote", "Operador"];
    const rows = filteredEmissions.map((e: any) => [
      format(new Date(e.created_at), "dd/MM/yyyy HH:mm"),
      EMISSION_TYPE_LABEL[e.event_type]?.label || e.event_type,
      e.qr_code,
      SERVICE_LABEL[e.service] || e.service,
      e.person_name || e.batch_label || "—",
      e.operator,
    ]);
    const csv = "﻿" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `emissoes-vouchers-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV de emissões exportado");
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/vouchers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6 text-primary" /> Central de Auditoria de Vouchers
            </h1>
            <p className="text-sm text-muted-foreground">
              Rastreabilidade de emissões, consumos e recusas. Etapa ativa + dia de hoje por padrão.
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tentativas" className="flex items-center gap-1.5">
            <History className="h-4 w-4" /> Tentativas de Uso
          </TabsTrigger>
          <TabsTrigger value="emissoes" className="flex items-center gap-1.5">
            <Zap className="h-4 w-4" /> Emissões
          </TabsTrigger>
        </TabsList>

        {/* ===== ABA: TENTATIVAS DE USO ===== */}
        <TabsContent value="tentativas" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label>Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Voucher, lote, pessoa ou operador..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Dia</Label>
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={dayFilter}
                      onChange={(e) => setDayFilter(e.target.value)}
                      className="w-[160px]"
                    />
                    <Button
                      type="button"
                      variant={dayFilter === todayStr ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDayFilter(todayStr)}
                    >
                      Hoje
                    </Button>
                    <Button
                      type="button"
                      variant={dayFilter === "" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDayFilter("")}
                    >
                      Toda a etapa
                    </Button>
                  </div>
                </div>
                <div className="w-44 space-y-1.5">
                  <Label>Resultado</Label>
                  <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="success">Sucessos</SelectItem>
                      <SelectItem value="refused">Recusas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-44 space-y-1.5">
                  <Label>Serviço</Label>
                  <Select value={serviceFilter} onValueChange={(v: ServiceFilter) => setServiceFilter(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="meals">Alimentação</SelectItem>
                      <SelectItem value="transport">Transporte</SelectItem>
                      <SelectItem value="lodging">Alojamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40 space-y-1.5">
                  <Label>Origem</Label>
                  <Select value={originFilter} onValueChange={(v: OriginFilter) => setOriginFilter(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {operatorOptions.length > 0 && (
                  <div className="w-52 space-y-1.5">
                    <Label>Operador</Label>
                    <Select value={operatorFilter} onValueChange={setOperatorFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {operatorOptions.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={handleExportAttempts}
                  disabled={filtered.length === 0}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar CSV
                </Button>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                {stageId ? "Filtrando pela etapa ativa" : "Sem etapa ativa — todas as etapas do evento"}
                {dayFilter ? ` · Dia ${dayFilter}` : " · Todos os dias"}
                {" · "}
                {filtered.length} registro{filtered.length === 1 ? "" : "s"}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  Nenhum registro encontrado para os filtros aplicados.
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Operação</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>Identificador</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead>Operador</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((op: any) => (
                        <TableRow key={op.id}>
                          <TableCell className="text-xs font-mono">
                            {format(new Date(op.timestamp), "dd/MM HH:mm")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase ${op.tone === "success" ? "border-green-500 text-green-700 bg-green-50" : "border-destructive text-destructive"}`}
                            >
                              {op.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {op.is_offline ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-700 bg-amber-50 w-fit">
                                  OFFLINE
                                </Badge>
                                {op.offline_at && (
                                  <span className="text-[9px] text-muted-foreground italic">
                                    Lido: {format(new Date(op.offline_at), "dd/MM HH:mm")}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[9px] border-blue-500 text-blue-700 bg-blue-50 w-fit">
                                ONLINE
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] uppercase">
                              {op.service}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{op.identifier}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{op.details}</TableCell>
                          <TableCell className="text-xs">{op.operator}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ABA: EMISSÕES ===== */}
        <TabsContent value="emissoes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label>Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="QR code, pessoa, lote ou operador..."
                      value={emissionSearch}
                      onChange={(e) => setEmissionSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Dia</Label>
                  <div className="flex gap-1">
                    <Input
                      type="date"
                      value={emissionDayFilter}
                      onChange={(e) => setEmissionDayFilter(e.target.value)}
                      className="w-[160px]"
                    />
                    <Button
                      type="button"
                      variant={emissionDayFilter === todayStr ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEmissionDayFilter(todayStr)}
                    >
                      Hoje
                    </Button>
                    <Button
                      type="button"
                      variant={emissionDayFilter === "" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEmissionDayFilter("")}
                    >
                      Toda a etapa
                    </Button>
                  </div>
                </div>
                <div className="w-44 space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={emissionTypeFilter} onValueChange={(v: EmissionTypeFilter) => setEmissionTypeFilter(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="issue">Emissões</SelectItem>
                      <SelectItem value="reissue">Reemissões</SelectItem>
                      <SelectItem value="revoke">Revogações</SelectItem>
                      <SelectItem value="expire">Expirações</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-44 space-y-1.5">
                  <Label>Serviço</Label>
                  <Select value={emissionServiceFilter} onValueChange={(v: ServiceFilter) => setEmissionServiceFilter(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="meals">Alimentação</SelectItem>
                      <SelectItem value="transport">Transporte</SelectItem>
                      <SelectItem value="lodging">Alojamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {emissionOperatorOptions.length > 0 && (
                  <div className="w-52 space-y-1.5">
                    <Label>Operador</Label>
                    <Select value={emissionOperatorFilter} onValueChange={setEmissionOperatorFilter}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {emissionOperatorOptions.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={handleExportEmissions}
                  disabled={filteredEmissions.length === 0}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar CSV
                </Button>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                {stageId ? "Filtrando pela etapa ativa" : "Sem etapa ativa — todas as etapas do evento"}
                {emissionDayFilter ? ` · Dia ${emissionDayFilter}` : " · Todos os dias"}
                {" · "}
                {filteredEmissions.length} registro{filteredEmissions.length === 1 ? "" : "s"}
                {" · Cada voucher de lote gera 1 linha. Para ver resumo de lotes, acesse a aba Lotes em Vouchers."}
              </div>
            </CardHeader>
            <CardContent>
              {loadingEmissions ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredEmissions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  Nenhuma emissão encontrada para os filtros aplicados.
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead>QR Code</TableHead>
                        <TableHead>Pessoa / Lote</TableHead>
                        <TableHead>Operador</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmissions.map((e: any) => {
                        const typeInfo = EMISSION_TYPE_LABEL[e.event_type] || { label: e.event_type, color: "" };
                        const svc = e.service;
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs font-mono">
                              {format(new Date(e.created_at), "dd/MM HH:mm")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] uppercase ${typeInfo.color}`}>
                                {typeInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-xs">
                                {SERVICE_ICON[svc]}
                                <span>{SERVICE_LABEL[svc] || svc}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-muted-foreground">
                              {e.qr_code}
                            </TableCell>
                            <TableCell className="text-sm">
                              {e.person_name ? (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span>{e.person_name}</span>
                                </div>
                              ) : e.batch_label ? (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Layers className="h-3 w-3" />
                                  <span>{e.batch_label}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">Anônimo</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-xs font-medium">{e.operator}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
