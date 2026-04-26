import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Swords, Info, RefreshCw, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

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
        .select("id, weighing_status")
        .eq("sport_event_id", sportEventId);
      
      if (error) throw error;
      
      const total = data.length;
      const pending = data.filter(a => a.weighing_status === "pending").length;
      const confirmed = data.filter(a => a.weighing_status === "confirmed").length;
      
      return { total, pending, confirmed };
    },
  });

  // Fetch current phases and matches
  const { data: phases = [], isLoading: loadingPhases } = useQuery({
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
        `)
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
      const { data: athletes, error: athError } = await supabase
        .from("participant_sport_events")
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

  if (loadingPhases) return <div>Carregando chave...</div>;

  const hasBracket = phases.length > 0;
  const isWeighingIncomplete = (weighingStats?.pending || 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold">Chave de Competição</h4>
          <p className="text-sm text-muted-foreground">Visualize e organize o chaveamento da categoria.</p>
        </div>
        
        {!hasBracket && (
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

      {isWeighingIncomplete && !hasBracket && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>Pesagem Pendente</AlertTitle>
          <AlertDescription>
            Existem {weighingStats?.pending} atletas com pesagem pendente. 
            A pesagem deve ser concluída antes de montar a chave.
          </AlertDescription>
        </Alert>
      )}

      {hasBracket ? (
        <div className="bg-muted/10 border rounded-xl p-8 min-h-[400px] flex flex-col items-center">
          <div className="grid grid-flow-col gap-12 overflow-x-auto w-full pb-8">
            {/* Simple visual representation for now */}
            {phases.map((phase: any) => (
              <div key={phase.id} className="space-y-4 min-w-[200px]">
                <h5 className="font-bold text-center border-b pb-2 uppercase text-xs tracking-wider">
                  {phase.name}
                </h5>
                <div className="space-y-6 flex flex-col justify-around h-full py-4">
                  {phase.matches?.map((match: any) => (
                    <div 
                      key={match.id} 
                      className="relative border rounded bg-background p-2 shadow-sm cursor-pointer hover:border-primary transition-colors"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs truncate font-medium">
                            {match.entries?.find((e: any) => e.side === "A")?.participant?.participant?.persons?.name || "BYE"}
                          </span>
                        </div>
                        <div className="border-t my-1" />
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs truncate font-medium">
                            {match.entries?.find((e: any) => e.side === "B")?.participant?.participant?.persons?.name || "BYE"}
                          </span>
                        </div>
                      </div>
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 bg-muted text-[10px] h-4 w-4 flex items-center justify-center rounded-full border">
                        {match.match_number}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
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

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
