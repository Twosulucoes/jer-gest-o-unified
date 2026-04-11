import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Props {
  eventId: string;
  sportEventId: string;
  isCollective: boolean;
}

export default function CentralEnrolledTab({ eventId, sportEventId, isCollective }: Props) {
  // Individual enrollments
  const { data: enrolled = [], isLoading: loadingEnrolled } = useQuery({
    queryKey: ["central-enrolled", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("id, status, participant_id, participants(id, person_id, people(full_name), delegation_id, delegations(institution_id, institutions(name)))")
        .eq("sport_event_id", sportEventId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !isCollective,
  });

  // Teams
  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["central-teams", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, status, delegation_id, delegations(institution_id, institutions(name))")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: isCollective,
  });

  if (isCollective) {
    return (
      <Card>
        <CardContent className="pt-6">
          {loadingTeams ? (
            <p className="text-sm text-muted-foreground">Carregando equipes...</p>
          ) : teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma equipe cadastrada para esta prova.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Instituição</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{(t.delegations as any)?.institutions?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {loadingEnrolled ? (
          <p className="text-sm text-muted-foreground">Carregando inscritos...</p>
        ) : enrolled.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum inscrito para esta prova.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrolled.map((pse: any) => (
                <TableRow key={pse.id}>
                  <TableCell className="font-medium">
                    {(pse.participants as any)?.people?.full_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {(pse.participants as any)?.delegations?.institutions?.name ?? "—"}
                  </TableCell>
                  <TableCell><Badge variant="outline">{pse.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
