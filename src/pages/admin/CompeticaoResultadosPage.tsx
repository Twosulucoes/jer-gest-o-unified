import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

import { useNavigate } from "react-router-dom";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { useActiveEventId } from "@/contexts/EventContext";
import { useUserSportLinks } from "@/hooks/useUserSportLinks";
import { useStageScope } from "@/hooks/useStageScope";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { RESULT_STATUS, RESULT_STATUS_LABEL, RESULT_STATUS_VARIANT } from "@/lib/resultStatus";

type ResultStatusFilter = "all" | "sem_resultado" | typeof RESULT_STATUS.LAUNCHED | typeof RESULT_STATUS.VALIDATED | typeof RESULT_STATUS.PUBLISHED;

const STATUS_LABELS: Record<string, string> = {
  [RESULT_STATUS.LAUNCHED]: RESULT_STATUS_LABEL[RESULT_STATUS.LAUNCHED],
  [RESULT_STATUS.VALIDATED]: RESULT_STATUS_LABEL[RESULT_STATUS.VALIDATED],
  [RESULT_STATUS.PUBLISHED]: RESULT_STATUS_LABEL[RESULT_STATUS.PUBLISHED],
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  [RESULT_STATUS.LAUNCHED]: RESULT_STATUS_VARIANT[RESULT_STATUS.LAUNCHED],
  [RESULT_STATUS.VALIDATED]: RESULT_STATUS_VARIANT[RESULT_STATUS.VALIDATED],
  [RESULT_STATUS.PUBLISHED]: RESULT_STATUS_VARIANT[RESULT_STATUS.PUBLISHED],
};

export default function CompeticaoResultadosPage() {
  const navigate = useNavigate();
  const selectedEventId = useActiveEventId();
  const { sportIds: mySportIds, isCoordModalidade, isLoading: loadingSportLinks } = useUserSportLinks();
  const { isStageScoped, stage, matchIds: stageMatchIds, error: stageError, stageId, participantIds: stageParticipantIds } = useStageScope({ includeMatchIds: true });
  const [statusFilter, setStatusFilter] = useState<ResultStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["competition_phases", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("competition_phases").select("*").eq("event_id", selectedEventId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: sportEvents = [] } = useQuery({
    queryKey: ["sport_events", selectedEventId, mySportIds],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("sport_events").select("*").eq("event_id", selectedEventId);
      if (mySportIds && mySportIds.length > 0) q = q.in("sport_id", mySportIds);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId && (!isCoordModalidade || !loadingSportLinks),
  });

  const sportEventIds = sportEvents.map((se: any) => se.id);

  const { data: matchesRaw = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["competition_matches_results_overview", selectedEventId, sportEventIds],
    queryFn: async () => {
      if (!selectedEventId) return [];
      if (mySportIds && mySportIds.length === 0) return [];
      let q = supabase.from("competition_matches").select("*").eq("event_id", selectedEventId).order("match_date").order("start_time");
      if (mySportIds && mySportIds.length > 0 && sportEventIds.length > 0) {
        q = q.in("sport_event_id", sportEventIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId && (!isCoordModalidade || !loadingSportLinks),
  });

  // Filtro estrito de etapa: se há escopo de etapa, mantém apenas partidas vinculadas
  const matches = isStageScoped && stageMatchIds
    ? matchesRaw.filter((m) => stageMatchIds.has(m.id))
    : matchesRaw;

  const matchIds = matches.map((m) => m.id);
  const { data: allResults = [] } = useQuery({
    queryKey: ["competition_match_results_overview", matchIds.length],
    queryFn: async () => {
      if (!matchIds.length) return [];
      const { data, error } = await supabase.from("competition_match_results").select("match_id, result_status").in("match_id", matchIds);
      if (error) throw error;
      return data;
    },
    enabled: matchIds.length > 0,
  });

  const phasesMap = new Map(phases.map((p) => [p.id, p]));
  const sportEventsMap = new Map(sportEvents.map((se) => [se.id, se]));

  // Compute result status per match
  const matchResultStatus = new Map<string, string>();
  const resultsByMatch = new Map<string, typeof allResults>();
  allResults.forEach((r) => {
    if (!resultsByMatch.has(r.match_id)) resultsByMatch.set(r.match_id, []);
    resultsByMatch.get(r.match_id)!.push(r);
  });
  matches.forEach((m) => {
    const rs = resultsByMatch.get(m.id);
    if (!rs || rs.length === 0) {
      matchResultStatus.set(m.id, "sem_resultado");
    } else if (rs.every((r) => r.result_status === "publicado")) {
      matchResultStatus.set(m.id, "publicado");
    } else if (rs.every((r) => r.result_status === "resultado_validado" || r.result_status === "publicado")) {
      matchResultStatus.set(m.id, "resultado_validado");
    } else {
      matchResultStatus.set(m.id, "resultado_lancado");
    }
  });

  const stageScopedMatches = isStageScoped
    ? (stageMatchIds ? matches.filter((m) => stageMatchIds.has(m.id)) : [])
    : matches;

  const filtered = statusFilter === "all"
    ? stageScopedMatches
    : stageScopedMatches.filter((m) => matchResultStatus.get(m.id) === statusFilter);

  const formatDate = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const getStatusBadge = (status: string) => {
    if (status === "sem_resultado") return <Badge variant="outline">Sem resultado</Badge>;
    return <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>{STATUS_LABELS[status] ?? status}</Badge>;
  };

  // Counts
  const counts = { all: stageScopedMatches.length, sem_resultado: 0, resultado_lancado: 0, resultado_validado: 0, publicado: 0 };
  stageScopedMatches.forEach((m) => { const s = matchResultStatus.get(m.id) ?? "sem_resultado"; counts[s as keyof typeof counts]++; });

  return (
    <div className="animate-fade-in space-y-6">
      <ModuleHeader route="/admin/competicao/resultados" />

      {isStageScoped && stage && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Etapa: {stage.name}</AlertTitle>
          <AlertDescription>
            Exibindo apenas partidas com participantes vinculados a esta etapa.
          </AlertDescription>
        </Alert>
      )}

      {stageError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar escopo da etapa</AlertTitle>
          <AlertDescription>
            Não foi possível filtrar as partidas pela etapa selecionada ({stageError.message}).
            Verifique suas permissões ou contate o administrador.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={(v) => { setStatusFilter("all"); setCurrentPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Status do resultado</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as ResultStatusFilter); setCurrentPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos ({counts.all})</SelectItem>
                  <SelectItem value="sem_resultado">Sem resultado ({counts.sem_resultado})</SelectItem>
                  <SelectItem value="resultado_lancado">Lançado ({counts.resultado_lancado})</SelectItem>
                  <SelectItem value="resultado_validado">Validado ({counts.resultado_validado})</SelectItem>
                  <SelectItem value="publicado">Publicado ({counts.publicado})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : loadingMatches ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma partida neste filtro</p>
        </div>
      ) : (
        (() => {
          const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
          const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
          return (
            <>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prova</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Status partida</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((m) => {
                      const phase = phasesMap.get(m.phase_id);
                      const se = phase ? sportEventsMap.get(phase.sport_event_id) : null;
                      const rStatus = matchResultStatus.get(m.id) ?? "sem_resultado";
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{se?.name ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{phase?.name ?? "—"}</TableCell>
                          <TableCell>{formatDate(m.match_date)}</TableCell>
                          <TableCell className="font-mono text-xs">{m.start_time?.slice(0, 5) ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={m.status === "finished" ? "secondary" : m.status === "in_progress" ? "default" : "outline"}>
                              {m.status === "scheduled" ? "Agendada" : m.status === "in_progress" ? "Em andamento" : m.status === "finished" ? "Finalizada" : "Cancelada"}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(rStatus)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/competicao/partida/${m.id}`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{filtered.length} partidas — página {currentPage} de {totalPages}</p>
                  <Pagination>
                    <PaginationContent>
                      {currentPage > 1 && (
                        <PaginationItem><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => p - 1); }} /></PaginationItem>
                      )}
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        const page = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                        return (
                          <PaginationItem key={page}><PaginationLink href="#" isActive={page === currentPage} onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}>{page}</PaginationLink></PaginationItem>
                        );
                      })}
                      {currentPage < totalPages && (
                        <PaginationItem><PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => p + 1); }} /></PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
