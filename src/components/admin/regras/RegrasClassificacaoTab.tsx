import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Plus, Trash2 } from "lucide-react";
import type { EventRulesSections, ClassificationRule, PermLevel } from "@/hooks/useEventEditionRules";

interface Props {
  sections: EventRulesSections;
  onChange: (sections: EventRulesSections) => void;
  onSave: () => void;
  isSaving: boolean;
  perm: PermLevel;
  isLoading: boolean;
}

export default function RegrasClassificacaoTab({ sections, onChange, onSave, isSaving, perm, isLoading }: Props) {
  const [editing, setEditing] = useState<ClassificationRule | null>(null);
  const [editIdx, setEditIdx] = useState<number>(-1);

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const canEdit = perm === "full" || perm === "edit";
  const rules = sections.classification ?? [];

  const totalSlots = rules.reduce((sum, r) => sum + (r.slots_per_host ?? 0), 0);
  const totalQualified = rules.reduce((sum, r) => sum + (r.total_qualified ?? 0), 0);

  const addRule = () => {
    setEditing({ stage_name: "", host_city: "", slots_per_host: 0, total_qualified: 0, advancement_criteria: "", notes: "" });
    setEditIdx(-1);
  };

  const saveRule = () => {
    if (!editing) return;
    const updated = [...rules];
    if (editIdx >= 0) updated[editIdx] = editing; else updated.push(editing);
    onChange({ ...sections, classification: updated });
    setEditing(null);
    setEditIdx(-1);
  };

  const removeRule = (idx: number) => {
    onChange({ ...sections, classification: rules.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras de Classificação e Vagas</CardTitle>
          <CardDescription>Regras de classificação por etapa e sede, vagas e critérios de avanço</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(totalSlots > 0 || totalQualified > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-dashed">
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold">{totalSlots}</p>
                  <p className="text-xs text-muted-foreground">Vagas por sede (total)</p>
                </CardContent>
              </Card>
              <Card className="border-dashed">
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold">{totalQualified}</p>
                  <p className="text-xs text-muted-foreground">Total de classificados</p>
                </CardContent>
              </Card>
            </div>
          )}

          {editing && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Etapa/Fase</Label>
                  <Input value={editing.stage_name} onChange={(e) => setEditing({ ...editing, stage_name: e.target.value })} placeholder="Ex: Etapa Municipal" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sede/Cidade</Label>
                  <Input value={editing.host_city ?? ""} onChange={(e) => setEditing({ ...editing, host_city: e.target.value })} placeholder="Ex: Boa Vista" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Vagas por sede</Label>
                  <Input type="number" min={0} value={editing.slots_per_host ?? ""} onChange={(e) => setEditing({ ...editing, slots_per_host: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total classificados</Label>
                  <Input type="number" min={0} value={editing.total_qualified ?? ""} onChange={(e) => setEditing({ ...editing, total_qualified: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Critérios de avanço</Label>
                <Textarea value={editing.advancement_criteria ?? ""} onChange={(e) => setEditing({ ...editing, advancement_criteria: e.target.value })} rows={2} placeholder="Descreva os critérios..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveRule}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(null); setEditIdx(-1); }}>Cancelar</Button>
              </div>
            </div>
          )}

          {!editing && canEdit && (
            <Button size="sm" variant="outline" onClick={addRule}>
              <Plus className="h-4 w-4 mr-1" />Adicionar etapa
            </Button>
          )}

          {rules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead className="text-center">Vagas</TableHead>
                  <TableHead className="text-center">Classificados</TableHead>
                  <TableHead>Critérios</TableHead>
                  {canEdit && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r, idx) => (
                  <TableRow key={idx} className="cursor-pointer" onClick={() => { if (canEdit) { setEditing({ ...r }); setEditIdx(idx); } }}>
                    <TableCell className="font-medium">{r.stage_name || "—"}</TableCell>
                    <TableCell>{r.host_city || "—"}</TableCell>
                    <TableCell className="text-center">{r.slots_per_host ?? "—"}</TableCell>
                    <TableCell className="text-center">{r.total_qualified ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.advancement_criteria || "—"}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removeRule(idx); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma regra de classificação cadastrada.</p>
          )}

          {canEdit && rules.length > 0 && (
            <Button onClick={onSave} disabled={isSaving} size="sm">
              <Save className="h-4 w-4 mr-1" />{isSaving ? "Salvando..." : "Salvar classificação"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
