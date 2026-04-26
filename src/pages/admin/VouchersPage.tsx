import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import QRCode from "qrcode";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
} from "lucide-react";

// -------- Types --------
interface VoucherRow {
  id: string;
  participant_id: string | null;
  qr_code_value: string;
  status: string;
  voucher_type: "nominal" | "aggregate";
  label: string | null;
  is_contingency: boolean;
  scope_transport: boolean;
  scope_meals: boolean;
  scope_lodging: boolean;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  notes: string | null;
  revoke_reason: string | null;
  revoked_at: string | null;
  created_at: string;
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vouchers de Serviço</h1>
          <p className="text-sm text-muted-foreground">
            Emita, revogue e auditе vouchers QR (transporte, alimentação, alojamento)
          </p>
        </div>
        <Button onClick={() => setIssueOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Emitir Voucher
        </Button>
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
  const [scopeTransport, setScopeTransport] = useState(true);
  const [scopeMeals, setScopeMeals] = useState(true);
  const [scopeLodging, setScopeLodging] = useState(false);
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

  const { data: participantOptions = [] } = useQuery({
    queryKey: ["voucher-issue-search", eventId, participantSearch],
    queryFn: async () => {
      if (!participantSearch.trim() || participantSearch.trim().length < 2) return [];
      const term = `%${participantSearch.trim()}%`;
      const { data: people, error } = await supabase
        .from("people")
        .select("id, full_name, cpf")
        .or(`full_name.ilike.${term},cpf.ilike.${term}`)
        .limit(20);
      if (error) throw error;
      const personIds = (people ?? []).map((p) => p.id);
      if (personIds.length === 0) return [];
      const { data: parts, error: pErr } = await supabase
        .from("participants")
        .select("id, participant_type, person_id, status")
        .eq("event_id", eventId)
        .in("person_id", personIds)
        .neq("status", "removed");
      if (pErr) throw pErr;
      const peopleById = new Map(people!.map((p) => [p.id, p]));
      return (parts ?? []).map((p) => {
        const person = peopleById.get(p.person_id);
        return {
          id: p.id,
          participant_type: p.participant_type,
          full_name: person?.full_name ?? "—",
          cpf: person?.cpf ?? null,
        };
      });
    },
    enabled: open && participantSearch.trim().length >= 2,
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
        if (!participantId) throw new Error("Selecione um participante");
        const { data, error } = await (supabase.from("service_vouchers") as any)
          .insert({
            event_id: eventId,
            participant_id: participantId,
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
          })
          .select(
            "id, participant_id, qr_code_value, status, voucher_type, label, is_contingency, scope_transport, scope_meals, scope_lodging, max_uses, current_uses, valid_from, valid_until, notes, revoke_reason, revoked_at, created_at"
          )
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

  const selected = participantOptions.find((p) => p.id === participantId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Emitir Voucher QR</DialogTitle>
          <DialogDescription>
            <strong>Agregado</strong> é o padrão para acompanhantes/pais (sem nome).{" "}
            <strong>Nominal</strong> é apenas contingência para credenciados sem credencial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={voucherType} onValueChange={(v) => setVoucherType(v as "aggregate" | "nominal")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="aggregate">Agregado (padrão)</TabsTrigger>
              <TabsTrigger value="nominal">Nominal (contingência)</TabsTrigger>
            </TabsList>

            <TabsContent value="aggregate" className="space-y-3 pt-3">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Voucher sem identificação de pessoa. Use para pais, acompanhantes ou público externo.
              </div>
              <div className="space-y-2">
                <Label>Identificador (label) *</Label>
                <Input
                  placeholder="Ex.: Acompanhante - Delegação RR"
                  value={aggregateLabel}
                  onChange={(e) => setAggregateLabel(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade (lote)</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={aggregateBatchSize}
                  onChange={(e) => setAggregateBatchSize(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Quando &gt; 1, será adicionado sufixo numérico ao label (#01, #02, ...).
                </p>
              </div>
            </TabsContent>

            <TabsContent value="nominal" className="space-y-3 pt-3">
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
                <strong>Atenção:</strong> Vouchers nominais são marcados como <strong>contingência</strong>.
                O fluxo padrão para credenciados é a <strong>credencial</strong>.
              </div>
              <div className="space-y-2">
                <Label>Participante *</Label>
                {selected ? (
                  <Card className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{selected.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selected.participant_type} {selected.cpf ? `· CPF ${selected.cpf}` : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setParticipantId(null)}>
                      Trocar
                    </Button>
                  </Card>
                ) : (
                  <>
                    <Input
                      placeholder="Buscar por nome ou CPF (mín. 2 caracteres)"
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                    />
                    {participantOptions.length > 0 && (
                      <Card className="max-h-48 overflow-auto divide-y divide-border">
                        {participantOptions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setParticipantId(p.id)}
                            className="w-full text-left p-2 hover:bg-accent transition-colors"
                          >
                            <p className="text-sm font-medium">{p.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.participant_type} {p.cpf ? `· ${p.cpf}` : ""}
                            </p>
                          </button>
                        ))}
                      </Card>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label>Escopos *</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <Switch checked={scopeTransport} onCheckedChange={setScopeTransport} />
                <span className="flex items-center gap-2 text-sm">
                  <Bus className="h-4 w-4" /> Transporte
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Switch checked={scopeMeals} onCheckedChange={setScopeMeals} />
                <span className="flex items-center gap-2 text-sm">
                  <UtensilsCrossed className="h-4 w-4" /> Alimentação
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Switch checked={scopeLodging} onCheckedChange={setScopeLodging} />
                <span className="flex items-center gap-2 text-sm">
                  <BedDouble className="h-4 w-4" /> Alojamento
                </span>
              </label>
            </div>
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
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => issueMutation.mutate()}
            disabled={
              issueMutation.isPending ||
              (voucherType === "nominal" && !participantId) ||
              (voucherType === "aggregate" && !aggregateLabel.trim())
            }
          >
            {issueMutation.isPending ? "Emitindo..." : "Emitir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
