import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";
import CombatResultForm, { type CombatResultPayload } from "@/components/admin/CombatResultForm";
import { isCombatSport } from "@/config/combatSports";

interface MatchEntry {
  id: string;
  side: string;
  team_id: string | null;
  participant_sport_event_id: string | null;
  teams: { name: string } | null;
  participant_sport_events: {
    participants: { people: { full_name: string } } | null;
  } | null;
}

interface MatchForResult {
  id: string;
  match_number: number | null;
  competition_match_entries: MatchEntry[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchForResult | null;
  eventId: string;
  isCollective: boolean;
  sportEventId?: string;
}

interface EntryResult {
  match_entry_id: string;
  outcome: string;
  score: string;
  time_ms: string;
  distance_cm: string;
  points: string;
  position: string;
}

function getEntryLabel(entry: MatchEntry): string {
  if (entry.teams?.name) return entry.teams.name;
  const pse = entry.participant_sport_events as any;
  return pse?.participants?.people?.full_name ?? "—";
}

export default function LaunchResultDialog({ open, onOpenChange, match, eventId, isCollective, sportEventId }: Props) {
  const qc = useQueryClient();
  const entries = match?.competition_match_entries ?? [];

  // Detect combat sport
  const { data: sportSlug } = useQuery({
    queryKey: ["sport-slug-for-match", sportEventId],
    queryFn: async () => {
      if (!sportEventId) return null;
      const { data, error } = await supabase
        .from("sport_events")
        .select("sports(slug)")
        .eq("id", sportEventId)
        .single();
      if (error) return null;
      return (data as any)?.sports?.slug ?? null;
    },
    enabled: !!sportEventId,
  });

  const isCombat = isCombatSport(sportSlug);
  const [results, setResults] = useState<Record<string, EntryResult>>({});

  const initResults = () => {
    const init: Record<string, EntryResult> = {};
    for (const e of entries) {
      init[e.id] = {
        match_entry_id: e.id,
        outcome: "",
        score: "",
        time_ms: "",
        distance_cm: "",
        points: "",
        position: "",
      };
    }
    setResults(init);
  };

  const updateResult = (entryId: string, field: keyof EntryResult, value: string) => {
    setResults((prev) => ({
      ...prev,
      [entryId]: { ...prev[entryId], [field]: value },
    }));
  };

  const launchMut = useMutation({
    mutationFn: async () => {
      if (!match) throw new Error("Partida não selecionada");
      const payload = {
        entries: Object.values(results).map((r) => ({
          match_entry_id: r.match_entry_id,
          outcome: r.outcome || null,
          score: r.score || null,
          time_ms: r.time_ms ? parseInt(r.time_ms) : null,
          distance_cm: r.distance_cm ? parseInt(r.distance_cm) : null,
          points: r.points ? parseFloat(r.points) : null,
          position: r.position ? parseInt(r.position) : null,
        })),
      };
      const { data, error } = await supabase.rpc("rpc_launch_match_result", {
        p_event_id: eventId,
        p_match_id: match.id,
        p_payload: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Resultado lançado com sucesso!" });
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["central-results"] });
      qc.invalidateQueries({ queryKey: ["central-matches"] });
      qc.invalidateQueries({ queryKey: ["competition-summary"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Combat-specific mutation
  const combatMut = useMutation({
    mutationFn: async (payload: CombatResultPayload) => {
      if (!match) throw new Error("Partida não selecionada");
      const upserts = entries.map((entry) => ({
        match_id: match.id,
        match_entry_id: entry.id,
        outcome: entry.id === payload.winner_entry_id ? "win" : "loss",
        combat_detail: payload.combat_detail,
        result_status: "resultado_lancado",
        recorded_by: (await supabase.auth.getUser()).data.user?.id,
        recorded_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("competition_match_results").upsert(upserts as any, { onConflict: "match_entry_id" });
      if (error) throw error;
      // Auto-finish
      await supabase.from("competition_matches").update({ status: "finished" }).eq("id", match.id);
    },
    onSuccess: () => {
      toast({ title: "Resultado de combate lançado!" });
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["central-results"] });
      qc.invalidateQueries({ queryKey: ["central-matches"] });
      qc.invalidateQueries({ queryKey: ["competition-summary"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) initResults();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCombat ? "Resultado de Combate" : "Lançar Resultado"} — Partida #{match?.match_number ?? "?"}
          </DialogTitle>
        </DialogHeader>

        {isCombat ? (
          <CombatResultForm
            entries={entries.map((e) => ({ id: e.id, label: getEntryLabel(e) }))}
            modality={sportSlug?.toUpperCase() ?? "COMBAT"}
            onSubmit={(payload) => combatMut.mutate(payload)}
            isPending={combatMut.isPending}
          />
        ) : (
          <>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {entries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-3 space-y-2">
                  <p className="font-medium text-sm">{getEntryLabel(entry)} ({entry.side})</p>

                  {isCollective ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Resultado</Label>
                        <Select
                          value={results[entry.id]?.outcome ?? ""}
                          onValueChange={(v) => updateResult(entry.id, "outcome", v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="win">Vitória</SelectItem>
                            <SelectItem value="loss">Derrota</SelectItem>
                            <SelectItem value="draw">Empate</SelectItem>
                            <SelectItem value="wo">W.O.</SelectItem>
                            <SelectItem value="dsq">Desclassificação</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Placar</Label>
                        <Input
                          className="h-8 text-xs"
                          placeholder="ex: 2x1"
                          value={results[entry.id]?.score ?? ""}
                          onChange={(e) => updateResult(entry.id, "score", e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Tempo (ms)</Label>
                        <Input
                          className="h-8 text-xs" type="number"
                          value={results[entry.id]?.time_ms ?? ""}
                          onChange={(e) => updateResult(entry.id, "time_ms", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Distância (cm)</Label>
                        <Input
                          className="h-8 text-xs" type="number"
                          value={results[entry.id]?.distance_cm ?? ""}
                          onChange={(e) => updateResult(entry.id, "distance_cm", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Pontos</Label>
                        <Input
                          className="h-8 text-xs" type="number"
                          value={results[entry.id]?.points ?? ""}
                          onChange={(e) => updateResult(entry.id, "points", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Posição</Label>
                        <Input
                          className="h-8 text-xs" type="number" min={1}
                          value={results[entry.id]?.position ?? ""}
                          onChange={(e) => updateResult(entry.id, "position", e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button onClick={() => launchMut.mutate()} disabled={launchMut.isPending}>
                <CheckCircle className="h-4 w-4 mr-1" />
                {launchMut.isPending ? "Salvando..." : "Lançar Resultado"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
