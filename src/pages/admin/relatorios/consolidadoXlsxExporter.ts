import ExcelJS from "exceljs";
import type { DashboardData } from "./useDashboardData";

interface Meta {
  eventName: string;
  generatedAt: Date;
}

/**
 * Exporta o Relatório Consolidado de Etapas para XLSX (abre no Excel; pode ser
 * salvo como CSV pelo próprio Excel). Reaproveita integralmente o agregado
 * `DashboardData` (escopo do evento = todas as etapas somadas, sem duplicar
 * participante). Foco: Inscrições, Credenciamento e Operacional.
 */
export async function exportConsolidadoXlsx(data: DashboardData, meta: Meta) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JER Gestão";
  wb.created = meta.generatedAt;

  const r = data.resumo;
  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

  // Aba 1: Resumo consolidado (todas as etapas)
  const w1 = wb.addWorksheet("Resumo");
  w1.columns = [{ width: 40 }, { width: 18 }];
  w1.addRow(["RELATÓRIO CONSOLIDADO — TODAS AS ETAPAS"]).font = { bold: true, size: 14 };
  w1.addRow([meta.eventName]).font = { italic: true };
  w1.addRow([`Etapas consolidadas: ${data.inscricoes.by_stage.length}`]);
  w1.addRow([`Emitido em: ${meta.generatedAt.toLocaleString("pt-BR")}`]);
  w1.addRow([]);

  const resumoRows: Array<[string, string | number]> = [
    ["Participantes (total)", r.participants_total],
    ["Atletas", r.athletes_total],
    ["Credenciados", r.credentialed],
    ["% Credenciamento", `${pct(r.credentialed, r.participants_total)}%`],
    ["Credenciais ativas", r.credentials_active],
    ["Inscrições em provas", data.inscricoes.total_provas],
    ["Vínculos em etapas", data.inscricoes.total_etapas],
    ["Pendentes de documentação", data.inscricoes.pendentes_documentacao],
    ["Refeições servidas", r.meals_total],
    ["Alojamento ocupado", r.lodging_occupied],
    ["Capacidade de alojamento", r.lodging_capacity],
    ["% Ocupação alojamento", `${pct(r.lodging_occupied, r.lodging_capacity)}%`],
    ["Viagens realizadas", r.transport_trips],
    ["Passageiros transportados", r.transport_passengers],
    ["Veículos cadastrados", r.transport_vehicles],
  ];
  for (const [label, value] of resumoRows) {
    const row = w1.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  }

  // Aba 2: Inscrições por Etapa (a quebra que compõe o total consolidado)
  const w2 = wb.addWorksheet("Inscrições por Etapa");
  w2.columns = [
    { header: "Etapa", key: "name", width: 40 },
    { header: "Inscritos (vínculos)", key: "count", width: 22 },
  ];
  w2.getRow(1).font = { bold: true };
  for (const s of data.inscricoes.by_stage) {
    w2.addRow({ name: s.name, count: s.count });
  }
  const totalEtapas = data.inscricoes.by_stage.reduce((acc, s) => acc + s.count, 0);
  const totalRow = w2.addRow({ name: "TOTAL", count: totalEtapas });
  totalRow.font = { bold: true };

  // Aba 3: Credenciamento por Delegação
  const w3 = wb.addWorksheet("Credenciamento");
  w3.columns = [
    { header: "Delegação", key: "name", width: 40 },
    { header: "Inscritos", key: "total", width: 14 },
    { header: "Credenciados", key: "cred", width: 16 },
    { header: "% Credenciado", key: "pct", width: 16 },
  ];
  w3.getRow(1).font = { bold: true };
  for (const d of data.credenciamento.by_delegation) {
    w3.addRow({ name: d.name, total: d.total, cred: d.credentialed, pct: `${d.pct}%` });
  }

  // Aba 4: Alimentação por Delegação
  const w4 = wb.addWorksheet("Alimentação");
  w4.columns = [
    { header: "Delegação", key: "name", width: 40 },
    { header: "Refeições", key: "total", width: 16 },
  ];
  w4.getRow(1).font = { bold: true };
  for (const m of data.alimentacao.by_delegation) {
    w4.addRow({ name: m.name, total: m.total });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateISO = meta.generatedAt.toISOString().slice(0, 10);
  a.href = url;
  a.download = `Consolidado_Etapas_${meta.eventName.replace(/\s+/g, "_")}_${dateISO}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
