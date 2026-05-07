import ExcelJS from "exceljs";
import type { DashboardData } from "./useDashboardData";

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

function pct(n: number, total: number) { return total > 0 ? Math.round((n / total) * 100) : 0; }

export async function exportCredenciamentoXlsx(
  data: DashboardData,
  meta: { eventName: string; generatedAt: Date }
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JER Gestão";

  const r = data.resumo;
  const credPct = pct(r.credentialed, r.athletes_total);

  // ── Aba 1: Resumo ───────────────────────────────────────────────
  const wsResumo = wb.addWorksheet("Resumo");
  wsResumo.addRow(["RELATÓRIO DE CREDENCIAMENTO"]).getCell(1).font = { bold: true, size: 14 };
  wsResumo.addRow([meta.eventName]).getCell(1).font = { bold: true };
  wsResumo.addRow([`Gerado em: ${meta.generatedAt.toLocaleString("pt-BR")}`]);
  wsResumo.addRow([]);

  const kpiHeader = wsResumo.addRow(["Indicador", "Valor"]);
  kpiHeader.font = { bold: true };
  kpiHeader.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });

  wsResumo.addRow(["Total de Atletas", r.athletes_total]);
  wsResumo.addRow(["Credenciados", r.credentialed]);
  wsResumo.addRow(["Não credenciados", r.athletes_total - r.credentialed]);
  wsResumo.addRow(["Progresso (%)", `${credPct}%`]);
  wsResumo.addRow(["Credenciais Ativas", r.credentials_active]);
  wsResumo.addRow(["Emitidas Hoje", r.credentials_today]);
  wsResumo.columns = [{ width: 30 }, { width: 20 }];

  // ── Aba 2: Por Dia ──────────────────────────────────────────────
  if (data.credenciamento.daily.length > 0) {
    const wsDia = wb.addWorksheet("Por Dia");
    wsDia.addRow(["CREDENCIAMENTOS POR DIA"]).getCell(1).font = { bold: true, size: 13 };
    wsDia.addRow([meta.eventName]).getCell(1).font = { bold: true };
    wsDia.addRow([]);
    const diaHeader = wsDia.addRow(["Data", "Credenciamentos"]);
    diaHeader.font = { bold: true };
    diaHeader.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });
    for (const d of data.credenciamento.daily) {
      wsDia.addRow([d.date, d.count]);
    }
    wsDia.columns = [{ width: 16 }, { width: 20 }];
  }

  // ── Aba 3: Por Delegação ────────────────────────────────────────
  const wsDel = wb.addWorksheet("Por Delegação");
  wsDel.addRow(["CREDENCIAMENTO POR DELEGAÇÃO"]).getCell(1).font = { bold: true, size: 13 };
  wsDel.addRow([meta.eventName]).getCell(1).font = { bold: true };
  wsDel.addRow([`Gerado em: ${meta.generatedAt.toLocaleString("pt-BR")}`]);
  wsDel.addRow([]);

  const delHeader = wsDel.addRow(["Delegação", "Total", "Credenciados", "Pendentes", "Progresso (%)"]);
  delHeader.font = { bold: true };
  delHeader.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });

  for (const d of data.credenciamento.by_delegation) {
    const row = wsDel.addRow([d.name, d.total, d.credentialed, d.total - d.credentialed, d.pct]);
    // Colorir pendentes em laranja
    if (d.total - d.credentialed > 0) {
      row.getCell(4).font = { color: { argb: "FFD97706" } };
    }
    // Colorir credenciados em verde
    row.getCell(3).font = { color: { argb: "FF16A34A" } };
    // Colorir progresso
    const pctCell = row.getCell(5);
    pctCell.value = `${d.pct}%`;
    if (d.pct === 100) pctCell.font = { color: { argb: "FF16A34A" }, bold: true };
    else if (d.pct >= 50) pctCell.font = { color: { argb: "FFD97706" } };
    else pctCell.font = { color: { argb: "FFDC2626" } };
  }

  // Linha de total
  if (data.credenciamento.by_delegation.length > 0) {
    wsDel.addRow([]);
    const totalRow = wsDel.addRow([
      "TOTAL GERAL",
      r.athletes_total,
      r.credentialed,
      r.athletes_total - r.credentialed,
      `${credPct}%`,
    ]);
    totalRow.font = { bold: true };
    totalRow.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });
  }

  wsDel.columns = [{ width: 50 }, { width: 10 }, { width: 14 }, { width: 12 }, { width: 14 }];

  const iso = meta.generatedAt.toISOString().slice(0, 10);
  await dl(wb, `Credenciamento_${meta.eventName.replace(/\s+/g, "_")}_${iso}.xlsx`);
}
