import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle, PlayCircle } from "lucide-react";
import { inferFamilyFromSport } from "@/utils/familyInference";
import { FAMILIES } from "@/types/sportEventRules";
import type { SportEventRulesV1 } from "@/types/sportEventRules";

export default function SuperFamiliasInferidasPage() {
  const queryClient = useQueryClient();

  // 1. Buscar regras sem família ou pendentes de inferência
  const { data: rules, isLoading } = useQuery({
    queryKey: ["sport-rules-to-infer"],
    queryFn: async () => {
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

      const { data: inferences, error: infError } = await supabase
        .from("sport_family_inferences")
        .select("*");
      
      if (infError) throw infError;

      return (rulesData || [])
        .filter(r => {
          const rulesObj = r.rules as unknown as SportEventRulesV1;
          return !rulesObj?.family;
        })
        .map(r => {
          const sportName = (r.sport_events as any)?.sports?.name || "Desconhecido";
          const eventName = (r.sport_events as any)?.name || "Desconhecido";
          const inference = inferences?.find(i => i.sport_event_rule_id === r.id);
          
          return {
            id: r.id,
            rules: r.rules as unknown as SportEventRulesV1,
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
        .upsert(data, { onConflict: 'sport_event_rule_id' });
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
      const { data: userData } = await supabase.auth.getUser();
      
      for (const id of selectedIds) {
        const item = rules?.find(r => r.id === id);
        if (!item) continue;

        const newRules = { ...item.rules, family: item.suggested.family };
        
        const { error: updateError } = await supabase
          .from("sport_event_rules")
          .update({ rules: newRules as any })
          .eq("id", id);
        
        if (updateError) throw updateError;

        const { error: infError } = await supabase
          .from("sport_family_inferences")
          .update({ 
            status: "applied", 
            applied_at: new Date().toISOString(),
            applied_by: userData.user?.id
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

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-amber-500" /></div>;

  return (
    <div className="p-6 space-y-6 bg-zinc-950 min-h-screen text-zinc-100">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Inferência de Famílias</h1>
          <p className="text-zinc-400 text-sm">Auditoria e atribuição automática de famílias para provas existentes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800" onClick={handleRunInference} disabled={saveInferences.isPending}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Gerar Sugestões
          </Button>
          <Button 
            className="bg-amber-500 hover:bg-amber-600 text-zinc-950"
            disabled={!rules?.length || applyInferences.isPending}
            onClick={() => applyInferences.mutate(rules?.map(r => r.id) || [])}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Aplicar Todas
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-zinc-800 bg-zinc-900 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-800/50">
            <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
              <TableHead className="text-zinc-400">Modalidade</TableHead>
              <TableHead className="text-zinc-400">Prova</TableHead>
              <TableHead className="text-zinc-400">Família Sugerida</TableHead>
              <TableHead className="text-zinc-400">Motivo</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-zinc-400 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules?.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={6} className="text-center py-20 text-zinc-500">
                  Nenhuma prova pendente de família encontrada.
                </TableCell>
              </TableRow>
            ) : (
              rules?.map((r) => (
                <TableRow key={r.id} className="border-zinc-800 hover:bg-zinc-800/30">
                  <TableCell className="font-medium">{r.sportName}</TableCell>
                  <TableCell className="text-zinc-300">{r.eventName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-zinc-700">
                      {FAMILIES.find(f => f.value === r.suggested.family)?.label || r.suggested.family}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-zinc-500 max-w-[200px] truncate">{r.suggested.reason}</TableCell>
                  <TableCell>
                    {r.existingInference?.status === 'applied' ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Aplicado</Badge>
                    ) : (
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
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
