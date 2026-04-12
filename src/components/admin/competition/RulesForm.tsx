import type { SportEventRulesV1, RulesFamily, RulesFormat, ParticipantMode, ScoreType } from "@/types/sportEventRules";
import { FAMILIES, FORMATS, PARTICIPANT_MODES, SCORE_TYPES, VALID_FORMATS_BY_FAMILY } from "@/types/sportEventRules";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  rules: SportEventRulesV1;
  onChange: (rules: SportEventRulesV1) => void;
  validationErrors: string[];
}

export default function RulesForm({ rules, onChange, validationErrors }: Props) {
  const validFormats = VALID_FORMATS_BY_FAMILY[rules.family] ?? [];

  const update = (partial: Partial<SportEventRulesV1>) => {
    onChange({ ...rules, ...partial });
  };

  const updateScoring = (partial: Partial<SportEventRulesV1["scoring"]>) => {
    onChange({ ...rules, scoring: { ...rules.scoring, ...partial } });
  };

  const updateScheduling = (partial: Partial<SportEventRulesV1["scheduling"]>) => {
    onChange({ ...rules, scheduling: { ...rules.scheduling, ...partial } });
  };

  return (
    <div className="space-y-4">
      {validationErrors.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
          {validationErrors.map((e, i) => <p key={i}>• {e}</p>)}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Configuração Principal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Família</Label>
              <Select
                value={rules.family}
                onValueChange={(v) => {
                  const family = v as RulesFamily;
                  const validFmts = VALID_FORMATS_BY_FAMILY[family];
                  const fmt = validFmts.includes(rules.format) ? rules.format : validFmts[0];
                  update({ family, format: fmt });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FAMILIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Formato</Label>
              <Select value={rules.format} onValueChange={(v) => update({ format: v as RulesFormat })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATS.filter((f) => validFormats.includes(f.value)).map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Modo</Label>
              <Select value={rules.participant_mode} onValueChange={(v) => update({ participant_mode: v as ParticipantMode })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARTICIPANT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pontuação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Tipo de pontuação</Label>
              <Select value={rules.scoring.score_type} onValueChange={(v) => updateScoring({ score_type: v as ScoreType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCORE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(rules.family === "sets") && (
              <>
                <div>
                  <Label className="text-xs">Best of (sets)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={rules.scoring.best_of ?? ""}
                    onChange={(e) => updateScoring({ best_of: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Pontos por set</Label>
                  <Input
                    type="number"
                    min={1}
                    value={rules.scoring.set_points ?? ""}
                    onChange={(e) => updateScoring({ set_points: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Agendamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(rules.family === "time" || rules.family === "mark") && (
              <>
                <div>
                  <Label className="text-xs">Raias mín.</Label>
                  <Input
                    type="number"
                    min={1}
                    value={rules.scheduling.lanes_min ?? ""}
                    onChange={(e) => updateScheduling({ lanes_min: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Raias máx.</Label>
                  <Input
                    type="number"
                    min={1}
                    value={rules.scheduling.lanes_max ?? ""}
                    onChange={(e) => updateScheduling({ lanes_max: e.target.value ? Number(e.target.value) : null })}
                  />
                </div>
              </>
            )}
            {rules.family === "combat" && (
              <div>
                <Label className="text-xs">Descanso mín. (min)</Label>
                <Input
                  type="number"
                  min={0}
                  value={rules.scheduling.min_rest_minutes ?? ""}
                  onChange={(e) => updateScheduling({ min_rest_minutes: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Requisitos Mínimos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Mínimo de participantes</Label>
              <Input
                type="number"
                min={1}
                value={rules.minimo_participantes ?? 2}
                onChange={(e) => update({ minimo_participantes: e.target.value ? Number(e.target.value) : 2 })}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Nº mínimo de atletas/equipes para a prova ser apta a competir
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={rules.notes ?? ""}
            onChange={(e) => update({ notes: e.target.value || null })}
            placeholder="Notas livres sobre a regra..."
            rows={3}
          />
        </CardContent>
      </Card>
    </div>
  );
}
