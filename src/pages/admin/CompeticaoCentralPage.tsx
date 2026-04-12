import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import ModuleHeader from "@/components/admin/ModuleHeader";
import SportEventPicker from "@/components/admin/competition/SportEventPicker";
import CompetitionSummaryCards from "@/components/admin/competition/CompetitionSummaryCards";
import CentralStructureTab from "@/components/admin/competition/CentralStructureTab";
import CentralEnrolledTab from "@/components/admin/competition/CentralEnrolledTab";
import CentralMatchesTab from "@/components/admin/competition/CentralMatchesTab";
import CentralResultsTab from "@/components/admin/competition/CentralResultsTab";
import EligibilityPendingPanel from "@/components/admin/competition/EligibilityPendingPanel";
import CentralAgendaTab from "@/components/admin/competition/CentralAgendaTab";
import CentralBracketTab from "@/components/admin/competition/CentralBracketTab";
import WizardStepper, { type WizardStep } from "@/components/admin/competition/WizardStepper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";

export default function CompeticaoCentralPage() {
  const eventId = useActiveEventId();
  const [sportEventId, setSportEventId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState("participants");

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

  // Check if any phase uses knockout (to show bracket step instead of generic matches)
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
  );
  const hasGroups = phases.some(
    (p: any) => p.phase_type === "group_stage" || p.phase_type === "round_robin"
  );

  const steps: WizardStep[] = useMemo(() => [
    { key: "participants", label: summary?.is_collective ? "Equipes" : "Participantes" },
    { key: "structure", label: "Estrutura" },
    { key: "matches", label: hasKnockout ? "Chaves" : "Confrontos", hidden: false },
    { key: "agenda", label: "Agenda" },
    { key: "results", label: "Resultados" },
    { key: "pending", label: "Pendências" },
  ], [summary?.is_collective, hasKnockout]);

  const visibleSteps = steps.filter((s) => !s.hidden);
  const currentIdx = visibleSteps.findIndex((s) => s.key === currentStep);

  // Compute completed steps based on data
  const completedSteps = useMemo(() => {
    const completed: string[] = [];
    if (!summary) return completed;
    if (summary.enrolled_count > 0 || summary.teams_count > 0) completed.push("participants");
    if (phases.length > 0) completed.push("structure");
    if (summary.matches_count > 0) {
      completed.push("matches");
      completed.push("agenda");
    }
    if (summary.matches_count > 0 && summary.matches_no_result === 0) completed.push("results");
    return completed;
  }, [summary, phases.length]);

  const goNext = () => {
    if (currentIdx < visibleSteps.length - 1) setCurrentStep(visibleSteps[currentIdx + 1].key);
  };
  const goPrev = () => {
    if (currentIdx > 0) setCurrentStep(visibleSteps[currentIdx - 1].key);
  };

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

      {sportEventId && (
        <>
          <CompetitionSummaryCards summary={summary} loading={summaryLoading} />

          <WizardStepper
            steps={steps}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
            completedSteps={completedSteps}
          />

          <div className="min-h-[300px]">
            {currentStep === "participants" && (
              <CentralEnrolledTab
                eventId={eventId}
                sportEventId={sportEventId}
                isCollective={summary?.is_collective ?? false}
              />
            )}

            {currentStep === "structure" && (
              <CentralStructureTab
                eventId={eventId}
                sportEventId={sportEventId}
                onChanged={refetchSummary}
              />
            )}

            {currentStep === "matches" && (
              hasKnockout ? (
                <CentralBracketTab
                  eventId={eventId}
                  sportEventId={sportEventId}
                  isCollective={summary?.is_collective ?? false}
                />
              ) : (
                <CentralMatchesTab
                  eventId={eventId}
                  sportEventId={sportEventId}
                  isCollective={summary?.is_collective ?? false}
                  onChanged={refetchSummary}
                />
              )
            )}

            {currentStep === "agenda" && (
              <CentralAgendaTab
                eventId={eventId}
                sportEventId={sportEventId}
              />
            )}

            {currentStep === "results" && (
              <CentralResultsTab
                eventId={eventId}
                sportEventId={sportEventId}
                isCollective={summary?.is_collective ?? false}
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
