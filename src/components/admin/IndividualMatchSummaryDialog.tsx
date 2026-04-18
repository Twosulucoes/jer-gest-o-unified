import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { IndividualConfig } from "./IndividualConfigEditor";
import { computeIndividualRanking, getPrimaryRankField, formatRankValue } from "@/lib/individualRanking";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Clock, MapPin, Shield, Paperclip, Printer, User, Trophy, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IndividualMatchSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  match: any;
  phase: any;
  sportEvent: any;
  sport: any;
  venue: any;
  entries: any[];
  results: any[];
  individualConfig: IndividualConfig | null;
  getEntryLabel: (entry: any) => string;
  groupName?: string;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", in_progress: "Em andamento", finished: "Finalizada", cancelled: "Cancelada",
};

const OUTCOME_LABEL: Record<string, string> = {
  win: "Vitória", loss: "Derrota", draw: "Empate",
  wo_win: "WO (vitória)", wo_loss: "WO (derrota)", dsq: "Desclassificado",
  dns: "Não compareceu", dnf: "Não concluiu", cancelled: "Cancelado",
};

const RESULT_STATUS_LABEL: Record<string, string> = {
  resultado_lancado: "Lançado", resultado_validado: "Validado", publicado: "Publicado",
};

const OFFICIAL_ROLE_LABEL: Record<string, string> = {
  referee: "Árbitro", assistant: "Assistente", table: "Mesa", coordinator: "Coordenador",
};

const MATCH_TYPE_LABEL: Record<string, string> = {
  heat: "Bateria/Série", bracket: "Chave/Eliminatória", round_robin: "Pontos corridos", direct: "Confronto direto",
};

const formatTimeMs = (ms: number): string => {
  const totalSecs = Math.floor(ms / 1000);
  const millis = ms % 1000;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins > 0) return `${mins}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
  return `${secs}.${millis.toString().padStart(3, "0")}s`;
};

const formatDistanceCm = (cm: number): string => {
  if (cm >= 100) return `${(cm / 100).toFixed(2)}m`;
  return `${cm}cm`;
};

const formatDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : "—";

export default function IndividualMatchSummaryDialog({
  open, onOpenChange, matchId, match, phase, sportEvent, sport, venue,
  entries, results, individualConfig, getEntryLabel, groupName,
}: IndividualMatchSummaryDialogProps) {
  const rf = individualConfig?.result_fields ?? {};
  const hasAnyFields = Object.values(rf).some(Boolean);

  // Determine which fields to show
  const showTime = !individualConfig || !hasAnyFields || !!rf.time;
  const showDistance = !individualConfig || !hasAnyFields || !!rf.distance;
  const showPoints = !individualConfig || !hasAnyFields || !!rf.points;
  const showScore = !individualConfig || !hasAnyFields || !!rf.score;
  const showPosition = !individualConfig || !hasAnyFields || !!rf.position;

  // Officials
  const { data: officials = [] } = useQuery({
    queryKey: ["ind_summary_officials", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_officials").select("*").eq("match_id", matchId).order("role");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Attachments
  const { data: attachments = [] } = useQuery({
    queryKey: ["ind_summary_attachments", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("match_attachments" as any).select("*").eq("match_id", matchId).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  // Attempts
  const { data: attemptsData = [] } = useQuery({
    queryKey: ["ind_summary_attempts", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_attempts" as any)
        .select("*")
        .eq("match_id", matchId)
        .order("attempt_number");
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!individualConfig?.allows_attempts,
  });

  const resultsMap = new Map(results.map((r) => [r.match_entry_id, r]));
  const handlePrint = () => window.print();

  // Ranking
  const rankField = getPrimaryRankField(individualConfig);
  const ranked = computeIndividualRanking(entries, results, attemptsData, individualConfig, getEntryLabel);
  const hasRanking = rankField && ranked.some((r) => r.position != null);
  const isHeat = individualConfig?.match_type === "heat";

  const RANK_FIELD_LABEL: Record<string, string> = {
    time_ms: "Tempo", distance_cm: "Distância", points: "Pontos", position: "Posição",
  };
  const SOURCE_LABEL: Record<string, string> = {
    result: "Resultado", attempt: "Melhor tentativa", manual_position: "Manual",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible">
        <DialogHeader className="flex flex-row items-start justify-between gap-2">
          <DialogTitle className="text-xl">Súmula da Prova Individual</DialogTitle>
          <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden shrink-0">
            <Printer className="mr-2 h-4 w-4" />Imprimir
          </Button>
        </DialogHeader>

        <div className="space-y-5 text-sm" id="individual-summary-content">
          {/* Header */}
          <section className="space-y-2">
            <h3 className="font-semibold text-base text-foreground">{sportEvent?.name ?? "—"}</h3>
            {individualConfig?.match_type && (
              <Badge variant="secondary" className="text-xs">{MATCH_TYPE_LABEL[individualConfig.match_type] ?? individualConfig.match_type}</Badge>
            )}
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
            {match?.match_number && <div className="text-muted-foreground">Prova nº <span className="text-foreground font-mono">{match.match_number}</span></div>}
          </section>

          <Separator />

          {/* Participants & Results */}
          <section>
            <h4 className="font-semibold mb-2 flex items-center gap-1.5"><User className="h-4 w-4" />Participantes e Resultados</h4>
            {entries.length === 0 ? (
              <p className="text-muted-foreground italic">Nenhum participante vinculado.</p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => {
                  const result = resultsMap.get(entry.id);
                  return (
                    <div key={entry.id} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{getEntryLabel(entry)}</span>
                        {result?.result_status && (
                          <Badge variant="outline" className="text-[10px]">
                            {RESULT_STATUS_LABEL[result.result_status] ?? result.result_status}
                          </Badge>
                        )}
                      </div>
                      {result ? (
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          {showPosition && result.position != null && (
                            <span className="flex items-center gap-1">
                              <Trophy className="h-3 w-3 text-primary" />
                              <span className="font-mono font-bold">{result.position}º</span>
                            </span>
                          )}
                          {showTime && result.time_ms != null && (
                            <span>Tempo: <span className="font-mono font-semibold">{formatTimeMs(result.time_ms)}</span></span>
                          )}
                          {showDistance && result.distance_cm != null && (
                            <span>Distância: <span className="font-mono font-semibold">{formatDistanceCm(result.distance_cm)}</span></span>
                          )}
                          {showPoints && result.points != null && (
                            <span>Pontos: <span className="font-mono font-semibold">{result.points}</span></span>
                          )}
                          {showScore && result.score && (
                            <span>Placar: <span className="font-mono font-semibold">{result.score}</span></span>
                          )}
                          {result.outcome && (
                            <Badge variant="outline" className="text-[10px]">{OUTCOME_LABEL[result.outcome] ?? result.outcome}</Badge>
                          )}
                          {result.result_text && (
                            <span className="text-muted-foreground italic">{result.result_text}</span>
                          )}
                          {result.penalty_notes && (
                            <span className="text-destructive text-[10px]">Pen.: {result.penalty_notes}</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic text-xs">Sem resultado lançado.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Ranking */}
          {hasRanking && (
            <>
              <Separator />
              <section>
                <h4 className="font-semibold mb-2 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" />Classificação{isHeat ? " da Bateria" : ""}
                  {rankField && <Badge variant="outline" className="text-[10px] ml-2">Por {RANK_FIELD_LABEL[rankField] ?? rankField}</Badge>}
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 p-2">#</TableHead>
                      <TableHead className="p-2">Atleta</TableHead>
                      {rankField && rankField !== "score" && <TableHead className="p-2 text-right">{RANK_FIELD_LABEL[rankField]}</TableHead>}
                      <TableHead className="p-2 w-24">Origem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranked.map((item) => (
                      <TableRow key={item.entryId} className={item.excluded ? "opacity-50" : ""}>
                        <TableCell className="font-mono font-bold p-2">
                          {item.excluded ? "—" : item.position != null ? `${item.position}º` : "—"}
                        </TableCell>
                        <TableCell className="p-2 font-medium">{item.label}</TableCell>
                        {rankField && rankField !== "score" && (
                          <TableCell className="p-2 text-right font-mono">{formatRankValue(item.rankValue, item.rankField)}</TableCell>
                        )}
                        <TableCell className="p-2">
                          {item.source && <Badge variant="outline" className="text-[8px]">{SOURCE_LABEL[item.source] ?? item.source}</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {isHeat && <p className="text-[10px] text-muted-foreground mt-1 italic">Classificação desta bateria/série.</p>}
              </section>
            </>
          )}

          {/* Attempts */}
          {attemptsData.length > 0 && (
            <>
              <Separator />
              <section>
                <h4 className="font-semibold mb-2 flex items-center gap-1.5"><Target className="h-4 w-4" />Tentativas</h4>
                {entries.map((entry) => {
                  const ea = attemptsData.filter((a: any) => a.match_entry_id === entry.id);
                  if (ea.length === 0) return null;
                  return (
                    <div key={entry.id} className="mb-3">
                      <h5 className="font-medium text-xs mb-1">{getEntryLabel(entry)}</h5>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        {ea.map((a: any) => (
                          <div key={a.id} className={`text-xs rounded border px-2 py-1 flex items-center gap-1.5 ${!a.is_valid ? "opacity-50 line-through" : ""}`}>
                            <span className="font-mono font-bold">#{a.attempt_number}</span>
                            {a.value_cm != null && <span>{formatDistanceCm(a.value_cm)}</span>}
                            {a.value_ms != null && <span>{formatTimeMs(a.value_ms)}</span>}
                            {a.value_points != null && <span>{a.value_points} pts</span>}
                            {!a.is_valid && <Badge variant="destructive" className="text-[8px]">Inv.</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            </>
          )}

          {/* Officials */}
          {officials.length > 0 && (
            <>
              <Separator />
              <section>
                <h4 className="font-semibold mb-2 flex items-center gap-1.5"><Shield className="h-4 w-4" />Oficiais</h4>
                <div className="grid grid-cols-2 gap-2">
                  {officials.map((o) => (
                    <div key={o.id} className="flex items-center gap-2 rounded border p-2">
                      <Badge variant="secondary" className="text-[10px]">{OFFICIAL_ROLE_LABEL[o.role] ?? o.role}</Badge>
                      <span>{o.name}</span>
                    </div>
                  ))}
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
                <h4 className="font-semibold mb-1">Observações</h4>
                <p className="text-muted-foreground">{match.notes}</p>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
