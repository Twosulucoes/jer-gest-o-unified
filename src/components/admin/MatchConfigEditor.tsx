import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MatchConfig {
  score_type?: "simple" | "sets" | "quarters" | "halves";
  periods?: number;
  period_label?: string;
  requires_referees?: boolean;
  min_referees?: number;
  requires_table_officials?: boolean;
  requires_attachments?: boolean;
}

const SCORE_TYPES = [
  { value: "simple", label: "Placar simples" },
  { value: "halves", label: "Tempos (1º e 2º tempo)" },
  { value: "quarters", label: "Quartos" },
  { value: "sets", label: "Sets" },
];

const PERIOD_LABELS = [
  { value: "tempo", label: "Tempo" },
  { value: "set", label: "Set" },
  { value: "quarto", label: "Quarto" },
  { value: "período", label: "Período" },
];

interface MatchConfigEditorProps {
  value: MatchConfig;
  onChange: (config: MatchConfig) => void;
}

export default function MatchConfigEditor({ value, onChange }: MatchConfigEditorProps) {
  const update = (patch: Partial<MatchConfig>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">Configuração da modalidade coletiva</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo de placar</Label>
          <Select value={value.score_type || "simple"} onValueChange={(v) => update({ score_type: v as MatchConfig["score_type"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SCORE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Rótulo do período</Label>
          <Select value={value.period_label || "tempo"} onValueChange={(v) => update({ period_label: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_LABELS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {value.score_type && value.score_type !== "simple" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Nº de períodos/sets</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={value.periods ?? 2}
            onChange={(e) => update({ periods: parseInt(e.target.value) || 2 })}
            className="w-24"
          />
        </div>
      )}

      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Exige arbitragem</Label>
          <Switch checked={!!value.requires_referees} onCheckedChange={(v) => update({ requires_referees: v })} />
        </div>
        {value.requires_referees && (
          <div className="space-y-1.5 pl-4">
            <Label className="text-xs">Mínimo de árbitros</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={value.min_referees ?? 1}
              onChange={(e) => update({ min_referees: parseInt(e.target.value) || 1 })}
              className="w-24"
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <Label className="text-xs">Exige mesa/apoio</Label>
          <Switch checked={!!value.requires_table_officials} onCheckedChange={(v) => update({ requires_table_officials: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Exige anexos obrigatórios</Label>
          <Switch checked={!!value.requires_attachments} onCheckedChange={(v) => update({ requires_attachments: v })} />
        </div>
      </div>
    </div>
  );
}
