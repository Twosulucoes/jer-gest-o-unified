import ExcelJS from "exceljs";
import type { OscData } from "./useOscData";

interface Meta {
  eventName: string;
  generatedAt: Date;
  periodLabel: string;
}

export async function exportOscXlsx(data: OscData, meta: Meta) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JER Gestão";
  wb.created = meta.generatedAt;

  // Aba 1: Resumo
  const w1 = wb.addWorksheet("Resumo");
  w1.columns = [{ width: 38 }, { width: 18 }];
  w1.addRow(["PRESTAÇÃO DE CONTAS — RESUMO"]).font = { bold: true, size: 14 };
  w1.addRow([meta.eventName]).font = { italic: true };
  w1.addRow([`Período: ${meta.periodLabel}`]);
  w1.addRow([`Emitido em: ${meta.generatedAt.toLocaleString("pt-BR")}`]);
  w1.addRow([]);

  const r = data.resumo;
  const rows: Array<[string, string | number]> = [
    ["Total de participantes", r.totalParticipants],
    ["Atletas", r.totalAthletes],
    ["Credenciados", r.totalCredentialed],
    ["Delegações", r.totalDelegations],
    ["Modalidades", r.totalSports],
    ["Partidas (total)", r.totalMatches],
    ["Partidas publicadas", r.totalMatchesPublished],
    ["Refeições servidas", r.totalMeals],
    ["Alojamento ocupado", r.totalLodgingOccupied],
    ["Capacidade alojamento", r.totalLodgingCapacity],
    ["Viagens realizadas", r.totalTrips],
    ["Passageiros transportados", r.totalPassengers],
    ["Medalhas — Ouro", r.totalMedalsGold],
    ["Medalhas — Prata", r.totalMedalsSilver],
    ["Medalhas — Bronze", r.totalMedalsBronze],
    ["Doação alimentos (kg)", r.foodDonationKg],
  ];
  for (const [label, value] of rows) {
    const row = w1.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  }

  // Aba 2: Modalidades
  const w2 = wb.addWorksheet("Modalidades");
  w2.columns = [
    { header: "Modalidade", key: "name", width: 40 },
    { header: "Partidas", key: "matches", width: 12 },
    { header: "Publicadas", key: "published", width: 14 },
    { header: "% Concluído", key: "pct", width: 14 },
  ];
  w2.getRow(1).font = { bold: true };
  for (const sp of data.sports) {
    const pct = sp.matches > 0 ? Math.round((sp.published / sp.matches) * 100) : 0;
    w2.addRow({ name: sp.name, matches: sp.matches, published: sp.published, pct: `${pct}%` });
  }

  // Aba 3: Delegações
  const w3 = wb.addWorksheet("Delegações");
  w3.columns = [
    { header: "Escola", key: "school", width: 36 },
    { header: "Rede", key: "net", width: 14 },
    { header: "Inscritos", key: "p", width: 12 },
    { header: "Credenciados", key: "c", width: 14 },
    { header: "Refeições", key: "m", width: 12 },
    { header: "Ouro", key: "g", width: 8 },
    { header: "Prata", key: "s", width: 8 },
    { header: "Bronze", key: "b", width: 8 },
    { header: "Total Medalhas", key: "tot", width: 16 },
  ];
  w3.getRow(1).font = { bold: true };
  for (const d of data.delegations) {
    w3.addRow({
      school: d.schoolName, net: d.network || "—",
      p: d.totalParticipants, c: d.credentialed, m: d.meals,
      g: d.medalsGold, s: d.medalsSilver, b: d.medalsBronze,
      tot: d.medalsGold + d.medalsSilver + d.medalsBronze,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateISO = meta.generatedAt.toISOString().slice(0, 10);
  a.href = url;
  a.download = `Prestacao_Contas_${meta.eventName.replace(/\s+/g, "_")}_${dateISO}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
