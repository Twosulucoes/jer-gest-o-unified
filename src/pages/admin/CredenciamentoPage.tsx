import { useState, useEffect, useMemo } from "react";
import { generateCredentialCode, generateQrCodeValue } from "@/lib/credentialUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  UserCheck,
  Search,
  Loader2,
  CreditCard,
  XCircle,
  RefreshCw,
  Eye,
  Clock,
  ShieldCheck,
  ArrowRight,
  Info,
  Tag,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import CredentialPreviewDialog from "@/components/admin/CredentialPreviewDialog";
import { SingleLabelDialog, BatchLabelsDialog } from "@/components/admin/CredentialLabelPrint";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta",
  coach: "Técnico",
  head_of_delegation: "Chefe Deleg.",
  staff: "Staff",
  commission: "Comissão",
};

const PAGE_SIZE = 25;

const buildDefaultFieldConfig = (w: number, h: number) => {
  const cx = w / 2;
  const photoW = Math.round(w * 0.20);
  const photoH = Math.round(photoW * 1.25);
  const photoY = Math.round(h * 0.22);
  const textStart = photoY + photoH + Math.round(h * 0.04);
  const lineH = Math.round(h * 0.04);
  const qrSize = Math.round(w * 0.18);

  return {
    photo: { x: Math.round(cx - photoW / 2), y: photoY, width: photoW, height: photoH, visible: true },
    full_name: { x: cx, y: textStart, fontSize: Math.round(h * 0.028), fontColor: "#1a1a1a", fontWeight: "bold", align: "center", maxWidth: Math.round(w * 0.8), visible: true },
    participant_type: { x: cx, y: textStart + lineH, fontSize: Math.round(h * 0.018), fontColor: "#555555", align: "center", maxWidth: Math.round(w * 0.7), visible: true },
    sport_event: { x: cx, y: textStart + lineH * 2, fontSize: Math.round(h * 0.02), fontColor: "#333333", align: "center", maxWidth: Math.round(w * 0.7), visible: true },
    institution: { x: cx, y: textStart + lineH * 3, fontSize: Math.round(h * 0.017), fontColor: "#444444", align: "center", maxWidth: Math.round(w * 0.75), visible: true },
    credential_code: { x: cx, y: textStart + lineH * 4.5, fontSize: Math.round(h * 0.02), fontColor: "#1a1a1a", fontWeight: "bold", align: "center", maxWidth: Math.round(w * 0.5), visible: true },
    qr_code: { x: Math.round(cx - qrSize / 2), y: Math.round(h * 0.82), width: qrSize, height: qrSize, visible: true },
  };
};

type ParticipantState = "awaiting" | "ready_to_emit" | "complete";

export default function CredenciamentoPage() {
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterState, setFilterState] = useState("all");
  const [filterInstitution, setFilterInstitution] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [previewParticipantId, setPreviewParticipantId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [labelParticipantId, setLabelParticipantId] = useState<string | null>(null);
  const [batchLabelIds, setBatchLabelIds] = useState<string[]>([]);
  const [batchCredentialConfirmOpen, setBatchCredentialConfirmOpen] = useState(false);
  const [batchEmitConfirmOpen, setBatchEmitConfirmOpen] = useState(false);
  const canCredential = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterType, filterState, filterInstitution]);
  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); setSearchTerm(""); setFilterType("all"); setFilterState("all"); setFilterInstitution("all"); }, [selectedEventId]);

  // --- Events ---
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // --- Template for the event ---
  const { data: eventTemplate, isFetched: templateFetched } = useQuery({
    queryKey: ["event-default-template", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return null;
      const { data, error } = await supabase
        .from("credential_templates")
        .select("*")
        .eq("event_id", selectedEventId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const createDefaultTemplateMutation = useMutation({
    mutationFn: async () => {
      const event = events.find((e) => e.id === selectedEventId);
      const { data, error } = await supabase
        .from("credential_templates")
        .insert({
          event_id: selectedEventId,
          name: `Modelo Padrão — ${event?.name ?? "Evento"}`,
          width: 600,
          height: 800,
          is_active: true,
          background_url: null,
          field_config: JSON.parse(JSON.stringify(buildDefaultFieldConfig(600, 800))),
          notes: "Modelo padrão gerado automaticamente pelo sistema.",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-default-template", selectedEventId] });
    },
  });

  useEffect(() => {
    if (selectedEventId && templateFetched && eventTemplate === null && !createDefaultTemplateMutation.isPending) {
      createDefaultTemplateMutation.mutate();
    }
  }, [selectedEventId, templateFetched, eventTemplate]);

  // --- Participants ---
  const { data: participants, isLoading } = useQuery({
    queryKey: ["credenciamento-participants", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, status, participant_type, credentialed_at, credentialed_by, person_id, delegation_id")
        .eq("event_id", selectedEventId)
        .eq("is_active", true)
        .in("status", ["confirmed", "credentialed"])
        .order("status", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  // --- Active credentials ---
  const { data: activeCredentials = [] } = useQuery({
    queryKey: ["credenciamento-credentials", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, participant_id, credential_code, status")
        .eq("event_id", selectedEventId)
        .eq("status", "active")
        .limit(2000);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const activeCredMap = new Map(activeCredentials.map((c) => [c.participant_id, c]));

  // --- People ---
  const personIds = participants?.map((p) => p.person_id) ?? [];
  const { data: people = [] } = useQuery({
    queryKey: ["credenciamento-people", personIds],
    queryFn: async () => {
      if (personIds.length === 0) return [];
      const { data, error } = await supabase
        .from("people")
        .select("id, full_name, birth_date, gender, cpf")
        .in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: personIds.length > 0,
  });

  // --- Delegations & Institutions ---
  const delegationIds = [...new Set(participants?.map((p) => p.delegation_id) ?? [])];
  const { data: delegations = [] } = useQuery({
    queryKey: ["credenciamento-delegations", delegationIds],
    queryFn: async () => {
      if (delegationIds.length === 0) return [];
      const { data, error } = await supabase.from("delegations").select("id, institution_id").in("id", delegationIds);
      if (error) throw error;
      return data;
    },
    enabled: delegationIds.length > 0,
  });

  const instIds = [...new Set(delegations.map((d) => d.institution_id))];
  const { data: institutions = [] } = useQuery({
    queryKey: ["credenciamento-institutions", instIds],
    queryFn: async () => {
      if (instIds.length === 0) return [];
      const { data, error } = await supabase.from("institutions").select("id, name").in("id", instIds);
      if (error) throw error;
      return data;
    },
    enabled: instIds.length > 0,
  });

  // --- Lookup maps ---
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const delegationMap = new Map(delegations.map((d) => [d.id, d]));
  const institutionMap = new Map(institutions.map((i) => [i.id, i]));

  const getInstitutionName = (delegationId: string) => {
    const del = delegationMap.get(delegationId);
    if (!del) return "—";
    return institutionMap.get(del.institution_id)?.name ?? "—";
  };

  const getInstitutionId = (delegationId: string) => {
    const del = delegationMap.get(delegationId);
    return del?.institution_id ?? "";
  };

  // --- Determine participant state ---
  const getParticipantState = (p: { status: string; id: string }): ParticipantState => {
    const isCredentialed = p.status === "credentialed";
    const hasActiveCred = activeCredMap.has(p.id);
    if (!isCredentialed) return "awaiting";
    if (isCredentialed && !hasActiveCred) return "ready_to_emit";
    return "complete";
  };

  // --- Institution options for filter ---
  const institutionOptions = useMemo(() => {
    const opts = institutions.map((i) => ({ id: i.id, name: i.name }));
    opts.sort((a, b) => a.name.localeCompare(b.name));
    return opts;
  }, [institutions]);

  // --- Unique participant types ---
  const participantTypeOptions = useMemo(() => {
    const types = new Set(participants?.map((p) => p.participant_type) ?? []);
    return [...types].sort();
  }, [participants]);

  // --- Filter & Sort ---
  const STATE_PRIORITY: Record<string, number> = { ready_to_emit: 0, awaiting: 1, complete: 2 };

  const filtered = useMemo(() => {
    return (participants ?? [])
      .filter((p) => {
        // Search filter
        if (searchTerm) {
          const person = peopleMap.get(p.person_id);
          if (!person) return false;
          const term = searchTerm.toLowerCase();
          if (!person.full_name.toLowerCase().includes(term) && !(person.cpf && person.cpf.includes(term))) return false;
        }
        // Type filter
        if (filterType !== "all" && p.participant_type !== filterType) return false;
        // State filter
        if (filterState !== "all") {
          const state = getParticipantState(p);
          if (state !== filterState) return false;
        }
        // Institution filter
        if (filterInstitution !== "all") {
          const instId = getInstitutionId(p.delegation_id);
          if (instId !== filterInstitution) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const stateA = getParticipantState(a);
        const stateB = getParticipantState(b);
        const prioA = STATE_PRIORITY[stateA] ?? 9;
        const prioB = STATE_PRIORITY[stateB] ?? 9;
        if (prioA !== prioB) return prioA - prioB;
        const nameA = peopleMap.get(a.person_id)?.full_name ?? "";
        const nameB = peopleMap.get(b.person_id)?.full_name ?? "";
        return nameA.localeCompare(nameB);
      });
  }, [participants, searchTerm, filterType, filterState, filterInstitution, peopleMap, activeCredMap]);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // --- Mutations ---
  const credentialMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase
        .from("participants")
        .update({
          status: "credentialed",
          credentialed_at: new Date().toISOString(),
          credentialed_by: user?.id,
        })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credenciamento-participants"] });
      toast.success("Participante credenciado!");
    },
    onError: (err: Error) => toast.error(`Erro ao credenciar: ${err.message}`),
  });

  const emitCredentialMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const credentialCode = generateCredentialCode();
      const qrCodeValue = generateQrCodeValue(selectedEventId, participantId, credentialCode);
      const { error } = await supabase.from("participant_credentials").insert({
        participant_id: participantId,
        event_id: selectedEventId,
        credential_code: credentialCode,
        qr_code_value: qrCodeValue,
        status: "active",
        binding_source: "manual",
        issued_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
        issued_by: user?.id,
        activated_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
      toast.success("Credencial emitida com sucesso!");
    },
    onError: (err: Error) => {
      if (err.message?.includes("uq_participant_event_active")) {
        toast.error("Este participante já possui credencial ativa.");
      } else {
        toast.error(`Erro ao emitir credencial: ${err.message}`);
      }
    },
  });

  const reissueMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const existing = activeCredMap.get(participantId);
      if (existing) {
        const { error: revokeErr } = await supabase
          .from("participant_credentials")
          .update({ status: "reissued", revoked_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (revokeErr) throw revokeErr;
      }
      const credentialCode = generateCredentialCode();
      const qrCodeValue = generateQrCodeValue(selectedEventId, participantId, credentialCode);
      const { error } = await supabase.from("participant_credentials").insert({
        participant_id: participantId,
        event_id: selectedEventId,
        credential_code: credentialCode,
        qr_code_value: qrCodeValue,
        status: "active",
        binding_source: "manual",
        issued_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
        issued_by: user?.id,
        activated_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
      toast.success("Credencial reemitida! A anterior foi invalidada.");
    },
    onError: (err: Error) => toast.error(`Erro na reemissão: ${err.message}`),
  });

  // --- Stats ---
  const confirmedCount = (participants ?? []).filter((p) => p.status === "confirmed").length;
  const credentialedCount = (participants ?? []).filter((p) => p.status === "credentialed").length;
  const credentialsEmittedCount = activeCredentials.length;
  const pendingEmission = credentialedCount - credentialsEmittedCount;

  const handleOpenPreview = (participantId: string) => {
    const tmpl = eventTemplate ?? createDefaultTemplateMutation.data;
    if (!tmpl) {
      toast.error("Nenhum modelo de credencial disponível para este evento.");
      return;
    }
    setPreviewTemplate(tmpl);
    setPreviewParticipantId(participantId);
  };

  // --- Batch helpers ---
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    const pageIds = paginatedItems.map((p) => p.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const awaitingIds = new Set(filtered.filter((p) => getParticipantState(p) === "awaiting").map((p) => p.id));
  const readyToEmitIds = new Set(filtered.filter((p) => getParticipantState(p) === "ready_to_emit").map((p) => p.id));

  const selectedAwaiting = [...selectedIds].filter((id) => awaitingIds.has(id));
  const selectedReadyToEmit = [...selectedIds].filter((id) => readyToEmitIds.has(id));
  const selectedComplete = [...selectedIds].filter((id) => {
    const p = filtered.find((pp) => pp.id === id);
    return p && getParticipantState(p) === "complete";
  });

  const handleBatchCredential = async () => {
    if (selectedAwaiting.length === 0) return;
    setBatchProcessing(true);
    let success = 0, errors = 0;
    for (const id of selectedAwaiting) {
      const { error } = await supabase
        .from("participants")
        .update({ status: "credentialed", credentialed_at: new Date().toISOString(), credentialed_by: user?.id })
        .eq("id", id);
      if (error) errors++; else success++;
    }
    setBatchProcessing(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["credenciamento-participants"] });
    toast.success(`${success} credenciado(s) em lote.${errors > 0 ? ` ${errors} erro(s).` : ""}`);
  };

  const handleBatchEmit = async () => {
    if (selectedReadyToEmit.length === 0) return;
    setBatchProcessing(true);
    let success = 0, errors = 0;
    for (const id of selectedReadyToEmit) {
      const credentialCode = generateCredentialCode();
      const qrCodeValue = generateQrCodeValue(selectedEventId, id, credentialCode);
      const { error } = await supabase.from("participant_credentials").insert({
        participant_id: id, event_id: selectedEventId, credential_code: credentialCode, qr_code_value: qrCodeValue,
        status: "active", binding_source: "manual", issued_at: new Date().toISOString(), activated_at: new Date().toISOString(),
        issued_by: user?.id, activated_by: user?.id,
      });
      if (error) errors++; else success++;
    }
    setBatchProcessing(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
    toast.success(`${success} credencial(is) emitida(s) em lote.${errors > 0 ? ` ${errors} erro(s).` : ""}`);
  };

  const getStateInfo = (state: string) => {
    switch (state) {
      case "awaiting":
        return { label: "Aguardando", icon: <Clock className="h-3.5 w-3.5" />, variant: "outline" as const, className: "border-yellow-300 bg-yellow-50 text-yellow-700" };
      case "ready_to_emit":
        return { label: "Pronto p/ emissão", icon: <CreditCard className="h-3.5 w-3.5" />, variant: "outline" as const, className: "border-blue-300 bg-blue-50 text-blue-700" };
      case "complete":
        return { label: "Credencial ativa", icon: <ShieldCheck className="h-3.5 w-3.5" />, variant: "outline" as const, className: "border-green-300 bg-green-50 text-green-700" };
      default:
        return { label: "—", icon: null, variant: "outline" as const, className: "" };
    }
  };

  const hasActiveFilters = filterType !== "all" || filterState !== "all" || filterInstitution !== "all" || searchTerm !== "";

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Credenciamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre presença, emita e gerencie credenciais.
        </p>
      </div>

      {/* Flow guide */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
        <Info className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Fluxo:</span>
          <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700 text-[10px] gap-1">
            <Clock className="h-3 w-3" /> Importado
          </Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px] gap-1">
            <CreditCard className="h-3 w-3" /> Credenciado
          </Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 text-[10px] gap-1">
            <ShieldCheck className="h-3 w-3" /> Credencial emitida
          </Badge>
        </div>
      </div>

      {/* Event selection */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Evento</label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o evento..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Busca por nome ou CPF</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite o nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={!selectedEventId}
                />
              </div>
            </div>
          </div>

          {/* Additional filters */}
          {selectedEventId && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Tipo
                </label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {participantTypeOptions.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Situação
                </label>
                <Select value={filterState} onValueChange={setFilterState}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as situações</SelectItem>
                    <SelectItem value="awaiting">Aguardando credenciamento</SelectItem>
                    <SelectItem value="ready_to_emit">Pronto p/ emissão</SelectItem>
                    <SelectItem value="complete">Credencial ativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Filter className="h-3 w-3" /> Instituição
                </label>
                <Select value={filterInstitution} onValueChange={setFilterInstitution}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as instituições</SelectItem>
                    {institutionOptions.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedEventId && participants && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-foreground">{participants.length}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Aguardando</p>
              <p className="text-xl font-bold text-yellow-600">{confirmedCount}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200">
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Sem credencial</p>
              <p className="text-xl font-bold text-blue-600">{pendingEmission > 0 ? pendingEmission : 0}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Emitidas</p>
              <p className="text-xl font-bold text-green-600">{credentialsEmittedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Progresso</p>
              <p className="text-xl font-bold text-primary">
                {participants.length > 0 ? `${Math.round((credentialsEmittedCount / participants.length) * 100)}%` : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty / Loading states */}
      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <UserCheck className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento para começar</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <XCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum participante encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveFilters
              ? "Nenhum resultado para os filtros aplicados. Tente ajustar os filtros."
              : "Nenhum participante importado para este evento."}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearchTerm(""); setFilterType("all"); setFilterState("all"); setFilterInstitution("all"); }}>
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Batch action bar */}
          {canCredential && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex-wrap">
              <span className="text-sm font-medium text-foreground">
                {selectedIds.size} selecionado(s)
              </span>
              <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                Limpar
              </Button>
              {selectedAwaiting.length > 0 && (
                <Button size="sm" onClick={handleBatchCredential} disabled={batchProcessing}>
                  {batchProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserCheck className="mr-1.5 h-3.5 w-3.5" />}
                  Credenciar ({selectedAwaiting.length})
                </Button>
              )}
              {selectedReadyToEmit.length > 0 && (
                <Button size="sm" onClick={handleBatchEmit} disabled={batchProcessing}>
                  {batchProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CreditCard className="mr-1.5 h-3.5 w-3.5" />}
                  Emitir ({selectedReadyToEmit.length})
                </Button>
              )}
              {selectedComplete.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setBatchLabelIds(selectedComplete)}>
                  <Tag className="mr-1.5 h-3.5 w-3.5" />
                  Etiquetas ({selectedComplete.length})
                </Button>
              )}
            </div>
          )}

          {/* Results info + pagination top */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filtered.length} resultado(s){hasActiveFilters ? " (filtrado)" : ""} — página {currentPage} de {totalPages}
            </p>
          </div>

          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {canCredential && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={paginatedItems.length > 0 && paginatedItems.every((p) => selectedIds.has(p.id))}
                        onCheckedChange={toggleSelectAllPage}
                      />
                    </TableHead>
                  )}
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">CPF</TableHead>
                  <TableHead className="hidden lg:table-cell">Instituição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Situação</TableHead>
                  {canCredential && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((p) => {
                  const person = peopleMap.get(p.person_id);
                  const state = getParticipantState(p);
                  const stateInfo = getStateInfo(state);
                  const activeCred = activeCredMap.get(p.id);

                  return (
                    <TableRow key={p.id} data-state={selectedIds.has(p.id) ? "selected" : undefined}>
                      {canCredential && (
                        <TableCell className="w-10">
                          <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelected(p.id)} />
                        </TableCell>
                      )}
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{person?.full_name ?? "—"}</span>
                          {activeCred && (
                            <span className="block text-[10px] font-mono text-muted-foreground mt-0.5">
                              {activeCred.credential_code}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground font-mono text-xs">
                        {person?.cpf ?? "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        {getInstitutionName(p.delegation_id)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {TYPE_LABELS[p.participant_type] ?? p.participant_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stateInfo.variant} className={`text-[10px] gap-1 ${stateInfo.className}`}>
                          {stateInfo.icon}
                          {stateInfo.label}
                        </Badge>
                      </TableCell>
                      {canCredential && (
                        <TableCell>
                          <div className="flex gap-1.5 justify-end flex-wrap">
                            {state === "awaiting" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" className="h-7 text-xs" disabled={credentialMutation.isPending}>
                                    <UserCheck className="mr-1 h-3 w-3" />
                                    Credenciar
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Credenciar participante</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Confirma que <strong>{person?.full_name}</strong> se apresentou presencialmente?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => credentialMutation.mutate(p.id)}>
                                      Sim, credenciar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {state === "ready_to_emit" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" className="h-7 text-xs" disabled={emitCredentialMutation.isPending}>
                                    {emitCredentialMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CreditCard className="mr-1 h-3 w-3" />}
                                    Emitir Credencial
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Emitir credencial</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Emitir credencial para <strong>{person?.full_name}</strong>? Será gerado um código único e QR Code.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => emitCredentialMutation.mutate(p.id)}>
                                      Emitir agora
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {state === "complete" && (
                              <>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleOpenPreview(p.id)}>
                                  <Eye className="mr-1 h-3 w-3" />
                                  Ver
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLabelParticipantId(p.id)}>
                                  <Tag className="mr-1 h-3 w-3" />
                                  Etiqueta
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={reissueMutation.isPending}>
                                      <RefreshCw className="mr-1 h-3 w-3" />
                                      2ª Via
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Emitir segunda via</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Reemitir credencial de <strong>{person?.full_name}</strong>?
                                        <br /><br />
                                        A credencial atual (<code className="text-xs bg-muted px-1 rounded">{activeCred?.credential_code}</code>) será <strong>invalidada</strong> e uma nova será gerada.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => reissueMutation.mutate(p.id)}>
                                        Confirmar segunda via
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
                    if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "ellipsis" ? (
                      <span key={`e-${idx}`} className="px-1 text-muted-foreground text-xs">…</span>
                    ) : (
                      <Button
                        key={item}
                        variant={currentPage === item ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 p-0 text-xs"
                        onClick={() => setCurrentPage(item as number)}
                      >
                        {item}
                      </Button>
                    )
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Preview dialog */}
      {previewTemplate && (
        <CredentialPreviewDialog
          open={!!previewParticipantId}
          onOpenChange={(open) => {
            if (!open) { setPreviewParticipantId(null); setPreviewTemplate(null); }
          }}
          template={previewTemplate}
          participantId={previewParticipantId ?? undefined}
        />
      )}
      {/* Single label dialog */}
      {labelParticipantId && (
        <SingleLabelDialog
          open={!!labelParticipantId}
          onOpenChange={(open) => { if (!open) setLabelParticipantId(null); }}
          participantId={labelParticipantId}
          eventId={selectedEventId}
        />
      )}
      {/* Batch labels dialog */}
      {batchLabelIds.length > 0 && (
        <BatchLabelsDialog
          open={batchLabelIds.length > 0}
          onOpenChange={(open) => { if (!open) setBatchLabelIds([]); }}
          participantIds={batchLabelIds}
          eventId={selectedEventId}
        />
      )}
    </div>
  );
}
