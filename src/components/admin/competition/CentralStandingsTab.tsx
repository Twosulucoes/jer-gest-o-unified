import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStandings, type StandingEntry } from "@/hooks/useStandings";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  eventId: string | undefined;
  sportEventId: string;
  family: string | null;
  format: string | null;
}

export default function CentralStandingsTab({ eventId, sportEventId, family, format }: Props) {
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  // Fetch groups for this sport_event's phases
  const { data: groups = [] } = useQuery({
    queryKey: ["standings-groups", eventId, sportEventId],
    queryFn: async () => {
      const { data: phases } = await supabase
        .from("competition_phases")
        .select("id")
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId);
      if (!phases?.length) return [];
      const phaseIds = phases.map((p) => p.id);
      const { data, error } = await supabase
        .from("competition_groups")
        .select("id, name, phase_id")
        .in("phase_id", phaseIds)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!eventId && !!sportEventId,
  });

  const activeGroupId = selectedGroup === "all" ? null : selectedGroup;

  const { data: standings, isLoading, error, refetch } = useStandings(
    eventId,
    sportEventId,
    family,
    null,
    activeGroupId
  );

  const isScore = family === "score";
  const isSets = family === "sets";
  const isRanking = family === "time" || family === "mark" || family === "ranking" || family === "swiss";

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center gap-2">
          Erro ao calcular classificação: {(error as Error).message}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const rows = standings?.standings ?? [];
  const meta = standings?.meta;

  if (rows.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {meta?.note === "awaiting_results"
            ? "Aguardando lançamento de resultados para gerar classificação."
            : "Sem resultados suficientes para classificar ainda."}
          {meta?.matches_count != null && meta.matches_count > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({meta.matches_finalized_count}/{meta.matches_count} partidas finalizadas)
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {groups.length > 1 && (
        <Tabs value={selectedGroup} onValueChange={setSelectedGroup}>
          <TabsList>
            <TabsTrigger value="all">Geral</TabsTrigger>
            {groups.map((g) => (
              <TabsTrigger key={g.id} value={g.id}>
                {g.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {meta && (
        <div className="text-xs text-muted-foreground flex gap-3">
          {meta.matches_count != null && (
            <span>{meta.matches_finalized_count}/{meta.matches_count} partidas finalizadas</span>
          )}
          {meta.results_count != null && <span>{meta.results_count} resultados</span>}
        </div>
      )}

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Participante</TableHead>
              <TableHead className="text-center w-10">P</TableHead>
              {isScore && (
                <>
                  <TableHead className="text-center w-10">J</TableHead>
                  <TableHead className="text-center w-10">V</TableHead>
                  <TableHead className="text-center w-10">E</TableHead>
                  <TableHead className="text-center w-10">D</TableHead>
                  <TableHead className="text-center w-12">GP</TableHead>
                  <TableHead className="text-center w-12">GC</TableHead>
                  <TableHead className="text-center w-12">SG</TableHead>
                  <TableHead className="text-center w-14">Avg</TableHead>
                  <TableHead className="text-center w-10">WO</TableHead>
                </>
              )}
              {isSets && (
                <>
                  <TableHead className="text-center w-10">J</TableHead>
                  <TableHead className="text-center w-10">V</TableHead>
                  <TableHead className="text-center w-10">D</TableHead>
                  <TableHead className="text-center w-12">SF</TableHead>
                  <TableHead className="text-center w-12">SA</TableHead>
                  <TableHead className="text-center w-14">SQ</TableHead>
                  <TableHead className="text-center w-12">PF</TableHead>
                  <TableHead className="text-center w-12">PA</TableHead>
                  <TableHead className="text-center w-14">PQ</TableHead>
                  <TableHead className="text-center w-10">WO</TableHead>
                </>
              )}
              {isRanking && (
                <>
                  {family === "time" && <TableHead className="text-center">Tempo</TableHead>}
                  {family === "mark" && <TableHead className="text-center">Distância</TableHead>}
                  {(family === "ranking" || family === "swiss") && <TableHead className="text-center">Pontos</TableHead>}
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row: StandingEntry, idx: number) => (
              <TableRow key={row.participant_id || idx}>
                <TableCell className="font-medium text-center">{row.rank}</TableCell>
                <TableCell>
                  <span className="font-medium">{row.participant_label}</span>
                  {row.tie_unresolved && (
                    <Badge variant="outline" className="ml-2 text-[10px]">Empate</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center font-bold">{row.points_table ?? row.points ?? "-"}</TableCell>
                {isScore && (
                  <>
                    <TableCell className="text-center">{row.played}</TableCell>
                    <TableCell className="text-center">{row.wins}</TableCell>
                    <TableCell className="text-center">{row.draws ?? 0}</TableCell>
                    <TableCell className="text-center">{row.losses}</TableCell>
                    <TableCell className="text-center">{row.points_for}</TableCell>
                    <TableCell className="text-center">{row.points_against}</TableCell>
                    <TableCell className="text-center">{row.goal_diff}</TableCell>
                    <TableCell className="text-center">{row.goal_average ?? "-"}</TableCell>
                    <TableCell className="text-center">
                      {(row.wo_for > 0 || row.wo_against > 0) ? `${row.wo_for}/${row.wo_against}` : "-"}
                    </TableCell>
                  </>
                )}
                {isSets && (
                  <>
                    <TableCell className="text-center">{row.played}</TableCell>
                    <TableCell className="text-center">{row.wins}</TableCell>
                    <TableCell className="text-center">{row.losses}</TableCell>
                    <TableCell className="text-center">{row.sets_for ?? 0}</TableCell>
                    <TableCell className="text-center">{row.sets_against ?? 0}</TableCell>
                    <TableCell className="text-center">{row.sets_quotient ?? "-"}</TableCell>
                    <TableCell className="text-center">{row.pts_for ?? 0}</TableCell>
                    <TableCell className="text-center">{row.pts_against ?? 0}</TableCell>
                    <TableCell className="text-center">{row.pts_quotient ?? "-"}</TableCell>
                    <TableCell className="text-center">
                      {(row.wo_for > 0 || row.wo_against > 0) ? `${row.wo_for}/${row.wo_against}` : "-"}
                    </TableCell>
                  </>
                )}
                {isRanking && (
                  <>
                    {family === "time" && (
                      <TableCell className="text-center">
                        {row.time_ms != null ? formatTime(row.time_ms) : row.result_text ?? "-"}
                      </TableCell>
                    )}
                    {family === "mark" && (
                      <TableCell className="text-center">
                        {row.distance_cm != null ? formatDistance(row.distance_cm) : row.result_text ?? "-"}
                      </TableCell>
                    )}
                    {(family === "ranking" || family === "swiss") && (
                      <TableCell className="text-center">{row.points ?? "-"}</TableCell>
                    )}
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  }
  return `${seconds.toFixed(2)}s`;
}

function formatDistance(cm: number): string {
  if (cm >= 100) {
    return `${(cm / 100).toFixed(2)}m`;
  }
  return `${cm}cm`;
}
