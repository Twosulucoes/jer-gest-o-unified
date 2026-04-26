import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { ESCALA_COLUMNS, type EscalaColumnKey } from "./escalaExport";

const REQUIRED: EscalaColumnKey[] = ["official_name", "role_label"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rowCount: number;
  onConfirm: (format: "csv" | "pdf", selected: EscalaColumnKey[]) => Promise<void> | void;
}

export function ExportColumnsDialog({ open, onOpenChange, rowCount, onConfirm }: Props) {
  const [selected, setSelected] = useState<Set<EscalaColumnKey>>(
    new Set(ESCALA_COLUMNS.map((c) => c.key as EscalaColumnKey)),
  );
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(new Set(ESCALA_COLUMNS.map((c) => c.key as EscalaColumnKey)));
      setBusy(null);
    }
  }, [open]);

  const toggle = (key: EscalaColumnKey) => {
    if (REQUIRED.includes(key)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(ESCALA_COLUMNS.map((c) => c.key as EscalaColumnKey)));
  const clearAll = () => setSelected(new Set(REQUIRED));

  const run = async (fmt: "csv" | "pdf") => {
    setBusy(fmt);
    try {
      const ordered = ESCALA_COLUMNS
        .map((c) => c.key as EscalaColumnKey)
        .filter((k) => selected.has(k));
      await onConfirm(fmt, ordered);
    } finally {
      setBusy(null);
    }
  };

  const totalSelected = selected.size;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar exportação</DialogTitle>
          <DialogDescription>
            Selecione as colunas que devem aparecer no arquivo gerado. Os filtros atuais da tela
            também serão aplicados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            <Badge variant="secondary" className="mr-2">{rowCount}</Badge>
            linha(s) a exportar
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>Tudo</Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>Mínimo</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
          {ESCALA_COLUMNS.map((c) => {
            const key = c.key as EscalaColumnKey;
            const isRequired = REQUIRED.includes(key);
            const checked = selected.has(key);
            return (
              <label
                key={key}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors ${
                  checked ? "bg-secondary/40" : ""
                } ${isRequired ? "opacity-80 cursor-not-allowed" : "cursor-pointer hover:bg-secondary/30"}`}
              >
                <Checkbox
                  checked={checked}
                  disabled={isRequired}
                  onCheckedChange={() => toggle(key)}
                />
                <span className="flex-1 truncate">{c.label}</span>
                {isRequired && (
                  <Badge variant="outline" className="text-[10px]">obrigatória</Badge>
                )}
              </label>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={!!busy}
            className="sm:mr-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={() => run("csv")}
            disabled={!!busy || totalSelected === 0 || rowCount === 0}
          >
            {busy === "csv"
              ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              : <FileSpreadsheet className="mr-1 h-4 w-4" />}
            Exportar CSV
          </Button>
          <Button
            onClick={() => run("pdf")}
            disabled={!!busy || totalSelected === 0 || rowCount === 0}
          >
            {busy === "pdf"
              ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              : <FileText className="mr-1 h-4 w-4" />}
            Exportar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
