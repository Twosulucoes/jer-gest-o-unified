import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MapPin, Eye, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

export default function CompeticaoAgendaPage() {
  const navigate = useNavigate();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedSportEventId, setSelectedSportEventId] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sportEvents = [] } = useQuery({
    queryKey: ["sport_events", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("sport_events").select("*").eq("event_id", selectedEventId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
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

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["competition_matches_agenda", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("competition_matches").select("*").eq("event_id", selectedEventId).order("match_date").order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["venues", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase.from("venues").select("*").eq("event_id", selectedEventId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const phasesMap = new Map(phases.map((p) => [p.id, p]));
  const venuesMap = new Map(venues.map((v) => [v.id, v]));
  const sportEventsMap = new Map(sportEvents.map((se) => [se.id, se]));

  const statusLabel = (s: string) => {
    const m: Record<string, string> = { scheduled: "Agendada", in_progress: "Em andamento", finished: "Finalizada", cancelled: "Cancelada" };
    return m[s] || s;
  };
  const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" =>
    s === "in_progress" ? "default" : s === "finished" ? "secondary" : s === "cancelled" ? "destructive" : "outline";

  // Filter matches
  const filtered = matches.filter((m) => {
    const phase = phasesMap.get(m.phase_id);
    if (selectedSportEventId && phase?.sport_event_id !== selectedSportEventId) return false;
    if (selectedPhaseId && m.phase_id !== selectedPhaseId) return false;
    if (selectedDate && m.match_date !== selectedDate) return false;
    return true;
  });

  // Group by date
  const matchesByDate = new Map<string, typeof filtered>();
  filtered.forEach((m) => {
    const d = m.match_date ?? "sem-data";
    if (!matchesByDate.has(d)) matchesByDate.set(d, []);
    matchesByDate.get(d)!.push(m);
  });

  const formatDate = (d: string) => d === "sem-data" ? "Sem data definida" : new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  // Filtered phases for phase filter dropdown
  const filteredPhases = selectedSportEventId ? phases.filter((p) => p.sport_event_id === selectedSportEventId) : phases;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Agenda da Competição</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão operacional das partidas/provas programadas</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={(v) => { setSelectedEventId(v); setSelectedSportEventId(""); setSelectedPhaseId(""); setSelectedDate(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Modalidade/Prova</label>
              <Select value={selectedSportEventId || "__all__"} onValueChange={(v) => { setSelectedSportEventId(v === "__all__" ? "" : v); setSelectedPhaseId(""); }} disabled={!selectedEventId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {sportEvents.map((se) => <SelectItem key={se.id} value={se.id}>{se.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Fase</label>
              <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId} disabled={!selectedEventId}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
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

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)}</div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Filter className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhuma partida encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou cadastre partidas.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(matchesByDate.entries()).map(([date, dayMatches]) => (
            <div key={date}>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-3 capitalize">{formatDate(date)}</h3>
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
                          <Badge variant={statusVariant(m.status)}>{statusLabel(m.status)}</Badge>
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
    </div>
  );
}
