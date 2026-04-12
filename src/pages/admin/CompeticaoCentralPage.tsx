import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CompeticaoCentralPage() {
  const eventId = useActiveEventId();
  const [sportEventId, setSportEventId] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <ModuleHeader
        route="/admin/competicao/central"
        title="Central da Competição"
      />

      <SportEventPicker
        eventId={eventId}
        value={sportEventId}
        onChange={setSportEventId}
      />

      {sportEventId && (
        <>
          <CompetitionSummaryCards summary={summary} loading={summaryLoading} />

          <Tabs defaultValue="structure" className="space-y-4">
            <TabsList>
              <TabsTrigger value="structure">Estrutura</TabsTrigger>
              <TabsTrigger value="enrolled">
                {summary?.is_collective ? "Equipes" : "Inscritos"}
              </TabsTrigger>
              <TabsTrigger value="matches">Partidas</TabsTrigger>
              <TabsTrigger value="results">Resultados</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
              <TabsTrigger value="bracket">Chaves</TabsTrigger>
              <TabsTrigger value="pending">Pendências</TabsTrigger>
            </TabsList>

            <TabsContent value="structure">
              <CentralStructureTab
                eventId={eventId}
                sportEventId={sportEventId}
                onChanged={refetchSummary}
              />
            </TabsContent>
            <TabsContent value="enrolled">
              <CentralEnrolledTab
                eventId={eventId}
                sportEventId={sportEventId}
                isCollective={summary?.is_collective ?? false}
              />
            </TabsContent>
            <TabsContent value="matches">
              <CentralMatchesTab
                eventId={eventId}
                sportEventId={sportEventId}
                isCollective={summary?.is_collective ?? false}
                onChanged={refetchSummary}
              />
            </TabsContent>
            <TabsContent value="results">
              <CentralResultsTab
                eventId={eventId}
                sportEventId={sportEventId}
                isCollective={summary?.is_collective ?? false}
              />
            </TabsContent>
            <TabsContent value="agenda">
              <CentralAgendaTab
                eventId={eventId}
                sportEventId={sportEventId}
              />
            </TabsContent>
            <TabsContent value="pending">
              <EligibilityPendingPanel
                eventId={eventId}
                sportEventId={sportEventId}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
