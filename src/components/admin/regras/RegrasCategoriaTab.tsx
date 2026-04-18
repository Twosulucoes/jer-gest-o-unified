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
import type { EventRulesSections, CategoryRule, PermLevel } from "@/hooks/useEventEditionRules";

interface Props {
  sections: EventRulesSections;
  onChange: (sections: EventRulesSections) => void;
  onSave: () => void;
  isSaving: boolean;
  perm: PermLevel;
  isLoading: boolean;
}

const EMPTY_CATEGORY: CategoryRule = {
  id: "",
  name: "",
  min_birth_year: null,
  max_birth_year: null,
  gender_scope: "mixed",
  notes: "",
};

export default function RegrasCategoriaTab({ sections, onChange, onSave, isSaving, perm, isLoading }: Props) {
  const [editing, setEditing] = useState<CategoryRule | null>(null);
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const canEdit = perm === "full" || perm === "edit";
  const categories = sections.categories ?? [];

  const genderLabel = (g: string) => {
    const map: Record<string, string> = { male: "Masculino", female: "Feminino", mixed: "Misto" };
    return map[g] ?? g;
  };

  const addCategory = () => {
    const newCat: CategoryRule = { ...EMPTY_CATEGORY, id: crypto.randomUUID() };
    setEditing(newCat);
  };

  const saveCategory = () => {
    if (!editing) return;
    const existing = categories.findIndex((c) => c.id === editing.id);
    const updated = [...categories];
    if (existing >= 0) {
      updated[existing] = editing;
    } else {
      updated.push(editing);
    }
    onChange({ ...sections, categories: updated });
    setEditing(null);
  };

  const removeCategory = (id: string) => {
    onChange({ ...sections, categories: categories.filter((c) => c.id !== id) });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorias e Faixas Etárias</CardTitle>
          <CardDescription>Faixas etárias por evento, com possibilidade de categorias especiais por modalidade</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Sub-15" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ano nasc. mínimo</Label>
                  <Input type="number" value={editing.min_birth_year ?? ""} onChange={(e) => setEditing({ ...editing, min_birth_year: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ano nasc. máximo</Label>
                  <Input type="number" value={editing.max_birth_year ?? ""} onChange={(e) => setEditing({ ...editing, max_birth_year: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Gênero</Label>
                  <Select value={editing.gender_scope} onValueChange={(v) => setEditing({ ...editing, gender_scope: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Feminino</SelectItem>
                      <SelectItem value="mixed">Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observações</Label>
                  <Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Categorias especiais..." />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveCategory}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              </div>
            </div>
          ) : canEdit ? (
            <Button size="sm" variant="outline" onClick={addCategory}>
              <Plus className="h-4 w-4 mr-1" />Adicionar categoria
            </Button>
          ) : null}

          {categories.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Ano nasc. mín.</TableHead>
                  <TableHead>Ano nasc. máx.</TableHead>
                  <TableHead>Gênero</TableHead>
                  <TableHead>Observações</TableHead>
                  {canEdit && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id} className="cursor-pointer" onClick={() => canEdit && setEditing({ ...cat })}>
                    <TableCell className="font-medium">{cat.name || "—"}</TableCell>
                    <TableCell>{cat.min_birth_year ?? "—"}</TableCell>
                    <TableCell>{cat.max_birth_year ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{genderLabel(cat.gender_scope)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{cat.notes || "—"}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removeCategory(cat.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma categoria cadastrada. Adicione as faixas etárias do evento.</p>
          )}

          {canEdit && categories.length > 0 && (
            <Button onClick={onSave} disabled={isSaving} size="sm">
              <Save className="h-4 w-4 mr-1" />{isSaving ? "Salvando..." : "Salvar categorias"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
