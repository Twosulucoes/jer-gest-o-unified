import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MatchConfig } from "./MatchConfigEditor";

const OUTCOME_OPTIONS = [
  { value: "__none__", label: "— Selecione —" },
  { value: "win", label: "Vitória" },
  { value: "loss", label: "Derrota" },
  { value: "draw", label: "Empate" },
  { value: "wo_win", label: "WO (vitória)" },
  { value: "wo_loss", label: "WO (derrota)" },
  { value: "cancelled", label: "Cancelado" },
];

export interface ScoreEntry {
  match_entry_id: string;
  score_final: string;
  score_detail: Record<string, any> | null;
  outcome: string;
}

interface StateScore {
  final: string;
  detail: Record<string, any>;
  outcome: string;
  shootout: string;
}
interface CollectiveScoreFormProps {
  matchConfig: MatchConfig;
  entries: Array<{ id: string; label: string }>;
  existingScores?: Array<{
    id: string;
    match_entry_id: string;
    score_final: string | null;
    score_detail: any;
    outcome: string | null;
  }>;
  onSubmit: (scores: ScoreEntry[], notes: string) => void;
  isPending: boolean;
  notes?: string;
}

export default function CollectiveScoreForm({
  matchConfig,
  entries,
  existingScores = [],
  onSubmit,
  isPending,
  notes: initialNotes = "",
}: CollectiveScoreFormProps) {
  const scoreType = matchConfig.score_type || "simple";
  const periods = matchConfig.periods ?? 2;
  const periodLabel = matchConfig.period_label || "tempo";

  const existingMap = new Map(existingScores.map((s) => [s.match_entry_id, s]));

  const [scores, setScores] = useState<Record<string, StateScore>>({});
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    const init: typeof scores = {};
    entries.forEach((entry) => {
      const existing = existingMap.get(entry.id);
      const detail: Record<string, string> = {};
      if (scoreType !== "simple") {
        for (let i = 1; i <= periods; i++) {
          detail[`p${i}`] = existing?.score_detail?.[`p${i}`] ?? "";
        }
      }
      init[entry.id] = {
        final: existing?.score_final ?? "",
        detail,
        outcome: existing?.outcome ?? "",
        shootout: existing?.score_detail?.shootout ?? "",
      };
    });
    setScores(init);
  }, [entries.length, existingScores.length]);

  const updateScore = (entryId: string, field: string, value: string) => {
    setScores((prev) => ({
      ...prev,
      [entryId]: { ...prev[entryId], [field]: value },
    }));
  };

  const updateDetail = (entryId: string, period: string, value: string) => {
    setScores((prev) => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        detail: { ...prev[entryId]?.detail, [period]: value },
      },
    }));
  };

  const handleSubmit = () => {
    const result: ScoreEntry[] = entries.map((entry) => {
      const s = scores[entry.id];
      return {
        match_entry_id: entry.id,
        score_final: s?.final ?? "",
        score_detail: scoreType !== "simple" && s?.detail ? s.detail : null,
        outcome: s?.outcome === "__none__" ? "" : (s?.outcome ?? ""),
      };
    });
    onSubmit(result, notes);
  };

  return (
    <div className="space-y-4">
      {entries.map((entry) => {
        const s = scores[entry.id];
        if (!s) return null;
        return (
          <Card key={entry.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{entry.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Placar final</Label>
                  <Input
                    placeholder="Ex: 3"
                    value={s.final}
                    onChange={(e) => updateScore(entry.id, "final", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Desfecho</Label>
                  <Select value={s.outcome || "__none__"} onValueChange={(v) => updateScore(entry.id, "outcome", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OUTCOME_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {scoreType !== "simple" && (
                <div className="space-y-1">
                  <Label className="text-xs">Detalhamento por {periodLabel}</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: periods }).map((_, i) => (
                      <div key={i} className="space-y-0.5">
                        <span className="text-[10px] text-muted-foreground">{periodLabel} {i + 1}</span>
                        <Input
                          placeholder="0"
                          value={s.detail[`p${i + 1}`] ?? ""}
                          onChange={(e) => updateDetail(entry.id, `p${i + 1}`, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="space-y-1">
        <Label className="text-sm">Observações</Label>
        <Textarea placeholder="Observações sobre a partida..." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar placar"}
        </Button>
      </div>
    </div>
  );
}
