import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface CsvRow {
  nome: string;
  email: string;
  telefone?: string;
  status: "pending" | "ok" | "error" | "duplicate";
  error?: string;
}

async function callAdminUsers(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export default function ArbitrosImportDialog({ open, onOpenChange, onSuccess }: Props) {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  function parseCsv(text: string): CsvRow[] {
    // Remove BOM se existir
    const cleanText = text.replace(/^\uFEFF/, "");
    
    const lines = cleanText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    // Tenta detectar o separador (vírgula ou ponto-e-vírgula)
    const firstLine = lines[0];
    const separator = firstLine.includes(";") ? ";" : ",";
    
    const normalize = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
    
    const header = lines[0].split(separator).map(h => h.trim().replace(/"/g, ""));
    const nomeIdx = header.findIndex(h => {
      const n = normalize(h);
      return n.includes("nome") || n === "name" || n === "atleta" || n === "arbitro";
    });
    const emailIdx = header.findIndex(h => {
      const n = normalize(h);
      return n.includes("email") || n.includes("mail");
    });
    const telIdx = header.findIndex(h => {
      const n = normalize(h);
      return n.includes("tel") || n.includes("fone") || n.includes("celular") || n === "phone";
    });
    
    if (emailIdx === -1) {
      console.error("Header detectado:", header);
      return [];
    }
    
    return lines.slice(1).map(line => {
      const cols = line.split(separator).map(c => c.trim().replace(/"/g, ""));
      return {
        nome: nomeIdx >= 0 ? cols[nomeIdx] || "" : "",
        email: cols[emailIdx] || "",
        telefone: telIdx >= 0 ? cols[telIdx] || undefined : undefined,
        status: "pending" as const,
      };
    }).filter(r => r.email && r.email.includes("@"));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCsv(ev.target?.result as string);
      if (parsed.length === 0) {
        toast.error("CSV inválido. Verifique se há colunas 'Nome' e 'Email'.");
        return;
      }
      setRows(parsed);
      setDone(false);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    const updated = [...rows];
    
    // Batch in groups of 3 to avoid overloading Edge Functions
    const BATCH_SIZE = 3;
    for (let i = 0; i < updated.length; i += BATCH_SIZE) {
      const batch = updated.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (row, idx) => {
        const globalIdx = i + idx;
        if (row.status === "ok") return;
        try {
          await callAdminUsers("invite_user", {
            email: row.email,
            full_name: row.nome || undefined,
            roles: ["arbitragem"],
          });
          updated[globalIdx] = { ...row, status: "ok" };
        } catch (err: any) {
          const msg: string = err.message || "Erro";
          const isDup = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("existe") || msg.toLowerCase().includes("duplicate");
          updated[globalIdx] = { ...row, status: isDup ? "duplicate" : "error", error: msg };
        }
      });
      await Promise.all(promises);
      setRows([...updated]);
    }

    const ok = updated.filter(r => r.status === "ok").length;
    const dups = updated.filter(r => r.status === "duplicate").length;
    const errs = updated.filter(r => r.status === "error").length;
    toast.success(`Importação: ${ok} convidados, ${dups} duplicados, ${errs} erros`);
    setImporting(false);
    setDone(true);
    onSuccess();
  }

  function handleClose() {
    setRows([]);
    setDone(false);
    onOpenChange(false);
  }

  const statusIcon = (status?: string) => {
    if (status === "ok") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "error") return <XCircle className="h-4 w-4 text-destructive" />;
    if (status === "duplicate") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <span className="inline-block h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Árbitros via CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              CSV com colunas: <strong>Nome</strong>, <strong>Email</strong>, Telefone (opcional)
            </p>
            <p className="text-xs text-muted-foreground">Separador vírgula ou ponto-e-vírgula • Codificação UTF-8</p>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Selecionar arquivo .csv
                <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </label>
            </Button>
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span><strong className="text-foreground">{rows.length}</strong> árbitros no arquivo</span>
                {done && (
                  <div className="flex gap-2">
                    <Badge variant="success">{rows.filter(r => r.status === "ok").length} convidados</Badge>
                    {rows.filter(r => r.status === "duplicate").length > 0 && (
                      <Badge variant="warning">{rows.filter(r => r.status === "duplicate").length} já existiam</Badge>
                    )}
                    {rows.filter(r => r.status === "error").length > 0 && (
                      <Badge variant="destructive">{rows.filter(r => r.status === "error").length} erros</Badge>
                    )}
                  </div>
                )}
              </div>
              <ScrollArea className="h-60 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow
                        key={i}
                        className={
                          r.status === "error" ? "bg-destructive/5" :
                          r.status === "ok" ? "bg-green-500/5" : ""
                        }
                      >
                        <TableCell>{statusIcon(r.status)}</TableCell>
                        <TableCell className="font-medium">{r.nome || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.email}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.telefone || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
          {rows.length > 0 && !done && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importando..." : `Importar ${rows.length} árbitros`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
