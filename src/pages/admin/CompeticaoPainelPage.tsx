import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
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
function computeProvaData(
  se: any,
  rulesMap: Map<string, any>,
  phaseMap: Map<string, number>,
  groupMap: Map<string, number>,
  matchMap: Map<string, { total: number; withResult: number; withSchedule: number; validated: number; published: number }>,
  teamMap: Map<string, number>,
  enrolledMap: Map<string, number>,
): ProvaRow {
  const rule = rulesMap.get(se.id);
  const sport = se.sports as any;
  const cat = se.categories as any;
  const isCollective = sport?.is_collective === true;
  const releasedAt = rule?.released_at ?? null;

  const enrolled = enrolledMap.get(se.id) ?? 0;
  const teams = teamMap.get(se.id) ?? 0;
  const phases = phaseMap.get(se.id) ?? 0;
  const groups = groupMap.get(se.id) ?? 0;
  const m = matchMap.get(se.id) ?? { total: 0, withResult: 0, withSchedule: 0, validated: 0, published: 0 };

  // Steps
  const steps: StepStatus[] = isCollective
    ? [
        { key: "teams", label: "Equipes", state: teams > 0 ? "done" : "pending" },
        { key: "structure", label: "Estrutura", state: phases > 0 ? "done" : "pending" },
        { key: "matches", label: "Partidas", state: m.total > 0 ? "done" : "pending" },
        { key: "agenda", label: "Agenda", state: m.total > 0 && m.withSchedule === m.total ? "done" : m.withSchedule > 0 ? "active" : "pending" },
        { key: "results", label: "Resultados", state: m.total > 0 && m.withResult === m.total ? "done" : m.withResult > 0 ? "active" : "pending" },
        { key: "published", label: "Publicado", state: m.total > 0 && m.published === m.total ? "done" : m.published > 0 ? "active" : "pending" },
      ]
    : [
        { key: "athletes", label: "Atletas", state: enrolled > 0 ? "done" : "pending" },
        { key: "structure", label: "Estrutura", state: phases > 0 ? "done" : "pending" },
        { key: "results", label: "Resultados", state: m.total > 0 && m.withResult === m.total ? "done" : m.withResult > 0 ? "active" : "pending" },
        { key: "published", label: "Publicado", state: m.total > 0 && m.published === m.total ? "done" : m.published > 0 ? "active" : "pending" },
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
  } else if (m.withResult > 0 && m.validated < m.withResult) {
    status = "com_pendencia";
  } else if (doneCount === 0) {
    status = "nao_iniciada";
  } else {
    status = "em_andamento";
  }

  return {
    id: se.id,
    name: se.name,
    sport_name: sport?.name ?? "—",
    sport_id: se.sport_id,
    category_name: cat?.name ?? "—",
    is_collective: isCollective,
    released_at: releasedAt,
    enrolled_count: enrolled,
    team_count: teams,
    phase_count: phases,
    group_count: groups,
    match_count: m.total,
    matches_with_result: m.withResult,
    matches_with_schedule: m.withSchedule,
    results_validated: m.validated,
    results_published: m.published,
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
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [groupBySport, setGroupBySport] = useState(false);

  // ── Query 1: Sport events + rules ────────────────────────
  const { data: provas = [], isLoading } = useQuery({
    queryKey: ["painel-competicao", eventId, mySportIds],
    enabled: !!eventId && (!isCoordModalidade || !loadingSportLinks),
    staleTime: 30_000,
    queryFn: async () => {
      // Parallel fetches
      let seQuery = supabase.from("sport_events").select("id, name, sport_id, category_id, sports(name, is_collective), categories(name, gender_scope)").eq("event_id", eventId!).eq("is_active", true).order("name");
      if (mySportIds && mySportIds.length > 0) seQuery = seQuery.in("sport_id", mySportIds);
      if (mySportIds && mySportIds.length === 0) return []; // coord without links

      const [seRes, rulesRes, phasesRes, groupsRes, matchesRes, resultsRes, teamsRes, enrolledRes] = await Promise.all([
        seQuery,
        supabase.from("sport_event_rules").select("sport_event_id, released_at").eq("event_id", eventId!),
        supabase.from("competition_phases").select("id, sport_event_id").eq("event_id", eventId!),
        supabase.from("competition_groups").select("id, phase_id").eq("event_id", eventId!),
        supabase.from("competition_matches").select("id, sport_event_id, match_date, start_time, venue_id, status").eq("event_id", eventId!),
        supabase.from("competition_match_results").select("id, match_id, result_status, match_entry_id").eq("result_status", "resultado_lancado").limit(5000),
        supabase.from("teams").select("id, sport_event_id").eq("event_id", eventId!).eq("status", "active"),
        supabase.from("participant_sport_events").select("id, sport_event_id").in("status", ["confirmed", "approved", "valid", "active"]),
      ]);

      if (seRes.error) throw seRes.error;

      // Build maps
      const rulesMap = new Map((rulesRes.data ?? []).map((r: any) => [r.sport_event_id, r]));

      // Phase count per sport_event — need to map phases to sport_events
      // We need sport_event_id on phases
      const phasesBySe = new Map<string, number>();
      // Re-fetch with sport_event_id
      const { data: phasesData } = await supabase.from("competition_phases").select("id, sport_event_id").eq("event_id", eventId!);
      for (const p of phasesData ?? []) {
        phasesBySe.set(p.sport_event_id, (phasesBySe.get(p.sport_event_id) ?? 0) + 1);
      }

      const groupsBySe = new Map<string, number>();
      // Groups don't have sport_event_id directly, need to join via phases
      const phaseIdToSe = new Map<string, string>();
      for (const p of phasesData ?? []) phaseIdToSe.set(p.id, p.sport_event_id);
      // Re-use groupsRes which has phase_id
      for (const g of groupsRes.data ?? []) {
        const seId = phaseIdToSe.get(g.phase_id);
        if (seId) groupsBySe.set(seId, (groupsBySe.get(seId) ?? 0) + 1);
      }

      // Matches per sport_event
      const matchBySe = new Map<string, { total: number; withResult: number; withSchedule: number; validated: number; published: number }>();
      const matchIds = new Set<string>();
      for (const m of matchesRes.data ?? []) {
        if (!m.sport_event_id) continue;
        const entry = matchBySe.get(m.sport_event_id) ?? { total: 0, withResult: 0, withSchedule: 0, validated: 0, published: 0 };
        entry.total++;
        if (m.match_date && m.start_time) entry.withSchedule++;
        matchBySe.set(m.sport_event_id, entry);
        matchIds.add(m.id);
      }

      // Results — we need ALL results not just lancado, let me refetch properly
      const { data: allResults } = await supabase
        .from("competition_match_results")
        .select("id, match_id, result_status")
        .limit(5000);

      // Map match_id to sport_event_id via matchesRes
      const matchToSe = new Map<string, string>();
      for (const m of matchesRes.data ?? []) {
        if (m.sport_event_id) matchToSe.set(m.id, m.sport_event_id);
      }

      const matchesWithResult = new Set<string>();
      const matchesValidated = new Set<string>();
      const matchesPublished = new Set<string>();
      for (const r of allResults ?? []) {
        matchesWithResult.add(r.match_id);
        if (r.result_status === "validado" || r.result_status === "publicado") matchesValidated.add(r.match_id);
        if (r.result_status === "publicado") matchesPublished.add(r.match_id);
      }

      // Update matchBySe with result counts
      for (const [matchId, seId] of matchToSe) {
        const entry = matchBySe.get(seId);
        if (!entry) continue;
        if (matchesWithResult.has(matchId)) entry.withResult++;
        if (matchesValidated.has(matchId)) entry.validated++;
        if (matchesPublished.has(matchId)) entry.published++;
      }

      // Teams per sport_event
      const teamBySe = new Map<string, number>();
      for (const t of teamsRes.data ?? []) {
        teamBySe.set(t.sport_event_id, (teamBySe.get(t.sport_event_id) ?? 0) + 1);
      }

      // Enrolled per sport_event
      const enrolledBySe = new Map<string, number>();
      for (const e of enrolledRes.data ?? []) {
        enrolledBySe.set(e.sport_event_id, (enrolledBySe.get(e.sport_event_id) ?? 0) + 1);
      }

      // Build rows
      return (seRes.data ?? []).map((se: any) =>
        computeProvaData(se, rulesMap, phasesBySe, groupsBySe, matchBySe, teamBySe, enrolledBySe)
      );
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

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <ModuleHeader
        route="/admin/competicao/painel"
        title="Painel de Controle da Competição"
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
