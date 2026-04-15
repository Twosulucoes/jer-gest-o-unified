import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Save, Plus, Trash2, Search } from "lucide-react";
import type { EventRulesSections, SportVariation, PermLevel } from "@/hooks/useEventEditionRules";

interface Props {
  sections: EventRulesSections;
  onChange: (sections: EventRulesSections) => void;
  onSave: () => void;
  isSaving: boolean;
  perm: PermLevel;
  isLoading: boolean;
}

const EMPTY_SPORT: SportVariation = {
  id: "",
  sport_name: "",
  category_name: "",
  gender_scope: "mixed",
  participant_mode: "individual",
  is_jerpa: false,
  notes: "",
};

const MODE_LABELS: Record<string, string> = {
  individual: "Individual",
  team: "Equipe",
  pair: "Dupla",
  relay: "Revezamento",
};

export default function RegrasModalidadesTab({ sections, onChange, onSave, isSaving, perm, isLoading }: Props) {
  const [editing, setEditing] = useState<SportVariation | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterJerpa, setFilterJerpa] = useState("all");

  const canEdit = !isLoading && (perm === "full" || perm === "edit");
  const sports = useMemo(() => sections.sports ?? [], [sections.sports]);

  const filtered = useMemo(() => {
    return sports.filter((s) => {
      if (search && !s.sport_name.toLowerCase().includes(search.toLowerCase()) && !s.category_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== "all" && s.participant_mode !== filterType) return false;
      if (filterJerpa === "jerpa" && !s.is_jerpa) return false;
      if (filterJerpa === "jer" && s.is_jerpa) return false;
      return true;
    });
  }, [sports, search, filterType, filterJerpa]);

  const grouped = useMemo(() => {
    const map: Record<string, SportVariation[]> = {};
    for (const s of filtered) {
      const key = s.sport_name || "Sem modalidade";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const addSport = () => setEditing({ ...EMPTY_SPORT, id: crypto.randomUUID() });

  const saveSport = () => {
    if (!editing) return;
    const idx = sports.findIndex((s) => s.id === editing.id);
    const updated = [...sports];
    if (idx >= 0) updated[idx] = editing; else updated.push(editing);
    onChange({ ...sections, sports: updated });
    setEditing(null);
  };

  const removeSport = (id: string) => {
    onChange({ ...sections, sports: sports.filter((s) => s.id !== id) });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modalidades e Variações</CardTitle>
          <CardDescription>Modalidades por evento com filtros por categoria, gênero e tipo (JER/JERPA)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 w-52" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="team">Coletiva</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="pair">Dupla</SelectItem>
                <SelectItem value="relay">Revezamento</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterJerpa} onValueChange={setFilterJerpa}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">JER + JERPA</SelectItem>
                <SelectItem value="jer">JER</SelectItem>
                <SelectItem value="jerpa">JERPA</SelectItem>
              </SelectContent>
            </Select>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={addSport}>
                <Plus className="h-4 w-4 mr-1" />Adicionar
              </Button>
            )}
          </div>

          {editing && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Modalidade</Label>
                  <Input value={editing.sport_name} onChange={(e) => setEditing({ ...editing, sport_name: e.target.value })} placeholder="Ex: Futsal" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Input value={editing.category_name} onChange={(e) => setEditing({ ...editing, category_name: e.target.value })} placeholder="Ex: Sub-15 Masculino" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Modo</Label>
                  <Select value={editing.participant_mode} onValueChange={(v) => setEditing({ ...editing, participant_mode: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="team">Equipe</SelectItem>
                      <SelectItem value="pair">Dupla</SelectItem>
                      <SelectItem value="relay">Revezamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                  <Label className="text-xs">JERPA?</Label>
                  <Select value={editing.is_jerpa ? "sim" : "nao"} onValueChange={(v) => setEditing({ ...editing, is_jerpa: v === "sim" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Classe funcional</Label>
                  <Input value={editing.functional_class ?? ""} onChange={(e) => setEditing({ ...editing, functional_class: e.target.value || undefined })} placeholder="Ex: S1-S14" disabled={!editing.is_jerpa} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observações</Label>
                  <Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Mín. atletas por equipe</Label>
                  <Input type="number" min={0} value={editing.min_athletes ?? ""} onChange={(e) => setEditing({ ...editing, min_athletes: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Máx. atletas por equipe</Label>
                  <Input type="number" min={0} value={editing.max_athletes ?? ""} onChange={(e) => setEditing({ ...editing, max_athletes: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveSport}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              </div>
            </div>
          )}

          {grouped.length > 0 ? (
            <Accordion type="multiple" className="w-full">
              {grouped.map(([sportName, items]) => (
                <AccordionItem key={sportName} value={sportName}>
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2">
                      {sportName}
                      <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                      {items.some((i) => i.is_jerpa) && <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600">JERPA</Badge>}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Modo</TableHead>
                          <TableHead>Gênero</TableHead>
                          <TableHead>Classe</TableHead>
                          <TableHead>Atletas</TableHead>
                          {canEdit && <TableHead className="w-10"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((s) => (
                          <TableRow key={s.id} className="cursor-pointer" onClick={() => canEdit && setEditing({ ...s })}>
                            <TableCell>{s.category_name || "—"}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{MODE_LABELS[s.participant_mode] ?? s.participant_mode}</Badge></TableCell>
                            <TableCell className="text-xs">{s.gender_scope === "male" ? "M" : s.gender_scope === "female" ? "F" : "Misto"}</TableCell>
                            <TableCell className="text-xs">{s.functional_class ?? "—"}</TableCell>
                            <TableCell className="text-xs">{s.min_athletes ?? "—"} / {s.max_athletes ?? "—"}</TableCell>
                            {canEdit && (
                              <TableCell>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removeSport(s.id); }}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {sports.length === 0 ? "Nenhuma modalidade cadastrada." : "Nenhum resultado com os filtros aplicados."}
            </p>
          )}

          {canEdit && sports.length > 0 && (
            <Button onClick={onSave} disabled={isSaving} size="sm">
              <Save className="h-4 w-4 mr-1" />{isSaving ? "Salvando..." : "Salvar modalidades"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
