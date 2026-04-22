import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useCompetitionContext } from "@/contexts/CompetitionContext";
import ModuleHeader from "@/components/admin/ModuleHeader";
import SportEventPicker from "@/components/admin/competition/SportEventPicker";
import CompetitionSummaryCards from "@/components/admin/competition/CompetitionSummaryCards";
import CentralParticipantsTab from "@/components/admin/competition/CentralParticipantsTab";
import CentralMatchesTab from "@/components/admin/competition/CentralMatchesTab";
import DisputeBuilderTab from "@/components/admin/competition/DisputeBuilderTab";
import IndividualHeatBuilderTab from "@/components/admin/competition/IndividualHeatBuilderTab";
import CentralResultsTab from "@/components/admin/competition/CentralResultsTab";
import CentralAgendaTab from "@/components/admin/competition/CentralAgendaTab";
import WizardStepper, { type WizardStep } from "@/components/admin/competition/WizardStepper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useStageScope } from "@/hooks/useStageScope";

export default function CompeticaoCentralPage() {
  const eventId = useActiveEventId();
  const [searchParams] = useSearchParams();
  const { selectedSportEventId, setSelectedSportEventId, setSelectedStageId } = useCompetitionContext();

  const [sportEventId, setSportEventId] = useState<string | null>(
    searchParams.get("sport_event_id") || selectedSportEventId
  );
  const [currentStep, setCurrentStep] = useState(
    searchParams.get("step") ?? "participants"
  );

  // Escopo de etapa (se a página estiver dentro de /admin/etapa/:stageId/...)
  const { isStageScoped, stageId, participantIds: stageParticipantIds } = useStageScope();

  // Sincroniza etapa detectada com o contexto global
  useEffect(() => {
    if (stageId) setSelectedStageId(stageId);
  }, [stageId, setSelectedStageId]);

  // Sincroniza sportEventId selecionado com o contexto global
  useEffect(() => {
    setSelectedSportEventId(sportEventId);
  }, [sportEventId, setSelectedSportEventId]);

  const { data: summaryRaw, isLoading: summaryLoading } = useQuery({
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

  const isCollective = summaryRaw?.is_collective ?? false;

  // Recalcula contadores escopados por etapa (quando aplicável)
  const { data: stageScoped } = useQuery({
    queryKey: ["competition-summary-stage", eventId, sportEventId, stageId, isCollective, stageParticipantIds?.size ?? 0],
    enabled: !!sportEventId && isStageScoped && !!stageParticipantIds,
    queryFn: async () => {
      const ids = Array.from(stageParticipantIds!);
      if (ids.length === 0) return { enrolled_count: 0, teams_count: 0 };

      // Inscritos individuais da prova que pertencem à etapa
      const { count: enrolledCount } = await supabase
        .from("participant_sport_events")
        .select("id", { count: "exact", head: true })
        .eq("sport_event_id", sportEventId!)
        .in("participant_id", ids);

      let teamsCount = 0;
      if (isCollective) {
        const { data: tm } = await supabase
          .from("team_members")
          .select("team_id, teams!inner(sport_event_id)")
          .in("participant_id", ids)
          .eq("teams.sport_event_id", sportEventId!);
        teamsCount = new Set((tm ?? []).map((r: any) => r.team_id)).size;
      }

      return { enrolled_count: enrolledCount ?? 0, teams_count: teamsCount };
    },
  });

  const summary = useMemo(() => {
    if (!summaryRaw) return summaryRaw;
    if (!isStageScoped || !stageScoped) return summaryRaw;
    return {
      ...summaryRaw,
      enrolled_count: stageScoped.enrolled_count,
      teams_count: stageScoped.teams_count,
    };
  }, [summaryRaw, isStageScoped, stageScoped]);

  const steps: WizardStep[] = useMemo(() => [
    { key: "participants", label: isCollective ? "Inscritos (Equipes)" : "Inscritos (Atletas)" },
    { key: "builder", label: "Montagem Manual de Disputas" },
    { key: "agenda", label: "Agenda e Local" },
    { key: "matches", label: "Check-in de Prova" },
    { key: "results", label: "Resultado e Homologação" },
  ], [isCollective]);

  const visibleSteps = steps.filter((s) => !s.hidden);
  const currentIdx = visibleSteps.findIndex((s) => s.key === currentStep);

  const completedSteps = useMemo(() => {
    const completed: string[] = [];
    if (!summary) return completed;
    if ((summary.enrolled_count > 0) || (summary.teams_count > 0)) completed.push("participants");
    if (summary.matches_count > 0) completed.push("builder");
    if (summary.matches_count > 0) completed.push("agenda");
    if (summary.matches_count > 0) completed.push("matches");
    if (summary.matches_count > 0 && summary.matches_no_result === 0) {
      completed.push("results");
    }
    return completed;
  }, [summary]);

  const handleStepClick = (key: string) => {
    setCurrentStep(key);
  };

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

  return (
    <div className="space-y-6">
      <ModuleHeader
        route="/admin/competicao/central"
        title="Central da Competição (Fluxo Manual)"
      />

      <SportEventPicker
        eventId={eventId}
        value={sportEventId}
        onChange={(id) => {
          setSportEventId(id);
          setCurrentStep("participants");
        }}
        stageId={stageId}
      />

      {sportEventId && (
        <>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Fluxo manual ativo: visualize inscritos, monte disputas por arraste, defina agenda/local,
              realize check-in de prova e homologue/publice os resultados.
            </AlertDescription>
          </Alert>

          <CompetitionSummaryCards summary={summary} loading={summaryLoading} />

          <WizardStepper
            steps={steps}
            currentStep={currentStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
          />

          <div className="min-h-[300px]">
            {currentStep === "participants" && (
              <CentralParticipantsTab
                eventId={eventId}
                sportEventId={sportEventId}
                isCollective={isCollective}
              />
            )}

            {currentStep === "builder" && (
              isCollective ? (
                <DisputeBuilderTab
                  eventId={eventId}
                  sportEventId={sportEventId}
                  onChanged={() => undefined}
                />
              ) : (
                <IndividualHeatBuilderTab
                  eventId={eventId}
                  sportEventId={sportEventId}
                  onChanged={() => undefined}
                />
              )
            )}

            {currentStep === "matches" && (
              <CentralMatchesTab
                eventId={eventId}
                sportEventId={sportEventId}
                isCollective={isCollective}
                onChanged={() => undefined}
              />
            )}

            {currentStep === "agenda" && (
              <CentralAgendaTab
                eventId={eventId}
                sportEventId={sportEventId}
                onChanged={() => undefined}
              />
            )}

            {currentStep === "results" && (
              <CentralResultsTab
                eventId={eventId}
                sportEventId={sportEventId}
                isCollective={isCollective}
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
