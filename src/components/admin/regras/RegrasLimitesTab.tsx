import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Info } from "lucide-react";
import type { EventRulesSections, ParticipationLimit, PermLevel } from "@/hooks/useEventEditionRules";

interface Props {
  sections: EventRulesSections;
  onChange: (sections: EventRulesSections) => void;
  onSave: () => void;
  isSaving: boolean;
  perm: PermLevel;
  isLoading: boolean;
}

const DEFAULTS: ParticipationLimit = {
  max_collective_teams_per_athlete: 1,
  max_individual_sports_per_athlete: 2,
  max_events_per_individual_sport: 6,
};

export default function RegrasLimitesTab({ sections, onChange, onSave, isSaving, perm, isLoading }: Props) {
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const canEdit = perm === "full" || perm === "edit";
  const limits = sections.participation_limits ?? { ...DEFAULTS };

  const update = (partial: Partial<ParticipationLimit>) => {
    onChange({ ...sections, participation_limits: { ...limits, ...partial } });
  };

  const setNum = (field: keyof ParticipationLimit, value: string) => {
    const num = Math.max(0, Math.min(50, parseInt(value) || 0));
    update({ [field]: num } as any);
  };

  // Validation warnings
  const warnings: string[] = [];
  if (limits.max_collective_teams_per_athlete > 5) warnings.push("Limite de equipes coletivas por atleta muito alto (>5)");
  if (limits.max_individual_sports_per_athlete > 10) warnings.push("Limite de modalidades individuais muito alto (>10)");

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Essas regras serão usadas para gerar irregularidades e bloquear credenciamento.
          Alterar regras <strong>não afeta</strong> inscrições já importadas.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limites de Participação</CardTitle>
          <CardDescription>Quantas modalidades/provas cada atleta pode participar neste evento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Máx. equipes coletivas por atleta</Label>
              <Input
                type="number" min={0} max={50}
                value={limits.max_collective_teams_per_athlete}
                onChange={(e) => setNum("max_collective_teams_per_athlete", e.target.value)}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">Padrão: 1</p>
            </div>
            <div className="space-y-2">
              <Label>Máx. modalidades individuais por atleta</Label>
              <Input
                type="number" min={0} max={50}
                value={limits.max_individual_sports_per_athlete}
                onChange={(e) => setNum("max_individual_sports_per_athlete", e.target.value)}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">Padrão: 2</p>
            </div>
            <div className="space-y-2">
              <Label>Máx. provas por modalidade individual</Label>
              <Input
                type="number" min={0} max={50}
                value={limits.max_events_per_individual_sport}
                onChange={(e) => setNum("max_events_per_individual_sport", e.target.value)}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">Padrão: 6</p>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-1">
              {warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </div>
          )}

          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Regras Especiais</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={limits.special_rules ?? ""}
                onChange={(e) => update({ special_rules: e.target.value })}
                placeholder="Regras adicionais de elegibilidade ou limitação específicas do evento..."
                rows={4}
                disabled={!canEdit}
              />
            </CardContent>
          </Card>

          {canEdit && (
            <Button onClick={onSave} disabled={isSaving} size="sm">
              <Save className="h-4 w-4 mr-1" />{isSaving ? "Salvando..." : "Salvar limites"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
