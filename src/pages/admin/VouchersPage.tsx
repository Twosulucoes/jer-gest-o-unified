import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
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
  let suffix = "";
  for (let i = 0; i < 20; i++) suffix += alpha[Math.floor(Math.random() * alpha.length)];
  return `voucher:${Date.now().toString(36).toUpperCase()}-${suffix}`;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [issueOpen, setIssueOpen] = useState(false);
  const [batchIssueOpen, setBatchIssueOpen] = useState(false);
  const [printVoucher, setPrintVoucher] = useState<VoucherRow | null>(null);
  const [historyVoucher, setHistoryVoucher] = useState<VoucherRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<VoucherRow | null>(null);
  const [revokeBatchTarget, setRevokeBatchTarget] = useState<BatchRow | null>(null);
  const [reissueTarget, setReissueTarget] = useState<VoucherRow | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["vouchers", eventId, statusFilter, scopeFilter, typeFilter],
    queryFn: async () => {
      let q = (supabase.from("service_vouchers") as any)
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (scopeFilter === "transport") q = q.eq("scope_transport", true);
      if (scopeFilter === "meals") q = q.eq("scope_meals", true);
      if (scopeFilter === "lodging") q = q.eq("scope_lodging", true);
      if (typeFilter !== "all") q = q.eq("voucher_type", typeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as VoucherRow[];
    },
    enabled: !!eventId,
  });

  const { data: batches = [], isLoading: loadingBatches } = useQuery({
    queryKey: ["voucher-batches", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_voucher_batches")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BatchRow[];
    },
    enabled: !!eventId,
  });

  const { data: instances = { meals: [], trips: [], locations: [] } } = useQuery({
    queryKey: ["voucher-instances", eventId],
    queryFn: async () => {
      const [meals, trips, locations] = await Promise.all([
        supabase.from("meal_windows").select("id, label, service_date, location").eq("event_id", eventId),
        supabase.from("transport_trips").select("id, scheduled_at, route_id, routes(name)").eq("event_id", eventId),
        supabase.from("lodging_locations").select("id, name").eq("event_id", eventId),
      ]);
      return {
        meals: meals.data ?? [],
        trips: (trips.data as any[]) ?? [],
        locations: locations.data ?? [],
      };
    },
    enabled: !!eventId,
  });

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
      const now = new Date().toISOString();

      if (revokeTarget) {
        const { error } = await supabase
          .from("service_vouchers")
          .update({
            status: "revoked",
            revoked_at: now,
            revoke_reason: reason,
          })
          .eq("id", revokeTarget.id);
        if (error) throw error;
      } else if (revokeBatchTarget) {
        const { error } = await supabase
          .from("service_vouchers")
          .update({
            status: "revoked",
            revoked_at: now,
            revoke_reason: `[Lote] ${reason}`,
          })
          .eq("batch_id", revokeBatchTarget.id)
          .eq("status", "active");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["voucher-batches"] });
      toast.success(revokeBatchTarget ? "Lote revogado" : "Voucher revogado");
      setRevokeTarget(null);
      setRevokeBatchTarget(null);
      setRevokeReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reissueMutation = useMutation({
    mutationFn: async () => {
      if (!reissueTarget) throw new Error("Voucher não selecionado");
      if (!revokeReason.trim()) throw new Error("Informe o motivo da reemissão");

      const oldV = reissueTarget;
      const now = new Date().toISOString();
      const reason = `[Reemissão] ${revokeReason.trim()}`;

      // 1. Invalida o antigo
      const { error: updErr } = await supabase
        .from("service_vouchers")
        .update({
          status: "revoked",
          revoked_at: now,
          revoke_reason: reason,
        })
        .eq("id", oldV.id);
      if (updErr) throw updErr;

      // 2. Cria o novo
      const { data: newV, error: insErr } = await (supabase
        .from("service_vouchers") as any)
        .insert({
          event_id: oldV.event_id,
          participant_id: oldV.participant_id,
          eventual_person_id: oldV.eventual_person_id,
          qr_code_value: genQrValue(),
          status: "active",
          voucher_type: oldV.voucher_type,
          is_nominal: oldV.is_nominal,
          label: oldV.label,
          scope_meals: oldV.scope_meals,
          scope_transport: oldV.scope_transport,
          scope_lodging: oldV.scope_lodging,
          target_meal_window_id: oldV.target_meal_window_id,
          target_trip_id: oldV.target_trip_id,
          target_facility_id: oldV.target_facility_id,
          target_date: oldV.target_date,
          max_uses: oldV.max_uses,
          valid_until: oldV.valid_until,
          replaces_voucher_id: oldV.id,
          reissued_at: now,
          notes: `Reemissão de ${oldV.qr_code_value}. Motivo: ${revokeReason.trim()}`
        })
        .select()
        .single();
      if (insErr) throw insErr;
      return newV as VoucherRow;
    },
    onSuccess: (newV) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success("Voucher reemitido com sucesso");
      setReissueTarget(null);
      setRevokeReason("");
      handlePrintIndividual(newV); // Imprime o novo imediatamente
    },
    onError: (e: any) => toast.error(e.message),
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
    const batchVouchers = vouchers.filter(v => v.batch_id === batchId);
    if (batchVouchers.length === 0) {
      toast.error("Nenhum voucher encontrado neste lote (ou não carregado)");
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
          <Button variant="outline" onClick={() => setBatchIssueOpen(true)}>
            <Layers className="h-4 w-4 mr-2" /> Novo Lote
          </Button>
          <Button onClick={() => setIssueOpen(true)}>
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
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
              <Select value={scopeFilter} onValueChange={setScopeFilter}>
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
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {isLoading ? <Loader2 className="animate-spin m-auto" /> : filteredVouchers.map((v) => {
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
        </TabsContent>

        <TabsContent value="batches" className="mt-6">
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
            {batches.length === 0 && <p className="text-center text-muted-foreground py-12">Nenhum lote emitido.</p>}
          </div>
        </TabsContent>
      </Tabs>

      <IssueVoucherWizard open={issueOpen} onOpenChange={setIssueOpen} eventId={eventId} instances={instances} handlePrintIndividual={handlePrintIndividual} />
      <IssueBatchWizard open={batchIssueOpen} onOpenChange={setBatchIssueOpen} eventId={eventId} instances={instances} />
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
function IssueVoucherWizard({ open, onOpenChange, eventId, instances, handlePrintIndividual }: any) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState<string>("");
  const [instanceId, setInstanceId] = useState<string>("");
  const [isNominal, setIsNominal] = useState(true);
  const [eventualId, setEventualId] = useState<string>("");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

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
      // Validação coerente de voucher_type antes de emitir
      const vType = isNominal ? "nominal" : "aggregate";
      
      const payload: any = {
        event_id: eventId,
        voucher_type: vType,
        is_nominal: isNominal,
        qr_code_value: genQrValue(),
        status: "active",
      };
      
      if (isNominal) {
        if (!eventualId) throw new Error("ID da pessoa eventual é obrigatório para vouchers nominais.");
        payload.eventual_person_id = eventualId;
      }
      
      if (serviceType === "meals") { 
        payload.target_meal_window_id = instanceId; 
        payload.scope_meals = true; 
      } else if (serviceType === "transport") { 
        payload.target_trip_id = instanceId; 
        payload.scope_transport = true; 
      } else if (serviceType === "lodging") { 
        payload.target_facility_id = instanceId; 
        payload.scope_lodging = true; 
      } else {
        throw new Error("Tipo de serviço inválido.");
      }
      
      if (!instanceId) throw new Error("Instância de serviço (refeição/viagem/local) não selecionada.");

      // Payload sanitizado para auditoria (evita qr_code_value e campos sensíveis)
      const sanitizedAuditPayload = {
        event_id: eventId,
        voucher_type: vType,
        is_nominal: isNominal,
        eventual_person_id: payload.eventual_person_id,
        service_type: serviceType,
        instance_id: instanceId,
        qr_hash: btoa(payload.qr_code_value).slice(0, 10), // Hash reduzido para rastreio sem expor código
        audit_info: "individual_emission"
      };

      try {
        const { data, error } = await supabase.from("service_vouchers").insert(payload).select().single();
        if (error) throw error;
        
        await supabase.from("service_voucher_audit").insert({
          event_id: eventId,
          issuer_id: user?.id,
          voucher_type: vType,
          payload: sanitizedAuditPayload,
          status: 'success'
        });

        return data;
      } catch (err: any) {
        await supabase.from("service_voucher_audit").insert({
          event_id: eventId,
          issuer_id: user?.id,
          voucher_type: vType,
          payload: { ...sanitizedAuditPayload, audit_info: "individual_failed" },
          status: 'error',
          error_message: err.message
        });
        throw err;
      }
    },
    onSuccess: (newV) => {
      toast.success("Voucher emitido com sucesso");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      // Tenta imprimir automaticamente se for individual
      if (newV) {
        handlePrintIndividual(newV as unknown as VoucherRow);
      }
    },
    onError: (err: any) => {
      console.error("Erro na mutação de voucher:", err);
      let errorMsg = err.message || "Erro desconhecido";
      
      // Detecção de divergência de schema (PostgREST ou erro 404/400 de coluna)
      if (errorMsg.includes("voucher_type") || errorMsg.includes("column") || errorMsg.includes("not found")) {
        errorMsg = "Divergência de esquema detectada no banco de dados. Por favor, execute as migrações mais recentes ou limpe o cache do sistema.";
      }

      toast.error("Erro ao emitir voucher", {
        description: errorMsg,
        duration: 8000,
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo Voucher Individual</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {step === 1 && (
            <div className="grid grid-cols-3 gap-2">
              <Button variant={serviceType === "meals" ? "default" : "outline"} onClick={() => setServiceType("meals")} className="flex-col h-20"><UtensilsCrossed /> Alimentação</Button>
              <Button variant={serviceType === "transport" ? "default" : "outline"} onClick={() => setServiceType("transport")} className="flex-col h-20"><Bus /> Transporte</Button>
              <Button variant={serviceType === "lodging" ? "default" : "outline"} onClick={() => setServiceType("lodging")} className="flex-col h-20"><BedDouble /> Alojamento</Button>
            </div>
          )}
          {step === 2 && (
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger><SelectValue placeholder="Selecione a instância" /></SelectTrigger>
              <SelectContent>
                {serviceType === "meals" && instances.meals.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.label} ({m.service_date})</SelectItem>)}
                {serviceType === "transport" && instances.trips.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.routes?.name} ({format(new Date(t.scheduled_at), "dd/MM HH:mm")})</SelectItem>)}
                {serviceType === "lodging" && instances.locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
          {step < 3 ? <Button onClick={() => setStep(s => s + 1)} disabled={!serviceType || (step === 2 && !instanceId)}>Próximo</Button> : <Button onClick={() => mutation.mutate()} disabled={isNominal && !eventualId}>Emitir Voucher</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueBatchWizard({ open, onOpenChange, eventId, instances }: any) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState<string>("");
  const [instanceId, setInstanceId] = useState<string>("");
  const [quantity, setQuantity] = useState(10);
  const [label, setLabel] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      // Validação de tipo de serviço em lote
      if (!serviceType) throw new Error("Selecione o tipo de serviço.");
      if (!instanceId) throw new Error("Selecione a instância do serviço.");
      if (quantity <= 0) throw new Error("A quantidade deve ser maior que zero.");

      const auditPayload = { serviceType, quantity, label, instanceId };
      try {
        const { data: batch, error: bErr } = await supabase.from("service_voucher_batches").insert({
          event_id: eventId,
          label,
          service_type: serviceType,
          quantity,
          target_meal_window_id: serviceType === "meals" ? instanceId : null,
          target_trip_id: serviceType === "transport" ? instanceId : null,
          target_facility_id: serviceType === "lodging" ? instanceId : null,
        }).select().single();
        
        if (bErr) throw bErr;

        const vouchersToInsert = Array.from({ length: quantity }).map(() => ({
          event_id: eventId,
          batch_id: batch.id,
          participant_id: null,
          voucher_type: "aggregate" as const, // Lote sempre cria agregado por padrão
          is_nominal: false,
          qr_code_value: genQrValue(),
          status: "active",
          scope_meals: serviceType === "meals",
          scope_transport: serviceType === "transport",
          scope_lodging: serviceType === "lodging",
          target_meal_window_id: serviceType === "meals" ? instanceId : null,
          target_trip_id: serviceType === "transport" ? instanceId : null,
          target_facility_id: serviceType === "lodging" ? instanceId : null,
        }));

        const { error: vErr } = await supabase.from("service_vouchers").insert(vouchersToInsert as any);
        if (vErr) throw vErr;

        await supabase.from("service_voucher_audit").insert({
          event_id: eventId,
          issuer_id: user?.id,
          voucher_type: 'batch',
          payload: { ...auditPayload, created_count: quantity },
          status: 'success'
        });
      } catch (err: any) {
        await supabase.from("service_voucher_audit").insert({
          event_id: eventId,
          issuer_id: user?.id,
          voucher_type: 'batch',
          payload: { ...auditPayload, error: err.message },
          status: 'error',
          error_message: err.message
        });
        throw err;
      }
    },
    onSuccess: () => {
      toast.success("Lote emitido com sucesso");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      qc.invalidateQueries({ queryKey: ["voucher-batches"] });
    },
    onError: (err: any) => {
      console.error("Erro ao emitir lote:", err);
      let errorMsg = err.message || "Erro desconhecido";
      
      if (errorMsg.includes("service_type") || errorMsg.includes("column") || errorMsg.includes("not found")) {
        errorMsg = "Divergência de esquema detectada (tabela de lotes). Verifique as migrações de banco de dados.";
      }

      toast.error("Erro ao emitir lote", {
        description: errorMsg,
        duration: 8000,
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Emitir Novo Lote</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {step === 1 && (
             <div className="grid grid-cols-3 gap-2">
              <Button variant={serviceType === "meals" ? "default" : "outline"} onClick={() => setServiceType("meals")} className="flex-col h-20"><UtensilsCrossed /> Alimentação</Button>
              <Button variant={serviceType === "transport" ? "default" : "outline"} onClick={() => setServiceType("transport")} className="flex-col h-20"><Bus /> Transporte</Button>
              <Button variant={serviceType === "lodging" ? "default" : "outline"} onClick={() => setServiceType("lodging")} className="flex-col h-20"><BedDouble /> Alojamento</Button>
            </div>
          )}
          {step === 2 && (
             <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger><SelectValue placeholder="Instância de Serviço" /></SelectTrigger>
                <SelectContent>
                  {serviceType === "meals" && instances.meals.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.label} ({m.service_date})</SelectItem>)}
                  {serviceType === "transport" && instances.trips.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.routes?.name} ({format(new Date(t.scheduled_at), "dd/MM HH:mm")})</SelectItem>)}
                  {serviceType === "lodging" && instances.locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
             </Select>
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
          {step < 3 ? <Button onClick={() => setStep(s => s + 1)} disabled={!serviceType || (step === 2 && !instanceId)}>Próximo</Button> : <Button onClick={() => mutation.mutate()}>Gerar {quantity} Vouchers</Button>}
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
