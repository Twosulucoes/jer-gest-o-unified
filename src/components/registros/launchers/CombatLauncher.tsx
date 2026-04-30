
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Trophy, Timer } from "lucide-react";

export interface CombatLauncherProps {
  entries: any[];
  onSave: (payload: any) => void;
  isSaving?: boolean;
  rules?: any;
}

export default function CombatLauncher({ entries, onSave, isSaving, rules }: CombatLauncherProps) {
  const [winnerId, setWinnerId] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [time, setTime] = useState<string>("00:00");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    // Initial state from entries if available
    const winEntry = entries.find(e => e.score?.outcome === "win" || e.score?.outcome === "wo_win");
    if (winEntry) {
      setWinnerId(winEntry.id);
      if (winEntry.score?.score_detail?.victory_method) setMethod(winEntry.score.score_detail.victory_method);
      if (winEntry.score?.score_detail?.match_time) setTime(winEntry.score.score_detail.match_time);
    }
  }, [entries]);

  const handleSave = () => {
    const isWO = method.includes("W.O.");
    const payload = entries.map(e => ({
      entryId: e.id,
      scoreFinal: e.id === winnerId ? "V" : "D",
      outcome: e.id === winnerId ? (isWO ? "wo_win" : "win") : (isWO ? "wo_loss" : "loss"),
      scoreDetail: {
        victory_method: method,
        match_time: time,
        notes: notes
      }
    }));
    onSave(payload);
  };

  const methods = [
    "Ippon", "Waza-ari", "Pontos", "Knockout", "Decisão", 
    "Desclassificação", "Desistência", "W.O."
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {entries.map((entry, idx) => (
          <button
            key={entry.id}
            onClick={() => setWinnerId(entry.id)}
            className={cn(
              "w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between",
              winnerId === entry.id ? "bg-primary/5 border-primary shadow-md" : "bg-card border-transparent"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center font-bold text-white",
                idx === 0 ? "bg-blue-600" : "bg-red-600"
              )}>
                {entry.team?.name?.charAt(0) || entry.participantName?.charAt(0) || "?"}
              </div>
              <div>
                <p className="font-bold">{entry.team?.name || entry.participantName || "Participante"}</p>
                <p className="text-xs text-muted-foreground">{entry.side === "home" ? "Azul" : "Branco/Vermelho"}</p>
              </div>
            </div>
            {winnerId === entry.id && <Trophy className="h-6 w-6 text-primary animate-bounce" />}
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Método</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Tempo</Label>
            <div className="relative">
              <Timer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                className="pl-9 font-mono" 
                placeholder="00:00" 
                value={time} 
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <Button 
        className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg" 
        onClick={handleSave}
        disabled={isSaving || !winnerId || !method}
      >
        {isSaving ? "Salvando..." : "Confirmar Vitória"}
      </Button>
    </div>
  );
}
