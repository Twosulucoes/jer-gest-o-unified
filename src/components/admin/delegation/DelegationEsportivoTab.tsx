import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, Medal } from "lucide-react";

interface Props {
  delegationId: string;
  eventId: string;
}

export default function DelegationEsportivoTab({ delegationId, eventId }: Props) {
  // Get participants of this delegation
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

  // Sport event enrollments
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

  // Teams
  const { data: teams = [] } = useQuery({
    queryKey: ["delegation_teams", delegationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, sport_event_id, sport_events(name)")
        .eq("delegation_id", delegationId)
        .eq("event_id", eventId);
      if (error) throw error;
      return data as any[];
    },
  });

  // Results (podiums)
  const { data: results = [] } = useQuery({
    queryKey: ["delegation_results", delegationId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      // Get match entries for delegation participants
      const { data: entries, error: eErr } = await supabase
        .from("competition_match_entries")
        .select("id, participant_sport_event_id")
        .in("participant_sport_event_id", enrollments.map(e => e.id));
      if (eErr) throw eErr;
      if (!entries?.length) return [];
      const { data: res, error: rErr } = await supabase
        .from("competition_match_results")
        .select("id, position, result_status, outcome")
        .in("match_entry_id", entries.map(e => e.id))
        .eq("result_status", "publicado");
      if (rErr) throw rErr;
      return res ?? [];
    },
    enabled: enrollments.length > 0,
  });

  const isLoading = loadingP || loadingE;

  // Group by sport
  const sportMap = new Map<string, { sport: string; events: Set<string>; athletes: Set<string> }>();
  for (const e of enrollments) {
    const sportName = e.sport_events?.sports?.name ?? "Outro";
    const eventName = e.sport_events?.name ?? "";
    if (!sportMap.has(sportName)) {
      sportMap.set(sportName, { sport: sportName, events: new Set(), athletes: new Set() });
    }
    const entry = sportMap.get(sportName)!;
    entry.events.add(eventName);
    entry.athletes.add(e.participant_id);
  }

  const podiums = results.filter(r => r.position != null && r.position >= 1 && r.position <= 3).length;

  if (isLoading) {
    return <div className="space-y-3 mt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<Trophy className="h-4 w-4 text-primary" />} label="Modalidades" value={sportMap.size} />
        <SummaryCard icon={<Trophy className="h-4 w-4 text-blue-600" />} label="Inscrições" value={enrollments.length} />
        <SummaryCard icon={<Users className="h-4 w-4 text-green-600" />} label="Equipes" value={teams.length} />
        <SummaryCard icon={<Medal className="h-4 w-4 text-amber-500" />} label="Pódios" value={podiums} />
      </div>

      {/* By sport */}
      {sportMap.size === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Nenhuma inscrição esportiva encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">Inscreva participantes em provas para visualizar.</p>
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
                <div className="flex flex-wrap gap-1">
                  {Array.from(events).slice(0, 5).map(e => (
                    <span key={e} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{e}</span>
                  ))}
                  {events.size > 5 && <span className="text-xs text-muted-foreground">+{events.size - 5}</span>}
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
            <div className="flex flex-wrap gap-2">
              {teams.map((t: any) => (
                <Badge key={t.id} variant="outline" className="py-1.5 px-3">
                  {t.name} — {t.sport_events?.name ?? ""}
                </Badge>
              ))}
            </div>
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
