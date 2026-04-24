import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  AlertCircle,
  ShieldAlert,
  Users,
  ScanLine,
  IdCard,
  Link2,
  Check,
  Edit,
  UserPlus,
  RotateCcw,
} from "lucide-react";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PessoaFormDialog from "@/components/admin/people/PessoaFormDialog";

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
import { SearchableSelect } from "@/components/admin/SearchableSelect";
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
import { useActiveEventId } from "@/contexts/EventContext";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { useStageParticipantFilter } from "@/hooks/useStageParticipantFilter";
import { useProgressiveParticipants } from "@/hooks/useProgressiveParticipants";
import { BackgroundLoadingIndicator } from "@/components/credenciamento/BackgroundLoadingIndicator";
import { StageMiniDash } from "@/components/admin/stage/StageMiniDash";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta",
  coach: "Técnico",
  head_of_delegation: "Chefe Deleg.",
  staff: "Staff",
  commission: "Comissão",
};

const PAGE_SIZE = 25;
const FILTER_CHUNK_SIZE = 150;

const chunkArray = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

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

type ParticipantState = "pending_import" | "awaiting" | "ready_to_emit" | "complete";

interface CredentialParticipantRow {
  id: string;
  status: string;
  participant_type: string;
  credentialed_at: string | null;
  credentialed_by: string | null;
  person_id: string;
  delegation_id: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  coach_name: string | null;
  coach_phone: string | null;
  person: {
    full_name: string | null;
    cpf: string | null;
    photo_url: string | null;
  } | null;
  delegation: {
    institution: {
      id: string;
      name: string | null;
    } | null;
  } | null;
}

export default function CredenciamentoPage() {
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();
  const selectedEventId = useActiveEventId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [filterType, setFilterType] = useState(searchParams.get("type") || "all");
  const [filterState, setFilterState] = useState(searchParams.get("status") || "all");
  const [filterInstitution, setFilterInstitution] = useState(searchParams.get("inst") || "all");
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [previewParticipantId, setPreviewParticipantId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [labelParticipantId, setLabelParticipantId] = useState<string | null>(null);
  const [batchLabelIds, setBatchLabelIds] = useState<string[]>([]);
  const [batchCredentialConfirmOpen, setBatchCredentialConfirmOpen] = useState(false);
  const [batchEmitConfirmOpen, setBatchEmitConfirmOpen] = useState(false);
  const [showGlobalKpis, setShowGlobalKpis] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  
  // States for unified credentialing flow
  const [selectedForCred, setSelectedForCred] = useState<CredentialParticipantRow | null>(null);
  const [isWorkflowActive, setIsWorkflowActive] = useState(false);
  const [guardianConfirmOpen, setGuardianConfirmOpen] = useState(false);
  const [tempGuardianData, setTempGuardianData] = useState({ name: "", phone: "", relationship: "" });
  const [isLinkingExternal, setIsLinkingExternal] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);



  
  const [blockingDialogData, setBlockingDialogData] = useState<{ participantName: string; items: any[] } | null>(null);
  const canCredential = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  // Persist filters to URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (searchTerm) next.set("search", searchTerm); else next.delete("search");
    if (filterType !== "all") next.set("type", filterType); else next.delete("type");
    if (filterState !== "all") next.set("status", filterState); else next.delete("status");
    if (filterInstitution !== "all") next.set("inst", filterInstitution); else next.delete("inst");
    if (currentPage > 1) next.set("page", String(currentPage)); else next.delete("page");
    
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchTerm, filterType, filterState, filterInstitution, currentPage, searchParams, setSearchParams]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterType, filterState, filterInstitution]);
  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); setSearchTerm(""); setFilterType("all"); setFilterState("all"); setFilterInstitution("all"); }, [selectedEventId]);


  // --- Blocked participants ---
  const { data: blockedParticipantIds = new Set<string>() } = useQuery({
    queryKey: ["blocked-participants", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return new Set<string>();
      const { data, error } = await supabase.rpc("list_blocked_participants", { p_event_id: selectedEventId });
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.participant_id));
    },
    enabled: !!selectedEventId,
    staleTime: 30_000,
  });
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
  }, [selectedEventId, templateFetched, eventTemplate, createDefaultTemplateMutation]);

  // --- Stage filter (?stage= na URL ou /admin/etapa/:stageId) ---
  const { stageId, participantIds: stageParticipantIds, isLoading: stageLoading } = useStageParticipantFilter();

  // Debug: ajuda a diagnosticar quando o filtro de etapa retorna vazio
  useEffect(() => {
    if (stageId) {
      // eslint-disable-next-line no-console
      console.log("[CredenciamentoPage] stage scope", {
        stageId,
        eventId: selectedEventId,
        stageLoading,
        participantIdsSize: stageParticipantIds?.size ?? null,
      });
    }
  }, [stageId, selectedEventId, stageLoading, stageParticipantIds]);

  // --- Participants ---
  // Busca todos os participantes do evento (ou da etapa) em chunks de 1000 — sem limite arbitrário.
  const stageIdsArray = useMemo(
    () => (stageParticipantIds ? Array.from(stageParticipantIds) : null),
    [stageParticipantIds],
  );

  // Se stageId existe mas stageIdsArray é null => RLS bloqueou participant_event_stages.
  // Nesse caso, ignoramos o filtro de etapa (melhor mostrar todos do evento que mostrar vazio falso).
  const effectiveStageFilter = stageId && stageIdsArray ? stageIdsArray : null;

  const PARTICIPANT_SELECT = `id, status, participant_type, credentialed_at, credentialed_by, person_id, delegation_id, guardian_name, guardian_phone, coach_name, coach_phone,
    person:people!participants_person_id_fkey(full_name, cpf, photo_url),
    delegation:delegations!participants_delegation_id_fkey(institution:institutions(id, name))`;

  const {
    data: progressiveParts,
    firstPageReady,
    isBackgroundLoading: participantsBgLoading,
    error: participantsError,
  } = useProgressiveParticipants<any>({
    eventId: selectedEventId,
    select: PARTICIPANT_SELECT,
    onlyActive: true,
    statusIn: ["pending", "confirmed", "credentialed"],
    participantIdsScope: effectiveStageFilter,
    orderBy: "id",
    cacheKey: `cred-${stageId ?? "all"}`,
    enabled: !!selectedEventId,
  });

  // Mostra skeleton só até a 1ª página chegar; depois UI já renderiza
  const isLoading = !firstPageReady && !!selectedEventId;
  const allParticipants = progressiveParts;

  const participants = useMemo(() => (allParticipants ?? []) as CredentialParticipantRow[], [allParticipants]);

  // --- Active credentials ---
  // Quando há filtro de etapa, busca somente credenciais cujos participant_id estejam na etapa.
  const { data: activeCredentials = [], error: credentialsError } = useQuery({
    queryKey: ["credenciamento-credentials", selectedEventId, stageId, effectiveStageFilter?.length ?? -1],
    queryFn: async () => {
      if (!selectedEventId) return [];
      if (effectiveStageFilter && effectiveStageFilter.length === 0) return [];

      const CHUNK = FILTER_CHUNK_SIZE;
      const all: any[] = [];
      const idChunks: (string[] | null)[] = effectiveStageFilter
        ? chunkArray(effectiveStageFilter, CHUNK)
        : [null];

      for (const ids of idChunks) {
        let from = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          let q = supabase
            .from("participant_credentials")
            .select("id, participant_id, credential_code, status")
            .eq("event_id", selectedEventId)
            .eq("status", "active");
          if (ids) q = q.in("participant_id", ids);
          const { data, error } = await q
            .order("participant_id", { ascending: true })
            .range(from, from + 999);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < 1000) break;
          from += 1000;
        }
      }
      return all;
    },
    enabled: !!selectedEventId,
  });

  const activeCredMap = useMemo(() => new Map(activeCredentials.map((c) => [c.participant_id, c])), [activeCredentials]);
  const institutionOptions = useMemo(() => {
    const unique = new Map<string, string>();
    participants.forEach((participant) => {
      const institution = participant.delegation?.institution;
      if (institution?.id && institution.name) unique.set(institution.id, institution.name);
    });
    return Array.from(unique, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [participants]);

  const participantTypeOptions = useMemo(() => {
    const types = new Set(participants.map((p) => p.participant_type));
    return [...types].sort();
  }, [participants]);

  const getInstitutionId = useCallback((participant: CredentialParticipantRow) => participant.delegation?.institution?.id ?? "", []);
  const getInstitutionName = useCallback((participant: CredentialParticipantRow) => participant.delegation?.institution?.name ?? "—", []);

  // --- Determine participant state ---
  const getParticipantState = useCallback((p: { status: string; id: string }): ParticipantState => {
    if (p.status === "pending") return "pending_import";
    const isCredentialed = p.status === "credentialed";
    const hasActiveCred = activeCredMap.has(p.id);
    if (!isCredentialed) return "awaiting";
    if (isCredentialed && !hasActiveCred) return "ready_to_emit";
    return "complete";
  }, [activeCredMap]);

  // --- Filter & Sort ---
  const STATE_PRIORITY: Record<string, number> = { ready_to_emit: 0, awaiting: 1, pending_import: 2, complete: 3 };

  const filtered = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return (participants ?? [])
      .filter((p) => {
        // Search filter
        if (normalizedTerm) {
          const fullName = p.person?.full_name?.toLowerCase() ?? "";
          const cpf = p.person?.cpf ?? "";
          if (!fullName.includes(normalizedTerm) && !cpf.includes(normalizedTerm)) return false;
        }
        // Type filter
        if (filterType !== "all" && p.participant_type !== filterType) return false;
        // State filter
        if (filterState === "blocked") {
          if (!blockedParticipantIds.has(p.id)) return false;
        } else if (filterState !== "all") {
          const state = getParticipantState(p);
          if (state !== filterState) return false;
        }
        // Institution filter
        if (filterInstitution !== "all") {
          const instId = getInstitutionId(p);
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
        const nameA = a.person?.full_name ?? "";
        const nameB = b.person?.full_name ?? "";
        return nameA.localeCompare(nameB);
      });
  }, [participants, searchTerm, filterType, filterState, filterInstitution, blockedParticipantIds, getParticipantState, getInstitutionId]);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const loadError = participantsError ?? credentialsError;

  // --- Mutations ---
  // Fluxo unificado: registrar presença + emitir credencial em um único passo
  const credentialMutation = useMutation({
    mutationFn: async ({ participantId, externalCode }: { participantId: string; externalCode?: string }) => {
      const isExternal = !!externalCode;
      const credentialCode = externalCode || generateCredentialCode();
      const qrCodeValue = generateQrCodeValue(selectedEventId, participantId, credentialCode);
      const nowIso = new Date().toISOString();

      if (isExternal) {
        const { data: existing } = await supabase
          .from("participant_credentials")
          .select("id")
          .eq("event_id", selectedEventId)
          .eq("credential_code", externalCode)
          .eq("status", "active")
          .maybeSingle();
        
        if (existing) throw new Error("Este código de credencial já está em uso por outro participante.");
      }

      const { error: credErr } = await supabase.from("participant_credentials").insert({
        participant_id: participantId,
        event_id: selectedEventId,
        credential_code: credentialCode,
        qr_code_value: qrCodeValue,
        status: "active",
        is_active: true,
        binding_source: isExternal ? "external" : "manual",
        issued_at: nowIso,
        activated_at: nowIso,
        issued_by: user?.id,
        activated_by: user?.id,
      });
      if (credErr) throw credErr;

      const { error } = await supabase
        .from("participants")
        .update({
          status: "credentialed",
          credentialed_at: nowIso,
          credentialed_by: user?.id,
        })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credenciamento-participants"] });
      queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
      toast.success("Credenciamento realizado com sucesso!");
      setSelectedForCred(null);
      setIsLinkingExternal(false);
      setManualCode("");
    },
    onError: (err: Error) => {
      if (err.message?.includes("irregularidade") || err.message?.includes("Credenciamento bloqueado")) {
        toast.error("Credenciamento bloqueado: atleta possui irregularidade aberta. Resolva em Irregularidades.");
      } else if (err.message?.includes("uq_participant_event_active")) {
        toast.error("Este participante já possui credencial ativa.");
      } else {
        toast.error(`Erro ao credenciar: ${err.message}`);
      }
    },
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
        is_active: true,
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
      if (err.message?.includes("irregularidade") || err.message?.includes("Credenciamento bloqueado")) {
        toast.error("Credenciamento bloqueado: atleta possui irregularidade aberta. Resolva em Irregularidades.");
      } else if (err.message?.includes("uq_participant_event_active")) {
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
          .update({ status: "reissued", is_active: false, revoked_at: new Date().toISOString() })
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
        is_active: true,
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
    onError: (err: Error) => {
      if (err.message?.includes("irregularidade") || err.message?.includes("Credenciamento bloqueado")) {
        toast.error("Credenciamento bloqueado: atleta possui irregularidade aberta. Resolva em Irregularidades.");
      } else {
        toast.error(`Erro na reemissão: ${err.message}`);
      }
    },
  });

  const undoCredentialMutation = useMutation({
    mutationFn: async (participantId: string) => {
      // 1. Inativar credenciais atuais (status 'revoked' é o padrão aceito pela constraint para cancelamento)
      const { error: credErr } = await supabase
        .from("participant_credentials")
        .update({ status: "revoked", is_active: false })
        .eq("participant_id", participantId)
        .eq("event_id", selectedEventId)
        .eq("status", "active");
      
      if (credErr) throw credErr;

      // 2. Voltar status do participante para 'confirmed'
      const { error: partErr } = await supabase
        .from("participants")
        .update({
          status: "confirmed",
          credentialed_at: null,
          credentialed_by: null,
        })
        .eq("id", participantId);
      
      if (partErr) throw partErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credenciamento-participants"] });
      queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
      toast.success("Credenciamento desfeito com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao desfazer credenciamento: ${err.message}`);
    },
  });

  // --- Blocking check before emit/reissue ---
  const checkBlockingAndAct = async (participantId: string, personName: string, action: "emit" | "reissue") => {
    const { data, error } = await supabase.rpc("get_blocking_irregularities", {
      p_event_id: selectedEventId,
      p_participant_id: participantId,
    });
    if (error) {
      toast.error(`Erro ao verificar irregularidades: ${error.message}`);
      return;
    }
    const result = data as any;
    if (result?.has_blocking) {
      setBlockingDialogData({ participantName: personName, items: result.items ?? [] });
      return;
    }
    if (action === "emit") emitCredentialMutation.mutate(participantId);
    else reissueMutation.mutate(participantId);
  };

  // --- Stats ---
  const pendingCount = (participants ?? []).filter((p) => p.status === "pending").length;
  const confirmedCount = (participants ?? []).filter((p) => p.status === "confirmed").length;
  const credentialedCount = (participants ?? []).filter((p) => p.status === "credentialed").length;
  const credentialsEmittedCount = activeCredentials.length;
  const pendingEmission = confirmedCount - credentialsEmittedCount;

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

  // Batch unificado: presença + emissão em uma única ação
  const handleBatchCredential = async () => {
    if (selectedAwaiting.length === 0) return;
    setBatchProcessing(true);
    let success = 0, errors = 0;
    for (const id of selectedAwaiting) {
      const credentialCode = generateCredentialCode();
      const qrCodeValue = generateQrCodeValue(selectedEventId, id, credentialCode);
      const nowIso = new Date().toISOString();
      const { error: credErr } = await supabase.from("participant_credentials").insert({
        participant_id: id, event_id: selectedEventId, credential_code: credentialCode, qr_code_value: qrCodeValue,
        status: "active", is_active: true, binding_source: "manual",
        issued_at: nowIso, activated_at: nowIso,
        issued_by: user?.id, activated_by: user?.id,
      });
      if (credErr) { errors++; continue; }
      const { error } = await supabase
        .from("participants")
        .update({ status: "credentialed", credentialed_at: nowIso, credentialed_by: user?.id })
        .eq("id", id);
      if (error) errors++; else success++;
    }
    setBatchProcessing(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["credenciamento-participants"] });
    queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
    toast.success(`${success} credencial(is) emitida(s) em lote.${errors > 0 ? ` ${errors} erro(s).` : ""}`);
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
        status: "active", is_active: true, binding_source: "manual",
        issued_at: new Date().toISOString(), activated_at: new Date().toISOString(),
        issued_by: user?.id, activated_by: user?.id,
      });
      if (error) errors++; else success++;
    }
    setBatchProcessing(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["credenciamento-credentials"] });
    toast.success(`${success} credencial(is) emitida(s) em lote.${errors > 0 ? ` ${errors} erro(s).` : ""}`);
  };

  const handleStartCredenciamento = (p: CredentialParticipantRow) => {
    setSelectedForCred(p);
    setTempGuardianData({
      name: p.guardian_name || "",
      phone: p.guardian_phone || "",
      relationship: p.coach_name || "",
    });
    setGuardianConfirmOpen(true);
    setIsLinkingExternal(false);
    setManualCode("");
    setScannerOpen(false);
  };

  const handleConfirmGuardian = async () => {
    if (!selectedForCred) return;
    
    // Opcional: Atualizar dados do responsável no banco se houver mudanças
    if (
      tempGuardianData.name !== (selectedForCred.guardian_name || "") || 
      tempGuardianData.phone !== (selectedForCred.guardian_phone || "") ||
      tempGuardianData.relationship !== (selectedForCred.coach_name || "")
    ) {
      const { error } = await supabase
        .from("participants")
        .update({
          guardian_name: tempGuardianData.name,
          guardian_phone: tempGuardianData.phone,
          coach_name: tempGuardianData.relationship,
          coach_phone: null,
        })
        .eq("id", selectedForCred.id);
      
      if (error) {
        toast.error("Erro ao atualizar dados do responsável: " + error.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["credenciamento-participants"] });
      }
    }

    setGuardianConfirmOpen(false);
    // Após confirmar os dados, o usuário pode seguir com o fluxo de credenciamento
    // que já existe na tela (o modal do responsável é apenas um check prévio)
  };

  const handleLinkExternal = (code: string) => {
    if (!selectedForCred) return;
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    credentialMutation.mutate({ participantId: selectedForCred.id, externalCode: normalized });
  };

  const handleScan = (rawValue: string) => {
    setScannerOpen(false);
    const code = rawValue.trim().toUpperCase();
    if (code) {
      handleLinkExternal(code);
    }
  };

  const getStateInfo = (state: string) => {

    switch (state) {
      case "pending_import":
        return { label: "Pendente", icon: <AlertCircle className="h-3.5 w-3.5" />, variant: "outline" as const, className: "border-orange-300 bg-orange-50 text-orange-700" };
      case "awaiting":
        return { label: "Confirmado", icon: <Clock className="h-3.5 w-3.5" />, variant: "outline" as const, className: "border-yellow-300 bg-yellow-50 text-yellow-700" };
      case "ready_to_emit":
        return { label: "Pronto p/ emissão", icon: <CreditCard className="h-3.5 w-3.5" />, variant: "outline" as const, className: "border-blue-300 bg-blue-50 text-blue-700" };
      case "complete":
        return { label: "Credencial ativa", icon: <ShieldCheck className="h-3.5 w-3.5" />, variant: "outline" as const, className: "border-green-300 bg-green-50 text-green-700" };
      default:
        return { label: "—", icon: null, variant: "outline" as const, className: "" };
    }
  };

  const hasActiveFilters = filterType !== "all" || filterState !== "all" || filterInstitution !== "all" || searchTerm !== "";

  const stats = {
    total: participants.length,
    ready: filtered.filter(p => getParticipantState(p) === "ready_to_emit").length,
    awaiting: filtered.filter(p => getParticipantState(p) === "awaiting").length,
    emitted: credentialsEmittedCount,
    pendingEmission: Math.max(0, confirmedCount - credentialsEmittedCount)
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGlobalKpis(!showGlobalKpis)}
            className="text-[10px] h-7 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Info className="h-3 w-3" />
            {showGlobalKpis ? "Ocultar Visão Geral" : "Ver Visão Geral da Etapa"}
          </Button>
        </div>
      </div>

      {showGlobalKpis && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <StageMiniDash className="bg-muted/30 border-dashed" />
        </div>
      )}

      <StageMiniDash
        hideGlobal
        moduleKpis={[
          {
            label: "Total",
            value: stats.total,
            icon: <Users className="h-3.5 w-3.5" />,
            tone: "default",
          },
          {
            label: "Confirmados",
            value: confirmedCount,
            icon: <Clock className="h-3.5 w-3.5" />,
            tone: "warning",
          },
          {
            label: "Sem credencial",
            value: stats.pendingEmission,
            icon: <AlertCircle className="h-3.5 w-3.5" />,
            tone: stats.pendingEmission > 0 ? "warning" : "default",
          },
          {
            label: "Emitidas",
            value: stats.emitted,
            icon: <ShieldCheck className="h-3.5 w-3.5" />,
            tone: "success",
          },
        ]}
      />
      <div className="animate-fade-in space-y-5">
        <ModuleHeader route="/admin/credenciamento" />

      {/* Flow guide */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
        <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Fluxo:</span>
          <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700 text-[10px] gap-1">
            <AlertCircle className="h-3 w-3" /> Pendente
          </Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700 text-[10px] gap-1">
            <Clock className="h-3 w-3" /> Confirmado
          </Badge>
          <ArrowRight className="h-3 w-3" />
          <span className="text-[10px]">Registrar presença →</span>
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[10px] gap-1">
            <CreditCard className="h-3 w-3" /> Pronto p/ emissão
          </Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700 text-[10px] gap-1">
            <ShieldCheck className="h-3 w-3" /> Credencial ativa
          </Badge>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="border-none shadow-sm bg-muted/20">
        <CardContent className="pt-6 pb-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-background"
                disabled={!selectedEventId}
              />
            </div>
            {canCredential && (
              <Button
                variant="outline"
                className="h-11 gap-2 whitespace-nowrap"
                onClick={() => { setEditingParticipantId(null); setEditDialogOpen(true); }}
                disabled={!selectedEventId}
              >
                <UserPlus className="h-4 w-4" />
                Novo Atleta
              </Button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px] h-11 bg-background">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  {participantTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterState} onValueChange={setFilterState}>
                <SelectTrigger className="w-[160px] h-11 bg-background">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Situações</SelectItem>
                  <SelectItem value="pending_import">Pendente</SelectItem>
                  <SelectItem value="awaiting">Confirmado</SelectItem>
                  <SelectItem value="ready_to_emit">Pronto p/ emissão</SelectItem>
                  <SelectItem value="complete">Credencial ativa</SelectItem>
                  {blockedParticipantIds.size > 0 && (
                    <SelectItem value="blocked">⚠ Irregulares</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <SearchableSelect
                value={filterInstitution}
                onChange={setFilterInstitution}
                options={institutionOptions.map((i) => ({ value: i.id, label: i.name }))}
                placeholder="Instituição"
                searchPlaceholder="Pesquisar..."
                allLabel="Todas Instituições"
                emptyText="Nenhuma encontrada."
                className="w-[200px] h-11 bg-background"
              />
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => { setFilterType("all"); setFilterState("all"); setFilterInstitution("all"); setSearchTerm(""); }}
                  className="h-11 w-11 text-muted-foreground hover:text-foreground"
                  title="Limpar filtros"
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Stats */}
      {/* Stats cards removed as they are now in the top mini-dash for clarity and space optimization */}


      {/* Indicador discreto: dados ainda carregando em segundo plano */}
      <BackgroundLoadingIndicator
        loaded={participants.length}
        isLoading={participantsBgLoading && firstPageReady}
        label="participantes"
      />

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
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-foreground font-medium">Erro ao carregar participantes da etapa</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {loadError.message || "A consulta retornou erro antes de montar a lista. Reduzi os lotes para etapas grandes; recarregue a página."}
          </p>
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
                <AlertDialog open={batchCredentialConfirmOpen} onOpenChange={setBatchCredentialConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={batchProcessing}>
                      {batchProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UserCheck className="mr-1.5 h-3.5 w-3.5" />}
                      Registrar presença ({selectedAwaiting.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar registro de presença em lote</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você está prestes a registrar presença de <strong>{selectedAwaiting.length}</strong> participante(s). O status será alterado para "Pronto p/ emissão". Deseja prosseguir?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={(e) => { e.preventDefault(); setBatchCredentialConfirmOpen(false); handleBatchCredential(); }}>
                        Confirmar ({selectedAwaiting.length})
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {selectedReadyToEmit.length > 0 && (
                <AlertDialog open={batchEmitConfirmOpen} onOpenChange={setBatchEmitConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={batchProcessing}>
                      {batchProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CreditCard className="mr-1.5 h-3.5 w-3.5" />}
                      Emitir ({selectedReadyToEmit.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar emissão em lote</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você está prestes a emitir credenciais para <strong>{selectedReadyToEmit.length}</strong> participante(s). Cada um receberá um código único e QR Code. Esta ação não pode ser desfeita facilmente. Deseja prosseguir?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={(e) => { e.preventDefault(); setBatchEmitConfirmOpen(false); handleBatchEmit(); }}>
                        Emitir ({selectedReadyToEmit.length})
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
              <TableHeader className="bg-muted/50">
                <TableRow>
                  {canCredential && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={paginatedItems.length > 0 && paginatedItems.every((p) => selectedIds.has(p.id))}
                        onCheckedChange={toggleSelectAllPage}
                      />
                    </TableHead>
                  )}
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">Participante</TableHead>
                  <TableHead className="hidden lg:table-cell text-xs uppercase font-bold text-muted-foreground">Instituição</TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-xs uppercase font-bold text-muted-foreground">Situação</TableHead>
                  {canCredential && <TableHead className="text-right text-xs uppercase font-bold text-muted-foreground">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.map((p) => {
                  const person = p.person;
                  const state = getParticipantState(p);
                  const stateInfo = getStateInfo(state);
                  const activeCred = activeCredMap.get(p.id);
                  const isBlocked = blockedParticipantIds.has(p.id);

                  return (
                    <TableRow key={p.id} className="hover:bg-muted/30 transition-colors group" data-state={selectedIds.has(p.id) ? "selected" : undefined}>
                      {canCredential && (
                        <TableCell className="w-10">
                          <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelected(p.id)} />
                        </TableCell>
                      )}
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <Link
                            to={`/admin/participantes/${p.id}`}
                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors"
                          >
                            {person?.full_name ?? "—"}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {person?.cpf || "—"}
                            </span>
                            {activeCred && (
                              <span className="text-[10px] font-mono text-primary font-bold">
                                • {activeCred.credential_code}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-3">
                        <span className="text-xs text-muted-foreground block max-w-[200px] truncate" title={getInstitutionName(p)}>
                          {getInstitutionName(p)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 h-5">
                          {TYPE_LABELS[p.participant_type] ?? p.participant_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant={stateInfo.variant} className={`text-[10px] px-2 h-5 w-fit border-none ${stateInfo.className}`}>
                            <span className="flex items-center gap-1">
                              {stateInfo.icon}
                              {stateInfo.label}
                            </span>
                          </Badge>
                          {isBlocked && (
                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700 text-[9px] h-4 w-fit px-1.5 font-bold animate-pulse">
                              <ShieldAlert className="h-2.5 w-2.5 mr-1" /> IRREGULAR
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {canCredential && (
                        <TableCell className="py-3 text-right">
                          <div className="flex justify-end gap-1.5 flex-wrap items-center">
                            {state === "awaiting" && (
                              <Button
                                size="sm"
                                className="h-8 px-3 text-[11px] font-bold bg-primary hover:bg-primary/90 shadow-sm"
                                onClick={() => handleStartCredenciamento(p)}
                                disabled={credentialMutation.isPending || isBlocked}
                              >
                                <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Credenciar
                              </Button>
                            )}

                            {state === "ready_to_emit" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 text-[11px] font-bold border-blue-600 text-blue-600 hover:bg-blue-50"
                                onClick={() => handleStartCredenciamento(p)}
                                disabled={credentialMutation.isPending || isBlocked}
                              >
                                <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Emitir Credencial
                              </Button>
                            )}

                            {state === "complete" && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleOpenPreview(p.id)}
                                  title="Visualizar Credencial"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  onClick={() => setLabelParticipantId(p.id)}
                                  title="Imprimir Etiqueta"
                                >
                                  <Tag className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                      title="Reemitir (2ª Via)"
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Reemitir credencial?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Isso invalidará a credencial atual e gerará um novo código/QR Code.
                                        Use apenas em caso de perda ou dano físico.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => checkBlockingAndAct(p.id, person?.full_name ?? "", "reissue")}
                                        className="bg-amber-600 text-white hover:bg-amber-700"
                                      >
                                        Confirmar reemissão
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                  </AlertDialog>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/5"
                                        title="Desfazer Credenciamento"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Desfazer credenciamento?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Isso cancelará a credencial ativa e voltará o status do participante para 'Confirmado'.
                                          O QR Code anterior deixará de funcionar.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => undoCredentialMutation.mutate(p.id)}
                                          className="bg-destructive text-white hover:bg-destructive/90"
                                        >
                                          Confirmar e Desfazer
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                            )}
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/5"
                              onClick={() => {
                                setEditingParticipantId(p.id);
                                setEditDialogOpen(true);
                              }}
                              title="Editar Dados"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

            </div>

            <PessoaFormDialog 
              open={editDialogOpen} 
              onOpenChange={setEditDialogOpen} 
              participantId={editingParticipantId} 
            />

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
      {/* Blocking irregularities dialog */}
      <Dialog open={!!blockingDialogData} onOpenChange={(open) => { if (!open) setBlockingDialogData(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Credenciamento bloqueado
            </DialogTitle>
            <DialogDescription>
              <strong>{blockingDialogData?.participantName}</strong> possui irregularidade(s) aberta(s) que impedem o credenciamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {blockingDialogData?.items?.map((item: any, idx: number) => (
              <div key={item.id ?? idx} className="rounded border p-3 text-sm space-y-1">
                <p className="font-medium">{item.message}</p>
                {item.context?.limit != null && (
                  <p className="text-xs text-muted-foreground">
                    Limite: {item.context.limit} — Encontrado: {item.context.count}
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockingDialogData(null)}>Fechar</Button>
            <Button asChild>
              <Link to="/admin/irregularidades">Ir para Irregularidades</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Diálogo unificado de credenciamento */}
      <Dialog 
        open={!!selectedForCred} 
        onOpenChange={(open) => { 
          if (!open && !credentialMutation.isPending) {
            setSelectedForCred(null); 
            setIsLinkingExternal(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Credenciar Participante
            </DialogTitle>
            <DialogDescription>
              {selectedForCred?.person?.full_name} — {TYPE_LABELS[selectedForCred?.participant_type || ""] || selectedForCred?.participant_type}
            </DialogDescription>
          </DialogHeader>

          {!isLinkingExternal ? (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                O participante está presente. Como deseja emitir a credencial?
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                <Button 
                  className="h-20 flex flex-col items-center justify-center gap-1 bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary border-2"
                  variant="outline"
                  onClick={() => credentialMutation.mutate({ participantId: selectedForCred!.id })}
                  disabled={credentialMutation.isPending}
                >
                  <IdCard className="h-6 w-6" />
                  <span className="font-bold">Credencial do Sistema</span>
                  <span className="text-[10px] font-normal">Gera um código e QR Code automático</span>
                </Button>

                <Button 
                  className="h-20 flex flex-col items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 border-2"
                  variant="outline"
                  onClick={() => setIsLinkingExternal(true)}
                  disabled={credentialMutation.isPending}
                >
                  <Link2 className="h-6 w-6" />
                  <span className="font-bold">Vincular Credencial Externa</span>
                  <span className="text-[10px] font-normal">Utiliza tag física, pulseira ou cartão próprio</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setIsLinkingExternal(false)} className="h-7 text-xs px-2 gap-1">
                  <ChevronLeft className="h-3 w-3" /> Voltar
                </Button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Vincular Externa</span>
              </div>

              <div className="space-y-4">
                <Button 
                  variant="outline" 
                  className="w-full h-16 gap-2 border-dashed border-2 hover:border-primary hover:text-primary transition-all"
                  onClick={() => setScannerOpen(true)}
                >
                  <ScanLine className="h-5 w-5" />
                  Ler QR Code / Código de Barras
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">ou digite manualmente</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Código da credencial..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleLinkExternal(manualCode)}
                    className="h-11 font-mono uppercase"
                  />
                  <Button 
                    className="h-11 px-4"
                    onClick={() => handleLinkExternal(manualCode)}
                    disabled={!manualCode.trim() || credentialMutation.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <QrCodeScanner
            onScan={handleScan}
            onClose={() => setScannerOpen(false)}
            isOpen={scannerOpen}
          />

          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => setSelectedForCred(null)}
              disabled={credentialMutation.isPending}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guardian Confirmation Dialog */}
      <Dialog open={guardianConfirmOpen} onOpenChange={setGuardianConfirmOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Confirmação de Responsável
            </DialogTitle>
            <DialogDescription>
              Verifique os dados de contato de emergência para <strong>{selectedForCred?.person?.full_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Responsável</label>
                <div className="grid grid-cols-1 gap-2">
                  <Input 
                    placeholder="Nome do Responsável"
                    value={tempGuardianData.name}
                    onChange={(e) => setTempGuardianData(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input 
                    placeholder="Telefone (WhatsApp)"
                    value={tempGuardianData.phone}
                    onChange={(e) => setTempGuardianData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                  <Input 
                    placeholder="Vínculo (Ex: Pai, Mãe, Tutor)"
                    value={tempGuardianData.relationship}
                    onChange={(e) => setTempGuardianData(prev => ({ ...prev, relationship: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700 flex gap-2 items-start">
              <Info className="h-4 w-4 shrink-0" />
              <p>Estes dados são vitais para casos de emergência médica ou logística durante o evento.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGuardianConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmGuardian}>Confirmar e Prosseguir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PessoaFormDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingParticipantId(null);
            queryClient.invalidateQueries({ queryKey: ["credenciamento-participants"] });
          }
        }}
        participantId={editingParticipantId}
      />
      </div>
    </div>
  );
}
