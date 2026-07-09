import ExcelJS from "exceljs";
import {
  ptLabel,
  classificacaoLabel,
  formatDeltaSegundos,
  type MaterialDuplicidadeRow,
} from "./useMaterialDuplicidadesRelatorio";

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

export async function exportMaterialDuplicidadesXlsx(
  rows: MaterialDuplicidadeRow[],
  meta: { eventName: string; generatedAt: Date },
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JER Gestão";

  const erroTecnico = rows.filter((r) => r.classificacao === "erro_tecnico").length;
  const tentativaReal = rows.filter((r) => r.classificacao === "tentativa_real").length;

  const wsResumo = wb.addWorksheet("Resumo");
  wsResumo.addRow(["TENTATIVAS DE DUPLICIDADE — ENTREGA DE MATERIAL"]).getCell(1).font = { bold: true, size: 14 };
  wsResumo.addRow([meta.eventName]).getCell(1).font = { bold: true };
  wsResumo.addRow([`Gerado em: ${meta.generatedAt.toLocaleString("pt-BR")}`]);
  wsResumo.addRow([]);
  const kpiHeader = wsResumo.addRow(["Indicador", "Valor"]);
  kpiHeader.font = { bold: true };
  kpiHeader.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });
  wsResumo.addRow(["Total de tentativas", rows.length]);
  wsResumo.addRow(["Erro técnico (releitura)", erroTecnico]);
  wsResumo.addRow(["Tentativa real de reentrega", tentativaReal]);
  wsResumo.columns = [{ width: 42 }, { width: 20 }];

  const wsDet = wb.addWorksheet("Detalhado");
  wsDet.addRow(["DETALHAMENTO DAS TENTATIVAS"]).getCell(1).font = { bold: true, size: 13 };
  wsDet.addRow([meta.eventName]).getCell(1).font = { bold: true };
  wsDet.addRow([]);
  const detHeader = wsDet.addRow([
    "Participante",
    "CPF / QR Code",
    "Escola",
    "Kit",
    "Tipo",
    "Entrega Confirmada",
    "Operador Entrega",
    "Tentativa Bloqueada",
    "Operador Tentativa",
    "Δ Tempo",
    "Classificação",
  ]);
  detHeader.font = { bold: true };
  detHeader.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });

  for (const r of rows) {
    const row = wsDet.addRow([
      r.linked ? r.full_name || "—" : "Crachá não vinculado",
      r.linked ? r.cpf || "—" : r.qr_code || "—",
      r.escola,
      r.kit_name,
      r.linked ? ptLabel(r.participant_type) : "—",
      r.delivery_at ? new Date(r.delivery_at).toLocaleString("pt-BR") : "—",
      r.delivery_operator_name || "—",
      new Date(r.attempt_at).toLocaleString("pt-BR"),
      r.attempt_operator_name || "—",
      formatDeltaSegundos(r.delta_seconds),
      classificacaoLabel(r.classificacao),
    ]);
    if (!r.linked) row.getCell(1).font = { color: { argb: "FFD97706" } };
    row.getCell(11).font = {
      color: { argb: r.classificacao === "erro_tecnico" ? "FFD97706" : r.classificacao === "tentativa_real" ? "FFDC2626" : "FF666666" },
      bold: true,
    };
  }
  wsDet.columns = [
    { width: 28 }, { width: 16 }, { width: 28 }, { width: 22 }, { width: 16 },
    { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 12 }, { width: 24 },
  ];

  const iso = meta.generatedAt.toISOString().slice(0, 10);
  await dl(wb, `Duplicidades_Material_${meta.eventName.replace(/\s+/g, "_")}_${iso}.xlsx`);
}
