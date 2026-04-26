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

interface BracketTabProps {
  sportEventId: string;
}

export function BracketTab({ sportEventId }: BracketTabProps) {
  const qc = useQueryClient();
  const [isMounting, setIsMounting] = useState(false);

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
  const { data: phases = [], isLoading: loadingPhases } = useQuery<any>({
    queryKey: ["bracket-phases", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select(`
          id,
          name,
          phase_type,
          matches:competition_matches(
            id,
            match_number,
            round_number,
            status,
            entries:competition_match_entries(
              id,
              side,
              participant:participant_sport_events(
                id,
                participant:participants(
                  persons(name)
                )
              )
            )
          )
        ` as any)
        .eq("sport_event_id", sportEventId)
        .order("sort_order");
      
      if (error) throw error;
      return data;
    },
  });

  const mountBracket = async (automatic: boolean) => {
    setIsMounting(true);
    try {
      // 1. Get confirmed athletes
      const { data: athletes, error: athError } = await (supabase
        .from("participant_sport_events") as any)
        .select("id")
        .eq("sport_event_id", sportEventId)
        .eq("weighing_status", "confirmed");

      if (athError) throw athError;
      if (athletes.length < 2) {
        toast.error("Mínimo de 2 atletas confirmados na pesagem para montar a chave.");
        return;
      }

      // 2. Call RPC to generate bracket
      // Note: We need a function to handle this logic on backend or we do it here.
      // For now, let's assume we have an RPC or we use the logic from migration e518000a
      // If we don't have an RPC, we would need to implement the logic here.
      
      // MOCK implementation for now - creating a phase and matches
      const { data: event } = await supabase.from('sport_events').select('event_id').eq('id', sportEventId).single();

      const { data: phase, error: pError } = await supabase
        .from("competition_phases")
        .insert({
          sport_event_id: sportEventId,
          event_id: event?.event_id,
          name: "Chave Eliminatória",
          phase_type: "knockout",
          sort_order: 1
        })
        .select()
        .single();

      if (pError) throw pError;

      // Logic to generate pairings (simplified for now)
      const pairs = [];
      const shuffled = [...athletes].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shuffled.length; i += 2) {
        pairs.push([shuffled[i], shuffled[i+1] || null]);
      }

      for (let i = 0; i < pairs.length; i++) {
        const [a, b] = pairs[i];
        const { data: match, error: mError } = await supabase
          .from("competition_matches")
          .insert({
            event_id: event?.event_id,
            sport_event_id: sportEventId,
            phase_id: phase.id,
            match_number: i + 1,
            round_number: 1,
            status: "scheduled"
          })
          .select()
          .single();
        
        if (mError) throw mError;

        await supabase.from("competition_match_entries").insert([
          { match_id: match.id, side: "A", participant_sport_event_id: a.id },
          { match_id: match.id, side: "B", participant_sport_event_id: b?.id || null }
        ]);
      }

      toast.success("Chave montada com sucesso!");
      qc.invalidateQueries({ queryKey: ["bracket-phases", sportEventId] });
      qc.invalidateQueries({ queryKey: ["sport_categories"] });
    } catch (error: any) {
      toast.error("Erro ao montar chave: " + error.message);
    } finally {
      setIsMounting(false);
    }
  };

  if (loadingPhases) return <div className="p-8 flex justify-center"><RefreshCw className="animate-spin h-8 w-8 text-muted-foreground" /></div>;

  const firstKnockoutPhase = phases.find((p: any) => p.phase_type === "knockout");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold">Chave de Competição</h4>
          <p className="text-sm text-muted-foreground">Visualize a progressão dos atletas no bracket.</p>
        </div>
        
        {!firstKnockoutPhase && (
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
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Montagem Manual
            </Button>
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
