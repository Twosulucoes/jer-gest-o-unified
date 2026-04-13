import { useCrossHeatRanking } from "@/hooks/useCrossHeatRanking";
import type { IndividualConfig } from "./IndividualConfigEditor";
import { formatRankValue, getPrimaryRankField } from "@/lib/individualRanking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";

const FIELD_LABEL: Record<string, string> = {
  time_ms: "Tempo",
  distance_cm: "Distância",
  points: "Pontos",
};

const OUTCOME_LABEL: Record<string, string> = {
  dsq: "DSQ", dns: "DNS", dnf: "DNF", wo_loss: "WO", cancelled: "Canc.",
};

interface Props {
  matchId: string;
  eventId: string;
  sportEventId: string;
  family: "time" | "mark";
  individualConfig: IndividualConfig | null;
}

export default function CrossHeatRankingCard({
  matchId, eventId, sportEventId, family, individualConfig,
}: Props) {
  const field = getPrimaryRankField(individualConfig);
  const { ranking, heatsWithResults, totalHeats, isLoading, error } = useCrossHeatRanking(
    eventId, sportEventId, family, individualConfig, matchId
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ranking Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || ranking.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Ranking Geral (todas as baterias)
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {heatsWithResults}/{totalHeats} baterias
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Atleta</TableHead>
                <TableHead>Escola</TableHead>
                <TableHead>Bateria</TableHead>
                {field && <TableHead className="text-right">{FIELD_LABEL[field] ?? field}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((item) => (
                <TableRow
                  key={item.entryId}
                  className={
                    item.excluded
                      ? "opacity-50"
                      : item.isCurrentMatch
                        ? "bg-primary/5"
                        : ""
                  }
                >
                  <TableCell className="font-mono font-bold text-lg">
                    {item.excluded ? "—" : item.position != null ? `${item.position}º` : "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.label}
                    {item.isCurrentMatch && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">esta bateria</Badge>
                    )}
                    {item.outcome && OUTCOME_LABEL[item.outcome] && (
                      <Badge variant="destructive" className="ml-1 text-[10px]">{OUTCOME_LABEL[item.outcome]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.delegationName || "—"}</TableCell>
                  <TableCell className="text-sm">{item.heatName}</TableCell>
                  {field && (
                    <TableCell className="text-right font-mono">
                      {formatRankValue(item.rankValue, item.rankField)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
