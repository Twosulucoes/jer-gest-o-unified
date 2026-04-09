import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PlayerStatConfig {
  key: string;
  label: string;
  type: "count" | "number";
  visible: boolean;
  required?: boolean;
}

export interface MatchConfig {
  score_type?: "simple" | "sets" | "quarters" | "halves";
  periods?: number;
  period_label?: string;
  requires_referees?: boolean;
  min_referees?: number;
  requires_table_officials?: boolean;
  requires_attachments?: boolean;
  player_stats?: PlayerStatConfig[];
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

  const stats = value.player_stats ?? [];

  const addStat = () => {
    const newStats = [...stats, { key: "", label: "", type: "count" as const, visible: true }];
    update({ player_stats: newStats });
  };

  const updateStat = (idx: number, patch: Partial<PlayerStatConfig>) => {
    const newStats = stats.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    update({ player_stats: newStats });
  };

  const removeStat = (idx: number) => {
    update({ player_stats: stats.filter((_, i) => i !== idx) });
  };

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

      {/* Player Stats Configuration */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Estatísticas individuais por atleta</Label>
          <Button type="button" variant="outline" size="sm" onClick={addStat}>
            <Plus className="mr-1 h-3 w-3" />Adicionar
          </Button>
        </div>

        {stats.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma estatística configurada. Ex: gols, pontos, aces.</p>
        )}

        {stats.map((stat, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end rounded border bg-background p-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Chave</Label>
              <Input
                placeholder="gols"
                value={stat.key}
                onChange={(e) => {
                  const key = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                  updateStat(idx, { key });
                }}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Rótulo</Label>
              <Input
                placeholder="Gols"
                value={stat.label}
                onChange={(e) => updateStat(idx, { label: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Tipo</Label>
              <Select value={stat.type} onValueChange={(v) => updateStat(idx, { type: v as "count" | "number" })}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Contagem</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeStat(idx)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
