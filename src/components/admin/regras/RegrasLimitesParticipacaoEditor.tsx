import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Save, RotateCcw, Info } from "lucide-react";

interface ParticipationRules {
  event_id: string;
  max_collective_teams_per_athlete: number;
  max_individual_sports_per_athlete: number;
  max_events_per_individual_sport: number;
  source: "default" | "db";
}

const DEFAULTS = {
  max_collective_teams_per_athlete: 1,
  max_individual_sports_per_athlete: 2,
  max_events_per_individual_sport: 6,
};

interface Props {
  eventId: string;
}

export default function RegrasLimitesParticipacaoEditor({ eventId }: Props) {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasRole("admin") || hasRole("secretaria");

  const { data: rules, isLoading } = useQuery({
    queryKey: ["event-participation-rules", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_participation_rules", {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data as unknown as ParticipationRules;
    },
    enabled: !!eventId,
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
        p_event_id: eventId,
        p_max_collective_teams_per_athlete: values.max_collective_teams_per_athlete,
        p_max_individual_sports_per_athlete: values.max_individual_sports_per_athlete,
        p_max_events_per_individual_sport: values.max_events_per_individual_sport,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Limites de participação salvos");
      queryClient.invalidateQueries({ queryKey: ["event-participation-rules", eventId] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  const setField = (field: keyof typeof form, value: string) => {
    const num = Math.max(0, Math.min(50, parseInt(value) || 0));
    setForm((prev) => ({ ...prev, [field]: num }));
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando limites…</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Limites de Participação</CardTitle>
        <CardDescription>
          Quantas modalidades e provas cada atleta pode disputar. Esses limites alimentam o motor de irregularidades.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="default" className="border-border">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Alterar limites <strong>não afeta</strong> inscrições existentes, mas recalculará irregularidades na próxima verificação.
          </AlertDescription>
        </Alert>

        {rules?.source === "default" && (
          <Alert className="border-amber-400/30 bg-amber-500/10">
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
              Nenhuma regra personalizada salva. Exibindo valores padrão.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="max_collective">Máx. equipes coletivas / atleta</Label>
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
            <Label htmlFor="max_individual">Máx. modalidades individuais / atleta</Label>
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
            <Label htmlFor="max_events">Máx. provas / modalidade individual</Label>
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
            <Button size="sm" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
              <Save className="mr-2 h-3.5 w-3.5" />
              {mutation.isPending ? "Salvando..." : "Salvar Limites"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setForm(DEFAULTS); mutation.mutate(DEFAULTS); }} disabled={mutation.isPending}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Restaurar padrão
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
