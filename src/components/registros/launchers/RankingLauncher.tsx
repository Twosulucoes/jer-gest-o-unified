
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Trophy } from "lucide-react";

export interface RankingLauncherProps {
  entries: any[];
  onSave: (payload: any) => void;
  isSaving?: boolean;
  rules?: any;
}

export default function RankingLauncher({ entries, onSave, isSaving, rules }: RankingLauncherProps) {
  const [data, setData] = useState<Record<string, { value: string; outcome: string }>>(() => {
    const initial: any = {};
    entries.forEach(e => {
      initial[e.id] = {
        value: e.score?.score_final || "",
        outcome: e.score?.outcome || "none"
      };
    });
    return initial;
  });

  const handleUpdate = (id: string, field: string, val: string) => {
    setData(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: val }
    }));
  };

  const handleSave = () => {
    const payload = entries.map(e => ({
      entryId: e.id,
      scoreFinal: data[e.id].value,
      outcome: data[e.id].outcome,
      scoreDetail: {
        points: data[e.id].value
      }
    }));
    onSave(payload);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {entries.map((entry, idx) => (
          <div key={entry.id} className="bg-card border rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full h-6 w-6 p-0 flex items-center justify-center font-bold">
                {idx + 1}
              </Badge>
              <span className="font-bold text-sm truncate flex-1">
                {entry.team?.name || entry.participantName || "Participante"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> Pontos / Classif.
                </Label>
                <Input
                  placeholder="0.00"
                  className="h-12 text-xl font-black text-center"
                  value={data[entry.id].value}
                  onChange={(e) => handleUpdate(entry.id, "value", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold">Resultado</Label>
                <Select value={data[entry.id].outcome} onValueChange={(v) => handleUpdate(entry.id, "outcome", v)}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="win">Vitória</SelectItem>
                    <SelectItem value="loss">Derrota</SelectItem>
                    <SelectItem value="draw">Empate</SelectItem>
                    <SelectItem value="dns">DNS/DNF</SelectItem>
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
        {isSaving ? "Salvando..." : "Confirmar Resultados"}
      </Button>
    </div>
  );
}

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
