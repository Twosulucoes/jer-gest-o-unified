import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import QRCode from "qrcode";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Printer,
  Ban,
  History,
  Search,
  Loader2,
  QrCode as QrIcon,
  Bus,
  UtensilsCrossed,
  BedDouble,
  FileSpreadsheet,
  FileText,
  Users,
  Check,
  ChevronRight,
  UserPlus,
  Layers,
  ArrowRight,
  Trash2,
  Calendar,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import {
  exportVouchersCsv,
  exportVouchersPdf,
  printVoucherLabelsPdf,
  type VoucherExportRow,
} from "@/lib/voucherExport";

// -------- Types --------
interface VoucherRow {
  id: string;
  event_id: string;
  event_stage_id: string;
  participant_id: string | null;
  eventual_person_id: string | null;
  qr_code_value: string;
  status: string;
  voucher_type: "nominal" | "aggregate";
  is_nominal: boolean;
  label: string | null;
  is_contingency: boolean;
  scope_transport: boolean;
  scope_meals: boolean;
  scope_lodging: boolean;
  target_meal_window_id: string | null;
  target_trip_id: string | null;
  target_facility_id: string | null;
  target_date: string | null;
  batch_id: string | null;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  notes: string | null;
  revoke_reason: string | null;
  revoked_at: string | null;
  replaces_voucher_id: string | null;
  reissued_at: string | null;
  created_at: string;
}

interface BatchRow {
  id: string;
  label: string | null;
  service_type: string;
  quantity: number;
  created_at: string;
  target_meal_window_id: string | null;
  target_trip_id: string | null;
  target_facility_id: string | null;
  target_date: string | null;
}

interface EventualOption {
  id: string;
  full_name: string;
  involvement_type: string;
  organization: string | null;
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  revoked: { label: "Revogado", variant: "destructive" },
  expired: { label: "Expirado", variant: "secondary" },
  exhausted: { label: "Esgotado", variant: "secondary" },
};

function genQrValue() {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alpha[Math.floor(Math.random() * alpha.length)];
  return `voucher:${code}`;
}

// Traduz mensagens técnicas (RLS, PostgREST, 22023) em PT-BR humano para
// operadores de campo. Mantém a mensagem original quando já é humana.
function humanizeVoucherError(err: any): string {
  const raw = (err?.message || String(err) || "").toString();
  const low = raw.toLowerCase();
  if (low.includes("permission denied") || low.includes("row-level security") || low.includes("rls")) {
    return "Sem permissão para esta ação na etapa atual.";
  }
  if (low.includes("voucher de alojamento exige target_date") || low.includes("voucher de alojamento exige")) {
    return "Voucher de alojamento exige a data — selecione o dia antes de salvar.";
  }
  if (low.includes("janela já encerrada") || low.includes("janela do voucher original já fechou")) {
    return "Janela já fechou — emita um voucher novo na próxima janela em vez de reemitir.";
  }
  if (low.includes("não é possível revogar voucher")) {
    return "Esse voucher não pode ser revogado neste estado.";
  }
  if (low.includes("não é possível emitir voucher")) {
    return "Não é possível emitir: a janela informada já fechou.";
  }
  if (low.includes("not found") || low.includes("0 rows") || low.includes("404")) {
    return "Voucher não encontrado ou sem permissão.";
  }
  if (low.includes("network") || low.includes("failed to fetch") || low.includes("offline")) {
    return "Sem conexão com o servidor — tente novamente.";
  }
  return raw || "Erro inesperado.";
}

// -------- Helper: Format Instance Info --------
function getServiceInstanceLabel(v: any, instances: any) {
  if (v.target_meal_window_id) {
    const m = instances.meals.find((i: any) => i.id === v.target_meal_window_id);
    return m ? `Alimentação: ${m.label} (${m.service_date})` : "Alimentação (Refeição específica)";
  }
  if (v.target_trip_id) {
    const t = instances.trips.find((i: any) => i.id === v.target_trip_id);
    return t ? `Transporte: ${t.routes?.name || "Viagem"} (${format(new Date(t.scheduled_at), "dd/MM HH:mm")})` : "Transporte (Viagem específica)";
  }
  if (v.target_facility_id) {
    const l = instances.locations.find((i: any) => i.id === v.target_facility_id);
    return l ? `Alojamento: ${l.name} (${v.target_date || "S/ data"})` : "Alojamento (Local específico)";
  }
  return "Serviço não especificado";
}

// -------- Main Page --------
export default function VouchersPage() {
  const eventId = useActiveEventId();
  const { stageId } = useStageScope();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  // Default "hoje" para reduzir erro humano em etapa ativa.
  const [dayFilter, setDayFilter] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [instanceFilter, setInstanceFilter] = useState<string>("all");

  const [issueOpen, setIssueOpen] = useState(false);
  const [batchIssueOpen, setBatchIssueOpen] = useState(false);
  const [printVoucher, setPrintVoucher] = useState<VoucherRow | null>(null);
  const [historyVoucher, setHistoryVoucher] = useState<VoucherRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<VoucherRow | null>(null);
  const [revokeBatchTarget, setRevokeBatchTarget] = useState<BatchRow | null>(null);
  const [reissueTarget, setReissueTarget] = useState<VoucherRow | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  // Realtime: invalida queries quando outro operador (mesma aba ou
  // outra) cria/revoga/reemite voucher. Garante que a etapa ativa
  // mostre estado fresco em pico de evento sem F5 manual.
  useEffect(() => {
    if (!eventId) return;
    const ch = supabase
      .channel(`vouchers-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_vouchers",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["vouchers"] });
          queryClient.invalidateQueries({ queryKey: ["voucher-batches"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [eventId, queryClient]);

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["vouchers", eventId, stageId, statusFilter, scopeFilter, typeFilter, dayFilter, instanceFilter],
    queryFn: async () => {
      // mark_expired_vouchers agora roda via pg_cron a cada minuto
      // (migration 20260507200000) — não precisamos chamar do client.
      let q = (supabase.from("service_vouchers") as any)
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (stageId) q = q.eq("event_stage_id", stageId);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (scopeFilter === "transport") q = q.eq("scope_transport", true);
      if (scopeFilter === "meals") q = q.eq("scope_meals", true);
      if (scopeFilter === "lodging") q = q.eq("scope_lodging", true);
      if (typeFilter !== "all") q = q.eq("voucher_type", typeFilter);
      if (dayFilter) q = q.eq("target_date", dayFilter);
      if (instanceFilter !== "all") {
        if (scopeFilter === "meals") q = q.eq("target_meal_window_id", instanceFilter);
        else if (scopeFilter === "transport") q = q.eq("target_trip_id", instanceFilter);
        else if (scopeFilter === "lodging") q = q.eq("target_facility_id", instanceFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as VoucherRow[];
    },
    enabled: !!eventId,
  });

  const { data: batches = [], isLoading: loadingBatches } = useQuery({
    queryKey: ["voucher-batches", eventId, stageId],
    queryFn: async () => {
      // event_stage_id agora denormalizado em service_voucher_batches
      // (migration 20260507000000). Filtro direto, sem subquery.
      let q = supabase
        .from("service_voucher_batches")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q;
      if (error) throw error;
      return data as BatchRow[];
    },
    enabled: !!eventId,
  });

  const { data: instances = { meals: [], trips: [], locations: [] } } = useQuery({
    queryKey: ["voucher-instances", eventId, stageId],
    queryFn: async () => {
      let mealsQ = supabase.from("meal_windows").select("id, label, service_date, location, start_time, end_time").eq("event_id", eventId);
      let tripsQ = supabase.from("transport_trips").select("id, scheduled_at, route_id, routes(name)").eq("event_id", eventId);
      let locsQ = supabase.from("lodging_locations").select("id, name").eq("event_id", eventId);
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

  const instanceOptions = useMemo(() => {
    if (scopeFilter === "meals") {
      return instances.meals.map((m: any) => ({
        id: m.id,
        label: `${m.label} — ${m.service_date}${m.start_time ? ` ${m.start_time.slice(0, 5)}` : ""}`,
      }));
    }
    if (scopeFilter === "transport") {
      return instances.trips.map((t: any) => ({
        id: t.id,
        label: `${t.routes?.name || "Viagem"} — ${format(new Date(t.scheduled_at), "dd/MM HH:mm")}`,
      }));
    }
    if (scopeFilter === "lodging") {
      return instances.locations.map((l: any) => ({ id: l.id, label: l.name }));
    }
    return [];
  }, [scopeFilter, instances]);

  const { data: eventualsMap = new Map<string, any>() } = useQuery({
    queryKey: ["vouchers-eventuals", vouchers.map(v => v.eventual_person_id).filter(Boolean)],
    queryFn: async () => {
      const ids = [...new Set(vouchers.map(v => v.eventual_person_id).filter(Boolean))];
      if (ids.length === 0) return new Map();
      const { data, error } = await supabase
        .from("service_eventual_people")
        .select("id, full_name, involvement_type, organization")
        .in("id", ids);
      if (error) throw error;
      return new Map(data.map(p => [p.id, p]));
    },
    enabled: vouchers.length > 0,
  });

  const filteredVouchers = useMemo(() => {
    if (!search.trim()) return vouchers;
    const term = search.toLowerCase();
    return vouchers.filter((v) => {
      const p = v.eventual_person_id ? eventualsMap.get(v.eventual_person_id) : null;
      return (
        (v.label ?? "").toLowerCase().includes(term) ||
        (p?.full_name ?? "").toLowerCase().includes(term) ||
        v.qr_code_value.toLowerCase().includes(term)
      );
    });
  }, [vouchers, eventualsMap, search]);

  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!revokeTarget && !revokeBatchTarget) throw new Error("Nenhum alvo selecionado");
      if (!revokeReason.trim()) throw new Error("Informe o motivo");

      const reason = revokeReason.trim();

      if (revokeTarget) {
        // RPC canônica: idempotente, lock pessimista, audit via trigger DB.
        const { data, error } = await supabase.rpc("revoke_voucher_v1" as any, {
          p_voucher_id: revokeTarget.id,
          p_reason: reason,
        });
        if (error) throw error;
        return data;
      } else if (revokeBatchTarget) {
        const { data, error } = await supabase.rpc("revoke_voucher_batch_v1" as any, {
          p_batch_id: revokeBatchTarget.id,
          p_reason: reason,
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["voucher-batches"] });
      if (revokeBatchTarget) {
        toast.success(`Lote revogado — ${data?.revoked_count ?? 0} voucher(s) afetado(s)`);
      } else if (data?.noop) {
        toast.info("Voucher já estava revogado.");
      } else {
        toast.success("Voucher revogado");
      }
      setRevokeTarget(null);
      setRevokeBatchTarget(null);
      setRevokeReason("");
    },
    onError: (e: any) => toast.error(humanizeVoucherError(e)),
  });

  const reissueMutation = useMutation({
    mutationFn: async () => {
      if (!reissueTarget) throw new Error("Voucher não selecionado");
      if (!revokeReason.trim()) throw new Error("Informe o motivo da reemissão");

      // RPC canônica: revoga antigo + cria novo em UMA transação, com lock
      // pessimista. Idempotente — duplo-clique não cria 2 reissues.
      const { data, error } = await supabase.rpc("reissue_voucher_v1" as any, {
        p_voucher_id: reissueTarget.id,
        p_reason: revokeReason.trim(),
        p_new_qr: genQrValue(),
      });
      if (error) throw error;

      // Carrega o novo voucher para impressão.
      const newId = (data as any)?.new_voucher_id;
      if (newId) {
        const { data: newV } = await (supabase
          .from("service_vouchers") as any)
          .select("*")
          .eq("id", newId)
          .single();
        return { result: data, newV: newV as VoucherRow | null };
      }
      return { result: data, newV: null };
    },
    onSuccess: ({ result, newV }: any) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      if (result?.noop) {
        toast.info("Voucher já havia sido reemitido. Carregando o novo.");
      } else {
        toast.success("Voucher reemitido com sucesso");
      }
      setReissueTarget(null);
      setRevokeReason("");
      if (newV) handlePrintIndividual(newV);
    },
    onError: (e: any) => toast.error(humanizeVoucherError(e)),
  });

  const handlePrintIndividual = async (v: VoucherRow) => {
    const p = v.eventual_person_id ? eventualsMap.get(v.eventual_person_id) : null;
    const qrUrl = await QRCode.toDataURL(v.qr_code_value, { width: 300, margin: 1 });
    const row: VoucherExportRow = {
      ...v,
      qr_data_url: qrUrl,
      participant_name: p?.full_name || null,
      participant_type: p?.involvement_type || null,
      cpf: p?.organization || null,
      service_info: getServiceInstanceLabel(v, instances),
    };
    await printVoucherLabelsPdf([row]);
  };

  const handlePrintBatch = async (batchId: string) => {
    toast.info("Carregando vouchers do lote...");
    const { data: batchVouchersData, error: batchFetchError } = await supabase
      .from("service_vouchers")
      .select("*")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });
    if (batchFetchError) {
      toast.error("Erro ao carregar vouchers do lote");
      return;
    }
    const batchVouchers = (batchVouchersData ?? []) as VoucherRow[];
    if (batchVouchers.length === 0) {
      toast.error("Nenhum voucher encontrado neste lote");
      return;
    }
    toast.info("Gerando etiquetas do lote...");
    const rows: VoucherExportRow[] = await Promise.all(batchVouchers.map(async (v) => {
      const p = v.eventual_person_id ? eventualsMap.get(v.eventual_person_id) : null;
      const qrUrl = await QRCode.toDataURL(v.qr_code_value, { width: 300, margin: 1 });
      return {
        ...v,
        qr_data_url: qrUrl,
        participant_name: p?.full_name || null,
        participant_type: p?.involvement_type || null,
        cpf: p?.organization || null,
        service_info: getServiceInstanceLabel(v, instances),
        batch_label: batches.find(b => b.id === batchId)?.label || "Lote"
      };
    }));
    await printVoucherLabelsPdf(rows, `lote-${batchId}`);
    toast.success("PDF de etiquetas gerado");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vouchers de Serviço</h1>
          <p className="text-sm text-muted-foreground">Gestão operacional de acessos eventuais.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/vouchers/auditoria")}>
            <History className="h-4 w-4 mr-2" /> Auditoria
          </Button>
          <Button
            variant="outline"
            onClick={() => setBatchIssueOpen(true)}
            disabled={!stageId}
            title={!stageId ? "Selecione uma etapa para emitir" : undefined}
          >
            <Layers className="h-4 w-4 mr-2" /> Novo Lote
          </Button>
          <Button
            onClick={() => setIssueOpen(true)}
            disabled={!stageId}
            title={!stageId ? "Selecione uma etapa para emitir" : undefined}
          >
            <Plus className="h-4 w-4 mr-2" /> Novo Voucher
          </Button>
        </div>
      </div>

      <Tabs defaultValue="vouchers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vouchers">Vouchers Individuais</TabsTrigger>
          <TabsTrigger value="batches">Lotes de Vouchers</TabsTrigger>
        </TabsList>

        <TabsContent value="vouchers" className="space-y-6 mt-6">
          <Card className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Dia</Label>
                <div className="flex gap-1">
                  <Input
                    type="date"
                    value={dayFilter}
                    onChange={(e) => setDayFilter(e.target.value)}
                    className="w-[160px]"
                  />
                  <Button
                    type="button"
                    variant={dayFilter === new Date().toISOString().slice(0, 10) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDayFilter(new Date().toISOString().slice(0, 10))}
                    title="Filtrar pelo dia de hoje"
                  >
                    Hoje
                  </Button>
                  <Button
                    type="button"
                    variant={dayFilter === "" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDayFilter("")}
                    title="Mostrar toda a etapa (todos os dias)"
                  >
                    Toda a etapa
                  </Button>
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="revoked">Revogados</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                  <SelectItem value="exhausted">Esgotados</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={scopeFilter}
                onValueChange={(v) => {
                  setScopeFilter(v);
                  setInstanceFilter("all");
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos escopos</SelectItem>
                  <SelectItem value="transport">Transporte</SelectItem>
                  <SelectItem value="meals">Alimentação</SelectItem>
                  <SelectItem value="lodging">Alojamento</SelectItem>
                </SelectContent>
              </Select>
              {scopeFilter !== "all" && instanceOptions.length > 0 && (
                <Select value={instanceFilter} onValueChange={setInstanceFilter}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Janela/viagem/local" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas instâncias</SelectItem>
                    {instanceOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  <SelectItem value="aggregate">Agregado (acompanhantes)</SelectItem>
                  <SelectItem value="nominal">Nominais</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              {stageId ? "Filtrando pela etapa ativa" : "Sem etapa ativa — mostrando todas as etapas do evento"}
              {dayFilter ? ` · Dia ${dayFilter}` : " · Todos os dias"}
            </div>
          </Card>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredVouchers.length === 0 ? (
            <Card className="py-12 text-center text-sm text-muted-foreground">
              <p className="font-medium">Nenhum voucher encontrado para os filtros aplicados.</p>
              <p className="mt-1 text-xs">
                {dayFilter
                  ? `Tente limpar o filtro de dia (atual: ${dayFilter}) ou alterar o status.`
                  : "Tente ajustar status, escopo ou tipo."}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredVouchers.map((v) => {
                const p = v.eventual_person_id ? eventualsMap.get(v.eventual_person_id) : null;
                const status = STATUS_LABEL[v.status] || { label: v.status, variant: "outline" };
                return (
                  <Card key={v.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{p?.full_name || v.label || "Voucher Anônimo"}</p>
                        <p className="text-[10px] text-muted-foreground">{getServiceInstanceLabel(v, instances)}</p>
                      </div>
                      <Badge variant={status.variant as any}>{status.label}</Badge>
                    </div>
                    <div className="text-[11px] font-mono bg-muted p-1 rounded text-center">{v.qr_code_value}</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handlePrintIndividual(v)}><Printer className="h-3 w-3 mr-1"/> Etiqueta</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setHistoryVoucher(v)}><History className="h-3 w-3 mr-1"/> Usos</Button>
                      {v.status === 'active' && (
                        <>
                          <Button size="sm" variant="ghost" className="text-primary" title="Reemitir" onClick={() => setReissueTarget(v)}><History className="h-3 w-3"/></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" title="Revogar" onClick={() => setRevokeTarget(v)}><Ban className="h-3 w-3"/></Button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="batches" className="mt-6">
          {loadingBatches ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : batches.length === 0 ? (
            <Card className="py-12 text-center text-sm text-muted-foreground">
              <p className="font-medium">Nenhum lote emitido na etapa atual.</p>
              <p className="mt-1 text-xs">Use "Novo Lote" para gerar vouchers anônimos em massa.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {batches.map(b => (
                <Card key={b.id} className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">{b.label || "Lote sem nome"}</h3>
                    <p className="text-xs text-muted-foreground">
                      {getServiceInstanceLabel(b, instances)} • {b.quantity} vouchers • {format(new Date(b.created_at), "dd/MM/yy HH:mm")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handlePrintBatch(b.id)}><Printer className="h-3.5 w-3.5 mr-1" /> Imprimir</Button>
                    <Button size="sm" variant="ghost" title="Revogar Lote" className="text-destructive" onClick={() => setRevokeBatchTarget(b)}><Ban className="h-3.5 w-3.5" /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <IssueVoucherWizard open={issueOpen} onOpenChange={setIssueOpen} eventId={eventId} stageId={stageId} instances={instances} handlePrintIndividual={handlePrintIndividual} />
      <IssueBatchWizard open={batchIssueOpen} onOpenChange={setBatchIssueOpen} eventId={eventId} stageId={stageId} instances={instances} />
      <UsageHistoryDialog voucher={historyVoucher} onClose={() => setHistoryVoucher(null)} />
      
      {/* Revoke/Reissue Reason Dialog */}
      <AlertDialog 
        open={!!revokeTarget || !!revokeBatchTarget || !!reissueTarget} 
        onOpenChange={(o) => {
          if (!o) {
            setRevokeTarget(null);
            setRevokeBatchTarget(null);
            setReissueTarget(null);
            setRevokeReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reissueTarget ? "Confirmar Reemissão" : "Confirmar Revogação"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reissueTarget 
                ? "O voucher original será invalidado e um novo será gerado para a mesma instância." 
                : "Esta ação é definitiva. O(s) voucher(s) não poderão mais ser utilizados."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <Label>Motivo {reissueTarget ? "(Obrigatório p/ reemissão)" : "(Obrigatório)"}</Label>
            <Select onValueChange={setRevokeReason} value={revokeReason}>
              <SelectTrigger><SelectValue placeholder="Selecione um motivo..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Extravio / Perda">Extravio / Perda</SelectItem>
                <SelectItem value="Erro de Impressão">Erro de Impressão</SelectItem>
                <SelectItem value="Dano Físico">Dano Físico</SelectItem>
                <SelectItem value="Cancelamento da Autorização">Cancelamento da Autorização</SelectItem>
                <SelectItem value="Outro">Outro (digite abaixo)</SelectItem>
              </SelectContent>
            </Select>
            <Textarea 
              placeholder="Descreva o motivo com mais detalhes se necessário..." 
              value={revokeReason} 
              onChange={e => setRevokeReason(e.target.value)} 
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className={reissueTarget ? "bg-primary" : "bg-destructive text-destructive-foreground"}
              onClick={() => reissueTarget ? reissueMutation.mutate() : revokeMutation.mutate()} 
              disabled={!revokeReason || (reissueTarget ? reissueMutation.isPending : revokeMutation.isPending)}
            >
              {reissueTarget ? "Confirmar e Reemitir" : "Confirmar Revogação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// -------- Emission Wizards --------
function IssueVoucherWizard({ open, onOpenChange, eventId, stageId, instances, handlePrintIndividual }: any) {
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState<string>("");
  const [instanceId, setInstanceId] = useState<string>("");
  // Lodging não tem horário no schema → exige data explícita para o trigger
  // derive_voucher_validity recortar valid_from/valid_until ao dia.
  const [lodgingDate, setLodgingDate] = useState<string>("");
  const [isNominal, setIsNominal] = useState(true);
  const [eventualId, setEventualId] = useState<string>("");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) {
      setStep(1);
      setServiceType("");
      setInstanceId("");
      setLodgingDate("");
      setIsNominal(true);
      setEventualId("");
      setSearch("");
    }
  }, [open]);

  const { data: eventuals = [] } = useQuery({
    queryKey: ["eventuals-search", search],
    queryFn: async () => {
      const { data } = await supabase.from("service_eventual_people").select("*").eq("event_id", eventId).ilike("full_name", `%${search}%`).limit(10);
      return data || [];
    },
    enabled: isNominal && search.length > 1
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!stageId) throw new Error("Selecione uma etapa antes de emitir voucher.");
      if (!serviceType || !["meals", "transport", "lodging"].includes(serviceType)) {
        throw new Error("Tipo de serviço inválido.");
      }
      if (!instanceId) {
        throw new Error("Instância de serviço (refeição/viagem/local) não selecionada.");
      }
      if (isNominal && !eventualId) {
        throw new Error("ID da pessoa eventual é obrigatório para vouchers nominais.");
      }
      if (serviceType === "lodging" && !lodgingDate) {
        throw new Error("Selecione a data do alojamento — voucher de alojamento exige dia explícito.");
      }

      const qrCode = genQrValue();
      const { data, error } = await supabase.rpc("issue_voucher_v1" as any, {
        p_event_id: eventId,
        p_event_stage_id: stageId,
        p_service_type: serviceType,
        p_instance_id: instanceId,
        p_target_date: serviceType === "lodging" ? lodgingDate : null,
        p_is_nominal: isNominal,
        p_eventual_person_id: isNominal ? eventualId : null,
        p_label: null,
        p_qr_code: qrCode,
      });
      if (error) throw error;

      // Carrega o voucher recém-criado para impressão.
      const newId = (data as any)?.voucher_id;
      if (!newId) return null;
      const { data: newV } = await (supabase.from("service_vouchers") as any)
        .select("*")
        .eq("id", newId)
        .single();
      return newV;
    },
    onSuccess: (newV) => {
      toast.success("Voucher emitido com sucesso");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      if (newV) {
        handlePrintIndividual(newV as unknown as VoucherRow);
      }
    },
    onError: (err: any) => {
      toast.error("Falha na emissão", {
        description: humanizeVoucherError(err),
        duration: 8000,
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>Novo Voucher Individual</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {step === 1 && (
            <div className="grid grid-cols-3 gap-2">
              <Button variant={serviceType === "meals" ? "default" : "outline"} onClick={() => { setServiceType("meals"); setInstanceId(""); setLodgingDate(""); }} className="flex-col h-20"><UtensilsCrossed /> Alimentação</Button>
              <Button variant={serviceType === "transport" ? "default" : "outline"} onClick={() => { setServiceType("transport"); setInstanceId(""); setLodgingDate(""); }} className="flex-col h-20"><Bus /> Transporte</Button>
              <Button variant={serviceType === "lodging" ? "default" : "outline"} onClick={() => { setServiceType("lodging"); setInstanceId(""); setLodgingDate(""); }} className="flex-col h-20"><BedDouble /> Alojamento</Button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger><SelectValue placeholder="Selecione a instância" /></SelectTrigger>
                <SelectContent>
                  {serviceType === "meals" && instances.meals.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.label} ({m.service_date})</SelectItem>)}
                  {serviceType === "transport" && instances.trips.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.routes?.name} ({format(new Date(t.scheduled_at), "dd/MM HH:mm")})</SelectItem>)}
                  {serviceType === "lodging" && instances.locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {serviceType === "lodging" && (
                <div>
                  <Label>Data do alojamento (válido somente neste dia)</Label>
                  <Input
                    type="date"
                    value={lodgingDate}
                    onChange={(e) => setLodgingDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <Button variant={isNominal ? "default" : "outline"} onClick={() => setIsNominal(true)}>Nominal</Button>
                <Button variant={!isNominal ? "default" : "outline"} onClick={() => setIsNominal(false)}>Anônimo</Button>
              </div>
              {isNominal && (
                <div className="space-y-2">
                  <Input placeholder="Buscar eventual..." value={search} onChange={e => setSearch(e.target.value)} />
                  <div className="max-h-40 overflow-auto border rounded">
                    {eventuals.map((e: any) => (
                      <div key={e.id} className={`p-2 cursor-pointer hover:bg-accent ${eventualId === e.id ? 'bg-accent' : ''}`} onClick={() => setEventualId(e.id)}>
                        {e.full_name} <span className="text-[10px] opacity-50">({e.organization})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          {step > 1 && <Button variant="ghost" onClick={() => setStep(s => s - 1)}>Voltar</Button>}
          {step < 3 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={
                !serviceType ||
                (step === 2 && (!instanceId || (serviceType === "lodging" && !lodgingDate)))
              }
            >
              Próximo
            </Button>
          ) : (
            <Button
              onClick={() => mutation.mutate()}
              disabled={(isNominal && !eventualId) || mutation.isPending}
            >
              Emitir Voucher
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueBatchWizard({ open, onOpenChange, eventId, stageId, instances }: any) {
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState<string>("");
  const [instanceId, setInstanceId] = useState<string>("");
  const [lodgingDate, setLodgingDate] = useState<string>("");
  const [quantity, setQuantity] = useState(10);
  const [label, setLabel] = useState("");
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) {
      setStep(1);
      setServiceType("");
      setInstanceId("");
      setLodgingDate("");
      setQuantity(10);
      setLabel("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!serviceType) throw new Error("Selecione o tipo de serviço.");
      if (!instanceId) throw new Error("Selecione a instância do serviço.");
      if (quantity <= 0) throw new Error("A quantidade deve ser maior que zero.");
      if (serviceType === "lodging" && !lodgingDate) {
        throw new Error("Selecione a data do alojamento — voucher de alojamento exige dia explícito.");
      }
      if (!stageId) throw new Error("Selecione uma etapa antes de emitir lote de vouchers.");

      const qrCodes = Array.from({ length: quantity }).map(() => genQrValue());
      const { data, error } = await supabase.rpc("issue_voucher_batch_v1" as any, {
        p_event_id: eventId,
        p_event_stage_id: stageId,
        p_service_type: serviceType,
        p_instance_id: instanceId,
        p_target_date: serviceType === "lodging" ? lodgingDate : null,
        p_quantity: quantity,
        p_label: label,
        p_qr_codes: qrCodes,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Lote emitido — ${data?.created_count ?? quantity} vouchers gerados`);
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      qc.invalidateQueries({ queryKey: ["voucher-batches"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao emitir lote", {
        description: humanizeVoucherError(err),
        duration: 8000,
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>Emitir Novo Lote</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {step === 1 && (
             <div className="grid grid-cols-3 gap-2">
              <Button variant={serviceType === "meals" ? "default" : "outline"} onClick={() => { setServiceType("meals"); setInstanceId(""); setLodgingDate(""); }} className="flex-col h-20"><UtensilsCrossed /> Alimentação</Button>
              <Button variant={serviceType === "transport" ? "default" : "outline"} onClick={() => { setServiceType("transport"); setInstanceId(""); setLodgingDate(""); }} className="flex-col h-20"><Bus /> Transporte</Button>
              <Button variant={serviceType === "lodging" ? "default" : "outline"} onClick={() => { setServiceType("lodging"); setInstanceId(""); setLodgingDate(""); }} className="flex-col h-20"><BedDouble /> Alojamento</Button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger><SelectValue placeholder="Instância de Serviço" /></SelectTrigger>
                <SelectContent>
                  {serviceType === "meals" && instances.meals.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.label} ({m.service_date})</SelectItem>)}
                  {serviceType === "transport" && instances.trips.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.routes?.name} ({format(new Date(t.scheduled_at), "dd/MM HH:mm")})</SelectItem>)}
                  {serviceType === "lodging" && instances.locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {serviceType === "lodging" && (
                <div>
                  <Label>Data do alojamento (válido somente neste dia)</Label>
                  <Input
                    type="date"
                    value={lodgingDate}
                    onChange={(e) => setLodgingDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div><Label>Quantidade</Label><Input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value))} /></div>
              <div><Label>Identificador do Lote (Ex: Equipe de Limpeza)</Label><Input value={label} onChange={e => setLabel(e.target.value)} /></div>
            </div>
          )}
        </div>
        <DialogFooter>
          {step > 1 && <Button variant="ghost" onClick={() => setStep(s => s - 1)}>Voltar</Button>}
          {step < 3 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={
                !serviceType ||
                (step === 2 && (!instanceId || (serviceType === "lodging" && !lodgingDate)))
              }
            >
              Próximo
            </Button>
          ) : (
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || quantity <= 0}
            >
              Gerar {quantity} Vouchers
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UsageHistoryDialog({ voucher, onClose }: any) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["voucher-history-combined", voucher?.id],
    queryFn: async () => {
      const [uses, attempts] = await Promise.all([
        supabase.from("service_voucher_uses").select("id, service_kind, used_at, used_by, context_id").eq("voucher_id", voucher.id),
        supabase.from("service_voucher_attempts").select("id, service_kind, attempted_at, outcome, reason, context_id").eq("voucher_id", voucher.id).neq("outcome", "success")
      ]);
      
      const combined = [
        ...(uses.data || []).map(u => ({ ...u, type: 'use', timestamp: u.used_at })),
        ...(attempts.data || []).map(a => ({ ...a, type: 'attempt', timestamp: a.attempted_at }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return combined;
    },
    enabled: !!voucher
  });

  return (
    <Dialog open={!!voucher} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Histórico e Auditoria</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-auto pr-2">
          {isLoading ? <Loader2 className="animate-spin m-auto py-8"/> : history.map((h: any) => (
            <div key={h.id} className={`p-3 rounded-lg border flex flex-col gap-1 ${h.type === 'use' ? 'border-green-500/20 bg-green-500/5' : 'border-destructive/20 bg-destructive/5'}`}>
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold uppercase tracking-wider">{h.service_kind}</span>
                <span className="text-[10px] text-muted-foreground">{format(new Date(h.timestamp), "dd/MM/yy HH:mm")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{h.type === 'use' ? '✅ Consumo Efetivado' : '❌ Tentativa Recusada'}</span>
                {h.reason && <Badge variant="outline" className="text-[9px] uppercase">{h.reason}</Badge>}
              </div>
            </div>
          ))}
          {history.length === 0 && <p className="text-center opacity-50 py-8">Nenhum registro encontrado.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
