import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, ChevronRight, ArrowLeft, Calendar, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parse } from "date-fns";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function PublicResultsPage() {
  const { user } = useAuth();
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
    <div className="op-screen flex flex-col">
      <PublicHeader 
        subtitle={currentTitle} 
        onBack={handleBack} 
        showBackButton={!!selectedEventId || !!selectedSportEventId} 
      />

      <main className="mx-auto w-full max-w-4xl p-4 space-y-6 flex-grow animate-fade-in">
        {/* Event listing */}
        {!selectedEventId && (
          <div className="grid gap-4">
            {loadingEvents ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <Trophy className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-primary/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground animate-pulse">Carregando competições...</p>
              </div>
            ) : events.length === 0 ? (
              <Card className="op-card-elevated border-dashed">
                <CardContent className="py-16 text-center space-y-3">
                  <div className="bg-muted/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="font-bold text-lg">Nenhum evento ativo</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Não há eventos em fase de divulgação no momento. Volte em breve!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-1">
                {events.map((ev, idx) => (
                  <Card
                    key={ev.id}
                    className="op-card group cursor-pointer transition-all hover:scale-[1.01] hover:shadow-accent-glow animate-fade-in"
                    style={{ animationDelay: `${idx * 50}ms` }}
                    onClick={() => setSelectedEventId(ev.id)}
                  >
                    <CardContent className="flex items-center justify-between py-6 px-6">
                      <div className="flex items-center gap-5">
                        <div className="bg-primary/10 p-4 rounded-2xl group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                          <Trophy className="h-7 w-7 text-primary" />
                        </div>
                        <div>
                          <p className="font-extrabold text-xl tracking-tight group-hover:text-primary transition-colors">{ev.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="font-bold px-2 py-0 text-[10px] uppercase tracking-wider">
                              EDIÇÃO {ev.year}
                            </Badge>
                            {ev.status === 'ativo' && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-success uppercase">
                                <span className="pulse-dot" /> EM ANDAMENTO
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="bg-muted/50 p-2 rounded-full group-hover:bg-primary/10 transition-colors">
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sport events listing */}
        {selectedEventId && !selectedSportEventId && (
          <div className="grid gap-3 sm:grid-cols-2">
            {loadingSportEvents ? (
              <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm font-medium text-muted-foreground">Listando modalidades...</p>
              </div>
            ) : sportEvents.length === 0 ? (
              <div className="col-span-full">
                <Card className="op-card border-dashed">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    Nenhuma prova encontrada para este evento.
                  </CardContent>
                </Card>
              </div>
            ) : (
              sportEvents.map((se: any, idx: number) => (
                <Card
                  key={se.id}
                  className="op-card group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md animate-fade-in"
                  style={{ animationDelay: `${idx * 30}ms` }}
                  onClick={() => setSelectedSportEventId(se.id)}
                >
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {se.sports?.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium mb-2">{se.categories?.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[9px] font-bold uppercase py-0 px-2 bg-background/50">
                          {se.gender === "M" ? "Masculino" : se.gender === "F" ? "Feminino" : "Misto"}
                        </Badge>
                        {se.sports?.is_collective && (
                          <Badge variant="secondary" className="text-[9px] font-bold uppercase py-0 px-2 bg-blue-500/10 text-blue-600 border-none">
                            Coletiva
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Prova Detail with Tabs */}
        {selectedSportEventId && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-2 rounded-2xl">
              <TabsList className="grid grid-cols-2 w-full sm:w-[320px] bg-background/50 rounded-xl p-1">
                <TabsTrigger value="results" className="gap-2 rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                  <Trophy className="h-4 w-4" /> Resultados
                </TabsTrigger>
                <TabsTrigger value="agenda" className="gap-2 rounded-lg py-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all" disabled={!selectedEvent?.public_agenda_published}>
                  <Calendar className="h-4 w-4" /> Agenda
                </TabsTrigger>
              </TabsList>
              {!selectedEvent?.public_agenda_published && activeTab === "agenda" && (
                <Badge variant="destructive" className="animate-pulse font-bold text-[10px] uppercase py-1">
                   Não Divulgado
                </Badge>
              )}
            </div>

            <TabsContent value="results" className="space-y-4 mt-0 animate-fade-in">
              {loadingResults ? (
                <div className="flex justify-center py-20">
                  <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : resultsError ? (
                <Card className="border-destructive/20 bg-destructive/5 rounded-2xl">
                  <CardContent className="py-12 text-center space-y-3">
                    <p className="font-bold text-destructive text-lg">Erro ao carregar resultados</p>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Não foi possível conectar ao servidor de resultados. Tente novamente em instantes.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2 rounded-xl">
                      Tentar Novamente
                    </Button>
                  </CardContent>
                </Card>
              ) : results.length === 0 ? (
                <Card className="op-card border-dashed">
                  <CardContent className="py-20 text-center space-y-4">
                    <div className="bg-amber-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                      <Trophy className="h-8 w-8 text-amber-600/50" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-bold text-xl">Nenhum resultado publicado</p>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Resultados aparecem aqui após a validação oficial e publicação em boletim oficial. 
                        Fique atento às atualizações!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {results.map((r: any, idx: number) => {
                    const entry = r.competition_match_entries;
                    const match = r.competition_matches;
                    const name =
                      entry?.teams?.name ??
                      entry?.participant_sport_events?.participants?.people?.full_name ??
                      "—";

                    return (
                      <Card key={r.id} className="op-card group hover:shadow-md transition-all animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                        <CardContent className="py-5 px-6">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="font-extrabold text-lg text-foreground group-hover:text-primary transition-colors truncate">{name}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tight py-0">
                                  PARTIDA #{match?.match_number ?? "—"}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                  {match?.competition_phases?.name ?? ""}
                                  {match?.competition_groups?.name ? ` · ${match.competition_groups.name}` : ""}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {r.score && (
                                <div className="flex flex-col items-end">
                                  <span className="text-2xl font-black text-primary tabular-nums leading-none tracking-tighter">
                                    {r.score}
                                  </span>
                                  {r.combat_detail?.shootout && (
                                    <span className="text-[10px] font-bold text-muted-foreground/70 mt-1 uppercase">
                                      Decisão: {r.combat_detail.shootout}
                                    </span>
                                  )}
                                </div>
                              )}
                              {r.position && (
                                <div className="relative">
                                  <Badge className={cn(
                                    "font-black text-sm px-3 py-1 rounded-lg shadow-sm border-none",
                                    r.position === 1 ? "bg-amber-500 text-white" : 
                                    r.position === 2 ? "bg-slate-300 text-slate-800" :
                                    r.position === 3 ? "bg-amber-700 text-white" :
                                    "bg-primary/10 text-primary"
                                  )}>
                                    {r.position}º LUGAR
                                  </Badge>
                                  {r.position <= 3 && (
                                    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white animate-ping" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="agenda" className="space-y-4 mt-0 animate-fade-in">
              {!selectedEvent?.public_agenda_published ? (
                <Card className="op-card border-dashed border-destructive/30 bg-destructive/5">
                  <CardContent className="py-16 text-center space-y-4">
                    <div className="bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                      <Calendar className="h-8 w-8 text-destructive/50" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-destructive font-bold text-xl uppercase tracking-tight">Agenda Privada</p>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto">A agenda oficial desta prova ainda não foi liberada para divulgação pública.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : loadingMatches ? (
                <div className="flex justify-center py-20">
                  <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : matches.length === 0 ? (
                <Card className="op-card">
                  <CardContent className="py-16 text-center text-muted-foreground space-y-2">
                    <p className="font-bold text-lg">Nenhum confronto agendado</p>
                    <p className="text-sm">Os confrontos serão listados assim que forem sorteados.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {matches.map((m: any, idx: number) => {
                    const entries = m.competition_match_entries || [];
                    const sideA = entries.find((e: any) => e.side === "A");
                    const sideB = entries.find((e: any) => e.side === "B");
                    const nameA = sideA?.teams?.name || sideA?.participant_sport_events?.participants?.people?.full_name || "A definir";
                    const nameB = sideB?.teams?.name || sideB?.participant_sport_events?.participants?.people?.full_name || "A definir";

                    return (
                      <Card key={m.id} className="op-card overflow-hidden group hover:shadow-md transition-all animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                        <div className="bg-muted/40 px-5 py-2.5 border-b border-border/50 flex justify-between items-center group-hover:bg-primary/5 transition-colors">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-bold bg-background/80 border-primary/20 text-primary">
                              #{m.match_number}
                            </Badge>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                              {m.competition_phases?.name} {m.competition_groups?.name ? `· ${m.competition_groups.name}` : ""}
                            </span>
                          </div>
                          {m.status === 'finished' && (
                            <Badge className="bg-success/10 text-success border-none text-[9px] font-bold uppercase">Finalizado</Badge>
                          )}
                          {m.status === 'live' && (
                            <span className="flex items-center gap-1.5 text-[9px] font-black text-red-500 animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> AO VIVO
                            </span>
                          )}
                        </div>
                        <CardContent className="p-6">
                          <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 text-center">
                                <div className="font-black text-sm sm:text-lg leading-tight group-hover:text-primary transition-colors">{nameA}</div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Lado A</div>
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <div className="text-[11px] font-black text-primary/30 uppercase tracking-tighter">VERSUS</div>
                                <div className="h-8 w-[1px] bg-border/50" />
                              </div>
                              <div className="flex-1 text-center">
                                <div className="font-black text-sm sm:text-lg leading-tight group-hover:text-primary transition-colors">{nameB}</div>
                                <div className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Lado B</div>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-5 border-t border-border/40">
                              <div className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                                <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
                                  <Calendar className="h-3.5 w-3.5" />
                                </div>
                                {m.match_date ? format(parse(m.match_date, "yyyy-MM-dd", new Date()), "dd 'de' MMMM", { locale: undefined }) : "—"}
                              </div>
                              <div className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                                <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
                                  <Loader2 className="h-3.5 w-3.5" />
                                </div>
                                {m.start_time?.slice(0, 5) || "—"}h
                              </div>
                              <div className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                                <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
                                  <Swords className="h-3.5 w-3.5" />
                                </div>
                                <span className="truncate max-w-[140px]">
                                  {m.venues && m.venues.is_active && !m.venues.deleted_at ? m.venues.name : "Local a definir"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
