import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { MatchConfig, EventTypeConfig } from "./MatchConfigEditor";
import MatchLiveMode from "./MatchLiveMode";

interface MatchEventsCardProps {
  matchId: string;
  entries: { id: string; team_id: string | null; label: string }[];
  matchConfig: MatchConfig;
  canWrite: boolean;
}

export default function MatchEventsCard({ matchId, entries, matchConfig, canWrite }: MatchEventsCardProps) {
  const qc = useQueryClient();
  const eventTypes: EventTypeConfig[] = (matchConfig.event_types ?? []).filter((e) => e.key && e.label && e.visible !== false);

  const [addOpen, setAddOpen] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [formEntryId, setFormEntryId] = useState("");
  const [formLineupId, setFormLineupId] = useState("");
  const [formEventKey, setFormEventKey] = useState("");
  const [formMinute, setFormMinute] = useState("");
  const [formPeriod, setFormPeriod] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const teamEntryIds = entries.filter((e) => e.team_id).map((e) => e.id);

  const { data: lineups = [] } = useQuery({
    queryKey: ["match_lineups_for_events", matchId],
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

  const participantIds = [...new Set(lineups.map((l) => l.participant_id))];
  const { data: participants = [] } = useQuery({
    queryKey: ["participants_events", participantIds.length, participantIds.slice(0, 3).join(",")],
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
    queryKey: ["people_events", personIds.length, personIds.slice(0, 3).join(",")],
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

  const { data: existingEvents = [] } = useQuery({
    queryKey: ["match_events", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events" as any)
        .select("*")
        .eq("match_id", matchId)
        .order("period", { ascending: true, nullsFirst: true })
        .order("minute", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const selectedEventType = eventTypes.find((e) => e.key === formEventKey);
  const isPlayerEvent = selectedEventType?.target === "player";
  const isTeamEvent = selectedEventType?.target === "team" || isPlayerEvent;
  const entryLineups = lineups.filter((l) => l.match_entry_id === formEntryId);

  const addMut = useMutation({
    mutationFn: async () => {
      const lineup = isPlayerEvent ? lineups.find((l) => l.id === formLineupId) : null;
      const payload: any = {
        match_id: matchId,
        match_entry_id: isTeamEvent ? (formEntryId || null) : null,
        match_lineup_id: isPlayerEvent ? (formLineupId || null) : null,
        participant_id: lineup?.participant_id ?? null,
        event_key: formEventKey,
        minute: formMinute ? parseInt(formMinute) : null,
        period: formPeriod ? parseInt(formPeriod) : null,
        notes: formNotes || null,
      };
      const { error } = await supabase.from("match_events" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_events", matchId] });
      toast.success("Ocorrência registrada");
      resetForm();
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("match_events" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_events", matchId] });
      toast.success("Ocorrência removida");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const resetForm = () => {
    setFormEntryId("");
    setFormLineupId("");
    setFormEventKey("");
    setFormMinute("");
    setFormPeriod("");
    setFormNotes("");
  };

  const getEventLabel = (key: string) => eventTypes.find((e) => e.key === key)?.label ?? key;
  const getEntryLabel = (entryId: string) => entries.find((e) => e.id === entryId)?.label ?? "—";

  if (eventTypes.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />Ocorrências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Nenhuma ocorrência configurada para esta modalidade. Configure em Modalidades → editar → Ocorrências / Timeline.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (liveMode) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4 text-destructive animate-pulse" />Modo ao Vivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MatchLiveMode
            matchId={matchId}
            entries={entries}
            matchConfig={matchConfig}
            lineups={lineups}
            getPlayerName={getPlayerName}
            onClose={() => setLiveMode(false)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />Ocorrências
          </CardTitle>
          <div className="flex items-center gap-2">
            {canWrite && (
              <Button size="sm" variant="outline" onClick={() => setLiveMode(true)}>
                <Radio className="mr-1 h-3.5 w-3.5" />Modo ao vivo
              </Button>
            )}
            {canWrite && (
              <Button size="sm" variant="outline" onClick={() => { resetForm(); setAddOpen(true); }}>
                <Plus className="mr-1 h-3.5 w-3.5" />Registrar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {existingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ocorrência registrada.</p>
          ) : (
            <div className="space-y-1.5">
              {existingEvents.map((evt: any) => (
                <div key={evt.id} className="flex items-center justify-between gap-2 text-xs rounded-lg border p-2.5">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge variant="secondary" className="text-[10px] shrink-0">{getEventLabel(evt.event_key)}</Badge>
                    {evt.match_entry_id && (
                      <span className="font-medium">{getEntryLabel(evt.match_entry_id)}</span>
                    )}
                    {evt.participant_id && (
                      <span>— {getPlayerName(evt.participant_id)}</span>
                    )}
                    {evt.period != null && (
                      <span className="text-muted-foreground">{matchConfig.period_label ?? "período"} {evt.period}</span>
                    )}
                    {evt.minute != null && (
                      <span className="text-muted-foreground font-mono">{evt.minute}'</span>
                    )}
                    {evt.notes && (
                      <span className="text-muted-foreground italic truncate">({evt.notes})</span>
                    )}
                  </div>
                  {canWrite && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteMut.mutate(evt.id)} disabled={deleteMut.isPending}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar ocorrência</DialogTitle>
            <DialogDescription>Selecione o tipo e preencha os dados da ocorrência.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de ocorrência</Label>
              <Select value={formEventKey} onValueChange={(v) => { setFormEventKey(v); setFormEntryId(""); setFormLineupId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {eventTypes.map((e) => (
                    <SelectItem key={e.key} value={e.key}>
                      {e.label} ({e.target === "player" ? "atleta" : e.target === "team" ? "equipe" : "partida"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isTeamEvent && (
              <div className="space-y-1.5">
                <Label className="text-xs">Equipe</Label>
                <Select value={formEntryId} onValueChange={(v) => { setFormEntryId(v); setFormLineupId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {entries.filter((e) => e.team_id).map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {isPlayerEvent && formEntryId && (
              <div className="space-y-1.5">
                <Label className="text-xs">Atleta</Label>
                <Select value={formLineupId} onValueChange={setFormLineupId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                <Input type="number" min={1} placeholder="—" value={formPeriod} onChange={(e) => setFormPeriod(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Minuto</Label>
                <Input type="number" min={0} placeholder="—" value={formMinute} onChange={(e) => setFormMinute(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observação{selectedEventType?.requires_notes ? " *" : ""}</Label>
              <Textarea placeholder="Detalhes da ocorrência" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => addMut.mutate()}
              disabled={
                addMut.isPending ||
                !formEventKey ||
                (isTeamEvent && !formEntryId) ||
                (isPlayerEvent && !formLineupId) ||
                (selectedEventType?.requires_notes && !formNotes.trim())
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
