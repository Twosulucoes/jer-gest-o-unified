import { renderPdf } from "@/reports/renderers/pdf/pdfRenderer";
import type { ReportDefinition, ReportContext } from "@/reports/core/types";

export interface EscalaExportRow {
  official_name: string;
  role_label: string;
  match_number: string;
  sport: string;
  category: string;
  phase: string;
  match_date: string;
  start_time: string;
  venue: string;
  stage: string;
  [key: string]: string;
}

const COLUMNS: ReportDefinition<EscalaExportRow>["columns"] = [
  { key: "official_name", label: "Oficial", width: 18, visibleByDefault: true },
  { key: "role_label", label: "Função", width: 12, visibleByDefault: true },
  { key: "stage", label: "Etapa", width: 10, visibleByDefault: true },
  { key: "sport", label: "Modalidade", width: 14, visibleByDefault: true },
  { key: "category", label: "Categoria", width: 10, visibleByDefault: true },
  { key: "phase", label: "Fase", width: 10, visibleByDefault: true },
  { key: "match_number", label: "Partida #", width: 7, align: "center", visibleByDefault: true },
  { key: "match_date", label: "Data", width: 8, align: "center", visibleByDefault: true },
  { key: "start_time", label: "Hora", width: 6, align: "center", visibleByDefault: true },
  { key: "venue", label: "Local", width: 15, visibleByDefault: true },
];

export function downloadCsv(rows: EscalaExportRow[], filename: string) {
  const headers = COLUMNS.map((c) => c.label);
  const keys = COLUMNS.map((c) => c.key);
  const escape = (v: string) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => keys.map((k) => escape(r[k] ?? "")).join(",")),
  ];
  // BOM for Excel UTF-8 friendliness
  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, filename);
}

export async function downloadPdf(
  rows: EscalaExportRow[],
  filename: string,
  opts: {
    eventName?: string;
    stageName?: string;
    activeEventId: string | null;
    userId: string | null;
  },
) {
  const def: ReportDefinition<EscalaExportRow> = {
    id: "escalas-arbitragem",
    name: `Escalas da Arbitragem${opts.stageName ? ` — ${opts.stageName}` : ""}`,
    description:
      "Lista consolidada de oficiais designados às partidas, com função e dados da partida.",
    scope: "event",
    formats: ["pdf"],
    filters: [],
    columns: COLUMNS,
    datasource: {
      type: "custom",
      customLoader: async () => rows,
    },
    layout: { orientation: "landscape", showLogo: true, showPageNumbers: true },
  };

  const ctx: ReportContext = {
    activeEventId: opts.activeEventId,
    userId: opts.userId,
    roles: [],
    baseUrl: typeof window !== "undefined" ? window.location.origin : "",
  };

  const blob = await renderPdf(def, rows, {}, ctx, undefined, opts.eventName);
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
