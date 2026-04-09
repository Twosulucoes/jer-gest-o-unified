import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MatchConfig } from "./MatchConfigEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Clock, MapPin, Users, Shield, BarChart3, AlertTriangle, Paperclip, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MatchSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  match: any;
  phase: any;
  sportEvent: any;
  sport: any;
  venue: any;
  entries: any[];
  matchScores: any[];
  matchConfig: MatchConfig;
  getEntryLabel: (entry: any) => string;
  groupName?: string;
}

const OUTCOME_LABEL: Record<string, string> = {
  win: "Vitória", loss: "Derrota", draw: "Empate",
  wo_win: "WO (vitória)", wo_loss: "WO (derrota)", dsq: "Desclassificado",
  dns: "Não compareceu", dnf: "Não concluiu", cancelled: "Cancelado",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", in_progress: "Em andamento", finished: "Finalizada", cancelled: "Cancelada",
};

const OFFICIAL_ROLE_LABEL: Record<string, string> = {
  referee: "Árbitro", assistant: "Assistente", table: "Mesa", coordinator: "Coordenador",
};

export default function MatchSummaryDialog({
  open, onOpenChange, matchId, match, phase, sportEvent, sport, venue,
  entries, matchScores, matchConfig, getEntryLabel, groupName,
}: MatchSummaryDialogProps) {
  const teamEntryIds = entries.filter((e) => e.team_id).map((e) => e.id);

  // Officials
  const { data: officials = [] } = useQuery({
    queryKey: ["summary_officials", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_officials").select("*").eq("match_id", matchId).order("role");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Lineups
  const { data: lineups = [] } = useQuery({
    queryKey: ["summary_lineups", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_lineups")
        .select("id, match_entry_id, participant_id, jersey_number, position, is_starter, status")
        .eq("match_id", matchId)
        .order("is_starter", { ascending: false })
        .order("jersey_number");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Participant names
  const participantIds = [...new Set(lineups.map((l) => l.participant_id))];
  const { data: participants = [] } = useQuery({
    queryKey: ["summary_participants", matchId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase.from("participants").select("id, person_id").in("id", participantIds);
      if (error) throw error;
      return data;
    },
    enabled: open && participantIds.length > 0,
  });
  const personIds = [...new Set(participants.map((p) => p.person_id))];
  const { data: people = [] } = useQuery({
    queryKey: ["summary_people", matchId, personIds.length],
    queryFn: async () => {
      if (!personIds.length) return [];
      const { data, error } = await supabase.from("people").select("id, full_name").in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: open && personIds.length > 0,
  });
  const partMap = new Map(participants.map((p) => [p.id, p]));
  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const getName = (pid: string) => {
    const part = partMap.get(pid);
    if (!part) return "—";
    return peopleMap.get(part.person_id)?.full_name ?? "—";
  };

  // Player stats
  const { data: playerStats = [] } = useQuery({
    queryKey: ["summary_player_stats", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_player_stats").select("*").eq("match_id", matchId);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Penalties
  const { data: penalties = [] } = useQuery({
    queryKey: ["summary_penalties", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_penalties" as any).select("*").eq("match_id", matchId).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  // Attachments
  const { data: attachments = [] } = useQuery({
    queryKey: ["summary_attachments", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_attachments" as any).select("*").eq("match_id", matchId).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  // Match events (timeline)
  const { data: matchEvents = [] } = useQuery({
    queryKey: ["summary_match_events", matchId],
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
    enabled: open,
  });

  const statConfigs = matchConfig.player_stats?.filter((s) => s.key && s.label && s.visible !== false) ?? [];
  const penaltyConfigs = matchConfig.penalties?.filter((p) => p.key && p.label && p.visible !== false) ?? [];
  const eventTypeConfigs = matchConfig.event_types?.filter((e) => e.key && e.label && e.visible !== false) ?? [];
  const getPenaltyLabel = (key: string) => penaltyConfigs.find((p) => p.key === key)?.label ?? key;
  const getEventTypeLabel = (key: string) => eventTypeConfigs.find((e) => e.key === key)?.label ?? key;

  const formatDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : "—";

  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
        <DialogHeader className="flex flex-row items-start justify-between gap-2">
          <DialogTitle className="text-xl">Súmula da Partida</DialogTitle>
          <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden shrink-0">
            <Printer className="mr-2 h-4 w-4" />Imprimir
          </Button>
        </DialogHeader>

        <div className="space-y-6 text-sm" id="match-summary-content">
          {/* Header */}
          <section className="space-y-2">
            <h3 className="font-semibold text-base text-foreground">{sportEvent?.name ?? "—"}</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />Fase: <span className="text-foreground">{phase?.name ?? "—"}</span>
              </div>
              {groupName && (
                <div>Grupo: <span className="text-foreground">{groupName}</span></div>
              )}
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /><span className="text-foreground capitalize">{formatDate(match?.match_date)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /><span className="text-foreground font-mono">{match?.start_time?.slice(0, 5) ?? "—"}</span>
              </div>
              {venue && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /><span className="text-foreground">{venue.name}</span>
                </div>
              )}
              <div>Status: <Badge variant="outline" className="text-[10px] ml-1">{STATUS_LABEL[match?.status] ?? match?.status}</Badge></div>
            </div>
            {match?.match_number && <div className="text-muted-foreground">Partida nº <span className="text-foreground font-mono">{match.match_number}</span></div>}
          </section>

          <Separator />

          {/* Score */}
          <section>
            <h4 className="font-semibold mb-2 flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Placar</h4>
            {matchScores.length === 0 ? (
              <p className="text-muted-foreground italic">Nenhum placar lançado.</p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => {
                  const ms = matchScores.find((s: any) => s.match_entry_id === entry.id);
                  if (!ms) return null;
                  return (
                    <div key={entry.id} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-medium">{getEntryLabel(entry)}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold font-mono">{ms.score_final ?? "—"}</span>
                        {ms.outcome && <Badge variant="outline" className="text-[10px]">{OUTCOME_LABEL[ms.outcome] ?? ms.outcome}</Badge>}
                        {ms.score_detail && (
                          <span className="text-xs text-muted-foreground">
                            ({Object.values(ms.score_detail as Record<string, string>).join(" / ")})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <Separator />

          {/* Officials */}
          <section>
            <h4 className="font-semibold mb-2 flex items-center gap-1.5"><Shield className="h-4 w-4" />Arbitragem e Oficiais</h4>
            {officials.length === 0 ? (
              <p className="text-muted-foreground italic">Nenhum oficial registrado.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {officials.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 rounded border p-2">
                    <Badge variant="secondary" className="text-[10px]">{OFFICIAL_ROLE_LABEL[o.role] ?? o.role}</Badge>
                    <span>{o.name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* Lineups by team */}
          <section>
            <h4 className="font-semibold mb-2 flex items-center gap-1.5"><Users className="h-4 w-4" />Escalação</h4>
            {entries.filter((e) => e.team_id).map((entry) => {
              const teamLineups = lineups.filter((l) => l.match_entry_id === entry.id);
              const starters = teamLineups.filter((l) => l.is_starter);
              const bench = teamLineups.filter((l) => !l.is_starter);
              return (
                <div key={entry.id} className="mb-4">
                  <h5 className="font-medium text-foreground mb-1">{getEntryLabel(entry)}</h5>
                  {teamLineups.length === 0 ? (
                    <p className="text-muted-foreground italic text-xs">Sem escalação registrada.</p>
                  ) : (
                    <div className="space-y-1">
                      {starters.length > 0 && (
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Titulares</span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-0.5">
                            {starters.map((l) => (
                              <div key={l.id} className="text-xs rounded border px-2 py-1 flex items-center gap-1.5">
                                {l.jersey_number != null && <span className="font-mono font-bold text-primary">#{l.jersey_number}</span>}
                                <span>{getName(l.participant_id)}</span>
                                {l.position && <span className="text-muted-foreground">({l.position})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {bench.length > 0 && (
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Reservas</span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-0.5">
                            {bench.map((l) => (
                              <div key={l.id} className="text-xs rounded border px-2 py-1 flex items-center gap-1.5 opacity-75">
                                {l.jersey_number != null && <span className="font-mono font-bold">#{l.jersey_number}</span>}
                                <span>{getName(l.participant_id)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* Player Stats */}
          {statConfigs.length > 0 && playerStats.length > 0 && (
            <>
              <Separator />
              <section>
                <h4 className="font-semibold mb-2 flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Estatísticas Individuais</h4>
                {entries.filter((e) => e.team_id).map((entry) => {
                  const teamLineupIds = lineups.filter((l) => l.match_entry_id === entry.id).map((l) => l.id);
                  const teamStats = playerStats.filter((s) => teamLineupIds.includes(s.match_lineup_id));
                  if (teamStats.length === 0) return null;

                  const lineupStats = new Map<string, Map<string, number>>();
                  teamStats.forEach((s) => {
                    if (!lineupStats.has(s.match_lineup_id)) lineupStats.set(s.match_lineup_id, new Map());
                    lineupStats.get(s.match_lineup_id)!.set(s.stat_key, (lineupStats.get(s.match_lineup_id)!.get(s.stat_key) ?? 0) + Number(s.stat_value));
                  });

                  return (
                    <div key={entry.id} className="mb-3">
                      <h5 className="font-medium text-xs mb-1">{getEntryLabel(entry)}</h5>
                      <table className="w-full text-xs border rounded">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-1.5 font-medium">Atleta</th>
                            {statConfigs.map((sc) => (
                              <th key={sc.key} className="text-center p-1.5 font-medium">{sc.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(lineupStats.entries()).map(([lineupId, stats]) => {
                            const lineup = lineups.find((l) => l.id === lineupId);
                            return (
                              <tr key={lineupId} className="border-b last:border-0">
                                <td className="p-1.5">
                                  {lineup?.jersey_number != null && <span className="font-mono mr-1">#{lineup.jersey_number}</span>}
                                  {lineup ? getName(lineup.participant_id) : "—"}
                                </td>
                                {statConfigs.map((sc) => (
                                  <td key={sc.key} className="text-center p-1.5 font-mono">{stats.get(sc.key) ?? 0}</td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </section>
            </>
          )}

          {/* Penalties */}
          {penalties.length > 0 && (
            <>
              <Separator />
              <section>
                <h4 className="font-semibold mb-2 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />Penalidades</h4>
                <div className="space-y-1">
                  {penalties.map((pen: any) => {
                    const entryLabel = entries.find((e) => e.id === pen.match_entry_id)
                      ? getEntryLabel(entries.find((e) => e.id === pen.match_entry_id)!)
                      : "—";
                    return (
                      <div key={pen.id} className="flex items-center gap-2 text-xs rounded border p-2">
                        <Badge variant="destructive" className="text-[10px]">{getPenaltyLabel(pen.penalty_key)}</Badge>
                        <span className="font-medium">{entryLabel}</span>
                        {pen.participant_id && <span>— {getName(pen.participant_id)}</span>}
                        {pen.period != null && <span className="text-muted-foreground">{matchConfig.period_label ?? "período"} {pen.period}</span>}
                        {pen.minute != null && <span className="text-muted-foreground">{pen.minute}'</span>}
                        {pen.notes && <span className="text-muted-foreground italic">({pen.notes})</span>}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* Timeline / Events */}
          {matchEvents.length > 0 && (
            <>
              <Separator />
              <section>
                <h4 className="font-semibold mb-2 flex items-center gap-1.5"><Clock className="h-4 w-4" />Timeline / Ocorrências</h4>
                <div className="space-y-1">
                  {matchEvents.map((evt: any) => {
                    const entryLabel = entries.find((e) => e.id === evt.match_entry_id)
                      ? getEntryLabel(entries.find((e) => e.id === evt.match_entry_id)!)
                      : null;
                    return (
                      <div key={evt.id} className="flex items-center gap-2 text-xs rounded border p-2">
                        <Badge variant="outline" className="text-[10px]">{getEventTypeLabel(evt.event_key)}</Badge>
                        {entryLabel && <span className="font-medium">{entryLabel}</span>}
                        {evt.participant_id && <span>— {getName(evt.participant_id)}</span>}
                        {evt.period != null && <span className="text-muted-foreground">{matchConfig.period_label ?? "período"} {evt.period}</span>}
                        {evt.minute != null && <span className="text-muted-foreground font-mono">{evt.minute}'</span>}
                        {evt.notes && <span className="text-muted-foreground italic">({evt.notes})</span>}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <>
              <Separator />
              <section>
                <h4 className="font-semibold mb-2 flex items-center gap-1.5"><Paperclip className="h-4 w-4" />Anexos</h4>
                <div className="space-y-1">
                  {attachments.map((att: any) => (
                    <div key={att.id} className="flex items-center gap-2 text-xs rounded border p-2">
                      <span className="font-medium">{att.file_name}</span>
                      {att.notes && <span className="text-muted-foreground">— {att.notes}</span>}
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-primary underline ml-auto print:hidden">
                        Abrir
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Notes */}
          {match?.notes && (
            <>
              <Separator />
              <section>
                <h4 className="font-semibold mb-1">Observações da partida</h4>
                <p className="text-muted-foreground">{match.notes}</p>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
