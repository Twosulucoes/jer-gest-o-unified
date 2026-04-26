import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Plus, Pencil, MapPin, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VenueFormDialog, { type VenueFormValues } from "@/components/admin/VenueFormDialog";

const VENUE_TYPE_MAP: Record<string, string> = {
  arena: "Arena", gymnasium: "Ginásio", ginasio: "Ginásio", field: "Campo", campo: "Campo",
  pool: "Piscina", piscina: "Piscina", court: "Quadra", quadra: "Quadra",
  track: "Pista", pista: "Pista", other: "Outro", outro: "Outro",
};

const STAGE_FILTER_ALL = "__all__";
const STAGE_FILTER_NONE = "__none__";

type VenueRow = Tables<"venues"> & { event_stage_id: string | null };

export default function LocaisPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const activeEventId = useActiveEventId();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueRow | null>(null);
  const [stageFilter, setStageFilter] = useState<string>(STAGE_FILTER_ALL);

  const canWrite = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["event_stages", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name, status, sort_order")
        .eq("event_id", activeEventId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: venues, isLoading } = useQuery({
    queryKey: ["venues", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("event_id", activeEventId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as VenueRow[];
    },
  });

  const stagesMap = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const filtered = useMemo(() => {
    if (!venues) return [] as VenueRow[];
    if (stageFilter === STAGE_FILTER_ALL) return venues;
    if (stageFilter === STAGE_FILTER_NONE) return venues.filter((v) => !v.event_stage_id);
    return venues.filter((v) => v.event_stage_id === stageFilter);
  }, [venues, stageFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, VenueRow[]>();
    for (const v of filtered) {
      const key = v.event_stage_id ?? STAGE_FILTER_NONE;
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    // Order: by stage sort_order, then "sem etapa" last
    const ordered = Array.from(map.entries()).sort(([a], [b]) => {
      if (a === STAGE_FILTER_NONE) return 1;
      if (b === STAGE_FILTER_NONE) return -1;
      const sa = stagesMap.get(a)?.sort_order ?? 999;
      const sb = stagesMap.get(b)?.sort_order ?? 999;
      return sa - sb;
    });
    return ordered;
  }, [filtered, stagesMap]);

  const toPayload = (values: VenueFormValues) => ({
    event_id: values.event_id,
    event_stage_id: values.event_stage_id,
    name: values.name,
    venue_type: values.venue_type,
    city: values.city || null,
    address: values.address || null,
    is_active: values.is_active,
  });

  const createMutation = useMutation({
    mutationFn: async (values: VenueFormValues) => {
      const { error } = await supabase.from("venues").insert(toPayload(values));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      toast.success("Local criado com sucesso");
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error("Erro ao criar local: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: VenueFormValues & { id: string }) => {
      const { event_id: _, ...payload } = toPayload(values);
      const { error } = await supabase.from("venues").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
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

  const orphanCount = (venues ?? []).filter((v) => !v.event_stage_id).length;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Locais de competição</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cada local pertence a uma etapa do evento. Use o filtro abaixo para visualizar por etapa.
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
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.status === "active" ? " (ativa)" : ""}
                </SelectItem>
              ))}
              {orphanCount > 0 && (
                <SelectItem value={STAGE_FILTER_NONE}>
                  Sem etapa vinculada ({orphanCount})
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {orphanCount > 0 && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠ {orphanCount} local(is) sem etapa vinculada — edite para corrigir.
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
      ) : !filtered.length ? (
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
          {grouped.map(([stageKey, items]) => {
            const stage = stageKey === STAGE_FILTER_NONE ? null : stagesMap.get(stageKey);
            return (
              <div key={stageKey} className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">
                      {stage?.name ?? "Sem etapa vinculada"}
                    </h2>
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
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead className="w-[60px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((venue) => (
                      <TableRow key={venue.id}>
                        <TableCell className="font-medium">{venue.name}</TableCell>
                        <TableCell>{VENUE_TYPE_MAP[venue.venue_type] ?? venue.venue_type}</TableCell>
                        <TableCell>{venue.city || "—"}</TableCell>
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
                              onClick={() => { setEditingVenue(venue); setDialogOpen(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
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
