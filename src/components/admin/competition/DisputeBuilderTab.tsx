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
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
  Plus, Trash2, Save, GripVertical, Search, Swords,
  AlertTriangle, Loader2, Eye, Edit3, FolderPlus, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import DisputePublishControl from "./DisputePublishControl";
import MatchResultInlineCard, { type InlineMatchData } from "./MatchResultInlineCard";
import WinnerProgressionPanel from "./WinnerProgressionPanel";

// ── Types ───────────────────────────────────────────────────
interface Props {
  eventId: string;
  sportEventId: string;
  onChanged: () => void;
}

interface TeamItem {
  id: string;
  name: string;
  institution: string;
}

interface MatchSlot {
  id: string; // local temp id
  homeTeamId: string | null;
  awayTeamId: string | null;
  matchNumber: number;
  dbMatchId?: string; // if persisted
}

interface GroupDraft {
  id: string; // local temp or db id
  name: string;
  teamIds: string[];
  matches: MatchSlot[];
  dbPhaseId?: string;
  dbGroupId?: string;
}

// ── Draggable Team Card ─────────────────────────────────────
function DraggableTeam({ team, isDragging }: { team: TeamItem; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `team-${team.id}`,
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
        <p className="text-xs font-medium truncate">{team.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{team.institution}</p>
      </div>
    </div>
  );
}

// ── Drop Zone (for match slot) ──────────────────────────────
function MatchSlotDrop({
  slotId,
  side,
  team,
  onRemove,
}: {
  slotId: string;
  side: "home" | "away";
  team: TeamItem | null;
  onRemove: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotId}-${side}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-h-[44px] rounded-lg border-2 border-dashed flex items-center justify-center px-2 py-1 transition-colors",
        isOver ? "border-primary bg-primary/10" : "border-muted-foreground/20",
        team ? "border-solid bg-card" : ""
      )}
    >
      {team ? (
        <div className="flex items-center gap-2 w-full">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{team.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{team.institution}</p>
          </div>
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive shrink-0">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <span className="text-[10px] text-muted-foreground">Arraste {side === "home" ? "Lado A" : "Lado B"}</span>
      )}
    </div>
  );
}

// ── Group Drop Zone (for teams) ─────────────────────────────
function GroupDropZone({ groupId, children }: { groupId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${groupId}` });
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
export default function DisputeBuilderTab({ eventId, sportEventId, onChanged }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Load teams ────────────────────────────────────────────
  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["dispute-builder-teams", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, status, delegation_id, delegations(institution_id, institutions(name))")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        institution: t.delegations?.institutions?.name ?? "—",
      })) as TeamItem[];
    },
  });

  // ── Load existing structure ───────────────────────────────
  const { data: existingData, isLoading: loadingExisting } = useQuery({
    queryKey: ["dispute-builder-existing", eventId, sportEventId],
    queryFn: async () => {
      const { data: phases } = await supabase
        .from("competition_phases")
        .select("id, name, sort_order")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("sort_order");

      if (!phases || phases.length === 0) return null;

      const phaseIds = phases.map((p) => p.id);
      const { data: dbGroups } = await supabase
        .from("competition_groups")
        .select("id, name, sort_order, phase_id")
        .in("phase_id", phaseIds)
        .order("sort_order");

      if (!dbGroups) return null;

      const groupIds = dbGroups.map((g) => g.id);
      const { data: drawLots } = await supabase
        .from("group_draw_lots")
        .select("group_id, team_id, seed")
        .in("group_id", groupIds)
        .order("seed");

      const { data: matches } = await supabase
        .from("competition_matches")
        .select(`
          id, match_number, group_id, phase_id, status,
          competition_match_entries(id, side, team_id)
        `)
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("match_number");

      return { phases, groups: dbGroups, drawLots: drawLots ?? [], matches: matches ?? [] };
    },
  });

  // Initialize state from existing data
  if (!initialized && !loadingTeams && !loadingExisting) {
    if (existingData && existingData.groups.length > 0) {
      const drafts: GroupDraft[] = existingData.groups.map((g) => {
        const teamIds = existingData.drawLots
          .filter((dl) => dl.group_id === g.id)
          .map((dl) => dl.team_id);

        const groupMatches = existingData.matches
          .filter((m: any) => m.group_id === g.id)
          .map((m: any) => {
            const entries = m.competition_match_entries ?? [];
            const home = entries.find((e: any) => e.side === "home");
            const away = entries.find((e: any) => e.side === "away");
            return {
              id: m.id,
              homeTeamId: home?.team_id ?? null,
              awayTeamId: away?.team_id ?? null,
              matchNumber: m.match_number ?? 0,
              dbMatchId: m.id,
            } as MatchSlot;
          });

        return {
          id: g.id,
          name: g.name,
          teamIds,
          matches: groupMatches,
          dbPhaseId: g.phase_id,
          dbGroupId: g.id,
        };
      });
      setGroups(drafts);
      setIsEditMode(false);
    }
    setInitialized(true);
  }

  // ── Derived ───────────────────────────────────────────────
  const assignedTeamIds = useMemo(() => {
    const set = new Set<string>();
    for (const g of groups) {
      g.teamIds.forEach((id) => set.add(id));
      g.matches.forEach((m) => {
        if (m.homeTeamId) set.add(m.homeTeamId);
        if (m.awayTeamId) set.add(m.awayTeamId);
      });
    }
    return set;
  }, [groups]);

  const availableTeams = useMemo(() => {
    return teams.filter((t) => {
      if (assignedTeamIds.has(t.id)) return false;
      if (search) {
        const s = search.toLowerCase();
        return t.name.toLowerCase().includes(s) || t.institution.toLowerCase().includes(s);
      }
      return true;
    });
  }, [teams, assignedTeamIds, search]);

  const getTeam = useCallback((id: string) => teams.find((t) => t.id === id) ?? null, [teams]);

  // ── Drag handlers ─────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeStr = active.id as string;
    const overStr = over.id as string;

    // Extract team id
    const teamId = activeStr.startsWith("team-") ? activeStr.replace("team-", "") : null;
    if (!teamId) return;

    // Dropping into a match slot
    if (overStr.startsWith("slot-")) {
      const parts = overStr.split("-");
      const slotId = parts[1];
      const side = parts[2] as "home" | "away";

      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          matches: g.matches.map((m) => {
            if (m.id !== slotId) return m;
            return side === "home"
              ? { ...m, homeTeamId: teamId }
              : { ...m, awayTeamId: teamId };
          }),
        }))
      );
      return;
    }

    // Dropping into a group
    if (overStr.startsWith("group-")) {
      const groupId = overStr.replace("group-", "");
      setGroups((prev) => {
        // Remove from any other group first
        const cleaned = prev.map((g) => ({
          ...g,
          teamIds: g.teamIds.filter((id) => id !== teamId),
        }));
        return cleaned.map((g) =>
          g.id === groupId && !g.teamIds.includes(teamId)
            ? { ...g, teamIds: [...g.teamIds, teamId] }
            : g
        );
      });
    }
  };

  // ── Group CRUD ────────────────────────────────────────────
  const addGroup = () => {
    const idx = groups.length;
    setGroups((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}`,
        name: `Grupo ${String.fromCharCode(65 + idx)}`,
        teamIds: [],
        matches: [],
      },
    ]);
  };

  const removeGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const renameGroup = (groupId: string, name: string) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)));
  };

  const removeTeamFromGroup = (groupId: string, teamId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              teamIds: g.teamIds.filter((id) => id !== teamId),
              matches: g.matches.map((m) => ({
                ...m,
                homeTeamId: m.homeTeamId === teamId ? null : m.homeTeamId,
                awayTeamId: m.awayTeamId === teamId ? null : m.awayTeamId,
              })),
            }
          : g
      )
    );
  };

  // ── Match slot CRUD ───────────────────────────────────────
  const addMatchSlot = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              matches: [
                ...g.matches,
                {
                  id: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  homeTeamId: null,
                  awayTeamId: null,
                  matchNumber: g.matches.length + 1,
                },
              ],
            }
          : g
      )
    );
  };

  const removeMatchSlot = (groupId: string, slotId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, matches: g.matches.filter((m) => m.id !== slotId) } : g
      )
    );
  };

  const removeTeamFromSlot = (groupId: string, slotId: string, side: "home" | "away") => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              matches: g.matches.map((m) =>
                m.id === slotId
                  ? { ...m, [side === "home" ? "homeTeamId" : "awayTeamId"]: null }
                  : m
              ),
            }
          : g
      )
    );
  };

  // ── Save to DB ────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      let matchNum = 1;

      for (const g of groups) {
        let phaseId = g.dbPhaseId;
        let groupId = g.dbGroupId;

        // Create phase if needed
        if (!phaseId) {
          const { data: phase, error } = await supabase
            .from("competition_phases")
            .insert({
              event_id: eventId,
              sport_event_id: sportEventId,
              name: "Fase de Grupos",
              phase_type: "group",
              sort_order: 1,
            })
            .select("id")
            .single();
          if (error) throw error;
          phaseId = phase.id;
        }

        // Create group if needed
        if (!groupId) {
          const { data: grp, error } = await supabase
            .from("competition_groups")
            .insert({
              event_id: eventId,
              phase_id: phaseId,
              name: g.name,
              sort_order: groups.indexOf(g) + 1,
            })
            .select("id")
            .single();
          if (error) throw error;
          groupId = grp.id;
        }

        // Save draw lots (team allocations)
        await supabase.from("group_draw_lots").delete().eq("group_id", groupId);
        if (g.teamIds.length > 0) {
          const lots = g.teamIds.map((tid, idx) => ({
            group_id: groupId!,
            team_id: tid,
            seed: idx + 1,
          }));
          const { error } = await supabase.from("group_draw_lots").insert(lots);
          if (error) throw error;
        }

        // Save matches
        for (const slot of g.matches) {
          if (!slot.homeTeamId && !slot.awayTeamId) continue;

          if (slot.dbMatchId) {
            // Update existing entries
            const { data: entries } = await supabase
              .from("competition_match_entries")
              .select("id, side")
              .eq("match_id", slot.dbMatchId);

            for (const entry of entries ?? []) {
              const teamId = entry.side === "home" ? slot.homeTeamId : slot.awayTeamId;
              await supabase
                .from("competition_match_entries")
                .update({ team_id: teamId })
                .eq("id", entry.id);
            }
          } else {
            // Create match
            const { data: match, error: mErr } = await supabase
              .from("competition_matches")
              .insert({
                event_id: eventId,
                sport_event_id: sportEventId,
                phase_id: phaseId!,
                group_id: groupId!,
                match_number: matchNum++,
                status: "scheduled",
              })
              .select("id")
              .single();
            if (mErr) throw mErr;

            // Create entries
            const entries = [];
            if (slot.homeTeamId) {
              entries.push({ match_id: match.id, team_id: slot.homeTeamId, side: "home" });
            }
            if (slot.awayTeamId) {
              entries.push({ match_id: match.id, team_id: slot.awayTeamId, side: "away" });
            }
            if (entries.length > 0) {
              const { error: eErr } = await supabase.from("competition_match_entries").insert(entries);
              if (eErr) throw eErr;
            }
          }
        }
      }

      // Mark disputes_updated_at on all phases for this sport_event
      const { data: allPhases } = await supabase
        .from("competition_phases")
        .select("id")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId);
      if (allPhases && allPhases.length > 0) {
        for (const ph of allPhases) {
          await supabase
            .from("competition_phases")
            .update({ disputes_updated_at: new Date().toISOString() })
            .eq("id", ph.id);
        }
      }

      // Audit
      await supabase.from("audit_events").insert({
        table_name: "competition_matches",
        record_id: sportEventId,
        action: "dispute_builder_save",
        payload: { groups_count: groups.length, by: user?.id },
        created_by: user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Disputas salvas com sucesso!");
      qc.invalidateQueries({ queryKey: ["dispute-builder-existing"] });
      qc.invalidateQueries({ queryKey: ["central-matches"] });
      qc.invalidateQueries({ queryKey: ["competition-summary"] });
      qc.invalidateQueries({ queryKey: ["dispute-publish-status"] });
      setIsEditMode(false);
      onChanged();
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  // ── Active drag overlay ───────────────────────────────────
  const activeDragTeam = activeId?.startsWith("team-")
    ? getTeam(activeId.replace("team-", ""))
    : null;

  // ── Loading ───────────────────────────────────────────────
  if (loadingTeams || loadingExisting) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Nenhuma equipe ativa para esta prova. Sincronize equipes no passo "Participantes" antes de montar disputas.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Swords className="h-5 w-5" />
          Montador de Disputas
        </h3>
        <div className="flex gap-2">
          {!isEditMode ? (
            <Button size="sm" variant="outline" onClick={() => setIsEditMode(true)}>
              <Edit3 className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={addGroup}>
                <FolderPlus className="h-3.5 w-3.5 mr-1" /> Novo Grupo
              </Button>
              <Button
                size="sm"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || groups.length === 0}
              >
                {saveMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                Salvar Disputas
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Publish control */}
      <DisputePublishControl
        eventId={eventId}
        sportEventId={sportEventId}
        onPublished={onChanged}
      />

      {!isEditMode && groups.length === 0 && (
        <Alert>
          <AlertDescription>
            Nenhuma disputa montada. Clique em "Editar" para começar a criar grupos e confrontos manualmente.
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
            {/* ── Left: Team Pool ──────────────────────────── */}
            <div className="w-56 shrink-0">
              <Card className="sticky top-4">
                <CardHeader className="py-3 px-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Banco ({availableTeams.length})
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
                    items={availableTeams.map((t) => `team-${t.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                      {availableTeams.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-4">
                          {teams.length === assignedTeamIds.size
                            ? "Todas as equipes alocadas ✓"
                            : "Nenhuma equipe encontrada"}
                        </p>
                      ) : (
                        availableTeams.map((t) => (
                          <DraggableTeam key={t.id} team={t} isDragging={activeId === `team-${t.id}`} />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            </div>

            {/* ── Right: Groups & Matches ──────────────────── */}
            <div className="flex-1 min-w-0 space-y-4">
              {groups.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderPlus className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Nenhum grupo criado. Comece adicionando um grupo.
                  </p>
                  <Button variant="outline" onClick={addGroup}>
                    <Plus className="h-4 w-4 mr-1" /> Criar Primeiro Grupo
                  </Button>
                </div>
              )}

              {groups.map((g) => (
                <Card key={g.id}>
                  <CardHeader className="py-3 px-4 flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Input
                        value={g.name}
                        onChange={(e) => renameGroup(g.id, e.target.value)}
                        className="h-7 w-40 text-sm font-semibold"
                      />
                      <Badge variant="secondary" className="text-[10px]">
                        {g.teamIds.length} equipe(s)
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addMatchSlot(g.id)}
                        title="Adicionar confronto"
                      >
                        <Plus className="h-3.5 w-3.5 mr-0.5" />
                        <Swords className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeGroup(g.id)}
                        className="text-destructive hover:text-destructive"
                        title="Remover grupo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Teams in group (drop zone) */}
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                        Equipes do grupo
                      </p>
                      <GroupDropZone groupId={g.id}>
                        {g.teamIds.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground text-center py-3">
                            Arraste equipes aqui
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {g.teamIds.map((tid) => {
                              const team = getTeam(tid);
                              if (!team) return null;
                              return (
                                <span
                                  key={tid}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-medium"
                                >
                                  {team.name}
                                  <button
                                    onClick={() => removeTeamFromGroup(g.id, tid)}
                                    className="hover:text-destructive"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </GroupDropZone>
                    </div>

                    {/* Match slots */}
                    {g.matches.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                          Confrontos
                        </p>
                        <div className="space-y-2">
                          {g.matches.map((slot, idx) => (
                            <div key={slot.id} className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">
                                {idx + 1}.
                              </span>
                              <MatchSlotDrop
                                slotId={slot.id}
                                side="home"
                                team={slot.homeTeamId ? getTeam(slot.homeTeamId) : null}
                                onRemove={() => removeTeamFromSlot(g.id, slot.id, "home")}
                              />
                              <span className="text-xs font-bold text-muted-foreground shrink-0">VS</span>
                              <MatchSlotDrop
                                slotId={slot.id}
                                side="away"
                                team={slot.awayTeamId ? getTeam(slot.awayTeamId) : null}
                                onRemove={() => removeTeamFromSlot(g.id, slot.id, "away")}
                              />
                              <button
                                onClick={() => removeMatchSlot(g.id, slot.id)}
                                className="text-muted-foreground hover:text-destructive shrink-0"
                                title="Remover confronto"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeDragTeam && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card shadow-lg">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">{activeDragTeam.name}</p>
                  <p className="text-[10px] text-muted-foreground">{activeDragTeam.institution}</p>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* View mode */}
      {!isEditMode && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">{g.name}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {g.teamIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {g.teamIds.map((tid) => {
                      const team = getTeam(tid);
                      return team ? (
                        <Badge key={tid} variant="outline" className="text-[10px]">
                          {team.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
                {g.matches.length > 0 && (
                  <div className="space-y-1">
                    {g.matches.map((slot, idx) => (
                      <div key={slot.id} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-5 text-right">{idx + 1}.</span>
                        <span className="font-medium">
                          {slot.homeTeamId ? getTeam(slot.homeTeamId)?.name ?? "?" : "TBD"}
                        </span>
                        <span className="text-muted-foreground">vs</span>
                        <span className="font-medium">
                          {slot.awayTeamId ? getTeam(slot.awayTeamId)?.name ?? "?" : "TBD"}
                        </span>
                      </div>
                    ))}
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
