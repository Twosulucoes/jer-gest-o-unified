import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, XCircle, User, Layers, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useActiveEventId } from "@/contexts/EventContext";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta",
  coach: "Técnico",
  head_of_delegation: "Chefe Delegação",
  staff: "Staff",
};

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  credentialed: { label: "Credenciado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export default function ParticipantesPage() {
  const navigate = useNavigate();
  const selectedEventId = useActiveEventId();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const stageFilterId = searchParams.get("stage");

  // Carrega etapa filtrada (se houver)
  const { data: stageInfo } = useQuery({
    queryKey: ["participantes-stage-info", stageFilterId],
    enabled: !!stageFilterId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_stages" as never) as any)
        .select("id, name, slug")
        .eq("id", stageFilterId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string; slug: string } | null;
    },
  });

  // IDs de participantes vinculados à etapa
  const { data: stageParticipantIds } = useQuery({
    queryKey: ["participantes-stage-participants", stageFilterId],
    enabled: !!stageFilterId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participant_id")
        .eq("event_stage_id", stageFilterId);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.participant_id as string));
    },
  });

  const clearStageFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("stage");
    setSearchParams(next, { replace: true });
  };

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: participants, isLoading } = useQuery({
    queryKey: ["all-participants", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, status, participant_type, person_id, delegation_id, created_at")
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const personIds = participants?.map((p) => p.person_id) ?? [];
  const delegationIds = [...new Set(participants?.map((p) => p.delegation_id) ?? [])];

  const { data: people = [] } = useQuery({
    queryKey: ["participants-people", personIds],
    queryFn: async () => {
      if (personIds.length === 0) return [];
      const { data, error } = await supabase
        .from("people").select("id, full_name, cpf, gender").in("id", personIds);
      if (error) throw error;
      return data;
    },
    enabled: personIds.length > 0,
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ["participants-delegations", delegationIds],
    queryFn: async () => {
      if (delegationIds.length === 0) return [];
      const { data, error } = await supabase
        .from("delegations").select("id, institution_id").in("id", delegationIds);
      if (error) throw error;
      return data;
    },
    enabled: delegationIds.length > 0,
  });

  const instIds = [...new Set(delegations.map((d) => d.institution_id))];
  const { data: institutions = [] } = useQuery({
    queryKey: ["participants-institutions", instIds],
    queryFn: async () => {
      if (instIds.length === 0) return [];
      const { data, error } = await supabase.from("institutions").select("id, name").in("id", instIds);
      if (error) throw error;
      return data;
    },
    enabled: instIds.length > 0,
  });

  // Load sport enrollments for these participants
  const partIds = participants?.map((p) => p.id) ?? [];
  const { data: enrollments = [] } = useQuery({
    queryKey: ["participants-enrollments", partIds],
    queryFn: async () => {
      if (partIds.length === 0) return [];
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("participant_id, sport_event_id")
        .in("participant_id", partIds);
      if (error) throw error;
      return data;
    },
    enabled: partIds.length > 0,
  });

  const seIds = [...new Set(enrollments.map((e) => e.sport_event_id))];
  const { data: sportEvents = [] } = useQuery({
    queryKey: ["participants-sport-events", seIds],
    queryFn: async () => {
      if (seIds.length === 0) return [];
      const { data, error } = await supabase
        .from("sport_events").select("id, name, sport_id").in("id", seIds);
      if (error) throw error;
      return data;
    },
    enabled: seIds.length > 0,
  });

  const sportIds = [...new Set(sportEvents.map((se) => se.sport_id))];
  const { data: sports = [] } = useQuery({
    queryKey: ["participants-sports", sportIds],
    queryFn: async () => {
      if (sportIds.length === 0) return [];
      const { data, error } = await supabase.from("sports").select("id, name").in("id", sportIds);
      if (error) throw error;
      return data;
    },
    enabled: sportIds.length > 0,
  });

  const peopleMap = new Map(people.map((p) => [p.id, p]));
  const delegationMap = new Map(delegations.map((d) => [d.id, d]));
  const institutionMap = new Map(institutions.map((i) => [i.id, i]));
  const sportEventMap = new Map(sportEvents.map((se) => [se.id, se]));
  const sportMap = new Map(sports.map((s) => [s.id, s]));

  const getInstitutionName = (delegationId: string) => {
    const del = delegationMap.get(delegationId);
    if (!del) return "—";
    return institutionMap.get(del.institution_id)?.name ?? "—";
  };

  const getEnrollmentSummary = (participantId: string) => {
    const pEnrollments = enrollments.filter((e) => e.participant_id === participantId);
    if (pEnrollments.length === 0) return "—";
    return pEnrollments.map((e) => {
      const se = sportEventMap.get(e.sport_event_id);
      if (!se) return "?";
      const sport = sportMap.get(se.sport_id);
      return `${sport?.name ?? "?"} / ${se.name}`;
    }).join("; ");
  };

  const filtered = (participants ?? []).filter((p) => {
    if (!searchTerm) return true;
    const person = peopleMap.get(p.person_id);
    if (!person) return false;
    const term = searchTerm.toLowerCase();
    return (
      person.full_name.toLowerCase().includes(term) ||
      (person.cpf && person.cpf.includes(term))
    );
  });

  const athleteCount = (participants ?? []).filter((p) => p.participant_type === "athlete").length;
  const staffCount = (participants ?? []).filter((p) => p.participant_type !== "athlete").length;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Participantes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualizar todos os participantes importados por evento
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={() => {}}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={!selectedEventId}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedEventId && participants && (
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{participants.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Atletas</p>
            <p className="text-2xl font-bold text-primary">{athleteCount}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Comissão/Staff</p>
            <p className="text-2xl font-bold text-muted-foreground">{staffCount}</p>
          </CardContent></Card>
        </div>
      )}

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <XCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum participante encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchTerm ? "Tente outro termo de busca." : "Importe participantes primeiro."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Modalidade / Prova</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const person = peopleMap.get(p.person_id);
                const statusInfo = STATUS_LABELS[p.status] ?? { label: p.status, variant: "outline" as const };
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{person?.cpf ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{getInstitutionName(p.delegation_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{TYPE_LABELS[p.participant_type] ?? p.participant_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                      {getEnrollmentSummary(p.id)}
                    </TableCell>
                     <TableCell className="flex gap-1">
                       <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/participantes/${p.id}`)} title="Ver participante">
                         <User className="h-4 w-4 mr-1" />Ver
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
