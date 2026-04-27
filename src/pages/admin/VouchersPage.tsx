import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import QRCode from "qrcode";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Trash2 } from "lucide-react";
import {
  exportVouchersCsv,
  exportVouchersPdf,
  printVoucherLabelsPdf,
  type VoucherExportRow,
} from "@/lib/voucherExport";

// -------- Types --------
interface VoucherRow {
  id: string;
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
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  notes: string | null;
  revoke_reason: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface EventualOption {
  id: string;
  full_name: string;
  involvement_type: string;
  organization: string | null;
}

interface ParticipantOption {
  id: string;
  participant_type: string;
  person_id: string;
  full_name: string;
  cpf: string | null;
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  revoked: { label: "Revogado", variant: "destructive" },
  expired: { label: "Expirado", variant: "secondary" },
  exhausted: { label: "Esgotado", variant: "secondary" },
};

function genQrValue() {
  // Prefixo `voucher:` é obrigatório para detecção pelo PWA (isVoucherQr).
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 20; i++) suffix += alpha[Math.floor(Math.random() * alpha.length)];
  return `voucher:${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

// -------- Page --------
export default function VouchersPage() {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [issueOpen, setIssueOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [printVoucher, setPrintVoucher] = useState<VoucherRow | null>(null);
  const [historyVoucher, setHistoryVoucher] = useState<VoucherRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<VoucherRow | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  // -------- Vouchers query --------
  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["vouchers", eventId, statusFilter, scopeFilter, typeFilter],
    queryFn: async () => {
      let q = (supabase.from("service_vouchers") as any)
        .select(
          "id, participant_id, qr_code_value, status, voucher_type, label, is_contingency, scope_transport, scope_meals, scope_lodging, max_uses, current_uses, valid_from, valid_until, notes, revoke_reason, revoked_at, created_at"
        )
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

  // -------- People for vouchers (only nominal) --------
  const participantIds = useMemo(
    () => [...new Set(vouchers.filter((v) => v.participant_id).map((v) => v.participant_id as string))],
    [vouchers]
  );

  const { data: participantsMap = new Map<string, ParticipantOption>() } = useQuery({
    queryKey: ["vouchers-participants", participantIds],
    queryFn: async () => {
      if (participantIds.length === 0) return new Map();
      const { data: parts, error } = await supabase
        .from("participants")
        .select("id, participant_type, person_id")
        .in("id", participantIds);
      if (error) throw error;
      const personIds = [...new Set((parts ?? []).map((p) => p.person_id))];
      const { data: people, error: pErr } = await supabase
        .from("people")
        .select("id, full_name, cpf")
        .in("id", personIds);
      if (pErr) throw pErr;
      const peopleById = new Map(people?.map((p) => [p.id, p]) ?? []);
      const out = new Map<string, ParticipantOption>();
      (parts ?? []).forEach((p) => {
        const person = peopleById.get(p.person_id);
        out.set(p.id, {
          id: p.id,
          participant_type: p.participant_type,
          person_id: p.person_id,
          full_name: person?.full_name ?? "—",
          cpf: person?.cpf ?? null,
        });
      });
      return out;
    },
    enabled: participantIds.length > 0,
  });

  const filteredVouchers = useMemo(() => {
    if (!search.trim()) return vouchers;
    const term = search.toLowerCase();
    return vouchers.filter((v) => {
      if (v.voucher_type === "aggregate") {
        return (
          (v.label ?? "").toLowerCase().includes(term) ||
          v.qr_code_value.toLowerCase().includes(term)
        );
      }
      const p = v.participant_id ? participantsMap.get(v.participant_id) : null;
      if (!p) return v.qr_code_value.toLowerCase().includes(term);
      return (
        p.full_name.toLowerCase().includes(term) ||
        (p.cpf ?? "").includes(term) ||
        v.qr_code_value.toLowerCase().includes(term)
      );
    });
  }, [vouchers, participantsMap, search]);

  // -------- Revoke mutation --------
  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (!revokeTarget) throw new Error("Nenhum voucher selecionado");
      if (!revokeReason.trim()) throw new Error("Informe o motivo da revogação");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("service_vouchers")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id ?? null,
          revoke_reason: revokeReason.trim(),
        })
        .eq("id", revokeTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success("Voucher revogado");
      setRevokeTarget(null);
      setRevokeReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const buildExportRows = (): VoucherExportRow[] =>
    filteredVouchers.map((v) => {
      const p = v.participant_id ? participantsMap.get(v.participant_id) : null;
      return {
        id: v.id,
        voucher_type: v.voucher_type,
        label: v.label,
        participant_name: p?.full_name ?? null,
        participant_type: p?.participant_type ?? null,
        cpf: p?.cpf ?? null,
        qr_code_value: v.qr_code_value,
        status: v.status,
        is_contingency: v.is_contingency,
        scope_transport: v.scope_transport,
        scope_meals: v.scope_meals,
        scope_lodging: v.scope_lodging,
        max_uses: v.max_uses,
        current_uses: v.current_uses,
        valid_until: v.valid_until,
        created_at: v.created_at,
      };
    });

  const filenameSuffix = typeFilter === "all" ? "todos" : typeFilter;

  const handleExportCsv = () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      toast.error("Nenhum voucher para exportar com os filtros atuais");
      return;
    }
    exportVouchersCsv(rows, `vouchers-${filenameSuffix}`);
    toast.success(`CSV gerado (${rows.length} vouchers)`);
  };

  const handleExportPdf = async () => {
    const rows = buildExportRows();
    if (rows.length === 0) {
      toast.error("Nenhum voucher para exportar com os filtros atuais");
      return;
    }
    try {
      await exportVouchersPdf(
        rows,
        { typeFilter, statusFilter, scopeFilter },
        `vouchers-${filenameSuffix}`
      );
      toast.success(`PDF gerado (${rows.length} vouchers)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vouchers de Serviço</h1>
          <p className="text-sm text-muted-foreground">
            Emita, revogue e auditе vouchers QR (transporte, alimentação, alojamento)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={filteredVouchers.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCsv}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf}>
                <FileText className="h-4 w-4 mr-2" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Fluxo legado de contingência desativado para novos lotes */}
          {/* <Button variant="outline" onClick={() => setBulkOpen(true)}>
            <Users className="h-4 w-4 mr-2" /> Lote por Delegação
          </Button> */}
          <Button onClick={() => setIssueOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Emitir Voucher
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
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
              <SelectItem value="nominal">Nominal (contingência)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredVouchers.length === 0 ? (
        <Card className="p-12 text-center">
          <QrIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum voucher encontrado</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredVouchers.map((v) => {
            const p = v.participant_id ? participantsMap.get(v.participant_id) : null;
            const status = STATUS_LABEL[v.status] ?? { label: v.status, variant: "outline" as const };
            const isAggregate = v.voucher_type === "aggregate";
            return (
              <Card
                key={v.id}
                className={`p-4 space-y-3 ${v.is_contingency ? "border-warning/50 bg-warning/5" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {isAggregate ? (v.label ?? "Voucher agregado") : (p?.full_name ?? "—")}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isAggregate ? "Acompanhante / agregado" : `${p?.participant_type ?? "—"}${p?.cpf ? ` · CPF ${p.cpf}` : ""}`}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {isAggregate ? (
                      <Badge variant="secondary" className="text-[10px]">Agregado</Badge>
                    ) : v.is_contingency ? (
                      <Badge variant="outline" className="text-[10px] border-warning text-warning-foreground">Contingência</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {v.scope_transport && (
                    <Badge variant="outline" className="text-xs">
                      <Bus className="h-3 w-3 mr-1" /> Transporte
                    </Badge>
                  )}
                  {v.scope_meals && (
                    <Badge variant="outline" className="text-xs">
                      <UtensilsCrossed className="h-3 w-3 mr-1" /> Alimentação
                    </Badge>
                  )}
                  {v.scope_lodging && (
                    <Badge variant="outline" className="text-xs">
                      <BedDouble className="h-3 w-3 mr-1" /> Alojamento
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="font-mono truncate">{v.qr_code_value}</p>
                  <p>
                    Usos: <span className="font-medium text-foreground">{v.current_uses}</span>
                    {v.max_uses != null && ` / ${v.max_uses}`}
                    {v.max_uses == null && " (ilimitado)"}
                  </p>
                  {v.valid_until && <p>Válido até: {new Date(v.valid_until).toLocaleDateString("pt-BR")}</p>}
                  {v.revoke_reason && <p className="text-destructive">Revogado: {v.revoke_reason}</p>}
                </div>

                <div className="flex gap-1.5 pt-2 border-t border-border">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setPrintVoucher(v)}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" /> QR
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setHistoryVoucher(v)}>
                    <History className="h-3.5 w-3.5 mr-1.5" /> Usos
                  </Button>
                  {v.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => setRevokeTarget(v)}>
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Issue Dialog */}
      <IssueVoucherDialog open={issueOpen} onOpenChange={setIssueOpen} eventId={eventId} onIssued={(v) => setPrintVoucher(v)} />
      <BulkIssueByDelegationDialog open={bulkOpen} onOpenChange={setBulkOpen} eventId={eventId} />

      {/* Print/QR Dialog */}
      <PrintVoucherDialog
        voucher={printVoucher}
        participant={printVoucher && printVoucher.participant_id ? participantsMap.get(printVoucher.participant_id) ?? null : null}
        onClose={() => setPrintVoucher(null)}
      />

      {/* History Dialog */}
      <UsageHistoryDialog voucher={historyVoucher} onClose={() => setHistoryVoucher(null)} />

      {/* Revoke Dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar voucher</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação inativa o voucher imediatamente. Informe um motivo claro para auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo *</Label>
            <Textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Ex.: Voucher emitido por engano / Pessoa desligada da delegação"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                revokeMutation.mutate();
              }}
              disabled={!revokeReason.trim() || revokeMutation.isPending}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// -------- Issue Dialog --------
function IssueVoucherDialog({
  open,
  onOpenChange,
  eventId,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventId: string;
  onIssued: (v: VoucherRow) => void;
}) {
  const queryClient = useQueryClient();
  const [voucherType, setVoucherType] = useState<"aggregate" | "nominal">("aggregate");
  const [aggregateLabel, setAggregateLabel] = useState("");
  const [aggregateBatchSize, setAggregateBatchSize] = useState("1");
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [eventualId, setEventualId] = useState<string | null>(null);
  const [scopeTransport, setScopeTransport] = useState(true);
  const [scopeMeals, setScopeMeals] = useState(true);
  const [scopeLodging, setScopeLodging] = useState(false);
  const [targetMealId, setTargetMealId] = useState<string | null>(null);
  const [targetTripId, setTargetTripId] = useState<string | null>(null);
  const [maxUses, setMaxUses] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Reset on close
  useEffect(() => {
    if (!open) {
      setVoucherType("aggregate");
      setAggregateLabel("");
      setAggregateBatchSize("1");
      setParticipantSearch("");
      setParticipantId(null);
      setScopeTransport(true);
      setScopeMeals(true);
      setScopeLodging(false);
      setMaxUses("");
      setValidUntil("");
      setNotes("");
    }
  }, [open]);

  const { data: eventualOptions = [] } = useQuery({
    queryKey: ["voucher-eventual-search", eventId, participantSearch],
    queryFn: async () => {
      if (!participantSearch.trim() || participantSearch.trim().length < 2) return [];
      const term = `%${participantSearch.trim()}%`;
      const { data, error } = await supabase
        .from("service_eventual_people")
        .select("id, full_name, involvement_type, organization")
        .eq("event_id", eventId)
        .ilike("full_name", term)
        .limit(20);
      if (error) throw error;
      return data as EventualOption[];
    },
    enabled: open && participantSearch.trim().length >= 2 && voucherType === "nominal",
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!scopeTransport && !scopeMeals && !scopeLodging) throw new Error("Selecione ao menos um escopo");
      const max = maxUses.trim() ? parseInt(maxUses.trim(), 10) : null;
      if (maxUses.trim() && (Number.isNaN(max) || max! < 1)) throw new Error("Máximo de usos inválido");
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (voucherType === "nominal") {
        if (!eventualId) throw new Error("Selecione uma pessoa eventual");
        const { data, error } = await (supabase.from("service_vouchers") as any)
          .insert({
            event_id: eventId,
            eventual_person_id: eventualId,
            voucher_type: "nominal",
            is_nominal: true,
            is_contingency: false,
            qr_code_value: genQrValue(),
            scope_transport: scopeTransport,
            scope_meals: scopeMeals,
            scope_lodging: scopeLodging,
            target_meal_window_id: targetMealId,
            target_trip_id: targetTripId,
            max_uses: max,
            valid_until: validUntil ? new Date(validUntil).toISOString() : null,
            notes: notes.trim() || null,
            issued_by: user?.id ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        return data as VoucherRow;
      }

      // Aggregate (with optional batch)
      const labelBase = aggregateLabel.trim();
      if (!labelBase) throw new Error("Informe um identificador (label) para o voucher agregado");
      const batch = Math.max(1, parseInt(aggregateBatchSize || "1", 10) || 1);
      const rows = Array.from({ length: batch }, (_, i) => ({
        event_id: eventId,
        participant_id: null,
        voucher_type: "aggregate",
        label: batch > 1 ? `${labelBase} #${String(i + 1).padStart(2, "0")}` : labelBase,
        is_nominal: false,
        is_contingency: false,
        qr_code_value: genQrValue(),
        scope_transport: scopeTransport,
        scope_meals: scopeMeals,
        scope_lodging: scopeLodging,
        max_uses: max,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        notes: notes.trim() || null,
        issued_by: user?.id ?? null,
      }));
      const { data, error } = await (supabase.from("service_vouchers") as any)
        .insert(rows)
        .select(
          "id, participant_id, qr_code_value, status, voucher_type, label, is_contingency, scope_transport, scope_meals, scope_lodging, max_uses, current_uses, valid_from, valid_until, notes, revoke_reason, revoked_at, created_at"
        );
      if (error) throw error;
      return (data as VoucherRow[])[0];
    },
    onSuccess: (v) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(voucherType === "aggregate" && parseInt(aggregateBatchSize, 10) > 1
        ? `${aggregateBatchSize} vouchers emitidos`
        : "Voucher emitido");
      onOpenChange(false);
      onIssued(v);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selected = eventualOptions.find((p) => p.id === eventualId);

  // ===== Wizard state =====
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  const stepTitles: Record<1 | 2 | 3 | 4, { title: string; hint: string }> = {
    1: { title: "Tipo de voucher", hint: "Quem vai usar este voucher?" },
    2: {
      title: voucherType === "aggregate" ? "Identificação do lote" : "Selecionar pessoa",
      hint:
        voucherType === "aggregate"
          ? "Dê um nome de referência e quantos vouchers gerar."
          : "Apenas para credenciados sem credencial (contingência).",
    },
    3: { title: "Escopos e limites", hint: "Onde o voucher pode ser usado e até quando?" },
    4: { title: "Revisão e emissão", hint: "Confira tudo antes de gerar o QR." },
  };

  const scopeCount = [scopeTransport, scopeMeals, scopeLodging].filter(Boolean).length;
  const batchN = Math.max(1, parseInt(aggregateBatchSize || "1", 10) || 1);

  const canAdvance = (() => {
    if (step === 1) return true;
    if (step === 2) {
      if (voucherType === "aggregate") return aggregateLabel.trim().length > 0;
      return !!participantId;
    }
    if (step === 3) return scopeCount > 0;
    return true;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emitir voucher — Passo {step} de 4</DialogTitle>
          <DialogDescription>
            <strong>{stepTitles[step].title}.</strong> {stepTitles[step].hint}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5 -mt-2" aria-label={`Passo ${step} de 4`}>
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                n <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="space-y-4 pt-2">
          {step === 1 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setVoucherType("aggregate")}
                className={`w-full text-left rounded-lg border p-4 transition-all ${
                  voucherType === "aggregate"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <p className="font-semibold text-sm">Agregado (recomendado)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Voucher sem nome. Use para acompanhantes, pais, equipe externa, voluntários.
                  Pode gerar vários de uma vez (lote).
                </p>
              </button>
              <button
                type="button"
                onClick={() => setVoucherType("nominal")}
                className={`w-full text-left rounded-lg border p-4 transition-all ${
                  voucherType === "nominal"
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <p className="font-semibold text-sm">Nominal (contingência)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vinculado a um participante específico. Use somente quando o credenciado
                  estiver sem credencial física disponível.
                </p>
              </button>
            </div>
          )}

          {step === 2 && voucherType === "aggregate" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Identificador (label) *</Label>
                <Input
                  placeholder="Ex.: Acompanhante - Delegação RR"
                  value={aggregateLabel}
                  onChange={(e) => setAggregateLabel(e.target.value)}
                  maxLength={120}
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">
                  Aparece no relatório de uso do voucher.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Quantidade no lote</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={aggregateBatchSize}
                  onChange={(e) => setAggregateBatchSize(e.target.value)}
                />
                {batchN > 1 && (
                  <p className="text-[11px] text-muted-foreground">
                    Serão criados <strong>{batchN}</strong> vouchers com sufixo #01, #02, ...
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 2 && voucherType === "nominal" && (
            <div className="space-y-3">
              <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-xs">
                Vouchers nominais exigem uma pessoa cadastrada no módulo de <strong>Pessoas Eventuais</strong>.
              </div>
              {selected ? (
                <Card className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selected.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selected.involvement_type}
                      {selected.organization ? ` · ${selected.organization}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEventualId(null)}>
                    Trocar
                  </Button>
                </Card>
              ) : (
                <>
                  <Label>Buscar pessoa eventual *</Label>
                  <Input
                    placeholder="Nome da pessoa (mín. 2 caracteres)"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    autoFocus
                  />
                  {participantSearch.trim().length >= 2 && eventualOptions.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma pessoa encontrada.</p>
                  )}
                  {eventualOptions.length > 0 && (
                    <Card className="max-h-48 overflow-auto divide-y divide-border">
                      {eventualOptions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setEventualId(p.id)}
                          className="w-full text-left p-2 hover:bg-accent transition-colors"
                        >
                          <p className="text-sm font-medium">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.involvement_type}
                            {p.organization ? ` · ${p.organization}` : ""}
                          </p>
                        </button>
                      ))}
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Onde pode ser usado *</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer rounded-md border border-border p-2.5 hover:bg-muted/40">
                    <Switch checked={scopeTransport} onCheckedChange={setScopeTransport} />
                    <Bus className="h-4 w-4" />
                    <span className="text-sm">Transporte</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer rounded-md border border-border p-2.5 hover:bg-muted/40">
                    <Switch checked={scopeMeals} onCheckedChange={setScopeMeals} />
                    <UtensilsCrossed className="h-4 w-4" />
                    <span className="text-sm">Alimentação</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer rounded-md border border-border p-2.5 hover:bg-muted/40">
                    <Switch checked={scopeLodging} onCheckedChange={setScopeLodging} />
                    <BedDouble className="h-4 w-4" />
                    <span className="text-sm">Alojamento</span>
                  </label>
                </div>
                {scopeCount === 0 && (
                  <p className="text-xs text-destructive">Selecione pelo menos um escopo.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Máx. usos</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Ilimitado"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Válido até</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                  rows={2}
                  maxLength={500}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              {/* Prévia visual do voucher */}
              <VoucherPreviewCard
                voucherType={voucherType}
                label={voucherType === "aggregate" ? aggregateLabel : selected?.full_name ?? ""}
                participantType={voucherType === "nominal" ? selected?.involvement_type ?? null : null}
                cpf={voucherType === "nominal" ? selected?.organization ?? null : null}
                scopeTransport={scopeTransport}
                scopeMeals={scopeMeals}
                scopeLodging={scopeLodging}
                maxUses={maxUses.trim() || null}
                validUntil={validUntil || null}
                batchN={batchN}
              />

              <Card className="p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium">
                    {voucherType === "aggregate" ? "Agregado" : "Nominal"}
                  </span>
                </div>
                {voucherType === "aggregate" ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Identificador</span>
                      <span className="font-medium truncate max-w-[60%]">{aggregateLabel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantidade</span>
                      <span className="font-medium">{batchN}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Participante</span>
                    <span className="font-medium truncate max-w-[60%]">
                      {selected?.full_name ?? "—"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Escopos</span>
                  <span className="font-medium">
                    {[
                      scopeTransport && "Transporte",
                      scopeMeals && "Alimentação",
                      scopeLodging && "Alojamento",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Máx. usos</span>
                  <span className="font-medium">{maxUses.trim() || "Ilimitado"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Válido até</span>
                  <span className="font-medium">{validUntil || "Sem validade"}</span>
                </div>
              </Card>
              <p className="text-[11px] text-muted-foreground text-center">
                O QR exibido acima é uma <strong>simulação</strong>. O QR final será gerado e
                aberto para impressão após emitir.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
              Voltar
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={() => setStep((s) => (s + 1) as 2 | 3 | 4)} disabled={!canAdvance}>
              Avançar
            </Button>
          ) : (
            <Button onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending}>
              {issueMutation.isPending
                ? "Emitindo..."
                : voucherType === "aggregate" && batchN > 1
                ? `Emitir ${batchN} vouchers`
                : "Emitir voucher"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------- Voucher Preview Card (mostra prévia visual + QR simulado) --------
function VoucherPreviewCard({
  voucherType,
  label,
  participantType,
  cpf,
  scopeTransport,
  scopeMeals,
  scopeLodging,
  maxUses,
  validUntil,
  batchN,
}: {
  voucherType: "aggregate" | "nominal";
  label: string;
  participantType: string | null;
  cpf: string | null;
  scopeTransport: boolean;
  scopeMeals: boolean;
  scopeLodging: boolean;
  maxUses: string | null;
  validUntil: string | null;
  batchN: number;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    const previewValue = `PREVIEW::${voucherType}::${label || "—"}::${Date.now()}`;
    QRCode.toDataURL(previewValue, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [voucherType, label, scopeTransport, scopeMeals, scopeLodging]);

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
    } catch {
      return iso;
    }
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/30">
      <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QrIcon className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Prévia do voucher
          </span>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {voucherType === "aggregate" ? "Agregado" : "Nominal"}
        </Badge>
      </div>

      <div className="p-4 grid grid-cols-[110px_1fr] gap-4 items-center">
        <div className="flex flex-col items-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code (prévia)"
              className="h-[110px] w-[110px] rounded border border-border"
            />
          ) : (
            <div className="h-[110px] w-[110px] rounded border border-border bg-muted animate-pulse" />
          )}
          <span className="text-[9px] text-muted-foreground mt-1">prévia</span>
        </div>

        <div className="space-y-1.5 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate" title={label}>
            {label || <span className="text-muted-foreground italic">Sem identificador</span>}
          </p>
          {voucherType === "nominal" && participantType && (
            <p className="text-[11px] text-muted-foreground">
              {participantType}
              {cpf ? ` · ${cpf}` : ""}
            </p>
          )}
          {voucherType === "aggregate" && batchN > 1 && (
            <p className="text-[11px] text-muted-foreground">Lote de {batchN} vouchers</p>
          )}

          <div className="flex flex-wrap gap-1 pt-1">
            {scopeTransport && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Bus className="h-3 w-3" /> Transporte
              </Badge>
            )}
            {scopeMeals && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <UtensilsCrossed className="h-3 w-3" /> Alimentação
              </Badge>
            )}
            {scopeLodging && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <BedDouble className="h-3 w-3" /> Alojamento
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
            <span>
              <strong className="text-foreground">{maxUses ?? "∞"}</strong> uso(s)
            </span>
            <span>
              Válido até{" "}
              <strong className="text-foreground">
                {validUntil ? fmtDate(validUntil) : "sem prazo"}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// -------- Print Dialog --------
function PrintVoucherDialog({
  voucher,
  participant,
  onClose,
}: {
  voucher: VoucherRow | null;
  participant: ParticipantOption | null;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!voucher) return;
    QRCode.toDataURL(voucher.qr_code_value, { width: 320, margin: 1 })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [voucher]);

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;
    const win = window.open("", "_blank", "width=600,height=800");
    if (!win) return;
    win.document.write(`<html><head><title>Voucher</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; text-align: center; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        p { margin: 4px 0; font-size: 13px; color: #333; }
        img { max-width: 280px; }
        .scopes { margin-top: 12px; font-size: 12px; }
        .code { font-family: monospace; font-size: 11px; color: #666; margin-top: 8px; word-break: break-all; }
      </style></head><body>${node.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  };

  if (!voucher) return null;
  const scopes = [
    voucher.scope_transport && "Transporte",
    voucher.scope_meals && "Alimentação",
    voucher.scope_lodging && "Alojamento",
  ].filter(Boolean).join(" · ");

  return (
    <Dialog open={!!voucher} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>QR do Voucher</DialogTitle>
        </DialogHeader>
        <div ref={printRef} className="text-center py-4">
          <h1 className="text-base font-bold">
            {voucher.voucher_type === "aggregate"
              ? (voucher.label ?? "Voucher agregado")
              : (participant?.full_name ?? "—")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {voucher.voucher_type === "aggregate"
              ? "Acompanhante / agregado"
              : `${participant?.participant_type ?? ""}${participant?.cpf ? ` · CPF ${participant.cpf}` : ""}`}
          </p>
          {dataUrl ? (
            <img src={dataUrl} alt="QR Code" className="mx-auto my-4" />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin mx-auto my-12" />
          )}
          <p className="scopes text-sm font-medium">{scopes}</p>
          {voucher.max_uses != null && (
            <p className="text-xs">
              Usos: {voucher.current_uses} / {voucher.max_uses}
            </p>
          )}
          {voucher.valid_until && (
            <p className="text-xs">Válido até: {new Date(voucher.valid_until).toLocaleDateString("pt-BR")}</p>
          )}
          <p className="code font-mono text-xs text-muted-foreground mt-2 break-all">{voucher.qr_code_value}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={handlePrint} disabled={!dataUrl}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------- Usage History Dialog --------
function UsageHistoryDialog({ voucher, onClose }: { voucher: VoucherRow | null; onClose: () => void }) {
  const { data: uses = [], isLoading } = useQuery({
    queryKey: ["voucher-uses", voucher?.id],
    queryFn: async () => {
      if (!voucher) return [];
      const { data, error } = await supabase
        .from("service_voucher_uses")
        .select("id, service_kind, used_at, context_id, notes")
        .eq("voucher_id", voucher.id)
        .order("used_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!voucher,
  });

  return (
    <Dialog open={!!voucher} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Histórico de uso</DialogTitle>
          <DialogDescription className="font-mono text-xs">{voucher?.qr_code_value}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto my-8" />
        ) : uses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum uso registrado</p>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="all">Todos ({uses.length})</TabsTrigger>
              <TabsTrigger value="transport">
                <Bus className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger value="meals">
                <UtensilsCrossed className="h-3.5 w-3.5" />
              </TabsTrigger>
              <TabsTrigger value="lodging">
                <BedDouble className="h-3.5 w-3.5" />
              </TabsTrigger>
            </TabsList>
            {(["all", "transport", "meals", "lodging"] as const).map((tab) => {
              const items = tab === "all" ? uses : uses.filter((u) => u.service_kind === tab);
              return (
                <TabsContent key={tab} value={tab} className="space-y-2 max-h-80 overflow-auto">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro</p>
                  ) : (
                    items.map((u) => (
                      <Card key={u.id} className="p-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium capitalize">{u.service_kind}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(u.used_at).toLocaleString("pt-BR")}
                          </p>
                          {u.notes && <p className="text-xs text-muted-foreground italic">{u.notes}</p>}
                        </div>
                      </Card>
                    ))
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------- Bulk Issue by Delegation --------
function BulkIssueByDelegationDialog({
  open,
  onOpenChange,
  eventId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  eventId: string;
}) {
  const queryClient = useQueryClient();
  const [delegationId, setDelegationId] = useState<string>("");
  const [participantTypeFilter, setParticipantTypeFilter] = useState<string>("all");
  const [scopeTransport, setScopeTransport] = useState(true);
  const [scopeMeals, setScopeMeals] = useState(true);
  const [scopeLodging, setScopeLodging] = useState(false);
  const [maxUses, setMaxUses] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setDelegationId("");
      setParticipantTypeFilter("all");
      setScopeTransport(true);
      setScopeMeals(true);
      setScopeLodging(false);
      setMaxUses("");
      setValidUntil("");
      setNotes("");
      setSelectedIds(new Set());
    }
  }, [open]);

  // Delegações do evento
  const { data: delegations = [] } = useQuery({
    queryKey: ["bulk-vouchers-delegations", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("id, school_name")
        .eq("event_id", eventId)
        .order("school_name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Array<{ id: string; school_name: string | null }>).map((d) => ({
        id: d.id,
        name: d.school_name ?? "(sem nome)",
      }));
    },
    enabled: open && !!eventId,
  });

  // Participantes da delegação selecionada
  const { data: participants = [], isLoading: loadingParts } = useQuery({
    queryKey: ["bulk-vouchers-participants", eventId, delegationId],
    queryFn: async () => {
      if (!delegationId) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, participant_type, status, person:people(id, full_name, cpf)")
        .eq("event_id", eventId)
        .eq("delegation_id", delegationId)
        .neq("status", "removed")
        .order("participant_type", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        participant_type: string;
        status: string;
        person: { id: string; full_name: string; cpf: string | null } | null;
      }>;
    },
    enabled: open && !!delegationId,
  });

  const filteredParticipants = useMemo(() => {
    if (participantTypeFilter === "all") return participants;
    return participants.filter((p) => p.participant_type === participantTypeFilter);
  }, [participants, participantTypeFilter]);

  const participantTypes = useMemo(
    () => Array.from(new Set(participants.map((p) => p.participant_type))).sort(),
    [participants],
  );

  const allFilteredSelected =
    filteredParticipants.length > 0 &&
    filteredParticipants.every((p) => selectedIds.has(p.id));

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredParticipants.forEach((p) => next.delete(p.id));
      } else {
        filteredParticipants.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scopeCount = [scopeTransport, scopeMeals, scopeLodging].filter(Boolean).length;

  const bulkMutation = useMutation({
    mutationFn: async () => {
      if (selectedIds.size === 0) throw new Error("Selecione ao menos um participante");
      if (scopeCount === 0) throw new Error("Selecione ao menos um escopo");
      const max = maxUses.trim() ? parseInt(maxUses.trim(), 10) : null;
      if (maxUses.trim() && (Number.isNaN(max) || max! < 1)) throw new Error("Máximo de usos inválido");

      const { data: { user } } = await supabase.auth.getUser();
      const rows = Array.from(selectedIds).map((pid) => ({
        event_id: eventId,
        participant_id: pid,
        voucher_type: "nominal",
        is_contingency: true,
        qr_code_value: genQrValue(),
        scope_transport: scopeTransport,
        scope_meals: scopeMeals,
        scope_lodging: scopeLodging,
        max_uses: max,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        notes: notes.trim() || null,
        issued_by: user?.id ?? null,
      }));

      const { data, error } = await (supabase.from("service_vouchers") as any)
        .insert(rows)
        .select("id");
      if (error) throw error;
      return (data as Array<{ id: string }>).length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`${count} voucher(s) emitido(s)`);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emissão em Lote por Delegação</DialogTitle>
          <DialogDescription>
            Selecione uma delegação, escolha os participantes e emita vouchers nominais
            (contingência) em lote com os mesmos escopos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Delegação */}
          <div className="space-y-2">
            <Label>Delegação *</Label>
            <Select value={delegationId} onValueChange={setDelegationId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma delegação..." />
              </SelectTrigger>
              <SelectContent>
                {delegations.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de participantes */}
          {delegationId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Participantes ({selectedIds.size} selecionados)</Label>
                <Select value={participantTypeFilter} onValueChange={setParticipantTypeFilter}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {participantTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Card className="max-h-72 overflow-auto">
                {loadingParts ? (
                  <div className="p-6 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : filteredParticipants.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Nenhum participante encontrado para esta delegação.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/40 sticky top-0">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={toggleAllFiltered}
                      />
                      <span className="text-xs font-medium">
                        Selecionar todos ({filteredParticipants.length})
                      </span>
                    </div>
                    <ul className="divide-y divide-border">
                      {filteredParticipants.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
                          <Checkbox
                            checked={selectedIds.has(p.id)}
                            onCheckedChange={() => toggleOne(p.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {p.person?.full_name ?? "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.participant_type}
                              {p.person?.cpf ? ` · ${p.person.cpf}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            </div>
          )}

          {/* Escopos & limites */}
          {delegationId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Escopos *</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer rounded-md border border-border p-2">
                    <Switch checked={scopeTransport} onCheckedChange={setScopeTransport} />
                    <Bus className="h-4 w-4" /> <span className="text-sm">Transporte</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer rounded-md border border-border p-2">
                    <Switch checked={scopeMeals} onCheckedChange={setScopeMeals} />
                    <UtensilsCrossed className="h-4 w-4" /> <span className="text-sm">Alimentação</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer rounded-md border border-border p-2">
                    <Switch checked={scopeLodging} onCheckedChange={setScopeLodging} />
                    <BedDouble className="h-4 w-4" /> <span className="text-sm">Alojamento</span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Máx. usos</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Ilimitado"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Válido até</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opcional"
                    rows={2}
                    maxLength={500}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => bulkMutation.mutate()}
            disabled={
              bulkMutation.isPending ||
              selectedIds.size === 0 ||
              scopeCount === 0
            }
          >
            {bulkMutation.isPending
              ? "Emitindo..."
              : `Emitir ${selectedIds.size} voucher(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
