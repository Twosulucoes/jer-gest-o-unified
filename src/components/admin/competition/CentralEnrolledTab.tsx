import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  eventId: string;
  sportEventId: string;
  isCollective: boolean;
}

export default function CentralEnrolledTab({ eventId, sportEventId, isCollective }: Props) {
  const qc = useQueryClient();

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

  const syncMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_sync_collective_teams", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Sincronização concluída",
        description: `${data.teams_created} equipe(s) criada(s), ${data.members_added} membro(s) adicionado(s), ${data.skipped_count} pulado(s).`,
      });
      qc.invalidateQueries({ queryKey: ["central-teams"] });
      qc.invalidateQueries({ queryKey: ["competition-summary"] });
      qc.invalidateQueries({ queryKey: ["collective-step-teams"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const activeTeams = isCollective ? teams.filter((t: any) => t.status === "active") : [];

  if (isCollective) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Equipes</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} />
              {syncMut.isPending ? "Sincronizando..." : "Sincronizar equipes"}
            </Button>
            <Link to="/admin/competicao/sincronizar-equipes">
              <Button variant="ghost" size="sm">Ver página completa</Button>
            </Link>
          </div>
        </div>

        {/* Inline warning when no active teams */}
        {!loadingTeams && activeTeams.length === 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>
                Nenhuma equipe confirmada para esta prova.
                Sincronize as equipes ou verifique a Pré-validação.
              </span>
              <Link to="/admin/competicao/pre-validacao">
                <Button variant="outline" size="sm" className="shrink-0">
                  Ir para Pré-validação
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6">
            {loadingTeams ? (
              <p className="text-sm text-muted-foreground">Carregando equipes...</p>
            ) : teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma equipe cadastrada. Use "Sincronizar equipes" para criar automaticamente.</p>
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
      </div>
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
