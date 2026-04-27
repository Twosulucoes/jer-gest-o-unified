import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Settings, ShieldAlert } from "lucide-react";
import { useEventContext } from "@/contexts/EventContext";
import { useState } from "react";

export default function RefereeRemunerationConfigPage() {
  const { activeEventId } = useEventContext();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasRole("admin");

  const [selectedStageId, setSelectedStageId] = useState<string>("");

  // Etapas do evento
  const { data: stages = [], isLoading: isLoadingStages } = useQuery({
    queryKey: ["event-stages", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_stages")
        .select("id, name")
        .eq("event_id", activeEventId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Modalidades do evento
  const { data: sports = [], isLoading: isLoadingSports } = useQuery({
    queryKey: ["sports-for-remuneration", activeEventId],
    enabled: !!activeEventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sports")
        .select("id, name")
        .eq("event_id", activeEventId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Configurações existentes
  const { data: configs = [], isLoading: isLoadingConfigs } = useQuery({
    queryKey: ["referee-remuneration-configs", selectedStageId],
    enabled: !!selectedStageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referee_remuneration_configs")
        .select("*")
        .eq("event_stage_id", selectedStageId);
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ sportId, type }: { sportId: string; type: "daily" | "per_match" }) => {
      if (!isAdmin) throw new Error("Apenas administradores podem alterar estas configurações.");
      
      const { error } = await supabase
        .from("referee_remuneration_configs")
        .upsert({
          event_stage_id: selectedStageId,
          sport_id: sportId,
          remuneration_type: type,
        }, { onConflict: "event_stage_id,sport_id" });
      
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referee-remuneration-configs", selectedStageId] });
      toast.success("Configuração atualizada");
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  if (!activeEventId) {
    return <div className="p-8 text-center text-muted-foreground">Selecione um evento ativo.</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Configuração de Remuneração
        </h1>
      </div>

      {!isAdmin && (
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
          <CardContent className="p-4 flex items-center gap-3 text-amber-800 dark:text-amber-200 text-sm">
            <ShieldAlert className="h-5 w-5" />
            Esta tela é apenas para visualização. Apenas o perfil Admin pode alterar o tipo de remuneração.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Selecione a Etapa</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Etapa..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Regras por Modalidade</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedStageId ? (
              <p className="text-center text-muted-foreground py-8">Selecione uma etapa para configurar.</p>
            ) : isLoadingSports || isLoadingConfigs ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modalidade</TableHead>
                    <TableHead>Tipo de Remuneração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sports.map((sport) => {
                    const config = configs.find((c) => c.sport_id === sport.id);
                    const currentType = config?.remuneration_type || "per_match";

                    return (
                      <TableRow key={sport.id}>
                        <TableCell className="font-medium">{sport.name}</TableCell>
                        <TableCell>
                          <Select 
                            value={currentType} 
                            disabled={!isAdmin || saveMutation.isPending}
                            onValueChange={(v: "daily" | "per_match") => 
                              saveMutation.mutate({ sportId: sport.id, type: v })
                            }
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="per_match">Por Partida</SelectItem>
                              <SelectItem value="daily">Por Diária</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
