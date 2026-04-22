import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import type { ReportColumnDefinition } from "../core/types";

interface Props<Row> {
  columns: ReportColumnDefinition<Row>[];
  rows: Row[];
  visibleColumns: string[];
}

export function ReportPreviewTable<Row extends Record<string, unknown>>({ columns, rows, visibleColumns }: Props<Row>) {
  const cols = columns.filter((c) => visibleColumns.includes(c.key));

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Nenhum dado encontrado. Ajuste os filtros e tente novamente.
      </div>
    );
  }

  // Se o relatório parece ser do tipo Boletim Informativo (tem colunas 'section' e 'content' apenas)
  const isSectioned = cols.length === 2 && cols.some(c => c.key === 'section') && cols.some(c => c.key === 'content');

  const highlightFallback = (text: string) => {
    const target = "alterar o filtro de data";
    if (text.includes(target)) {
      const parts = text.split(target);
      return (
        <span>
          {parts[0]}
          <span className="font-bold text-primary underline decoration-primary/30 cursor-help">
            {target}
          </span>
          {parts[1]}
        </span>
      );
    }
    return text;
  };

  if (isSectioned) {
    return (
      <div className="space-y-4">
        {rows.map((row, i) => (
          <Card key={i} className="border-border/60 bg-card/50 overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-primary/70" />
                {String(row.section || "Seção")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {highlightFallback(String(row.content || "—"))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {cols.map((col) => (
              <TableHead key={col.key} className={`text-xs ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {cols.map((col) => {
                const val = col.format ? col.format(row) : (row[col.key] ?? '—');
                return (
                  <TableCell key={col.key} className={`text-sm ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}>
                    {String(val)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
