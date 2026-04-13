import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Check, ChevronRight, Info, Layers, Loader2, Plus,
  RefreshCw, Shuffle, Trash2, ArrowRight, ArrowLeft, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  eventId: string;
  sportEventId: string;
  onChanged: () => void;
  onAdvanceStep?: () => void;
}

interface TeamItem {
  id: string;
  name: string;
  institution: string;
  memberCount: number;
}

interface GroupItem {
  id: string;
  name: string;
  sortOrder: number;
}

// ── Helpers ─────────────────────────────────────────────────
function suggestGroupCount(teamCount: number): { groups: number; description: string; allowKnockout: boolean } {
  if (teamCount <= 3) return { groups: 1, description: `1 grupo único com ${teamCount} equipes — todos contra todos (round-robin).`, allowKnockout: true };
  if (teamCount <= 6) return { groups: 1, description: `1 grupo único com ${teamCount} equipes — todos contra todos.`, allowKnockout: false };
  if (teamCount <= 10) {
    const g = 2;
    const perGroup = Math.ceil(teamCount / g);
    return { groups: g, description: `${g} grupos com ~${perGroup} equipes cada + eliminatórias entre os melhores.`, allowKnockout: false };
  }
  if (teamCount <= 16) {
    const g = teamCount <= 12 ? 3 : 4;
    const perGroup = Math.ceil(teamCount / g);
    return { groups: g, description: `${g} grupos com ~${perGroup} equipes cada + eliminatórias entre os melhores.`, allowKnockout: false };
  }
  const g = Math.min(Math.ceil(teamCount / 4), 8);
  const perGroup = Math.ceil(teamCount / g);
  return { groups: g, description: `${g} grupos com ~${perGroup} equipes cada + eliminatórias entre os melhores.`, allowKnockout: false };
}

function roundRobinCount(n: number) {
  return n >= 2 ? (n * (n - 1)) / 2 : 0;
}

// ── Sub-step indicator ──────────────────────────────────────
function SubStepIndicator({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {labels.map((label, idx) => {
        const step = idx + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex items-center gap-2">
            {idx > 0 && <div className={cn("h-px w-6", done ? "bg-primary/50" : "bg-border")} />}
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold border-2",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-muted-foreground/30 text-muted-foreground/50"
                )}
              >
                {done ? <Check className="h-3 w-3" /> : step}
              </span>
              <span className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
export default function CentralStructureCollectiveTab({ eventId, sportEventId, onChanged, onAdvanceStep }: Props) {
  const qc = useQueryClient();
  const [subStep, setSubStep] = useState<1 | 2 | 3>(1);
  const [groupCount, setGroupCount] = useState(2);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [allocation, setAllocation] = useState<Record<string, string[]>>({}); // groupId -> teamId[]

  // ── Data queries ──────────────────────────────────────────
  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["structure-teams", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, delegation_id, delegations(institution_id, institutions(name)), team_members(id, is_active)")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        institution: t.delegations?.institutions?.name ?? "—",
        memberCount: (t.team_members ?? []).filter((m: any) => m.is_active).length,
      })) as TeamItem[];
    },
  });

  const { data: existingPhases = [], isLoading: loadingPhases } = useQuery({
    queryKey: ["structure-phases", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select("id, name, sort_order")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: existingGroups = [] } = useQuery({
    queryKey: ["structure-groups", eventId, sportEventId],
    queryFn: async () => {
      if (existingPhases.length === 0) return [];
      const phaseIds = existingPhases.map((p) => p.id);
      const { data, error } = await supabase
        .from("competition_groups")
        .select("id, name, sort_order, phase_id")
        .in("phase_id", phaseIds)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: existingPhases.length > 0,
  });

  const { data: existingDrawLots = [] } = useQuery({
    queryKey: ["structure-draw-lots", existingGroups.map((g) => g.id).join(",")],
    queryFn: async () => {
      if (existingGroups.length === 0) return [];
      const groupIds = existingGroups.map((g) => g.id);
      const { data, error } = await supabase
        .from("group_draw_lots")
        .select("group_id, team_id, seed")
        .in("group_id", groupIds)
        .order("seed");
      if (error) throw error;
      return data ?? [];
    },
    enabled: existingGroups.length > 0,
  });

  // Detect if structure already exists
  const hasExistingStructure = existingPhases.length > 0 && existingGroups.length > 0;
  const hasExistingAllocations = existingDrawLots.length > 0;

  // Auto-detect sub-step based on existing data
  const initialSubStep = useMemo(() => {
    if (hasExistingAllocations) return 3 as const;
    if (hasExistingStructure) return 2 as const;
    return 1 as const;
  }, [hasExistingStructure, hasExistingAllocations]);

  // Set initial substep once data loads
  const [initialized, setInitialized] = useState(false);
  if (!initialized && !loadingPhases && !loadingTeams) {
    setSubStep(initialSubStep);
    if (hasExistingAllocations) {
      // Rebuild allocation state from existing draw lots
      const alloc: Record<string, string[]> = {};
      for (const g of existingGroups) alloc[g.id] = [];
      for (const dl of existingDrawLots) {
        if (alloc[dl.group_id]) alloc[dl.group_id].push(dl.team_id);
      }
      setAllocation(alloc);
    } else if (hasExistingStructure) {
      const alloc: Record<string, string[]> = {};
      for (const g of existingGroups) alloc[g.id] = [];
      setAllocation(alloc);
    }
    setInitialized(true);
  }

  const suggestion = useMemo(() => suggestGroupCount(teams.length), [teams.length]);

  // ── Sub-step 1: Create structure ──────────────────────────
  const createStructureMut = useMutation({
    mutationFn: async () => {
      // Create phase
      const { data: phase, error: phaseErr } = await supabase
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
      if (phaseErr) throw phaseErr;

      // Create groups
      const groups: { id: string; name: string }[] = [];
      for (let i = 0; i < groupCount; i++) {
        const { data: g, error: gErr } = await supabase
          .from("competition_groups")
          .insert({
            event_id: eventId,
            phase_id: phase.id,
            name: `Grupo ${String.fromCharCode(65 + i)}`,
            sort_order: i + 1,
          })
          .select("id, name")
          .single();
        if (gErr) throw gErr;
        groups.push(g);
      }
      return groups;
    },
    onSuccess: (groups) => {
      toast({ title: `Estrutura criada: ${groups.length} grupo(s)` });
      // Initialize allocation with auto-distribution
      const alloc: Record<string, string[]> = {};
      for (const g of groups) alloc[g.id] = [];
      // Distribute teams round-robin
      const shuffled = [...teams].sort(() => Math.random() - 0.5);
      shuffled.forEach((t, idx) => {
        const groupIdx = idx % groups.length;
        alloc[groups[groupIdx].id].push(t.id);
      });
      setAllocation(alloc);
      qc.invalidateQueries({ queryKey: ["structure-phases"] });
      qc.invalidateQueries({ queryKey: ["structure-groups"] });
      onChanged();
      setSubStep(2);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // ── Sub-step 2: Save allocations ──────────────────────────
  const saveAllocationMut = useMutation({
    mutationFn: async () => {
      const groupIds = Object.keys(allocation);
      // Delete existing draw lots for these groups
      for (const gid of groupIds) {
        const { error } = await supabase
          .from("group_draw_lots")
          .delete()
          .eq("group_id", gid);
        if (error) throw error;
      }
      // Insert new
      const rows: any[] = [];
      for (const [gid, teamIds] of Object.entries(allocation)) {
        teamIds.forEach((tid, idx) => {
          rows.push({ group_id: gid, team_id: tid, seed: idx + 1 });
        });
      }
      if (rows.length > 0) {
        const { error } = await supabase.from("group_draw_lots").insert(rows);
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (count) => {
      toast({ title: `${count} equipe(s) alocada(s) nos grupos` });
      qc.invalidateQueries({ queryKey: ["structure-draw-lots"] });
      setSubStep(3);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar alocação", description: e.message, variant: "destructive" }),
  });

  // ── Sub-step 3: Generate matches ──────────────────────────
  const generateMatchesMut = useMutation({
    mutationFn: async () => {
      const phaseId = existingPhases[0]?.id;
      if (!phaseId) throw new Error("Nenhuma fase encontrada");
      const { data, error } = await supabase.rpc("rpc_generate_matches_collective", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId,
        p_phase_id: phaseId,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data) => {
      const msg = data.teams_skipped > 0
        ? `${data.matches_created} partida(s) gerada(s). ${data.teams_skipped} equipe(s) pulada(s).`
        : `${data.matches_created} partida(s) gerada(s).`;
      toast({ title: msg });
      qc.invalidateQueries({ queryKey: ["central-matches"] });
      qc.invalidateQueries({ queryKey: ["competition-summary"] });
      onChanged();
    },
    onError: (e: any) => toast({ title: "Erro ao gerar partidas", description: e.message, variant: "destructive" }),
  });

  // ── Allocation helpers ────────────────────────────────────
  const allocatedTeamIds = useMemo(() => {
    return new Set(Object.values(allocation).flat());
  }, [allocation]);

  const unallocatedTeams = useMemo(() => {
    return teams.filter((t) => !allocatedTeamIds.has(t.id));
  }, [teams, allocatedTeamIds]);

  const allAllocated = unallocatedTeams.length === 0 && teams.length > 0;

  const moveTeamToGroup = useCallback((teamId: string, targetGroupId: string) => {
    setAllocation((prev) => {
      const next = { ...prev };
      // Remove from current group
      for (const gid of Object.keys(next)) {
        next[gid] = next[gid].filter((t) => t !== teamId);
      }
      // Add to target
      next[targetGroupId] = [...(next[targetGroupId] ?? []), teamId];
      return next;
    });
  }, []);

  const removeFromGroup = useCallback((teamId: string) => {
    setAllocation((prev) => {
      const next = { ...prev };
      for (const gid of Object.keys(next)) {
        next[gid] = next[gid].filter((t) => t !== teamId);
      }
      return next;
    });
  }, []);

  const shuffleTeams = useCallback(() => {
    const groupIds = Object.keys(allocation);
    if (groupIds.length === 0) return;
    const alloc: Record<string, string[]> = {};
    for (const gid of groupIds) alloc[gid] = [];
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    shuffled.forEach((t, idx) => {
      alloc[groupIds[idx % groupIds.length]].push(t.id);
    });
    setAllocation(alloc);
  }, [allocation, teams]);

  const activeGroups: GroupItem[] = useMemo(() => {
    return existingGroups.map((g) => ({ id: g.id, name: g.name, sortOrder: g.sort_order }));
  }, [existingGroups]);

  const getTeamById = useCallback((id: string) => teams.find((t) => t.id === id), [teams]);

  // ── Loading / empty states ────────────────────────────────
  if (loadingTeams || loadingPhases) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Nenhuma equipe confirmada para esta prova. Verifique a Pré-validação ou sincronize equipes no passo anterior.
        </AlertDescription>
      </Alert>
    );
  }

  // ── Reset dialog ──────────────────────────────────────────
  const handleReset = async () => {
    // Delete draw lots, groups, phases for this sport_event
    for (const g of existingGroups) {
      await supabase.from("group_draw_lots").delete().eq("group_id", g.id);
    }
    for (const g of existingGroups) {
      await supabase.from("competition_groups").delete().eq("id", g.id);
    }
    for (const p of existingPhases) {
      await supabase.from("competition_phases").delete().eq("id", p.id);
    }
    setAllocation({});
    setShowResetDialog(false);
    setSubStep(1);
    setInitialized(false);
    qc.invalidateQueries({ queryKey: ["structure-phases"] });
    qc.invalidateQueries({ queryKey: ["structure-groups"] });
    qc.invalidateQueries({ queryKey: ["structure-draw-lots"] });
    onChanged();
    toast({ title: "Estrutura removida" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Estrutura da Competição</h3>
        {hasExistingStructure && (
          <Button variant="outline" size="sm" onClick={() => setShowResetDialog(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Recriar estrutura
          </Button>
        )}
      </div>

      <SubStepIndicator
        current={subStep}
        labels={["Definir estrutura", "Alocar equipes", "Gerar partidas"]}
      />

      {/* ─── SUB-STEP 1: Define structure ─────────────────── */}
      {subStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Definir Estrutura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                {teams.length} equipe(s) disponível(is)
              </Badge>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{suggestion.description}</AlertDescription>
            </Alert>

            {suggestion.allowKnockout && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Alternativa: você pode pular a fase de grupos e usar mata-mata direto na aba "Chaves" do passo Confrontos.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Número de grupos:</label>
              <Input
                type="number"
                min={1}
                max={Math.max(teams.length, 1)}
                value={groupCount}
                onChange={(e) => setGroupCount(Math.max(1, Math.min(teams.length, Number(e.target.value))))}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">
                (~{Math.ceil(teams.length / groupCount)} equipes por grupo)
              </span>
            </div>

            <Button onClick={() => createStructureMut.mutate()} disabled={createStructureMut.isPending}>
              {createStructureMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Layers className="h-4 w-4 mr-1" />
              )}
              Confirmar estrutura
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── SUB-STEP 2: Allocate teams ───────────────────── */}
      {subStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={allAllocated ? "default" : "secondary"}>
                {allocatedTeamIds.size}/{teams.length} equipes alocadas
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={shuffleTeams}>
                <Shuffle className="h-4 w-4 mr-1" /> Sortear
              </Button>
              <Button
                size="sm"
                onClick={() => saveAllocationMut.mutate()}
                disabled={!allAllocated || saveAllocationMut.isPending}
              >
                {saveAllocationMut.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Confirmar alocação
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
            {/* Unallocated */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Disponíveis ({unallocatedTeams.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 max-h-[400px] overflow-y-auto">
                {unallocatedTeams.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Todas alocadas ✅</p>
                ) : (
                  unallocatedTeams.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2 border rounded text-sm">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.institution} · {t.memberCount} membros</p>
                      </div>
                      <div className="flex gap-1">
                        {activeGroups.map((g) => (
                          <Button
                            key={g.id}
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title={`Mover para ${g.name}`}
                            onClick={() => moveTeamToGroup(t.id, g.id)}
                          >
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Groups */}
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {activeGroups.map((g) => {
                const groupTeamIds = allocation[g.id] ?? [];
                const perGroup = Math.ceil(teams.length / activeGroups.length);
                return (
                  <Card key={g.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        {g.name}
                        <Badge variant="outline" className="text-xs">
                          {groupTeamIds.length}/{perGroup}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 min-h-[60px]">
                      {groupTeamIds.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Vazio</p>
                      ) : (
                        groupTeamIds.map((tid) => {
                          const t = getTeamById(tid);
                          if (!t) return null;
                          return (
                            <div key={tid} className="flex items-center justify-between p-1.5 border rounded text-xs">
                              <span className="font-medium">{t.name}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeFromGroup(tid)}
                                title="Remover do grupo"
                              >
                                <ArrowLeft className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── SUB-STEP 3: Review & Generate ────────────────── */}
      {subStep === 3 && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeGroups.map((g) => {
              const groupTeamIds = allocation[g.id] ?? [];
              const matchCount = roundRobinCount(groupTeamIds.length);
              return (
                <Card key={g.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{g.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {groupTeamIds.map((tid) => {
                      const t = getTeamById(tid);
                      return (
                        <p key={tid} className="text-sm">
                          {t?.name ?? "—"}{" "}
                          <span className="text-xs text-muted-foreground">({t?.institution})</span>
                        </p>
                      );
                    })}
                    <Badge variant="outline" className="mt-2">
                      {matchCount} partida(s) round-robin
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => generateMatchesMut.mutate()}
              disabled={generateMatchesMut.isPending || generateMatchesMut.isSuccess}
            >
              {generateMatchesMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : generateMatchesMut.isSuccess ? (
                <Check className="h-4 w-4 mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              {generateMatchesMut.isSuccess ? "Partidas geradas ✅" : "Gerar partidas"}
            </Button>

            {generateMatchesMut.isSuccess && onAdvanceStep && (
              <Button variant="outline" onClick={onAdvanceStep}>
                Avançar para Agenda <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={() => setSubStep(2)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para alocação
          </Button>
        </div>
      )}

      {/* Reset dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recriar estrutura?</DialogTitle>
            <DialogDescription>
              Já existe uma estrutura para esta prova. Ao recriar, fases, grupos e alocações serão removidos.
              Partidas já geradas com resultados NÃO serão afetadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReset}>Recriar do zero</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
