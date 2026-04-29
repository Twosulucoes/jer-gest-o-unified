import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle, AlertTriangle, PlayCircle } from "lucide-react";
import { inferFamilyFromSport } from "@/utils/familyInference";
import { FAMILIES } from "@/types/sportEventRules";

export default function SuperFamiliasInferidasPage() {
  const queryClient = useQueryClient();
  const [isInferring, setIsInferring] = useState(false);

  // 1. Buscar regras sem família ou pendentes de inferência
  const { data: rules, isLoading } = useQuery({
    queryKey: ["sport-rules-to-infer"],
    queryFn: async () => {
      // Buscar regras onde a família está ausente
      const { data: rulesData, error } = await supabase
        .from("sport_event_rules")
        .select(`
          id,
          rules,
          sport_events (
            name,
            sports (name)
          )
        `);
      
      if (error) throw error;

      // Buscar inferências já existentes
      const { data: inferences, error: infError } = await supabase
        .from("sport_family_inferences")
        .select("*");
      
      if (infError) throw infError;

      return rulesData
        .filter(r => !r.rules?.family)
        .map(r => {
          const sportName = r.sport_events?.sports?.name || "Desconhecido";
          const eventName = r.sport_events?.name || "Desconhecido";
          const inference = inferences.find(i => i.sport_event_rule_id === r.id);
          
          return {
            ...r,
            sportName,
            eventName,
            existingInference: inference,
            suggested: inferFamilyFromSport(sportName, eventName)
          };
        });
    }
  });

  // 2. Mutação para salvar inferências
  const saveInferences = useMutation({
    mutationFn: async (data: any[]) => {
      const { error } = await supabase
        .from("sport_family_inferences")
        .upsert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inferências sugeridas salvas com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["sport-rules-to-infer"] });
    }
  });

  // 3. Mutação para aplicar inferências selecionadas
  const applyInferences = useMutation({
    mutationFn: async (selectedIds: string[]) => {
      const { data: user } = await supabase.auth.getUser();
      
      for (const id of selectedIds) {
        const item = rules?.find(r => r.id === id);
        if (!item) continue;

        const newRules = { ...item.rules, family: item.suggested.family };
        
        // Atualizar regra
        const { error: updateError } = await supabase
          .from("sport_event_rules")
          .update({ rules: newRules })
          .eq("id", id);
        
        if (updateError) throw updateError;

        // Marcar inferência como aplicada
        const { error: infError } = await supabase
          .from("sport_family_inferences")
          .update({ 
            status: "applied", 
            applied_at: new Date().toISOString(),
            applied_by: user.user?.id
          })
          .eq("sport_event_rule_id", id);
        
        if (infError) throw infError;
      }
    },
    onSuccess: () => {
      toast.success("Inferências aplicadas com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["sport-rules-to-infer"] });
    }
  });

  const handleRunInference = () => {
    if (!rules) return;
    const toSave = rules.map(r => ({
      sport_event_rule_id: r.id,
      inferred_family: r.suggested.family,
      reason: r.suggested.reason,
      status: "pending"
    }));
    saveInferences.mutate(toSave);
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Inferência de Famílias</h1>
          <p className="text-muted-foreground text-sm">Auditoria e atribuição automática de famílias para provas existentes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRunInference} disabled={saveInferences.isPending}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Gerar Sugestões
          </Button>
          <Button 
            disabled={!rules?.length || applyInferences.isPending}
            onClick={() => applyInferences.mutate(rules?.map(r => r.id) || [])}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Aplicar Todas
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modalidade</TableHead>
              <TableHead>Prova</TableHead>
              <TableHead>Família Sugerida</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Nenhuma prova pendente de família encontrada.
                </TableCell>
              </TableRow>
            ) : (
              rules?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.sportName}</TableCell>
                  <TableCell>{r.eventName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {FAMILIES.find(f => f.value === r.suggested.family)?.label || r.suggested.family}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.suggested.reason}</TableCell>
                  <TableCell>
                    {r.existingInference?.status === 'applied' ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Aplicado</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => applyInferences.mutate([r.id])}
                      disabled={applyInferences.isPending || r.existingInference?.status === 'applied'}
                    >
                      Aplicar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
