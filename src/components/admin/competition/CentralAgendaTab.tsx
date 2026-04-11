import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CalendarClock } from "lucide-react";

interface Props {
  eventId: string;
  sportEventId: string;
}

interface ConflictItem {
  venue_name?: string;
  team_name?: string;
  full_name?: string;
  match_date: string;
  start_time: string;
  matches: { match_id: string; match_number: number }[];
}

export default function CentralAgendaTab({ eventId, sportEventId }: Props) {
  const { data: conflicts, isLoading } = useQuery({
    queryKey: ["schedule-conflicts", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_detect_schedule_conflicts", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const venueConflicts: ConflictItem[] = conflicts?.venue_conflicts ?? [];
  const teamConflicts: ConflictItem[] = conflicts?.team_conflicts ?? [];
  const participantConflicts: ConflictItem[] = conflicts?.participant_conflicts ?? [];
  const totalConflicts = venueConflicts.length + teamConflicts.length + participantConflicts.length;

  const renderConflictList = (items: ConflictItem[], labelKey: string) => {
    if (items.length === 0) return <p className="text-sm text-muted-foreground">Nenhum conflito.</p>;
    return (
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2 border rounded-md">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">{(item as any)[labelKey] ?? "—"}</p>
              <p className="text-muted-foreground text-xs">
                {item.match_date} às {item.start_time} — Partidas:{" "}
                {item.matches.map((m) => `#${m.match_number}`).join(", ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Agenda & Conflitos</h3>
        {totalConflicts > 0 && (
          <Badge variant="destructive">{totalConflicts} conflito(s)</Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : totalConflicts === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum conflito de agenda detectado. ✅</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Local (Venue)</CardTitle>
            </CardHeader>
            <CardContent>{renderConflictList(venueConflicts, "venue_name")}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Equipes</CardTitle>
            </CardHeader>
            <CardContent>{renderConflictList(teamConflicts, "team_name")}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Atletas</CardTitle>
            </CardHeader>
            <CardContent>{renderConflictList(participantConflicts, "full_name")}</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
