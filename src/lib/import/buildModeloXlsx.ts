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
  "NOME": "Nome completo — obrigatório (aceita 'NOME DO ALUNO' do SIGECOM)",
  "CPF": "Com ou sem formatação (000.000.000-00). Inválido gera pendência, não erro.",
  "DATA NASCIMENTO": "DD/MM/AAAA — define a categoria automaticamente (12-14 ou 15-17 anos)",
  "SEXO": "Masculino ou Feminino",
  "RG": "Documento de identidade (opcional)",
  "EMAIL": "E-mail de contato (opcional)",
  "TELEFONE": "Com DDD, ex.: (95) 99999-0000 (opcional)",
  "ESCOLA": "Nome da escola/instituição conforme SIGECOM (obrigatório)",
  "DELEGAÇÃO": "Preencher somente se a delegação tiver nome diferente da escola",
  "ESFERA": "Estadual, Municipal, Federal ou Particular",
  "TIPO USUARIO": "Atleta, Técnico, Chefe de Delegação, etc. (padrão: Atleta)",
  "FUNCAO": "Função específica (ex.: Goleiro, Pivô, Líbero)",
  "PCD": "Não / Sim - Física / Sim - Visual / Sim - Auditiva / Sim - Intelectual",
  "MODALIDADE": "Nome da modalidade — obrigatório (use o dropdown)",
  "PROVA": "Prova/disciplina — obrigatório. O SIGECOM às vezes embute faixa etária aqui.",
  "COMPETICAO": "Opcional se DATA NASCIMENTO informada. Ex.: '12 a 14 anos Masculino'",
  "STATUS DA INSCRIÇÃO": "'Deferida' = aprovada no SIGECOM. Importar apenas Deferidas.",
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
  // Exemplos realistas baseados no formato do SIGECOM / JER 2026
  const exampleRows = [
    {
      "NOME": "JOÃO DA SILVA SANTOS",
      "CPF": "104.332.181-00",
      "DATA NASCIMENTO": "15/03/2010",  // 15-17 anos (2009–2011)
      "SEXO": "Masculino",
      "RG": "1234567",
      "EMAIL": "",
      "TELEFONE": "(95) 99999-0000",
      "ESCOLA": "Ex: Escola Estadual Exemplo",
      "DELEGAÇÃO": "",
      "ESFERA": "Estadual",
      "TIPO USUARIO": "Atleta",
      "FUNCAO": "",
      "PCD": "Não",
      "MODALIDADE": "Futsal",
      "PROVA": "Partida",
      "COMPETICAO": "15 a 17 anos Masculino",
      "STATUS DA INSCRIÇÃO": "Deferida",
    },
    {
      "NOME": "ANA CAROLINE FERREIRA LIMA",
      "CPF": "960.013.389-14",
      "DATA NASCIMENTO": "08/11/2013",  // 12-14 anos (2012–2014)
      "SEXO": "Feminino",
      "RG": "",
      "EMAIL": "",
      "TELEFONE": "",
      "ESCOLA": "C.E. São Luiz",
      "DELEGAÇÃO": "",
      "ESFERA": "Estadual",
      "TIPO USUARIO": "Atleta",
      "FUNCAO": "",
      "PCD": "Não",
      "MODALIDADE": "Atletismo",
      "PROVA": "100m rasos",
      "COMPETICAO": "12 a 14 anos Feminino",
      "STATUS DA INSCRIÇÃO": "Deferida",
    },
    {
      "NOME": "MARCOS VINICIUS SOUZA",
      "CPF": "083.863.794-99",
      "DATA NASCIMENTO": "22/04/1985",
      "SEXO": "Masculino",
      "RG": "9876543",
      "EMAIL": "marcos.tecnico@escola.rr.gov.br",
      "TELEFONE": "(95) 98888-1234",
      "ESCOLA": "E.E. Monteiro Lobato",
      "DELEGAÇÃO": "",
      "ESFERA": "Estadual",
      "TIPO USUARIO": "Técnico",
      "FUNCAO": "Técnico Principal",
      "PCD": "Não",
      "MODALIDADE": "Futsal",
      "PROVA": "Partida",
      "COMPETICAO": "15 a 17 anos Masculino",
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
    ["📥 ORIGEM DOS DADOS — SIGECOM"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["Esta planilha é projetada para receber dados exportados do SIGECOM."],
    ["Fluxo recomendado:"],
    ["  1. No SIGECOM, exporte a listagem de inscrições da etapa (.xlsx)."],
    ["  2. Faça upload diretamente — o sistema detecta as colunas automaticamente"],
    ["     (reconhece 'NOME DO ALUNO', 'UNIDADE ESCOLAR', 'MODALIDADE', 'PROVA' etc.)."],
    ["  3. Se os cabeçalhos do SIGECOM forem diferentes, use a tela de"],
    ["     mapeamento de colunas que aparece após o upload."],
    ["  4. Revise o resumo de validação e confirme a importação."],
    ["  5. Pendências ficam em Admin → Importação → Pendências para revisão manual."],
    [""],
    ["⚠️ Importe APENAS inscrições com STATUS 'Deferida' ou 'Aprovada'."],
    ["   Indeferidas e Pendentes devem ser excluídas da planilha antes do upload."],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["✅ PREENCHIMENTO MANUAL (se não vier do SIGECOM)"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["1. Cada LINHA = uma inscrição em uma prova."],
    ["   Atleta em 3 provas → 3 linhas (mesma pessoa, mesma escola, provas diferentes)."],
    [""],
    ["2. Campos OBRIGATÓRIOS (cabeçalho VERMELHO):"],
    ["   • NOME — nome completo do participante"],
    ["   • ESCOLA — nome da escola/instituição"],
    ["   • MODALIDADE — modalidade esportiva (use o dropdown ou aba 'Modalidades')"],
    ["   • PROVA — prova específica (use o dropdown ou aba 'Provas')"],
    [""],
    ["3. CATEGORIA (coluna COMPETICAO) é OPCIONAL quando DATA NASCIMENTO é informada."],
    ["   O sistema resolve automaticamente pela faixa etária:"],
    ["     • Nascidos 2012–2014 → 12 a 14 anos"],
    ["     • Nascidos 2009–2011 → 15 a 17 anos"],
    ["   Se COMPETICAO for preenchida, use o formato 'XX a XX anos Masculino/Feminino'."],
    [""],
    ["4. CPF: aceita com ou sem formatação (000.000.000-00 ou só números)."],
    ["   O sistema valida o dígito verificador (Receita Federal)."],
    ["   CPF inválido ou ausente gera pendência — não bloqueia a importação."],
    ["   Sem CPF + nome ambíguo → pendência para revisão manual."],
    [""],
    ["5. DATA NASCIMENTO: formato DD/MM/AAAA (ex.: 08/11/2013)."],
    ["   O sistema também aceita datas no formato numérico do Excel."],
    [""],
    ["6. PROVA no SIGECOM às vezes traz tudo junto (ex.: 'FUTSAL 15 A 17 MASCULINO')."],
    ["   O sistema extrai modalidade, faixa etária e naipe automaticamente desse texto."],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["⚠️ PENDÊNCIAS COMUNS (e como resolver)"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["• SPORT_EVENT_NOT_FOUND — Prova/modalidade não encontrada no catálogo."],
    ["  → Verifique se MODALIDADE e PROVA batem com os nomes das abas de referência."],
    [""],
    ["• CATEGORY_PARSE_FAILED — Categoria não identificada."],
    ["  → Informe DATA NASCIMENTO ou preencha COMPETICAO (ex.: '15 a 17 anos Masculino')."],
    [""],
    ["• CPF_INVALID — Dígito verificador inválido."],
    ["  → Corrija o CPF na planilha e reimporte."],
    [""],
    ["• TM_2012_MANUAL_CATEGORY_SELECTION — Tênis de Mesa com nascidos em 2012."],
    ["  → Requer seleção manual após importar: Admin → Importação → Pendências."],
    [""],
    ["• PERSON_MATCH_AMBIGUOUS — Dois cadastros com mesmo nome/data/sexo."],
    ["  → Informe o CPF para desambiguar."],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["📌 TIPOS DE PARTICIPANTE"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["• Atleta — competidor inscrito na prova (padrão quando TIPO USUARIO em branco)"],
    ["• Técnico — comissão técnica (não compete, mas compõe a delegação)"],
    ["• Chefe de Delegação — responsável oficial pela escola/delegação no evento"],
    ["• Auxiliar / Dirigente / Médico / Fisioterapeuta / Massagista — equipe de apoio"],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["🚀 APÓS PREENCHER / EXPORTAR DO SIGECOM"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["1. Se montou manualmente: apague as 3 linhas de EXEMPLO (cinza claro)."],
    ["2. Salve/exporte como .xlsx (não use .xls antigo ou .csv)."],
    ["3. Acesse Admin → Importação → selecione a Etapa → faça upload."],
    ["4. Confira o resumo de validação (total, pendências, erros) antes de confirmar."],
    ["5. Após importar, acesse Admin → Importação → Pendências para resolver casos manuais."],
    [""],
    ["💡 A importação é IDEMPOTENTE: reimportar a mesma planilha (corrigida) não duplica."],
    ["   Corrija as pendências direto na planilha e reimporte — é seguro."],
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
