import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESULT_STATUS_LABEL } from "@/lib/resultStatus";

export default function PublicResultsPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedSportEventId, setSelectedSportEventId] = useState<string | null>(null);

  // Fetch events that have published results
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["public-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, year, status")
        .order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch sport_events for selected event with published results
  const { data: sportEvents = [], isLoading: loadingSportEvents } = useQuery({
    queryKey: ["public-sport-events", selectedEventId],
    enabled: !!selectedEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select(`
          id, gender, 
          sports(name),
          categories(name)
        `)
        .eq("event_id", selectedEventId!);
      if (error) throw error;
      return data;
    },
  });

  // Fetch published results for selected sport_event
  const { data: results = [], isLoading: loadingResults } = useQuery({
    queryKey: ["public-results-detail", selectedSportEventId],
    enabled: !!selectedSportEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_match_results")
        .select(`
          id, outcome, score, time_ms, distance_cm, points, position, result_status,
          competition_match_entries(
            side,
            teams(name),
            participant_sport_events(participants(person_id, people(full_name)))
          ),
          competition_matches(
            match_number, match_date, status,
            competition_phases(name),
            competition_groups(name)
          )
        `)
        .eq("result_status", "publicado")
        .eq("competition_matches.sport_event_id", selectedSportEventId!);
      if (error) throw error;
      return (data || []).filter((r: any) => r.competition_matches !== null);
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
    ? "Resultados Publicados"
    : selectedEventId
    ? "Provas do Evento"
    : "Resultados Oficiais";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          {(selectedEventId || selectedSportEventId) && (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">{currentTitle}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 space-y-4">
        {/* Event listing */}
        {!selectedEventId && (
          <>
            {loadingEvents ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : events.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum evento disponível.
                </CardContent>
              </Card>
            ) : (
              events.map((ev) => (
                <Card
                  key={ev.id}
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => setSelectedEventId(ev.id)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-semibold">{ev.name}</p>
                      <p className="text-sm text-muted-foreground">{ev.year}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {/* Sport events listing */}
        {selectedEventId && !selectedSportEventId && (
          <>
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
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => setSelectedSportEventId(se.id)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-semibold">
                        {se.sports?.name} — {se.categories?.name}
                      </p>
                      <Badge variant="outline">{se.gender === "M" ? "Masculino" : se.gender === "F" ? "Feminino" : "Misto"}</Badge>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))
            )}
          </>
        )}

        {/* Results detail */}
        {selectedSportEventId && (
          <>
            {loadingResults ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : results.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nenhum resultado publicado para esta prova.
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
                          <p className="font-medium">{name}</p>
                          <p className="text-sm text-muted-foreground">
                            Partida #{match?.match_number ?? "—"} · {match?.competition_phases?.name ?? ""}
                            {match?.competition_groups?.name ? ` · ${match.competition_groups.name}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          {r.score && <p className="text-lg font-bold">{r.score}</p>}
                          {r.position && (
                            <Badge variant="default">{r.position}º lugar</Badge>
                          )}
                          {r.outcome && (
                            <Badge variant="outline" className="ml-1">
                              {r.outcome}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {(r.time_ms || r.distance_cm || r.points) && (
                        <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                          {r.time_ms != null && <span>Tempo: {(r.time_ms / 1000).toFixed(2)}s</span>}
                          {r.distance_cm != null && <span>Distância: {(r.distance_cm / 100).toFixed(2)}m</span>}
                          {r.points != null && <span>Pontos: {r.points}</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </>
        )}
      </main>

      <footer className="border-t py-4 text-center text-sm text-muted-foreground">
        JER Gestão — Jogos Escolares de Roraima
      </footer>
    </div>
  );
}
