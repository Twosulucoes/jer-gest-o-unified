import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";
import {
  parseRefereeCsv,
  type RefereeImportRow,
  FIELD_LABELS,
  ALL_FIELD_KEYS,
} from "./refereeImport";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

async function callAdminUsers(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
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

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    const updated = [...rows];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (row.status === "ok") continue;
      // Pula linhas com erro de validação client-side
      if (row.validationErrors.length > 0) continue;

      try {
        await callAdminUsers("invite_user", {
          email: row.email,
          full_name: row.full_name || undefined,
          roles: ["arbitragem"],
          phone: row.phone || undefined,
        });
        updated[i] = { ...row, status: "ok" };
      } catch (err: any) {
        const msg: string = err.message || "Erro";
        const isDup =
          msg.toLowerCase().includes("already") ||
          msg.toLowerCase().includes("existe") ||
          msg.toLowerCase().includes("duplicate");
        updated[i] = { ...row, status: isDup ? "duplicate" : "error", errorMessage: msg };
      }
      setRows([...updated]);
    }

    const ok = updated.filter((r) => r.status === "ok").length;
    const dups = updated.filter((r) => r.status === "duplicate").length;
    const errs = updated.filter((r) => r.status === "error").length;
    const skipped = updated.filter((r) => r.validationErrors.length > 0).length;

    const parts = [`${ok} convidados`, `${dups} duplicados`, `${errs} erros`];
    if (skipped > 0) parts.push(`${skipped} ignorados (validação)`);
    toast.success(`Importação: ${parts.join(", ")}`);

    setImporting(false);
    setDone(true);
    onSuccess();
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

          {/* Disclosure de envio parcial (Etapa 2.2 valida tudo, 2.3 enviará tudo ao backend) */}
          {rows.length > 0 && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p>
                  <strong>Versão atual (Etapa 2.2):</strong> envia apenas <strong>Nome</strong>, <strong>E-mail</strong> e <strong>Telefone</strong> ao backend.
                </p>
                <p>
                  Os demais campos (CPF, modalidades, endereço, banco etc.) são validados aqui e serão integrados na Etapa 2.3 (importação canônica com vínculo a Pessoas).
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

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
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
