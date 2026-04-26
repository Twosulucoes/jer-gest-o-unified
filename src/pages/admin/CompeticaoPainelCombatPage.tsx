import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dumbbell, Users, Trophy, ListChecks } from "lucide-react";
import { AthletesWeighingTab } from "./competicao/combat/AthletesWeighingTab";
import { BracketTab } from "./competicao/combat/BracketTab";
import { MatchesTab } from "./competicao/combat/MatchesTab";

export default function CompeticaoPainelCombatPage() {
  const { sportEventId, stageId } = useParams();
  const navigate = useNavigate();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(sportEventId || null);

  // Fetch sport details based on one sport event
  const { data: currentSportEvent } = useQuery({
    queryKey: ["sport_event_basic", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select(`
          id,
          name,
          sport_id,
          sports (id, name)
        `)
        .eq("id", sportEventId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sportEventId,
  });

  const sportId = currentSportEvent?.sport_id;

  // Fetch all categories for this sport in the same stage
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["sport_categories", sportId, stageId],
    enabled: !!sportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_stage_sport_event_summary" as any)
        .select("*")
        .eq("sport_id", sportId!)
        .eq("event_stage_id", stageId!);
      if (error) throw error;
      return data;
    },
  });

  const selectedCategory = useMemo(() => 
    categories.find((c: any) => c.sport_event_id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const headerRoute = stageId 
    ? `/admin/etapa/${stageId}/competicao/painel`
    : "/admin/competicao/painel";

  if (loadingCategories) {
    return <div className="p-8 space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <ModuleHeader 
        route={headerRoute}
        title={`Painel Combat — ${currentSportEvent?.sports?.name || "Modalidade"}`}
      />
      
      <div className="grid grid-cols-1 gap-6">
        {/* Upper Area: Category Selector */}
        <div className="bg-muted/30 p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-4">
            <Dumbbell className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Categorias de Peso</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat: any) => {
              const isActive = cat.sport_event_id === selectedCategoryId;
              const hasAthletes = Number(cat.enrolled_count || 0) > 0;
              const hasBracket = Number(cat.phase_count || 0) > 0;
              
              return (
                <button
                  key={cat.sport_event_id}
                  onClick={() => setSelectedCategoryId(cat.sport_event_id)}
                  className={cn(
                    "px-4 py-2 border rounded-lg text-sm transition-all flex flex-col items-start gap-1 min-w-[150px]",
                    isActive 
                      ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                      : "bg-background hover:bg-muted/50 border-input",
                    !hasAthletes && "opacity-60"
                  )}
                >
                  <span className="font-semibold line-clamp-1">{cat.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-[10px]">
                      <Users className="h-3 w-3" />
                      {cat.enrolled_count || 0}
                    </div>
                    {hasBracket && (
                      <Badge variant="secondary" className="text-[8px] h-3.5 px-1 py-0">
                        Chave OK
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lower Area: Operations */}
        {selectedCategoryId ? (
          <Tabs defaultValue="athletes" className="w-full">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="athletes" className="gap-2">
                <Users className="h-4 w-4" /> Pesagem
              </TabsTrigger>
              <TabsTrigger value="bracket" className="gap-2">
                <Trophy className="h-4 w-4" /> Chave
              </TabsTrigger>
              <TabsTrigger value="matches" className="gap-2">
                <ListChecks className="h-4 w-4" /> Lutas
              </TabsTrigger>
            </TabsList>
            
            <div className="mt-4">
              <TabsContent value="athletes" className="m-0">
                <AthletesWeighingTab sportEventId={selectedCategoryId} />
              </TabsContent>
              
              <TabsContent value="bracket" className="m-0">
                <BracketTab sportEventId={selectedCategoryId} />
              </TabsContent>
              
              <TabsContent value="matches" className="m-0">
                <MatchesTab sportEventId={selectedCategoryId} />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
            <Dumbbell className="h-12 w-12 opacity-20 mb-4" />
            <p>Selecione uma categoria de peso acima para iniciar</p>
          </div>
        )}
      </div>
    </div>
  );
}

