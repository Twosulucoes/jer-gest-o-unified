import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Check, ChevronRight, Info, Loader2,
  RefreshCw, Shuffle, Trash2, ArrowRight, AlertTriangle, Users, MoveRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  eventId: string;
  sportEventId: string;
  onChanged: () => void;
  onAdvanceStep?: () => void;
}

interface AthleteItem {
  id: string; // participant_sport_event id
  name: string;
  institution: string;
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
export default function CentralStructureHeatsTab({ eventId, sportEventId, onChanged, onAdvanceStep }: Props) {
  const qc = useQueryClient();
  const [subStep, setSubStep] = useState<1 | 2 | 3>(1);
  const [athletesPerHeat, setAthletesPerHeat] = useState(8);
  const [heatBaseName, setHeatBaseName] = useState("Bateria");
  const [showResetDialog, setShowResetDialog] = useState(false);
  // heatIndex -> athleteId[]
  const [allocation, setAllocation] = useState<string[][]>([]);

  // ── Data queries ──────────────────────────────────────────
  const { data: athletes = [], isLoading: loadingAthletes } = useQuery({
    queryKey: ["heats-athletes", eventId, sportEventId],
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

  const { data: existingPhases = [], isLoading: loadingPhases } = useQuery({
    queryKey: ["heats-phases", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select("id, name, phase_type, sort_order")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const heatsPhase = existingPhases.find((p) => p.phase_type === "heats");

  const { data: existingMatches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["heats-matches", eventId, sportEventId, heatsPhase?.id],
    queryFn: async () => {
      if (!heatsPhase) return [];
      const { data, error } = await supabase
        .from("competition_matches")
        .select("id, match_number, notes")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .eq("phase_id", heatsPhase.id)
        .order("match_number");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!heatsPhase,
  });

  const { data: existingEntries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["heats-entries", existingMatches.map((m) => m.id).join(",")],
    queryFn: async () => {
      if (existingMatches.length === 0) return [];
      const matchIds = existingMatches.map((m) => m.id);
      const { data, error } = await supabase
        .from("competition_match_entries")
        .select("id, match_id, participant_sport_event_id, seed")
        .in("match_id", matchIds)
        .order("seed");
      if (error) throw error;
      return data ?? [];
    },
    enabled: existingMatches.length > 0,
  });

  const hasExistingStructure = !!heatsPhase && existingMatches.length > 0;
  const hasExistingAllocations = existingEntries.length > 0;
  const allQueriesReady = !loadingAthletes && !loadingPhases && !loadingMatches && !loadingEntries;

  // Auto-detect sub-step
  const [initialized, setInitialized] = useState(false);
  if (!initialized && allQueriesReady) {
    if (hasExistingAllocations) {
      setSubStep(3);
      // Rebuild allocation from existing entries
      const matchOrder = existingMatches.map((m) => m.id);
      const alloc: string[][] = matchOrder.map(() => []);
      for (const entry of existingEntries) {
        const idx = matchOrder.indexOf(entry.match_id);
        if (idx >= 0 && entry.participant_sport_event_id) {
          alloc[idx].push(entry.participant_sport_event_id);
        }
      }
      setAllocation(alloc);
    } else if (hasExistingStructure) {
      setSubStep(2);
      setAllocation(existingMatches.map(() => []));
    }
    setInitialized(true);
  }

  // ── Computed values ───────────────────────────────────────
  const totalAthletes = athletes.length;
  const heatCount = useMemo(() => {
    if (totalAthletes === 0 || athletesPerHeat < 2) return 0;
    return Math.ceil(totalAthletes / athletesPerHeat);
  }, [totalAthletes, athletesPerHeat]);

  const lastHeatSize = totalAthletes > 0 ? totalAthletes - (heatCount - 1) * athletesPerHeat : 0;

  const allocatedIds = useMemo(() => new Set(allocation.flat()), [allocation]);
  const unallocated = useMemo(() => athletes.filter((a) => !allocatedIds.has(a.id)), [athletes, allocatedIds]);
  const allAllocated = unallocated.length === 0 && totalAthletes > 0;

  const getAthleteById = useCallback((id: string) => athletes.find((a) => a.id === id), [athletes]);

  // ── Distribution ──────────────────────────────────────────
  const distributeAthletes = useCallback(() => {
    if (heatCount === 0) return;
    const shuffled = [...athletes].sort(() => Math.random() - 0.5);
    const alloc: string[][] = Array.from({ length: heatCount }, () => []);
    shuffled.forEach((a, idx) => {
      alloc[idx % heatCount].push(a.id);
    });
    setAllocation(alloc);
  }, [athletes, heatCount]);

  // ── Mutations ─────────────────────────────────────────────
  const createStructureMut = useMutation({
    mutationFn: async () => {
      // Create heats phase
      const { data: phase, error: phaseErr } = await supabase
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
      if (phaseErr) throw phaseErr;

      // Create matches (one per heat)
      const matches: { id: string }[] = [];
      for (let i = 0; i < heatCount; i++) {
        const { data: m, error: mErr } = await supabase
          .from("competition_matches")
          .insert({
            event_id: eventId,
            sport_event_id: sportEventId,
            phase_id: phase.id,
            match_number: i + 1,
            notes: `${heatBaseName} ${i + 1}`,
            status: "scheduled",
          })
          .select("id")
          .single();
        if (mErr) throw mErr;
        matches.push(m);
      }
      return { phaseId: phase.id, matches };
    },
    onSuccess: ({ matches }) => {
      toast({ title: `${matches.length} bateria(s) criada(s)` });
      // Distribute athletes
      const shuffled = [...athletes].sort(() => Math.random() - 0.5);
      const alloc: string[][] = Array.from({ length: matches.length }, () => []);
      shuffled.forEach((a, idx) => {
        alloc[idx % matches.length].push(a.id);
      });
      setAllocation(alloc);
      qc.invalidateQueries({ queryKey: ["heats-phases"] });
      qc.invalidateQueries({ queryKey: ["heats-matches"] });
      onChanged();
      setSubStep(2);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const saveAllocationMut = useMutation({
    mutationFn: async () => {
      // We need match IDs - refetch if needed
      const matchIds = existingMatches.length > 0
        ? existingMatches.map((m) => m.id)
        : (await (async () => {
            const ph = (await supabase
              .from("competition_phases")
              .select("id")
              .eq("event_id", eventId)
              .eq("sport_event_id", sportEventId)
              .eq("phase_type", "heats")
              .single()).data;
            if (!ph) throw new Error("Fase de baterias não encontrada");
            const { data } = await supabase
              .from("competition_matches")
              .select("id")
              .eq("phase_id", ph.id)
              .order("match_number");
            return (data ?? []).map((m) => m.id);
          })());

      // Delete existing entries for these matches
      for (const mid of matchIds) {
        await supabase.from("competition_match_entries").delete().eq("match_id", mid);
      }

      // Insert new entries
      let totalInserted = 0;
      for (let i = 0; i < allocation.length; i++) {
        const mid = matchIds[i];
        if (!mid) continue;
        const rows = allocation[i].map((pseId, seed) => ({
          match_id: mid,
          participant_sport_event_id: pseId,
          side: "participant",
          seed: seed + 1,
        }));
        if (rows.length > 0) {
          const { error } = await supabase.from("competition_match_entries").insert(rows);
          if (error) throw error;
          totalInserted += rows.length;
        }
      }
      return totalInserted;
    },
    onSuccess: (count) => {
      toast({ title: `${count} atleta(s) alocado(s) nas baterias` });
      qc.invalidateQueries({ queryKey: ["heats-entries"] });
      qc.invalidateQueries({ queryKey: ["competition-summary"] });
      onChanged();
      setSubStep(3);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  // ── Move athlete ──────────────────────────────────────────
  const moveAthlete = useCallback((athleteId: string, targetHeatIdx: number) => {
    setAllocation((prev) => {
      const next = prev.map((h) => h.filter((id) => id !== athleteId));
      if (targetHeatIdx >= 0 && targetHeatIdx < next.length) {
        next[targetHeatIdx] = [...next[targetHeatIdx], athleteId];
      }
      return next;
    });
  }, []);

  const removeFromHeat = useCallback((athleteId: string) => {
    setAllocation((prev) => prev.map((h) => h.filter((id) => id !== athleteId)));
  }, []);

  // ── Reset ─────────────────────────────────────────────────
  const handleReset = async () => {
    // Delete entries, matches, phase
    for (const m of existingMatches) {
      await supabase.from("competition_match_entries").delete().eq("match_id", m.id);
      await supabase.from("competition_matches").delete().eq("id", m.id);
    }
    if (heatsPhase) {
      await supabase.from("competition_phases").delete().eq("id", heatsPhase.id);
    }
    setAllocation([]);
    setShowResetDialog(false);
    setSubStep(1);
    setInitialized(false);
    qc.invalidateQueries({ queryKey: ["heats-phases"] });
    qc.invalidateQueries({ queryKey: ["heats-matches"] });
    qc.invalidateQueries({ queryKey: ["heats-entries"] });
    onChanged();
    toast({ title: "Baterias removidas" });
  };

  // ── Loading / empty states ────────────────────────────────
  if (!allQueriesReady) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  if (totalAthletes === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Nenhum atleta confirmado para esta prova. Verifique a Pré-validação.
        </AlertDescription>
      </Alert>
    );
  }

  if (totalAthletes === 1) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Apenas 1 atleta inscrito. Use a opção Campeão Direto na Pré-validação.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Baterias / Séries</h3>
        {hasExistingStructure && (
          <Button variant="outline" size="sm" onClick={() => setShowResetDialog(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Recriar baterias
          </Button>
        )}
      </div>

      <SubStepIndicator
        current={subStep}
        labels={["Definir baterias", "Revisar alocação", "Confirmar"]}
      />

      {/* ─── SUB-STEP 1: Define heats ────────────────────── */}
      {subStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Definir Baterias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge variant="secondary" className="text-sm">
              <Users className="h-3 w-3 mr-1" />
              {totalAthletes} atleta(s) confirmado(s)
            </Badge>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Atletas por bateria</label>
                <Input
                  type="number"
                  min={2}
                  max={totalAthletes}
                  value={athletesPerHeat}
                  onChange={(e) => setAthletesPerHeat(Math.max(2, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome base</label>
                <Input
                  value={heatBaseName}
                  onChange={(e) => setHeatBaseName(e.target.value || "Bateria")}
                  placeholder="Bateria"
                />
              </div>
            </div>

            {heatCount > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {totalAthletes} atletas → {heatCount} bateria(s) de {athletesPerHeat} atletas
                  {lastHeatSize !== athletesPerHeat && lastHeatSize > 0 && (
                    <> (última bateria com {lastHeatSize} atleta{lastHeatSize > 1 ? "s" : ""})</>
                  )}
                  {lastHeatSize === 1 && (
                    <span className="text-destructive font-medium ml-1">
                      — atenção: bateria com 1 atleta gera classificação direta
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={() => createStructureMut.mutate()}
              disabled={createStructureMut.isPending || heatCount === 0}
            >
              {createStructureMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-1" />
              )}
              Gerar baterias
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── SUB-STEP 2: Review allocation ───────────────── */}
      {subStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={distributeAthletes}>
              <Shuffle className="h-4 w-4 mr-1" /> Sortear novamente
            </Button>
            <Badge variant={allAllocated ? "default" : "secondary"}>
              {allocatedIds.size}/{totalAthletes} alocado(s)
            </Badge>
          </div>

          {/* Unallocated athletes */}
          {unallocated.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-destructive">
                  Não alocados ({unallocated.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {unallocated.map((a) => (
                    <Badge key={a.id} variant="outline" className="text-xs">
                      {a.name}
                      <Select onValueChange={(val) => moveAthlete(a.id, Number(val))}>
                        <SelectTrigger className="h-5 w-5 p-0 ml-1 border-0">
                          <MoveRight className="h-3 w-3" />
                        </SelectTrigger>
                        <SelectContent>
                          {allocation.map((_, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {heatBaseName} {idx + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Heat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allocation.map((heatAthletes, heatIdx) => (
              <Card key={heatIdx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{heatBaseName} {heatIdx + 1}</span>
                    <Badge variant="secondary" className="text-xs">
                      {heatAthletes.length} atleta(s)
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {heatAthletes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Vazia</p>
                  ) : (
                    <div className="space-y-1">
                      {heatAthletes.map((aid, seed) => {
                        const athlete = getAthleteById(aid);
                        return (
                          <div key={aid} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-mono w-5">{seed + 1}.</span>
                              <span className="font-medium">{athlete?.name ?? "—"}</span>
                              <span className="text-xs text-muted-foreground">{athlete?.institution}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Select onValueChange={(val) => {
                                if (val === "remove") removeFromHeat(aid);
                                else moveAthlete(aid, Number(val));
                              }}>
                                <SelectTrigger className="h-6 w-20 text-xs">
                                  <SelectValue placeholder="Mover" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="remove">Remover</SelectItem>
                                  {allocation.map((_, idx) =>
                                    idx !== heatIdx ? (
                                      <SelectItem key={idx} value={String(idx)}>
                                        {heatBaseName} {idx + 1}
                                      </SelectItem>
                                    ) : null
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => saveAllocationMut.mutate()}
              disabled={saveAllocationMut.isPending || !allAllocated}
            >
              {saveAllocationMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Confirmar baterias
            </Button>
          </div>
        </div>
      )}

      {/* ─── SUB-STEP 3: Confirmed ───────────────────────── */}
      {subStep === 3 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Check className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">
                  {allocation.length} bateria(s) criada(s), {allocatedIds.size} atleta(s) distribuído(s)
                </p>
                <p className="text-sm text-muted-foreground">
                  Estrutura salva. Avance para definir a agenda das baterias.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSubStep(2)}>
                Editar alocação
              </Button>
              {onAdvanceStep && (
                <Button onClick={onAdvanceStep}>
                  <ArrowRight className="h-4 w-4 mr-1" /> Avançar para Agenda
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recriar baterias?</DialogTitle>
            <DialogDescription>
              Todas as baterias, alocações e dados vinculados serão removidos. Esta ação não pode ser desfeita.
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
