import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, RotateCcw } from "lucide-react";
import type { EventRulesSections, ChampionshipScoring, ScoringRule, PermLevel } from "@/hooks/useEventEditionRules";

interface Props {
  sections: EventRulesSections;
  onChange: (sections: EventRulesSections) => void;
  onSave: () => void;
  isSaving: boolean;
  perm: PermLevel;
  isLoading: boolean;
}

const DEFAULT_SCORING: ChampionshipScoring = {
  scoring_table: [
    { position: 1, points: 10 },
    { position: 2, points: 8 },
    { position: 3, points: 6 },
    { position: 4, points: 5 },
    { position: 5, points: 4 },
    { position: 6, points: 3 },
    { position: 7, points: 2 },
    { position: 8, points: 1 },
  ],
  tiebreakers: ["Maior número de 1ºs lugares", "Maior número de 2ºs lugares", "Maior número de 3ºs lugares", "Sorteio"],
  collective_rules: "A pontuação é atribuída por equipe classificada na modalidade coletiva.",
  individual_rules: "A pontuação é atribuída por atleta classificado na modalidade individual. Conversão: média ponderada conforme regulamento.",
  conversion_notes: "",
};

export default function RegrasPontuacaoTab({ sections, onChange, onSave, isSaving, perm, isLoading }: Props) {
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const canEdit = perm === "full" || perm === "edit";
  const scoring = sections.championship_scoring ?? { ...DEFAULT_SCORING };

  const update = (partial: Partial<ChampionshipScoring>) => {
    onChange({ ...sections, championship_scoring: { ...scoring, ...partial } });
  };

  const updateTableRow = (idx: number, field: keyof ScoringRule, value: number) => {
    const updated = [...(scoring.scoring_table ?? [])];
    updated[idx] = { ...updated[idx], [field]: value };
    update({ scoring_table: updated });
  };

  const loadDefaults = () => {
    onChange({ ...sections, championship_scoring: { ...DEFAULT_SCORING } });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pontuação do Campeonato Geral</CardTitle>
          <CardDescription>Tabela de pontos por colocação e regras de desempate do campeonato geral</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(!scoring.scoring_table || scoring.scoring_table.length === 0) && canEdit ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">Nenhuma tabela de pontuação cadastrada.</p>
              <Button size="sm" variant="outline" onClick={loadDefaults}>
                Carregar pontuação padrão (1º ao 8º)
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Tabela de Pontos</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Posição</TableHead>
                        <TableHead className="w-20">Pontos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(scoring.scoring_table ?? []).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.position}º</TableCell>
                          <TableCell>
                            {canEdit ? (
                              <Input
                                type="number" min={0} className="w-20 h-8"
                                value={row.points}
                                onChange={(e) => updateTableRow(idx, "points", Number(e.target.value) || 0)}
                              />
                            ) : (
                              <span className="font-mono">{row.points}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {canEdit && (
                    <Button size="sm" variant="ghost" className="mt-2" onClick={loadDefaults}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />Restaurar padrão
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Critérios de Desempate</h4>
                    <div className="space-y-1">
                      {(scoring.tiebreakers ?? []).map((tb, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground font-mono text-xs w-5">{idx + 1}.</span>
                          {canEdit ? (
                            <Input
                              className="h-8 text-sm"
                              value={tb}
                              onChange={(e) => {
                                const updated = [...(scoring.tiebreakers ?? [])];
                                updated[idx] = e.target.value;
                                update({ tiebreakers: updated });
                              }}
                            />
                          ) : (
                            <span>{tb}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Regras para coletivas</Label>
                  <Textarea
                    value={scoring.collective_rules ?? ""}
                    onChange={(e) => update({ collective_rules: e.target.value })}
                    rows={3} disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Regras para individuais</Label>
                  <Textarea
                    value={scoring.individual_rules ?? ""}
                    onChange={(e) => update({ individual_rules: e.target.value })}
                    rows={3} disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Notas de conversão</Label>
                <Textarea
                  value={scoring.conversion_notes ?? ""}
                  onChange={(e) => update({ conversion_notes: e.target.value })}
                  placeholder="Regras de conversão de pontuação quando aplicável..."
                  rows={2} disabled={!canEdit}
                />
              </div>
            </>
          )}

          {canEdit && scoring.scoring_table && scoring.scoring_table.length > 0 && (
            <Button onClick={onSave} disabled={isSaving} size="sm">
              <Save className="h-4 w-4 mr-1" />{isSaving ? "Salvando..." : "Salvar pontuação"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
