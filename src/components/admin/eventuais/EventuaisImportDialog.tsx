import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
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
};

export default function EventuaisImportDialog({ open, onOpenChange, eventId, onSuccess }: Props) {
  const [rows, setRows] = useState<EventualRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast.error("O arquivo está vazio.");
          return;
        }

        const parsed: EventualRow[] = data.map((row) => {
          // Normaliza chaves para minúsculo
          const r: any = {};
          Object.keys(row).forEach(k => r[k.toLowerCase().trim()] = row[k]);

          const name = r.nome || r.full_name || r["nome completo"] || "";
          let type = r.tipo || r.involvement_type || r["tipo de envolvimento"] || "prestador";
          type = TYPE_MAP[type.toLowerCase().trim()] || "prestador";

          return {
            full_name: name,
            involvement_type: type,
            document_id: String(r.documento || r.document_id || r.cpf || r.rg || ""),
            organization: r.empresa || r.organizacao || r.organization || "",
            authorized_by: r.autorizado_por || r.authorized_by || "",
            notes: r.notas || r.observacoes || r.notes || "",
            status: "pending" as const,
          };
        }).filter(r => r.full_name);

        setRows(parsed);
        setDone(false);
      } catch (err) {
        toast.error("Erro ao ler o arquivo Excel.");
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
        // Verifica duplicidade básica por nome no evento
        const { data: existing } = await supabase
          .from("service_eventual_people")
          .select("id")
          .eq("event_id", eventId)
          .eq("full_name", row.full_name)
          .maybeSingle();

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

  function handleClose() {
    if (importing) return;
    setRows([]);
    setDone(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Pessoas Eventuais</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Selecione um arquivo Excel (.xlsx) com as colunas: <br/>
              <strong>Nome</strong>, <strong>Tipo</strong>, Documento, Organização, Autorizado Por, Notas
            </p>
            <Button variant="outline" asChild disabled={importing}>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Selecionar Excel
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              </label>
            </Button>
          </div>

          {rows.length > 0 && (
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Organização</TableHead>
                    <TableHead>Documento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {r.status === "ok" && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" title={r.error} />}
                        {r.status === "duplicate" && <AlertTriangle className="h-4 w-4 text-amber-500" title="Já cadastrado" />}
                        {r.status === "pending" && <div className="h-2 w-2 rounded-full bg-slate-300 animate-pulse" />}
                      </TableCell>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell><Badge variant="outline">{r.involvement_type}</Badge></TableCell>
                      <TableCell className="text-sm">{r.organization || "—"}</TableCell>
                      <TableCell className="text-sm">{r.document_id || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
          {rows.length > 0 && !done && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Importar {rows.length} registros
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
