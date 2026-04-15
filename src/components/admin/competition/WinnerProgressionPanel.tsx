import { useState, useMemo } from "react";
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
import { useDroppable } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Trophy, ArrowRight, GripVertical, Save, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

// ── Types ───────────────────────────────────────────────────
interface Props {
  eventId: string;
  sportEventId: string;
}

interface WinnerItem {
  entryId: string;
  matchId: string;
  matchNumber: number;
  teamId: string | null;
  teamName: string;
  fromPhase: string;
  fromGroup: string;
}

interface NextSlot {
  matchId: string;
  matchNumber: number;
  side: "home" | "away";
  currentTeamId: string | null;
  currentTeamName: string | null;
  entryId: string;
  phaseName: string;
  groupName: string;
}

// ── Draggable Winner ────────────────────────────────────────
function DraggableWinner({ item }: { item: WinnerItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `winner-${item.entryId}`,
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
      className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
      <Trophy className="h-3 w-3 text-amber-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{item.teamName}</p>
        <p className="text-[10px] text-muted-foreground">
          Partida #{item.matchNumber} · {item.fromGroup}
        </p>
      </div>
    </div>
  );
}

// ── Next Phase Slot ─────────────────────────────────────────
function NextPhaseSlot({
  slot,
  onRemove,
}: {
  slot: NextSlot;
  onRemove: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `next-${slot.entryId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-h-[44px] rounded-lg border-2 border-dashed flex items-center justify-center px-2 py-1 transition-colors",
        isOver ? "border-primary bg-primary/10" : "border-muted-foreground/20",
        slot.currentTeamId ? "border-solid bg-card" : ""
      )}
    >
      {slot.currentTeamId ? (
        <div className="flex items-center gap-2 w-full">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{slot.currentTeamName}</p>
          </div>
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive shrink-0">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground">
          Arraste vencedor ({slot.side === "home" ? "Lado A" : "Lado B"})
        </span>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
export default function WinnerProgressionPanel({ eventId, sportEventId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Load all phases with matches
  const { data, isLoading } = useQuery({
    queryKey: ["winner-progression", eventId, sportEventId],
    queryFn: async () => {
      const { data: phases } = await supabase
        .from("competition_phases")
        .select("id, name, sort_order, phase_type")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("sort_order");
      if (!phases || phases.length < 2) return null;

      const phaseIds = phases.map((p) => p.id);

      const { data: groups } = await supabase
        .from("competition_groups")
        .select("id, name, phase_id, sort_order")
        .in("phase_id", phaseIds)
        .order("sort_order");

      const { data: matches } = await supabase
        .from("competition_matches")
        .select(`
          id, match_number, status, phase_id, group_id,
          competition_match_entries(id, side, team_id, teams(name)),
          competition_match_results(match_entry_id, outcome)
        `)
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("match_number");

      return { phases, groups: groups ?? [], matches: matches ?? [] };
    },
  });

  // Compute winners from finished matches in earlier phases
  const { winners, nextSlots } = useMemo(() => {
    if (!data) return { winners: [] as WinnerItem[], nextSlots: [] as NextSlot[] };

    const phases = data.phases;
    const winnersList: WinnerItem[] = [];
    const slotsList: NextSlot[] = [];
    const assignedWinnerTeamIds = new Set<string>();

    // First pass: find winners
    for (let i = 0; i < phases.length - 1; i++) {
      const phase = phases[i];
      const phaseMatches = data.matches.filter((m: any) => m.phase_id === phase.id && m.status === "finished");

      for (const m of phaseMatches as any[]) {
        const results = m.competition_match_results ?? [];
        const winResult = results.find((r: any) => r.outcome === "win");
        if (!winResult) continue;

        const winEntry = (m.competition_match_entries ?? []).find((e: any) => e.id === winResult.match_entry_id);
        if (!winEntry || !winEntry.team_id) continue;

        const group = data.groups.find((g) => g.id === m.group_id);
        winnersList.push({
          entryId: winEntry.id,
          matchId: m.id,
          matchNumber: m.match_number ?? 0,
          teamId: winEntry.team_id,
          teamName: winEntry.teams?.name ?? "?",
          fromPhase: phase.name,
          fromGroup: group?.name ?? phase.name,
        });
      }
    }

    // Second pass: find next phase slots
    for (let i = 1; i < phases.length; i++) {
      const phase = phases[i];
      const phaseMatches = data.matches.filter((m: any) => m.phase_id === phase.id);

      for (const m of phaseMatches as any[]) {
        const group = data.groups.find((g) => g.id === (m as any).group_id);
        for (const entry of (m as any).competition_match_entries ?? []) {
          if (entry.team_id) assignedWinnerTeamIds.add(entry.team_id);
          slotsList.push({
            matchId: m.id,
            matchNumber: (m as any).match_number ?? 0,
            side: entry.side,
            currentTeamId: entry.team_id ?? null,
            currentTeamName: entry.teams?.name ?? null,
            entryId: entry.id,
            phaseName: phase.name,
            groupName: group?.name ?? phase.name,
          });
        }
      }
    }

    // Filter winners that are already assigned
    const filteredWinners = winnersList.filter((w) => !assignedWinnerTeamIds.has(w.teamId!));

    return { winners: filteredWinners, nextSlots: slotsList };
  }, [data]);

  // DnD: assign winner to next slot
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string>>({}); // entryId -> teamId

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const winnEntryId = (active.id as string).replace("winner-", "");
    const winner = winners.find((w) => w.entryId === winnEntryId);
    if (!winner) return;

    const overStr = over.id as string;
    if (!overStr.startsWith("next-")) return;
    const targetEntryId = overStr.replace("next-", "");

    setPendingAssignments((prev) => ({ ...prev, [targetEntryId]: winner.teamId! }));
  };

  const removeAssignment = (entryId: string) => {
    setPendingAssignments((prev) => {
      const copy = { ...prev };
      delete copy[entryId];
      return copy;
    });
  };

  // Save progression
  const saveMut = useMutation({
    mutationFn: async () => {
      for (const [entryId, teamId] of Object.entries(pendingAssignments)) {
        const { error } = await supabase
          .from("competition_match_entries")
          .update({ team_id: teamId })
          .eq("id", entryId);
        if (error) throw error;
      }

      // Audit
      await supabase.from("audit_events").insert({
        table_name: "competition_match_entries",
        record_id: sportEventId,
        action: "winner_progression_save",
        payload: { assignments: pendingAssignments, by: user?.id },
        created_by: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Progressão de vencedores salva!");
      setPendingAssignments({});
      qc.invalidateQueries({ queryKey: ["winner-progression"] });
      qc.invalidateQueries({ queryKey: ["dispute-builder-existing"] });
      qc.invalidateQueries({ queryKey: ["central-matches"] });
      qc.invalidateQueries({ queryKey: ["knockout-bracket"] });
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data || data.phases.length < 2) return null;

  const activeDragWinner = activeId
    ? winners.find((w) => `winner-${w.entryId}` === activeId)
    : null;

  // Merge pending into displayed slots
  const displaySlots = nextSlots.map((s) => {
    const pending = pendingAssignments[s.entryId];
    if (pending) {
      const winner = winners.find((w) => w.teamId === pending);
      return { ...s, currentTeamId: pending, currentTeamName: winner?.teamName ?? "?" };
    }
    return s;
  });

  // Group slots by phase
  const slotsByPhase = data.phases.slice(1).map((phase) => ({
    phase,
    slots: displaySlots.filter((s) => s.phaseName === phase.name),
  }));

  // Available winners (not yet assigned in pending)
  const pendingTeamIds = new Set(Object.values(pendingAssignments));
  const availableWinners = winners.filter((w) => !pendingTeamIds.has(w.teamId!));

  if (availableWinners.length === 0 && nextSlots.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          Progressão de Vencedores
        </h3>
        {Object.keys(pendingAssignments).length > 0 && (
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Salvar Progressão ({Object.keys(pendingAssignments).length})
          </Button>
        )}
      </div>

      {availableWinners.length === 0 && Object.keys(pendingAssignments).length === 0 && (
        <Alert>
          <AlertDescription className="text-xs">
            Nenhum vencedor disponível para progressão. Encerre partidas e marque vencedores acima.
          </AlertDescription>
        </Alert>
      )}

      {(availableWinners.length > 0 || Object.keys(pendingAssignments).length > 0) && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-h-[200px]">
            {/* Winners pool */}
            {availableWinners.length > 0 && (
              <div className="w-52 shrink-0">
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />
                      Vencedores ({availableWinners.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <SortableContext
                      items={availableWinners.map((w) => `winner-${w.entryId}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1">
                        {availableWinners.map((w) => (
                          <DraggableWinner key={w.entryId} item={w} />
                        ))}
                      </div>
                    </SortableContext>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Next phase slots */}
            <div className="flex-1 min-w-0 space-y-3">
              {slotsByPhase.map(({ phase, slots }) => (
                slots.length > 0 && (
                  <Card key={phase.id}>
                    <CardHeader className="py-2 px-3">
                      <CardTitle className="text-xs">{phase.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-2">
                      {/* Group matches by match_number */}
                      {Array.from(new Set(slots.map((s) => s.matchNumber))).map((mn) => {
                        const matchSlots = slots.filter((s) => s.matchNumber === mn);
                        return (
                          <div key={mn} className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">
                              #{mn}
                            </span>
                            {matchSlots.map((slot) => (
                              <NextPhaseSlot
                                key={slot.entryId}
                                slot={slot}
                                onRemove={() => removeAssignment(slot.entryId)}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeDragWinner && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 shadow-lg">
                <Trophy className="h-3 w-3 text-amber-500" />
                <p className="text-xs font-medium">{activeDragWinner.teamName}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
