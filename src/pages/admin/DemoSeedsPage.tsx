import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Play, Trash2, RefreshCw, Copy, Check, Database as DbIcon, Users, Swords, MapPin, Building } from "lucide-react";
import { toast } from "sonner";

export default function DemoSeedsPage() {
  const { activeEventId } = useEventContext();
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const { data: demoStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["demo-status", activeEventId],
    queryFn: async () => {
      if (!activeEventId) return null;
      const teamsQ = supabase.from("teams").select("id", { count: "exact", head: true }).eq("event_id", activeEventId);
      const phasesQ = supabase.from("competition_phases").select("id", { count: "exact", head: true }).eq("event_id", activeEventId);
      const matchesQ = supabase.from("competition_matches").select("id", { count: "exact", head: true }).eq("event_id", activeEventId);
      const venuesQ = supabase.from("venues").select("id", { count: "exact", head: true }).eq("event_id", activeEventId);
      // @ts-ignore - seed_tag column added by migration
      const [teams, phases, matches, venues] = await Promise.all([
        teamsQ.eq("seed_tag", "demo"),
        phasesQ.eq("seed_tag", "demo"),
        matchesQ.eq("seed_tag", "demo"),
        venuesQ.eq("seed_tag", "demo"),
      ]);
      return {
        hasDemo: (teams.count || 0) > 0 || (phases.count || 0) > 0,
        teams: teams.count || 0,
        phases: phases.count || 0,
        matches: matches.count || 0,
        venues: venues.count || 0,
      };
    },
    enabled: !!activeEventId,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seed_event_demo" as any, { p_event_id: activeEventId! });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast.success("Demo criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["demo-status"] });
    },
    onError: (err: any) => toast.error("Erro ao criar demo: " + err.message),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("reset_demo" as any, { p_event_id: activeEventId! });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast.success("Demo removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["demo-status"] });
    },
    onError: (err: any) => toast.error("Erro ao resetar demo: " + err.message),
  });

  const recreateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seed_event_demo" as any, { p_event_id: activeEventId! });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast.success("Demo recriado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["demo-status"] });
    },
    onError: (err: any) => toast.error("Erro ao recriar demo: " + err.message),
  });

  const seedLogisticsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("seed_logistics_stage_template" as any, {
        p_event_id: activeEventId!,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast.success("Seed de logística criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["demo-status"] });
    },
    onError: (err: any) => toast.error("Erro ao criar seed de logística: " + err.message),
  });

  const isLoading = seedMutation.isPending || resetMutation.isPending || recreateMutation.isPending || seedLogisticsMutation.isPending;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!activeEventId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Demo (Seeds)</h1>
        <p className="text-muted-foreground mt-2">Selecione um evento ativo para usar os seeds de demonstração.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Demo (Seeds)</h1>
        <p className="text-sm text-muted-foreground">Crie dados de demonstração completos (competição + logística) para testar o sistema.</p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DbIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              {statusLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : demoStatus?.hasDemo ? (
                <Badge className="bg-primary text-primary-foreground">Ativo</Badge>
              ) : (
                <Badge variant="secondary">Sem demo</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Times</p>
              <p className="text-lg font-bold">{demoStatus?.teams ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Swords className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Partidas</p>
              <p className="text-lg font-bold">{demoStatus?.matches ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Venues</p>
              <p className="text-lg font-bold">{demoStatus?.venues ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Building className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Fases</p>
              <p className="text-lg font-bold">{demoStatus?.phases ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
        <CardTitle className="text-base">Ações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary" disabled={isLoading}>
                {seedLogisticsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building className="mr-2 h-4 w-4" />}
                Seed Logística (1 Etapa)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Criar seed inicial de logística?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cria uma etapa de exemplo com estruturas editáveis de alojamento, alimentação e transporte.
                  Não cria participantes.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => seedLogisticsMutation.mutate()}>Criar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isLoading}>
                {seedMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Criar Demo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Criar dataset demo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso criará 8 escolas, delegações, 80 atletas, times, fases de grupos, partidas com resultados e dados de logística para o evento ativo. Se já existir um demo, será resetado primeiro.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => seedMutation.mutate()}>Criar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isLoading || !demoStatus?.hasDemo}>
                {resetMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Reset Demo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover todos os dados demo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Apenas dados marcados como &quot;demo&quot; serão removidos. Dados reais do evento NÃO serão afetados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => resetMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Sim, remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isLoading}>
                {recreateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Recriar Demo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Recriar dataset demo?</AlertDialogTitle>
                <AlertDialogDescription>
                  O demo existente será removido e um novo será criado do zero.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => recreateMutation.mutate()}>Recriar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Último resultado</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-96">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
