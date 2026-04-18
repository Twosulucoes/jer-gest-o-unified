import ExcelJS from "exceljs";
import type { MedalTableData, ScopeFilter } from "./useMedalTableData";

const SCOPE_LABEL: Record<ScopeFilter, string> = { all: "GERAL", jer: "JER", jerpa: "JERPA" };

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

export async function exportMedalTableXlsx(data: MedalTableData, meta: { eventName: string; scope: ScopeFilter; generatedAt: Date }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JER Gestão";
  const ws = wb.addWorksheet(`Quadro ${SCOPE_LABEL[meta.scope]}`);
  ws.addRow(["QUADRO DE MEDALHAS"]).font = { bold: true, size: 14 };
  ws.addRow([meta.eventName]).font = { bold: true };
  ws.addRow([`Escopo: ${SCOPE_LABEL[meta.scope]}`]);
  ws.addRow([`Status: ${data.partial.hasPartial ? `PARCIAL (${data.partial.pendingSports} prova(s) pendente(s))` : "OFICIAL"}`]);
  ws.addRow([`Gerado em: ${meta.generatedAt.toLocaleString("pt-BR")}`]);
  ws.addRow([]);
  const headerRow = ws.addRow(["Pos", "Escola", "Ouro", "Prata", "Bronze", "Total"]);
  headerRow.font = { bold: true };
  headerRow.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });
  for (const r of data.medalsBySchool) {
    ws.addRow([`${r.pos}º`, r.schoolName, r.ouro, r.prata, r.bronze, r.total]);
  }
  ws.columns = [{ width: 8 }, { width: 50 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }];

  const iso = meta.generatedAt.toISOString().slice(0, 10);
  await dl(wb, `Quadro_Medalhas_${SCOPE_LABEL[meta.scope]}_${iso}.xlsx`);
}

export async function exportRankingGeralXlsx(data: MedalTableData, meta: { eventName: string; scope: ScopeFilter; generatedAt: Date }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JER Gestão";
  const ws = wb.addWorksheet(`Classificação ${SCOPE_LABEL[meta.scope]}`);
  ws.addRow(["CLASSIFICAÇÃO GERAL — CAMPEONATO GERAL"]).font = { bold: true, size: 14 };
  ws.addRow([meta.eventName]).font = { bold: true };
  ws.addRow([`Escopo: ${SCOPE_LABEL[meta.scope]}`]);
  ws.addRow([`Status: ${data.partial.hasPartial ? `PARCIAL (${data.partial.pendingSports} prova(s) pendente(s))` : "OFICIAL"}`]);
  ws.addRow([`Gerado em: ${meta.generatedAt.toLocaleString("pt-BR")}`]);
  ws.addRow([]);
  const headerRow = ws.addRow(["Pos", "Escola", "Pts Coletivas", "Pts Individuais", "Total Geral", "Ouros", "Pratas", "Bronzes"]);
  headerRow.font = { bold: true };
  headerRow.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }; });
  for (const r of data.rankingGeral) {
    ws.addRow([`${r.pos}º`, r.schoolName, r.ptsColetivas, r.ptsIndividuais, r.totalGeral, r.ouros, r.pratas, r.bronzes]);
  }
  ws.addRow([]);
  ws.addRow(["Nota: Pontuação conforme Art. 108 (1º=10, 2º=8, 3º=6, 4º=5, 5º=4, 6º=3, 7º=2, 8º=1). Desempate conforme Art. 111."]).font = { italic: true, size: 9 };
  ws.columns = [{ width: 8 }, { width: 45 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 10 }];

  const iso = meta.generatedAt.toISOString().slice(0, 10);
  await dl(wb, `Classificacao_Geral_${SCOPE_LABEL[meta.scope]}_${iso}.xlsx`);
}
