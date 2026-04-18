import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { IndividualConfig } from "./IndividualConfigEditor";
import { computeIndividualRanking, getPrimaryRankField, formatRankValue } from "@/lib/individualRanking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Timer, Ruler, Target, Hash } from "lucide-react";

const FIELD_LABEL: Record<string, string> = {
  time_ms: "Tempo",
  distance_cm: "Distância",
  points: "Pontos",
  score: "Placar",
  position: "Posição",
};

const FIELD_ICON: Record<string, typeof Trophy> = {
  time_ms: Timer,
  distance_cm: Ruler,
  points: Target,
  position: Hash,
};

const SOURCE_LABEL: Record<string, string> = {
  result: "Resultado",
  attempt: "Melhor tentativa",
  manual_position: "Posição manual",
};

const RESULT_STATUS_LABEL: Record<string, string> = {
  resultado_lancado: "Lançado",
  resultado_validado: "Validado",
  publicado: "Publicado",
};

const OUTCOME_LABEL: Record<string, string> = {
  dsq: "DSQ", dns: "DNS", dnf: "DNF", wo_loss: "WO", cancelled: "Canc.",
};

const MATCH_TYPE_LABEL: Record<string, string> = {
  heat: "Bateria/Série",
  bracket: "Chave",
  round_robin: "Pontos corridos",
  direct: "Classificação direta",
};

interface IndividualRankingCardProps {
  matchId: string;
  entries: any[];
  results: any[];
  individualConfig: IndividualConfig | null;
  getEntryLabel: (entry: any) => string;
}

export default function IndividualRankingCard({
  matchId, entries, results, individualConfig, getEntryLabel,
}: IndividualRankingCardProps) {
  const field = getPrimaryRankField(individualConfig);

  const { data: attempts = [] } = useQuery({
    queryKey: ["ranking_attempts", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_attempts" as any)
        .select("*")
        .eq("match_id", matchId)
        .order("attempt_number");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!individualConfig?.allows_attempts,
  });

  const ranked = computeIndividualRanking(entries, results, attempts, individualConfig, getEntryLabel);
  const isHeat = individualConfig?.match_type === "heat";

  if (!field && !ranked.some((r) => r.position != null)) return null;

  const FieldIcon = field ? FIELD_ICON[field] ?? Trophy : Trophy;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Classificação{isHeat ? " da Bateria" : ""}
        </CardTitle>
        <div className="flex items-center gap-2">
          {isHeat && <Badge variant="secondary" className="text-xs">{MATCH_TYPE_LABEL.heat}</Badge>}
          {field && <Badge variant="outline" className="text-xs">Por {FIELD_LABEL[field]}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">Nenhum participante na prova.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Atleta</TableHead>
                {field && field !== "score" && <TableHead className="text-right">{FIELD_LABEL[field]}</TableHead>}
                <TableHead className="w-28">Origem</TableHead>
                <TableHead className="w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranked.map((item) => (
                <TableRow key={item.entryId} className={item.excluded ? "opacity-50" : ""}>
                  <TableCell className="font-mono font-bold text-lg">
                    {item.excluded ? "—" : item.position != null ? `${item.position}º` : "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.label}
                    {item.outcome && OUTCOME_LABEL[item.outcome] && (
                      <Badge variant="destructive" className="ml-2 text-[10px]">{OUTCOME_LABEL[item.outcome]}</Badge>
                    )}
                  </TableCell>
                  {field && field !== "score" && (
                    <TableCell className="text-right font-mono">
                      {formatRankValue(item.rankValue, item.rankField)}
                    </TableCell>
                  )}
                  <TableCell>
                    {item.source && (
                      <Badge variant={item.source === "attempt" ? "secondary" : "outline"} className="text-[10px]">
                        {SOURCE_LABEL[item.source] ?? item.source}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.resultStatus && (
                      <Badge variant="outline" className="text-[10px]">
                        {RESULT_STATUS_LABEL[item.resultStatus] ?? item.resultStatus}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {isHeat && (
          <p className="text-xs text-muted-foreground mt-3 italic">
            Esta é uma bateria/série. A classificação final entre baterias será consolidada em etapa futura.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
