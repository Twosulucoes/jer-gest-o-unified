import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight, Info, Download, RefreshCw } from "lucide-react";
import {
  parseRefereeCsv,
  type RefereeImportRow,
  FIELD_LABELS,
  ALL_FIELD_KEYS,
  type FieldKey,
} from "./refereeImport";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

interface BatchResult {
  index: number;
  email: string;
  status: "created" | "updated" | "linked_existing" | "duplicate" | "error";
  reason?: string;
  user_id?: string;
  person_id?: string | null;
  had_bank_data: boolean;
}

interface BatchResponse {
  ok: true;
  summary: {
    total: number;
    created: number;
    linked_existing: number;
    updated: number;
    duplicate: number;
    error: number;
    with_bank_data: number;
  };
  results: BatchResult[];
}

async function callImportReferees(rows: any[]): Promise<BatchResponse> {
  const { data, error } = await supabase.functions.invoke("import-referees", {
    body: { rows },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as BatchResponse;
}

export default function ArbitrosImportDialog({ open, onOpenChange, onSuccess }: Props) {
  const [rows, setRows] = useState<RefereeImportRow[]>([]);
  const [unrecognized, setUnrecognized] = useState<string[]>([]);
  const [recognizedCount, setRecognizedCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());

  const stats = useMemo(() => {
    const total = rows.length;
    const withErr = rows.filter((r) => r.validationErrors.length > 0).length;
    const ok = rows.filter((r) => r.status === "ok").length;
    const dup = rows.filter((r) => r.status === "duplicate").length;
    const failed = rows.filter((r) => r.status === "error").length;
    const importable = rows.filter((r) => r.validationErrors.length === 0).length;
    return { total, withErr, ok, dup, failed, importable };
  }, [rows]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = parseRefereeCsv(ev.target?.result as string);
      if (result.fatalError) {
        toast.error(result.fatalError);
        return;
      }
      if (result.rows.length === 0) {
        toast.error("Nenhuma linha válida encontrada no CSV.");
        return;
      }
      setRows(result.rows);
      setUnrecognized(result.unrecognizedHeaders);
      setRecognizedCount(result.recognizedColumns.length);
      setDone(false);
      setExpandedIdx(new Set());
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  async function importRowsMatching(
    predicate: (r: RefereeImportRow) => boolean,
    contextLabel: string,
  ) {
    if (rows.length === 0) return;
    setImporting(true);

    const updated = [...rows];
    const payload: { row: RefereeImportRow; originalIndex: number }[] = [];
    updated.forEach((r, i) => {
      if (!predicate(r)) return;
      payload.push({ row: r, originalIndex: i });
    });

    if (payload.length === 0) {
      toast.error(`Nenhuma linha aplicável para ${contextLabel}.`);
      setImporting(false);
      return;
    }

    try {
      const response = await callImportReferees(
        payload.map(({ row }) => ({
          full_name: row.full_name,
          email: row.email,
          cpf: row.cpf,
          rne: row.rne,
          rg: row.rg,
          phone: row.phone,
          birth_date: row.birth_date,
          gender: row.gender,
          nationality: row.nationality,
          zip_code: row.zip_code,
          street_address: row.street_address,
          address_complement: row.address_complement,
          neighborhood: row.neighborhood,
          city: row.city,
          state: row.state,
          bank_name: row.bank_name,
          bank_branch: row.bank_branch,
          bank_account: row.bank_account,
          modalities: row.modalities,
          categories: row.categories,
        })),
      );

      response.results.forEach((res) => {
        const originalIndex = payload[res.index].originalIndex;
        const target = updated[originalIndex];
        if (res.status === "created" || res.status === "linked_existing" || res.status === "updated") {
          updated[originalIndex] = { ...target, status: "ok", errorMessage: undefined };
        } else if (res.status === "duplicate") {
          updated[originalIndex] = { ...target, status: "duplicate", errorMessage: res.reason };
        } else {
          updated[originalIndex] = { ...target, status: "error", errorMessage: res.reason };
        }
      });
      setRows(updated);

      const s = response.summary;
      const parts = [
        `${s.created} novos`,
        `${s.linked_existing} reativados`,
        `${s.duplicate} duplicados`,
        `${s.error} erros`,
      ];
      const skipped = updated.filter((r) => r.validationErrors.length > 0).length;
      if (skipped > 0) parts.push(`${skipped} ignorados (validação)`);
      toast.success(`${contextLabel}: ${parts.join(", ")}`);
    } catch (err: any) {
      toast.error(`Falha geral em ${contextLabel}: ${err.message ?? "Erro desconhecido"}`);
    }

    setImporting(false);
    setDone(true);
    onSuccess();
  }

  async function handleImport() {
    await importRowsMatching(
      (r) => r.status !== "ok" && r.validationErrors.length === 0,
      "Importação",
    );
  }

  async function handleRetryFailed() {
    await importRowsMatching(
      (r) => r.status === "error" && r.validationErrors.length === 0,
      "Re-tentativa",
    );
  }

  function handleDownloadErrors() {
    const failingRows = rows.filter(
      (r) => r.validationErrors.length > 0 || r.status === "error" || r.status === "duplicate",
    );
    if (failingRows.length === 0) {
      toast.info("Nada a baixar — sem erros.");
      return;
    }
    const csv = buildErrorsCsv(failingRows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `erros-importacao-arbitros_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`CSV gerado com ${failingRows.length} linha(s).`);
  }

  function handleClose() {
    setRows([]);
    setUnrecognized([]);
    setRecognizedCount(0);
    setDone(false);
    setExpandedIdx(new Set());
    onOpenChange(false);
  }

  function toggleExpand(i: number) {
    const next = new Set(expandedIdx);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setExpandedIdx(next);
  }

  const statusIcon = (status: RefereeImportRow["status"], hasErr: boolean) => {
    if (status === "ok") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === "duplicate") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    if (hasErr) return <XCircle className="h-4 w-4 text-destructive" />;
    return <span className="inline-block h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Árbitros via CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden flex-1 flex flex-col">
          {/* Upload area */}
          <div className="rounded-lg border border-dashed border-border p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Colunas reconhecidas: <strong>Nome</strong>, <strong>Email</strong> (obrigatório), CPF, RNE, RG, Celular, Sexo, Data Nascimento, Nacionalidade, CEP, Endereço, Complemento, Bairro, Cidade, UF, Banco, Agência, Conta, Modalidades, Categorias.
            </p>
            <p className="text-xs text-muted-foreground">
              Separador vírgula ou ponto-e-vírgula • UTF-8 • Datas em <code>dd/mm/aaaa</code> ou ISO • Modalidades/Categorias separadas por <code>;</code> ou <code>,</code>
            </p>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Selecionar arquivo .csv
                <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </label>
            </Button>
          </div>

          {/* Importação canônica (Etapa 2.3): popula referee_profiles completo + vincula people por CPF */}
          {rows.length > 0 && (
            <div className="rounded-md border border-emerald-300/60 bg-emerald-50 dark:border-emerald-700/40 dark:bg-emerald-950/20 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>
                  <strong>Importação canônica:</strong> envia todos os 20 campos ao backend.
                </p>
                <p>
                  Pessoa unificada (people) é localizada/criada por CPF; árbitros estrangeiros (só RNE) ficam sem vínculo a `people` por enquanto. Convite de e-mail é enviado automaticamente para novos usuários.
                </p>
              </div>
            </div>
          )}

          {/* Headers não reconhecidos */}
          {unrecognized.length > 0 && (
            <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs">
              <p className="font-medium mb-1">{recognizedCount} coluna(s) reconhecida(s).</p>
              <p className="text-muted-foreground">
                Ignoradas (cabeçalho não reconhecido): {unrecognized.join(", ")}
              </p>
            </div>
          )}

          {/* Stats / KPIs */}
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  <strong>{stats.total}</strong> linhas
                </span>
                {stats.importable > 0 && (
                  <Badge variant="outline">{stats.importable} válidas</Badge>
                )}
                {stats.withErr > 0 && (
                  <Badge variant="destructive">{stats.withErr} com erro</Badge>
                )}
                {done && (
                  <>
                    <Badge variant="success">{stats.ok} convidados</Badge>
                    {stats.dup > 0 && <Badge variant="warning">{stats.dup} duplicados</Badge>}
                    {stats.failed > 0 && (
                      <Badge variant="destructive">{stats.failed} falharam</Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tabela de preview */}
          {rows.length > 0 && (
            <ScrollArea className="flex-1 rounded-md border min-h-[200px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead className="w-8" />
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>CPF / RNE</TableHead>
                    <TableHead>Modalidades</TableHead>
                    <TableHead>Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const hasErr = r.validationErrors.length > 0;
                    const expanded = expandedIdx.has(i);
                    return (
                      <RowFragment
                        key={i}
                        index={i}
                        row={r}
                        hasErr={hasErr}
                        expanded={expanded}
                        statusIcon={statusIcon(r.status, hasErr)}
                        onToggle={() => toggleExpand(i)}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>

          {/* Download de erros (disponível assim que houver linhas com algum tipo de problema) */}
          {(stats.withErr > 0 || (done && (stats.failed > 0 || stats.dup > 0))) && (
            <Button variant="outline" onClick={handleDownloadErrors} disabled={importing}>
              <Download className="h-4 w-4 mr-2" />
              Baixar CSV de erros (
              {rows.filter(
                (r) =>
                  r.validationErrors.length > 0 ||
                  r.status === "error" ||
                  r.status === "duplicate",
              ).length}
              )
            </Button>
          )}

          {/* Retry só de falhas (após primeira importação) */}
          {done && stats.failed > 0 && (
            <Button variant="outline" onClick={handleRetryFailed} disabled={importing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${importing ? "animate-spin" : ""}`} />
              Tentar novamente {stats.failed} falha{stats.failed > 1 ? "s" : ""}
            </Button>
          )}

          {/* Importação inicial */}
          {rows.length > 0 && !done && (
            <Button onClick={handleImport} disabled={importing || stats.importable === 0}>
              {importing
                ? "Importando..."
                : stats.importable === 0
                ? "Nenhuma linha válida"
                : `Importar ${stats.importable} válidas`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------
// Linha + detalhe expandido
// ------------------------------------------------------------

interface RowFragmentProps {
  index: number;
  row: RefereeImportRow;
  hasErr: boolean;
  expanded: boolean;
  statusIcon: React.ReactNode;
  onToggle: () => void;
}

function RowFragment({ row, hasErr, expanded, statusIcon, onToggle }: RowFragmentProps) {
  const cpfOrRne = row.cpf || (row.rne ? `RNE ${row.rne}` : "—");

  return (
    <>
      <TableRow
        className={
          row.status === "error"
            ? "bg-destructive/5"
            : row.status === "ok"
            ? "bg-green-500/5"
            : hasErr
            ? "bg-destructive/5"
            : ""
        }
      >
        <TableCell>
          <button
            type="button"
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground"
            aria-label={expanded ? "Recolher" : "Expandir"}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </TableCell>
        <TableCell>{statusIcon}</TableCell>
        <TableCell className="font-medium">{row.full_name || "—"}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{row.email}</TableCell>
        <TableCell className="text-xs">{cpfOrRne}</TableCell>
        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
          {row.modalities || "—"}
        </TableCell>
        <TableCell className="text-xs">
          {hasErr ? (
            <span className="text-destructive">{row.validationErrors.join("; ")}</span>
          ) : row.errorMessage ? (
            <span className="text-destructive">{row.errorMessage}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={7} className="p-0">
            <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {ALL_FIELD_KEYS.map((k) => {
                // Não exibir dados bancários explicitamente em linha; mostrar só "preenchido / vazio".
                const isBank = k === "bank_name" || k === "bank_branch" || k === "bank_account";
                const value = row[k];
                const display = isBank
                  ? value
                    ? "(preenchido)"
                    : "—"
                  : value || "—";
                return (
                  <div key={k}>
                    <span className="text-muted-foreground">{FIELD_LABELS[k]}:</span>{" "}
                    <span className="font-medium">{display}</span>
                  </div>
                );
              })}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ------------------------------------------------------------
// CSV de erros — mesma forma da planilha de origem + coluna Motivo
// ------------------------------------------------------------

// Ordem das colunas no CSV de erros corresponde à planilha-fonte.
const ERROR_CSV_COLUMNS: { key: FieldKey; header: string }[] = [
  { key: "full_name", header: "Nome" },
  { key: "cpf", header: "CPF" },
  { key: "modalities", header: "Modalidades" },
  { key: "categories", header: "Categorias" },
  { key: "phone", header: "Celular" },
  { key: "rg", header: "RG" },
  { key: "email", header: "Email" },
  { key: "rne", header: "RNE" },
  { key: "gender", header: "Sexo" },
  { key: "birth_date", header: "Data Nascimento" },
  { key: "zip_code", header: "CEP" },
  { key: "street_address", header: "Endereço" },
  { key: "address_complement", header: "Complemento" },
  { key: "neighborhood", header: "Bairro" },
  { key: "city", header: "Cidade" },
  { key: "state", header: "UF" },
  { key: "bank_name", header: "Banco" },
  { key: "bank_branch", header: "Agência" },
  { key: "bank_account", header: "Conta Corrente" },
  { key: "nationality", header: "Nacionalidade" },
];

function csvEscape(value: unknown, sep: string): string {
  const s = value == null ? "" : String(value);
  if (s.includes(sep) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function reasonOf(row: RefereeImportRow): string {
  if (row.validationErrors.length > 0) return row.validationErrors.join("; ");
  if (row.errorMessage) return row.errorMessage;
  if (row.status === "duplicate") return "Já cadastrado";
  return "";
}

function buildErrorsCsv(rows: RefereeImportRow[]): string {
  // Separador `;` para abrir bem em Excel BR sem precisar de "Importar dados".
  const sep = ";";
  const headers = [...ERROR_CSV_COLUMNS.map((c) => c.header), "Motivo"];
  const lines: string[] = [headers.map((h) => csvEscape(h, sep)).join(sep)];

  for (const row of rows) {
    const cols = ERROR_CSV_COLUMNS.map((c) => csvEscape(row[c.key], sep));
    cols.push(csvEscape(reasonOf(row), sep));
    lines.push(cols.join(sep));
  }
  return lines.join("\r\n");
}
