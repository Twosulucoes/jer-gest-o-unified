import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, ArrowRight, RotateCcw, Columns3 } from "lucide-react";

// ─── Target fields the edge function expects ────────────────────────

export interface TargetField {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
}

export const TARGET_FIELDS: TargetField[] = [
  { key: "NOME", label: "Nome completo", required: true, aliases: ["NOME", "NOME COMPLETO", "NOME_COMPLETO", "NOME DO ALUNO", "ALUNO"] },
  { key: "ESCOLA", label: "Escola / Instituição", required: true, aliases: ["ESCOLA", "INSTITUICAO", "INSTITUIÇÃO", "UNIDADE ESCOLAR", "ESCOLA/INSTITUICAO"] },
  { key: "MODALIDADE", label: "Modalidade", required: true, aliases: ["MODALIDADE", "ESPORTE", "SPORT", "MOD"] },
  { key: "PROVA", label: "Prova / Evento", required: true, aliases: ["PROVA", "EVENTO", "DISCIPLINE", "PROVA/EVENTO"] },
  { key: "COMPETICAO", label: "Competição / Categoria", required: false, aliases: ["COMPETICAO", "COMPETIÇÃO", "COMPETIÇÃO/CATEGORIA", "CATEGORIA", "CATEGORY", "COMP"] },
  { key: "DATA NASCIMENTO", label: "Data de nascimento", required: false, aliases: ["DATA NASCIMENTO", "DATA_NASCIMENTO", "DT NASCIMENTO", "DT_NASC"] },
  { key: "SEXO", label: "Sexo / Gênero", required: false, aliases: ["SEXO", "GENERO", "GÊNERO"] },
  { key: "CPF", label: "CPF", required: false, aliases: ["CPF"] },
  { key: "RG", label: "RG", required: false, aliases: ["RG"] },
  { key: "EMAIL", label: "E-mail", required: false, aliases: ["EMAIL", "E-MAIL"] },
  { key: "TELEFONE", label: "Telefone", required: false, aliases: ["TELEFONE", "TEL", "CELULAR"] },
  { key: "TIPO USUARIO", label: "Tipo de usuário", required: false, aliases: ["TIPO USUARIO", "TIPO_USUARIO", "TIPO"] },
  { key: "STATUS DA INSCRIÇÃO", label: "Status da inscrição", required: false, aliases: ["STATUS DA INSCRIÇÃO", "STATUS DA INSCRICAO", "STATUS_INSCRICAO", "STATUS"] },
  { key: "FUNCAO", label: "Função", required: false, aliases: ["FUNCAO", "FUNÇÃO"] },
  { key: "DELEGAÇÃO", label: "Delegação", required: false, aliases: ["DELEGAÇÃO", "DELEGACAO"] },
  { key: "PCD", label: "PCD", required: false, aliases: ["PCD", "DEFICIÊNCIA", "DEFICIENCIA"] },
  { key: "ESFERA", label: "Esfera", required: false, aliases: ["ESFERA"] },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 _/-]/g, " ").replace(/\s+/g, " ");
}

function autoDetect(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of TARGET_FIELDS) {
    const normalizedAliases = field.aliases.map(normalize);
    const match = headers.find((h) => normalizedAliases.includes(normalize(h)));
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

// ─── Component ───────────────────────────────────────────────────────

interface ColumnMappingStepProps {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  onConfirm: (mapping: Record<string, string>) => void;
  onCancel: () => void;
}

export default function ColumnMappingStep({
  headers, sampleRows, onConfirm, onCancel,
}: ColumnMappingStepProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(() => autoDetect(headers));

  const requiredMissing = useMemo(() => {
    return TARGET_FIELDS.filter((f) => f.required && !mapping[f.key]);
  }, [mapping]);

  const canConfirm = requiredMissing.length === 0;

  const handleChange = (targetKey: string, sourceHeader: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (sourceHeader === "__none__") {
        delete next[targetKey];
      } else {
        next[targetKey] = sourceHeader;
      }
      return next;
    });
  };

  const handleReset = () => setMapping(autoDetect(headers));

  // Headers already used by another mapping
  const usedHeaders = new Set(Object.values(mapping));

  // Sample value for a given source header
  const getSample = (sourceHeader: string | undefined) => {
    if (!sourceHeader) return "—";
    for (const row of sampleRows) {
      const val = row[sourceHeader];
      if (val != null && String(val).trim() !== "") return String(val).substring(0, 60);
    }
    return "—";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Columns3 className="h-5 w-5 text-primary" />
          Mapeamento de colunas
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Verifique e ajuste o mapeamento entre as colunas da planilha e os campos do sistema.
          Campos obrigatórios estão marcados com <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-1">obrigatório</Badge>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info */}
        {headers.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {headers.length} coluna(s) detectada(s) na planilha • {sampleRows.length} linha(s) de amostra
          </div>
        )}

        {/* Mapping grid */}
        <div className="space-y-2">
          {TARGET_FIELDS.map((field) => {
            const source = mapping[field.key];
            const isMapped = !!source;
            const isMissing = field.required && !isMapped;

            return (
              <div
                key={field.key}
                className={`grid grid-cols-[1fr_auto_1fr_1fr] gap-3 items-center rounded-lg border p-3 ${
                  isMissing ? "border-destructive/50 bg-destructive/5" : isMapped ? "border-green-200 bg-green-50/30 dark:border-green-900 dark:bg-green-950/10" : ""
                }`}
              >
                {/* Target field */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{field.label}</span>
                  {field.required && (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0">obrigatório</Badge>
                  )}
                </div>

                {/* Arrow */}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />

                {/* Source selector */}
                <Select
                  value={source || "__none__"}
                  onValueChange={(v) => handleChange(field.key, v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecionar coluna…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Não mapear —</SelectItem>
                    {headers.map((h) => {
                      const isUsed = usedHeaders.has(h) && mapping[field.key] !== h;
                      return (
                        <SelectItem key={h} value={h} disabled={isUsed}>
                          {h} {isUsed ? "(já usado)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Sample value */}
                <div className="text-xs text-muted-foreground truncate" title={getSample(source)}>
                  {isMapped ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      {getSample(source)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Validation messages */}
        {requiredMissing.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">
              Campos obrigatórios sem mapeamento: {requiredMissing.map((f) => f.label).join(", ")}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t">
          <Button onClick={() => onConfirm(mapping)} disabled={!canConfirm}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Confirmar mapeamento
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm">
            <RotateCcw className="mr-2 h-4 w-4" /> Autodetectar
          </Button>
          <Button onClick={onCancel} variant="ghost" size="sm">
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
