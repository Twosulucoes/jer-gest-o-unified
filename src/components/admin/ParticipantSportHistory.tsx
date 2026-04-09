import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trophy, Users, User, Clock, Ruler, Target } from "lucide-react";

interface Props {
  participantId: string;
}

interface HistoryRow {
  participant_id: string;
  event_id: string;
  sport_event_id: string;
  sport_event_name: string;
  participation_type: string;
  team_id: string | null;
  team_name: string | null;
  phase_id: string | null;
  phase_name: string | null;
  group_id: string | null;
  group_name: string | null;
  match_id: string | null;
  match_date: string | null;
  entry_id: string | null;
  result_id: string | null;
  score: string | null;
  position: number | null;
  result_text: string | null;
  outcome: string | null;
  time_ms: number | null;
  distance_cm: number | null;
  points: number | null;
  result_status: string | null;
  validated_at: string | null;
  published_at: string | null;
  result_notes: string | null;
}

const OUTCOME_LABELS: Record<string, string> = {
  win: "Vitória",
  loss: "Derrota",
  draw: "Empate",
  wo_win: "WO (V)",
  wo_loss: "WO (D)",
  dsq: "Desclassificado",
  dns: "Não compareceu",
  dnf: "Não concluiu",
  cancelled: "Cancelado",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  resultado_lancado: { label: "Lançado", variant: "outline" },
  validado: { label: "Validado", variant: "secondary" },
  publicado: { label: "Publicado", variant: "default" },
};

function formatTimeMs(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec.toFixed(2)}s` : `${sec.toFixed(2)}s`;
}

function formatDistanceCm(cm: number): string {
  return cm >= 100 ? `${(cm / 100).toFixed(2)}m` : `${cm}cm`;
}

export default function ParticipantSportHistory({ participantId }: Props) {
  const { data: history = [], isLoading } = useQuery<HistoryRow[]>({
    queryKey: ["participant_sport_history", participantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_participant_sport_history", {
        _participant_id: participantId,
      });
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
    enabled: !!participantId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <Trophy className="h-8 w-8" />
        <p>Nenhum histórico esportivo encontrado.</p>
      </div>
    );
  }

  // Group by sport_event for better readability
  const grouped = new Map<string, HistoryRow[]>();
  for (const row of history) {
    const key = row.sport_event_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([seId, rows]) => {
        const first = rows[0];
        return (
          <div key={seId} className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">{first.sport_event_name}</h4>
              <Badge variant={first.participation_type === "team" ? "secondary" : "outline"} className="text-xs">
                {first.participation_type === "team" ? (
                  <><Users className="h-3 w-3 mr-1" />{first.team_name}</>
                ) : (
                  <><User className="h-3 w-3 mr-1" />Individual</>
                )}
              </Badge>
            </div>

            {rows.some(r => r.match_id) ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fase</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Desfecho</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.filter(r => r.match_id).map((row) => {
                    const st = row.result_status ? STATUS_LABELS[row.result_status] : null;
                    return (
                      <TableRow key={row.entry_id ?? row.match_id}>
                        <TableCell className="text-sm">{row.phase_name ?? "—"}</TableCell>
                        <TableCell className="text-sm">{row.group_name ?? "—"}</TableCell>
                        <TableCell className="text-sm">
                          {row.match_date ? new Date(row.match_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.score ?? row.result_text ?? (row.position ? `${row.position}º` : "—")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.outcome ? (OUTCOME_LABELS[row.outcome] ?? row.outcome) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex gap-2 flex-wrap">
                            {row.time_ms != null && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />{formatTimeMs(row.time_ms)}
                              </span>
                            )}
                            {row.distance_cm != null && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Ruler className="h-3 w-3" />{formatDistanceCm(row.distance_cm)}
                              </span>
                            )}
                            {row.points != null && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Target className="h-3 w-3" />{Number(row.points).toFixed(1)} pts
                              </span>
                            )}
                            {!row.time_ms && !row.distance_cm && !row.points && "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {st ? (
                            <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                          ) : row.result_id ? (
                            <Badge variant="outline" className="text-xs">—</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem resultado</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground pl-6">Inscrito — sem partidas registradas ainda.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
