import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  onSuccess?: () => void;
}

interface CsvRow {
  escola: string;
  nome_chefe: string;
  telefone: string;
  email: string;
}

interface MatchedRow {
  csvRow: CsvRow;
  delegationId: string | null;
  institutionNameFound: string | null;
}

type Step = "paste" | "preview" | "result";

/** Normaliza um nome de escola para comparação: trim, lowercase, espaços múltiplos → único */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Faz parse do CSV colado (separado por ponto e vírgula). Retorna as linhas válidas. */
function parseCsv(raw: string): CsvRow[] {
  const lines = raw.split(/\r?\n/);
  const rows: CsvRow[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cols = trimmed.split(";");
    const escola = (cols[0] ?? "").trim();
    // Pula a linha de cabeçalho
    if (escola.toLowerCase() === "escola") continue;
    if (!escola) continue;
    rows.push({
      escola,
      nome_chefe: (cols[1] ?? "").trim(),
      telefone: (cols[2] ?? "").trim(),
      email: (cols[3] ?? "").trim(),
    });
  }
  return rows;
}

export default function ImportarChefesDialog({ open, onOpenChange, eventId, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("paste");
  const [csvText, setCsvText] = useState("");
  const [matched, setMatched] = useState<MatchedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [resultSuccess, setResultSuccess] = useState(0);
  const [resultErrors, setResultErrors] = useState<string[]>([]);

  // Carrega todas as delegações do evento com o nome da institution
  const { data: delegations = [], isLoading: loadingDelegations } = useQuery({
    queryKey: ["delegacoes-import", eventId],
    enabled: open && !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("delegations")
        .select("id, institutions!inner(name)")
        .eq("event_id", eventId)
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; institutions: { name: string } }>;
    },
  });

  const handleClose = (v: boolean) => {
    if (!v) {
      // Reseta estado ao fechar
      setStep("paste");
      setCsvText("");
      setMatched([]);
      setResultSuccess(0);
      setResultErrors([]);
    }
    onOpenChange(v);
  };

  const handleProcessar = () => {
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      toast.error("Nenhuma linha válida encontrada no CSV.");
      return;
    }

    // Monta mapa de institution name → delegation id (normalizado)
    const exactMap = new Map<string, { id: string; name: string }>();
    for (const d of delegations) {
      const key = normalize(d.institutions.name);
      exactMap.set(key, { id: d.id, name: d.institutions.name });
    }

    const result: MatchedRow[] = rows.map((row) => {
      const key = normalize(row.escola);
      // Correspondência exata primeiro
      const exact = exactMap.get(key);
      if (exact) {
        return { csvRow: row, delegationId: exact.id, institutionNameFound: exact.name };
      }
      // Fallback: includes
      let found: { id: string; name: string } | null = null;
      for (const [normName, val] of exactMap.entries()) {
        if (normName.includes(key) || key.includes(normName)) {
          found = val;
          break;
        }
      }
      return {
        csvRow: row,
        delegationId: found?.id ?? null,
        institutionNameFound: found?.name ?? null,
      };
    });

    setMatched(result);
    setStep("preview");
  };

  const handleImportar = async () => {
    setImporting(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const row of matched) {
      if (!row.delegationId) continue;
      const { error } = await (supabase as any)
        .from("delegations")
        .update({
          chief_name: row.csvRow.nome_chefe || null,
          chief_phone: row.csvRow.telefone || null,
          chief_email: row.csvRow.email || null,
        })
        .eq("id", row.delegationId);

      if (error) {
        errors.push(`${row.institutionNameFound ?? row.csvRow.escola}: ${error.message}`);
      } else {
        successCount++;
      }
    }

    setResultSuccess(successCount);
    setResultErrors(errors);
    setStep("result");
    setImporting(false);

    if (successCount > 0) {
      onSuccess?.();
    }
  };

  const foundRows = matched.filter((r) => r.delegationId !== null);
  const notFoundRows = matched.filter((r) => r.delegationId === null);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar Chefes de Delegação
          </DialogTitle>
          <DialogDescription>
            {step === "paste" && "Cole os dados no formato CSV (separado por ponto e vírgula) para atualizar em massa os chefes de delegação."}
            {step === "preview" && "Confira as correspondências encontradas antes de importar."}
            {step === "result" && "Resultado da importação."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* ── PASSO 1: Colar CSV ── */}
          {step === "paste" && (
            <div className="space-y-4">
              {loadingDelegations ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium mb-1">Formato esperado (separado por <code className="text-xs bg-muted px-1 py-0.5 rounded">;</code>):</p>
                    <code className="block text-xs bg-muted rounded px-3 py-2 text-muted-foreground">
                      escola;nome_chefe;telefone;email
                    </code>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Exemplo:</p>
                    <code className="block text-xs bg-muted rounded px-3 py-2 text-muted-foreground">
                      CEM DOM PEDRO II;Maria Silva;(95) 99999-1234;maria@escola.edu.br
                    </code>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• A coluna <strong>email</strong> é opcional (pode deixar em branco).</p>
                    <p>• A linha de cabeçalho (<code>escola;nome_chefe;telefone;email</code>) é ignorada automaticamente.</p>
                    <p>• O sistema tentará localizar a escola pelo nome (comparação sem distinção de maiúsculas/minúsculas).</p>
                  </div>
                  <Textarea
                    placeholder={"escola;nome_chefe;telefone;email\nCEM DOM PEDRO II;Maria Silva;(95) 99999-1234;maria@escola.edu.br"}
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    className="min-h-[200px] font-mono text-xs"
                  />
                </>
              )}
            </div>
          )}

          {/* ── PASSO 2: Preview ── */}
          {step === "preview" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {foundRows.length} encontrada{foundRows.length !== 1 ? "s" : ""}
                </Badge>
                {notFoundRows.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {notFoundRows.length} não encontrada{notFoundRows.length !== 1 ? "s" : ""}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {matched.length} linha{matched.length !== 1 ? "s" : ""} processada{matched.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Escola (CSV)</TableHead>
                      <TableHead className="text-xs">Escola encontrada</TableHead>
                      <TableHead className="text-xs">Chefe</TableHead>
                      <TableHead className="text-xs">Telefone</TableHead>
                      <TableHead className="text-xs">E-mail</TableHead>
                      <TableHead className="text-xs w-[90px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matched.map((row, i) => (
                      <TableRow key={i} className={row.delegationId ? "" : "bg-destructive/5"}>
                        <TableCell className="text-xs font-medium max-w-[140px] truncate" title={row.csvRow.escola}>
                          {row.csvRow.escola}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate" title={row.institutionNameFound ?? ""}>
                          {row.institutionNameFound ?? <span className="text-destructive italic">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">{row.csvRow.nome_chefe || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs">{row.csvRow.telefone || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate" title={row.csvRow.email}>
                          {row.csvRow.email || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {row.delegationId ? (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Encontrada
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Não encontrada
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {notFoundRows.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  As linhas marcadas como "Não encontrada" serão ignoradas na importação.
                </p>
              )}
            </div>
          )}

          {/* ── PASSO 3: Resultado ── */}
          {step === "result" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                {resultSuccess > 0 ? (
                  <>
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                    <div>
                      <p className="font-semibold text-lg">
                        {resultSuccess} delegaç{resultSuccess === 1 ? "ão atualizada" : "ões atualizadas"} com sucesso!
                      </p>
                      {resultErrors.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {resultErrors.length} erro{resultErrors.length !== 1 ? "s" : ""} ocorreu durante a importação.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <p className="font-semibold text-lg text-destructive">Nenhuma delegação foi atualizada.</p>
                  </>
                )}
              </div>

              {resultErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-destructive mb-1">Erros:</p>
                  {resultErrors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between gap-2">
          {step === "paste" && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleProcessar}
                disabled={!csvText.trim() || loadingDelegations}
              >
                Processar
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("paste")}>
                Voltar
              </Button>
              <Button
                onClick={handleImportar}
                disabled={foundRows.length === 0 || importing}
              >
                {importing ? "Importando..." : `Importar ${foundRows.length} delegaç${foundRows.length === 1 ? "ão" : "ões"}`}
              </Button>
            </>
          )}

          {step === "result" && (
            <Button className="ml-auto" onClick={() => handleClose(false)}>
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
