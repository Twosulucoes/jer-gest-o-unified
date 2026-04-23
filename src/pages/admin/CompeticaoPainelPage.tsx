import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useCompetitionContext } from "@/contexts/CompetitionContext";
import { useUserSportLinks } from "@/hooks/useUserSportLinks";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search, Trophy, Users, LayoutDashboard, Play, ArrowRight,
  AlertTriangle, CheckCircle2, Lock, Clock, Eye, Dumbbell,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import { RESULT_STATUS } from "@/lib/resultStatus";

// ── Types ──────────────────────────────────────────────────
type ProvaStatus = "bloqueada" | "nao_iniciada" | "em_andamento" | "com_pendencia" | "concluida";

interface StepStatus {
  key: string;
  label: string;
  state: "done" | "active" | "pending" | "error";
}

interface ProvaRow {
  id: string;
  name: string;
  sport_name: string;
  sport_id: string;
  category_name: string;
  is_collective: boolean;
  released_at: string | null;
  // counts
  enrolled_count: number;
  team_count: number;
  phase_count: number;
  group_count: number;
  match_count: number;
  matches_with_result: number;
  matches_with_schedule: number;
  results_validated: number;
  results_published: number;
  // computed
  status: ProvaStatus;
  steps: StepStatus[];
  progress: number;
  firstIncompleteStep: string;
}

// ── Status computation ─────────────────────────────────────
function computeProvaData(row: any): ProvaRow {
  const isCollective = row.is_collective;
  const releasedAt = row.released_at;

  const enrolled = row.enrolled_count;
  const teams = row.team_count;
  const phases = row.phase_count;
  const groups = row.group_count;
  const matchCount = row.match_count;
  const withResult = row.matches_with_result;
  const withSchedule = row.matches_with_schedule;
  const validated = row.results_validated;
  const published = row.results_published;

  // Steps
  const steps: StepStatus[] = isCollective
    ? [
        { key: "teams", label: "Equipes", state: teams > 0 ? "done" : "pending" },
        { key: "structure", label: "Estrutura", state: phases > 0 ? "done" : "pending" },
        { key: "matches", label: "Partidas", state: matchCount > 0 ? "done" : "pending" },
        { key: "agenda", label: "Agenda", state: matchCount > 0 && withSchedule === matchCount ? "done" : withSchedule > 0 ? "active" : "pending" },
        { key: "results", label: "Resultados", state: matchCount > 0 && withResult === matchCount ? "done" : withResult > 0 ? "active" : "pending" },
        { key: "published", label: "Publicado", state: matchCount > 0 && published === matchCount ? "done" : published > 0 ? "active" : "pending" },
      ]
    : [
        { key: "athletes", label: "Atletas", state: enrolled > 0 ? "done" : "pending" },
        { key: "structure", label: "Estrutura", state: phases > 0 ? "done" : "pending" },
        { key: "results", label: "Resultados", state: matchCount > 0 && withResult === matchCount ? "done" : withResult > 0 ? "active" : "pending" },
        { key: "published", label: "Publicado", state: matchCount > 0 && published === matchCount ? "done" : published > 0 ? "active" : "pending" },
      ];

  const doneCount = steps.filter((s) => s.state === "done").length;
  const progress = Math.round((doneCount / steps.length) * 100);
  const firstIncomplete = steps.find((s) => s.state !== "done")?.key ?? steps[steps.length - 1].key;

  // Status
  let status: ProvaStatus;
  if (!releasedAt) {
    status = "bloqueada";
  } else if (doneCount === steps.length) {
    status = "concluida";
  } else if (withResult > 0 && validated < withResult) {
    status = "com_pendencia";
  } else if (doneCount === 0) {
    status = "nao_iniciada";
  } else {
    status = "em_andamento";
  }

  return {
    id: row.sport_event_id,
    name: row.name,
    sport_name: row.sport_name,
    sport_id: row.sport_id,
    category_name: row.category_name,
    is_collective: isCollective,
    released_at: releasedAt,
    enrolled_count: enrolled,
    team_count: teams,
    phase_count: phases,
    group_count: groups,
    match_count: matchCount,
    matches_with_result: withResult,
    matches_with_schedule: withSchedule,
    results_validated: validated,
    results_published: published,
    status,
    steps,
    progress,
    firstIncompleteStep: firstIncomplete,
  };
}

// ── Wizard step mapping ────────────────────────────────────
function mapStepToWizard(step: string): string {
  const map: Record<string, string> = {
    teams: "participants",
    athletes: "participants",
    structure: "structure",
    matches: "matches",
    agenda: "agenda",
    results: "results",
    published: "results",
  };
  return map[step] ?? "participants";
}

// ── Status config ──────────────────────────────────────────
const STATUS_CONFIG: Record<ProvaStatus, { label: string; color: string; icon: React.ReactNode }> = {
  bloqueada: { label: "Bloqueada", color: "bg-muted text-muted-foreground", icon: <Lock className="h-3.5 w-3.5" /> },
  nao_iniciada: { label: "Não iniciada", color: "bg-primary/10 text-primary", icon: <Clock className="h-3.5 w-3.5" /> },
  em_andamento: { label: "Em andamento", color: "bg-warning/10 text-warning", icon: <Play className="h-3.5 w-3.5" /> },
  com_pendencia: { label: "Com pendência", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  concluida: { label: "Concluída", color: "bg-success/10 text-success", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
};

const STEP_COLORS: Record<string, string> = {
  done: "bg-success",
  active: "bg-warning",
  pending: "bg-muted",
  error: "bg-destructive",
};

// ── Component ──────────────────────────────────────────────
export default function CompeticaoPainelPage() {
  const eventId = useActiveEventId();
  const navigate = useNavigate();
  const { sportIds: mySportIds, isCoordModalidade, isLoading: loadingSportLinks } = useUserSportLinks();
  const { selectedSportId, setSelectedSportId } = useCompetitionContext();
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState(selectedSportId || "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [groupBySport, setGroupBySport] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(true);

  // Sync with context
  useEffect(() => {
    setSelectedSportId(sportFilter === "all" ? null : sportFilter);
  }, [sportFilter, setSelectedSportId]);

  // ── Realtime Subscription ────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    
    // Subscribe to match changes to refresh the dashboard
    const channel = supabase
      .channel("painel-competicao-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_matches", filter: `event_id=eq.${eventId}` },
        () => {
          // Refetch everything when a match changes
          qc.invalidateQueries({ queryKey: ["painel-competicao", eventId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc]);

  // ── Query 1: Sport events + rules ────────────────────────
  const { data: provas = [], isLoading } = useQuery({
    queryKey: ["painel-competicao", eventId, mySportIds],
    enabled: !!eventId && (!isCoordModalidade || !loadingSportLinks),
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase
        .from("vw_sport_event_summary")
        .select("*")
        .eq("event_id", eventId!)
        .eq("is_active", true)
        .order("sport_name")
        .order("name");

      if (mySportIds && mySportIds.length > 0) {
        query = query.in("sport_id", mySportIds);
      } else if (isCoordModalidade && mySportIds && mySportIds.length === 0) {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row: any) => computeProvaData(row));
    },
  });

  // ── Derived ──────────────────────────────────────────────
  const sports = useMemo(() => {
    const unique = new Map<string, string>();
    provas.forEach((p) => unique.set(p.sport_id, p.sport_name));
    return Array.from(unique, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [provas]);

  const filtered = useMemo(() => {
    return provas.filter((p) => {
      if (sportFilter !== "all" && p.sport_id !== sportFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter === "coletiva" && !p.is_collective) return false;
      if (typeFilter === "individual" && p.is_collective) return false;
      if (hideEmpty) {
        const hasParticipants = p.is_collective ? p.team_count > 0 : p.enrolled_count > 0;
        if (!hasParticipants) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.sport_name.toLowerCase().includes(q) && !p.category_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [provas, sportFilter, statusFilter, typeFilter, search]);

  const totals = useMemo(() => ({
    total: provas.length,
    bloqueada: provas.filter((p) => p.status === "bloqueada").length,
    nao_iniciada: provas.filter((p) => p.status === "nao_iniciada").length,
    em_andamento: provas.filter((p) => p.status === "em_andamento").length,
    com_pendencia: provas.filter((p) => p.status === "com_pendencia").length,
    concluida: provas.filter((p) => p.status === "concluida").length,
  }), [provas]);

  // ── Group by sport ───────────────────────────────────────
  const grouped = useMemo(() => {
    if (!groupBySport) return null;
    const map = new Map<string, ProvaRow[]>();
    filtered.forEach((p) => {
      const arr = map.get(p.sport_name) ?? [];
      arr.push(p);
      map.set(p.sport_name, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, groupBySport]);

  // ── Actions ──────────────────────────────────────────────
  function handleAction(prova: ProvaRow) {
    if (prova.status === "bloqueada") {
      navigate("/admin/competicao/pre-validacao");
    } else {
      const step = mapStepToWizard(prova.firstIncompleteStep);
      navigate(`/admin/competicao/central?sport_event_id=${prova.id}&step=${step}`);
    }
  }

  function getActionLabel(status: ProvaStatus) {
    switch (status) {
      case "bloqueada": return "Pré-validação";
      case "nao_iniciada": return "Iniciar";
      case "em_andamento": return "Continuar";
      case "com_pendencia": return "Resolver";
      case "concluida": return "Ver resultados";
    }
  }

  function getActionIcon(status: ProvaStatus) {
    switch (status) {
      case "bloqueada": return <Lock className="h-3.5 w-3.5" />;
      case "nao_iniciada": return <Play className="h-3.5 w-3.5" />;
      case "em_andamento": return <ArrowRight className="h-3.5 w-3.5" />;
      case "com_pendencia": return <AlertTriangle className="h-3.5 w-3.5" />;
      case "concluida": return <Eye className="h-3.5 w-3.5" />;
    }
  }

  if (isCoordModalidade && mySportIds && mySportIds.length === 0) {
    return (
      <div className="space-y-6">
        <ModuleHeader route="/admin/competicao/painel" title="Minhas Modalidades" />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Você não tem modalidades atribuídas. Contate o administrador para vincular modalidades ao seu perfil.</AlertDescription>
        </Alert>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <ModuleHeader
        route="/admin/competicao/painel"
        title={isCoordModalidade ? "Minhas Modalidades" : "Painel de Controle da Competição"}
      />

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total", value: totals.total, color: "text-foreground" },
          { label: "Bloqueadas", value: totals.bloqueada, color: "text-muted-foreground" },
          { label: "Não iniciadas", value: totals.nao_iniciada, color: "text-primary" },
          { label: "Em andamento", value: totals.em_andamento, color: "text-warning" },
          { label: "Pendências", value: totals.com_pendencia, color: "text-orange-600 dark:text-orange-400" },
          { label: "Concluídas", value: totals.concluida, color: "text-success" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{isLoading ? "—" : kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Banners */}
      {!isLoading && provas.length > 0 && totals.concluida === provas.length && (
        <Alert className="border-success/30 bg-success/5">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription className="text-success font-medium">
            Todas as provas estão concluídas! 🎉
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && provas.length > 0 && totals.bloqueada === provas.length && (
        <Alert className="border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription>
            Nenhuma prova foi liberada ainda.{" "}
            <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => navigate("/admin/competicao/pre-validacao")}>
              Acesse a Pré-validação para iniciar.
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && provas.length > 0 && totals.bloqueada > 0 && totals.bloqueada < provas.length && (
        <p className="text-sm text-muted-foreground">
          {provas.length - totals.bloqueada} de {provas.length} provas liberadas para competição
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar prova..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Modalidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas modalidades</SelectItem>
            {sports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas situações</SelectItem>
            <SelectItem value="bloqueada">Bloqueada</SelectItem>
            <SelectItem value="nao_iniciada">Não iniciada</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="com_pendencia">Com pendência</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="coletiva">Coletiva</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 whitespace-nowrap"
          onClick={() => setHideEmpty(!hideEmpty)}
        >
          {hideEmpty ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          Com inscritos
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 whitespace-nowrap"
          onClick={() => setGroupBySport(!groupBySport)}
        >
          {groupBySport ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
          Por modalidade
        </Button>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Trophy className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">Nenhuma prova encontrada</p>
          <p className="text-sm">Ajuste os filtros ou verifique a importação de dados.</p>
        </div>
      )}

      {/* List */}
      {!isLoading && !groupBySport && filtered.map((prova) => (
        <ProvaCard key={prova.id} prova={prova} onAction={handleAction} getActionLabel={getActionLabel} getActionIcon={getActionIcon} />
      ))}

      {/* Grouped */}
      {!isLoading && groupBySport && grouped?.map(([sportName, items]) => {
        const done = items.filter((i) => i.status === "concluida").length;
        return (
          <div key={sportName} className="space-y-2">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-heading font-semibold text-sm">{sportName}</h3>
              <Badge variant="secondary" className="text-xs">{done} de {items.length} concluídas</Badge>
            </div>
            {items.map((prova) => (
              <ProvaCard key={prova.id} prova={prova} onAction={handleAction} getActionLabel={getActionLabel} getActionIcon={getActionIcon} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Prova Card ─────────────────────────────────────────────
function ProvaCard({
  prova,
  onAction,
  getActionLabel,
  getActionIcon,
}: {
  prova: ProvaRow;
  onAction: (p: ProvaRow) => void;
  getActionLabel: (s: ProvaStatus) => string;
  getActionIcon: (s: ProvaStatus) => React.ReactNode;
}) {
  const cfg = STATUS_CONFIG[prova.status];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4">
        {/* Left: Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-heading font-semibold text-sm truncate">{prova.name}</h4>
            <Badge variant="outline" className="text-[10px]">{prova.is_collective ? "Coletiva" : "Individual"}</Badge>
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.color}`}>
              {cfg.icon}
              {cfg.label}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {prova.sport_name} · {prova.category_name}
          </p>

          {/* Counters */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            {prova.is_collective ? (
              <>
                <span><Users className="inline h-3 w-3 mr-0.5" />{prova.team_count} equipes</span>
                <span>{prova.match_count} partidas</span>
                <span>{prova.matches_with_result} resultados</span>
              </>
            ) : (
              <>
                <span><Users className="inline h-3 w-3 mr-0.5" />{prova.enrolled_count} inscritos</span>
                <span>{prova.match_count} partidas</span>
                <span>{prova.matches_with_result} resultados</span>
              </>
            )}
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-1 mt-1">
            {prova.steps.map((step, i) => (
              <div key={step.key} className="flex items-center gap-1">
                <div
                  className={`h-2 w-2 rounded-full ${STEP_COLORS[step.state]}`}
                  title={`${step.label}: ${step.state === "done" ? "Concluído" : step.state === "active" ? "Em andamento" : "Pendente"}`}
                />
                <span className="text-[9px] text-muted-foreground hidden sm:inline">{step.label}</span>
                {i < prova.steps.length - 1 && <span className="text-muted-foreground/30 text-[8px] hidden sm:inline">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Progress + Action */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-20 space-y-1">
            <Progress value={prova.progress} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground text-center">{prova.progress}%</p>
          </div>
          <Button size="sm" variant={prova.status === "concluida" ? "outline" : "default"} className="gap-1.5 whitespace-nowrap" onClick={() => onAction(prova)}>
            {getActionIcon(prova.status)}
            {getActionLabel(prova.status)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
