import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const METHOD_OPTIONS = [
  { value: "ippon", label: "Ippon" },
  { value: "waza_ari", label: "Waza-ari" },
  { value: "points", label: "Pontos" },
  { value: "pin", label: "Imobilização (Pin)" },
  { value: "tech_fall", label: "Superioridade técnica" },
  { value: "decision", label: "Decisão" },
  { value: "dsq", label: "Desclassificação" },
  { value: "wo", label: "W.O." },
  { value: "kata_score", label: "Nota (Kata)" },
];

export interface CombatResultPayload {
  winner_entry_id: string;
  loser_entry_id: string;
  combat_detail: {
    modality: string;
    method: string;
    round: number | null;
    time_sec: number | null;
    scores: Record<string, unknown>;
    penalties: Record<string, unknown>;
    notes: string;
  };
}

interface Entry {
  id: string;
  label: string;
}

interface Props {
  entries: Entry[];
  modality?: string;
  onSubmit: (payload: CombatResultPayload) => void;
  isPending: boolean;
}

export default function CombatResultForm({ entries, modality = "JUDO", onSubmit, isPending }: Props) {
  const [winnerEntryId, setWinnerEntryId] = useState("");
  const [method, setMethod] = useState("");
  const [round, setRound] = useState("");
  const [timeMin, setTimeMin] = useState("");
  const [timeSec, setTimeSec] = useState("");
  const [notes, setNotes] = useState("");
  const [penaltiesHome, setPenaltiesHome] = useState("");
  const [penaltiesAway, setPenaltiesAway] = useState("");

  const loserEntryId = entries.find((e) => e.id !== winnerEntryId)?.id ?? "";

  const handleSubmit = () => {
    if (!winnerEntryId || !method) return;

    const totalSec = (parseInt(timeMin || "0") * 60) + parseInt(timeSec || "0");

    const payload: CombatResultPayload = {
      winner_entry_id: winnerEntryId,
      loser_entry_id: loserEntryId,
      combat_detail: {
        modality,
        method,
        round: round ? parseInt(round) : null,
        time_sec: totalSec > 0 ? totalSec : null,
        scores: {},
        penalties: {
          home: penaltiesHome ? penaltiesHome.split(",").map((s) => s.trim()) : [],
          away: penaltiesAway ? penaltiesAway.split(",").map((s) => s.trim()) : [],
        },
        notes,
      },
    };
    onSubmit(payload);
  };

  if (entries.length < 2) {
    return <p className="text-sm text-muted-foreground">Esta partida precisa de 2 participantes para lançar resultado de combate.</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Vencedor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={winnerEntryId} onValueChange={setWinnerEntryId}>
            <SelectTrigger><SelectValue placeholder="Selecione o vencedor" /></SelectTrigger>
            <SelectContent>
              {entries.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Método de vitória</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue placeholder="Selecione o método" /></SelectTrigger>
            <SelectContent>
              {METHOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Round</Label>
              <Input type="number" min={1} placeholder="1" value={round} onChange={(e) => setRound(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Min</Label>
              <Input type="number" min={0} placeholder="0" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Seg</Label>
              <Input type="number" min={0} max={59} placeholder="0" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Penalidades e observações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">{entries[0]?.label ?? "Lado A"}</Label>
              <Input placeholder="shido, hansoku..." value={penaltiesHome} onChange={(e) => setPenaltiesHome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{entries[1]?.label ?? "Lado B"}</Label>
              <Input placeholder="shido, hansoku..." value={penaltiesAway} onChange={(e) => setPenaltiesAway(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea placeholder="Notas do árbitro..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isPending || !winnerEntryId || !method}>
          {isPending ? "Salvando..." : "Lançar resultado de combate"}
        </Button>
      </div>
    </div>
  );
}
