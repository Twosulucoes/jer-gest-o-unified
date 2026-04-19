import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCheck,
  UserX,
  Search,
  AlertTriangle,
  ShieldAlert,
  Eye,
  GripVertical,
  Download,
  Building2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useStageScope } from "@/hooks/useStageScope";

interface Props {
  eventId: string;
  sportEventId: string;
  isCollective: boolean;
}

interface EnrolledIndividual {
  id: string;
  status: string;
  participant_id: string;
  participants: {
    id: string;
    person_id: string;
    people: { full_name: string } | null;
    delegation_id: string;
    delegations: {
      institution_id: string;
      institutions: { name: string } | null;
    } | null;
  } | null;
}

interface EnrolledTeam {
  id: string;
  name: string;
  status: string;
  delegation_id: string;
  delegations: {
    institution_id: string;
    institutions: { name: string } | null;
  } | null;
}

interface PendingItem {
  pse_id: string;
  participant_id: string;
  person_id: string;
  delegation_id: string;
  full_name: string;
  institution_name: string | null;
  enrollment_status: string;
  has_active_credential: boolean;
  has_blocking_irregularity: boolean;
  irregularity_message: string;
  reason_code: string;
}

const REASON_LABELS: Record<string, string> = {
  NO_CREDENTIAL: "Sem credencial ativa",
  ENROLLMENT_INVALID: "Inscrição não aprovada/confirmada",
  BLOCKING_IRREGULARITY: "Irregularidade bloqueante detectada",
};

export default function CentralParticipantsTab({ eventId, sportEventId, isCollective }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter] = useState("all");
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("aptos");

  // Escopo de etapa (se a página estiver dentro de /admin/etapa/:stageId/...)
  const { isStageScoped, participantIds: stageParticipantIds } = useStageScope();

  // Individual enrollments
  const { data: enrolledRaw = [], isLoading: loadingEnrolled, error: errorEnrolled } = useQuery({
    queryKey: ["central-enrolled", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("id, status, participant_id, participants(id, person_id, people(full_name), delegation_id, delegations(institution_id, institutions(name)))")
        .eq("sport_event_id", sportEventId)
        .order("created_at");
      if (error) throw error;
      return data as unknown as EnrolledIndividual[];
    },
    enabled: !isCollective,
  });

  // Aplica filtro de etapa nos individuais
  const enrolled = useMemo(() => {
    if (!isStageScoped || !stageParticipantIds) return enrolledRaw;
    return enrolledRaw.filter((e) => stageParticipantIds.has(e.participant_id));
  }, [enrolledRaw, isStageScoped, stageParticipantIds]);

  // Teams
  const { data: teamsRaw = [], isLoading: loadingTeams, error: errorTeams } = useQuery({
    queryKey: ["central-teams", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, status, delegation_id, delegations(institution_id, institutions(name))")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("name");
      if (error) throw error;
      return data as unknown as EnrolledTeam[];
    },
    enabled: isCollective,
  });

  // Para equipes: filtra pelos times que tenham ao menos 1 atleta vinculado à etapa
  const { data: stageTeamIds } = useQuery({
    queryKey: ["central-teams-stage-filter", sportEventId, isStageScoped, stageParticipantIds?.size ?? 0],
    enabled: isCollective && isStageScoped && !!stageParticipantIds && stageParticipantIds.size > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("team_id, participant_id")
        .in("participant_id", Array.from(stageParticipantIds!));
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.team_id as string));
    },
  });

  const teams = useMemo(() => {
    if (!isCollective) return teamsRaw;
    if (!isStageScoped) return teamsRaw;
    if (!stageTeamIds) return [];
    return teamsRaw.filter((t) => stageTeamIds.has(t.id));
  }, [teamsRaw, isCollective, isStageScoped, stageTeamIds]);

  // Eligibility pending (inaptos)
  const { data: pending = [], isLoading: loadingPending } = useQuery({
    queryKey: ["eligibility-pending", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_list_eligibility_pending", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId,
      });
      if (error) throw error;
      return (data as unknown as PendingItem[]) ?? [];
    },
    enabled: !isCollective,
  });

  const isLoading = isCollective ? loadingTeams : loadingEnrolled || loadingPending;
  const error = isCollective ? errorTeams : errorEnrolled;

  // Build sets of inapt IDs for fast lookup
  const inaptIds = useMemo(() => new Set(pending.map((p) => p.pse_id)), [pending]);

  // Split enrolled into aptos / inaptos
  const { aptos, inaptos } = useMemo(() => {
    if (isCollective) {
      const active = teams.filter((t) => t.status === "active");
      const inactive = teams.filter((t) => t.status !== "active");
      return { aptos: active, inaptos: inactive };
    }

    const apt: EnrolledIndividual[] = [];
    const inapt: EnrolledIndividual[] = [];
    for (const e of enrolled) {
      if (inaptIds.has(e.id)) {
        inapt.push(e);
      } else {
        apt.push(e);
      }
    }
    return { aptos: apt, inaptos: inapt };
  }, [enrolled, teams, inaptIds, isCollective]);

  // Unique institutions for filter
  const institutions = useMemo(() => {
    const set = new Set<string>();
    if (isCollective) {
      teams.forEach((t) => {
        const n = t.delegations?.institutions?.name;
        if (n) set.add(n);
      });
    } else {
      enrolled.forEach((e) => {
        const n = (e.participants as any)?.delegations?.institutions?.name;
        if (n) set.add(n);
      });
    }
    return Array.from(set).sort();
  }, [enrolled, teams, isCollective]);

  // Filter logic
  const filterItems = <T extends any>(items: T[], getName: (i: T) => string, getInst: (i: T) => string | undefined, getStatus: (i: T) => string) => {
    return items.filter((item) => {
      const name = getName(item).toLowerCase();
      const inst = getInst(item)?.toLowerCase() ?? "";
      const status = getStatus(item);

      if (search && !name.includes(search.toLowerCase()) && !inst.includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (institutionFilter !== "all" && getInst(item) !== institutionFilter) return false;
      return true;
    });
  };

  const getIndName = (e: EnrolledIndividual) => (e.participants as any)?.people?.full_name ?? "";
  const getIndInst = (e: EnrolledIndividual) => (e.participants as any)?.delegations?.institutions?.name;
  const getIndStatus = (e: EnrolledIndividual) => e.status;

  const getTeamName = (t: EnrolledTeam) => t.name;
  const getTeamInst = (t: EnrolledTeam) => t.delegations?.institutions?.name ?? undefined;
  const getTeamStatus = (t: EnrolledTeam) => t.status;

  const filteredAptos = isCollective
    ? filterItems(aptos as EnrolledTeam[], getTeamName, getTeamInst, getTeamStatus)
    : filterItems(aptos as EnrolledIndividual[], getIndName, getIndInst, getIndStatus);

  const filteredInaptos = isCollective
    ? filterItems(inaptos as EnrolledTeam[], getTeamName, getTeamInst, getTeamStatus)
    : filterItems(inaptos as EnrolledIndividual[], getIndName, getIndInst, getIndStatus);

  // Export CSV
  const exportCSV = () => {
    if (pending.length === 0) return;
    const rows = [["Nome", "Instituição", "Motivo", "Detalhe"].join(",")];
    for (const p of pending) {
      rows.push([
        `"${p.full_name}"`,
        `"${p.institution_name ?? ""}"`,
        `"${REASON_LABELS[p.reason_code] ?? p.reason_code}"`,
        `"${p.irregularity_message ?? ""}"`,
      ].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inaptos-participantes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reason finder for individual inaptos
  const getInaptReason = (pseId: string) => pending.find((p) => p.pse_id === pseId);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Erro ao carregar participantes: {(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const totalCount = isCollective ? teams.length : enrolled.length;

  if (totalCount === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Nenhum inscrito encontrado para esta prova. Verifique as inscrições ou a importação de dados.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou escola..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
          <SelectTrigger className="w-[200px]">
            <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Escola" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as escolas</SelectItem>
            {institutions.map((inst) => (
              <SelectItem key={inst} value={inst}>{inst}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs aptos / inaptos */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="aptos" className="gap-1.5">
              <UserCheck className="h-3.5 w-3.5" />
              Aptos ({(filteredAptos as any[]).length})
            </TabsTrigger>
            <TabsTrigger value="inaptos" className="gap-1.5">
              <UserX className="h-3.5 w-3.5" />
              Inaptos ({(filteredInaptos as any[]).length})
            </TabsTrigger>
          </TabsList>
          {activeTab === "inaptos" && !isCollective && pending.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
          )}
        </div>

        <TabsContent value="aptos">
          {(filteredAptos as any[]).length === 0 ? (
            <Alert>
              <AlertDescription>
                {aptos.length === 0
                  ? "Nenhum participante apto. Verifique as pendências na aba Inaptos."
                  : "Nenhum resultado para os filtros aplicados."}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-2">
              {isCollective
                ? (filteredAptos as EnrolledTeam[]).map((t) => (
                    <Card key={t.id} className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                      <CardContent className="py-3 px-4 flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t.delegations?.institutions?.name ?? "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-green-500 text-green-700">
                          {t.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))
                : (filteredAptos as EnrolledIndividual[]).map((e) => (
                    <Card key={e.id} className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                      <CardContent className="py-3 px-4 flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {(e.participants as any)?.people?.full_name ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {(e.participants as any)?.delegations?.institutions?.name ?? "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-green-500 text-green-700">
                          {e.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inaptos">
          {(filteredInaptos as any[]).length === 0 ? (
            <Alert>
              <UserCheck className="h-4 w-4" />
              <AlertDescription>
                {inaptos.length === 0
                  ? "Nenhuma pendência! Todos os inscritos estão aptos. ✅"
                  : "Nenhum resultado para os filtros aplicados."}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-2">
              {isCollective
                ? (filteredInaptos as EnrolledTeam[]).map((t) => (
                    <Card key={t.id} className="border-destructive/30 bg-destructive/5">
                      <CardContent className="py-3 px-4 flex items-center gap-3">
                        <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t.delegations?.institutions?.name ?? "—"}
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-[10px]">
                          {t.status}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))
                : (filteredInaptos as EnrolledIndividual[]).map((e) => {
                    const reason = getInaptReason(e.id);
                    return (
                      <Card key={e.id} className="border-destructive/30 bg-destructive/5">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-start gap-3">
                            <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {(e.participants as any)?.people?.full_name ?? "—"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {(e.participants as any)?.delegations?.institutions?.name ?? "—"}
                              </p>
                              {reason && (
                                <div className="mt-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                                  <p className="text-xs font-medium text-destructive">
                                    {REASON_LABELS[reason.reason_code] ?? reason.reason_code}
                                  </p>
                                  {reason.irregularity_message && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      {reason.irregularity_message}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {reason?.reason_code === "NO_CREDENTIAL" && (
                                <Link to={`/admin/credenciamento?participantId=${reason.participant_id}`}>
                                  <Button variant="outline" size="sm" title="Credenciar">
                                    <UserCheck className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              )}
                              <Link to={`/admin/participantes/${e.participant_id}`}>
                                <Button variant="ghost" size="sm" title="Ver participante">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
