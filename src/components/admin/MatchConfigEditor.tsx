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

export interface PenaltyConfig {
  key: string;
  label: string;
  target: "player" | "team";
  requires_notes?: boolean;
  visible: boolean;
}

export interface EventTypeConfig {
  key: string;
  label: string;
  target: "match" | "team" | "player";
  requires_notes?: boolean;
  visible: boolean;
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
  penalties?: PenaltyConfig[];
  event_types?: EventTypeConfig[];
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
  const penalties = value.penalties ?? [];
  const eventTypes = value.event_types ?? [];

  const addStat = () => {
    update({ player_stats: [...stats, { key: "", label: "", type: "count" as const, visible: true }] });
  };
  const updateStat = (idx: number, patch: Partial<PlayerStatConfig>) => {
    update({ player_stats: stats.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
  };
  const removeStat = (idx: number) => {
    update({ player_stats: stats.filter((_, i) => i !== idx) });
  };

  const addPenalty = () => {
    update({ penalties: [...penalties, { key: "", label: "", target: "player" as const, visible: true }] });
  };
  const updatePenalty = (idx: number, patch: Partial<PenaltyConfig>) => {
    update({ penalties: penalties.map((p, i) => (i === idx ? { ...p, ...patch } : p)) });
  };
  const removePenalty = (idx: number) => {
    update({ penalties: penalties.filter((_, i) => i !== idx) });
  };

  const addEventType = () => {
    update({ event_types: [...eventTypes, { key: "", label: "", target: "match" as const, visible: true }] });
  };
  const updateEventType = (idx: number, patch: Partial<EventTypeConfig>) => {
    update({ event_types: eventTypes.map((e, i) => (i === idx ? { ...e, ...patch } : e)) });
  };
  const removeEventType = (idx: number) => {
    update({ event_types: eventTypes.filter((_, i) => i !== idx) });
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

      {/* Penalties Configuration */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Penalidades</Label>
          <Button type="button" variant="outline" size="sm" onClick={addPenalty}>
            <Plus className="mr-1 h-3 w-3" />Adicionar
          </Button>
        </div>

        {penalties.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma penalidade configurada. Ex: amarelo, vermelho, falta técnica.</p>
        )}

        {penalties.map((pen, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end rounded border bg-background p-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Chave</Label>
              <Input
                placeholder="amarelo"
                value={pen.key}
                onChange={(e) => {
                  const key = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                  updatePenalty(idx, { key });
                }}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Rótulo</Label>
              <Input
                placeholder="Cartão Amarelo"
                value={pen.label}
                onChange={(e) => updatePenalty(idx, { label: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Alvo</Label>
              <Select value={pen.target} onValueChange={(v) => updatePenalty(idx, { target: v as "player" | "team" })}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Atleta</SelectItem>
                  <SelectItem value="team">Equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1 pb-0.5">
              <Switch
                checked={!!pen.requires_notes}
                onCheckedChange={(v) => updatePenalty(idx, { requires_notes: v })}
                className="scale-75"
              />
              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Obs.</Label>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePenalty(idx)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Event Types Configuration */}
      <div className="space-y-3 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Ocorrências / Timeline</Label>
          <Button type="button" variant="outline" size="sm" onClick={addEventType}>
            <Plus className="mr-1 h-3 w-3" />Adicionar
          </Button>
        </div>

        {eventTypes.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma ocorrência configurada. Ex: timeout, substituição, início de período.</p>
        )}

        {eventTypes.map((evt, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end rounded border bg-background p-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Chave</Label>
              <Input
                placeholder="timeout"
                value={evt.key}
                onChange={(e) => {
                  const key = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                  updateEventType(idx, { key });
                }}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Rótulo</Label>
              <Input
                placeholder="Timeout"
                value={evt.label}
                onChange={(e) => updateEventType(idx, { label: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Alvo</Label>
              <Select value={evt.target} onValueChange={(v) => updateEventType(idx, { target: v as "match" | "team" | "player" })}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="match">Partida</SelectItem>
                  <SelectItem value="team">Equipe</SelectItem>
                  <SelectItem value="player">Atleta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1 pb-0.5">
              <Switch
                checked={!!evt.requires_notes}
                onCheckedChange={(v) => updateEventType(idx, { requires_notes: v })}
                className="scale-75"
              />
              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Obs.</Label>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeEventType(idx)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
