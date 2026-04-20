import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileType2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV, exportToXLSX, timestampedName, type ExportColumn } from "@/lib/exportData";

type Format = "csv" | "xlsx" | "pdf";
type Scope = "filtered" | "all";

interface Props<T> {
  /** Linhas atualmente visíveis (página atual). Usadas como fallback se não houver fetchFilteredRows. */
  filteredRows: T[];
  /** Função opcional que retorna TODAS as linhas filtradas (todas as páginas) */
  fetchFilteredRows?: () => Promise<T[]>;
  /** Função opcional que retorna TODAS as linhas (ignorando filtros) */
  fetchAllRows?: () => Promise<T[]>;
  columns: ExportColumn<T>[];
  filenamePrefix: string;
  sheetName?: string;
  label?: string;
  disabled?: boolean;
  /** Handler opcional para gerar PDF a partir das linhas (respeita filtros e agrupamento). Recebe escopo. */
  onPdf?: (scope: Scope, rows: T[]) => Promise<void>;
}

export default function ExportButton<T>({
  filteredRows,
  fetchFilteredRows,
  fetchAllRows,
  columns,
  filenamePrefix,
  sheetName = "Dados",
  label = "Exportar",
  disabled,
  onPdf,
}: Props<T>) {
  const [busy, setBusy] = useState(false);

  const run = async (scope: Scope, format: Format) => {
    try {
      setBusy(true);
      const rows = scope === "filtered"
        ? (fetchFilteredRows ? await fetchFilteredRows() : filteredRows)
        : (fetchAllRows ? await fetchAllRows() : filteredRows);
      if (!rows || rows.length === 0) {
        toast.warning("Nenhum registro para exportar");
        return;
      }
      const filename = timestampedName(`${filenamePrefix}_${scope === "all" ? "geral" : "filtrado"}`);
      if (format === "csv") exportToCSV(rows, columns, filename);
      else if (format === "xlsx") exportToXLSX(rows, columns, filename, sheetName);
      else if (format === "pdf" && onPdf) await onPdf(scope, rows);
      toast.success(`${rows.length} registro(s) exportado(s)`);
    } catch (e: any) {
      toast.error(`Falha ao exportar: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Filtrados ({filteredRows.length})</DropdownMenuLabel>
        {onPdf && (
          <DropdownMenuItem onClick={() => run("filtered", "pdf")}>
            <FileType2 className="h-4 w-4 mr-2 text-destructive" />
            Relatório PDF (filtrado)
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => run("filtered", "xlsx")}>
          <FileSpreadsheet className="h-4 w-4 mr-2 text-primary" />
          Exportar filtrados (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("filtered", "csv")}>
          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
          Exportar filtrados (CSV)
        </DropdownMenuItem>
        {fetchAllRows && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Geral (todos)</DropdownMenuLabel>
            {onPdf && (
              <DropdownMenuItem onClick={() => run("all", "pdf")}>
                <FileType2 className="h-4 w-4 mr-2 text-destructive" />
                Relatório PDF (geral)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => run("all", "xlsx")}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-primary" />
              Exportar tudo (Excel)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("all", "csv")}>
              <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
              Exportar tudo (CSV)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

