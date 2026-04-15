import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus, Trash2, Save, GripVertical, Search, Trophy,
  AlertTriangle, Loader2, Edit3, Users, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

// ── Types ───────────────────────────────────────────────────
interface Props {
  eventId: string;
  sportEventId: string;
  onChanged: () => void;
}

interface AthleteItem {
  id: string; // participant_sport_event id
  name: string;
  institution: string;
}

interface HeatDraft {
  id: string;
  name: string;
  isFinal: boolean;
  athleteIds: string[];
  dbMatchId?: string;
}

// ── Draggable Athlete ───────────────────────────────────────
function DraggableAthlete({ athlete, isDragging }: { athlete: AthleteItem; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `athlete-${athlete.id}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{athlete.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{athlete.institution}</p>
      </div>
    </div>
  );
}

// ── Heat Drop Zone ──────────────────────────────────────────
function HeatDropZone({ heatId, children }: { heatId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `heat-${heatId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[60px] rounded-lg border-2 border-dashed p-2 transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-muted-foreground/15"
      )}
    >
      {children}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
export default function IndividualHeatBuilderTab({ eventId, sportEventId, onChanged }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [heats, setHeats] = useState<HeatDraft[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Load athletes ─────────────────────────────────────────
  const { data: athletes = [], isLoading: loadingAthletes } = useQuery({
    queryKey: ["heat-builder-athletes", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("id, status, participant_id, participants(id, person_id, people(full_name), delegation_id, delegations(institution_id, institutions(name)))")
        .eq("sport_event_id", sportEventId)
        .in("status", ["confirmed", "active", "inscrito"])
        .order("created_at");
      if (error) throw error;
      return (data ?? []).map((pse: any) => ({
        id: pse.id,
        name: (pse.participants as any)?.people?.full_name ?? "—",
        institution: (pse.participants as any)?.delegations?.institutions?.name ?? "—",
      })) as AthleteItem[];
    },
  });

  // ── Load existing structure ───────────────────────────────
  const { data: existingData, isLoading: loadingExisting } = useQuery({
    queryKey: ["heat-builder-existing", eventId, sportEventId],
    queryFn: async () => {
      const { data: phases } = await supabase
        .from("competition_phases")
        .select("id, name, phase_type, sort_order")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("sort_order");

      if (!phases || phases.length === 0) return null;

      const phaseIds = phases.map((p) => p.id);
      const { data: matches } = await supabase
        .from("competition_matches")
        .select("id, match_number, notes, phase_id, competition_match_entries(id, participant_sport_event_id, seed)")
        .in("phase_id", phaseIds)
        .order("match_number");

      return { phases, matches: matches ?? [] };
    },
  });

  // Initialize from existing
  if (!initialized && !loadingAthletes && !loadingExisting) {
    if (existingData && existingData.matches.length > 0) {
      const drafts: HeatDraft[] = existingData.matches.map((m: any) => {
        const phase = existingData.phases.find((p) => p.id === m.phase_id);
        const isFinal = phase?.phase_type === "final" || (m.notes ?? "").toLowerCase().includes("final");
        const athleteIds = (m.competition_match_entries ?? [])
          .filter((e: any) => e.participant_sport_event_id)
          .sort((a: any, b: any) => (a.seed ?? 0) - (b.seed ?? 0))
          .map((e: any) => e.participant_sport_event_id);

        return {
          id: m.id,
          name: m.notes ?? `Bateria ${m.match_number}`,
          isFinal,
          athleteIds,
          dbMatchId: m.id,
        };
      });
      setHeats(drafts);
      setIsEditMode(false);
    }
    setInitialized(true);
  }

  // ── Derived ───────────────────────────────────────────────
  const assignedIds = useMemo(() => {
    const set = new Set<string>();
    heats.forEach((h) => h.athleteIds.forEach((id) => set.add(id)));
    return set;
  }, [heats]);

  const availableAthletes = useMemo(() => {
    return athletes.filter((a) => {
      if (assignedIds.has(a.id)) return false;
      if (search) {
        const s = search.toLowerCase();
        return a.name.toLowerCase().includes(s) || a.institution.toLowerCase().includes(s);
      }
      return true;
    });
  }, [athletes, assignedIds, search]);

  const getAthlete = useCallback((id: string) => athletes.find((a) => a.id === id) ?? null, [athletes]);

  // ── DnD ───────────────────────────────────────────────────
  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const activeStr = active.id as string;
    const overStr = over.id as string;

    const athleteId = activeStr.startsWith("athlete-") ? activeStr.replace("athlete-", "") : null;
    if (!athleteId) return;

    if (overStr.startsWith("heat-")) {
      const heatId = overStr.replace("heat-", "");
      setHeats((prev) => {
        const cleaned = prev.map((h) => ({
          ...h,
          athleteIds: h.athleteIds.filter((id) => id !== athleteId),
        }));
        return cleaned.map((h) =>
          h.id === heatId && !h.athleteIds.includes(athleteId)
            ? { ...h, athleteIds: [...h.athleteIds, athleteId] }
            : h
        );
      });
    }
  };

  // ── CRUD ──────────────────────────────────────────────────
  const heatCount = heats.filter((h) => !h.isFinal).length;

  const addHeat = (isFinal = false) => {
    const name = isFinal ? "Final" : `Bateria ${heatCount + 1}`;
    setHeats((prev) => [
      ...prev,
      { id: `draft-${Date.now()}`, name, isFinal, athleteIds: [] },
    ]);
  };

  const removeHeat = (heatId: string) => {
    setHeats((prev) => prev.filter((h) => h.id !== heatId));
  };

  const renameHeat = (heatId: string, name: string) => {
    setHeats((prev) => prev.map((h) => (h.id === heatId ? { ...h, name } : h)));
  };

  const removeAthleteFromHeat = (heatId: string, athleteId: string) => {
    setHeats((prev) =>
      prev.map((h) =>
        h.id === heatId ? { ...h, athleteIds: h.athleteIds.filter((id) => id !== athleteId) } : h
      )
    );
  };

  const hasFinal = heats.some((h) => h.isFinal);

  // ── Save ──────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      // Ensure heats phase exists
      let heatsPhaseId: string | null = null;
      let finalPhaseId: string | null = null;

      const { data: existingPhases } = await supabase
        .from("competition_phases")
        .select("id, phase_type")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId);

      heatsPhaseId = existingPhases?.find((p) => p.phase_type === "heats")?.id ?? null;
      finalPhaseId = existingPhases?.find((p) => p.phase_type === "final")?.id ?? null;

      if (!heatsPhaseId) {
        const { data: phase, error } = await supabase
          .from("competition_phases")
          .insert({
            event_id: eventId,
            sport_event_id: sportEventId,
            name: "Baterias",
            phase_type: "heats",
            sort_order: 1,
            bracket_config: { match_type: "heat" },
          })
          .select("id")
          .single();
        if (error) throw error;
        heatsPhaseId = phase.id;
      }

      let matchNum = 1;
      for (const heat of heats) {
        if (heat.athleteIds.length === 0 && !heat.dbMatchId) continue;

        let phaseId = heat.isFinal ? finalPhaseId : heatsPhaseId;
        if (heat.isFinal && !phaseId) {
          const { data: fp, error } = await supabase
            .from("competition_phases")
            .insert({
              event_id: eventId,
              sport_event_id: sportEventId,
              name: "Final",
              phase_type: "final",
              sort_order: 10,
              bracket_config: { match_type: "heat" },
            })
            .select("id")
            .single();
          if (error) throw error;
          finalPhaseId = fp.id;
          phaseId = fp.id;
        }

        if (heat.dbMatchId) {
          // Update: delete old entries and insert new
          await supabase.from("competition_match_entries").delete().eq("match_id", heat.dbMatchId);
          await supabase.from("competition_matches").update({ notes: heat.name }).eq("id", heat.dbMatchId);
        } else {
          // Create match
          const { data: match, error: mErr } = await supabase
            .from("competition_matches")
            .insert({
              event_id: eventId,
              sport_event_id: sportEventId,
              phase_id: phaseId!,
              match_number: matchNum,
              notes: heat.name,
              status: "scheduled",
            })
            .select("id")
            .single();
          if (mErr) throw mErr;
          heat.dbMatchId = match.id;
        }

        // Insert entries
        if (heat.athleteIds.length > 0) {
          const entries = heat.athleteIds.map((pseId, idx) => ({
            match_id: heat.dbMatchId!,
            participant_sport_event_id: pseId,
            side: "participant",
            seed: idx + 1,
          }));
          const { error } = await supabase.from("competition_match_entries").insert(entries);
          if (error) throw error;
        }

        matchNum++;
      }

      // Audit
      await supabase.from("audit_events").insert({
        table_name: "competition_matches",
        record_id: sportEventId,
        action: "heat_builder_save",
        payload: {
          heats_count: heats.filter((h) => !h.isFinal).length,
          final: hasFinal,
          total_athletes: heats.reduce((sum, h) => sum + h.athleteIds.length, 0),
          by: user?.id,
        },
        created_by: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Baterias salvas com sucesso!");
      qc.invalidateQueries({ queryKey: ["heat-builder-existing"] });
      qc.invalidateQueries({ queryKey: ["heats-phases"] });
      qc.invalidateQueries({ queryKey: ["heats-matches"] });
      qc.invalidateQueries({ queryKey: ["competition-summary"] });
      setIsEditMode(false);
      onChanged();
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  // ── Drag overlay ──────────────────────────────────────────
  const activeDragAthlete = activeId?.startsWith("athlete-")
    ? getAthlete(activeId.replace("athlete-", ""))
    : null;

  // ── Loading ───────────────────────────────────────────────
  if (loadingAthletes || loadingExisting) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (athletes.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Nenhum atleta apto para esta prova. Verifique as inscrições e a pré-validação.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Montador de Provas
        </h3>
        <div className="flex gap-2">
          {!isEditMode ? (
            <Button size="sm" variant="outline" onClick={() => setIsEditMode(true)}>
              <Edit3 className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => addHeat(false)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Bateria
              </Button>
              {!hasFinal && (
                <Button size="sm" variant="outline" onClick={() => addHeat(true)}>
                  <Star className="h-3.5 w-3.5 mr-1" /> Final
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || heats.length === 0}
              >
                {saveMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                Salvar
              </Button>
            </>
          )}
        </div>
      </div>

      {!isEditMode && heats.length === 0 && (
        <Alert>
          <AlertDescription>
            Nenhuma bateria montada. Clique em "Editar" para criar baterias e alocar atletas manualmente.
          </AlertDescription>
        </Alert>
      )}

      {isEditMode && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-h-[400px]">
            {/* ── Left: Athlete Pool ───────────────────────── */}
            <div className="w-56 shrink-0">
              <Card className="sticky top-4">
                <CardHeader className="py-3 px-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Atletas ({availableAthletes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-7 h-8 text-xs"
                    />
                  </div>
                  <SortableContext
                    items={availableAthletes.map((a) => `athlete-${a.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                      {availableAthletes.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-4">
                          {athletes.length === assignedIds.size
                            ? "Todos os atletas alocados ✓"
                            : "Nenhum atleta encontrado"}
                        </p>
                      ) : (
                        availableAthletes.map((a) => (
                          <DraggableAthlete key={a.id} athlete={a} isDragging={activeId === `athlete-${a.id}`} />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            </div>

            {/* ── Right: Heats ─────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-4">
              {heats.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Plus className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Nenhuma bateria criada. Adicione baterias e arraste atletas.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => addHeat(false)}>
                      <Plus className="h-4 w-4 mr-1" /> Bateria
                    </Button>
                    <Button variant="outline" onClick={() => addHeat(true)}>
                      <Star className="h-4 w-4 mr-1" /> Final
                    </Button>
                  </div>
                </div>
              )}

              {heats.map((heat) => (
                <Card key={heat.id} className={cn(heat.isFinal && "border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10")}>
                  <CardHeader className="py-3 px-4 flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      {heat.isFinal && <Star className="h-4 w-4 text-amber-500 shrink-0" />}
                      <Input
                        value={heat.name}
                        onChange={(e) => renameHeat(heat.id, e.target.value)}
                        className="h-7 w-40 text-sm font-semibold"
                      />
                      <Badge variant="secondary" className="text-[10px]">
                        {heat.athleteIds.length} atleta(s)
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeHeat(heat.id)}
                      className="text-destructive hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <HeatDropZone heatId={heat.id}>
                      {heat.athleteIds.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-3">
                          Arraste atletas aqui
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {heat.athleteIds.map((aId, idx) => {
                            const athlete = getAthlete(aId);
                            if (!athlete) return null;
                            return (
                              <div
                                key={aId}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-card border text-xs"
                              >
                                <span className="text-muted-foreground w-4 text-right shrink-0 text-[10px]">
                                  {idx + 1}.
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium truncate block">{athlete.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{athlete.institution}</span>
                                </div>
                                <button
                                  onClick={() => removeAthleteFromHeat(heat.id, aId)}
                                  className="text-muted-foreground hover:text-destructive shrink-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </HeatDropZone>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeDragAthlete && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card shadow-lg">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">{activeDragAthlete.name}</p>
                  <p className="text-[10px] text-muted-foreground">{activeDragAthlete.institution}</p>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* View mode */}
      {!isEditMode && heats.length > 0 && (
        <div className="space-y-4">
          {heats.map((heat) => (
            <Card key={heat.id} className={cn(heat.isFinal && "border-amber-400/50")}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  {heat.isFinal && <Star className="h-4 w-4 text-amber-500" />}
                  {heat.name}
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {heat.athleteIds.length} atleta(s)
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {heat.athleteIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum atleta alocado</p>
                ) : (
                  <div className="space-y-0.5">
                    {heat.athleteIds.map((aId, idx) => {
                      const athlete = getAthlete(aId);
                      return athlete ? (
                        <div key={aId} className="flex items-center gap-2 text-xs py-0.5">
                          <span className="text-muted-foreground w-4 text-right">{idx + 1}.</span>
                          <span className="font-medium">{athlete.name}</span>
                          <span className="text-muted-foreground">— {athlete.institution}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
