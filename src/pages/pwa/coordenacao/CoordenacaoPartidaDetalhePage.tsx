import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, MapPin, Clock } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";

interface MatchDetail {
  id: string;
  match_date: string | null;
  start_time: string | null;
  status: string;
  match_number: number | null;
  notes: string | null;
  venue: { name: string } | null;
  phase: { name: string } | null;
  entries: Array<{
    id: string;
    side: string;
    team: { name: string } | null;
    participant_sport_event: { participant: { person: { full_name: string } | null } | null } | null;
  }>;
}

export default function CoordenacaoPartidaDetalhePage() {
  const navigate = useNavigate();
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      const { data } = await supabase
        .from("competition_matches")
        .select(`
          id, match_date, start_time, status, match_number, notes,
          venue:venues(name),
          phase:competition_phases(name),
          entries:competition_match_entries(id, side, team:teams(name), participant_sport_event:participant_sport_events(participant:participants(person:people(full_name))))
        `)
        .eq("id", matchId)
        .single();
      setMatch((data as any) || null);
      setLoading(false);
    })();
  }, [matchId]);

  const statusLabels: Record<string, string> = {
    agendada: "Agendada", em_andamento: "Em andamento", finalizada: "Finalizada", cancelada: "Cancelada",
  };

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Detalhe da Partida" icon={Trophy} onBack={() => navigate(-1)} />

      <main className="p-4 max-w-md mx-auto space-y-4">
        {loading && <Skeleton className="h-40 w-full" />}

        {!loading && !match && (
          <div className="text-center py-8 text-muted-foreground">Partida não encontrada</div>
        )}

        {match && (
          <>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">
                    {match.match_number ? `Jogo ${match.match_number}` : "Partida"}
                  </span>
                  <Badge>{statusLabels[match.status] || match.status}</Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{match.match_date || "—"} {match.start_time || ""}</span>
                  </div>
                  {match.venue?.name && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{match.venue.name}</span>
                    </div>
                  )}
                  <p className="text-xs">{match.phase?.name || "—"}</p>
                </div>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Participantes</h3>
              <div className="space-y-2">
                {(match.entries || []).map((e) => {
                  const name = e.team?.name || (e.participant_sport_event as any)?.participant?.person?.full_name || "—";
                  return (
                    <Card key={e.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <span className="text-sm font-medium">{name}</span>
                        <Badge variant="outline">{e.side === "home" ? "Mandante" : "Visitante"}</Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {match.notes && (
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{match.notes}</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
