import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Plus, Trash2 } from "lucide-react";
import type { EventRulesSections, OperationalRule, PermLevel } from "@/hooks/useEventEditionRules";

interface Props {
  sections: EventRulesSections;
  onChange: (sections: EventRulesSections) => void;
  onSave: () => void;
  isSaving: boolean;
  perm: PermLevel;
  isLoading: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  geral: "Geral",
  ausencia: "Ausência/Recusa",
  protesto: "Protestos",
  prazo: "Prazos",
};

const DEFAULT_OPERATIONAL_RULES: OperationalRule[] = [
  { key: "wo_tolerance", label: "Tolerância para W.O. (minutos)", value: "15", category: "geral" },
  { key: "wo_refusal_minutes", label: "Recusa de W.O. (minutos)", value: "5", category: "geral" },
  { key: "protest_deadline_hours", label: "Prazo para protesto (horas)", value: "24", category: "protesto" },
  { key: "protest_fee", label: "Taxa de protesto (R$)", value: "0", category: "protesto" },
  { key: "absence_notification", label: "Prazo para comunicar ausência", value: "Até 1h antes da partida", category: "ausencia" },
  { key: "absence_effect", label: "Efeito da ausência não comunicada", value: "W.O. automático", category: "ausencia" },
  { key: "result_validation_hours", label: "Prazo para validação de resultado (horas)", value: "48", category: "prazo" },
];

export default function RegrasOperacionaisTab({ sections, onChange, onSave, isSaving, perm, isLoading }: Props) {
  const [editing, setEditing] = useState<OperationalRule | null>(null);
  const [editIdx, setEditIdx] = useState(-1);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const canEdit = perm === "full" || perm === "edit";
  const rules = sections.operational ?? [];

  const loadDefaults = () => {
    onChange({ ...sections, operational: [...DEFAULT_OPERATIONAL_RULES] });
  };

  const addRule = () => {
    setEditing({ key: "", label: "", value: "", category: "geral" });
    setEditIdx(-1);
  };

  const saveRule = () => {
    if (!editing) return;
    const updated = [...rules];
    if (editIdx >= 0) updated[editIdx] = editing; else updated.push(editing);
    onChange({ ...sections, operational: updated });
    setEditing(null);
    setEditIdx(-1);
  };

  const removeRule = (idx: number) => {
    onChange({ ...sections, operational: rules.filter((_, i) => i !== idx) });
  };

  const grouped = (cat: string) => rules.filter((r) => r.category === cat);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras Operacionais Gerais</CardTitle>
          <CardDescription>Regras gerais aplicáveis a todas as modalidades: prazos, tolerâncias, ausências e protestos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length === 0 && canEdit && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">Nenhuma regra operacional cadastrada.</p>
              <Button size="sm" variant="outline" onClick={loadDefaults}>
                Carregar regras padrão
              </Button>
            </div>
          )}

          {editing && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome da regra</Label>
                  <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor</Label>
                  <Input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveRule}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(null); setEditIdx(-1); }}>Cancelar</Button>
              </div>
            </div>
          )}

          {rules.length > 0 && (
            <>
              {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                const items = grouped(cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{label}</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Regra</TableHead>
                          <TableHead>Valor</TableHead>
                          {canEdit && <TableHead className="w-10"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((r) => {
                          const idx = rules.indexOf(r);
                          return (
                            <TableRow key={idx} className="cursor-pointer" onClick={() => { if (canEdit) { setEditing({ ...r }); setEditIdx(idx); } }}>
                              <TableCell className="font-medium text-sm">{r.label}</TableCell>
                              <TableCell><Badge variant="secondary" className="text-xs">{r.value}</Badge></TableCell>
                              {canEdit && (
                                <TableCell>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removeRule(idx); }}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}

              {canEdit && !editing && (
                <Button size="sm" variant="outline" onClick={addRule}>
                  <Plus className="h-4 w-4 mr-1" />Adicionar regra
                </Button>
              )}
            </>
          )}

          {canEdit && rules.length > 0 && (
            <Button onClick={onSave} disabled={isSaving} size="sm">
              <Save className="h-4 w-4 mr-1" />{isSaving ? "Salvando..." : "Salvar regras operacionais"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
