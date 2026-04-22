import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useActiveEventId } from "@/contexts/EventContext";
import { useCompetitionContext } from "@/contexts/CompetitionContext";
import { useUserSportLinks } from "@/hooks/useUserSportLinks";
import { useStageScope } from "@/hooks/useStageScope";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Pencil, Swords, CalendarDays, MapPin, Eye, Filter, List, Calendar, AlertTriangle, AlertCircle } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import CompetitionMatchFormDialog, { type MatchFormValues } from "@/components/admin/CompetitionMatchFormDialog";

type ViewMode = "list" | "calendar";

const STATUS_LABEL: Record<string, string> = { scheduled: "Agendada", in_progress: "Em andamento", finished: "Finalizada", cancelled: "Cancelada" };
const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" =>
  s === "in_progress" ? "default" : s === "finished" ? "secondary" : s === "cancelled" ? "destructive" : "outline";

export default function CompeticaoPartidasAgendaPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const { sportIds: mySportIds, isCoordModalidade, isLoading: loadingSportLinks } = useUserSportLinks();
  const { isStageScoped, stage, matchIds: stageMatchIds, error: stageError, stageId } = useStageScope({ includeMatchIds: true });
  const { selectedSportEventId, setSelectedSportEventId, selectedStageId, setSelectedStageId } = useCompetitionContext();

  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("partidas-view") as ViewMode) || "list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const canWrite = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  useEffect(() => { localStorage.setItem("partidas-view", viewMode); }, [viewMode]);

  // Sincroniza etapa detectada com o contexto global
  useEffect(() => {
    if (stageId) setSelectedStageId(stageId);
  }, [stageId, setSelectedStageId]);

  const { data: sportEvents = [] } = useQuery({
    queryKey: ["sport_events", selectedEventId, mySportIds],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("sport_events").select("*").eq("event_id", selectedEventId).order("name");
      if (mySportIds && mySportIds.length > 0) q = q.in("sport_id", mySportIds);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId && (!isCoordModalidade || !loadingSportLinks),
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["competition_phases", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("competition_phases").select("*").eq("event_id", selectedEventId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["competition_groups", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("competition_groups").select("*").eq("event_id", selectedEventId).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["venues", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("venues").select("*").eq("event_id", selectedEventId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  // Filter matches — if coordenador_modalidade, restrict to sport_events from linked sports
  const sportEventIds = sportEvents.map((se: any) => se.id);

  const { data: matchesRaw = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["competition_matches", selectedEventId, mySportIds],
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

  const isLoading = loadingMatches || loadingSportLinks;

  // Apply stage filter if present
  const matches = isStageScoped && stageMatchIds
    ? matchesRaw.filter((m) => stageMatchIds.has(m.id))
    : matchesRaw;

  const phasesMap = new Map(phases.map((p) => [p.id, p]));

  const groupsMap = new Map(groups.map((g) => [g.id, g]));
  const venuesMap = new Map(venues.map((v) => [v.id, v]));
  const sportEventsMap = new Map(sportEvents.map((se) => [se.id, se]));

  const filtered = matches.filter((m) => {
    if (selectedSportEventId && m.sport_event_id !== selectedSportEventId) return false;
    if (selectedPhaseId && m.phase_id !== selectedPhaseId) return false;
    if (selectedDate && m.match_date !== selectedDate) return false;
    return true;
  });

  const filteredPhases = selectedSportEventId ? phases.filter((p) => p.sport_event_id === selectedSportEventId) : phases;


  const createMut = useMutation({
    mutationFn: async (v: MatchFormValues) => {
      const { error } = await supabase.from("competition_matches").insert({
        event_id: selectedEventId,
        phase_id: v.phase_id,
        group_id: v.group_id || null,
        match_number: v.match_number || null,
        match_date: v.match_date || null,
        start_time: v.start_time || null,
        venue_id: v.venue_id || null,
        status: v.status,
        notes: v.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_matches"] }); toast.success("Partida criada"); setDialogOpen(false); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...v }: MatchFormValues & { id: string }) => {
      const { error } = await supabase.from("competition_matches").update({
        phase_id: v.phase_id,
        group_id: v.group_id || null,
        match_number: v.match_number || null,
        match_date: v.match_date || null,
        start_time: v.start_time || null,
        venue_id: v.venue_id || null,
        status: v.status,
        notes: v.notes || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competition_matches"] }); toast.success("Partida atualizada"); setDialogOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const handleSubmit = (v: MatchFormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, ...v });
    else createMut.mutate(v);
  };

  const formatDateShort = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
  const formatDateLong = (d: string) => d === "sem-data" ? "Sem data definida" : new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  // Group by date for calendar view
  const matchesByDate = new Map<string, typeof filtered>();
  filtered.forEach((m) => {
    const d = m.match_date ?? "sem-data";
    if (!matchesByDate.has(d)) matchesByDate.set(d, []);
    matchesByDate.get(d)!.push(m);
  });

  const emptyState = (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
      <Swords className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-muted-foreground font-medium">
        {!selectedEventId ? "Selecione um evento" : "Nenhuma partida encontrada"}
      </p>
      {selectedEventId && <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou cadastre partidas.</p>}
    </div>
  );

  if (isCoordModalidade && mySportIds && mySportIds.length === 0) {
    return (
      <div className="animate-fade-in space-y-6">
        <ModuleHeader route="/admin/competicao/partidas-agenda" />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Você não tem modalidades atribuídas. Contate o administrador para vincular modalidades ao seu perfil.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <ModuleHeader
        route="/admin/competicao/partidas-agenda"
        actions={
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)} size="sm">
              <ToggleGroupItem value="list" aria-label="Lista"><List className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="calendar" aria-label="Calendário"><Calendar className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
            {canWrite && selectedEventId && (
              <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />Nova partida
              </Button>
            )}
          </div>
        }
      />

      {isStageScoped && stage && (
        <Alert className="bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 dark:text-blue-300">Etapa: {stage.name}</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-400">
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
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Modalidade/Prova</label>
              <Select value={selectedSportEventId || "__all__"} onValueChange={(v) => { setSelectedSportEventId(v === "__all__" ? null : v); setSelectedPhaseId(""); setCurrentPage(1); }} disabled={!selectedEventId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {sportEvents.map((se) => <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Fase</label>
              <Select value={selectedPhaseId || "__all__"} onValueChange={(v) => setSelectedPhaseId(v === "__all__" ? "" : v)} disabled={!selectedEventId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {filteredPhases.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Data</label>
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} disabled={!selectedEventId} />
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Content */}
      {!selectedEventId || (!isLoading && !filtered.length) ? emptyState : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : viewMode === "list" ? (
        /* LIST VIEW */
        (() => {
          const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
          const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
          return (
            <>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Prova</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Status</TableHead>
                      {canWrite && <TableHead className="w-[60px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((m) => {
                      const phase = phasesMap.get(m.phase_id);
                      const se = phase ? sportEventsMap.get(phase.sport_event_id) : null;
                      return (
                        <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/admin/competicao/partida/${m.id}`)}>
                          <TableCell className="font-mono text-sm">{m.match_number ?? "—"}</TableCell>
                          <TableCell className="font-medium">{se?.name ?? "—"}</TableCell>
                          <TableCell>{phase?.name ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{m.group_id ? groupsMap.get(m.group_id)?.name ?? "—" : "—"}</TableCell>
                          <TableCell>{formatDateShort(m.match_date)}</TableCell>
                          <TableCell className="font-mono text-xs">{m.start_time?.slice(0, 5) ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{m.venue_id ? venuesMap.get(m.venue_id)?.name ?? "—" : "—"}</TableCell>
                          <TableCell><Badge variant={statusVariant(m.status)}>{STATUS_LABEL[m.status] || m.status}</Badge></TableCell>
                          {canWrite && (
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditing(m); setDialogOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
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
      ) : (
        /* CALENDAR VIEW */
        <div className="space-y-6">
          {Array.from(matchesByDate.entries()).map(([date, dayMatches]) => (
            <div key={date}>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-3 capitalize">{formatDateLong(date)}</h3>
              <div className="space-y-2">
                {dayMatches.map((m) => {
                  const phase = phasesMap.get(m.phase_id);
                  const se = phase ? sportEventsMap.get(phase.sport_event_id) : null;
                  const venue = m.venue_id ? venuesMap.get(m.venue_id) : null;
                  return (
                    <Card key={m.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate(`/admin/competicao/partida/${m.id}`)}>
                      <CardContent className="py-3 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm font-bold text-muted-foreground w-12">
                            {m.start_time?.slice(0, 5) ?? "—"}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {se?.name ?? "—"} — {phase?.name ?? "—"}
                              {m.match_number ? ` #${m.match_number}` : ""}
                            </p>
                            {venue && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3" /> {venue.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant(m.status)}>{STATUS_LABEL[m.status] || m.status}</Badge>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <CompetitionMatchFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        match={editing}
        phases={phases}
        groups={groups}
        venues={venues}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}
