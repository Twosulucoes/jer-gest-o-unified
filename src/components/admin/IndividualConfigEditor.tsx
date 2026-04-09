import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface IndividualConfig {
  result_fields?: {
    time?: boolean;
    distance?: boolean;
    points?: boolean;
    score?: boolean;
    position?: boolean;
  };
  match_type?: "heat" | "bracket" | "round_robin" | "direct";
  allows_attempts?: boolean;
  max_attempts?: number;
  uses_sets?: boolean;
  max_sets?: number;
  requires_referees?: boolean;
  min_referees?: number;
  requires_attachments?: boolean;
}

const MATCH_TYPES = [
  { value: "direct", label: "Classificação direta" },
  { value: "heat", label: "Baterias / Séries" },
  { value: "bracket", label: "Chaves eliminatórias" },
  { value: "round_robin", label: "Todos contra todos" },
];

const RESULT_FIELDS = [
  { key: "time" as const, label: "Tempo" },
  { key: "distance" as const, label: "Distância" },
  { key: "points" as const, label: "Pontos" },
  { key: "score" as const, label: "Placar" },
  { key: "position" as const, label: "Posição / Classificação" },
];

interface IndividualConfigEditorProps {
  value: IndividualConfig;
  onChange: (config: IndividualConfig) => void;
}

export default function IndividualConfigEditor({ value, onChange }: IndividualConfigEditorProps) {
  const update = (patch: Partial<IndividualConfig>) => onChange({ ...value, ...patch });
  const fields = value.result_fields ?? {};

  const toggleField = (key: keyof IndividualConfig["result_fields"] & string, checked: boolean) => {
    update({ result_fields: { ...fields, [key]: checked } });
  };

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">Configuração da modalidade individual</p>

      {/* Result fields */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Campos de resultado relevantes</Label>
        <div className="grid grid-cols-2 gap-2">
          {RESULT_FIELDS.map((rf) => (
            <label key={rf.key} className="flex items-center gap-2 rounded border bg-background px-3 py-2 cursor-pointer">
              <Checkbox
                checked={!!fields[rf.key]}
                onCheckedChange={(checked) => toggleField(rf.key, !!checked)}
              />
              <span className="text-xs">{rf.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Match type */}
      <div className="space-y-1.5">
        <Label className="text-xs">Tipo de confronto / prova</Label>
        <Select
          value={value.match_type || "direct"}
          onValueChange={(v) => update({ match_type: v as IndividualConfig["match_type"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MATCH_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Attempts */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Admite tentativas</Label>
          <Switch
            checked={!!value.allows_attempts}
            onCheckedChange={(v) => update({ allows_attempts: v, max_attempts: v ? (value.max_attempts ?? 3) : undefined })}
          />
        </div>
        {value.allows_attempts && (
          <div className="space-y-1.5 pl-4">
            <Label className="text-xs">Máximo de tentativas</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={value.max_attempts ?? 3}
              onChange={(e) => update({ max_attempts: parseInt(e.target.value) || 3 })}
              className="w-24"
            />
          </div>
        )}
      </div>

      {/* Sets */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Usa sets / games</Label>
          <Switch
            checked={!!value.uses_sets}
            onCheckedChange={(v) => update({ uses_sets: v, max_sets: v ? (value.max_sets ?? 3) : undefined })}
          />
        </div>
        {value.uses_sets && (
          <div className="space-y-1.5 pl-4">
            <Label className="text-xs">Máximo de sets</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={value.max_sets ?? 3}
              onChange={(e) => update({ max_sets: parseInt(e.target.value) || 3 })}
              className="w-24"
            />
          </div>
        )}
      </div>

      {/* Referees */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Exige arbitragem</Label>
          <Switch
            checked={!!value.requires_referees}
            onCheckedChange={(v) => update({ requires_referees: v, min_referees: v ? (value.min_referees ?? 1) : undefined })}
          />
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
      </div>

      {/* Attachments */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Exige anexos obrigatórios</Label>
          <Switch
            checked={!!value.requires_attachments}
            onCheckedChange={(v) => update({ requires_attachments: v })}
          />
        </div>
      </div>
    </div>
  );
}
