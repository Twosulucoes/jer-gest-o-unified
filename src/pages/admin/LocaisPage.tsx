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

  // P1: bootstrap único — paraleliza stages + venues, e em seguida busca links em uma única query
  const { data: bootstrap, isLoading } = useQuery({
    queryKey: ["locais-bootstrap", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const [stagesRes, venuesRes] = await Promise.all([
        (supabase as any)
          .from("event_stages")
          .select("id, name, status, sort_order, host_name, host_city")
          .eq("event_id", activeEventId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("venues")
          .select("*")
          .eq("event_id", activeEventId)
          .order("name"),
      ]);
      if (stagesRes.error) throw stagesRes.error;
      if (venuesRes.error) throw venuesRes.error;

      const stages = (stagesRes.data ?? []) as StageRow[];
      const venues = (venuesRes.data ?? []) as VenueRow[];

      let links: Array<{ venue_id: string; event_stage_id: string }> = [];
      if (venues.length > 0) {
        const venueIds = venues.map((v) => v.id);
        const linksRes = await (supabase as any)
          .from("venue_event_stages")
          .select("venue_id, event_stage_id")
          .in("venue_id", venueIds);
        if (linksRes.error) throw linksRes.error;
        links = (linksRes.data ?? []) as Array<{ venue_id: string; event_stage_id: string }>;
      }

      return { stages, venues, links };
    },
  });

  const stages = bootstrap?.stages ?? [];
  const venues = bootstrap?.venues;
  const links = bootstrap?.links ?? [];

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
        <CardContent className="pt-0 pb-3">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-full max-w-md">
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
          {orphanCount > 0 && (
            <p className="text-xs text-warning mt-2">
              ⚠ {orphanCount} local(is) sem nenhuma etapa vinculada — edite para corrigir.
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : groupsToShow.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum local encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            {stageFilter === STAGE_FILTER_ALL
              ? "Crie o primeiro local para começar."
              : "Nenhum local nesta etapa."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupsToShow.map(([stageKey, items]) => {
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
                      <Badge variant="destructive" className="text-[10px]">⚠ Órfão</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{items.length} local(is)</span>
                </div>
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
                        <TableRow key={`${stageKey}-${venue.id}`}>
                          <TableCell className="font-medium">{venue.name}</TableCell>
                          <TableCell>{VENUE_TYPE_MAP[venue.venue_type] ?? venue.venue_type}</TableCell>
                          <TableCell>{venue.city || "—"}</TableCell>
                          <TableCell>
                            {otherStages.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {otherStages.map((n) => (
                                  <Badge key={n} variant="secondary" className="text-[10px]">
                                    {n}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={venue.is_active ? "default" : "secondary"}>
                              {venue.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          {canWrite && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(venue)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}

      <VenueFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingVenue(null); }}
        venue={editingVenue}
        events={events}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
