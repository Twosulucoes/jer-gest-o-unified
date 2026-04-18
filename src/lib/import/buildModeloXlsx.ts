/**
 * Gerador do modelo padrão de planilha de importação JER.
 * 
 * Estratégia:
 * - Aba 1 "Inscrições": cabeçalhos exatos esperados pelo importador,
 *   com 5 linhas-exemplo, validações nativas (dropdowns) e formatação condicional
 *   para campos obrigatórios faltantes.
 * - Aba 2 "📖 Instruções": guia de preenchimento.
 * - Abas de referência (somente leitura): Modalidades, Provas, Categorias, Escolas.
 * 
 * Usa dados reais do evento quando disponíveis; cai para catálogo canônico caso contrário.
 */

import * as XLSX from "xlsx-js-style";
import {
  MODALIDADES_CATALOGO,
  CATEGORIAS_CATALOGO,
  NAIPES,
  TIPOS_USUARIO,
  STATUS_INSCRICAO,
  SEXOS,
  PCD_VALORES,
  ESFERAS,
} from "./templateCatalog";

export interface ModeloDataSources {
  modalidades?: string[];      // do banco (sports.name)
  provas?: string[];           // do banco (sport_events / prova_catalog)
  categorias?: string[];       // do banco (categories.name)
  escolas?: string[];          // do banco (delegations.school_name)
  eventName?: string;
  eventYear?: number;
  stageName?: string;
}

// Cabeçalhos EXATOS do importador (TARGET_FIELDS de ColumnMappingStep + edge function)
const HEADERS = [
  "NOME",
  "CPF",
  "DATA NASCIMENTO",
  "SEXO",
  "RG",
  "EMAIL",
  "TELEFONE",
  "ESCOLA",
  "DELEGAÇÃO",
  "ESFERA",
  "TIPO USUARIO",
  "FUNCAO",
  "PCD",
  "MODALIDADE",
  "PROVA",
  "COMPETICAO",
  "STATUS DA INSCRIÇÃO",
] as const;

const HEADER_DESCRIPTIONS: Record<string, string> = {
  "NOME": "Nome completo (obrigatório)",
  "CPF": "Apenas números ou formato 000.000.000-00",
  "DATA NASCIMENTO": "Formato DD/MM/AAAA",
  "SEXO": "Masculino ou Feminino",
  "RG": "Documento de identidade (opcional)",
  "EMAIL": "E-mail de contato (opcional)",
  "TELEFONE": "Com DDD (opcional)",
  "ESCOLA": "Nome da escola/instituição (obrigatório)",
  "DELEGAÇÃO": "Nome da delegação (se diferente da escola)",
  "ESFERA": "Estadual, Municipal, Federal ou Particular",
  "TIPO USUARIO": "Atleta, Técnico, Chefe de Delegação, etc.",
  "FUNCAO": "Função específica (ex.: Goleiro, Pivô)",
  "PCD": "Não, ou tipo de deficiência",
  "MODALIDADE": "Nome da modalidade (obrigatório)",
  "PROVA": "Nome da prova/evento (obrigatório)",
  "COMPETICAO": "Categoria + Naipe (ex.: Sub-17 Masculino)",
  "STATUS DA INSCRIÇÃO": "Deferida, Aprovada, Pendente ou Indeferida",
};

const REQUIRED_HEADERS = new Set(["NOME", "ESCOLA", "MODALIDADE", "PROVA"]);

// ─── Style helpers ───────────────────────────────────────────────────

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  fill: { fgColor: { rgb: "0B2B5A" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
  },
};

const REQUIRED_HEADER_STYLE = {
  ...HEADER_STYLE,
  fill: { fgColor: { rgb: "C0392B" } },
};

const HINT_STYLE = {
  font: { italic: true, color: { rgb: "555555" }, sz: 9 },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  fill: { fgColor: { rgb: "F5F5F5" } },
};

const EXAMPLE_STYLE = {
  font: { color: { rgb: "888888" }, italic: true },
  fill: { fgColor: { rgb: "FAFAFA" } },
};

// ─── Build worksheet "Inscrições" ────────────────────────────────────

function buildInscricoesSheet(sources: ModeloDataSources): XLSX.WorkSheet {
  const exampleRows = [
    {
      "NOME": "JOÃO DA SILVA SANTOS",
      "CPF": "104.332.181-00",
      "DATA NASCIMENTO": "15/03/2008",
      "SEXO": "Masculino",
      "RG": "1234567",
      "EMAIL": "joao@exemplo.com",
      "TELEFONE": "(95) 99999-0000",
      "ESCOLA": "Escola Estadual Exemplo",
      "DELEGAÇÃO": "",
      "ESFERA": "Estadual",
      "TIPO USUARIO": "Atleta",
      "FUNCAO": "",
      "PCD": "Não",
      "MODALIDADE": "Atletismo",
      "PROVA": "100m rasos",
      "COMPETICAO": "Sub-17 Masculino",
      "STATUS DA INSCRIÇÃO": "Deferida",
    },
    {
      "NOME": "MARIA OLIVEIRA COSTA",
      "CPF": "960.013.389-14",
      "DATA NASCIMENTO": "22/07/2009",
      "SEXO": "Feminino",
      "RG": "",
      "EMAIL": "",
      "TELEFONE": "",
      "ESCOLA": "Escola Estadual Exemplo",
      "DELEGAÇÃO": "",
      "ESFERA": "Estadual",
      "TIPO USUARIO": "Atleta",
      "FUNCAO": "Pivô",
      "PCD": "Não",
      "MODALIDADE": "Basquete",
      "PROVA": "Partida",
      "COMPETICAO": "Sub-17 Feminino",
      "STATUS DA INSCRIÇÃO": "Deferida",
    },
    {
      "NOME": "CARLOS EDUARDO LIMA",
      "CPF": "083.863.794-99",
      "DATA NASCIMENTO": "10/05/1985",
      "SEXO": "Masculino",
      "RG": "",
      "EMAIL": "carlos.tecnico@exemplo.com",
      "TELEFONE": "(95) 98888-0000",
      "ESCOLA": "Escola Estadual Exemplo",
      "DELEGAÇÃO": "",
      "ESFERA": "Estadual",
      "TIPO USUARIO": "Técnico",
      "FUNCAO": "Técnico Principal",
      "PCD": "Não",
      "MODALIDADE": "Basquete",
      "PROVA": "Partida",
      "COMPETICAO": "Sub-17 Feminino",
      "STATUS DA INSCRIÇÃO": "Deferida",
    },
  ];

  // Linha 1: cabeçalhos
  // Linha 2: descrição (hint)
  // Linha 3+: exemplos
  const aoa: any[][] = [
    [...HEADERS],
    HEADERS.map((h) => HEADER_DESCRIPTIONS[h] ?? ""),
    ...exampleRows.map((r) => HEADERS.map((h) => (r as any)[h] ?? "")),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Aplicar estilos: cabeçalho + hint + exemplos
  HEADERS.forEach((h, colIdx) => {
    const headerCell = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    const hintCell = XLSX.utils.encode_cell({ r: 1, c: colIdx });
    if (ws[headerCell]) {
      ws[headerCell].s = REQUIRED_HEADERS.has(h) ? REQUIRED_HEADER_STYLE : HEADER_STYLE;
    }
    if (ws[hintCell]) {
      ws[hintCell].s = HINT_STYLE;
    }
    // Exemplos (linhas 3-5)
    for (let r = 2; r < 5; r++) {
      const cell = XLSX.utils.encode_cell({ r, c: colIdx });
      if (ws[cell]) ws[cell].s = EXAMPLE_STYLE;
    }
  });

  // Larguras de coluna
  ws["!cols"] = HEADERS.map((h) => {
    const maxLen = Math.max(h.length, HEADER_DESCRIPTIONS[h]?.length ?? 0, 20);
    return { wch: Math.min(maxLen + 2, 35) };
  });

  // Altura das linhas de cabeçalho e hint
  ws["!rows"] = [{ hpt: 28 }, { hpt: 36 }];

  // Freeze: cabeçalho + hint
  ws["!freeze"] = { xSplit: 0, ySplit: 2 };
  (ws as any)["!views"] = [{ state: "frozen", ySplit: 2 }];

  // ─── Data validations (dropdowns) ───
  // xlsx-js-style suporta !dataValidation parcialmente; usamos !dataValidations
  const validations: any[] = [];

  const addList = (colLetter: string, options: readonly string[] | string[]) => {
    if (!options || options.length === 0) return;
    // Excel limit per formula: 255 chars; se passar, usar referência a aba
    const formula = `"${options.join(",")}"`;
    if (formula.length > 250) return; // será tratado via referência (abas auxiliares)
    validations.push({
      sqref: `${colLetter}3:${colLetter}1048576`,
      type: "list",
      formula1: formula,
      allowBlank: true,
      showErrorMessage: true,
      errorTitle: "Valor inválido",
      error: "Selecione um valor da lista.",
    });
  };

  // SEXO (col D)
  addList("D", SEXOS);
  // ESFERA (col J)
  addList("J", ESFERAS);
  // TIPO USUARIO (col K)
  addList("K", TIPOS_USUARIO);
  // PCD (col M)
  addList("M", PCD_VALORES);
  // STATUS (col Q)
  addList("Q", STATUS_INSCRICAO);

  // MODALIDADE / PROVA / COMPETICAO usam referência a abas auxiliares (listas grandes)
  // Col N = MODALIDADE → 'Modalidades'!$A$2:$A$1000
  // Col O = PROVA → 'Provas'!$A$2:$A$1000
  // Col P = COMPETICAO → 'Categorias'!$A$2:$A$1000
  validations.push({
    sqref: "N3:N1048576",
    type: "list",
    formula1: "Modalidades!$A$2:$A$200",
    allowBlank: true,
    showErrorMessage: false,
  });
  validations.push({
    sqref: "O3:O1048576",
    type: "list",
    formula1: "Provas!$A$2:$A$1000",
    allowBlank: true,
    showErrorMessage: false,
  });
  validations.push({
    sqref: "P3:P1048576",
    type: "list",
    formula1: "Categorias!$A$2:$A$200",
    allowBlank: true,
    showErrorMessage: false,
  });

  if (sources.escolas && sources.escolas.length > 0) {
    validations.push({
      sqref: "H3:H1048576",
      type: "list",
      formula1: "Escolas!$A$2:$A$1000",
      allowBlank: true,
      showErrorMessage: false,
    });
  }

  (ws as any)["!dataValidations"] = validations;

  return ws;
}

// ─── Reference sheets ────────────────────────────────────────────────

function buildReferenceSheet(title: string, items: string[], extraCols?: { header: string; values: string[] }[]): XLSX.WorkSheet {
  const headers = [title, ...(extraCols?.map((c) => c.header) ?? [])];
  const rows = items.map((item, idx) => {
    const row: any[] = [item];
    extraCols?.forEach((c) => row.push(c.values[idx] ?? ""));
    return row;
  });
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Estilo cabeçalho
  headers.forEach((_, idx) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: idx });
    if (ws[cell]) ws[cell].s = HEADER_STYLE;
  });

  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 25) }));
  ws["!rows"] = [{ hpt: 24 }];
  return ws;
}

function buildInstructionsSheet(sources: ModeloDataSources): XLSX.WorkSheet {
  const lines: string[][] = [
    ["📋 MODELO DE IMPORTAÇÃO — JER GESTÃO"],
    [""],
    [`Evento: ${sources.eventName ?? "—"} (${sources.eventYear ?? "—"})`],
    [`Etapa: ${sources.stageName ?? "—"}`],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["✅ COMO PREENCHER"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["1. Cada LINHA representa UMA inscrição em UMA prova."],
    ["   Se um atleta participa de 3 provas, ele aparecerá em 3 linhas."],
    [""],
    ["2. Campos OBRIGATÓRIOS (cabeçalho VERMELHO):"],
    ["   • NOME — nome completo do participante"],
    ["   • ESCOLA — nome da escola/instituição"],
    ["   • MODALIDADE — modalidade esportiva (use o dropdown)"],
    ["   • PROVA — prova específica (use o dropdown)"],
    [""],
    ["3. Campos com DROPDOWN (clique na célula para selecionar):"],
    ["   • SEXO, ESFERA, TIPO USUARIO, PCD, STATUS"],
    ["   • MODALIDADE → veja aba 'Modalidades'"],
    ["   • PROVA → veja aba 'Provas'"],
    ["   • COMPETICAO → veja aba 'Categorias' (formato: 'Sub-17 Masculino')"],
    [""],
    ["4. CPF: pode ser digitado com ou sem formatação (000.000.000-00 ou 00000000000)."],
    ["   O sistema valida o dígito verificador (padrão Receita Federal). CPFs como"],
    ["   '123.456.789-00' são REJEITADOS por terem dígito verificador inválido."],
    ["   Se inválido ou ausente, o sistema gera uma pendência para revisão manual."],
    [""],
    ["5. DATA NASCIMENTO: use o formato DD/MM/AAAA (ex.: 15/03/2008)."],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["⚠️  ERROS COMUNS A EVITAR"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["• Nome da MODALIDADE diferente do catálogo (ex.: 'Futebol' em vez de 'Futsal')."],
    ["• PROVA não cadastrada para a modalidade (ex.: '50m livre' em Atletismo)."],
    ["• Mistura de naipes na mesma COMPETICAO (categoria) — verifique 'Sub-17 Masculino' vs 'Sub-17 Feminino'."],
    ["• Linhas em branco no meio da planilha — apague-as antes de importar."],
    ["• Apagar ou renomear cabeçalhos da linha 1 — o sistema reconhece pelos nomes EXATOS."],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["📌 TIPOS DE USUÁRIO"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["• Atleta — competidor"],
    ["• Técnico — comissão técnica"],
    ["• Chefe de Delegação — responsável pela escola/delegação"],
    ["• Auxiliar / Dirigente / Médico / Fisioterapeuta / Massagista — equipe de apoio"],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["🚀 APÓS PREENCHER"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["1. Apague as 3 linhas de EXEMPLO (em cinza claro)."],
    ["2. Salve como .xlsx (não use .xls antigo)."],
    ["3. Acesse Admin → Importação → selecione a Etapa → faça upload."],
    ["4. Confira o resumo de validação antes de confirmar."],
    ["5. Linhas com falha viram 'pendências' e podem ser corrigidas e reimportadas."],
    [""],
    ["💡 A importação é IDEMPOTENTE: reimportar a mesma planilha não duplica registros."],
  ];

  const ws = XLSX.utils.aoa_to_sheet(lines);
  // Estilo título
  if (ws["A1"]) {
    ws["A1"].s = {
      font: { bold: true, sz: 16, color: { rgb: "0B2B5A" } },
      alignment: { horizontal: "left" },
    };
  }
  ws["!cols"] = [{ wch: 90 }];
  return ws;
}

// ─── Main builder ────────────────────────────────────────────────────

export function buildModeloXlsx(sources: ModeloDataSources): Uint8Array {
  // Combinar dados reais + catálogo canônico
  const modalidadesFinal = sources.modalidades && sources.modalidades.length > 0
    ? sources.modalidades
    : MODALIDADES_CATALOGO.map((m) => m.nome);

  const provasFinal = sources.provas && sources.provas.length > 0
    ? sources.provas
    : MODALIDADES_CATALOGO.flatMap((m) => m.provas);

  // Categorias: usa cadastradas ou monta combinação Cat × Naipe do catálogo
  const categoriasFinal = sources.categorias && sources.categorias.length > 0
    ? sources.categorias
    : CATEGORIAS_CATALOGO.flatMap((c) =>
        NAIPES.filter((n) => n !== "Misto").map((n) => `${c.nome} ${n}`)
      );

  const wb = XLSX.utils.book_new();

  // Aba 1: Inscrições (principal)
  const wsInscricoes = buildInscricoesSheet(sources);
  XLSX.utils.book_append_sheet(wb, wsInscricoes, "Inscrições");

  // Aba 2: Instruções
  const wsInstr = buildInstructionsSheet(sources);
  XLSX.utils.book_append_sheet(wb, wsInstr, "📖 Instruções");

  // Abas de referência
  const wsMod = buildReferenceSheet("Modalidade", modalidadesFinal);
  XLSX.utils.book_append_sheet(wb, wsMod, "Modalidades");

  const wsProvas = buildReferenceSheet("Prova", provasFinal);
  XLSX.utils.book_append_sheet(wb, wsProvas, "Provas");

  const wsCat = buildReferenceSheet("Categoria + Naipe", categoriasFinal);
  XLSX.utils.book_append_sheet(wb, wsCat, "Categorias");

  if (sources.escolas && sources.escolas.length > 0) {
    const wsEsc = buildReferenceSheet("Escola / Delegação", sources.escolas);
    XLSX.utils.book_append_sheet(wb, wsEsc, "Escolas");
  }

  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buffer);
}

export function downloadModeloXlsx(sources: ModeloDataSources, fileName?: string) {
  const buffer = buildModeloXlsx(sources);
  const blob = new Blob([buffer.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = fileName ?? `modelo-importacao-jer-${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
