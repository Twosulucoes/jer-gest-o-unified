import * as XLSX from "xlsx";

export type ExportColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
};

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 80);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCSV<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",;\n\r]/.test(s) ? `"${s}"` : s;
  };
  const headerLine = columns.map((c) => escape(c.header)).join(";");
  const lines = rows.map((r) => columns.map((c) => escape(c.accessor(r))).join(";"));
  // BOM para Excel reconhecer UTF-8
  const csv = "\uFEFF" + [headerLine, ...lines].join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${sanitizeFilename(filename)}.csv`);
}

export function exportToXLSX<T>(rows: T[], columns: ExportColumn<T>[], filename: string, sheetName = "Dados") {
  const aoa: (string | number | null)[][] = [
    columns.map((c) => c.header),
    ...rows.map((r) => columns.map((c) => {
      const v = c.accessor(r);
      return v === undefined || v === null ? "" : v;
    })),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Largura automática simples por coluna (caracteres)
  const colWidths = columns.map((c, i) => {
    const headerLen = c.header.length;
    let max = headerLen;
    for (let r = 0; r < Math.min(rows.length, 200); r++) {
      const v = aoa[r + 1]?.[i];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 2, 10), 50) };
  });
  (ws as any)["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([out], { type: "application/octet-stream" }), `${sanitizeFilename(filename)}.xlsx`);
}

export function timestampedName(prefix: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}
