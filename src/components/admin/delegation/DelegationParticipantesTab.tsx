import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Search, Users } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta", coach: "Técnico", head_of_delegation: "Chefe", staff: "Staff",
};
const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  credentialed: { label: "Credenciado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

interface Props {
  delegationId: string;
  eventId: string;
}

export default function DelegationParticipantesTab({ delegationId, eventId }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: participants, isLoading } = useQuery({
    queryKey: ["delegation_participants_list", delegationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, participant_type, status, is_active, person_id")
        .eq("delegation_id", delegationId)
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const personIds = participants?.map(p => p.person_id) ?? [];
  const { data: people = [] } = useQuery({
    queryKey: ["delegation_people", delegationId, personIds.length],
    queryFn: async () => {
      if (!personIds.length) return [];
      const { data, error } = await supabase
        .from("people")
        .select("id, full_name, cpf")
        .in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: personIds.length > 0,
  });

  const peopleMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  const filtered = useMemo(() => {
    if (!participants) return [];
    return participants.filter(p => {
      if (typeFilter !== "all" && p.participant_type !== typeFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const person = peopleMap.get(p.person_id);
        const q = search.toLowerCase();
        if (!person) return false;
        if (!person.full_name.toLowerCase().includes(q) && !(person.cpf ?? "").includes(q)) return false;
      }
      return true;
    });
  }, [participants, typeFilter, statusFilter, search, peopleMap]);

  if (isLoading) {
    return <div className="space-y-3 mt-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!filtered.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum participante encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou cadastre participantes nesta delegação.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const person = peopleMap.get(p.person_id);
                const statusInfo = STATUS_LABELS[p.status] ?? { label: p.status, variant: "outline" as const };
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{person?.cpf ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{TYPE_LABELS[p.participant_type] ?? p.participant_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
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

      <p className="text-xs text-muted-foreground">{filtered.length} de {participants?.length ?? 0} participante(s)</p>
    </div>
  );
}
