import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy, Swords, Info, RefreshCw, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import BracketView from "@/components/admin/competition/BracketView";
import { useKnockoutBracket } from "@/hooks/useKnockoutBracket";
import { useGenerateKnockout } from "@/hooks/useGenerateKnockout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface BracketTabProps {
  sportEventId: string;
}

export function BracketTab({ sportEventId }: BracketTabProps) {
  const sb = supabase as any;
  const qc = useQueryClient();
  const [isMounting, setIsMounting] = useState(false);
  const [withBronze, setWithBronze] = useState(true);
  const generateKnockout = useGenerateKnockout();

  // Check if all athletes are weighed
  const { data: weighingStats } = useQuery({
    queryKey: ["weighing-stats", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select("id, weighing_status" as any)
        .eq("sport_event_id", sportEventId);
      
      if (error) throw error;
      
      const list = (data || []) as any[];
      const total = list.length;
      const pending = list.filter(a => a.weighing_status === "pending").length;
      const confirmed = list.filter(a => a.weighing_status === "confirmed").length;
      
      return { total, pending, confirmed };
    },
  });

  // Fetch current phases and matches
  const { data: phases = [], isLoading: loadingPhases } = useQuery<any[]>({
    queryKey: ["bracket-phases", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select(`id, name, phase_type`)
        .eq("sport_event_id", sportEventId!)
        .order("sort_order");
      
      if (error) throw error;
      
      // Fetch matches separately to avoid deep type instantiation
      const phaseIds = data.map(p => p.id);
      if (phaseIds.length === 0) return data;

      const { data: matches, error: mError } = await (supabase
        .from("competition_matches") as any)
        .select(`
          id, phase_id, match_number, round_number, status,
          entries:competition_match_entries(
            id, side, participant:participant_sport_event_id
          )
        `)
        .in("phase_id", phaseIds);

      if (mError) throw mError;

      return data.map(p => ({
        ...p,
        matches: matches.filter((m: any) => m.phase_id === p.id)
      }));
    },
  });

  const mountBracket = async (automatic: boolean) => {
    if (!automatic) {
      toast.info("A montagem manual deve ser feita na aba 'Inscritos' ou 'Lutas'.");
      return;
    }

    setIsMounting(true);
    try {
      // 1. Get confirmed athletes
      const { data: athletes, error: athError } = await supabase
        .from("participant_sport_events")
        .select("id")
        .eq("sport_event_id", sportEventId)
        .eq("weighing_status" as any, "confirmed");

      if (athError) throw athError;
      if (athletes.length < 2) {
        toast.error("Mínimo de 2 atletas confirmados na pesagem para montar a chave.");
        return;
      }

      // 2. Get event info
      const { data: sportEvent } = await supabase
        .from('sport_events')
        .select('event_id')
        .eq('id', sportEventId)
        .single();

      // 3. Create or find the phase
      let phaseId: string;
      const { data: existingPhase } = await supabase
        .from("competition_phases")
        .select("id")
        .eq("sport_event_id", sportEventId)
        .eq("phase_type", "knockout")
        .maybeSingle();

      if (existingPhase) {
        phaseId = existingPhase.id;
      } else {
        const { data: newPhase, error: pError } = await supabase
          .from("competition_phases")
          .insert({
            sport_event_id: sportEventId,
            event_id: sportEvent?.event_id,
            name: "Chave Eliminatória",
            phase_type: "knockout",
            sort_order: 1
          })
          .select()
          .single();
        if (pError) throw pError;
        phaseId = newPhase.id;
      }

      // 4. Prepare participants for RPC
      const participants = athletes.map((a, idx) => ({
        participant_id: a.id,
        seed: idx + 1,
        label: `Atleta ${idx + 1}`,
        participant_type: "participant" as const
      }));

      // 5. Call RPC via hook
      await generateKnockout.mutateAsync({
        eventId: sportEvent?.event_id ?? "",
        sportEventId,
        phaseId,
        participants,
        seedingMode: "automatic",
        force: true,
        withBronzeMatch: withBronze
      });

      qc.invalidateQueries({ queryKey: ["bracket-phases", sportEventId] });
      qc.invalidateQueries({ queryKey: ["knockout-bracket", phaseId] });
      
    } catch (error: any) {
      toast.error("Erro ao montar chave: " + error.message);
    } finally {
      setIsMounting(false);
    }
  };

  const isWeighingIncomplete = (weighingStats?.pending || 0) > 0;
  
  if (loadingPhases) return <div className="p-8 flex justify-center"><RefreshCw className="animate-spin h-8 w-8 text-muted-foreground" /></div>;

  const firstKnockoutPhase = phases.find((p: any) => p.phase_type === "knockout");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h4 className="text-lg font-semibold">Chave de Competição</h4>
          <p className="text-sm text-muted-foreground">Visualize a progressão dos atletas no bracket.</p>
        </div>
        
        {!firstKnockoutPhase && (
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch 
                id="bronze-toggle" 
                checked={withBronze} 
                onCheckedChange={setWithBronze} 
              />
              <Label htmlFor="bronze-toggle" className="text-sm cursor-pointer">Incluir disputa de 3º lugar</Label>
            </div>

            <div className="flex gap-2">
              <Button 
                disabled={isWeighingIncomplete || isMounting} 
                onClick={() => mountBracket(true)}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", isMounting && "animate-spin")} />
                Montagem Automática
              </Button>
              <Button 
                variant="outline" 
                disabled={isWeighingIncomplete || isMounting}
                onClick={() => mountBracket(false)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Montagem Manual
              </Button>
            </div>
          </div>
        )}
      </div>

      {isWeighingIncomplete && !firstKnockoutPhase && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>Pesagem Pendente</AlertTitle>
          <AlertDescription>
            Existem {weighingStats?.pending} atletas com pesagem pendente. 
            A pesagem deve ser concluída antes de montar a chave.
          </AlertDescription>
        </Alert>
      )}

      {firstKnockoutPhase ? (
        <div className="bg-muted/5 border rounded-xl p-6 min-h-[400px]">
          <BracketContent phaseId={firstKnockoutPhase.id} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
          <Swords className="h-12 w-12 opacity-20 mb-4" />
          <p>Nenhuma chave montada para esta categoria.</p>
          {isWeighingIncomplete && (
            <p className="text-xs mt-2">Conclua a pesagem para liberar a montagem.</p>
          )}
        </div>
      )}
    </div>
  );
}

function BracketContent({ phaseId }: { phaseId: string }) {
  const { data, isLoading } = useKnockoutBracket(phaseId);
  return <BracketView data={data} isLoading={isLoading} />;
}
