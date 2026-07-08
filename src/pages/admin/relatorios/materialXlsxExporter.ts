import ExcelJS from "exceljs";
import { ptLabel, type MaterialKitSummary, type MaterialDeliveryRow, type MaterialSchoolBreakdownRow } from "./useMaterialEntregasRelatorio";

interface MaterialReportData {
  kits: MaterialKitSummary[];
  deliveries: MaterialDeliveryRow[];
  schoolBreakdown: MaterialSchoolBreakdownRow[];
}

function dl(wb: ExcelJS.Workbook, fileName: string) {
  return wb.xlsx.writeBuffer().then((buf) => {
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  });
}

export async function exportMaterialXlsx(
  data: MaterialReportData,
  meta: { eventName: string; generatedAt: Date },
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JER Gestão";

  const totalEntregues = data.kits.reduce((s, k) => s + k.delivered, 0);
  const totalEstornadas = data.kits.reduce((s, k) => s + k.revoked, 0);
  const kitsAtivos = data.kits.filter((k) => k.is_active).length;

  // ── Aba 1: Resumo ───────────────────────────────────────────────
  const wsResumo = wb.addWorksheet("Resumo");
  wsResumo.addRow(["RELATÓRIO DE ENTREGAS DE MATERIAL"]).getCell(1).font = { bold: true, size: 14 };
  wsResumo.addRow([meta.eventName]).getCell(1).font = { bold: true };
  wsResumo.addRow([`Gerado em: ${meta.generatedAt.toLocaleString("pt-BR")}`]);
  wsResumo.addRow([]);

  const kpiHeader = wsResumo.addRow(["Indicador", "Valor"]);
  kpiHeader.font = { bold: true };
  kpiHeader.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });

  wsResumo.addRow(["Kits Ativos", kitsAtivos]);
  wsResumo.addRow(["Entregues", totalEntregues]);
  wsResumo.addRow(["Estornadas", totalEstornadas]);
  wsResumo.columns = [{ width: 30 }, { width: 20 }];

  // ── Aba 2: Por Kit ──────────────────────────────────────────────
  const wsKit = wb.addWorksheet("Por Kit");
  wsKit.addRow(["PROGRESSO POR KIT"]).getCell(1).font = { bold: true, size: 13 };
  wsKit.addRow([meta.eventName]).getCell(1).font = { bold: true };
  wsKit.addRow([]);
  const kitHeader = wsKit.addRow(["Kit", "Etapa", "Entregues", "Estornadas", "Credenciados", "Faltam"]);
  kitHeader.font = { bold: true };
  kitHeader.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });
  for (const k of data.kits) {
    const row = wsKit.addRow([k.name, k.stage_name || "—", k.delivered, k.revoked, k.credentialed ?? "—", k.faltam ?? "—"]);
    row.getCell(3).font = { color: { argb: "FF16A34A" } };
    if (k.revoked > 0) row.getCell(4).font = { color: { argb: "FFDC2626" } };
    if ((k.faltam ?? 0) > 0) row.getCell(6).font = { color: { argb: "FFD97706" } };
  }
  wsKit.columns = [{ width: 34 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 10 }];

  // ── Aba 3: Por Escola ───────────────────────────────────────────
  const wsEscola = wb.addWorksheet("Por Escola");
  wsEscola.addRow(["ENTREGAS POR ESCOLA"]).getCell(1).font = { bold: true, size: 13 };
  wsEscola.addRow([meta.eventName]).getCell(1).font = { bold: true };
  wsEscola.addRow([]);
  const escolaHeader = wsEscola.addRow(["Kit", "Escola", "Entregues", "Credenciados", "Faltam"]);
  escolaHeader.font = { bold: true };
  escolaHeader.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });
  for (const r of data.schoolBreakdown) {
    const row = wsEscola.addRow([r.kit_name, r.escola, r.delivered, r.total ?? "—", r.faltam ?? "—"]);
    row.getCell(3).font = { color: { argb: "FF16A34A" } };
    if ((r.faltam ?? 0) > 0) row.getCell(5).font = { color: { argb: "FFD97706" } };
  }
  wsEscola.columns = [{ width: 34 }, { width: 34 }, { width: 12 }, { width: 14 }, { width: 10 }];

  // ── Aba 4: Detalhado ────────────────────────────────────────────
  const wsDet = wb.addWorksheet("Detalhado");
  wsDet.addRow(["ENTREGAS DETALHADAS"]).getCell(1).font = { bold: true, size: 13 };
  wsDet.addRow([meta.eventName]).getCell(1).font = { bold: true };
  wsDet.addRow([`Gerado em: ${meta.generatedAt.toLocaleString("pt-BR")}`]);
  wsDet.addRow([]);
  const detHeader = wsDet.addRow(["Participante", "CPF", "Escola", "Kit", "Tipo", "Data/Hora", "Método", "Status"]);
  detHeader.font = { bold: true };
  detHeader.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });
  for (const d of data.deliveries) {
    const row = wsDet.addRow([
      d.full_name || "—",
      d.cpf || "—",
      d.escola,
      d.kit_name,
      ptLabel(d.participant_type),
      new Date(d.delivered_at).toLocaleString("pt-BR"),
      d.method,
      d.status === "active" ? "Entregue" : "Estornada",
    ]);
    row.getCell(8).font = { color: { argb: d.status === "active" ? "FF16A34A" : "FFDC2626" } };
  }
  wsDet.columns = [
    { width: 30 }, { width: 16 }, { width: 30 }, { width: 24 }, { width: 18 }, { width: 18 }, { width: 12 }, { width: 12 },
  ];

  const iso = meta.generatedAt.toISOString().slice(0, 10);
  await dl(wb, `Entregas_Material_${meta.eventName.replace(/\s+/g, "_")}_${iso}.xlsx`);
}
