import { useState, useMemo, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, XCircle, User, Layers, X, Plus, Edit, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useActiveEventId } from "@/contexts/EventContext";
import PessoaFormDialog from "@/components/admin/people/PessoaFormDialog";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { DataPagination } from "@/components/ui/data-pagination";
import ExportButton from "@/components/admin/ExportButton";
import PdfFieldsPicker, { type PdfFieldOption } from "@/components/admin/PdfFieldsPicker";
import type { ExportColumn } from "@/lib/exportData";
import { useEventBranding } from "@/hooks/useEventBranding";
import { exportListPdf, downloadBlob, type PdfListColumn, type PdfListGroup } from "@/lib/listReportPdf";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta",
  coach: "Técnico",
  head_of_delegation: "Chefe Delegação",
  staff: "Staff",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  credentialed: { label: "Credenciado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export default function ParticipantesPage() {
  const navigate = useNavigate();
  const { stageId: urlStageId } = useParams<{ stageId: string }>();
  const selectedEventId = useActiveEventId();
  const { hasRole } = useAuth();
  const canManage = hasRole("admin") || hasRole("secretaria") || hasRole("super_admin");
  const [searchParams, setSearchParams] = useSearchParams();

  // Load state from URL search params
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get("type") || "all");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all");
  const [sortBy, setSortBy] = useState<"name" | "created" | "type" | "status" | "institution">(
    (searchParams.get("sort") as any) || "name"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("dir") as any) || "asc");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 0);
  const [pageSize, setPageSize] = useState(50);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const stageFilterId = urlStageId || searchParams.get("stage");


  const { data: branding } = useEventBranding(selectedEventId);

  // Lista de etapas ativas do evento (para o select e para os badges das linhas)
  const { data: eventStages = [] } = useQuery({
    queryKey: ["participantes-event-stages", selectedEventId],
    enabled: !!selectedEventId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_stages" as never) as any)
        .select("id, name, slug, kind, sort_order, status")
        .eq("event_id", selectedEventId!)
        .eq("status", "active")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; slug: string; kind: string; sort_order: number; status: string }>;
    },
  });

  const stageInfo = stageFilterId ? eventStages.find((s) => s.id === stageFilterId) ?? null : null;

  const setStageFilter = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id === "all") next.delete("stage");
    else next.set("stage", id);
    setSearchParams(next, { replace: true });
  };

  // Este query não é mais estritamente necessário para a listagem principal, pois usaremos joins.
  // Mas mantemos para compatibilidade ou se for usado em outros lugares do componente.
  const { data: stageParticipantIds } = useQuery({
    queryKey: ["participantes-stage-participants", stageFilterId],
    enabled: !!stageFilterId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_event_stages")
        .select("participant_id")
        .eq("event_stage_id", stageFilterId!);
      if (error) throw error;
      return (data ?? []).map(r => r.participant_id);
    },
  });

  const clearStageFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("stage");
    setSearchParams(next, { replace: true });
  };

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Person IDs matching free-text search (executed only when searching)
  const { data: matchingPersonIds } = useQuery({
    queryKey: ["participants-search-people", debouncedSearch],
    enabled: debouncedSearch.trim().length >= 2,
    queryFn: async () => {
      const term = debouncedSearch.trim();
      const isCpf = /^\d+$/.test(term.replace(/\D/g, "")) && term.replace(/\D/g, "").length >= 3;
      const cpfClean = term.replace(/\D/g, "");
      const orParts = [`full_name.ilike.%${term}%`];
      if (isCpf) orParts.push(`cpf.ilike.%${cpfClean}%`);
      const { data, error } = await supabase
        .from("people")
        .select("id")
        .or(orParts.join(","))
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map((p: any) => p.id as string);
    },
  });

  // Persist filters to URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set("search", debouncedSearch); else next.delete("search");
    if (typeFilter !== "all") next.set("type", typeFilter); else next.delete("type");
    if (statusFilter !== "all") next.set("status", statusFilter); else next.delete("status");
    if (sortBy !== "name") next.set("sort", sortBy); else next.delete("sort");
    if (sortDir !== "asc") next.set("dir", sortDir); else next.delete("dir");
    if (page > 0) next.set("page", String(page)); else next.delete("page");
    
    // Only update if something changed
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [debouncedSearch, typeFilter, statusFilter, sortBy, sortDir, page, searchParams, setSearchParams]);

  // Reset page when filters change
  useEffect(() => { 
    setPage(0); 
  }, [debouncedSearch, typeFilter, statusFilter, stageFilterId, selectedEventId]);

  const isSearching = debouncedSearch.trim().length >= 2;

  const noSearchMatches = isSearching && matchingPersonIds && matchingPersonIds.length === 0;

  // Compute the constrained id set when stage and/or search filter
  const constrainedIds = useMemo(() => {
    if (stageFilterId && isSearching) {
      const stageSet = new Set(stageParticipantIds ?? []);
      // Need participant ids that are in stage AND have person in matchingPersonIds
      // We'll handle person filter via .in person_id below; stage requires participant ids
      return Array.from(stageSet);
    }
    if (stageFilterId) return stageParticipantIds ?? null;
    return null;
  }, [stageFilterId, stageParticipantIds, isSearching]);

  const { data: pageData, isLoading, isFetching } = useQuery({
    queryKey: [
      "participants-page",
      selectedEventId,
      page,
      pageSize,
      typeFilter,
      statusFilter,
      isSearching ? (matchingPersonIds ?? []).join(",") : "",
      stageFilterId,
      (constrainedIds ?? []).length,
    ],
    enabled:
      !!selectedEventId &&
      (!stageFilterId || !!stageParticipantIds) &&
      (!isSearching || !!matchingPersonIds),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (noSearchMatches) return { rows: [] as any[], total: 0 };

      const baseFields =
        "id, status, participant_type, person_id, delegation_id, created_at, " +
        "person:people(id, full_name, cpf, gender), " +
        "delegation:delegations(id, school_name, institution_id, institution:institutions(id, name))";

      // Constrói a query base
      let q: any;
      
      if (stageFilterId) {
        // Se houver filtro por etapa, precisamos do join !inner
        q = supabase
          .from("participants")
          .select(`${baseFields}, participant_event_stages!inner(event_stage_id)`, { count: "exact" })
          .eq("participant_event_stages.event_stage_id", stageFilterId);
      } else {
        q = supabase
          .from("participants")
          .select(baseFields, { count: "exact" });
      }

      q = q.eq("event_id", selectedEventId!);

      if (typeFilter !== "all") q = q.eq("participant_type", typeFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (isSearching && matchingPersonIds && matchingPersonIds.length > 0) {
        q = q.in("person_id", matchingPersonIds);
      }

      const { data, error, count } = await q
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });

  const rawRows = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;
  const rows = useMemo(() => {
    const arr = [...rawRows];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      let va = "", vb = "";
      switch (sortBy) {
        case "name":
          va = a.person?.full_name ?? ""; vb = b.person?.full_name ?? ""; break;
        case "type":
          va = a.participant_type ?? ""; vb = b.participant_type ?? ""; break;
        case "status":
          va = a.status ?? ""; vb = b.status ?? ""; break;
        case "institution":
          va = a.delegation?.institution?.name ?? a.delegation?.school_name ?? "";
          vb = b.delegation?.institution?.name ?? b.delegation?.school_name ?? ""; break;
        case "created":
          va = a.created_at ?? ""; vb = b.created_at ?? ""; break;
      }
      return va.localeCompare(vb, "pt-BR", { numeric: true }) * dir;
    });
    return arr;
  }, [rawRows, sortBy, sortDir]);

  // Enrollments only for the visible page
  const partIds = rows.map((p: any) => p.id);
  const { data: enrollments = [] } = useQuery({
    queryKey: ["participants-enrollments-page", partIds.join(",")],
    enabled: partIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("participant_id, sport_event_id, sport_event:sport_events(id, name, sport_id, sport:sports(id, name))")
        .in("participant_id", partIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Etapas vinculadas a cada participante visível (badge "fase" na linha)
  const { data: rowStageLinks = [] } = useQuery({
    queryKey: ["participants-stage-links-page", partIds.join(",")],
    enabled: partIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participant_id, event_stage_id")
        .in("participant_id", partIds);
      if (error) throw error;
      return (data ?? []) as Array<{ participant_id: string; event_stage_id: string }>;
    },
  });
  const stageMap = useMemo(() => new Map(eventStages.map((s) => [s.id, s])), [eventStages]);
  const linksByParticipant = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of rowStageLinks) {
      const arr = m.get(l.participant_id) ?? [];
      arr.push(l.event_stage_id);
      m.set(l.participant_id, arr);
    }
    return m;
  }, [rowStageLinks]);

  const STAGE_KIND_LABEL: Record<string, string> = {
    classificatoria: "Classif.",
    regional: "Regional",
    semifinal: "Semi",
    final: "Final",
    geral: "Geral",
    legado: "Legado",
    outro: "Outro",
  };
  const stageShortLabel = (s: { name: string; kind: string }) =>
    STAGE_KIND_LABEL[s.kind] ?? s.name.slice(0, 14);
  const renderStageBadges = (participantId: string) => {
    const ids = linksByParticipant.get(participantId);
    if (!ids || ids.length === 0) return null;
    const stages = ids.map((id) => stageMap.get(id)).filter(Boolean) as Array<{ id: string; name: string; kind: string }>;
    if (stages.length === 0) return null;
    const visible = stages.slice(0, 2);
    const extra = stages.length - visible.length;
    return (
      <div className="flex flex-wrap gap-1">
        {visible.map((s) => (
          <Badge
            key={s.id}
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-primary/40 text-primary bg-primary/5"
            title={s.name}
          >
            <Layers className="h-2.5 w-2.5 mr-1" />{stageShortLabel(s)}
          </Badge>
        ))}
        {extra > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0" title={stages.slice(2).map((s) => s.name).join(", ")}>
            +{extra}
          </Badge>
        )}
      </div>
    );
  };

  // Counters (total no evento OU escopado pela etapa selecionada)
  const { data: counters } = useQuery({
    queryKey: ["participants-counters", selectedEventId, stageFilterId, (stageParticipantIds ?? []).length],
    enabled: !!selectedEventId && (!stageFilterId || !!stageParticipantIds),
    queryFn: async () => {
      if (stageFilterId) {
        const { count: total, error: e1 } = await supabase
          .from("participants")
          .select("id, participant_event_stages!inner(event_stage_id)", { count: "exact", head: true })
          .eq("event_id", selectedEventId!)
          .eq("participant_event_stages.event_stage_id", stageFilterId);
        
        const { count: athletes, error: e2 } = await supabase
          .from("participants")
          .select("id, participant_event_stages!inner(event_stage_id)", { count: "exact", head: true })
          .eq("event_id", selectedEventId!)
          .eq("participant_type", "athlete")
          .eq("participant_event_stages.event_stage_id", stageFilterId);

        if (e1 || e2) throw (e1 || e2);
        
        return { 
          total: total ?? 0, 
          athletes: athletes ?? 0, 
          staff: (total ?? 0) - (athletes ?? 0) 
        };
      }
      const [totalRes, athleteRes] = await Promise.all([
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", selectedEventId!),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", selectedEventId!).eq("participant_type", "athlete"),
      ]);
      return {
        total: totalRes.count ?? 0,
        athletes: athleteRes.count ?? 0,
        staff: (totalRes.count ?? 0) - (athleteRes.count ?? 0),
      };
    },
  });

  const getEnrollmentSummary = (participantId: string) => {
    const list = enrollments.filter((e: any) => e.participant_id === participantId);
    if (list.length === 0) return "—";
    return list.map((e: any) => {
      const se = e.sport_event;
      return `${se?.sport?.name ?? "?"} / ${se?.name ?? "?"}`;
    }).join("; ");
  };

  // ── Exportação ──
  const exportColumns: ExportColumn<any>[] = [
    { header: "Nome", accessor: (p) => p.person?.full_name ?? "" },
    { header: "CPF", accessor: (p) => p.person?.cpf ?? "" },
    { header: "Gênero", accessor: (p) => p.person?.gender ?? "" },
    { header: "Tipo", accessor: (p) => TYPE_LABELS[p.participant_type] ?? p.participant_type ?? "" },
    { header: "Status", accessor: (p) => STATUS_LABELS[p.status]?.label ?? p.status ?? "" },
    { header: "Instituição", accessor: (p) => p.delegation?.institution?.name ?? p.delegation?.school_name ?? "" },
    { header: "Escola (delegação)", accessor: (p) => p.delegation?.school_name ?? "" },
    { header: "Inscrições (modalidade/prova)", accessor: (p) => getEnrollmentSummary(p.id) === "—" ? "" : getEnrollmentSummary(p.id) },
    {
      header: "Etapas",
      accessor: (p) => {
        const ids = linksByParticipant.get(p.id) ?? [];
        return ids.map((id) => stageMap.get(id)?.name).filter(Boolean).join("; ");
      },
    },
    { header: "Cadastrado em", accessor: (p) => p.created_at ? new Date(p.created_at).toLocaleString("pt-BR") : "" },
  ];

  const baseSelectExport =
    "id, status, participant_type, person_id, delegation_id, created_at, " +
    "person:people(id, full_name, cpf, gender), " +
    "delegation:delegations(id, school_name, institution_id, institution:institutions(id, name))";

  const fetchAllParticipants = async () => {
    if (!selectedEventId) return [];
    const PAGE = 1000;
    let from = 0;
    const acc: any[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from("participants")
        .select(baseSelectExport)
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      acc.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    return acc;
  };

  const fetchAllFilteredParticipants = async () => {
    if (!selectedEventId) return [];

    // Caso especial: filtro por etapa usa lista de IDs em chunks
    if (stageFilterId) {
      const ids = stageParticipantIds ?? [];
      if (ids.length === 0) return [];
      const CHUNK = 300;
      const all: any[] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        let q = supabase
          .from("participants")
          .select(baseSelectExport)
          .eq("event_id", selectedEventId)
          .in("id", chunk);
        if (typeFilter !== "all") q = q.eq("participant_type", typeFilter);
        if (statusFilter !== "all") q = q.eq("status", statusFilter);
        if (isSearching && matchingPersonIds && matchingPersonIds.length > 0) {
          q = q.in("person_id", matchingPersonIds);
        }
        const { data, error } = await q;
        if (error) throw error;
        all.push(...((data as any[]) ?? []));
      }
      return all;
    }

    const PAGE = 1000;
    let from = 0;
    const acc: any[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let q = supabase
        .from("participants")
        .select(baseSelectExport)
        .eq("event_id", selectedEventId);
      if (typeFilter !== "all") q = q.eq("participant_type", typeFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (isSearching && matchingPersonIds && matchingPersonIds.length > 0) {
        q = q.in("person_id", matchingPersonIds);
      }
      const { data, error } = await q
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rowsPage = (data ?? []) as any[];
      acc.push(...rowsPage);
      if (rowsPage.length < PAGE) break;
      from += PAGE;
    }
    return acc;
  };

  // ── PDF: catálogo de campos disponíveis (usuário escolhe até 8) ──
  const PDF_FIELD_CATALOG: Array<PdfFieldOption & {
    weight: number;
    accessor: (p: any) => string;
  }> = [
    { key: "name", label: "Nome", weight: 26, accessor: (p) => p.person?.full_name ?? "" },
    { key: "cpf", label: "CPF", weight: 12, accessor: (p) => p.person?.cpf ?? "" },
    { key: "gender", label: "Gênero", weight: 8, accessor: (p) => p.person?.gender ?? "" },
    { key: "type", label: "Tipo", weight: 10, accessor: (p) => TYPE_LABELS[p.participant_type] ?? p.participant_type ?? "" },
    { key: "status", label: "Status", weight: 10, accessor: (p) => STATUS_LABELS[p.status]?.label ?? p.status ?? "" },
    { key: "institution", label: "Instituição", weight: 22, accessor: (p) => p.delegation?.institution?.name ?? p.delegation?.school_name ?? "" },
    { key: "school", label: "Escola (delegação)", weight: 20, accessor: (p) => p.delegation?.school_name ?? "" },
    { key: "enrollments", label: "Modalidade/Prova", weight: 22, accessor: (p) => {
      const list = enrollments.filter((e: any) => e.participant_id === p.id);
      if (list.length === 0) return "";
      return list.map((e: any) => `${e.sport_event?.sport?.name ?? "?"}/${e.sport_event?.name ?? "?"}`).join(", ");
    } },
    { key: "stages", label: "Etapas", weight: 18, accessor: (p) => {
      const ids = linksByParticipant.get(p.id) ?? [];
      return ids.map((id) => stageMap.get(id)?.name).filter(Boolean).join(", ");
    } },
    { key: "created_at", label: "Cadastrado em", weight: 14, accessor: (p) => p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "" },
  ];

  const PDF_DEFAULT_FIELDS = ["name", "cpf", "type", "status", "institution", "stages"];
  const [pdfFields, setPdfFields] = useState<string[]>(PDF_DEFAULT_FIELDS);

  const pdfFieldOptions: PdfFieldOption[] = PDF_FIELD_CATALOG.map(({ key, label }) => ({ key, label }));

  const pdfColumns: PdfListColumn<any>[] = useMemo(() => {
    const selected = PDF_FIELD_CATALOG.filter((f) => pdfFields.includes(f.key));
    const ordered = pdfFields
      .map((k) => selected.find((s) => s.key === k))
      .filter(Boolean) as typeof selected;
    const totalWeight = ordered.reduce((acc, f) => acc + f.weight, 0) || 1;
    return ordered.map((f) => ({
      header: f.label,
      width: `${((f.weight / totalWeight) * 100).toFixed(2)}%`,
      accessor: f.accessor,
    }));
  }, [pdfFields, enrollments, linksByParticipant, stageMap]);

  const handleParticipantesPdf = async (scope: "filtered" | "all", rowsAll: any[]) => {
    const filters: Array<{ label: string; value: string }> = [];
    if (scope === "filtered") {
      if (debouncedSearch.trim().length >= 2) filters.push({ label: "Busca", value: debouncedSearch.trim() });
      if (typeFilter !== "all") filters.push({ label: "Tipo", value: TYPE_LABELS[typeFilter] ?? typeFilter });
      if (statusFilter !== "all") filters.push({ label: "Status", value: STATUS_LABELS[statusFilter]?.label ?? statusFilter });
      if (stageFilterId) {
        const s = eventStages.find((x) => x.id === stageFilterId);
        if (s) filters.push({ label: "Etapa", value: s.name });
      }
      filters.push({ label: "Ordenação", value: `${sortBy} ${sortDir.toUpperCase()}` });
    }
    const groups: PdfListGroup<any>[] = [{ label: "", rows: rowsAll }];
    const blob = await exportListPdf(pdfColumns, groups, {
      title: "Relatório de Participantes",
      subtitle: scope === "filtered" ? "Listagem filtrada" : "Listagem geral",
      branding,
      eventName: events.find((e) => e.id === selectedEventId)?.name,
      generatedAt: new Date(),
      filters,
      orientation: "landscape",
    });
    downloadBlob(blob, `participantes_${scope === "all" ? "geral" : "filtrado"}_${Date.now()}.pdf`);
  };

  return (
    <div className="animate-fade-in space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground">Participantes</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Cadastre e gerencie todas as pessoas do evento — atletas, técnicos, staff, terceiros.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <PdfFieldsPicker
            options={pdfFieldOptions}
            value={pdfFields}
            onChange={setPdfFields}
            defaults={PDF_DEFAULT_FIELDS}
            max={8}
          />
          <ExportButton
            filteredRows={rows as any[]}
            fetchFilteredRows={fetchAllFilteredParticipants}
            fetchAllRows={fetchAllParticipants}
            columns={exportColumns}
            onPdf={handleParticipantesPdf}
            filenamePrefix="participantes"
            sheetName="Participantes"
            disabled={!selectedEventId}
          />
          {canManage && selectedEventId && (
            <Button onClick={() => { setEditingId(null); setFormOpen(true); }} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" />Cadastrar pessoa
            </Button>
          )}
        </div>
      </div>

      {stageFilterId && stageInfo && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 sm:px-4 py-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <span className="text-muted-foreground">Filtrando por etapa:</span>
            <strong className="text-foreground">{stageInfo.name}</strong>
            {stageParticipantIds && (
              <Badge variant="outline" className="ml-1 text-xs">
                {stageParticipantIds.length} vinculados
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/admin/etapas/${stageFilterId}`}>Ver etapa</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={clearStageFilter} title="Limpar filtro">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-5 sm:pt-6 px-4 sm:px-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={() => {}}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Buscar (nome ou CPF)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Mín. 2 caracteres..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={!selectedEventId}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tipo</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>

            {!urlStageId && (
              <>
                <span className="text-xs text-muted-foreground sm:ml-2 inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" /> Etapa:
                </span>
                <Select
                  value={stageFilterId ?? "all"}
                  onValueChange={setStageFilter}
                  disabled={!selectedEventId || eventStages.length === 0}
                >
                  <SelectTrigger className="h-8 w-full sm:w-[280px]">
                    <SelectValue placeholder="Todas as etapas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as etapas</SelectItem>
                    {eventStages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            <span className="text-xs text-muted-foreground sm:ml-2 inline-flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar:
            </span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-8 w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nome</SelectItem>
                <SelectItem value="institution">Instituição</SelectItem>
                <SelectItem value="type">Tipo</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="created">Cadastro</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              title={sortDir === "asc" ? "Crescente (A→Z)" : "Decrescente (Z→A)"}
            >
              {sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
              <span className="ml-1 text-xs">{sortDir === "asc" ? "Asc" : "Desc"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedEventId && counters && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Card><CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4 px-3 sm:px-5">
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
              {stageFilterId ? "Total na etapa" : "Total no evento"}
            </p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{counters.total}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4 px-3 sm:px-5">
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Atletas</p>
            <p className="text-xl sm:text-2xl font-bold text-primary">{counters.athletes}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4 px-3 sm:px-5">
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Comissão/Staff</p>
            <p className="text-xl sm:text-2xl font-bold text-muted-foreground">{counters.staff}</p>
          </CardContent></Card>
        </div>
      )}

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <XCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum participante encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchTerm ? "Tente outro termo de busca." : "Importe ou cadastre participantes."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground sm:hidden">
            {total} participante{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
          </p>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-2 sm:hidden">
            {rows.map((p: any) => {
              const person = p.person;
              const statusInfo = STATUS_LABELS[p.status] ?? { label: p.status, variant: "outline" as const };
              const institutionName = p.delegation?.institution?.name ?? p.delegation?.school_name ?? "—";
              return (
                <Card
                  key={p.id}
                  onClick={() => navigate(`/admin/participantes/${p.id}`)}
                  className={`cursor-pointer active:scale-[0.99] transition-transform ${isFetching ? "opacity-70" : ""}`}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate">{person?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{person?.cpf ?? "—"}</p>
                      </div>
                      <Badge variant={statusInfo.variant} className="text-[10px] shrink-0">{statusInfo.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{institutionName}</p>
                    {renderStageBadges(p.id)}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[p.participant_type] ?? p.participant_type}</Badge>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={(e) => { e.stopPropagation(); setEditingId(p.id); setFormOpen(true); }}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />Editar
                        </Button>
                      )}
                    </div>
                    {getEnrollmentSummary(p.id) !== "—" && (
                      <p className="text-[11px] text-muted-foreground border-t pt-2 line-clamp-2">
                        {getEnrollmentSummary(p.id)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modalidade / Prova</TableHead>
                  <TableHead>Etapa(s)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p: any) => {
                  const person = p.person;
                  const statusInfo = STATUS_LABELS[p.status] ?? { label: p.status, variant: "outline" as const };
                  const institutionName = p.delegation?.institution?.name ?? p.delegation?.school_name ?? "—";
                  return (
                    <TableRow key={p.id} className={isFetching ? "opacity-70" : ""}>
                      <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{person?.cpf ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{institutionName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{TYPE_LABELS[p.participant_type] ?? p.participant_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                        {getEnrollmentSummary(p.id)}
                      </TableCell>
                      <TableCell>{renderStageBadges(p.id) ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/participantes/${p.id}`)} title="Ver participante">
                          <User className="h-4 w-4 mr-1" />Ver
                        </Button>
                        {canManage && (
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(p.id); setFormOpen(true); }} title="Editar">
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <DataPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          />
        </div>
      )}

      <PessoaFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditingId(null); }}
        participantId={editingId}
      />
    </div>
  );
}
