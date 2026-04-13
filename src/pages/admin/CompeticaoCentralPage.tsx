import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useSportEventRules } from "@/hooks/useSportEventRules";
import { useCollectiveStepStatus } from "@/hooks/useCollectiveStepStatus";
import { toast } from "sonner";
import ModuleHeader from "@/components/admin/ModuleHeader";
import SportEventPicker from "@/components/admin/competition/SportEventPicker";
import CompetitionSummaryCards from "@/components/admin/competition/CompetitionSummaryCards";
import CentralStructureTab from "@/components/admin/competition/CentralStructureTab";
import CentralStructureCollectiveTab from "@/components/admin/competition/CentralStructureCollectiveTab";
import CentralStructureHeatsTab from "@/components/admin/competition/CentralStructureHeatsTab";
import CentralEnrolledTab from "@/components/admin/competition/CentralEnrolledTab";
import CentralMatchesTab from "@/components/admin/competition/CentralMatchesTab";
import CentralResultsTab from "@/components/admin/competition/CentralResultsTab";
import EligibilityPendingPanel from "@/components/admin/competition/EligibilityPendingPanel";
import CentralAgendaTab from "@/components/admin/competition/CentralAgendaTab";
import CentralBracketTab from "@/components/admin/competition/CentralBracketTab";
import CentralStandingsTab from "@/components/admin/competition/CentralStandingsTab";
import CrossHeatRankingTab from "@/components/admin/competition/CrossHeatRankingTab";
import WizardStepper, { type WizardStep } from "@/components/admin/competition/WizardStepper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Info, Settings } from "lucide-react";

function getMatchesLabel(family?: string, format?: string): string {
  if (family === "time" || family === "mark") return "Séries/Baterias";
  if (family === "combat") return "Lutas (Chave)";
  if (format === "knockout") return "Chaves";
  return "Confrontos";
}

export default function CompeticaoCentralPage() {
  const eventId = useActiveEventId();
  const [searchParams] = useSearchParams();
  const [sportEventId, setSportEventId] = useState<string | null>(
    searchParams.get("sport_event_id")
  );
  const [currentStep, setCurrentStep] = useState(
    searchParams.get("step") ?? "participants"
  );

  const { rules, source: rulesSource } = useSportEventRules(eventId, sportEventId);

  // Check release status for selected sport_event
  const { data: releaseStatus } = useQuery({
    queryKey: ["release-status", eventId, sportEventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sport_event_rules")
        .select("released_at")
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId!)
        .maybeSingle();
      return { released: data?.released_at != null };
    },
    enabled: !!sportEventId,
  });

  const isReleased = releaseStatus?.released ?? false;

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["competition-summary", eventId, sportEventId],
    queryFn: async () => {
      if (!sportEventId) return null;
      const { data, error } = await supabase.rpc("rpc_get_competition_summary", {
        p_event_id: eventId,
        p_sport_event_id: sportEventId,
      });
      if (error) throw error;
      return data as {
        is_collective: boolean;
        enrolled_count: number;
        teams_count: number;
        matches_count: number;
        matches_no_result: number;
      };
    },
    enabled: !!sportEventId,
  });

  const isCollective = summary?.is_collective ?? false;

  const { data: phases = [] } = useQuery({
    queryKey: ["central-phases-check", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select("id, phase_type, bracket_config")
        .eq("event_id", eventId!)
        .eq("sport_event_id", sportEventId!)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!sportEventId,
  });

  const hasKnockout = phases.some(
    (p: any) => p.bracket_config?.format === "knockout_single_elimination" || p.phase_type === "knockout"
  ) || rules?.format === "knockout";

  const family = rules?.family as string | undefined;
  const format = rules?.format as string | undefined;
  const isTimeMark = family === "time" || family === "mark";

  const showStandings = ["score","sets","time","mark","ranking","swiss"].includes(family ?? "");

  // Step status (collective OR individual time/mark)
  const { stepStatus, isLoading: stepStatusLoading, completedCount } = useCollectiveStepStatus(
    eventId, sportEventId, isCollective, isTimeMark
  );

  const useWizardStatus = isCollective || isTimeMark;

  const steps: WizardStep[] = useMemo(() => [
    { key: "participants", label: isCollective ? "Equipes" : "Participantes" },
    { key: "structure", label: "Estrutura" },
    { key: "matches", label: getMatchesLabel(family, format) },
    { key: "agenda", label: "Agenda" },
    { key: "standings", label: "Classificação", hidden: !showStandings },
    { key: "results", label: "Resultados" },
    { key: "pending", label: "Pendências" },
  ], [isCollective, family, format, showStandings]);

  const visibleSteps = steps.filter((s) => !s.hidden);
  const currentIdx = visibleSteps.findIndex((s) => s.key === currentStep);

  // Legacy completedSteps for individual flow
  const completedSteps = useMemo(() => {
    if (isCollective || isTimeMark) return []; // handled by stepStatus
    const completed: string[] = [];
    if (!summary) return completed;
    if (summary.enrolled_count > 0 || summary.teams_count > 0) completed.push("participants");
    if (phases.length > 0) completed.push("structure");
    if (summary.matches_count > 0) completed.push("matches");
    if (summary.matches_count > 0) completed.push("agenda");
    if (summary.matches_count > 0 && summary.matches_no_result === 0) completed.push("results");
    return completed;
  }, [summary, phases.length, isCollective]);

  // Handle step click with blocking
  const handleStepClick = useCallback((key: string) => {
    if (useWizardStatus && stepStatus[key]) {
      const info = stepStatus[key];
      if (info.status === "blocked" && info.blockMessage) {
        toast.warning(info.blockMessage);
        return;
      }
    }
    setCurrentStep(key);
  }, [useWizardStatus, stepStatus]);

  // Deep-link validation: redirect if step is blocked
  useEffect(() => {
    const step = searchParams.get("step");
    const seId = searchParams.get("sport_event_id");
    if (seId) setSportEventId(seId);
    if (step) {
      if (useWizardStatus && stepStatus[step]?.status === "blocked") {
        const firstAvailable = visibleSteps.find(
          (s) => !stepStatus[s.key] || stepStatus[s.key].status !== "blocked"
        );
        const fallback = firstAvailable?.key ?? "participants";
        setCurrentStep(fallback);
        if (stepStatus[step]?.blockMessage) {
          toast.warning(stepStatus[step].blockMessage);
        }
      } else {
        setCurrentStep(step);
      }
    }
  }, [searchParams, useWizardStatus, stepStatus, visibleSteps]);

  const goNext = () => {
    if (currentIdx < visibleSteps.length - 1) {
      const nextKey = visibleSteps[currentIdx + 1].key;
      handleStepClick(nextKey);
    }
  };
  const goPrev = () => {
    if (currentIdx > 0) {
      const prevKey = visibleSteps[currentIdx - 1].key;
      handleStepClick(prevKey);
    }
  };

  // Progress bar
  const progressPercent = useWizardStatus
    ? Math.round((completedCount / visibleSteps.length) * 100)
    : 0;

  // Refetch step status when summary changes
  const handleChanged = useCallback(() => {
    refetchSummary();
  }, [refetchSummary]);

  return (
    <div className="space-y-6">
      <ModuleHeader
        route="/admin/competicao/central"
        title="Central da Competição"
      />

      <SportEventPicker
        eventId={eventId}
        value={sportEventId}
        onChange={(id) => {
          setSportEventId(id);
          setCurrentStep("participants");
        }}
      />

      {sportEventId && isReleased && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {rulesSource === "default" && (
              <Alert className="flex-1">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Sem regras cadastradas: usando padrão.{" "}
                  <Link to={`/admin/competicao/regras`} className="underline font-medium">
                    Configurar em Regras por Prova
                  </Link>
                  {" · "}
                  <Link to={`/admin/competicao/regras/lote`} className="underline font-medium">
                    Gerar regras em lote
                  </Link>
                </AlertDescription>
              </Alert>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/competicao/regras">
                <Settings className="h-4 w-4 mr-1" />
                Editar regras
              </Link>
            </Button>
          </div>

          <CompetitionSummaryCards summary={summary} loading={summaryLoading} />

          {/* Progress indicator for collectives */}
          {useWizardStatus && !stepStatusLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Passo {currentIdx + 1} de {visibleSteps.length} — {visibleSteps[currentIdx]?.label ?? ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {completedCount} de {visibleSteps.length} concluído(s)
                </span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          )}

          <WizardStepper
            steps={steps}
            currentStep={currentStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
            stepStatus={useWizardStatus ? stepStatus : undefined}
          />

          <div className="min-h-[300px]">
            {currentStep === "participants" && (
              <CentralEnrolledTab
                eventId={eventId}
                sportEventId={sportEventId}
                isCollective={isCollective}
              />
            )}

            {currentStep === "structure" && (
              isCollective ? (
                <CentralStructureCollectiveTab
                  eventId={eventId}
                  sportEventId={sportEventId}
                  onChanged={handleChanged}
                  onAdvanceStep={goNext}
                />
              ) : isTimeMark ? (
                <CentralStructureHeatsTab
                  eventId={eventId}
                  sportEventId={sportEventId}
                  onChanged={handleChanged}
                  onAdvanceStep={goNext}
                />
              ) : (
                <CentralStructureTab
                  eventId={eventId}
                  sportEventId={sportEventId}
                  onChanged={handleChanged}
                />
              )
            )}

            {currentStep === "matches" && (
              hasKnockout ? (
                <CentralBracketTab
                  eventId={eventId}
                  sportEventId={sportEventId}
                  isCollective={isCollective}
                />
              ) : (
                <CentralMatchesTab
                  eventId={eventId}
                  sportEventId={sportEventId}
                  isCollective={isCollective}
                  onChanged={handleChanged}
                />
              )
            )}

            {currentStep === "agenda" && (
              <CentralAgendaTab
                eventId={eventId}
                sportEventId={sportEventId}
                onChanged={handleChanged}
              />
            )}

            {currentStep === "standings" && (
              isTimeMark ? (
                <CrossHeatRankingTab
                  eventId={eventId}
                  sportEventId={sportEventId!}
                />
              ) : (
                <CentralStandingsTab
                  eventId={eventId}
                  sportEventId={sportEventId}
                  family={family ?? null}
                  format={format ?? null}
                />
              )
            )}

            {currentStep === "results" && (
              <CentralResultsTab
                eventId={eventId}
                sportEventId={sportEventId}
                isCollective={isCollective}
              />
            )}

            {currentStep === "pending" && (
              <EligibilityPendingPanel
                eventId={eventId}
                sportEventId={sportEventId}
              />
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={currentIdx <= 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {currentIdx > 0 ? visibleSteps[currentIdx - 1].label : "Anterior"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Passo {currentIdx + 1} de {visibleSteps.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goNext}
              disabled={currentIdx >= visibleSteps.length - 1}
            >
              {currentIdx < visibleSteps.length - 1 ? visibleSteps[currentIdx + 1].label : "Próximo"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
