import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, ChevronRight, ArrowLeft, Calendar, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parse } from "date-fns";
import { VisualIdentity } from "@/components/public/VisualIdentity";

export default function PublicResultsPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedSportEventId, setSelectedSportEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("results");

  // Fetch public events
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["public-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, year, status, is_public, public_agenda_published")
        .eq("is_public", true)
        .order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedEvent = events.find(e => e.id === selectedEventId);

  // Fetch sport_events for selected event
  const { data: sportEvents = [], isLoading: loadingSportEvents } = useQuery({
    queryKey: ["public-sport-events", selectedEventId],
    enabled: !!selectedEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select(`
          id, gender, 
          sports(name, is_collective),
          categories(name)
        `)
        .eq("event_id", selectedEventId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch published results for selected sport_event.
  // Importante: filtramos por result_status='publicado' E pelo evento ativo,
  // garantindo que apenas resultados oficialmente publicados (vinculados a
  // um boletim publicado via rpc_publish_results_for_sport_event) cheguem ao
  // portal público.
  const {
    data: results = [],
    isLoading: loadingResults,
    error: resultsError,
  } = useQuery({
    queryKey: ["public-results-detail", selectedEventId, selectedSportEventId],
    enabled: !!selectedSportEventId && activeTab === "results",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_match_results")
        .select(`
          id, outcome, score, time_ms, distance_cm, points, position, result_status, combat_detail,
          published_at,
          competition_match_entries(
            side,
            teams(name),
            participant_sport_events(participants(people(full_name)))
          ),
          competition_matches!inner(
            match_number, match_date, status, sport_event_id, event_id,
            competition_phases(name),
            competition_groups(name)
          )
        `)
        .eq("result_status", "publicado")
        .eq("competition_matches.event_id", selectedEventId!)
        .eq("competition_matches.sport_event_id", selectedSportEventId!)
        .order("published_at", { ascending: false });
      if (error) throw error;
      // O !inner já garante o join; nada de filter extra que pudesse mascarar
      // resultados válidos quando o JSON aninhado vier nulo por algum motivo.
      return data ?? [];
    },
  });

  // Fetch agenda (matches) for selected sport_event
  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["public-agenda-detail", selectedSportEventId],
    enabled: !!selectedSportEventId && activeTab === "agenda" && !!selectedEvent?.public_agenda_published,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          id, match_number, match_date, start_time, status,
          competition_phases(name),
          competition_groups(name),
          venues(name, is_active, deleted_at),
          competition_match_entries(
            side,
            teams(name),
            participant_sport_events(participants(people(full_name)))
          )
        `)
        .eq("sport_event_id", selectedSportEventId!)
        .not("match_date", "is", null)
        .order("match_date")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const handleBack = () => {
    if (selectedSportEventId) {
      setSelectedSportEventId(null);
    } else if (selectedEventId) {
      setSelectedEventId(null);
    }
  };

  const currentTitle = selectedSportEventId
    ? "Detalhes da Prova"
    : selectedEventId
    ? "Provas do Evento"
    : "Portal Público";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            {(selectedEventId || selectedSportEventId) && (
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <VisualIdentity size="sm" subtitle={currentTitle} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 space-y-4">
        {/* Event listing */}
        {!selectedEventId && (
          <div className="grid gap-4">
            {loadingEvents ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : events.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum evento em fase de divulgação no momento.
                </CardContent>
              </Card>
            ) : (
              events.map((ev) => (
                <Card
                  key={ev.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
                  onClick={() => setSelectedEventId(ev.id)}
                >
                  <CardContent className="flex items-center justify-between py-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-3 rounded-xl group-hover:bg-primary/20 transition-colors">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">{ev.name}</p>
                        <p className="text-sm text-muted-foreground">{ev.year}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Sport events listing */}
        {selectedEventId && !selectedSportEventId && (
          <div className="grid gap-3">
            {loadingSportEvents ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : sportEvents.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhuma prova encontrada para este evento.
                </CardContent>
              </Card>
            ) : (
              sportEvents.map((se: any) => (
                <Card
                  key={se.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
                  onClick={() => setSelectedSportEventId(se.id)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {se.sports?.name} — {se.categories?.name}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {se.gender === "M" ? "Masculino" : se.gender === "F" ? "Feminino" : "Misto"}
                        </Badge>
                        {se.sports?.is_collective && <Badge variant="secondary" className="text-[10px]">Coletiva</Badge>}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Prova Detail with Tabs */}
        {selectedSportEventId && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid grid-cols-2 w-[300px]">
                <TabsTrigger value="results" className="gap-2">
                  <Trophy className="h-4 w-4" /> Resultados
                </TabsTrigger>
                <TabsTrigger value="agenda" className="gap-2" disabled={!selectedEvent?.public_agenda_published}>
                  <Calendar className="h-4 w-4" /> Agenda
                </TabsTrigger>
              </TabsList>
              {!selectedEvent?.public_agenda_published && activeTab === "agenda" && (
                <p className="text-[10px] text-destructive font-medium italic">Agenda ainda não divulgada</p>
              )}
            </div>

            <TabsContent value="results" className="space-y-3 mt-0">
              {loadingResults ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : resultsError ? (
                <Card className="border-destructive/40 bg-destructive/5">
                  <CardContent className="py-12 text-center space-y-2">
                    <p className="font-semibold text-destructive">Não foi possível carregar os resultados.</p>
                    <p className="text-xs text-muted-foreground">
                      {(resultsError as Error).message}
                    </p>
                  </CardContent>
                </Card>
              ) : results.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground space-y-2">
                    <p className="font-medium">Nenhum resultado publicado para esta prova.</p>
                    <p className="text-xs">
                      Resultados só aparecem aqui após serem <strong>validados</strong> pela
                      coordenação técnica e <strong>vinculados a um Boletim Oficial publicado</strong>.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                results.map((r: any) => {
                  const entry = r.competition_match_entries;
                  const match = r.competition_matches;
                  const name =
                    entry?.teams?.name ??
                    entry?.participant_sport_events?.participants?.people?.full_name ??
                    "—";

                  return (
                    <Card key={r.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-foreground">{name}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Partida #{match?.match_number ?? "—"} · {match?.competition_phases?.name ?? ""}
                              {match?.competition_groups?.name ? ` · ${match.competition_groups.name}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            {r.score && (
                              <p className="text-xl font-black text-primary">
                                {r.score}
                                {r.combat_detail?.shootout && (
                                  <span className="text-sm font-bold text-muted-foreground ml-1">
                                    ({r.combat_detail.shootout})
                                  </span>
                                )}
                              </p>
                            )}
                            {r.position && (
                              <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 font-bold">
                                {r.position}º lugar
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="agenda" className="space-y-3 mt-0">
              {!selectedEvent?.public_agenda_published ? (
                <Card className="border-dashed border-destructive/50 bg-destructive/5">
                  <CardContent className="py-12 text-center">
                    <Calendar className="h-10 w-10 text-destructive/40 mx-auto mb-3" />
                    <p className="text-destructive font-medium">A agenda oficial desta prova ainda não foi liberada para divulgação.</p>
                  </CardContent>
                </Card>
              ) : loadingMatches ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : matches.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Nenhuma partida agendada no momento.
                  </CardContent>
                </Card>
              ) : (
                matches.map((m: any) => {
                  const entries = m.competition_match_entries || [];
                  const sideA = entries.find((e: any) => e.side === "A");
                  const sideB = entries.find((e: any) => e.side === "B");
                  const nameA = sideA?.teams?.name || sideA?.participant_sport_events?.participants?.people?.full_name || "A definir";
                  const nameB = sideB?.teams?.name || sideB?.participant_sport_events?.participants?.people?.full_name || "A definir";

                  return (
                    <Card key={m.id} className="overflow-hidden">
                      <div className="bg-muted/50 px-4 py-2 border-b flex justify-between items-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          {m.competition_phases?.name} {m.competition_groups?.name ? `· ${m.competition_groups.name}` : ""}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-background">
                          #{m.match_number}
                        </Badge>
                      </div>
                      <CardContent className="py-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 text-center font-bold text-sm sm:text-base">{nameA}</div>
                            <div className="px-4 text-[10px] font-black text-muted-foreground/30">VS</div>
                            <div className="flex-1 text-center font-bold text-sm sm:text-base">{nameB}</div>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t pt-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5 text-primary" />
                              {m.match_date ? format(parse(m.match_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy") : "—"}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 text-primary" />
                              {m.start_time?.slice(0, 5) || "—"}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Swords className="h-3.5 w-3.5 text-primary" />
                              {m.venues && m.venues.is_active && !m.venues.deleted_at ? m.venues.name : "Local a definir"}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground bg-muted/20 mt-12">
        <p className="font-bold">JER Gestão</p>
        <p className="text-xs">Plataforma de Gestão dos Jogos Escolares de Roraima</p>
      </footer>
    </div>
  );
}
