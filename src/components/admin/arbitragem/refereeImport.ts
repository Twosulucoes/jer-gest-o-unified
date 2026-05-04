// ============================================================
// Etapa 2.2 — Parser CSV completo de árbitros
// Auditoria: docs/modulos/arbitros-auditoria.md
//
// Reconhece as 20 colunas da planilha-fonte:
//   Nome, CPF, Modalidades, Categorias, Celular, RG, Email, RNE,
//   Sexo, Data Nascimento, CEP, Endereço, Complemento, Bairro,
//   Cidade, UF, Banco, Agência, Conta Corrente, Nacionalidade.
//
// Lógica pura (sem React) — facilita teste e será reutilizada
// pela Etapa 2.3 (edge function `import-referees`).
// ============================================================

export type ImportStatus = "pending" | "ok" | "error" | "duplicate";

export interface RefereeImportRow {
  // Identificação
  full_name: string;
  email: string;
  cpf: string | null;
  rne: string | null;

  // Documentos / pessoais
  rg: string | null;
  birth_date: string | null; // ISO yyyy-mm-dd
  gender: string | null;
  nationality: string | null;

  // Contato
  phone: string | null;

  // Endereço
  zip_code: string | null;
  street_address: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;

  // Bancário
  bank_name: string | null;
  bank_branch: string | null;
  bank_account: string | null;

  // Profissional
  modalities: string | null; // canonicalizado: itens separados por "; "
  categories: string | null;

  // UI / runtime
  status: ImportStatus;
  errorMessage?: string;
  validationErrors: string[];
}

// ------------------------------------------------------------
// Normalizadores
// ------------------------------------------------------------

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalizeHeader = (h: string) =>
  stripDiacritics(h.trim().toLowerCase()).replace(/[^a-z0-9]/g, "");

export const onlyDigits = (s: string | null | undefined): string =>
  (s ?? "").replace(/\D+/g, "");

export const nullIfEmpty = (s: string | null | undefined): string | null => {
  const t = (s ?? "").trim();
  return t.length === 0 ? null : t;
};

/** Valida CPF brasileiro (11 dígitos + dois dígitos verificadores). */
export function isValidCpf(rawCpf: string | null | undefined): boolean {
  const cpf = onlyDigits(rawCpf ?? "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais

  const calcDigit = (slice: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i], 10) * (factorStart - i);
    }
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calcDigit(cpf.slice(0, 9), 10);
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  return d1 === parseInt(cpf[9], 10) && d2 === parseInt(cpf[10], 10);
}

/** Aceita dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd. Retorna ISO ou null. */
export function normalizeDate(input: string | null | undefined): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;

  // ISO já normalizado
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [_, y, mo, d] = m;
    return isValidDateParts(+y, +mo, +d) ? `${y}-${mo}-${d}` : null;
  }

  // Brasileiro
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = "20" + y; // assume 20xx
    const dd = d.padStart(2, "0");
    const mm = mo.padStart(2, "0");
    return isValidDateParts(+y, +mm, +dd) ? `${y}-${mm}-${dd}` : null;
  }

  return null;
}

function isValidDateParts(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** UF: 2 letras maiúsculas. Retorna null se vazio; retorna a string original (uppercased) se inválida (validador acusa). */
export function normalizeUf(input: string | null | undefined): string | null {
  const s = (input ?? "").trim().toUpperCase();
  return s.length === 0 ? null : s;
}

/** CEP: só dígitos. Retorna null se vazio. */
export function normalizeCep(input: string | null | undefined): string | null {
  const digits = onlyDigits(input);
  return digits.length === 0 ? null : digits;
}

/** Telefone: só dígitos. Retorna null se vazio. */
export function normalizePhone(input: string | null | undefined): string | null {
  const digits = onlyDigits(input);
  return digits.length === 0 ? null : digits;
}

/** CPF: só dígitos. Retorna null se vazio. */
export function normalizeCpf(input: string | null | undefined): string | null {
  const digits = onlyDigits(input);
  return digits.length === 0 ? null : digits;
}

/** Lista (modalidades/categorias): split por ; ou , interno; canonicaliza com "; ". */
export function normalizeList(input: string | null | undefined): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  const items = s
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (items.length === 0) return null;
  return items.join("; ");
}

/** Sexo: aceita M/F/Masculino/Feminino/Outro; canonicaliza para M/F/O ou null. */
export function normalizeGender(input: string | null | undefined): string | null {
  const s = stripDiacritics((input ?? "").trim().toLowerCase());
  if (!s) return null;
  if (s === "m" || s.startsWith("masc")) return "M";
  if (s === "f" || s.startsWith("fem")) return "F";
  if (s === "o" || s.startsWith("outr")) return "O";
  return s.toUpperCase().slice(0, 1); // mantém o que veio, validador não bloqueia (campo não tem enum no banco)
}

// ------------------------------------------------------------
// Mapa de aliases por coluna
// ------------------------------------------------------------

type FieldKey =
  | "full_name" | "email" | "cpf" | "rne" | "rg"
  | "phone" | "birth_date" | "gender" | "nationality"
  | "zip_code" | "street_address" | "address_complement"
  | "neighborhood" | "city" | "state"
  | "bank_name" | "bank_branch" | "bank_account"
  | "modalities" | "categories";

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  full_name:          ["nome", "name", "arbitro", "atleta", "nomecompleto"],
  email:              ["email", "mail", "emailaddress"],
  cpf:                ["cpf"],
  rne:                ["rne", "rnm"],
  rg:                 ["rg"],
  phone:              ["celular", "telefone", "tel", "fone", "phone", "whatsapp"],
  birth_date:         ["datanascimento", "datadenascimento", "nascimento", "birthdate", "dtnascimento", "dtnasc"],
  gender:             ["sexo", "genero", "gender"],
  nationality:        ["nacionalidade", "nationality"],
  zip_code:           ["cep", "zip", "zipcode"],
  street_address:     ["endereco", "logradouro", "rua", "street", "streetaddress"],
  address_complement: ["complemento", "complement", "compl"],
  neighborhood:       ["bairro", "neighborhood"],
  city:               ["cidade", "city", "municipio"],
  state:              ["uf", "estado", "state"],
  bank_name:          ["banco", "bank", "bankname", "nomedobanco"],
  bank_branch:        ["agencia", "agency", "bankbranch"],
  bank_account:       ["conta", "contacorrente", "bankaccount", "ccorrente"],
  modalities:         ["modalidades", "modalidade", "esportes"],
  categories:         ["categorias", "categoria"],
};

/** Identifica a coluna do CSV correspondente a cada FieldKey. Retorna -1 se não encontrada. */
function buildHeaderIndex(headers: string[]): Record<FieldKey, number> {
  const normalizedHeaders = headers.map(normalizeHeader);
  const idx = {} as Record<FieldKey, number>;
  (Object.keys(HEADER_ALIASES) as FieldKey[]).forEach((key) => {
    const aliases = HEADER_ALIASES[key];
    let found = -1;
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const h = normalizedHeaders[i];
      if (aliases.some((a) => h === a || h.includes(a))) {
        found = i;
        break;
      }
    }
    idx[key] = found;
  });
  return idx;
}

// ------------------------------------------------------------
// CSV split (suporte a aspas)
// ------------------------------------------------------------

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

// ------------------------------------------------------------
// Validação por linha
// ------------------------------------------------------------

export function validateRow(row: RefereeImportRow): string[] {
  const errors: string[] = [];

  // Nome
  if (!row.full_name || row.full_name.trim().length < 2) {
    errors.push("Nome ausente ou muito curto");
  }

  // Email
  if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push("E-mail inválido");
  }

  // CPF ou RNE obrigatório (alinha ao CHECK que entra na 2.3)
  if (!row.cpf && !row.rne) {
    errors.push("CPF ou RNE obrigatório");
  }

  // Se CPF preenchido, precisa ser válido
  if (row.cpf && !isValidCpf(row.cpf)) {
    errors.push("CPF inválido");
  }

  // Data se preenchida precisa ser válida (parser já retorna null para inválidas; checamos o input bruto via flag)
  // Aqui só conferimos o valor armazenado: se birth_date é null mas o CSV tinha algo, isso vira erro injetado durante o build.

  // UF: se preenchida, precisa ser 2 letras
  if (row.state && !/^[A-Z]{2}$/.test(row.state)) {
    errors.push("UF deve ter 2 letras");
  }

  // CEP: se preenchido, precisa ter 8 dígitos
  if (row.zip_code && row.zip_code.length !== 8) {
    errors.push("CEP deve ter 8 dígitos");
  }

  return errors;
}

// ------------------------------------------------------------
// Parser principal
// ------------------------------------------------------------

export interface ParseResult {
  rows: RefereeImportRow[];
  recognizedColumns: FieldKey[];
  unrecognizedHeaders: string[];
  fatalError?: string;
}

export function parseRefereeCsv(text: string): ParseResult {
  const cleanText = (text ?? "").replace(/^\uFEFF/, "");
  const lines = cleanText.trim().split(/\r?\n/);

  if (lines.length < 2) {
    return {
      rows: [],
      recognizedColumns: [],
      unrecognizedHeaders: [],
      fatalError: "CSV precisa ter cabeçalho e ao menos uma linha de dados.",
    };
  }

  const firstLine = lines[0];
  const sep = firstLine.includes(";") && !firstLine.includes(",") ? ";" :
              firstLine.includes(";") && firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rawHeaders = splitCsvLine(firstLine, sep).map((h) => h.replace(/^"|"$/g, ""));
  const idx = buildHeaderIndex(rawHeaders);

  if (idx.email === -1) {
    return {
      rows: [],
      recognizedColumns: [],
      unrecognizedHeaders: rawHeaders,
      fatalError: "Coluna 'Email' não encontrada no cabeçalho.",
    };
  }

  const recognized: FieldKey[] = (Object.keys(idx) as FieldKey[]).filter((k) => idx[k] !== -1);
  const recognizedIdxSet = new Set(recognized.map((k) => idx[k]));
  const unrecognizedHeaders = rawHeaders.filter((_, i) => !recognizedIdxSet.has(i));

  const rows: RefereeImportRow[] = [];

  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line || !line.trim()) continue;

    const cols = splitCsvLine(line, sep);
    const get = (key: FieldKey): string | undefined => {
      const i = idx[key];
      return i === -1 ? undefined : cols[i];
    };

    // Captura de campos com normalizadores
    const rawBirth = get("birth_date");
    const birth_date = normalizeDate(rawBirth);

    const row: RefereeImportRow = {
      full_name: (get("full_name") ?? "").trim(),
      email: (get("email") ?? "").trim().toLowerCase(),
      cpf: normalizeCpf(get("cpf")),
      rne: nullIfEmpty(get("rne")),
      rg: nullIfEmpty(get("rg")),
      phone: normalizePhone(get("phone")),
      birth_date,
      gender: normalizeGender(get("gender")),
      nationality: nullIfEmpty(get("nationality")),
      zip_code: normalizeCep(get("zip_code")),
      street_address: nullIfEmpty(get("street_address")),
      address_complement: nullIfEmpty(get("address_complement")),
      neighborhood: nullIfEmpty(get("neighborhood")),
      city: nullIfEmpty(get("city")),
      state: normalizeUf(get("state")),
      bank_name: nullIfEmpty(get("bank_name")),
      bank_branch: nullIfEmpty(get("bank_branch")),
      bank_account: nullIfEmpty(get("bank_account")),
      modalities: normalizeList(get("modalities")),
      categories: normalizeList(get("categories")),
      status: "pending",
      validationErrors: [],
    };

    // Erro extra: se a coluna birth_date estava presente e não-vazia, mas não parseou, marca.
    if (rawBirth && rawBirth.trim() && !birth_date) {
      row.validationErrors.push("Data de nascimento inválida (use dd/mm/aaaa)");
    }

    row.validationErrors.push(...validateRow(row));
    rows.push(row);
  }

  return {
    rows,
    recognizedColumns: recognized,
    unrecognizedHeaders,
  };
}

// ------------------------------------------------------------
// Helpers para a UI (sem despejar dados sensíveis em log)
// ------------------------------------------------------------

/** Resumo seguro para console — NUNCA inclui campos bancários. */
export function safeRowSummary(row: RefereeImportRow): Record<string, unknown> {
  return {
    full_name: row.full_name,
    email: row.email,
    has_cpf: !!row.cpf,
    has_rne: !!row.rne,
    has_bank: !!(row.bank_name || row.bank_branch || row.bank_account),
    state: row.state,
    status: row.status,
    errors: row.validationErrors,
  };
}

export const FIELD_LABELS: Record<FieldKey, string> = {
  full_name: "Nome",
  email: "E-mail",
  cpf: "CPF",
  rne: "RNE",
  rg: "RG",
  phone: "Celular",
  birth_date: "Data Nascimento",
  gender: "Sexo",
  nationality: "Nacionalidade",
  zip_code: "CEP",
  street_address: "Endereço",
  address_complement: "Complemento",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "UF",
  bank_name: "Banco",
  bank_branch: "Agência",
  bank_account: "Conta",
  modalities: "Modalidades",
  categories: "Categorias",
};

export const ALL_FIELD_KEYS: FieldKey[] = Object.keys(HEADER_ALIASES) as FieldKey[];
export type { FieldKey };
