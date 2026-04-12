import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck, Info } from "lucide-react";
import SeedingPanel from "./SeedingPanel";
import BracketView from "./BracketView";
import { useKnockoutParticipants } from "@/hooks/useKnockoutParticipants";
import { useKnockoutBracket } from "@/hooks/useKnockoutBracket";
import { useGenerateKnockout } from "@/hooks/useGenerateKnockout";

interface Props {
  eventId: string;
  sportEventId: string;
  isCollective: boolean;
}

export default function CentralBracketTab({ eventId, sportEventId, isCollective }: Props) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");

  // Fetch phases for this sport_event
  const { data: phases = [] } = useQuery({
    queryKey: ["bracket-phases", eventId, sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select("id, name, phase_type, bracket_config")
        .eq("event_id", eventId)
        .eq("sport_event_id", sportEventId)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
  });

  const activePhase = phases.find((p: any) => p.id === selectedPhaseId);
  const bracketConfig = activePhase?.bracket_config as any;
  const hasBracket = bracketConfig?.format === "knockout_single_elimination";

  const { data: participants = [], isLoading: loadingParticipants } = useKnockoutParticipants(
    eventId,
    sportEventId,
    isCollective
  );

  const { data: bracketData, isLoading: loadingBracket } = useKnockoutBracket(
    hasBracket ? selectedPhaseId : null
  );

  const generateMut = useGenerateKnockout();

  function handleGenerate(seeds: any[], force: boolean) {
    if (!selectedPhaseId) return;
    generateMut.mutate({
      eventId,
      sportEventId,
      phaseId: selectedPhaseId,
      participants: seeds.map((s) => ({
        participant_id: s.participant_id,
        seed: s.seed,
        label: s.label,
        participant_type: s.participant_type,
      })),
      force,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h3 className="text-lg font-semibold">Chaves (Mata-mata)</h3>
        <Select value={selectedPhaseId} onValueChange={setSelectedPhaseId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Selecione uma fase" />
          </SelectTrigger>
          <SelectContent>
            {phases.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {phases.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Crie uma fase na aba "Estrutura" antes de configurar chaves de mata-mata.
          </AlertDescription>
        </Alert>
      )}

      {selectedPhaseId && (
        <>
          {/* Audit info */}
          {hasBracket && bracketConfig && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <CalendarCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Gerado em:</span>
                    <span className="font-medium">
                      {bracketConfig.generated_at
                        ? new Date(bracketConfig.generated_at).toLocaleString("pt-BR")
                        : "—"}
                    </span>
                  </div>
                  <Badge variant="outline">Participantes: {bracketConfig.total_participants}</Badge>
                  <Badge variant="outline">Chave: {bracketConfig.bracket_size}</Badge>
                  <Badge variant="outline">Rodadas: {bracketConfig.rounds}</Badge>
                  {bracketConfig.byes > 0 && (
                    <Badge variant="secondary">Byes: {bracketConfig.byes}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue={hasBracket ? "bracket" : "seeding"}>
            <TabsList>
              <TabsTrigger value="seeding">Seeding</TabsTrigger>
              <TabsTrigger value="bracket" disabled={!hasBracket}>
                Visualizar Chave
              </TabsTrigger>
            </TabsList>

            <TabsContent value="seeding" className="mt-4">
              <SeedingPanel
                participants={participants}
                hasExistingBracket={hasBracket}
                onGenerate={handleGenerate}
                isPending={generateMut.isPending}
              />
            </TabsContent>

            <TabsContent value="bracket" className="mt-4">
              <BracketView data={bracketData} isLoading={loadingBracket} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
