import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, CheckCircle, XCircle, AlertTriangle, Loader2, Download, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface EventualRow {
  full_name: string;
  involvement_type: string;
  document_id?: string;
  organization?: string;
  authorized_by?: string;
  notes?: string;
  status: "pending" | "ok" | "error" | "duplicate";
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventId: string;
  onSuccess: () => void;
}

const TYPE_MAP: Record<string, string> = {
  "prestador": "prestador",
  "prestador de serviço": "prestador",
  "acompanhante": "acompanhante",
  "visitante": "visitante",
  "visitante autorizado": "visitante",
  "outro": "outro",
};

export default function EventuaisImportDialog({ open, onOpenChange, eventId, onSuccess }: Props) {
  const [rows, setRows] = useState<EventualRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      ok: rows.filter(r => r.status === "ok").length,
      duplicate: rows.filter(r => r.status === "duplicate").length,
      error: rows.filter(r => r.status === "error").length,
      pending: rows.filter(r => r.status === "pending").length,
    };
  }, [rows]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setRows([]);
    setDone(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          setFileError("O arquivo está vazio.");
          return;
        }

        // Validação de colunas obrigatórias
        const firstRow = data[0];
        const keys = Object.keys(firstRow).map(k => k.toLowerCase().trim());
        const hasName = keys.some(k => ["nome", "full_name", "nome completo"].includes(k));
        const hasType = keys.some(k => ["tipo", "involvement_type", "tipo de envolvimento"].includes(k));

        if (!hasName || !hasType) {
          setFileError("Colunas obrigatórias ausentes. O arquivo deve conter 'Nome' e 'Tipo'.");
          return;
        }

        const parsed: EventualRow[] = data.map((row) => {
          const r: any = {};
          Object.keys(row).forEach(k => r[k.toLowerCase().trim()] = row[k]);

          const name = r.nome || r.full_name || r["nome completo"] || "";
          let typeStr = String(r.tipo || r.involvement_type || r["tipo de envolvimento"] || "").toLowerCase().trim();
          const type = TYPE_MAP[typeStr] || "outro";

          return {
            full_name: String(name).trim(),
            involvement_type: type,
            document_id: r.documento || r.document_id || r.cpf || r.rg ? String(r.documento || r.document_id || r.cpf || r.rg).trim() : undefined,
            organization: r.empresa || r.organizacao || r.organization ? String(r.empresa || r.organizacao || r.organization).trim() : "",
            authorized_by: r.autorizado_por || r.authorized_by ? String(r.autorizado_por || r.authorized_by).trim() : "",
            notes: r.notas || r.observacoes || r.notes ? String(r.notas || r.observacoes || r.notes).trim() : "",
            status: "pending" as const,
          };
        }).filter(r => r.full_name);

        setRows(parsed);
      } catch (err) {
        setFileError("Erro ao ler o arquivo Excel. Certifique-se de que é um arquivo .xlsx válido.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    const updated = [...rows];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (row.status === "ok") continue;

      try {
        // Busca por duplicidade: Prioriza Documento (se existir), senão usa Nome
        let query = supabase
          .from("service_eventual_people")
          .select("id")
          .eq("event_id", eventId);

        if (row.document_id) {
          query = query.eq("document_id", row.document_id);
        } else {
          query = query.eq("full_name", row.full_name);
        }

        const { data: existing, error: queryErr } = await query.maybeSingle();
        if (queryErr) throw queryErr;

        if (existing) {
          updated[i] = { ...row, status: "duplicate" };
        } else {
          const { error } = await supabase.from("service_eventual_people").insert({
            event_id: eventId,
            full_name: row.full_name,
            involvement_type: row.involvement_type,
            document_id: row.document_id || null,
            organization: row.organization || null,
            authorized_by: row.authorized_by || null,
            notes: row.notes || null,
          });

          if (error) throw error;
          updated[i] = { ...row, status: "ok" };
        }
      } catch (err: any) {
        updated[i] = { ...row, status: "error", error: err.message };
      }
      setRows([...updated]);
    }

    setImporting(false);
    setDone(true);
    onSuccess();
    toast.success("Processamento concluído");
  }

  function exportErrors() {
    const errorRows = rows.filter(r => r.status === "error" || r.status === "duplicate");
    if (errorRows.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(errorRows.map(r => ({
      Nome: r.full_name,
      Tipo: r.involvement_type,
      Documento: r.document_id || "",
      Status: r.status === "duplicate" ? "Duplicado" : "Erro",
      Motivo: r.error || (r.status === "duplicate" ? "Já cadastrado no evento" : "")
    })));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Falhas de Importação");
    XLSX.writeFile(wb, `falhas_importacao_eventuais_${new Date().getTime()}.xlsx`);
  }

  function handleClose() {
    if (importing) return;
    setRows([]);
    setDone(false);
    setFileError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Pessoas Eventuais</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className={`rounded-lg border border-dashed p-6 text-center space-y-2 ${fileError ? 'border-destructive bg-destructive/5' : ''}`}>
            {fileError ? (
              <div className="flex flex-col items-center gap-2 text-destructive mb-2">
                <AlertCircle className="h-8 w-8" />
                <p className="font-semibold">{fileError}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um arquivo Excel (.xlsx) com as colunas: <br/>
                <strong className="text-foreground">Nome</strong>, <strong className="text-foreground">Tipo</strong>, Documento, Organização, Autorizado Por, Notas
              </p>
            )}
            <Button variant={fileError ? "destructive" : "outline"} asChild disabled={importing}>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                {fileError ? "Tentar outro arquivo" : "Selecionar Excel"}
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              </label>
            </Button>
          </div>

          {rows.length > 0 && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <CardStats label="Total" value={stats.total} />
                <CardStats label="Sucesso" value={stats.ok} color="text-green-600" />
                <CardStats label="Duplicados" value={stats.duplicate} color="text-amber-600" />
                <CardStats label="Erros" value={stats.error} color="text-destructive" />
              </div>

              <ScrollArea className="flex-1 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {r.status === "ok" && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                          {r.status === "duplicate" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                          {r.status === "pending" && <div className="h-2 w-2 rounded-full bg-slate-300 animate-pulse" />}
                        </TableCell>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell><Badge variant="outline">{r.involvement_type}</Badge></TableCell>
                        <TableCell className="text-sm">{r.document_id || "—"}</TableCell>
                        <TableCell>
                          {r.status === "duplicate" && <span className="text-xs text-amber-600 font-medium">Já cadastrado</span>}
                          {r.status === "error" && <span className="text-xs text-destructive font-medium truncate max-w-[150px]" title={r.error}>Erro</span>}
                          {r.status === "ok" && <span className="text-xs text-green-600 font-medium">Ok</span>}
                          {r.status === "pending" && <span className="text-xs text-slate-400 font-medium">Aguardando</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="mt-4 flex justify-between items-center sm:justify-between">
          <div>
            {done && (stats.error > 0 || stats.duplicate > 0) && (
              <Button variant="ghost" size="sm" onClick={exportErrors} className="text-amber-700">
                <Download className="h-4 w-4 mr-2" /> Exportar falhas
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Fechar</Button>
            {rows.length > 0 && !done && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Importar {rows.length} registros
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardStats({ label, value, color = "" }: { label: string; value: number; color?: string }) {
  return (
    <div className="p-3 border rounded-lg bg-slate-50/50 text-center">
      <p className="text-[10px] uppercase font-bold text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
