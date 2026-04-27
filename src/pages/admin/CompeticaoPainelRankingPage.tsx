import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import ModuleHeader from "@/components/admin/ModuleHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Trophy, Users, ListChecks, Calendar, Scale, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InscritosTab } from "./competicao/ranking/InscritosTab";
import { ResultadoTab } from "./competicao/ranking/ResultadoTab";
import { AgendaTab } from "./competicao/ranking/AgendaTab";
import { ArbitragemTab } from "./competicao/ranking/ArbitragemTab";

export default function CompeticaoPainelRankingPage() {
  const { sportEventId, stageId } = useParams();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(sportEventId || null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");

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

  // Fetch all sport events (provas) for this sport in the same stage
  const { data: sportEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["sport_events_ranking", sportId, stageId],
    enabled: !!sportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_stage_sport_event_summary" as any)
        .select("*")
        .eq("sport_id", sportId!)
        .eq("event_stage_id", stageId!);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const filteredEvents = useMemo(() => {
    return sportEvents.filter((ev: any) => {
      const matchesSearch = ev.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || ev.category_name === categoryFilter;
      const matchesGender = genderFilter === "all" || ev.gender_scope === genderFilter;
      return matchesSearch && matchesCategory && matchesGender;
    });
  }, [sportEvents, search, categoryFilter, genderFilter]);

  const categories = useMemo(() => {
    const unique = new Set<string>();
    sportEvents.forEach((ev: any) => {
      if (ev.category_name) unique.add(ev.category_name);
    });
    return Array.from(unique).sort();
  }, [sportEvents]);

  const selectedEvent = useMemo(() => 
    sportEvents.find((ev: any) => ev.sport_event_id === selectedEventId),
    [sportEvents, selectedEventId]
  );

  const headerRoute = stageId 
    ? `/admin/etapa/${stageId}/competicao/painel`
    : "/admin/competicao/painel";

  if (loadingEvents) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader 
        route={headerRoute}
        title={`Painel Ranking — ${currentSportEvent?.sports?.name || "Modalidade"}`}
      />
      
      <div className="grid grid-cols-1 gap-6">
        {/* Upper Area: Event List/Selector */}
        <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Provas / Competições</h3>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar prova..." 
                  className="pl-9 h-8 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Naipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Feminino</SelectItem>
                  <SelectItem value="mixed">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="px-3 py-2 text-left font-medium">Nome da Prova</th>
                  <th className="px-3 py-2 text-left font-medium">Categoria</th>
                  <th className="px-3 py-2 text-left font-medium">Naipe</th>
                  <th className="px-3 py-2 text-center font-medium">Tipo</th>
                  <th className="px-3 py-2 text-center font-medium">Inscritos</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-background">
                {filteredEvents.map((ev: any) => {
                  const isActive = ev.sport_event_id === selectedEventId;
                  const hasResult = Number(ev.matches_with_result) > 0;
                  const isValidated = Number(ev.results_validated) > 0;
                  
                  return (
                    <tr 
                      key={ev.sport_event_id}
                      className={cn(
                        "hover:bg-muted/50 transition-colors",
                        isActive && "bg-primary/5"
                      )}
                    >
                      <td className="px-3 py-2 font-medium">{ev.name}</td>
                      <td className="px-3 py-2">{ev.category_name}</td>
                      <td className="px-3 py-2 uppercase">{ev.gender_scope}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant="outline" className="text-[10px] py-0 h-4 uppercase">
                          {ev.is_collective ? "Equipe" : "Individual"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">{ev.enrolled_count || 0}</td>
                      <td className="px-3 py-2">
                        <Badge 
                          variant={isValidated ? "success" : hasResult ? "warning" : "outline"} 
                          className="text-[10px] py-0 h-4"
                        >
                          {isValidated ? "Homologado" : hasResult ? "Lancado" : "Não lançado"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button 
                          onClick={() => setSelectedEventId(ev.sport_event_id)}
                          className={cn(
                            "px-2 py-1 rounded border text-[10px] font-medium transition-colors",
                            isActive 
                              ? "bg-primary text-primary-foreground border-primary" 
                              : "bg-background hover:bg-muted"
                          )}
                        >
                          {isActive ? "Selecionado" : "Operar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lower Area: Operations */}
        {selectedEventId ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-heading font-bold">{(selectedEvent as any)?.name}</h2>
              <Badge variant="secondary">
                {(selectedEvent as any)?.category_name} · {(selectedEvent as any)?.gender_scope?.toUpperCase()}
              </Badge>
            </div>

            <Tabs defaultValue="resultado" className="w-full">
              <TabsList className="grid grid-cols-4 w-full max-w-xl">
                <TabsTrigger value="inscritos" className="gap-2">
                  <Users className="h-4 w-4" /> Inscritos
                </TabsTrigger>
                <TabsTrigger value="resultado" className="gap-2">
                  <ListChecks className="h-4 w-4" /> Resultado
                </TabsTrigger>
                <TabsTrigger value="agenda" className="gap-2">
                  <Calendar className="h-4 w-4" /> Agenda
                </TabsTrigger>
                <TabsTrigger value="arbitragem" className="gap-2">
                  <Scale className="h-4 w-4" /> Arbitragem
                </TabsTrigger>
              </TabsList>
              
              <div className="mt-6">
                <TabsContent value="inscritos" className="m-0">
                  <InscritosTab sportEventId={selectedEventId} />
                </TabsContent>
                
                <TabsContent value="resultado" className="m-0">
                  <ResultadoTab sportEventId={selectedEventId} />
                </TabsContent>
                
                <TabsContent value="agenda" className="m-0">
                  <AgendaTab sportEventId={selectedEventId} />
                </TabsContent>
                
                <TabsContent value="arbitragem" className="m-0">
                  <ArbitragemTab sportEventId={selectedEventId} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
            <Trophy className="h-12 w-12 opacity-20 mb-4" />
            <p>Selecione uma prova na lista acima para operar</p>
          </div>
        )}
      </div>
    </div>
  );
}
