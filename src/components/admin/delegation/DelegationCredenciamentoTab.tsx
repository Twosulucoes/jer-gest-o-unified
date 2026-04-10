import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, IdCard, Users, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta", coach: "Técnico", head_of_delegation: "Chefe", staff: "Staff",
};

interface Props {
  delegationId: string;
  eventId: string;
}

export default function DelegationCredenciamentoTab({ delegationId, eventId }: Props) {
  const [filter, setFilter] = useState("all");

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
  const readyToCredential = participants.filter(p => (p.status === "confirmed" || p.status === "pending") && !credMap.has(p.id)).length;
  const cancelled = participants.filter(p => p.status === "cancelled").length;
  const progress = total > 0 ? Math.round((withCredential / total) * 100) : 0;

  const filtered = useMemo(() => {
    if (filter === "all") return participants;
    if (filter === "ready") return participants.filter(p => (p.status === "confirmed" || p.status === "pending") && !credMap.has(p.id));
    if (filter === "active") return participants.filter(p => credMap.has(p.id));
    if (filter === "without") return participants.filter(p => !credMap.has(p.id) && p.status !== "cancelled");
    if (filter === "credentialed") return participants.filter(p => p.status === "credentialed");
    return participants;
  }, [participants, filter, credMap]);

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard icon={<Users className="h-4 w-4 text-primary" />} label="Total" value={total} onClick={() => setFilter("all")} active={filter === "all"} />
        <SummaryCard icon={<AlertCircle className="h-4 w-4 text-amber-600" />} label="Aptos" value={readyToCredential} onClick={() => setFilter("ready")} active={filter === "ready"} />
        <SummaryCard icon={<CheckCircle className="h-4 w-4 text-green-600" />} label="Credenciados" value={credentialed} onClick={() => setFilter("credentialed")} active={filter === "credentialed"} />
        <SummaryCard icon={<IdCard className="h-4 w-4 text-emerald-600" />} label="Credencial ativa" value={withCredential} onClick={() => setFilter("active")} active={filter === "active"} />
        <SummaryCard icon={<XCircle className="h-4 w-4 text-destructive" />} label="Sem credencial" value={total - withCredential - cancelled} onClick={() => setFilter("without")} active={filter === "without"} />
      </div>

      {/* Filter label */}
      {filter !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Filtro: {filter === "ready" ? "Aptos para credenciar" : filter === "active" ? "Com credencial ativa" : filter === "without" ? "Sem credencial" : "Credenciados"}
          </Badge>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setFilter("all")}>Limpar</Button>
        </div>
      )}

      {/* Participant list */}
      {!filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <IdCard className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">
              {filter !== "all" ? "Nenhum participante neste filtro" : "Nenhum participante nesta delegação"}
            </p>
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
              {filtered.map((p) => {
                const person = peopleMap.get(p.person_id);
                const cred = credMap.get(p.id);
                const isReady = (p.status === "confirmed" || p.status === "pending") && !cred;
                return (
                  <TableRow key={p.id} className={isReady ? "bg-amber-50/50 dark:bg-amber-950/10" : undefined}>
                    <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{TYPE_LABELS[p.participant_type] ?? p.participant_type}</span>
                    </TableCell>
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
                      ) : isReady ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          <AlertCircle className="h-3 w-3 mr-1" />Apto
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> —
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

      <p className="text-xs text-muted-foreground">{filtered.length} de {total} participante(s)</p>
    </div>
  );
}

function SummaryCard({ icon, label, value, onClick, active }: { icon: React.ReactNode; label: string; value: number; onClick?: () => void; active?: boolean }) {
  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${active ? "ring-2 ring-primary/30 bg-muted/30" : ""}`}
      onClick={onClick}
    >
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
