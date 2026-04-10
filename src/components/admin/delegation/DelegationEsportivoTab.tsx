import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Users, Medal, Swords, CheckCircle2 } from "lucide-react";

interface Props {
  delegationId: string;
  eventId: string;
}

export default function DelegationEsportivoTab({ delegationId, eventId }: Props) {
  const { data: participantIds = [], isLoading: loadingP } = useQuery({
    queryKey: ["delegation_participant_ids", delegationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id")
        .eq("delegation_id", delegationId)
        .eq("event_id", eventId);
      if (error) throw error;
      return data.map(p => p.id);
    },
  });

  const { data: enrollments = [], isLoading: loadingE } = useQuery({
    queryKey: ["delegation_enrollments", delegationId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("id, participant_id, sport_event_id, sport_events(id, name, sport_id, sports(name))")
        .in("participant_id", participantIds);
      if (error) throw error;
      return data as any[];
    },
    enabled: participantIds.length > 0,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["delegation_teams", delegationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, sport_event_id, sport_events(name, sports(name))")
        .eq("delegation_id", delegationId)
        .eq("event_id", eventId);
      if (error) throw error;
      return data as any[];
    },
  });

  const enrollmentIds = enrollments.map(e => e.id);
  const teamIds = teams.map(t => t.id);

  const { data: matchEntries = [] } = useQuery({
    queryKey: ["delegation_match_entries", delegationId, enrollmentIds.length, teamIds.length],
    queryFn: async () => {
      if (!enrollmentIds.length && !teamIds.length) return [];
      let query = supabase.from("competition_match_entries").select("id, match_id, participant_sport_event_id, team_id");
      if (enrollmentIds.length && teamIds.length) {
        query = query.or(`participant_sport_event_id.in.(${enrollmentIds.join(",")}),team_id.in.(${teamIds.join(",")})`);
      } else if (enrollmentIds.length) {
        query = query.in("participant_sport_event_id", enrollmentIds);
      } else {
        query = query.in("team_id", teamIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: enrollmentIds.length > 0 || teamIds.length > 0,
  });

  const matchEntryIds = matchEntries.map(e => e.id);
  const matchIds = [...new Set(matchEntries.map(e => e.match_id))];

  const { data: results = [] } = useQuery({
    queryKey: ["delegation_results", delegationId, matchEntryIds.length],
    queryFn: async () => {
      if (!matchEntryIds.length) return [];
      const { data, error } = await supabase
        .from("competition_match_results")
        .select("id, position, result_status, outcome, match_entry_id, score")
        .in("match_entry_id", matchEntryIds)
        .eq("result_status", "publicado");
      if (error) throw error;
      return data ?? [];
    },
    enabled: matchEntryIds.length > 0,
  });

  const isLoading = loadingP || loadingE;

  const sportMap = new Map<string, { sport: string; events: Map<string, { name: string; athleteCount: number }>; athletes: Set<string> }>();
  for (const e of enrollments) {
    const sportName = e.sport_events?.sports?.name ?? "Outro";
    const seEventId = e.sport_event_id;
    const eventName = e.sport_events?.name ?? "";
    if (!sportMap.has(sportName)) {
      sportMap.set(sportName, { sport: sportName, events: new Map(), athletes: new Set() });
    }
    const entry = sportMap.get(sportName)!;
    if (!entry.events.has(seEventId)) {
      entry.events.set(seEventId, { name: eventName, athleteCount: 0 });
    }
    entry.events.get(seEventId)!.athleteCount++;
    entry.athletes.add(e.participant_id);
  }

  const podiums = results.filter(r => r.position != null && r.position >= 1 && r.position <= 3);
  const gold = podiums.filter(r => r.position === 1).length;
  const silver = podiums.filter(r => r.position === 2).length;
  const bronze = podiums.filter(r => r.position === 3).length;
  const publishedResults = results.length;

  if (isLoading) {
    return <div className="space-y-3 mt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard icon={<Trophy className="h-4 w-4 text-primary" />} label="Modalidades" value={sportMap.size} />
        <SummaryCard icon={<Swords className="h-4 w-4 text-blue-600" />} label="Partidas" value={matchIds.length} />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Resultados" value={publishedResults} />
        <SummaryCard icon={<Users className="h-4 w-4 text-primary" />} label="Equipes" value={teams.length} />
        <SummaryCard icon={<Medal className="h-4 w-4 text-amber-500" />} label="Pódios" value={podiums.length} />
      </div>

      {/* Medal summary */}
      {podiums.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-6 justify-center">
              <div className="text-center">
                <div className="h-8 w-8 rounded-full bg-amber-400 flex items-center justify-center mx-auto mb-1">
                  <span className="text-sm font-bold text-amber-900">🥇</span>
                </div>
                <p className="text-lg font-bold">{gold}</p>
                <p className="text-xs text-muted-foreground">Ouro</p>
              </div>
              <div className="text-center">
                <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center mx-auto mb-1">
                  <span className="text-sm font-bold text-gray-700">🥈</span>
                </div>
                <p className="text-lg font-bold">{silver}</p>
                <p className="text-xs text-muted-foreground">Prata</p>
              </div>
              <div className="text-center">
                <div className="h-8 w-8 rounded-full bg-amber-700/30 flex items-center justify-center mx-auto mb-1">
                  <span className="text-sm font-bold text-amber-800">🥉</span>
                </div>
                <p className="text-lg font-bold">{bronze}</p>
                <p className="text-xs text-muted-foreground">Bronze</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* By sport */}
      {sportMap.size === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma inscrição esportiva registrada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Os participantes desta delegação ainda não foram inscritos em modalidades ou provas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from(sportMap.values()).map(({ sport, events, athletes }) => (
            <Card key={sport}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  {sport}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2 text-sm">
                  <Badge variant="outline">{athletes.size} atleta{athletes.size !== 1 ? "s" : ""}</Badge>
                  <Badge variant="secondary">{events.size} prova{events.size !== 1 ? "s" : ""}</Badge>
                </div>
                <div className="space-y-1">
                  {Array.from(events.values()).slice(0, 6).map(e => (
                    <div key={e.name} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{e.name}</span>
                      <span className="text-muted-foreground">{e.athleteCount} inscr.</span>
                    </div>
                  ))}
                  {events.size > 6 && <span className="text-xs text-muted-foreground">+{events.size - 6} provas</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Teams */}
      {teams.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Equipes da Delegação</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Prova</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{t.sport_events?.sports?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{t.sport_events?.name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2.5 p-3">
        {icon}
        <div>
          <p className="text-lg font-bold leading-none text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
