import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
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
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
import { useActiveEventId } from "@/contexts/EventContext";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { useStageParticipantFilter } from "@/hooks/useStageParticipantFilter";

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

export default function CredenciamentoPage() {
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuth();
  const selectedEventId = useActiveEventId();
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
  
  const [blockingDialogData, setBlockingDialogData] = useState<{ participantName: string; items: any[] } | null>(null);
  const canCredential = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

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
  }, [selectedEventId, templateFetched, eventTemplate]);

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

  const { data: allParticipants, isLoading, error: participantsError } = useQuery({
    queryKey: ["credenciamento-participants", selectedEventId, stageId, effectiveStageFilter?.length ?? -1],
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
            .from("participants")
            .select("id, status, participant_type, credentialed_at, credentialed_by, person_id, delegation_id")
            .eq("event_id", selectedEventId)
            .eq("is_active", true)
            .in("status", ["pending", "confirmed", "credentialed"]);
          if (ids) q = q.in("id", ids);
          const { data, error } = await q
            .order("id", { ascending: true })
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

  const participants = allParticipants;

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

  const activeCredMap = new Map(activeCredentials.map((c) => [c.participant_id, c]));

  // --- People ---
  const personIds = [...new Set(participants?.map((p) => p.person_id).filter(Boolean) ?? [])];
  const { data: people = [], error: peopleError } = useQuery({
    queryKey: ["credenciamento-people", personIds],
    queryFn: async () => {
      if (personIds.length === 0) return [];
      const all: any[] = [];
      for (const chunk of chunkArray(personIds, FILTER_CHUNK_SIZE)) {
        const { data, error } = await supabase
          .from("people")
          .select("id, full_name, birth_date, gender, cpf")
          .in("id", chunk);
        if (error) throw error;
        all.push(...(data ?? []));
      }
      return all;
    },
    enabled: personIds.length > 0,
  });

  // --- Delegations & Institutions ---
  const delegationIds = [...new Set((participants?.map((p) => p.delegation_id) ?? []).filter(Boolean))];
  const { data: delegations = [], error: delegationsError } = useQuery({
    queryKey: ["credenciamento-delegations", delegationIds],
    queryFn: async () => {
      if (delegationIds.length === 0) return [];
      const all: any[] = [];
      for (const chunk of chunkArray(delegationIds, FILTER_CHUNK_SIZE)) {
        const { data, error } = await supabase.from("delegations").select("id, institution_id").in("id", chunk);
        if (error) throw error;
        all.push(...(data ?? []));
      }
      return all;
    },
    enabled: delegationIds.length > 0,
  });

  const instIds = [...new Set(delegations.map((d) => d.institution_id).filter(Boolean))];
  const { data: institutions = [], error: institutionsError } = useQuery({
    queryKey: ["credenciamento-institutions", instIds],
    queryFn: async () => {
      if (instIds.length === 0) return [];
      const all: any[] = [];
      for (const chunk of chunkArray(instIds, FILTER_CHUNK_SIZE)) {
        const { data, error } = await supabase.from("institutions").select("id, name").in("id", chunk);
        if (error) throw error;
        all.push(...(data ?? []));
      }
      return all;
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
    if (p.status === "pending") return "pending_import";
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
  const STATE_PRIORITY: Record<string, number> = { ready_to_emit: 0, awaiting: 1, pending_import: 2, complete: 3 };

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
        if (filterState === "blocked") {
          if (!blockedParticipantIds.has(p.id)) return false;
        } else if (filterState !== "all") {
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
  }, [participants, searchTerm, filterType, filterState, filterInstitution, peopleMap, activeCredMap, blockedParticipantIds]);

  // --- Pagination ---
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const loadError = participantsError ?? credentialsError ?? peopleError ?? delegationsError ?? institutionsError;

  // --- Mutations ---
  // Fluxo unificado: registrar presença + emitir credencial em um único passo
  const credentialMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const credentialCode = generateCredentialCode();
      const qrCodeValue = generateQrCodeValue(selectedEventId, participantId, credentialCode);
      const nowIso = new Date().toISOString();
      const { error: credErr } = await supabase.from("participant_credentials").insert({
        participant_id: participantId,
        event_id: selectedEventId,
        credential_code: credentialCode,
        qr_code_value: qrCodeValue,
        status: "active",
        is_active: true,
        binding_source: "manual",
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
      toast.success("Presença registrada e credencial emitida!");
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

  return (
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

      {/* Event selection */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Evento</label>
              <Select value={selectedEventId} onValueChange={() => {}}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4 pt-4 border-t border-border">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full min-w-0 text-sm">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {participantTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterState} onValueChange={setFilterState}>
                <SelectTrigger className="w-full min-w-0 text-sm">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  <SelectItem value="pending_import">Pendente</SelectItem>
                  <SelectItem value="awaiting">Confirmado</SelectItem>
                  <SelectItem value="ready_to_emit">Pronto p/ emissão</SelectItem>
                  <SelectItem value="complete">Credencial ativa</SelectItem>
                  {blockedParticipantIds.size > 0 && (
                    <SelectItem value="blocked">⚠ Irregulares ({blockedParticipantIds.size})</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Select value={filterInstitution} onValueChange={setFilterInstitution}>
                <SelectTrigger className="w-full min-w-0 text-sm">
                  <SelectValue placeholder="Instituição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as instituições</SelectItem>
                  {institutionOptions.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filterType !== "all" || filterState !== "all" || filterInstitution !== "all") && (
                <button
                  onClick={() => { setFilterType("all"); setFilterState("all"); setFilterInstitution("all"); }}
                  className="h-11 px-3 text-sm text-muted-foreground hover:text-foreground border rounded-md hover:bg-muted transition-colors"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {selectedEventId && participants && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-foreground">{participants.length}</p>
            </CardContent>
          </Card>
          {pendingCount > 0 && (
            <Card className="border-orange-200">
              <CardContent className="pt-3 pb-3 px-4">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Pendentes</p>
                <p className="text-xl font-bold text-orange-600">{pendingCount}</p>
              </CardContent>
            </Card>
          )}
          <Card className="border-yellow-200">
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Confirmados</p>
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
                          <Link
                            to={`/admin/participantes/${p.id}`}
                            className="font-medium text-sm text-primary hover:underline"
                          >
                            {person?.full_name ?? "—"}
                          </Link>
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
                        <div className="flex items-center gap-1.5">
                          <Badge variant={stateInfo.variant} className={`text-[10px] gap-1 ${stateInfo.className}`}>
                            {stateInfo.icon}
                            {stateInfo.label}
                          </Badge>
                          {blockedParticipantIds.has(p.id) && (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              IRREGULAR
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {canCredential && (
                        <TableCell>
                          <div className="flex gap-1.5 justify-end flex-wrap">
                            {state === "pending_import" && (
                              <span className="text-[10px] text-orange-600 italic">Aguardando confirmação</span>
                            )}

                            {state === "awaiting" && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" className="h-7 text-xs" disabled={credentialMutation.isPending}>
                                    <UserCheck className="mr-1 h-3 w-3" />
                                    Registrar presença
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Registrar presença</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Confirma que <strong>{person?.full_name}</strong> se apresentou presencialmente? Após confirmar, será possível emitir a credencial.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => credentialMutation.mutate(p.id)}>
                                      Confirmar presença
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {state === "ready_to_emit" && (
                              blockedParticipantIds.has(p.id) ? (
                                <Button size="sm" className="h-7 text-xs" variant="destructive" onClick={() => checkBlockingAndAct(p.id, person?.full_name ?? "", "emit")}>
                                  <ShieldAlert className="mr-1 h-3 w-3" />
                                  Bloqueado
                                </Button>
                              ) : (
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
                                      <AlertDialogAction onClick={() => checkBlockingAndAct(p.id, person?.full_name ?? "", "emit")}>
                                        Emitir agora
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )
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
                                      <AlertDialogAction onClick={() => checkBlockingAndAct(p.id, person?.full_name ?? "", "reissue")}>
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
    </div>
  );
}
