import {
  EVIDENCE_CATEGORIES,
  type ExecucaoFisicaReport,
} from "./execucaoFisicaService";

/**
 * Exportação do Relatório de Execução Física em formato Word (.doc).
 *
 * NOTA: a biblioteca `docx` (OOXML) não pôde ser instalada neste ambiente porque
 * a política de rede bloqueia o registro de pacotes. Para entregar mesmo assim um
 * arquivo editável e fiel ao layout, geramos um documento Word a partir de HTML
 * estilizado (mime application/msword), que o Microsoft Word/LibreOffice abre
 * nativamente. Caso a dependência `docx` seja liberada futuramente, este módulo
 * pode ser substituído sem alterar a página nem o serviço.
 *
 * Trata apenas execução FÍSICA — nenhum dado financeiro.
 */

const GREEN = "#166534";
const GREEN_SOFT = "#dcfce7";

const nf = new Intl.NumberFormat("pt-BR");
const fmt = (n: number | null | undefined) => nf.format(Number(n || 0));
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const esc = (v: unknown) =>
  String(v ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface ExecFisicaDocMeta {
  generatedAt: Date;
  periodLabel: string;
  oscFallbackName?: string;
}

export function exportExecucaoFisicaDoc(report: ExecucaoFisicaReport, meta: ExecFisicaDocMeta) {
  const id = report.identificacao;
  const oscName = id.osc_name || meta.oscFallbackName || "Instituto AcolheRR";
  const total = report.meta1.total;
  const rows = report.meta1.por_etapa.filter(
    (r) =>
      r.delegacoes_atendidas > 0 ||
      r.atletas_alojados > 0 ||
      r.refeicoes_fornecidas > 0 ||
      r.kits_entregues > 0,
  );
  const evCount = (cat: string) => report.evidencias.find((e) => e.osc_category === cat)?.count ?? 0;

  const meta1Rows = rows
    .map(
      (r) => `<tr>
        <td>${esc(r.host_city)}</td>
        <td style="text-align:right">${fmt(r.delegacoes_atendidas)}</td>
        <td style="text-align:right">${fmt(r.atletas_alojados)}</td>
        <td style="text-align:right">${fmt(r.refeicoes_fornecidas)}</td>
        <td style="text-align:right">${fmt(r.kits_entregues)}</td>
      </tr>`,
    )
    .join("");

  const meta2Rows = report.meta2
    .map(
      (m) => `<tr>
        <td>${esc(m.label)}</td>
        <td style="text-align:right">${m.previsto > 0 ? fmt(m.previsto) : "—"}</td>
        <td style="text-align:right">${fmt(m.executado)}</td>
      </tr>`,
    )
    .join("");

  const evidenciasRows = EVIDENCE_CATEGORIES.map(
    (cat) => `<tr><td>Fotos — ${esc(cat)}</td><td style="text-align:right">${evCount(cat)} evidência(s) aprovada(s)</td></tr>`,
  ).join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Relatório de Execução Física das Metas</title>
<style>
  body { font-family: 'Calibri', Arial, sans-serif; color: #1f2937; font-size: 11pt; }
  h1 { color: ${GREEN}; text-align: center; font-size: 16pt; text-transform: uppercase; margin: 4pt 0; }
  .subtitle { text-align: center; color: #444; font-size: 10pt; margin-bottom: 14pt; }
  .header { border-bottom: 2pt solid ${GREEN}; padding-bottom: 6pt; text-align: right; }
  .header .grantor { color: ${GREEN}; font-weight: bold; font-size: 12pt; }
  .header .meta { color: #666; font-size: 8pt; }
  h2 { background: ${GREEN}; color: #fff; padding: 5pt; font-size: 12pt; margin-top: 16pt; }
  table { border-collapse: collapse; width: 100%; margin-top: 6pt; font-size: 9.5pt; }
  th, td { border: 0.5pt solid #86efac; padding: 4pt 6pt; }
  th { background: ${GREEN_SOFT}; color: ${GREEN}; text-align: left; }
  tr.total td { background: #f0fdf4; font-weight: bold; border-top: 1.5pt solid ${GREEN}; }
  .ident td { border: none; padding: 2pt 6pt; }
  .ident .lbl { color: #666; font-size: 8pt; text-transform: uppercase; width: 28%; }
  .note { font-size: 8pt; color: #888; font-style: italic; margin-top: 4pt; }
  .declaration { text-align: justify; line-height: 1.5; margin-top: 8pt; }
  .sign { margin-top: 56pt; text-align: center; }
  .sign .line { border-top: 0.7pt solid #333; width: 60%; margin: 0 auto; padding-top: 4pt; }
  .footer { margin-top: 24pt; border-top: 0.5pt solid #ccc; padding-top: 4pt; text-align: center; color: #888; font-size: 8pt; }
</style>
</head>
<body>
  <div class="header">
    <div class="grantor">${esc(id.grantor_name || "Governo do Estado de Roraima")}</div>
    <div class="meta">${esc(oscName)}</div>
    <div class="meta">Termo de Fomento nº ${esc(id.termo_fomento)}</div>
  </div>

  <h1>Relatório de Execução Física das Metas</h1>
  <div class="subtitle">${esc(id.objeto)} &bull; Período: ${esc(meta.periodLabel)}</div>

  <h2>1. Identificação</h2>
  <table class="ident">
    <tr><td class="lbl">Termo de Fomento</td><td>${esc(id.termo_fomento)}</td></tr>
    <tr><td class="lbl">Objeto</td><td>${esc(id.objeto)}</td></tr>
    <tr><td class="lbl">OSC Parceira</td><td>${esc(oscName)}</td></tr>
    <tr><td class="lbl">CNPJ</td><td>${esc(id.osc_cnpj)}</td></tr>
    <tr><td class="lbl">Órgão Concedente</td><td>${esc(id.grantor_name || "IDJUV/RR")}</td></tr>
    <tr><td class="lbl">Vigência</td><td>${id.validity_start ? `${fmtDate(id.validity_start)} a ${fmtDate(id.validity_end)}` : "—"}</td></tr>
  </table>

  <h2>2. Meta 1 — Apoio às Delegações (por etapa regional / cidade-sede)</h2>
  <table>
    <thead>
      <tr>
        <th>Etapa / Cidade-sede</th>
        <th style="text-align:right">Delegações</th>
        <th style="text-align:right">Atletas alojados</th>
        <th style="text-align:right">Refeições</th>
        <th style="text-align:right">Kits-atleta</th>
      </tr>
    </thead>
    <tbody>
      ${meta1Rows}
      <tr class="total">
        <td>TOTAL (consolidado, sem duplicidade)</td>
        <td style="text-align:right">${fmt(total.delegacoes_atendidas)}</td>
        <td style="text-align:right">${fmt(total.atletas_alojados)}</td>
        <td style="text-align:right">${fmt(total.refeicoes_fornecidas)}</td>
        <td style="text-align:right">${fmt(total.kits_entregues)}</td>
      </tr>
    </tbody>
  </table>
  <div class="note">O TOTAL é o consolidado único por participante no evento; a soma simples das etapas é maior porque um mesmo atleta pode participar de mais de uma etapa.</div>

  <h2>3. Meta 2 — Competições (previsto x executado)</h2>
  <table>
    <thead>
      <tr><th>Indicador</th><th style="text-align:right">Previsto</th><th style="text-align:right">Executado</th></tr>
    </thead>
    <tbody>${meta2Rows}</tbody>
  </table>

  <h2>4. Checklist de Evidências</h2>
  <table>
    <tbody>
      <tr><td>Listas de credenciamento</td><td style="text-align:right">Disponíveis no sistema (módulo Credenciamento)</td></tr>
      <tr><td>Relatório do sistema</td><td style="text-align:right">Este documento (gerado automaticamente)</td></tr>
      ${evidenciasRows}
    </tbody>
  </table>

  <h2>5. Declaração</h2>
  <p class="declaration">
    Declaramos, para fins de prestação de contas junto ao IDJUV/RR, que os dados de execução
    FÍSICA constantes neste relatório foram extraídos diretamente do sistema JER Gestão e
    correspondem fielmente às atividades realizadas no âmbito do ${esc(id.objeto)}. O presente
    documento trata exclusivamente da execução física das metas, não contemplando informações
    de natureza financeira.
  </p>

  <div class="sign">
    <div class="line">${esc(id.responsible_name || "&nbsp;")}<br/>Responsável Técnico — ${esc(oscName)}</div>
  </div>

  <div class="footer">JER Gestão — Relatório de Execução Física das Metas — gerado em ${esc(meta.generatedAt.toLocaleString("pt-BR"))}</div>
</body>
</html>`;

  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Execucao_Fisica_${id.event_name.replace(/[^\w]+/g, "_")}_${Date.now()}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
