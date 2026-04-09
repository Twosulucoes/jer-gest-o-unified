import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { MatchConfig, PenaltyConfig } from "./MatchConfigEditor";

interface MatchPenaltiesCardProps {
  matchId: string;
  entries: { id: string; team_id: string | null; label: string }[];
  matchConfig: MatchConfig;
  canWrite: boolean;
}

export default function MatchPenaltiesCard({
  matchId,
  entries,
  matchConfig,
  canWrite,
}: MatchPenaltiesCardProps) {
  const qc = useQueryClient();
  const penaltyTypes = (matchConfig.penalties ?? []).filter((p) => p.key && p.label && p.visible !== false);

  const [addOpen, setAddOpen] = useState(false);
  const [formEntryId, setFormEntryId] = useState("");
  const [formLineupId, setFormLineupId] = useState("");
  const [formPenaltyKey, setFormPenaltyKey] = useState("");
  const [formMinute, setFormMinute] = useState("");
  const [formPeriod, setFormPeriod] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const teamEntryIds = entries.filter((e) => e.team_id).map((e) => e.id);

  // Fetch lineups
  const { data: lineups = [] } = useQuery({
    queryKey: ["match_lineups_for_penalties", matchId],
    queryFn: async () => {
      if (!teamEntryIds.length) return [];
      const { data, error } = await supabase
        .from("match_lineups")
        .select("id, match_entry_id, participant_id, jersey_number, status")
        .eq("match_id", matchId)
        .in("status", ["active", "bench"]);
      if (error) throw error;
      return data;
    },
    enabled: teamEntryIds.length > 0,
  });

  // Fetch names
  const participantIds = [...new Set(lineups.map((l) => l.participant_id))];
  const { data: participants = [] } = useQuery({
    queryKey: ["participants_penalties", participantIds.length, participantIds.slice(0, 3).join(",")],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase.from("participants").select("id, person_id").in("id", participantIds);
      if (error) throw error;
      return data;
    },
    enabled: participantIds.length > 0,
  });

  const personIds = [...new Set(participants.map((p) => p.person_id))];
  const { data: people = [] } = useQuery({
    queryKey: ["people_penalties", personIds.length, personIds.slice(0, 3).join(",")],
    queryFn: async () => {
      if (!personIds.length) return [];
      const { data, error } = await supabase.from("people").select("id, full_name").in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: personIds.length > 0,
  });

  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const getPlayerName = (participantId: string) => {
    const p = participantMap.get(participantId);
    if (!p) return "—";
    return peopleMap.get(p.person_id)?.full_name ?? "—";
  };

  // Fetch existing penalties
  const { data: existingPenalties = [] } = useQuery({
    queryKey: ["match_penalties", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_penalties" as any)
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const selectedPenaltyType = penaltyTypes.find((p) => p.key === formPenaltyKey);
  const isPlayerPenalty = selectedPenaltyType?.target === "player";
  const entryLineups = lineups.filter((l) => l.match_entry_id === formEntryId);

  const addMut = useMutation({
    mutationFn: async () => {
      const lineup = isPlayerPenalty ? lineups.find((l) => l.id === formLineupId) : null;
      const payload: any = {
        match_id: matchId,
        match_entry_id: formEntryId || null,
        match_lineup_id: isPlayerPenalty ? (formLineupId || null) : null,
        participant_id: lineup?.participant_id ?? null,
        penalty_key: formPenaltyKey,
        minute: formMinute ? parseInt(formMinute) : null,
        period: formPeriod ? parseInt(formPeriod) : null,
        notes: formNotes || null,
      };
      const { error } = await supabase.from("match_penalties" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_penalties", matchId] });
      toast.success("Penalidade registrada");
      resetForm();
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("match_penalties" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_penalties", matchId] });
      toast.success("Penalidade removida");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const resetForm = () => {
    setFormEntryId("");
    setFormLineupId("");
    setFormPenaltyKey("");
    setFormMinute("");
    setFormPeriod("");
    setFormNotes("");
  };

  const getPenaltyLabel = (key: string) => {
    return penaltyTypes.find((p) => p.key === key)?.label ?? key;
  };

  const getEntryLabel = (entryId: string) => {
    return entries.find((e) => e.id === entryId)?.label ?? "—";
  };

  if (penaltyTypes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />Penalidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma penalidade configurada para esta modalidade. Configure em Modalidades → editar → Penalidades.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />Penalidades
          </CardTitle>
          {canWrite && (
            <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Registrar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {existingPenalties.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma penalidade registrada.</p>
          ) : (
            <div className="space-y-2">
              {existingPenalties.map((pen: any) => (
                <div key={pen.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="destructive" className="text-xs">{getPenaltyLabel(pen.penalty_key)}</Badge>
                    <span className="font-medium">{getEntryLabel(pen.match_entry_id)}</span>
                    {pen.participant_id && (
                      <span className="text-muted-foreground">— {getPlayerName(pen.participant_id)}</span>
                    )}
                    {pen.period != null && (
                      <span className="text-xs text-muted-foreground">{matchConfig.period_label ?? "período"} {pen.period}</span>
                    )}
                    {pen.minute != null && (
                      <span className="text-xs text-muted-foreground font-mono">{pen.minute}'</span>
                    )}
                    {pen.notes && (
                      <span className="text-xs text-muted-foreground italic">({pen.notes})</span>
                    )}
                  </div>
                  {canWrite && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMut.mutate(pen.id)} disabled={deleteMut.isPending}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Penalty Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar penalidade</DialogTitle>
            <DialogDescription>Selecione o tipo e o alvo da penalidade.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de penalidade</Label>
              <Select value={formPenaltyKey} onValueChange={(v) => { setFormPenaltyKey(v); setFormLineupId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {penaltyTypes.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label} ({p.target === "player" ? "atleta" : "equipe"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Equipe</Label>
              <Select value={formEntryId} onValueChange={(v) => { setFormEntryId(v); setFormLineupId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a equipe" /></SelectTrigger>
                <SelectContent>
                  {entries.filter((e) => e.team_id).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isPlayerPenalty && formEntryId && (
              <div className="space-y-1.5">
                <Label className="text-xs">Atleta</Label>
                <Select value={formLineupId} onValueChange={setFormLineupId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o atleta" /></SelectTrigger>
                  <SelectContent>
                    {entryLineups.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.jersey_number != null ? `#${l.jersey_number} ` : ""}{getPlayerName(l.participant_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Período</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="—"
                  value={formPeriod}
                  onChange={(e) => setFormPeriod(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Minuto</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={formMinute}
                  onChange={(e) => setFormMinute(e.target.value)}
                />
              </div>
            </div>

            {(selectedPenaltyType?.requires_notes || true) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Observação{selectedPenaltyType?.requires_notes ? " *" : ""}</Label>
                <Textarea
                  placeholder="Observação opcional"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => addMut.mutate()}
              disabled={
                addMut.isPending ||
                !formPenaltyKey ||
                !formEntryId ||
                (isPlayerPenalty && !formLineupId) ||
                (selectedPenaltyType?.requires_notes && !formNotes.trim())
              }
            >
              {addMut.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
