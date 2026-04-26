import { useParams } from "react-router-dom";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function CompeticaoPainelCombatPage() {
  const { sportEventId, stageId } = useParams();

  const { data: sportEvent } = useQuery({
    queryKey: ["sport_event", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select(`
          id,
          name,
          sport_id,
          sports (name)
        `)
        .eq("id", sportEventId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!sportEventId,
  });

  const headerRoute = stageId 
    ? `/admin/etapa/${stageId}/competicao/painel`
    : "/admin/competicao/painel";

  return (
    <div className="space-y-6">
      <ModuleHeader 
        route={headerRoute}
        title={`Painel Combat — ${sportEvent?.name || "Carregando..."}`}
      />
      
      <div className="grid grid-cols-1 gap-6">
        {/* Upper Area: Category Selector */}
        <div className="bg-muted/30 p-4 rounded-lg border">
          <h3 className="text-sm font-semibold mb-3">Categorias de Peso</h3>
          <div className="flex flex-wrap gap-2">
            {/* TODO: List categories */}
            <div className="p-2 border rounded bg-background">Categoria 1</div>
          </div>
        </div>

        {/* Lower Area: Operations */}
        <Tabs defaultValue="athletes" className="w-full">
          <TabsList>
            <TabsTrigger value="athletes">Atletas e Pesagem</TabsTrigger>
            <TabsTrigger value="bracket">Chave</TabsTrigger>
            <TabsTrigger value="matches">Lutas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="athletes" className="p-4 border rounded-lg bg-background mt-4">
            Atletas e Pesagem Content
          </TabsContent>
          
          <TabsContent value="bracket" className="p-4 border rounded-lg bg-background mt-4">
            Visualização da Chave
          </TabsContent>
          
          <TabsContent value="matches" className="p-4 border rounded-lg bg-background mt-4">
            Grade de Lutas
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
