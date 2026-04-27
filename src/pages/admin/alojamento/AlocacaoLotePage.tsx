import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { toast } from "sonner";
import {
  Building, Check, ChevronRight, ArrowLeft, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AlocacaoLotePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const { stageId, isStageScoped } = useStageScope();
  const [step, setStep] = useState(1);
  const [selectedDelegationId, setSelectedDelegationId] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [autoDistribute, setAutoDistribute] = useState(true);
  const [allocationReport, setAllocationReport] = useState<any>(null);

  // Step 1: List delegations
  const { data: delegations = [], isLoading: loadingDelegations } = useQuery({
    queryKey: ["delegations", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const { data, error } = await supabase
        .from("delegations")
        .select("id, school_name, institutions(name)")
        .eq("event_id", selectedEventId)
        .order("school_name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  // Step 2: List participants of selected delegation
  const { data: participants = [], isLoading: loadingParticipants } = useQuery({
    queryKey: ["delegation-participants", selectedDelegationId],
    queryFn: async () => {
      if (!selectedDelegationId) return [];
      const { data, error } = await supabase
        .from("participants")
        .select(`
          id, 
          participant_type,
          person_id,
          people(full_name, gender),
          lodging_occupancies(id, unit_id, lodging_units(name, lodging_locations(name)))
        `)
        .eq("delegation_id", selectedDelegationId)
        .in("lodging_occupancies.status", ["allocated", "checked_in"]);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDelegationId && step >= 2,
  });

  // Step 3: List available lodging units
  const { data: locations = [] } = useQuery({
    queryKey: ["lodging_locations", stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await supabase
        .from("lodging_locations")
        .select("*")
        .eq("event_stage_id", stageId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: step >= 3,
  });

  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ["lodging_units", stageId],
    queryFn: async () => {
      if (!stageId) return [];
      const { data, error } = await supabase
        .from("lodging_units")
        .select("*, lodging_occupancies(id)")
        .eq("event_stage_id", stageId)
        .eq("is_active", true);
      if (error) throw error;
      
      // Filter by active occupancies
      return data.map((u: any) => ({
        ...u,
        occupied_count: u.lodging_occupancies?.length || 0
      }));
    },
    enabled: step >= 3,
  });

  const allocateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDelegationId || !selectedUnitIds.length) return;
      
      const unallocatedParticipants = participants.filter(p => !p.lodging_occupancies || p.lodging_occupancies.length === 0);
      const unitsToUse = units.filter(u => selectedUnitIds.includes(u.id));
      
      const results: { success: any[], failed: any[] } = { success: [], failed: [] };
      const rpcAllocations: { participant_id: string; unit_id: string }[] = [];
      
      if (autoDistribute) {
        // Distribution logic by gender and capacity
        const unitsByGender = {
          male: unitsToUse.filter(u => u.gender_restriction === 'male' || u.gender_restriction === 'mixed'),
          female: unitsToUse.filter(u => u.gender_restriction === 'female' || u.gender_restriction === 'mixed'),
          mixed: unitsToUse.filter(u => u.gender_restriction === 'mixed')
        };
        
        // Cópia das ocupações atuais para controle local da distribuição
        const currentUnits = unitsToUse.map(u => ({ ...u }));

        for (const p of unallocatedParticipants) {
          const gender = p.people?.gender || 'male'; // Fallback
          const availableUnits = currentUnits
            .filter(u => {
              const matchesGender = (gender === 'male' && (u.gender_restriction === 'male' || u.gender_restriction === 'mixed')) ||
                                   (gender === 'female' && (u.gender_restriction === 'female' || u.gender_restriction === 'mixed')) ||
                                   (u.gender_restriction === 'mixed');
              return matchesGender && (u.capacity - u.occupied_count) > 0;
            });
          
          if (availableUnits.length > 0) {
            const unit = availableUnits[0];
            rpcAllocations.push({
              participant_id: p.id,
              unit_id: unit.id
            });
            unit.occupied_count++;
            results.success.push({ participant: p.people?.full_name, unit: unit.name });
          } else {
            results.failed.push({ participant: p.people?.full_name, reason: "Sem capacidade ou gênero incompatível" });
          }
        }
      }

      if (rpcAllocations.length > 0) {
        const { data, error } = await supabase.rpc("rpc_allocate_lodging_batch", {
          p_event_id: selectedEventId,
          p_delegation_id: selectedDelegationId,
          p_allocations: rpcAllocations
        });

        if (error) throw error;
        
        const response = data as any;
        if (response.status === 'failed') {
          throw new Error(response.error_message || "Falha na alocação em lote");
        }
      }
      
      return results;
    },
    onSuccess: (data) => {
      setAllocationReport(data);
      setStep(4);
      qc.invalidateQueries({ queryKey: ["lodging_occupancy_counts"] });
      qc.invalidateQueries({ queryKey: ["lodging_occupancies"] });
      toast.success("Processamento de alocação concluído");
    },
    onError: (e: any) => {
      toast.error("Erro na alocação: " + e.message);
    }
  });

  const participantsByGender = {
    male: participants.filter(p => p.people?.gender === "male"),
    female: participants.filter(p => p.people?.gender === "female"),
    other: participants.filter(p => p.people?.gender !== "male" && p.people?.gender !== "female")
  };

  if (!isStageScoped) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
        <Building className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Selecione uma etapa para realizar a alocação em lote.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Alocação em Lote</h1>
            <p className="text-muted-foreground">Gerencie o alojamento de uma delegação inteira de uma vez</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map(s => (
            <div 
              key={s} 
              className={`h-2 w-12 rounded-full ${step >= s ? "bg-primary" : "bg-muted"}`} 
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Passo 1: Selecionar Delegação</CardTitle>
            <CardDescription>Escolha qual delegação deseja alocar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingDelegations ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="grid gap-4">
                <Select value={selectedDelegationId} onValueChange={setSelectedDelegationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a delegação..." />
                  </SelectTrigger>
                  <SelectContent>
                    {delegations.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.school_name} {d.institutions?.name ? `(${d.institutions.name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  disabled={!selectedDelegationId} 
                  onClick={() => setStep(2)}
                  className="w-full"
                >
                  Próximo Passo <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Passo 2: Revisar Participantes</CardTitle>
              <CardDescription>Verifique quem precisa de alocação</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingParticipants ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Gênero</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participants.map(p => {
                        const isAllocated = p.lodging_occupancies && p.lodging_occupancies.length > 0;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.people?.full_name}</TableCell>
                            <TableCell>{p.people?.gender === 'male' ? 'Masc' : 'Fem'}</TableCell>
                            <TableCell>
                              {isAllocated ? (
                                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                  <Check className="h-3 w-3" /> {p.lodging_occupancies[0].lodging_units?.name}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo da Delegação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total de participantes</span>
                  <span className="font-bold">{participants.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Masculino</span>
                  <span className="font-bold">{participantsByGender.male.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Feminino</span>
                  <span className="font-bold">{participantsByGender.female.length}</span>
                </div>
                <hr />
                <div className="flex justify-between text-sm">
                  <span>Já alocados</span>
                  <span className="font-bold text-green-600">{participants.filter(p => p.lodging_occupancies?.length > 0).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Pendentes</span>
                  <span className="font-bold text-amber-600">{participants.filter(p => !p.lodging_occupancies || p.lodging_occupancies.length === 0).length}</span>
                </div>
              </CardContent>
            </Card>
            <Button className="w-full" onClick={() => setStep(3)}>
              Configurar Destino <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep(1)}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Passo 3: Selecionar Destino</CardTitle>
              <CardDescription>Selecione os quartos onde deseja alocar o lote</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingUnits ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-6">
                    {locations.map(loc => {
                      const locUnits = units.filter(u => u.location_id === loc.id);
                      if (locUnits.length === 0) return null;
                      
                      return (
                        <div key={loc.id} className="space-y-2">
                          <h3 className="font-bold flex items-center gap-2">
                            <Building className="h-4 w-4" /> {loc.name}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {locUnits.map(u => {
                              const isSelected = selectedUnitIds.includes(u.id);
                              const available = u.capacity - u.occupied_count;
                              const isFull = available <= 0;
                              
                              return (
                                <div 
                                  key={u.id}
                                  onClick={() => !isFull && setSelectedUnitIds(prev => 
                                    prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                  )}
                                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                    isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : 
                                    isFull ? "opacity-50 grayscale bg-muted cursor-not-allowed" : "hover:border-primary/50"
                                  }`}
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium">{u.name}</span>
                                    <Badge variant="outline" className="text-[10px]">
                                      {u.gender_restriction === 'male' ? 'Masc' : u.gender_restriction === 'female' ? 'Fem' : 'Misto'}
                                    </Badge>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                      <span>Vagas: {available}/{u.capacity}</span>
                                      <span>{Math.round((u.occupied_count/u.capacity)*100)}%</span>
                                    </div>
                                    <Progress value={(u.occupied_count/u.capacity)*100} className="h-1" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Configuração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="autoDist" 
                      checked={autoDistribute} 
                      onChange={(e) => setAutoDistribute(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="autoDist" className="text-sm font-medium">Distribuição automática</label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O sistema tentará distribuir os participantes respeitando gênero e capacidade.
                  </p>
                </div>
                <hr />
                <div className="flex justify-between text-sm">
                  <span>Quartos selecionados</span>
                  <span className="font-bold">{selectedUnitIds.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Capacidade total selecionada</span>
                  <span className="font-bold">
                    {units.filter(u => selectedUnitIds.includes(u.id)).reduce((acc, u) => acc + (u.capacity - u.occupied_count), 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Pendentes na delegação</span>
                  <span className="font-bold">{participants.filter(p => !p.lodging_occupancies || p.lodging_occupancies.length === 0).length}</span>
                </div>
              </CardContent>
            </Card>
            <Button 
              className="w-full" 
              onClick={() => allocateMutation.mutate()}
              disabled={selectedUnitIds.length === 0 || allocateMutation.isPending}
            >
              {allocateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                </>
              ) : (
                <>Executar Alocação <Check className="ml-2 h-4 w-4" /></>
              )}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep(2)}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {step === 4 && allocationReport && (
        <Card className="border-green-200 bg-green-50/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Check className="h-6 w-6" /> Alocação Concluída
            </CardTitle>
            <CardDescription>Relatório de processamento do lote</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white border rounded-lg">
                <h4 className="font-bold text-green-600 mb-2">Sucesso ({allocationReport.success.length})</h4>
                <ScrollArea className="h-[200px]">
                  <ul className="text-sm space-y-1">
                    {allocationReport.success.map((s: any, i: number) => (
                      <li key={i} className="flex justify-between">
                        <span>{s.participant}</span>
                        <span className="text-muted-foreground">→ {s.unit}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
              <div className="p-4 bg-white border rounded-lg">
                <h4 className="font-bold text-amber-600 mb-2">Bloqueados/Falha ({allocationReport.failed.length})</h4>
                <ScrollArea className="h-[200px]">
                  <ul className="text-sm space-y-1">
                    {allocationReport.failed.map((s: any, i: number) => (
                      <li key={i} className="flex flex-col">
                        <span className="font-medium">{s.participant}</span>
                        <span className="text-xs text-muted-foreground">{s.reason}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => navigate("../alojamento")}>
                Concluir e Sair
              </Button>
              <Button onClick={() => {
                setStep(1);
                setSelectedDelegationId("");
                setSelectedUnitIds([]);
                setAllocationReport(null);
              }}>
                Nova Alocação em Lote
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
