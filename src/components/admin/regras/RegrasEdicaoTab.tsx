import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventRulesSections, PermLevel } from "@/hooks/useEventEditionRules";

interface Props {
  sections: EventRulesSections;
  onChange: (sections: EventRulesSections) => void;
  onSave: () => void;
  isSaving: boolean;
  perm: PermLevel;
  status: string | null;
  version: number;
  isLoading: boolean;
  updatedAt?: string;
}

export default function RegrasEdicaoTab({ sections, onChange, onSave, isSaving, perm, status, version, isLoading, updatedAt }: Props) {
  if (isLoading) return <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;

  const canEdit = perm === "full" || perm === "edit";
  const edition = sections.edition ?? {};

  const update = (partial: Partial<typeof edition>) => {
    onChange({ ...sections, edition: { ...edition, ...partial } });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificação da Edição</CardTitle>
          <CardDescription>Dados básicos da edição do evento e seu ciclo de vida</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant={status === "published" ? "default" : "secondary"}>
              {status === "published" ? "Publicada" : "Rascunho"}
            </Badge>
            <span className="text-xs text-muted-foreground">Versão {version}</span>
            {updatedAt && (
              <span className="text-xs text-muted-foreground">
                Última alteração: {new Date(updatedAt).toLocaleString("pt-BR")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ano da edição</Label>
              <Input
                type="number"
                min={2020}
                max={2040}
                value={edition.year ?? ""}
                onChange={(e) => update({ year: e.target.value ? Number(e.target.value) : undefined })}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de evento</Label>
              <Select
                value={edition.event_type ?? ""}
                onValueChange={(v) => update({ event_type: v })}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="JER">JER</SelectItem>
                  <SelectItem value="JERPA">JERPA</SelectItem>
                  <SelectItem value="JER+JERPA">JER + JERPA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome da edição</Label>
              <Input
                value={edition.edition_name ?? ""}
                onChange={(e) => update({ edition_name: e.target.value })}
                placeholder="Ex: JER 2026 — Etapa Estadual"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={edition.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Notas sobre esta edição..."
              rows={3}
              disabled={!canEdit}
            />
          </div>

          {canEdit && (
            <Button onClick={onSave} disabled={isSaving} size="sm">
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Salvando..." : "Salvar seção"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
