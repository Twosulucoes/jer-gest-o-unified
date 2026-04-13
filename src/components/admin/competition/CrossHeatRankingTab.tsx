import { useState, useMemo } from "react";
import { useCrossHeatRanking } from "@/hooks/useCrossHeatRanking";
import { useSportEventRules } from "@/hooks/useSportEventRules";
import { formatRankValue, getPrimaryRankField } from "@/lib/individualRanking";
import type { IndividualConfig } from "@/components/admin/IndividualConfigEditor";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, AlertTriangle, Info, RefreshCw, CheckCircle2, Search } from "lucide-react";

const FIELD_LABEL: Record<string, string> = {
  time_ms: "Tempo",
  distance_cm: "Distância",
  points: "Pontos",
};

const OUTCOME_LABEL: Record<string, string> = {
  dsq: "DSQ", dns: "DNS", dnf: "DNF", wo_loss: "WO", cancelled: "Canc.",
};

interface Props {
  eventId: string | undefined;
  sportEventId: string;
}

export default function CrossHeatRankingTab({ eventId, sportEventId }: Props) {
  const [filterHeat, setFilterHeat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  // Get sport info for config
  const { data: sportEvent } = useQuery({
    queryKey: ["sport_event_for_standings", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sport_events").select("sport_id").eq("id", sportEventId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sport } = useQuery({
    queryKey: ["sport_for_standings", sportEvent?.sport_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sports").select("match_config, is_collective").eq("id", sportEvent!.sport_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!sportEvent?.sport_id,
  });

  const { rules } = useSportEventRules(eventId, sportEventId);
  const family = (rules?.family as "time" | "mark") ?? null;

  const individualConfig: IndividualConfig | null = sport
    ? ((sport.match_config as any)?.individual_config as IndividualConfig | undefined) ?? null
    : null;

  const field = getPrimaryRankField(individualConfig);

  const { ranking, heats, heatsWithResults, totalHeats, totalAthletes, isLoading, error, refetch } =
    useCrossHeatRanking(eventId, sportEventId, family, individualConfig);

  const filtered = useMemo(() => {
    let list = ranking;
    if (filterHeat !== "all") {
      list = list.filter((r) => r.matchId === filterHeat);
    }
    if (filterStatus === "classified") {
      list = list.filter((r) => !r.excluded && r.rankValue != null);
    } else if (filterStatus === "excluded") {
      list = list.filter((r) => r.excluded);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.label.toLowerCase().includes(q) || r.delegationName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [ranking, filterHeat, filterStatus, search]);

  const handleExportCSV = () => {
    const header = ["Posição", "Atleta", "Escola", "Bateria", field ? FIELD_LABEL[field] ?? field : "Resultado", "Status"];
    const rows = ranking.map((r) => [
      r.excluded ? "" : String(r.position ?? ""),
      r.label,
      r.delegationName,
      r.heatName,
      formatRankValue(r.rankValue, r.rankField),
      r.outcome ? OUTCOME_LABEL[r.outcome] ?? r.outcome : r.resultStatus ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ranking-geral-${sportEventId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          Erro ao calcular ranking: {error.message}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (totalHeats === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Configure as baterias no Passo 2 (Estrutura) primeiro.
        </AlertDescription>
      </Alert>
    );
  }

  if (ranking.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Nenhum resultado lançado ainda. Lance os resultados nas partidas de cada bateria.
        </AlertDescription>
      </Alert>
    );
  }

  const allComplete = heatsWithResults === totalHeats;

  return (
    <div className="space-y-4">
      {/* Progress banner */}
      {allComplete ? (
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary">
            Todas as {totalHeats} baterias com resultados lançados ✅
          </AlertDescription>
        </Alert>
      ) : (
        <div className="text-xs text-muted-foreground">
          {heatsWithResults} de {totalHeats} baterias com resultados lançados · {totalAthletes} atletas
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar atleta ou escola..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={filterHeat} onValueChange={setFilterHeat}>
          <SelectTrigger className="w-[160px] h-8 text-sm">
            <SelectValue placeholder="Bateria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as baterias</SelectItem>
            {heats.map((h) => (
              <SelectItem key={h.matchId} value={h.matchId}>{h.heatName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-8 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="classified">Classificados</SelectItem>
            <SelectItem value="excluded">Desclassificados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8">
          <Download className="h-3 w-3 mr-1" />
          CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Atleta</TableHead>
              <TableHead>Escola</TableHead>
              <TableHead>Bateria</TableHead>
              {field && <TableHead className="text-right">{FIELD_LABEL[field] ?? field}</TableHead>}
              <TableHead className="w-24">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
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
                <TableCell className="text-sm text-muted-foreground">{item.delegationName || "—"}</TableCell>
                <TableCell className="text-sm">{item.heatName}</TableCell>
                {field && (
                  <TableCell className="text-right font-mono">
                    {formatRankValue(item.rankValue, item.rankField)}
                  </TableCell>
                )}
                <TableCell>
                  {item.resultStatus && (
                    <Badge variant="outline" className="text-[10px]">
                      {item.resultStatus === "resultado_lancado" ? "Lançado"
                        : item.resultStatus === "resultado_validado" ? "Validado"
                        : item.resultStatus === "publicado" ? "Publicado"
                        : item.resultStatus}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={field ? 6 : 5} className="text-center text-muted-foreground py-8">
                  Nenhum resultado encontrado com os filtros atuais.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
