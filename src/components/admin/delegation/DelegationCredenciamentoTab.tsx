import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, IdCard, Users, CheckCircle, Clock, XCircle } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta", coach: "Técnico", head_of_delegation: "Chefe", staff: "Staff",
};

interface Props {
  delegationId: string;
  eventId: string;
}

export default function DelegationCredenciamentoTab({ delegationId, eventId }: Props) {
  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["delegation_cred_participants", delegationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, participant_type, status, person_id")
        .eq("delegation_id", delegationId)
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const personIds = participants.map(p => p.person_id);
  const { data: people = [] } = useQuery({
    queryKey: ["delegation_cred_people", delegationId, personIds.length],
    queryFn: async () => {
      if (!personIds.length) return [];
      const { data, error } = await supabase.from("people").select("id, full_name").in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: personIds.length > 0,
  });

  const participantIds = participants.map(p => p.id);
  const { data: credentials = [] } = useQuery({
    queryKey: ["delegation_cred_credentials", delegationId, participantIds.length],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, participant_id, status, credential_code")
        .in("participant_id", participantIds)
        .eq("event_id", eventId)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: participantIds.length > 0,
  });

  const peopleMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);
  const credMap = useMemo(() => new Map(credentials.map(c => [c.participant_id, c])), [credentials]);

  const total = participants.length;
  const withCredential = credentials.length;
  const credentialed = participants.filter(p => p.status === "credentialed").length;
  const pending = participants.filter(p => p.status === "pending" || p.status === "confirmed").length;
  const progress = total > 0 ? Math.round((withCredential / total) * 100) : 0;

  if (isLoading) {
    return <div className="space-y-3 mt-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso de credenciamento</span>
            <span className="text-sm text-muted-foreground">{withCredential}/{total} ({progress}%)</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<Users className="h-4 w-4 text-primary" />} label="Total" value={total} />
        <SummaryCard icon={<CheckCircle className="h-4 w-4 text-green-600" />} label="Credenciados" value={credentialed} />
        <SummaryCard icon={<IdCard className="h-4 w-4 text-emerald-600" />} label="Credencial ativa" value={withCredential} />
        <SummaryCard icon={<Clock className="h-4 w-4 text-amber-600" />} label="Pendentes" value={pending} />
      </div>

      {/* Participant list */}
      {!participants.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <IdCard className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum participante nesta delegação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Credencial</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => {
                const person = peopleMap.get(p.person_id);
                const cred = credMap.get(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                    <TableCell>{TYPE_LABELS[p.participant_type] ?? p.participant_type}</TableCell>
                    <TableCell>
                      {p.status === "credentialed" ? (
                        <Badge variant="default">Credenciado</Badge>
                      ) : p.status === "confirmed" ? (
                        <Badge variant="secondary">Confirmado</Badge>
                      ) : p.status === "cancelled" ? (
                        <Badge variant="destructive">Cancelado</Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {cred ? (
                        <span className="text-xs font-mono text-green-600">{cred.credential_code}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Sem credencial
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/admin/participantes/${p.id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
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
