
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RotateCcw } from "lucide-react";

export interface ScoreLauncherProps {
  entries: any[];
  onSave: (payload: any) => void;
  isSaving?: boolean;
  initialData?: any;
  rules?: any;
}

export default function ScoreLauncher({ entries, onSave, isSaving, initialData, rules }: ScoreLauncherProps) {
  const [scores, setScores] = useState<Record<string, { scoreFinal: string; outcome: string; periods: Record<string, string> }>>(() => {
    const data: any = {};
    entries.forEach(e => {
      const savedScore = e.score || {};
      data[e.id] = {
        scoreFinal: savedScore.score_final ?? "",
        outcome: savedScore.outcome ?? "",
        periods: savedScore.score_detail?.periods ?? {}
      };
    });
    return data;
  });

  const numPeriods = rules?.periods || 2;
  const acceptsDraw = rules?.scoring?.accepts_draw ?? true;

  const handleUpdatePeriod = (entryId: string, period: string, value: string) => {
    setScores(prev => {
      const entryScores = prev[entryId] || { scoreFinal: "", outcome: "", periods: {} };
      const newPeriods = { ...entryScores.periods, [period]: value };
      
      // Auto-sum if all periods are numbers
      let newScoreFinal = entryScores.scoreFinal;
      const periodValues = Object.values(newPeriods);
      if (periodValues.length === numPeriods && periodValues.every(v => v !== "" && !isNaN(Number(v)))) {
        newScoreFinal = periodValues.reduce((sum, v) => sum + Number(v), 0).toString();
      }

      return {
        ...prev,
        [entryId]: { ...entryScores, periods: newPeriods, scoreFinal: newScoreFinal }
      };
    });
  };

  const handleUpdateFinal = (entryId: string, value: string) => {
    setScores(prev => ({
      ...prev,
      [entryId]: { ...prev[entryId], scoreFinal: value }
    }));
  };

  const handleUpdateOutcome = (entryId: string, value: string) => {
    setScores(prev => ({
      ...prev,
      [entryId]: { ...prev[entryId], outcome: value }
    }));
  };

  // Derive outcome automatically if possible
  useEffect(() => {
    if (entries.length !== 2) return;
    const [eA, eB] = entries;
    const valA = Number(scores[eA.id]?.scoreFinal);
    const valB = Number(scores[eB.id]?.scoreFinal);

    if (isNaN(valA) || isNaN(valB)) return;

    setScores(prev => {
      const next = { ...prev };
      if (valA > valB) {
        next[eA.id].outcome = "win";
        next[eB.id].outcome = "loss";
      } else if (valB > valA) {
        next[eA.id].outcome = "loss";
        next[eB.id].outcome = "win";
      } else if (acceptsDraw) {
        next[eA.id].outcome = "draw";
        next[eB.id].outcome = "draw";
      }
      return next;
    });
  }, [scores[entries[0]?.id]?.scoreFinal, scores[entries[1]?.id]?.scoreFinal]);

  const handleSave = () => {
    const payload = entries.map(e => ({
      entryId: e.id,
      scoreFinal: scores[e.id].scoreFinal,
      outcome: scores[e.id].outcome,
      scoreDetail: {
        periods: scores[e.id].periods
      }
    }));
    onSave(payload);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {entries.map((entry, idx) => (
          <div key={entry.id} className="bg-card border rounded-2xl p-4 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-2">
              <Badge variant="secondary" className="rounded-full h-6 w-6 p-0 flex items-center justify-center font-bold">
                {idx + 1}
              </Badge>
              <span className="font-bold text-sm truncate flex-1">
                {entry.team?.name || entry.participantName || "Participante"}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {entry.side === "home" ? "Mandante" : "Visitante"}
              </Badge>
            </div>

            {/* Períodos */}
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                <RotateCcw className="h-3 w-3" /> Parciais por Período
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: numPeriods }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Label className="text-[9px] text-center block text-muted-foreground">{i + 1}º</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      className="h-9 text-center font-bold px-1"
                      value={scores[entry.id]?.periods[`p${i+1}`] || ""}
                      onChange={(e) => handleUpdatePeriod(entry.id, `p${i+1}`, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Placar Final</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  className="h-12 text-2xl font-black text-center border-primary/20"
                  value={scores[entry.id]?.scoreFinal || ""}
                  onChange={(e) => handleUpdateFinal(entry.id, e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Resultado</Label>
                <Select value={scores[entry.id]?.outcome} onValueChange={(v) => handleUpdateOutcome(entry.id, v)}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="win">Vitória</SelectItem>
                    <SelectItem value="loss">Derrota</SelectItem>
                    {acceptsDraw && <SelectItem value="draw">Empate</SelectItem>}
                    <SelectItem value="wo_win">Vitória W.O.</SelectItem>
                    <SelectItem value="wo_loss">Derrota W.O.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
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
