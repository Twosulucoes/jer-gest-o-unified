import { useState, useMemo, useEffect, useDeferredValue } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useCompetitionContext } from "@/contexts/CompetitionContext";
import { useUserSportLinks } from "@/hooks/useUserSportLinks";
import { useStageModuleKpis } from "@/contexts/StageModuleKpisContext";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  Trophy,
  AlertTriangle,
  Dumbbell,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProvaCard } from "./competicao/painel/ProvaCard";
import { mapStepToWizard, type ProvaRow, type ProvaStatus } from "./competicao/painel/lib/computeProvaData";
import { usePainelProvas } from "./competicao/painel/hooks/usePainelProvas";

export default function CompeticaoPainelPage() {
  const { stageId } = useParams();
  const eventId = useActiveEventId();
  const navigate = useNavigate();
  const {
    sportIds: mySportIds,
    isCoordModalidade,
    isLoading: loadingSportLinks,
  } = useUserSportLinks();
  const { selectedSportId, setSelectedSportId } = useCompetitionContext();

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sportFilter, setSportFilter] = useState(selectedSportId || "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [groupBySport, setGroupBySport] = useState(false);
  const [hideEmpty, setHideEmpty] = useState(true);

  // Sync sport filter with global competition context
  useEffect(() => {
    setSelectedSportId(sportFilter === "all" ? null : sportFilter);
  }, [sportFilter, setSelectedSportId]);

  // Stage info (for header title)
  const { data: stage } = useQuery({
    queryKey: ["event_stage", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("name, event_id")
        .eq("id", stageId!)
        .eq("event_id", eventId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Defense-in-depth: ensure stageId belongs to active event
  const { data: stageBelongs } = useQuery({
    queryKey: ["event_stage_belongs", stageId, eventId],
    enabled: !!stageId && !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_stages")
        .select("id")
        .eq("id", stageId!)
        .eq("event_id", eventId!)
        .maybeSingle();
      return !!data;
    },
  });

  const { provas, isLoading, isFetching, lastUpdate } = usePainelProvas({
    eventId,
    stageId,
    mySportIds,
    isCoordModalidade,
    loadingSportLinks,
  });

  // Sport list for filter dropdown
  const sports = useMemo(() => {
    const unique = new Map<string, string>();
    provas.forEach((p) => unique.set(p.sport_id, p.sport_name));
    return Array.from(unique, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [provas]);

  // Single-pass totals (was 5 .filter() calls)
  const totals = useMemo(() => {
    const acc = {
      total: 0,
      bloqueada: 0,
      nao_iniciada: 0,
      em_andamento: 0,
      com_pendencia: 0,
      concluida: 0,
    };
    for (const p of provas) {
      acc.total++;
      acc[p.status]++;
    }
    return acc;
  }, [provas]);

  // Push KPIs to the StageMiniDash via context (avoids duplicating chrome).
  useStageModuleKpis(
    [
      { label: "Provas", value: totals.total, tone: "default" },
      { label: "Em andamento", value: totals.em_andamento, tone: "warning" },
      { label: "Pendências", value: totals.com_pendencia, tone: "danger" },
      { label: "Concluídas", value: totals.concluida, tone: "success" },
    ],
    false
  );

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return provas.filter((p) => {
      if (sportFilter !== "all" && p.sport_id !== sportFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter === "coletiva" && !p.is_collective) return false;
      if (typeFilter === "individual" && p.is_collective) return false;
      if (hideEmpty) {
        const hasParticipants = p.is_collective
          ? p.team_count > 0
          : p.enrolled_count > 0;
        if (!hasParticipants) return false;
      }
      if (q) {
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.sport_name.toLowerCase().includes(q) &&
          !p.category_name.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [provas, sportFilter, statusFilter, typeFilter, deferredSearch, hideEmpty]);

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

  const headerRoute = useMemo(
    () =>
      stageId
        ? `/admin/etapa/${stageId}/competicao/painel`
        : "/admin/competicao/painel",
    [stageId]
  );

  const headerTitle = useMemo(
    () =>
      stageId
        ? `Painel da Competição — ${stage?.name || "Etapa"}`
        : isCoordModalidade
        ? "Minhas Modalidades"
        : "Painel de Controle da Competição",
    [stageId, stage?.name, isCoordModalidade]
  );

  // Action handler — "concluida" goes to a read-only results route.
  function handleAction(prova: ProvaRow) {
    const baseNav = stageId ? `/admin/etapa/${stageId}/competicao` : "/admin/competicao";

    if (prova.family === "score") {
      navigate(`${baseNav}/painel-score/${prova.id}`);
      return;
    }
    if (prova.family === "sets") {
      navigate(`${baseNav}/painel-sets/${prova.id}`);
      return;
    }
    if (prova.family === "combat") {
      navigate(`${baseNav}/painel-combat/${prova.id}`);
      return;
    }
    if (prova.family === "time" || prova.family === "mark") {
      navigate(`${baseNav}/painel-time-mark/${prova.id}`);
      return;
    }
    if (prova.family === "sets") {
      navigate(`/admin/competicao/painel-sets/${prova.id}`);
      return;
    }

    const base = stageId
      ? `/admin/etapa/${stageId}/competicao`
      : "/admin/competicao";

    if (prova.status === "bloqueada") {
      navigate(`${base}/pre-validacao`);
      return;
    }
    if (prova.status === "concluida") {
      navigate(`${base}/resultados?sport_event_id=${prova.id}`);
      return;
    }
    const step = mapStepToWizard(prova.firstIncompleteStep);
    navigate(`${base}/central?sport_event_id=${prova.id}&step=${step}`);
  }

  const openManualFlow = () => {
    const base = stageId ? `/admin/etapa/${stageId}/competicao` : "/admin/competicao";
    navigate(`${base}/central`);
  };

  // Coordenador without sport links
  if (isCoordModalidade && mySportIds && mySportIds.length === 0) {
    return (
      <div className="space-y-6">
        <ModuleHeader route={headerRoute} title="Minhas Modalidades" />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você não tem modalidades atribuídas. Contate o administrador para
            vincular modalidades ao seu perfil.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Stage doesn't belong to active event
  if (stageId && stageBelongs === false) {
    return (
      <div className="space-y-6">
        <ModuleHeader route={headerRoute} title="Painel da Competição" />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta etapa não pertence ao evento ativo. Verifique o contexto de
            evento selecionado.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const skeletonCount = Math.min(provas.length || 6, 6);

  return (
    <div className="space-y-6">
      <ModuleHeader
        route={headerRoute}
        title={headerTitle}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" onClick={openManualFlow}>
              Fluxo manual completo
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  isFetching ? "bg-warning animate-pulse" : "bg-success"
                )}
                aria-hidden
              />
              <RefreshCw
                className={cn("h-3 w-3", isFetching && "animate-spin")}
              />
              Atualizado em: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prova..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Modalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas modalidades</SelectItem>
            {sports.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
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
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
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
          {hideEmpty ? (
            <ToggleRight className="h-4 w-4 text-primary" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
          Com inscritos
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 whitespace-nowrap"
          onClick={() => setGroupBySport(!groupBySport)}
        >
          {groupBySport ? (
            <ToggleRight className="h-4 w-4 text-primary" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
          Por modalidade
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Trophy className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">Nenhuma prova encontrada</p>
          <p className="text-sm">
            Ajuste os filtros ou verifique a importação de dados para esta
            etapa.
          </p>
        </div>
      )}

      {/* Flat list */}
      {!isLoading &&
        !groupBySport &&
        filtered.map((prova) => (
          <ProvaCard key={prova.id} prova={prova} onAction={handleAction} />
        ))}

      {/* Grouped */}
      {!isLoading &&
        groupBySport &&
        grouped?.map(([sportName, items]) => {
          const done = items.filter(
            (i) => (i.status as ProvaStatus) === "concluida"
          ).length;
          return (
            <div key={sportName} className="space-y-2">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-heading font-semibold text-sm">
                  {sportName}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {done} de {items.length} concluídas
                </Badge>
              </div>
              {items.map((prova) => (
                <ProvaCard
                  key={prova.id}
                  prova={prova}
                  onAction={handleAction}
                />
              ))}
            </div>
          );
        })}
    </div>
  );
}
