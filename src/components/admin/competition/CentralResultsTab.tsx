import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  eventId: string;
  sportEventId: string;
}

export default function CentralResultsTab({ eventId, sportEventId }: Props) {
  const { data: matchesWithResults = [], isLoading } = useQuery({
    queryKey: ["central-results", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          id, match_number, status, match_date,
          competition_phases(name),
          competition_groups(name),
          competition_match_entries(
            id, side, team_id,
            teams(name),
            participant_sport_events(participants(person_id, people(full_name))),
            competition_match_results(id, outcome, score, time_ms, distance_cm, points, result_status, position)
          )
        `)
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .in("status", ["finished", "in_progress"])
        .order("match_number");
      if (error) throw error;
      return data;
    },
  });

  const exportCSV = () => {
    if (matchesWithResults.length === 0) return;
    const rows = [["Partida", "Fase", "Grupo", "Status", "Lado", "Participante/Equipe", "Resultado", "Placar", "Posição"].join(",")];
    for (const m of matchesWithResults as any[]) {
      for (const e of m.competition_match_entries ?? []) {
        const label = e.teams?.name ?? e.participant_sport_events?.participants?.people?.full_name ?? "—";
        const r = e.competition_match_results;
        rows.push([
          m.match_number ?? "",
          m.competition_phases?.name ?? "",
          m.competition_groups?.name ?? "",
          m.status,
          e.side,
          `"${label}"`,
          r?.outcome ?? "",
          r?.score ?? "",
          r?.position ?? "",
        ].join(","));
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resultados.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Resultados Lançados</h3>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={matchesWithResults.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : matchesWithResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma partida com resultado lançado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Participantes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(matchesWithResults as any[]).map((m) => {
                  const entries = m.competition_match_entries ?? [];
                  const labels = entries.map((e: any) => {
                    const name = e.teams?.name ?? e.participant_sport_events?.participants?.people?.full_name ?? "?";
                    const result = e.competition_match_results;
                    const outcome = result?.outcome ?? "";
                    return `${name} (${outcome || "—"})`;
                  });

                  return (
                    <TableRow key={m.id}>
                      <TableCell>{m.match_number ?? "—"}</TableCell>
                      <TableCell>{m.competition_phases?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === "finished" ? "default" : "secondary"}>
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{labels.join(" × ")}</TableCell>
                      <TableCell>
                        <Link to={`/admin/competicao/partida/${m.id}`}>
                          <Button variant="ghost" size="icon">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
