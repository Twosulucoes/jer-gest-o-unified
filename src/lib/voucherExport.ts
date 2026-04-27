import { pdf, Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { createElement } from "react";

export interface VoucherExportRow {
  id: string;
  voucher_type: "nominal" | "aggregate";
  label: string | null;
  participant_name: string | null;
  participant_type: string | null;
  cpf: string | null;
  qr_code_value: string;
  qr_data_url?: string; // Para impressão de etiquetas
  status: string;
  is_contingency: boolean;
  scope_transport: boolean;
  scope_meals: boolean;
  scope_lodging: boolean;
  service_info?: string; // Ex: "Almoço - 12/06 - Refeitório Central"
  batch_label?: string;
  max_uses: number | null;
  current_uses: number;
  valid_until: string | null;
  created_at: string;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",;\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function scopesText(r: VoucherExportRow): string {
  const s: string[] = [];
  if (r.scope_transport) s.push("Transporte");
  if (r.scope_meals) s.push("Alimentação");
  if (r.scope_lodging) s.push("Alojamento");
  return s.join(" / ");
}

function statusLabel(s: string): string {
  return (
    {
      active: "Ativo",
      revoked: "Revogado",
      expired: "Expirado",
      exhausted: "Esgotado",
    }[s] ?? s
  );
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

export function exportVouchersCsv(rows: VoucherExportRow[], filenamePrefix = "vouchers") {
  const headers = [
    "Tipo",
    "Identificação",
    "Categoria",
    "CPF",
    "Código QR",
    "Status",
    "Contingência",
    "Escopos",
    "Usos",
    "Limite",
    "Válido até",
    "Emitido em",
  ];
  const lines = rows.map((r) =>
    [
      r.voucher_type === "aggregate" ? "Agregado" : "Nominal",
      r.voucher_type === "aggregate" ? r.label ?? "" : r.participant_name ?? "",
      r.voucher_type === "aggregate" ? "Acompanhante" : r.participant_type ?? "",
      r.cpf ?? "",
      r.qr_code_value,
      statusLabel(r.status),
      r.is_contingency ? "Sim" : "Não",
      scopesText(r),
      r.current_uses,
      r.max_uses ?? "ilimitado",
      r.valid_until ? new Date(r.valid_until).toLocaleDateString("pt-BR") : "",
      new Date(r.created_at).toLocaleDateString("pt-BR"),
    ]
      .map(csvEscape)
      .join(";")
  );
  const csv = "\uFEFF" + [headers.join(";"), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const ts = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `${filenamePrefix}-${ts}.csv`);
}

const pdfStyles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 12 },
  table: { width: "100%", borderTop: 1, borderLeft: 1, borderColor: "#ccc" },
  row: { flexDirection: "row", borderBottom: 1, borderColor: "#ccc" },
  headerRow: { backgroundColor: "#f3f4f6", fontWeight: "bold" },
  cell: { padding: 4, borderRight: 1, borderColor: "#ccc" },
  cType: { width: "10%" },
  cName: { width: "26%" },
  cCpf: { width: "12%" },
  cQr: { width: "22%" },
  cStatus: { width: "10%" },
  cScope: { width: "14%" },
  cUses: { width: "6%", textAlign: "right" },
  footer: { marginTop: 12, fontSize: 8, color: "#666", textAlign: "right" },
});

export async function exportVouchersPdf(
  rows: VoucherExportRow[],
  meta: { eventName?: string; typeFilter: string; statusFilter: string; scopeFilter: string },
  filenamePrefix = "vouchers"
) {
  const filterDesc: string[] = [];
  filterDesc.push(`Tipo: ${meta.typeFilter === "all" ? "Todos" : meta.typeFilter === "aggregate" ? "Agregado" : "Nominal"}`);
  filterDesc.push(`Status: ${meta.statusFilter === "all" ? "Todos" : statusLabel(meta.statusFilter)}`);
  filterDesc.push(
    `Escopo: ${
      meta.scopeFilter === "all"
        ? "Todos"
        : meta.scopeFilter === "transport"
          ? "Transporte"
          : meta.scopeFilter === "meals"
            ? "Alimentação"
            : "Alojamento"
    }`
  );

  const doc = createElement(
    Document,
    {},
    createElement(
      Page,
      { size: "A4", orientation: "landscape", style: pdfStyles.page },
      createElement(Text, { style: pdfStyles.title }, `Vouchers de Serviço${meta.eventName ? ` — ${meta.eventName}` : ""}`),
      createElement(
        Text,
        { style: pdfStyles.subtitle },
        `${filterDesc.join("  •  ")}  •  Total: ${rows.length}  •  Gerado em ${new Date().toLocaleString("pt-BR")}`
      ),
      createElement(
        View,
        { style: pdfStyles.table },
        createElement(
          View,
          { style: [pdfStyles.row, pdfStyles.headerRow] },
          createElement(Text, { style: [pdfStyles.cell, pdfStyles.cType] }, "Tipo"),
          createElement(Text, { style: [pdfStyles.cell, pdfStyles.cName] }, "Identificação"),
          createElement(Text, { style: [pdfStyles.cell, pdfStyles.cCpf] }, "CPF / Categoria"),
          createElement(Text, { style: [pdfStyles.cell, pdfStyles.cQr] }, "Código QR"),
          createElement(Text, { style: [pdfStyles.cell, pdfStyles.cStatus] }, "Status"),
          createElement(Text, { style: [pdfStyles.cell, pdfStyles.cScope] }, "Escopos"),
          createElement(Text, { style: [pdfStyles.cell, pdfStyles.cUses] }, "Usos")
        ),
        ...rows.map((r) =>
          createElement(
            View,
            { style: pdfStyles.row, key: r.id },
            createElement(
              Text,
              { style: [pdfStyles.cell, pdfStyles.cType] },
              r.voucher_type === "aggregate" ? "Agregado" : r.is_contingency ? "Nominal (C)" : "Nominal"
            ),
            createElement(
              Text,
              { style: [pdfStyles.cell, pdfStyles.cName] },
              r.voucher_type === "aggregate" ? r.label ?? "—" : r.participant_name ?? "—"
            ),
            createElement(
              Text,
              { style: [pdfStyles.cell, pdfStyles.cCpf] },
              r.voucher_type === "aggregate" ? "Acompanhante" : r.cpf ?? r.participant_type ?? "—"
            ),
            createElement(Text, { style: [pdfStyles.cell, pdfStyles.cQr] }, r.qr_code_value),
            createElement(Text, { style: [pdfStyles.cell, pdfStyles.cStatus] }, statusLabel(r.status)),
            createElement(Text, { style: [pdfStyles.cell, pdfStyles.cScope] }, scopesText(r) || "—"),
            createElement(
              Text,
              { style: [pdfStyles.cell, pdfStyles.cUses] },
              `${r.current_uses}${r.max_uses != null ? `/${r.max_uses}` : ""}`
            )
          )
        )
      ),
      createElement(Text, { style: pdfStyles.footer }, "JER Gestão • Vouchers de Serviço")
    )
  );

  const blob = await pdf(doc as any).toBlob();
  const ts = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `${filenamePrefix}-${ts}.pdf`);
}

const labelStyles = StyleSheet.create({
  page: { 
    padding: 10, 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    justifyContent: 'flex-start'
  },
  labelContainer: {
    width: '48%', // Aprox 2 colunas por linha
    height: 140,
    margin: '1%',
    padding: 8,
    border: 1,
    borderColor: '#000',
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrCode: {
    width: 90,
    height: 90,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  serviceTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  holderName: {
    fontSize: 9,
    marginBottom: 2,
  },
  details: {
    fontSize: 8,
    color: '#444',
  },
  batchLabel: {
    fontSize: 7,
    marginTop: 4,
    fontStyle: 'italic',
    color: '#666',
  },
  systemLogo: {
    fontSize: 6,
    position: 'absolute',
    bottom: 4,
    right: 8,
    color: '#aaa',
  }
});

export async function printVoucherLabelsPdf(
  rows: VoucherExportRow[],
  filenamePrefix = "etiquetas-vouchers"
) {
  const doc = createElement(
    Document,
    {},
    createElement(
      Page,
      { size: "A4", style: labelStyles.page },
      ...rows.map((r) =>
        createElement(
          View,
          { style: labelStyles.labelContainer, key: r.id },
          r.qr_data_url && createElement(Image, { style: labelStyles.qrCode, src: r.qr_data_url }),
          createElement(
            View,
            { style: labelStyles.infoContainer },
            createElement(Text, { style: labelStyles.serviceTitle }, r.service_info || "Serviço JER"),
            createElement(
              Text, 
              { style: labelStyles.holderName }, 
              r.voucher_type === "nominal" ? (r.participant_name || "Portador Nominal") : (r.label || "Voucher Anônimo")
            ),
            createElement(Text, { style: labelStyles.details }, `Validade: ${r.valid_until ? new Date(r.valid_until).toLocaleDateString("pt-BR") : "S/ data"}`),
            createElement(Text, { style: labelStyles.details }, `Usos: ${r.max_uses ?? "Ilimitado"}`),
            r.batch_label && createElement(Text, { style: labelStyles.batchLabel }, `Lote: ${r.batch_label}`),
            createElement(Text, { style: labelStyles.systemLogo }, "JER Gestão • Vouchers")
          )
        )
      )
    )
  );

  const blob = await pdf(doc as any).toBlob();
  const ts = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `${filenamePrefix}-${ts}.pdf`);
}
