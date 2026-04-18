import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
