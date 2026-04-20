import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Pencil, Users, Eye, Search, Layers, ArrowUp, ArrowDown, ArrowUpDown, FolderOpen } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useStageParticipantFilter } from "@/hooks/useStageParticipantFilter";
import { useDebounce } from "@/hooks/useDebounce";
import { useActiveEventId } from "@/contexts/EventContext";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import DelegationFormDialog, { type DelegationFormValues } from "@/components/admin/DelegationFormDialog";
import { DataPagination } from "@/components/ui/data-pagination";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmada", variant: "default" },
  rejected: { label: "Rejeitada", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

export default function DelegacoesPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDelegation, setEditingDelegation] = useState<Tables<"delegations"> | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"school_name" | "school_city" | "school_network_type" | "status" | "created_at">("school_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [groupBy, setGroupBy] = useState<"none" | "school_city" | "status" | "school_network_type" | "stage">("none");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Etapas ativas do evento (para o select e badges das linhas)
  const { data: eventStages = [] } = useQuery({
    queryKey: ["delegacoes-event-stages", selectedEventId],
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

  const { stageId } = useStageParticipantFilter();

  const setStageFilter = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id === "all") next.delete("stage");
    else next.set("stage", id);
    setSearchParams(next, { replace: true });
  };

  const { data: stageDelegationIds } = useQuery({
    queryKey: ["stage_delegation_ids", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participants!inner(delegation_id)")
        .eq("event_stage_id", stageId);
      if (error) throw error;
      return Array.from(new Set<string>((data ?? []).map((r: any) => r.participants?.delegation_id).filter(Boolean)));
    },
  });

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [debouncedSearch, statusFilter, stageId, networkFilter, cityFilter, sortBy, sortDir]);

  const { data: pageData, isLoading, isFetching } = useQuery({
    queryKey: [
      "delegations-page",
      selectedEventId,
      page,
      pageSize,
      debouncedSearch,
      statusFilter,
      networkFilter,
      cityFilter,
      sortBy,
      sortDir,
      stageId,
      (stageDelegationIds ?? []).length,
    ],
    enabled: !stageId || !!stageDelegationIds,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase
        .from("delegations")
        .select("*", { count: "exact" });

      if (selectedEventId) q = q.eq("event_id", selectedEventId);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (networkFilter !== "all") q = q.eq("school_network_type", networkFilter);
      if (cityFilter !== "all") q = q.eq("school_city", cityFilter);

      if (debouncedSearch.trim().length >= 2) {
        const term = debouncedSearch.trim().replace(/[%,]/g, "");
        q = q.or(
          [
            `school_name.ilike.%${term}%`,
            `school_official_name.ilike.%${term}%`,
            `school_city.ilike.%${term}%`,
            `chief_name.ilike.%${term}%`,
          ].join(",")
        );
      }

      if (stageId) {
        const ids = stageDelegationIds ?? [];
        if (ids.length === 0) return { rows: [], total: 0 };
        q = q.in("id", ids);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await q
        .order(sortBy, { ascending: sortDir === "asc", nullsFirst: false })
        .range(from, to);
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });

  const delegations = pageData?.rows ?? [];
  const total = pageData?.total ?? 0;

  // Distinct cities for the city filter (no escopo do evento)
  const { data: cityOptions = [] } = useQuery({
    queryKey: ["delegacoes-cities", selectedEventId],
    enabled: !!selectedEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("school_city")
        .eq("event_id", selectedEventId!)
        .not("school_city", "is", null)
        .order("school_city", { ascending: true })
        .limit(2000);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => { if (r.school_city) set.add(r.school_city); });
      return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
  });

  // Etapas por delegação (badges nas linhas)
  const delegIds = delegations.map((d: any) => d.id);
  const { data: rowStageLinks = [] } = useQuery({
    queryKey: ["delegations-stage-links-page", delegIds.join(",")],
    enabled: delegIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("participant_event_stages" as never) as any)
        .select("event_stage_id, participants!inner(delegation_id)")
        .in("participants.delegation_id", delegIds);
      if (error) throw error;
      return (data ?? []) as Array<{ event_stage_id: string; participants: { delegation_id: string } }>;
    },
  });
  const stageMap = useMemo(() => new Map(eventStages.map((s) => [s.id, s])), [eventStages]);
  const stagesByDelegation = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of rowStageLinks) {
      const did = l.participants?.delegation_id;
      if (!did) continue;
      const set = m.get(did) ?? new Set<string>();
      set.add(l.event_stage_id);
      m.set(did, set);
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
  const renderStageBadges = (delegationId: string) => {
    const ids = stagesByDelegation.get(delegationId);
    if (!ids || ids.size === 0) return null;
    const stages = Array.from(ids).map((id) => stageMap.get(id)).filter(Boolean) as Array<{ id: string; name: string; kind: string }>;
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
            <Layers className="h-2.5 w-2.5 mr-1" />{STAGE_KIND_LABEL[s.kind] ?? s.name.slice(0, 14)}
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

  const NETWORK_LABEL: Record<string, string> = {
    estadual: "Estadual",
    municipal: "Municipal",
    federal: "Federal",
    privada: "Privada",
    particular: "Particular",
  };

  // Agrupa as delegações conforme groupBy (após a query/ordenação)
  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "__all__", label: "", rows: delegations }];
    const map = new Map<string, { key: string; label: string; rows: any[] }>();
    for (const d of delegations as any[]) {
      let keys: { key: string; label: string }[] = [];
      if (groupBy === "school_city") {
        const city = d.school_city || "Sem município";
        keys = [{ key: city, label: city }];
      } else if (groupBy === "status") {
        const k = d.status || "—";
        keys = [{ key: k, label: STATUS_MAP[k]?.label ?? k }];
      } else if (groupBy === "school_network_type") {
        const k = d.school_network_type || "—";
        keys = [{ key: k, label: NETWORK_LABEL[k] ?? k }];
      } else if (groupBy === "stage") {
        const ids = stagesByDelegation.get(d.id);
        if (!ids || ids.size === 0) {
          keys = [{ key: "__no_stage__", label: "Sem etapa" }];
        } else {
          keys = Array.from(ids).map((id) => {
            const s = stageMap.get(id);
            return { key: id, label: s?.name ?? id };
          });
        }
      }
      for (const { key, label } of keys) {
        const g = map.get(key) ?? { key, label, rows: [] };
        g.rows.push(d);
        map.set(key, g);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [delegations, groupBy, stagesByDelegation, stageMap]);

  const toPayload = (values: DelegationFormValues) => ({
    event_id: values.event_id,
    status: values.status,
    school_name: values.school_name,
    school_official_name: values.school_official_name || null,
    school_slug: values.school_slug,
    school_network_type: values.school_network_type,
    school_city: values.school_city || null,
    school_state: values.school_state || null,
    school_district: values.school_district || null,
    school_contact_name: values.school_contact_name || null,
    school_contact_phone: values.school_contact_phone || null,
    school_contact_email: values.school_contact_email || null,
    school_is_active: values.school_is_active,
    chief_name: values.chief_name || null,
    chief_phone: values.chief_phone || null,
    chief_email: values.chief_email || null,
    notes: values.notes || null,
  });

  const handleError = (err: Error, action: string) => {
    if (err.message?.includes("delegations_school_slug_event_key") || err.message?.includes("institutions_slug_key")) {
      toast.error("Já existe uma escola com este slug. Escolha outro.");
    } else {
      toast.error(`Erro ao ${action} delegação: ${err.message}`);
    }
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["delegations-page"] });

  const createMutation = useMutation({
    mutationFn: async (values: DelegationFormValues) => {
      const { error } = await (supabase.from("delegations") as any).insert(toPayload(values));
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Delegação criada com sucesso");
      setDialogOpen(false);
    },
    onError: (err: Error) => handleError(err, "criar"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: DelegationFormValues & { id: string }) => {
      const { event_id: _, ...rest } = toPayload(values);
      const { error } = await (supabase.from("delegations") as any).update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Delegação atualizada com sucesso");
      setDialogOpen(false);
      setEditingDelegation(null);
    },
    onError: (err: Error) => handleError(err, "atualizar"),
  });

  const handleSubmit = (values: DelegationFormValues) => {
    if (editingDelegation) {
      updateMutation.mutate({ id: editingDelegation.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="animate-fade-in space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground">Delegações</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            Gestão das delegações de instituições nos eventos
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => { setEditingDelegation(null); setDialogOpen(true); }}
            disabled={!events.length}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova delegação
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar escola, cidade ou chefe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={networkFilter} onValueChange={setNetworkFilter}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Rede" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as redes</SelectItem>
              {Object.entries(NETWORK_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cityFilter} onValueChange={setCityFilter} disabled={!cityOptions.length}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Município" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os municípios</SelectItem>
              {cityOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={stageId ?? "all"}
            onValueChange={setStageFilter}
            disabled={!selectedEventId || eventStages.length === 0}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <Layers className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Todas as etapas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {eventStages.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar:
          </span>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="school_name">Escola</SelectItem>
              <SelectItem value="school_city">Município</SelectItem>
              <SelectItem value="school_network_type">Rede</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="created_at">Cadastro</SelectItem>
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

          <span className="text-xs text-muted-foreground inline-flex items-center gap-1 sm:ml-2">
            <FolderOpen className="h-3.5 w-3.5" /> Agrupar por:
          </span>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem agrupamento</SelectItem>
              <SelectItem value="school_city">Município</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="school_network_type">Rede</SelectItem>
              <SelectItem value="stage">Etapa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Result count (mobile) */}
      {!isLoading && delegations.length > 0 && (
        <p className="text-xs text-muted-foreground sm:hidden -mt-1">
          {total} {total === 1 ? "delegação encontrada" : "delegações encontradas"}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 sm:h-14 w-full rounded-md" />
          ))}
        </div>
      ) : !delegations.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-12 sm:py-16 text-center px-4">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma delegação encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou registre a primeira delegação.</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card list */}
          <div className={`grid gap-3 sm:hidden ${isFetching ? "opacity-70" : ""}`}>
            {delegations.map((del) => {
              const d = del as any;
              const statusInfo = STATUS_MAP[del.status] ?? { label: del.status, variant: "outline" as const };
              const cityState = [d.school_city, d.school_state].filter(Boolean).join("/");
              return (
                <Link
                  key={del.id}
                  to={`/admin/delegacoes/${del.id}`}
                  className="rounded-lg border bg-card p-3 active:scale-[0.99] transition-transform hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm text-foreground line-clamp-2 flex-1">
                      {d.school_name ?? "—"}
                    </h3>
                    <Badge variant={statusInfo.variant} className="shrink-0 text-[10px] px-1.5 py-0">
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {cityState && (
                      <p className="flex items-center gap-1">
                        <span className="font-medium text-foreground/70">Local:</span> {cityState}
                        {d.school_network_type && (
                          <span className="capitalize ml-1">· {d.school_network_type}</span>
                        )}
                      </p>
                    )}
                    {del.chief_name && (
                      <p>
                        <span className="font-medium text-foreground/70">Chefe:</span> {del.chief_name}
                      </p>
                    )}
                    {del.chief_phone && (
                      <p>
                        <span className="font-medium text-foreground/70">Tel:</span> {del.chief_phone}
                      </p>
                    )}
                  </div>
                  <div className="mt-2">{renderStageBadges(del.id)}</div>
                  {canWrite && (
                    <div className="flex justify-end mt-2 pt-2 border-t border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingDelegation(del); setDialogOpen(true); }}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escola</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Rede</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chefe</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Etapa(s)</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {delegations.map((del) => {
                  const d = del as any;
                  const statusInfo = STATUS_MAP[del.status] ?? { label: del.status, variant: "outline" as const };
                  const cityState = [d.school_city, d.school_state].filter(Boolean).join("/");
                  return (
                    <TableRow key={del.id} className={isFetching ? "opacity-70" : ""}>
                      <TableCell className="font-medium">{d.school_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{cityState || "—"}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{d.school_network_type ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </TableCell>
                      <TableCell>{del.chief_name || "—"}</TableCell>
                      <TableCell>{del.chief_phone || "—"}</TableCell>
                      <TableCell>{renderStageBadges(del.id) ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/admin/delegacoes/${del.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {canWrite && (
                            <Button variant="ghost" size="icon" onClick={() => { setEditingDelegation(del); setDialogOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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
        </>
      )}

      <DelegationFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingDelegation(null); }}
        delegation={editingDelegation}
        events={events}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
