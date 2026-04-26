import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, MapPin, Layers, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VenueFormDialog, { type VenueFormValues } from "@/components/admin/VenueFormDialog";
import { VenueTableRow, VenueCard } from "@/components/admin/locais/VenueRowItem";
import ArchiveVenueDialog from "@/components/admin/locais/ArchiveVenueDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const STAGE_FILTER_ALL = "__all__";
const STAGE_FILTER_NONE = "__none__";

type VenueRow = Tables<"venues">;
type StageRow = {
  id: string; name: string; status: string; sort_order: number;
  host_name: string | null; host_city: string | null;
};

export default function LocaisPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const activeEventId = useActiveEventId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<(VenueRow & { event_stage_ids?: string[] }) | null>(null);
  const [stageFilter, setStageFilter] = useState<string>(STAGE_FILTER_ALL);
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<VenueRow | null>(null);

  const canWrite =
    hasRole("admin") ||
    hasRole("secretaria") ||
    hasRole("coordenacao_tecnica") ||
    hasRole("super_admin");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // P1+P3: bootstrap único — paraleliza stages + venues + dependências
  const { data: bootstrap, isLoading } = useQuery({
    queryKey: ["locais-bootstrap", activeEventId, showArchived],
    enabled: !!activeEventId,
    queryFn: async () => {
      const [stagesRes, venuesRes] = await Promise.all([
        (supabase as any)
          .from("event_stages")
          .select("id, name, status, sort_order, host_name, host_city")
          .eq("event_id", activeEventId)
          .order("sort_order", { ascending: true }),
        // P3: traz arquivados se o filtro estiver ativo (RLS controla visibilidade)
        (showArchived
          ? (supabase as any).from("venues").select("*").eq("event_id", activeEventId).not("deleted_at", "is", null).order("name")
          : (supabase as any).from("venues").select("*").eq("event_id", activeEventId).is("deleted_at", null).order("name")
        ),
      ]);
      if (stagesRes.error) throw stagesRes.error;
      if (venuesRes.error) throw venuesRes.error;

      const stages = (stagesRes.data ?? []) as StageRow[];
      const venues = (venuesRes.data ?? []) as VenueRow[];

      let links: Array<{ venue_id: string; event_stage_id: string }> = [];
      let deps: Record<string, { matches_total: number; matches_future: number }> = {};

      if (venues.length > 0) {
        const venueIds = venues.map((v) => v.id);
        const [linksRes, depsRes] = await Promise.all([
          (supabase as any)
            .from("venue_event_stages")
            .select("venue_id, event_stage_id")
            .in("venue_id", venueIds),
          // P3: view de dependências; tolera ausência (antes do SQL aplicado)
          (supabase as any)
            .from("v_venue_dependencies")
            .select("venue_id, matches_total, matches_future")
            .in("venue_id", venueIds),
        ]);
        if (linksRes.error) throw linksRes.error;
        links = (linksRes.data ?? []) as Array<{ venue_id: string; event_stage_id: string }>;

        if (!depsRes.error && Array.isArray(depsRes.data)) {
          for (const d of depsRes.data as Array<{ venue_id: string; matches_total: number; matches_future: number }>) {
            deps[d.venue_id] = { matches_total: d.matches_total ?? 0, matches_future: d.matches_future ?? 0 };
          }
        }
      }

      return { stages, venues, links, deps };
    },
  });

  const stages = bootstrap?.stages ?? [];
  const venues = bootstrap?.venues;
  const links = bootstrap?.links ?? [];
  const deps = bootstrap?.deps ?? {};

  const stagesMap = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  // venueId -> [stageId]
  const linksByVenue = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of links) {
      const arr = m.get(l.venue_id) ?? [];
      arr.push(l.event_stage_id);
      m.set(l.venue_id, arr);
    }
    return m;
  }, [links]);

  // stageId -> [venue]
  const venuesByStage = useMemo(() => {
    const m = new Map<string, VenueRow[]>();
    const orphans: VenueRow[] = [];
    for (const v of venues ?? []) {
      const stageIds = linksByVenue.get(v.id) ?? [];
      if (stageIds.length === 0) {
        orphans.push(v);
        continue;
      }
      for (const sid of stageIds) {
        const arr = m.get(sid) ?? [];
        arr.push(v);
        m.set(sid, arr);
      }
    }
    if (orphans.length > 0) m.set(STAGE_FILTER_NONE, orphans);
    return m;
  }, [venues, linksByVenue]);

  const orphanCount = (venues ?? []).filter((v) => (linksByVenue.get(v.id) ?? []).length === 0).length;

  const groupsToShow = useMemo(() => {
    const entries = Array.from(venuesByStage.entries());
    let filtered = entries;
    if (stageFilter !== STAGE_FILTER_ALL) {
      filtered = entries.filter(([key]) => key === stageFilter);
    }
    return filtered.sort(([a], [b]) => {
      if (a === STAGE_FILTER_NONE) return 1;
      if (b === STAGE_FILTER_NONE) return -1;
      const sa = stagesMap.get(a)?.sort_order ?? 999;
      const sb = stagesMap.get(b)?.sort_order ?? 999;
      return sa - sb;
    });
  }, [venuesByStage, stageFilter, stagesMap]);

  const venuePayload = (values: VenueFormValues) => ({
    event_id: values.event_id,
    name: values.name,
    venue_type: values.venue_type,
    city: values.city || null,
    address: values.address || null,
    is_active: values.is_active,
    // event_stage_id (legado) é mantido pela RPC rpc_sync_venue_stages
  });

  const syncStages = async (venueId: string, stageIds: string[]) => {
    // P0: usa RPC transacional com auditoria (audit_events) e validação de escopo do evento
    const { error } = await (supabase as any).rpc("rpc_sync_venue_stages", {
      p_venue_id: venueId,
      p_stage_ids: stageIds,
    });
    if (error) throw error;
  };

  const createMutation = useMutation({
    mutationFn: async (values: VenueFormValues) => {
      const { data, error } = await supabase
        .from("venues")
        .insert(venuePayload(values) as any)
        .select("id")
        .single();
      if (error) throw error;
      await syncStages(data.id, values.event_stage_ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locais-bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["venues-by-stage"] });
      toast.success("Local criado com sucesso");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error("Erro ao criar local: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: VenueFormValues & { id: string }) => {
      const { event_id: _, ...payload } = venuePayload(values);
      const { error } = await supabase.from("venues").update(payload as any).eq("id", id);
      if (error) throw error;
      await syncStages(id, values.event_stage_ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locais-bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["venues-by-stage"] });
      toast.success("Local atualizado com sucesso");
      setDialogOpen(false);
      setEditingVenue(null);
    },
    onError: (err: Error) => toast.error("Erro ao atualizar local: " + err.message),
  });

  // P2: toggle ativo/inativo inline
  const toggleActiveMutation = useMutation({
    mutationFn: async (v: VenueRow) => {
      const { error } = await supabase
        .from("venues")
        .update({ is_active: !v.is_active } as any)
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["locais-bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["venues-by-stage"] });
      toast.success(v.is_active ? "Local desativado" : "Local ativado");
    },
    onError: (err: Error) => toast.error("Erro ao alterar status: " + err.message),
  });

  // P3: arquivar (soft-delete) com checagem de partidas futuras
  const archiveMutation = useMutation({
    mutationFn: async ({ venueId, force, reason }: { venueId: string; force: boolean; reason: string }) => {
      const { data, error } = await (supabase as any).rpc("rpc_archive_venue", {
        p_venue_id: venueId,
        p_force: force,
        p_reason: reason || null,
      });
      if (error) throw error;
      return data as { matches_future: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["locais-bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["venues-by-stage"] });
      toast.success(
        data?.matches_future
          ? `Local arquivado (${data.matches_future} partida(s) futura(s) afetada(s))`
          : "Local arquivado"
      );
      setArchiveTarget(null);
    },
    onError: (err: Error) => toast.error("Erro ao arquivar: " + err.message),
  });

  // P3: restaurar venue arquivado
  const restoreMutation = useMutation({
    mutationFn: async (venueId: string) => {
      const { error } = await (supabase as any).rpc("rpc_restore_venue", { p_venue_id: venueId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locais-bootstrap"] });
      queryClient.invalidateQueries({ queryKey: ["venues-by-stage"] });
      toast.success("Local restaurado");
    },
    onError: (err: Error) => toast.error("Erro ao restaurar: " + err.message),
  });

  const handleSubmit = (values: VenueFormValues) => {
    if (editingVenue) {
      updateMutation.mutate({ id: editingVenue.id, ...values });
    } else {
      createMutation.mutate(values);
    }
  };

  const openEdit = (v: VenueRow) => {
    setEditingVenue({ ...v, event_stage_ids: linksByVenue.get(v.id) ?? [] });
    setDialogOpen(true);
  };

  // P2: filtragem por termo de busca (nome, cidade, endereço)
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const matchesSearch = (v: VenueRow) => {
    if (!searchTerm.trim()) return true;
    const t = norm(searchTerm.trim());
    return (
      norm(v.name).includes(t) ||
      norm(v.city ?? "").includes(t) ||
      norm(v.address ?? "").includes(t)
    );
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Locais de competição</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Um local pode atender várias etapas. Cada etapa tem uma sede definida no cadastro de etapas.
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => { setEditingVenue(null); setDialogOpen(true); }}
            disabled={!events.length}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo local
          </Button>
        )}
      </div>

      {/* Filtro por etapa */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Filtrar por etapa
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STAGE_FILTER_ALL}>Todas as etapas</SelectItem>
                {stages.map((s) => {
                  const sede = s.host_name || s.host_city;
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{sede ? ` — ${sede}` : ""}{s.status === "active" ? " (ativa)" : ""}
                    </SelectItem>
                  );
                })}
                {orphanCount > 0 && (
                  <SelectItem value={STAGE_FILTER_NONE}>
                    Sem etapa vinculada ({orphanCount})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, cidade ou endereço…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {orphanCount > 0 ? (
              <p className="text-xs text-warning">
                ⚠ {orphanCount} local(is) sem nenhuma etapa vinculada — edite para corrigir.
              </p>
            ) : <span />}
            {canWrite && (
              <div className="flex items-center gap-2">
                <Switch
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                />
                <Label htmlFor="show-archived" className="text-xs cursor-pointer">
                  Mostrar arquivados
                </Label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : (() => {
        // Aplica busca textual em cima dos grupos já filtrados por etapa
        const filteredGroups = groupsToShow
          .map(([k, items]) => [k, items.filter(matchesSearch)] as [string, VenueRow[]])
          .filter(([, items]) => items.length > 0);

        if (filteredGroups.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
              <MapPin className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">Nenhum local encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm
                  ? `Nenhum resultado para "${searchTerm}".`
                  : stageFilter === STAGE_FILTER_ALL
                  ? "Crie o primeiro local para começar."
                  : "Nenhum local nesta etapa."}
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            {filteredGroups.map(([stageKey, items]) => {
              const stage = stageKey === STAGE_FILTER_NONE ? null : stagesMap.get(stageKey);
              const sede = stage ? (stage.host_name || stage.host_city) : null;
              return (
                <div key={stageKey} className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">
                        {stage?.name ?? "Sem etapa vinculada"}
                      </h2>
                      {sede && (
                        <Badge variant="outline" className="text-[10px]">
                          Sede: {sede}
                        </Badge>
                      )}
                      {stage?.status === "active" && (
                        <Badge variant="default" className="text-[10px]">ATIVA</Badge>
                      )}
                      {!stage && (
                        <Badge variant="outline" className="text-[10px] border-warning text-warning">
                          ⚠ Sem vínculo
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{items.length} local(is)</span>
                  </div>

                  {/* Desktop: tabela */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Cidade</TableHead>
                          <TableHead>Outras etapas</TableHead>
                          <TableHead>Status</TableHead>
                          {canWrite && <TableHead className="w-[60px]" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((venue) => {
                          const allStageIds = linksByVenue.get(venue.id) ?? [];
                          const otherStages = allStageIds
                            .filter((sid) => sid !== stageKey)
                            .map((sid) => stagesMap.get(sid)?.name)
                            .filter(Boolean) as string[];
                          return (
                            <VenueTableRow
                              key={`${stageKey}-${venue.id}`}
                              venue={venue}
                              stageKey={stageKey}
                              otherStages={otherStages}
                              dependency={deps[venue.id]}
                              canWrite={canWrite}
                              isToggling={
                                toggleActiveMutation.isPending &&
                                toggleActiveMutation.variables?.id === venue.id
                              }
                              onEdit={openEdit}
                              onToggleActive={(v) => toggleActiveMutation.mutate(v)}
                              onArchive={(v) => setArchiveTarget(v)}
                              onRestore={(v) => restoreMutation.mutate(v.id)}
                            />
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile: cards */}
                  <div className="md:hidden p-3 space-y-2">
                    {items.map((venue) => {
                      const allStageIds = linksByVenue.get(venue.id) ?? [];
                      const otherStages = allStageIds
                        .filter((sid) => sid !== stageKey)
                        .map((sid) => stagesMap.get(sid)?.name)
                        .filter(Boolean) as string[];
                      return (
                        <VenueCard
                          key={`m-${stageKey}-${venue.id}`}
                          venue={venue}
                          otherStages={otherStages}
                          dependency={deps[venue.id]}
                          canWrite={canWrite}
                          isToggling={
                            toggleActiveMutation.isPending &&
                            toggleActiveMutation.variables?.id === venue.id
                          }
                          onEdit={openEdit}
                          onToggleActive={(v) => toggleActiveMutation.mutate(v)}
                          onArchive={(v) => setArchiveTarget(v)}
                          onRestore={(v) => restoreMutation.mutate(v.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <VenueFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingVenue(null); }}
        venue={editingVenue}
        events={events}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <ArchiveVenueDialog
        open={!!archiveTarget}
        onOpenChange={(o) => { if (!o) setArchiveTarget(null); }}
        venue={archiveTarget}
        isPending={archiveMutation.isPending}
        onConfirm={({ force, reason }) =>
          archiveTarget && archiveMutation.mutate({ venueId: archiveTarget.id, force, reason })
        }
      />
    </div>
  );
}
