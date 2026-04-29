
import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Trophy } from "lucide-react";

export interface SetsLauncherProps {
  entries: any[];
  onSave: (payload: any) => void;
  isSaving?: boolean;
  initialData?: any;
  rules?: any;
}

export default function SetsLauncher({ entries, onSave, isSaving, initialData, rules }: SetsLauncherProps) {
  const bestOf = rules?.scoring?.best_of || 3;
  const setsToWin = Math.ceil(bestOf / 2);

  const [sets, setSets] = useState<Array<{ a: string; b: string }>>(() => {
    // Try to load from initialData/entries
    const entryA = entries.find(e => e.side === "home" || e.side === "left");
    const json = entryA?.score?.score_detail?.sets_score_json;
    if (json && Array.isArray(json.sets_a)) {
      return json.sets_a.map((ptsA: any, i: number) => ({
        a: ptsA.toString(),
        b: (json.sets_b?.[i] ?? 0).toString()
      }));
    }
    return [{ a: "", b: "" }];
  });

  const [outcomeOverride, setOutcomeOverride] = useState<string | null>(null);

  const stats = useMemo(() => {
    let wonA = 0;
    let wonB = 0;
    sets.forEach(s => {
      const valA = Number(s.a);
      const valB = Number(s.b);
      if (isNaN(valA) || isNaN(valB)) return;
      if (valA > valB) wonA++;
      else if (valB > valA) wonB++;
    });
    return { wonA, wonB };
  }, [sets]);

  const isFinished = stats.wonA >= setsToWin || stats.wonB >= setsToWin;

  const handleAddSet = () => {
    if (sets.length < bestOf && !isFinished) {
      setSets([...sets, { a: "", b: "" }]);
    }
  };

  const handleRemoveSet = (idx: number) => {
    if (sets.length > 1) {
      setSets(sets.filter((_, i) => i !== idx));
    }
  };

  const updateSet = (idx: number, side: 'a' | 'b', val: string) => {
    const newSets = [...sets];
    newSets[idx][side] = val;
    setSets(newSets);
  };

  const handleSave = () => {
    const entryA = entries.find(e => e.side === "home" || e.side === "left");
    const entryB = entries.find(e => e.side === "away" || e.side === "right");

    if (!entryA || !entryB) return;

    const setsA = sets.map(s => Number(s.a) || 0);
    const setsB = sets.map(s => Number(s.b) || 0);

    const payload = [
      {
        entryId: entryA.id,
        scoreFinal: stats.wonA.toString(),
        outcome: outcomeOverride || (stats.wonA > stats.wonB ? "win" : "loss"),
        scoreDetail: {
          sets_score_json: { sets_a: setsA, sets_b: setsB }
        }
      },
      {
        entryId: entryB.id,
        scoreFinal: stats.wonB.toString(),
        outcome: outcomeOverride || (stats.wonB > stats.wonA ? "win" : "loss"),
        scoreDetail: {
          sets_score_json: { sets_a: setsA, sets_b: setsB }
        }
      }
    ];

    onSave(payload);
  };

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Sets Ganhos</p>
          <p className="text-4xl font-black text-primary">{stats.wonA}</p>
          <p className="text-xs font-bold truncate mt-1">{entries[0]?.team?.name || "Lado A"}</p>
        </div>
        <div className="px-4 text-muted-foreground font-bold">VS</div>
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Sets Ganhos</p>
          <p className="text-4xl font-black text-primary">{stats.wonB}</p>
          <p className="text-xs font-bold truncate mt-1">{entries[1]?.team?.name || "Lado B"}</p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-xs font-bold uppercase text-muted-foreground">Pontuação por Set (Melhor de {bestOf})</Label>
        {sets.map((set, idx) => (
          <div key={idx} className="flex items-center gap-3 bg-card border rounded-xl p-3 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
              {idx + 1}
            </div>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="0"
              className="h-12 text-xl font-bold text-center"
              value={set.a}
              onChange={(e) => updateSet(idx, 'a', e.target.value)}
            />
            <div className="text-muted-foreground">×</div>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="0"
              className="h-12 text-xl font-bold text-center"
              value={set.b}
              onChange={(e) => updateSet(idx, 'b', e.target.value)}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-destructive shrink-0" 
              onClick={() => handleRemoveSet(idx)}
              disabled={sets.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {!isFinished && sets.length < bestOf && (
          <Button variant="outline" className="w-full border-dashed border-2 h-12" onClick={handleAddSet}>
            <Plus className="h-4 w-4 mr-2" /> Próximo Set
          </Button>
        )}
      </div>

      <div className="pt-2">
        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Casos Especiais</Label>
        <Select onValueChange={setOutcomeOverride}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Resultado Normal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wo_win">Vitória W.O.</SelectItem>
            <SelectItem value="wo_loss">Derrota W.O.</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button 
        className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg" 
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? "Salvando..." : "Confirmar Resultado"}
      </Button>
    </div>
  );
}
