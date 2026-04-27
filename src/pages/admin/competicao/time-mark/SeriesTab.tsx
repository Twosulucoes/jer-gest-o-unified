import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Settings2, 
  Trash2, 
  Calendar, 
  Layers, 
  CheckCircle2,
  PlayCircle,
  Flag,
  Trophy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SeriesTabProps {
  sportEventId: string;
}

export function SeriesTab({ sportEventId }: SeriesTabProps) {
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [lanesPerHeat, setLanesPerHeat] = useState("8");
  const [distributionType, setDistributionType] = useState("random");
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [selectedPhaseForClassification, setSelectedPhaseForClassification] = useState<any>(null);

  const classifiedAtletas = useMemo(() => {
    if (!selectedPhaseForClassification) return [];
    
    const allEntries = selectedPhaseForClassification.competition_groups?.flatMap((g: any) => 
      g.competition_matches?.flatMap((m: any) => 
        m.competition_match_entries?.map((e: any) => ({
          ...e,
          group_name: g.name,
          match_id: m.id
        })) || []
      ) || []
    ) || [];

    const isTime = rules?.family === 'time';
    return [...allEntries].sort((a, b) => {
      const resA = a.results?.[0];
      const resB = b.results?.[0];
      
      if (!resA || resA.outcome !== 'win' && resA.outcome !== 'loss') return 1;
      if (!resB || resB.outcome !== 'win' && resB.outcome !== 'loss') return -1;

      if (isTime) {
        if (!resA.time_ms) return 1;
        if (!resB.time_ms) return -1;
        return Number(resA.time_ms) - Number(resB.time_ms);
      } else {
        if (!resA.distance_cm) return 1;
        if (!resB.distance_cm) return -1;
        return Number(resB.distance_cm) - Number(resA.distance_cm);
      }
    });
  }, [selectedPhaseForClassification, rules]);

  const [selectedAtletaIds, setSelectedAtletaIds] = useState<Set<string>>(new Set());

  // Auto-select top X (e.g., 8)
  useEffect(() => {
    if (classifiedAtletas.length > 0) {
      const top8 = classifiedAtletas.slice(0, 8).map(a => a.id);
      setSelectedAtletaIds(new Set(top8));
    }
  }, [classifiedAtletas]);

  // Fetch event rules to determine format
  const { data: rules, isLoading: loadingRules } = useQuery({
    queryKey: ["sport_event_rules", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_event_rules")
        .select("rules")
        .eq("sport_event_id", sportEventId)
        .maybeSingle();
      if (error) throw error;
      return (data?.rules as any) || {};
    },
    enabled: !!sportEventId,
  });

  // Fetch existing phases and groups (heats)
  const { data: phases = [], isLoading: loadingPhases } = useQuery({
    queryKey: ["competition_phases", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_phases")
        .select(`
          id,
          name,
          phase_type,
          sort_order,
          competition_groups (
            id,
            name,
            sort_order,
            competition_matches (
              id,
              status,
              match_date,
              start_time,
              competition_match_entries (
                id,
                side,
                participant_sport_event_id,
                participant_sport_events (
                  participants (
                    id,
                    people (full_name)
                  )
                ),
                results:competition_match_results(result_status, outcome, score, time_ms, distance_cm)
              )
            )
          )
        `)
        .eq("sport_event_id", sportEventId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!sportEventId,
  });

  const isSingleRace = rules?.competition_format === "ranking" || rules?.competition_format === "single_race";

  if (loadingRules || loadingPhases) {
    return <div className="space-y-4"><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;
  }

  // MODE: Single Race (Cycling, Open Water, etc.)
  if (isSingleRace) {
    return (
      <div className="space-y-6">
        <Alert className="bg-primary/5 border-primary/20">
          <Layers className="h-4 w-4 text-primary" />
          <AlertTitle>Formato: Prova Única (Ranking)</AlertTitle>
          <AlertDescription>
            Esta prova não utiliza séries classificatórias. Todos os atletas competem em uma única bateria/largada.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lista de Largada</CardTitle>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="gap-2"
                onClick={() => {
                   const matchId = phases[0]?.competition_groups?.[0]?.competition_matches?.[0]?.id;
                   if (matchId) window.location.href = `${window.location.pathname}/serie/${matchId}/resultado`;
                }}
              >
                <Trophy className="h-4 w-4" /> Lançar Marcas
              </Button>
              <Button size="sm" variant="outline" className="gap-2">
                <Flag className="h-4 w-4" /> Confirmar Largada
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
              <p>Aguardando confirmação dos atletas presentes para gerar ordem de largada.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MODE: Heats (Athletics, Swimming)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-heading font-semibold">Estrutura de Fases e Séries</h3>
        </div>

        <div className="flex gap-2">
          <Dialog open={showAutoModal} onOpenChange={setShowAutoModal}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" /> Montar Séries Automaticamente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar Montagem Automática</DialogTitle>
                <DialogDescription>
                  O sistema irá distribuir os atletas inscritos e presentes em séries classificatórias.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="lanes" className="text-right">Raias</Label>
                  <Input 
                    id="lanes" 
                    value={lanesPerHeat} 
                    onChange={e => setLanesPerHeat(e.target.value)}
                    className="col-span-3" 
                    type="number"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dist" className="text-right">Distribuição</Label>
                  <Select value={distributionType} onValueChange={setDistributionType}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecione o critério" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Sorteio Aleatório</SelectItem>
                      <SelectItem value="seeded">Por Marca (Semeado)</SelectItem>
                      <SelectItem value="snake">Serpente (Alternado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAutoModal(false)}>Cancelar</Button>
                <Button onClick={() => setShowAutoModal(false)}>Gerar Estrutura</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button size="sm" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar Série Manual
          </Button>
        </div>
      </div>

      {phases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
          <Layers className="h-12 w-12 opacity-20 mb-4" />
          <p>Nenhuma série montada para esta prova</p>
          <p className="text-xs">Utilize o botão acima para montar a estrutura classificatória</p>
        </div>
      ) : (
        <div className="space-y-8">
          {phases.map((phase: any) => {
            const nextP = phases.find(p => p.sort_order > phase.sort_order);
            const allHomologated = phase.competition_groups?.every((g: any) => 
              g.competition_matches?.every((m: any) => 
                m.status === 'finished' && 
                m.competition_match_entries?.every((e: any) => 
                  !e.results?.[0] || e.results[0].result_status === 'resultado_validado' || e.results[0].result_status === 'publicado'
                )
              )
            );

            return (
              <div key={phase.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h4 className="font-heading font-bold text-lg">{phase.name}</h4>
                    <Badge variant="secondary">{phase.competition_groups?.length || 0} Séries</Badge>
                  </div>
                  
                  {allHomologated && nextP && (
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="gap-2"
                      onClick={() => {
                        setSelectedPhaseForClassification(phase);
                        setShowClassificationModal(true);
                      }}
                    >
                      <Trophy className="h-4 w-4" /> Classificar para {nextP.name}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {phase.competition_groups?.map((group: any) => (
                    <Card key={group.id} className="overflow-hidden">
                      <CardHeader className="p-3 bg-muted/50 border-b flex flex-row items-center justify-between">
                        <CardTitle className="text-sm">{group.name}</CardTitle>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Calendar className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y text-xs">
                          {group.competition_matches?.[0]?.competition_match_entries?.map((entry: any) => (
                            <div key={entry.id} className="px-3 py-2 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] bg-muted px-1 rounded w-6 text-center">{entry.side || "-"}</span>
                                <span className="font-medium">{entry.participant_sport_events?.participants?.people?.full_name || "Vazio"}</span>
                              </div>
                            </div>
                          ))}
                          {(!group.competition_matches?.[0]?.competition_match_entries || group.competition_matches?.[0]?.competition_match_entries.length === 0) && (
                            <div className="px-3 py-8 text-center text-muted-foreground italic">
                              Série vazia
                            </div>
                          )}
                        </div>
                      </CardContent>
                      <div className="p-2 bg-muted/20 border-t flex justify-between items-center px-3">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                           <PlayCircle className="h-3 w-3" /> {group.competition_matches?.[0]?.status === 'finished' ? 'Finalizada' : 'Não iniciada'}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="h-auto p-0 text-[10px] text-primary font-bold gap-1"
                            onClick={() => {
                              const matchId = group.competition_matches?.[0]?.id;
                              if (matchId) window.location.href = `${window.location.pathname}/serie/${matchId}/resultado`;
                            }}
                          >
                            <Trophy className="h-3 w-3" /> Lançar Marcas
                          </Button>
                          <Button variant="link" size="sm" className="h-auto p-0 text-[10px]">Editar atletas</Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="pt-4 border-t border-dashed">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm">A progressão entre fases (ex: Séries → Final) será habilitada após o registro das marcas.</p>
            </div>
          </div>
        </div>
      )}
      {/* Classification Modal */}
      <Dialog open={showClassificationModal} onOpenChange={setShowClassificationModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Classificação para Próxima Fase</DialogTitle>
            <DialogDescription>
              Selecione os atletas que avançam para a fase seguinte. O sistema sugere os melhores tempos/marcas.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
             {/* Simple table listing results from current phase */}
             <div className="border rounded-lg overflow-hidden">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Atleta</TableHead>
                     <TableHead>Marca</TableHead>
                     <TableHead className="text-center">Avança?</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {/* This is a placeholder for the real consolidated ranking logic */}
                   <TableRow>
                     <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic">
                        Funcionalidade de consolidação de ranking em desenvolvimento. 
                        A propagação criará as alocações na próxima fase.
                     </TableCell>
                   </TableRow>
                 </TableBody>
               </Table>
             </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClassificationModal(false)}>Cancelar</Button>
            <Button 
              className="gap-2"
              onClick={() => {
                // Placeholder for propagation logic
                setShowClassificationModal(false);
              }}
            >
              Confirmar e Propagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
