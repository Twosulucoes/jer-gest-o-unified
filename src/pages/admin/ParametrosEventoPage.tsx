import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Settings, Users, Upload, Trophy, IdCard, RotateCcw, Save, Info } from "lucide-react";

interface ParticipationRules {
  event_id: string;
  max_collective_teams_per_athlete: number;
  max_individual_sports_per_athlete: number;
  max_events_per_individual_sport: number;
  source: "default" | "db";
}

const DEFAULTS: Omit<ParticipationRules, "event_id" | "source"> = {
  max_collective_teams_per_athlete: 1,
  max_individual_sports_per_athlete: 2,
  max_events_per_individual_sport: 6,
};

function ParticipacaoTab() {
  const activeEventId = useActiveEventId();
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasRole("admin") || hasRole("secretaria");

  const { data: rules, isLoading } = useQuery({
    queryKey: ["event-participation-rules", activeEventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_participation_rules", {
        p_event_id: activeEventId,
      });
      if (error) throw error;
      return data as unknown as ParticipationRules;
    },
  });

  const [form, setForm] = useState(DEFAULTS);

  useEffect(() => {
    if (rules) {
      setForm({
        max_collective_teams_per_athlete: rules.max_collective_teams_per_athlete,
        max_individual_sports_per_athlete: rules.max_individual_sports_per_athlete,
        max_events_per_individual_sport: rules.max_events_per_individual_sport,
      });
    }
  }, [rules]);

  const mutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase.rpc("upsert_event_participation_rules", {
        p_event_id: activeEventId,
        p_max_collective_teams_per_athlete: values.max_collective_teams_per_athlete,
        p_max_individual_sports_per_athlete: values.max_individual_sports_per_athlete,
        p_max_events_per_individual_sport: values.max_events_per_individual_sport,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regras de participação salvas com sucesso");
      queryClient.invalidateQueries({ queryKey: ["event-participation-rules", activeEventId] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar regras: " + err.message);
    },
  });

  const handleSave = () => mutation.mutate(form);

  const handleRestore = () => {
    setForm(DEFAULTS);
    mutation.mutate(DEFAULTS);
  };

  const setField = (field: keyof typeof form, value: string) => {
    const num = Math.max(0, Math.min(50, parseInt(value) || 0));
    setForm((prev) => ({ ...prev, [field]: num }));
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando regras…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-4">
        <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Essas regras serão usadas para gerar irregularidades e bloquear credenciamento (etapas seguintes).
          Alterar regras <strong>não afeta</strong> inscrições já importadas nesta etapa.
        </p>
      </div>

      {rules?.source === "default" && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Nenhuma regra personalizada salva para este evento. Exibindo valores padrão.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limites de Participação</CardTitle>
          <CardDescription>
            Defina quantas modalidades/provas cada atleta pode participar neste evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="max_collective">Máx. equipes coletivas por atleta</Label>
              <Input
                id="max_collective"
                type="number"
                min={0}
                max={50}
                value={form.max_collective_teams_per_athlete}
                onChange={(e) => setField("max_collective_teams_per_athlete", e.target.value)}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">Padrão: 1</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_individual">Máx. modalidades individuais por atleta</Label>
              <Input
                id="max_individual"
                type="number"
                min={0}
                max={50}
                value={form.max_individual_sports_per_athlete}
                onChange={(e) => setField("max_individual_sports_per_athlete", e.target.value)}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">Padrão: 2</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_events">Máx. provas por modalidade individual</Label>
              <Input
                id="max_events"
                type="number"
                min={0}
                max={50}
                value={form.max_events_per_individual_sport}
                onChange={(e) => setField("max_events_per_individual_sport", e.target.value)}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">Padrão: 6</p>
            </div>
          </div>

          {canEdit && (
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={mutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </Button>
              <Button variant="outline" onClick={handleRestore} disabled={mutation.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar padrão
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Settings className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <p className="text-lg font-medium text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-muted-foreground/60 mt-1">Em breve</p>
    </div>
  );
}

export default function ParametrosEventoPage() {
  const { activeEvent } = useEventContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Parâmetros do Evento</h1>
        {/* Event name removed as redundant */}
      </div>

      <Tabs defaultValue="participacao" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="participacao" className="gap-2">
            <Users className="h-4 w-4" />
            Participação
          </TabsTrigger>
          <TabsTrigger value="importacao" className="gap-2">
            <Upload className="h-4 w-4" />
            Importação
          </TabsTrigger>
          <TabsTrigger value="competicao" className="gap-2">
            <Trophy className="h-4 w-4" />
            Competição
          </TabsTrigger>
          <TabsTrigger value="credenciamento" className="gap-2">
            <IdCard className="h-4 w-4" />
            Credenciamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="participacao">
          <ParticipacaoTab />
        </TabsContent>
        <TabsContent value="importacao">
          <PlaceholderTab label="Parâmetros de Importação" />
        </TabsContent>
        <TabsContent value="competicao">
          <PlaceholderTab label="Parâmetros de Competição" />
        </TabsContent>
        <TabsContent value="credenciamento">
          <PlaceholderTab label="Parâmetros de Credenciamento" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
