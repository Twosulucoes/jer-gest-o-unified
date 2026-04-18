import ExcelJS from "exceljs";
import type { BulletinDataset } from "./useBulletinData";
import { computeScoreStandings } from "./BulletinScore";

export async function exportBulletinXlsx(
  data: BulletinDataset,
  meta: { eventName: string; sportName: string; categoryName: string; gender: string; phaseName?: string }
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "JER Gestão";

  const meta_ws = wb.addWorksheet("Capa");
  meta_ws.addRows([
    ["BOLETIM DE RESULTADO POR MODALIDADE"],
    [meta.eventName],
    [],
    ["Modalidade", meta.sportName],
    ["Categoria", meta.categoryName],
    ["Gênero", meta.gender],
    ["Fase", meta.phaseName ?? "Todas"],
    ["Família técnica", data.family],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
  ]);
  meta_ws.getRow(1).font = { bold: true, size: 14 };
  meta_ws.getRow(2).font = { bold: true };
  meta_ws.getColumn(1).width = 22;
  meta_ws.getColumn(2).width = 50;

  // Classificação (apenas score/sets fazem sentido)
  if (data.family === "score" || data.family === "sets") {
    const ws = wb.addWorksheet("Classificação");
    if (data.family === "score") {
      ws.addRow(["Grupo", "Pos", "Equipe", "Delegação", "P", "J", "V", "E", "D", "GP", "GC", "SG"]);
      const standings = computeScoreStandings(data);
      for (const [gid, list] of standings.entries()) {
        const groupName = data.groups.find((g) => g.id === gid)?.name ?? "Geral";
        list.forEach((s, idx) => {
          ws.addRow([groupName, idx + 1, s.team, s.delegation ?? "", s.P, s.J, s.V, s.E, s.D, s.GP, s.GC, s.SG]);
        });
      }
    } else {
      ws.addRow(["Grupo", "Pos", "Equipe", "Delegação", "Status", "Observação"]);
      ws.addRow(["—", "", "", "", "Ver aba Partidas para placar por set", ""]);
    }
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 16));
  }

  // Partidas / Resultados
  const partidas = wb.addWorksheet("Partidas");
  partidas.addRow(["#", "Data", "Hora", "Fase", "Lado A", "Placar A", "Placar B", "Lado B", "Outcome", "Status"]);
  partidas.getRow(1).font = { bold: true };
  const eByM = new Map<string, typeof data.entries>();
  for (const e of data.entries) { if (!eByM.has(e.match_id)) eByM.set(e.match_id, []); eByM.get(e.match_id)!.push(e); }
  const rByE = new Map<string, typeof data.results[number]>();
  for (const r of data.results) rByE.set(r.match_entry_id, r);
  for (const m of data.matches) {
    const ents = eByM.get(m.id) || [];
    const a = ents[0]; const b = ents[1];
    const ar = a ? rByE.get(a.id) : undefined;
    const br = b ? rByE.get(b.id) : undefined;
    const phase = data.phases.find((p) => p.id === m.phase_id)?.name ?? "—";
    partidas.addRow([
      m.match_number ?? "",
      m.match_date ?? "",
      m.start_time ?? "",
      phase,
      a?.display_name ?? "",
      ar?.score ?? "",
      br?.score ?? "",
      b?.display_name ?? "",
      ar?.outcome ?? br?.outcome ?? "",
      ar?.result_status ?? m.status,
    ]);
  }
  partidas.columns.forEach((c, i) => (c.width = i === 0 ? 6 : 18));

  // Tempo / marca → ranking
  if (data.family === "time" || data.family === "mark") {
    const rk = wb.addWorksheet("Ranking");
    rk.addRow(["Pos", "Atleta", "Delegação", "Tempo (ms)", "Distância (cm)", "Pontos", "Status"]);
    rk.getRow(1).font = { bold: true };
    const eById = new Map(data.entries.map((e) => [e.id, e]));
    const sorted = [...data.results].sort((a, b) => {
      if (data.family === "mark") return Number(b.distance_cm ?? b.points ?? 0) - Number(a.distance_cm ?? a.points ?? 0);
      return Number(a.time_ms ?? Infinity) - Number(b.time_ms ?? Infinity);
    });
    sorted.forEach((r, idx) => {
      const e = eById.get(r.match_entry_id);
      rk.addRow([
        r.position ?? idx + 1,
        e?.display_name ?? "—",
        e?.delegation_name ?? "",
        r.time_ms ?? "",
        r.distance_cm ?? "",
        r.points ?? "",
        r.result_status,
      ]);
    });
    rk.columns.forEach((c) => (c.width = 18));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `boletim-${meta.sportName}-${meta.categoryName}-${meta.gender}.xlsx`.replace(/\s+/g, "_");
  a.click();
  URL.revokeObjectURL(url);
}
