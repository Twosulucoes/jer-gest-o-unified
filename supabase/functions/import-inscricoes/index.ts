import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Helpers ─────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const PREPOSITIONS = new Set(["da", "de", "do", "das", "dos"]);

function normalizeName(name: string): string {
  return name.trim()
    .replace(/\s+/g, " ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(" ")
    .map((word, idx) => {
      if (idx > 0 && PREPOSITIONS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function cleanCpfRaw(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const s = String(cpf).trim();
  if (s === "" || s === "---") return null;
  return s;
}

function extractCpfDigits(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  return cpf.replace(/\D/g, "");
}

function validateCpfDigits(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === parseInt(digits[10]);
}

function normalizeGender(value: string | null | undefined): string {
  if (!value) return "male";
  const v = value.toString().trim().toLowerCase();
  if (["f", "feminino", "female", "fem"].includes(v)) return "female";
  if (["m", "masculino", "male", "masc"].includes(v)) return "male";
  return "male";
}

function isBlank(v: unknown): boolean {
  if (v == null) return true;
  const s = String(v).trim();
  return s === "" || s === "---";
}

function getField(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (raw[k] != null && !isBlank(raw[k])) return String(raw[k]).trim();
  }
  return "";
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "number") {
    const date = new Date((value - 25569) * 86400 * 1000);
    const iso = date.toISOString().split("T")[0];
    return isValidDateString(iso) ? iso : null;
  }
  const str = String(value).trim();
  if (str === "" || str === "---") return null;
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const d = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    return isValidDateString(d) ? d : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return isValidDateString(str) ? str : null;
  return null;
}

function isValidDateString(d: string): boolean {
  const date = new Date(d + "T00:00:00Z");
  if (isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  return year >= 1920 && year <= 2020;
}

function buildFingerprint(name: string, birthDate: string | null, gender: string, institution: string, modality: string, prova: string): string {
  const parts = [
    name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_"),
    birthDate || "NO_DOB",
    gender,
    slugify(institution || "NO_INST"),
    slugify(modality || "NO_MOD"),
    slugify(prova || "NO_PROVA"),
  ];
  return parts.join("|");
}

// ─── Types ───────────────────────────────────────────────────────────

interface RawRow { [key: string]: unknown; }

interface NormalizedRow {
  row_number: number;
  full_name: string;
  birth_date: string | null;
  raw_birth_date: string | null;
  gender: string;
  cpf_valid: string | null;
  cpf_raw: string | null;
  rg: string | null;
  email: string | null;
  phone: string | null;
  institution_name: string;
  institution_slug: string;
  sport_name: string;
  sport_slug: string;
  category_name: string;
  category_slug: string;
  prova_name: string;
  prova_slug: string;
  user_type: string;
  inscription_status: string;
  participant_type: string;
  funcao: string;
  pcd: string | null;
  esfera: string;
  raw_payload: Record<string, unknown>;
}

type PendingCode =
  | "CPF_MISSING"
  | "CPF_INVALID"
  | "BIRTH_DATE_MISSING"
  | "BIRTH_DATE_INVALID"
  | "PERSON_MATCH_AMBIGUOUS"
  | "SPORT_EVENT_NOT_FOUND"
  | "INSTITUTION_NOT_FOUND"
  | "MANUAL_REVIEW_REQUIRED";

interface PendingItem {
  row_number: number;
  reason_code: PendingCode;
  reason_detail: string;
  row: NormalizedRow;
  fingerprint: string;
  candidate_person_id: string | null;
}

interface RowClassification {
  status: "ok" | "pendencia" | "erro_bloqueante" | "skip";
  errors: { row: number; field: string; value: unknown; code: string; message: string }[];
  warnings: { row: number; field: string; value: unknown; code: string; message: string }[];
  pending: PendingItem[];
  resolved: Record<string, string | null>;
}

// ─── Column Mapping & Normalization ──────────────────────────────────

const COLUMN_ALIASES: Record<string, string[]> = {
  "NOME": ["NOME", "NOME COMPLETO", "NOME_COMPLETO", "NOME DO ALUNO", "ALUNO"],
  "ESCOLA": ["ESCOLA", "INSTITUICAO", "INSTITUIÇÃO", "UNIDADE ESCOLAR", "ESCOLA/INSTITUICAO"],
  "MODALIDADE": ["MODALIDADE", "ESPORTE", "SPORT", "MOD"],
  "PROVA": ["PROVA", "EVENTO", "DISCIPLINE", "PROVA/EVENTO"],
  "COMPETICAO": ["COMPETICAO", "COMPETIÇÃO", "COMPETIÇÃO/CATEGORIA", "CATEGORIA", "CATEGORY", "COMP"],
};
const REQUIRED_COLUMNS = ["NOME", "ESCOLA", "MODALIDADE", "PROVA"];

function normalizeStr(s: string): string {
  return s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 _/-]/g, " ").replace(/\s+/g, " ");
}

function deriveCategoryFromProva(prova: string): string {
  if (isBlank(prova)) return "";
  const normalized = normalizeStr(prova);
  const ageBand = normalized.match(/\b(\d{1,2}\s*[-/]\s*\d{1,2}\s*ANOS)\b/)?.[1]?.replace(/\s+/g, " ");
  const schoolBand = normalized.match(/\b(INFANTIL|JUVENIL|MIRIM)\b/)?.[1];
  const gender = normalized.match(/\b(FEMININO|MASCULINO|MISTO|MISTA)\b/)?.[1];
  const parts = [ageBand ?? schoolBand, gender === "MISTA" ? "MISTO" : gender].filter(Boolean);
  return parts.join(" ");
}

function normalizeHeaders(rows: RawRow[]): RawRow[] {
  if (rows.length === 0) return rows;
  const firstRowKeys = Object.keys(rows[0]);
  const headerMap = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (firstRowKeys.some((key) => normalizeStr(key) === normalizeStr(canonical))) continue;
    const normalizedAliases = aliases.map((alias) => normalizeStr(alias));
    const found = firstRowKeys.find((key) => normalizedAliases.includes(normalizeStr(key)));
    if (found) headerMap.set(found, canonical);
  }
  return rows.map((row) => {
    const newRow: RawRow = { ...row };
    for (const [original, canonical] of headerMap) {
      if (!(canonical in newRow) && original in newRow) {
        newRow[canonical] = newRow[original];
      }
    }
    if ((!("COMPETICAO" in newRow) || isBlank(newRow["COMPETICAO"])) && !isBlank(newRow["PROVA"])) {
      const derivedCategory = deriveCategoryFromProva(String(newRow["PROVA"]));
      if (derivedCategory) newRow["COMPETICAO"] = derivedCategory;
    }
    return newRow;
  });
}

function deriveParticipantType(userType: string, funcao: string): string {
  const ut = userType.toLowerCase();
  if (ut.includes("atleta")) return "athlete";
  if (funcao.toLowerCase().includes("técnico") || funcao.toLowerCase().includes("tecnico")) return "coach";
  if (funcao.toLowerCase().includes("chefe de delegação") || funcao.toLowerCase().includes("chefe de delegacao")) return "head_of_delegation";
  if (ut.includes("comissão técnica") || ut.includes("comissao tecnica")) return "coach";
  if (ut.includes("prestador")) return "staff";
  return "staff";
}

function mapColumns(raw: RawRow, rowIndex: number): NormalizedRow {
  const fullName = normalizeName(getField(raw, "NOME", "NOME COMPLETO"));
  const institution = getField(raw, "ESCOLA", "INSTITUICAO");
  const sport = getField(raw, "MODALIDADE");
  const category = getField(raw, "COMPETICAO", "CATEGORIA");
  const prova = getField(raw, "PROVA");
  const userType = getField(raw, "TIPO USUARIO", "TIPO_USUARIO");
  const status = getField(raw, "STATUS DA INSCRIÇÃO", "STATUS DA INSCRICAO", "STATUS_INSCRICAO");
  const funcao = getField(raw, "FUNCAO");
  const pcd = getField(raw, "PCD");
  const esfera = getField(raw, "ESFERA");

  const cpfRaw = cleanCpfRaw(getField(raw, "CPF") || null);
  const cpfDigits = extractCpfDigits(cpfRaw);
  const cpfValid = cpfDigits && validateCpfDigits(cpfDigits) ? cpfDigits : null;

  const rawBirthDate = String(raw["DATA NASCIMENTO"] ?? raw["DATA_NASCIMENTO"] ?? "").trim();
  const birthDate = parseDate(raw["DATA NASCIMENTO"] ?? raw["DATA_NASCIMENTO"]);

  return {
    row_number: rowIndex + 2,
    full_name: fullName,
    birth_date: birthDate,
    raw_birth_date: rawBirthDate || null,
    gender: normalizeGender(getField(raw, "SEXO", "GENERO")),
    cpf_valid: cpfValid,
    cpf_raw: cpfRaw,
    rg: getField(raw, "RG") || null,
    email: getField(raw, "EMAIL") || null,
    phone: getField(raw, "TELEFONE") || null,
    institution_name: institution,
    institution_slug: slugify(institution),
    sport_name: sport,
    sport_slug: slugify(sport),
    category_name: category,
    category_slug: slugify(category),
    prova_name: prova,
    prova_slug: slugify(prova),
    user_type: userType,
    inscription_status: status,
    participant_type: deriveParticipantType(userType, funcao),
    funcao,
    pcd: isBlank(pcd) ? null : pcd,
    esfera,
    raw_payload: raw,
  };
}

// ─── READ-ONLY Validation ────────────────────────────────────────────

interface ReadOnlyMaps {
  institutions: Map<string, string>;
  sports: Map<string, string>;
  categories: Map<string, string>;
  sportEvents: Map<string, string>;
  delegations: Map<string, string>;
  existingInstitutionSlugs: Set<string>;
}

async function loadReadOnlyMaps(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
): Promise<ReadOnlyMaps> {
  const [instRes, sportRes, catRes, seRes, delRes] = await Promise.all([
    supabase.from("institutions").select("id, slug").eq("is_active", true),
    supabase.from("sports").select("id, slug").eq("event_id", eventId),
    supabase.from("categories").select("id, slug").eq("event_id", eventId),
    supabase.from("sport_events").select("id, sport_id, category_id, slug").eq("event_id", eventId),
    supabase.from("delegations").select("id, institution_id").eq("event_id", eventId),
  ]);

  const institutions = new Map<string, string>();
  for (const i of instRes.data ?? []) institutions.set(i.slug, i.id);

  const sports = new Map<string, string>();
  for (const s of sportRes.data ?? []) sports.set(s.slug, s.id);

  const categories = new Map<string, string>();
  for (const c of catRes.data ?? []) categories.set(c.slug, c.id);

  const sportEvents = new Map<string, string>();
  for (const se of seRes.data ?? []) {
    sportEvents.set(`${se.sport_id}|${se.category_id}|${se.slug}`, se.id);
  }

  const delegations = new Map<string, string>();
  for (const d of delRes.data ?? []) delegations.set(d.institution_id, d.id);

  return {
    institutions,
    sports,
    categories,
    sportEvents,
    delegations,
    existingInstitutionSlugs: new Set(institutions.keys()),
  };
}

// ─── Incremental People Lookup ───────────────────────────────────────

interface PeopleMaps {
  byCpf: Map<string, string>;                    // cpf_digits -> person_id
  byNameDob: Map<string, string[]>;              // "name|dob|gender" -> person_id[] (supports ambiguity)
}

async function loadPeopleIncremental(
  supabase: ReturnType<typeof createClient>,
  normalizedRows: NormalizedRow[],
): Promise<PeopleMaps> {
  const byCpf = new Map<string, string>();
  const byNameDob = new Map<string, string[]>();

  // Step 1: Collect all valid CPFs from the file
  const validCpfs = [...new Set(normalizedRows.map(r => r.cpf_valid).filter(Boolean))] as string[];

  // Batch lookup by CPF (in chunks of 200 to avoid URI limits)
  for (let i = 0; i < validCpfs.length; i += 200) {
    const batch = validCpfs.slice(i, i + 200);
    const { data } = await supabase.from("people")
      .select("id, full_name, birth_date, gender, cpf")
      .in("cpf", batch);
    for (const p of data ?? []) {
      if (p.cpf) byCpf.set(p.cpf, p.id);
      if (p.full_name && p.birth_date) {
        const key = `${p.full_name.toLowerCase()}|${p.birth_date}|${p.gender}`;
        const arr = byNameDob.get(key) || [];
        arr.push(p.id);
        byNameDob.set(key, arr);
      }
    }
  }

  // Step 2: For rows WITHOUT valid CPF, do targeted name+dob lookup
  const noCpfRows = normalizedRows.filter(r => !r.cpf_valid && r.full_name && r.birth_date);
  const nameKeys = [...new Set(noCpfRows.map(r => r.full_name))];

  for (let i = 0; i < nameKeys.length; i += 50) {
    const batch = nameKeys.slice(i, i + 50);
    const { data } = await supabase.from("people")
      .select("id, full_name, birth_date, gender, cpf")
      .in("full_name", batch)
      .eq("is_active", true);
    for (const p of data ?? []) {
      if (p.cpf && !byCpf.has(p.cpf)) byCpf.set(p.cpf, p.id);
      if (p.full_name && p.birth_date) {
        const key = `${p.full_name.toLowerCase()}|${p.birth_date}|${p.gender}`;
        const arr = byNameDob.get(key) || [];
        if (!arr.includes(p.id)) arr.push(p.id);
        byNameDob.set(key, arr);
      }
    }
  }

  return { byCpf, byNameDob };
}

// ─── Row Classification ──────────────────────────────────────────────

function classifyRow(
  row: NormalizedRow,
  maps: ReadOnlyMaps,
  people: PeopleMaps,
): RowClassification {
  const errors: RowClassification["errors"] = [];
  const warnings: RowClassification["warnings"] = [];
  const pending: PendingItem[] = [];
  const resolved: Record<string, string | null> = {};
  const isAthlete = row.participant_type === "athlete";

  const fingerprint = buildFingerprint(
    row.full_name, row.birth_date, row.gender,
    row.institution_name, row.sport_name, row.prova_name
  );

  // Skip invalid inscription status
  if (row.inscription_status && !["válida", "valida", ""].includes(row.inscription_status.toLowerCase())) {
    warnings.push({ row: row.row_number, field: "STATUS", value: row.inscription_status, code: "INVALID_STATUS", message: `Inscrição com status "${row.inscription_status}" — ignorada` });
    return { status: "skip", errors: [], warnings, pending: [], resolved: {} };
  }

  // Name required
  if (!row.full_name) {
    errors.push({ row: row.row_number, field: "NOME", value: "", code: "NAME_MISSING", message: "Nome obrigatório" });
    return { status: "erro_bloqueante", errors, warnings, pending, resolved };
  }

  // ── CPF classification ──
  if (row.cpf_raw && !row.cpf_valid) {
    pending.push({
      row_number: row.row_number, reason_code: "CPF_INVALID",
      reason_detail: `CPF informado "${row.cpf_raw}" não passou na validação de dígitos`,
      row, fingerprint, candidate_person_id: null,
    });
    return { status: "pendencia", errors, warnings, pending, resolved };
  }

  if (!row.cpf_raw && isAthlete) {
    let candidateId: string | null = null;
    if (row.full_name && row.birth_date) {
      const key = `${row.full_name.toLowerCase()}|${row.birth_date}|${row.gender}`;
      const matches = people.byNameDob.get(key) ?? [];
      if (matches.length === 1) candidateId = matches[0];
    }
    pending.push({
      row_number: row.row_number, reason_code: "CPF_MISSING",
      reason_detail: "Atleta sem CPF — requer resolução manual",
      row, fingerprint, candidate_person_id: candidateId,
    });
    return { status: "pendencia", errors, warnings, pending, resolved };
  }

  // ── CPF missing for non-athlete => ALWAYS pendência ──
  // Decision: comissão técnica sem CPF SEMPRE vai para pendência.
  // Justificativa: evitar criação silenciosa de pessoa definitiva sem identificador único.
  if (!row.cpf_raw && !isAthlete) {
    let candidateId: string | null = null;
    if (row.full_name && row.birth_date) {
      const key = `${row.full_name.toLowerCase()}|${row.birth_date}|${row.gender}`;
      const matches = people.byNameDob.get(key) ?? [];
      if (matches.length === 1) candidateId = matches[0];
      if (matches.length > 1) {
        pending.push({
          row_number: row.row_number, reason_code: "PERSON_MATCH_AMBIGUOUS",
          reason_detail: `Múltiplos matches (${matches.length}) para "${row.full_name}" nascido em ${row.birth_date} — sem CPF`,
          row, fingerprint, candidate_person_id: matches[0],
        });
        return { status: "pendencia", errors, warnings, pending, resolved };
      }
    }
    pending.push({
      row_number: row.row_number, reason_code: "CPF_MISSING",
      reason_detail: `${isAthlete ? "Atleta" : "Comissão técnica"} sem CPF — requer resolução manual`,
      row, fingerprint, candidate_person_id: candidateId,
    });
    return { status: "pendencia", errors, warnings, pending, resolved };
  }

  // ── Birth date ──
  if (isAthlete && !row.birth_date) {
    if (row.raw_birth_date) {
      pending.push({
        row_number: row.row_number, reason_code: "BIRTH_DATE_INVALID",
        reason_detail: `Data de nascimento "${row.raw_birth_date}" não pôde ser interpretada`,
        row, fingerprint, candidate_person_id: null,
      });
    } else {
      pending.push({
        row_number: row.row_number, reason_code: "BIRTH_DATE_MISSING",
        reason_detail: "Atleta sem data de nascimento",
        row, fingerprint, candidate_person_id: null,
      });
    }
    return { status: "pendencia", errors, warnings, pending, resolved };
  }

  if (!isAthlete && !row.birth_date) {
    warnings.push({ row: row.row_number, field: "DATA NASCIMENTO", value: null, code: "DOB_MISSING_STAFF", message: "Comissão técnica sem data de nascimento" });
  }

  // ── Institution ──
  const instId = maps.institutions.get(row.institution_slug);
  if (!instId) {
    if (!row.institution_slug) {
      if (isAthlete) {
        errors.push({ row: row.row_number, field: "ESCOLA", value: "", code: "INSTITUTION_MISSING", message: "Escola obrigatória" });
        return { status: "erro_bloqueante", errors, warnings, pending, resolved };
      } else {
        warnings.push({ row: row.row_number, field: "ESCOLA", value: "", code: "INSTITUTION_MISSING_STAFF", message: "Comissão sem escola — ignorada" });
        return { status: "skip", errors, warnings, pending, resolved };
      }
    }
    resolved.institution_slug = row.institution_slug;
    resolved.institution_name = row.institution_name;
    resolved.institution_will_create = "true";
  } else {
    resolved.institution_id = instId;
  }

  // ── Delegation ──
  if (resolved.institution_id) {
    const delId = maps.delegations.get(resolved.institution_id);
    if (delId) {
      resolved.delegation_id = delId;
    } else {
      resolved.delegation_will_create = "true";
    }
  } else {
    resolved.delegation_will_create = "true";
  }

  // ── Sport / Category / Sport Event (athletes only, NO auto-create) ──
  if (isAthlete) {
    if (!row.sport_slug) {
      errors.push({ row: row.row_number, field: "MODALIDADE", value: "", code: "SPORT_MISSING", message: "Modalidade obrigatória para atletas" });
      return { status: "erro_bloqueante", errors, warnings, pending, resolved };
    }
    const sportId = maps.sports.get(row.sport_slug);
    if (!sportId) {
      pending.push({
        row_number: row.row_number, reason_code: "SPORT_EVENT_NOT_FOUND",
        reason_detail: `Modalidade "${row.sport_name}" (slug: ${row.sport_slug}) não encontrada no catálogo do evento`,
        row, fingerprint, candidate_person_id: null,
      });
      return { status: "pendencia", errors, warnings, pending, resolved };
    }
    resolved.sport_id = sportId;

    if (!row.category_slug) {
      errors.push({ row: row.row_number, field: "COMPETICAO", value: "", code: "CATEGORY_MISSING", message: "Categoria obrigatória para atletas" });
      return { status: "erro_bloqueante", errors, warnings, pending, resolved };
    }
    const catId = maps.categories.get(row.category_slug);
    if (!catId) {
      pending.push({
        row_number: row.row_number, reason_code: "SPORT_EVENT_NOT_FOUND",
        reason_detail: `Categoria "${row.category_name}" (slug: ${row.category_slug}) não encontrada no catálogo do evento`,
        row, fingerprint, candidate_person_id: null,
      });
      return { status: "pendencia", errors, warnings, pending, resolved };
    }
    resolved.category_id = catId;

    if (!row.prova_slug) {
      warnings.push({ row: row.row_number, field: "PROVA", value: null, code: "PROVA_EMPTY", message: "Nenhuma prova — linha ignorada" });
      return { status: "skip", errors, warnings, pending, resolved };
    }

    const seKey = `${sportId}|${catId}|${row.prova_slug}`;
    const seId = maps.sportEvents.get(seKey);
    if (!seId) {
      pending.push({
        row_number: row.row_number, reason_code: "SPORT_EVENT_NOT_FOUND",
        reason_detail: `Prova "${row.prova_name}" (${row.sport_name} / ${row.category_name}) não encontrada no catálogo do evento`,
        row, fingerprint, candidate_person_id: null,
      });
      return { status: "pendencia", errors, warnings, pending, resolved };
    }
    resolved.sport_event_id = seId;
  }

  // ── Person deduplication ──
  if (row.cpf_valid) {
    const existingId = people.byCpf.get(row.cpf_valid);
    if (existingId) {
      resolved.person_id = existingId;
      resolved.person_action = "reuse";
    } else {
      resolved.person_action = "create";
    }

    // Even with valid CPF, check name+dob ambiguity for safety
    if (row.full_name && row.birth_date) {
      const key = `${row.full_name.toLowerCase()}|${row.birth_date}|${row.gender}`;
      const matches = people.byNameDob.get(key) ?? [];
      if (matches.length > 1) {
        // Multiple people with same name+dob+gender — warn but proceed since CPF is definitive
        warnings.push({ row: row.row_number, field: "NOME", value: row.full_name, code: "AMBIGUITY_WARNING", message: `${matches.length} pessoas com mesmo nome+nascimento+sexo, mas CPF é único — prosseguindo` });
      }
    }
  }
  // Note: non-athlete without CPF already routed to pendência above

  return { status: "ok", errors, warnings, pending, resolved };
}

// ─── Main Handler ────────────────────────────────────────────────────

const MAX_ROWS = 10000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const operatorId = claimsData.claims.sub as string;

    const body = await req.json();
    let { rows: rawRows, event_id: eventId, event_stage_id: eventStageId, mode, file_name: fileName } = body as {
      rows: RawRow[]; event_id: string; event_stage_id?: string; mode: string; file_name?: string;
    };

    rawRows = normalizeHeaders(rawRows);

    if (!rawRows || !eventId || !mode) {
      return new Response(JSON.stringify({ error: "Missing required fields: rows, event_id, mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!eventStageId) {
      return new Response(JSON.stringify({ error: "event_stage_id é obrigatório. Selecione a etapa antes de validar/importar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (mode !== "validate" && mode !== "commit") {
      return new Response(JSON.stringify({ error: 'mode must be "validate" or "commit"' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (rawRows.length === 0) {
      return new Response(JSON.stringify({ error: "Planilha vazia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (rawRows.length > MAX_ROWS) {
      return new Response(JSON.stringify({ error: `Planilha excede o limite de ${MAX_ROWS} linhas` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate required columns
    const headers = Object.keys(rawRows[0]);
    const normalizedHdrs = headers.map(h => normalizeStr(h));
    const missingCols = REQUIRED_COLUMNS.filter(col => {
      if (headers.includes(col)) return false;
      const aliases = COLUMN_ALIASES[col] || [col];
      return !aliases.some(alias => normalizedHdrs.includes(normalizeStr(alias)));
    });
    if (missingCols.length > 0) {
      return new Response(JSON.stringify({ error: `Colunas obrigatórias ausentes: ${missingCols.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify event exists
    const { data: eventData, error: eventError } = await serviceClient
      .from("events").select("id, name, year").eq("id", eventId).maybeSingle();
    if (eventError || !eventData) {
      return new Response(JSON.stringify({ error: `Evento não encontrado: ${eventId}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify event_stage exists AND belongs to the event
    const { data: stageData, error: stageError } = await serviceClient
      .from("event_stages").select("id, event_id, name, slug").eq("id", eventStageId).maybeSingle();
    if (stageError || !stageData) {
      return new Response(JSON.stringify({ error: `Etapa não encontrada: ${eventStageId}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (stageData.event_id !== eventId) {
      return new Response(JSON.stringify({
        error: `Etapa "${stageData.name}" não pertence ao evento selecionado.`,
        stage_event_id: stageData.event_id,
        provided_event_id: eventId,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Normalize rows
    const normalizedRows = rawRows.map((raw, i) => mapColumns(raw, i));

    // Load READ-ONLY maps (no writes!)
    const maps = await loadReadOnlyMaps(serviceClient, eventId);

    // Load people INCREMENTALLY (not full-table scan)
    const people = await loadPeopleIncremental(serviceClient, normalizedRows);

    // Classify each row
    const allErrors: RowClassification["errors"] = [];
    const allWarnings: RowClassification["warnings"] = [];
    const allPending: PendingItem[] = [];
    const validRows: { row: NormalizedRow; resolved: Record<string, string | null> }[] = [];
    let skippedRows = 0;

    let cpfsValidos = 0, cpfsInvalidos = 0, cpfsMissing = 0;
    let cpfsReutilizados = 0, cpfsNovos = 0;
    let datasInvalidas = 0;
    let seNaoEncontrados = 0;
    const institutionsToCreate = new Set<string>();
    const delegationsToCreate = new Set<string>();

    for (const row of normalizedRows) {
      const result = classifyRow(row, maps, people);
      allWarnings.push(...result.warnings);

      if (result.status === "skip") { skippedRows++; continue; }

      if (result.status === "erro_bloqueante") {
        allErrors.push(...result.errors);
        continue;
      }

      if (result.status === "pendencia") {
        allPending.push(...result.pending);
        for (const p of result.pending) {
          if (p.reason_code === "CPF_INVALID") cpfsInvalidos++;
          if (p.reason_code === "CPF_MISSING") cpfsMissing++;
          if (p.reason_code === "BIRTH_DATE_MISSING" || p.reason_code === "BIRTH_DATE_INVALID") datasInvalidas++;
          if (p.reason_code === "SPORT_EVENT_NOT_FOUND") seNaoEncontrados++;
        }
        continue;
      }

      // ok
      allErrors.push(...result.errors);
      validRows.push({ row, resolved: result.resolved });

      if (row.cpf_valid) cpfsValidos++;
      if (result.resolved.person_action === "reuse") cpfsReutilizados++;
      if (result.resolved.person_action === "create") cpfsNovos++;
      if (result.resolved.institution_will_create === "true") institutionsToCreate.add(row.institution_slug);
      if (result.resolved.delegation_will_create === "true") delegationsToCreate.add(row.institution_slug);
    }

    const validateResponse = {
      status: "validated",
      operator_id: operatorId,
      event_id: eventId,
      event_stage_id: eventStageId,
      event_stage: { id: stageData.id, name: stageData.name, slug: stageData.slug },
      event: { id: eventData.id, name: eventData.name, year: eventData.year },
      file_name: fileName || null,
      timestamp: new Date().toISOString(),
      summary: {
        total_linhas: rawRows.length,
        ok_para_importar: validRows.length,
        pendencias: allPending.length,
        erros_bloqueantes: allErrors.length,
        skipped_rows: skippedRows,
        warnings: allWarnings.length,
      },
      counters: {
        novos_cpfs_validos: cpfsNovos,
        cpfs_existentes_reutilizados: cpfsReutilizados,
        pessoas_sem_cpf: cpfsMissing,
        cpfs_invalidos: cpfsInvalidos,
        datas_invalidas: datasInvalidas,
        sport_events_nao_encontrados: seNaoEncontrados,
        institutions_que_seriam_criadas: institutionsToCreate.size,
        delegations_que_seriam_criadas: delegationsToCreate.size,
      },
      errors: allErrors.slice(0, 50),
      warnings: allWarnings.slice(0, 50),
      pendencias_preview: allPending.slice(0, 20).map(p => ({
        row_number: p.row_number,
        reason_code: p.reason_code,
        reason_detail: p.reason_detail,
        fingerprint: p.fingerprint,
        normalized_name: p.row.full_name,
        cpf_raw: p.row.cpf_raw,
        candidate_person_id: p.candidate_person_id,
      })),
      institutions_preview: [...institutionsToCreate].slice(0, 10),
    };

    // ── VALIDATE MODE: return without writing anything ──
    if (mode === "validate") {
      return new Response(JSON.stringify(validateResponse),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── COMMIT MODE ──
    if (allErrors.length > 0) {
      return new Response(JSON.stringify({
        status: "rejected",
        message: `Não é possível gravar: ${allErrors.length} erro(s) bloqueante(s).`,
        errors: allErrors,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create import log first (com source_phase_* denormalizado para auditoria)
    const { data: logData } = await serviceClient.from("import_logs").insert({
      event_id: eventId,
      event_stage_id: eventStageId,
      source_phase_name: stageData.name,
      source_phase_slug: stageData.slug,
      performed_by: operatorId,
      file_name: fileName || "unknown",
      row_count: rawRows.length,
      status: "processing",
    }).select("id").single();
    const importLogId = logData?.id;

    // ── Write pendencias ──
    if (allPending.length > 0) {
      const pendBatch = allPending.map(p => ({
        event_id: eventId,
        event_stage_id: eventStageId,
        source_phase_name: stageData.name,
        source_phase_slug: stageData.slug,
        import_log_id: importLogId,
        source_file_name: fileName || null,
        source_row_number: p.row_number,
        raw_payload_json: p.row.raw_payload,
        normalized_name: p.row.full_name,
        raw_cpf: p.row.cpf_raw,
        raw_birth_date: p.row.raw_birth_date,
        modality_raw: p.row.sport_name,
        prova_raw: p.row.prova_name,
        institution_raw: p.row.institution_name,
        pending_reason_code: p.reason_code,
        pending_reason_detail: p.reason_detail,
        fallback_fingerprint: p.fingerprint,
        candidate_person_id: p.candidate_person_id,
        resolution_status: "pending",
      }));

      for (let i = 0; i < pendBatch.length; i += 100) {
        await serviceClient.from("import_pendencias").insert(pendBatch.slice(i, i + 100));
      }
    }

    // ── Create institutions (only on commit, NO hardcoded network_type) ──
    const newInstMap = new Map<string, string>();
    for (const slug of institutionsToCreate) {
      const name = validRows.find(r => r.row.institution_slug === slug)?.row.institution_name || slug;
      const { data, error } = await serviceClient.from("institutions")
        .insert({ name, slug, network_type: "pending_review" }).select("id").single();
      if (error) {
        const { data: existing } = await serviceClient.from("institutions")
          .select("id").eq("slug", slug).single();
        if (existing) newInstMap.set(slug, existing.id);
      } else {
        newInstMap.set(slug, data.id);
      }
    }

    const allInstMap = new Map(maps.institutions);
    for (const [slug, id] of newInstMap) allInstMap.set(slug, id);

    // ── Create delegations (only on commit) ──
    const newDelMap = new Map<string, string>();
    let delegationsCreated = 0;
    for (const slug of delegationsToCreate) {
      const instId = allInstMap.get(slug);
      if (!instId) continue;
      if (maps.delegations.has(instId)) continue;
      const { data, error } = await serviceClient.from("delegations")
        .insert({ institution_id: instId, event_id: eventId, status: "confirmed" }).select("id").single();
      if (error) {
        const { data: existing } = await serviceClient.from("delegations")
          .select("id").eq("institution_id", instId).eq("event_id", eventId).single();
        if (existing) newDelMap.set(instId, existing.id);
      } else {
        newDelMap.set(instId, data.id);
        delegationsCreated++;
      }
    }

    const allDelMap = new Map(maps.delegations);
    for (const [instId, delId] of newDelMap) allDelMap.set(instId, delId);

    // ── Process valid rows ──
    let peopleCreated = 0, peopleReused = 0;
    let participantsCreated = 0, participantsReused = 0;
    let pseCreated = 0, pseReused = 0;
    let pesCreated = 0, pesReused = 0;
    let rowsFailed = 0;
    let rowsSkippedDuplicate = 0;
    const commitErrors: { row_number: number; error_code: string; error_message: string }[] = [];
    const processedPersonKeys = new Set<string>();

    // Load existing participants for this event
    const { data: existingParticipants } = await serviceClient
      .from("participants").select("id, person_id").eq("event_id", eventId);
    const participantByPerson = new Map<string, string>();
    for (const p of existingParticipants ?? []) participantByPerson.set(p.person_id, p.id);

    // Load existing PSEs for this event (now scoped by event_stage_id for triple uniqueness)
    const { data: existingPSE } = await serviceClient
      .from("participant_sport_events").select("id, participant_id, sport_event_id, event_stage_id")
      .in("participant_id", [...participantByPerson.values(), "00000000-0000-0000-0000-000000000000"]);
    const pseSet = new Set<string>();
    for (const p of existingPSE ?? []) {
      pseSet.add(`${p.participant_id}|${p.sport_event_id}|${p.event_stage_id ?? "null"}`);
    }

    // Load existing participant_event_stages for THIS stage
    const { data: existingPES } = await serviceClient
      .from("participant_event_stages").select("participant_id").eq("event_stage_id", eventStageId);
    const pesSet = new Set<string>();
    for (const r of existingPES ?? []) pesSet.add(r.participant_id);

    for (const { row, resolved } of validRows) {
      try {
        const instId = resolved.institution_id || allInstMap.get(row.institution_slug);
        const delId = instId ? (resolved.delegation_id || allDelMap.get(instId)) : null;

        if (!instId || !delId) {
          commitErrors.push({ row_number: row.row_number, error_code: "DELEGATION_FAILED", error_message: "Não conseguiu resolver delegação" });
          rowsFailed++;
          continue;
        }

        // ── Person ──
        const personKey = row.cpf_valid!; // All valid rows now have cpf_valid (no-CPF goes to pendência)
        let personId = resolved.person_id || null;

        if (resolved.person_action === "create") {
          if (processedPersonKeys.has(personKey)) {
            const { data: lookupData } = await serviceClient.from("people").select("id").eq("cpf", row.cpf_valid!).single();
            if (lookupData) { personId = lookupData.id; peopleReused++; }
          } else {
            processedPersonKeys.add(personKey);
            const { data: newPerson, error: personErr } = await serviceClient.from("people").insert({
              full_name: row.full_name,
              birth_date: row.birth_date,
              gender: row.gender,
              cpf: row.cpf_valid,
              rg: row.rg,
              email: row.email,
              phone: row.phone,
              institution_id: instId,
              disability_type: row.pcd,
            }).select("id").single();
            if (personErr) {
              if (row.cpf_valid) {
                const { data: existing } = await serviceClient.from("people").select("id").eq("cpf", row.cpf_valid).single();
                if (existing) { personId = existing.id; peopleReused++; }
                else { commitErrors.push({ row_number: row.row_number, error_code: "PERSON_CREATE_FAILED", error_message: personErr.message }); rowsFailed++; continue; }
              } else {
                commitErrors.push({ row_number: row.row_number, error_code: "PERSON_CREATE_FAILED", error_message: personErr.message }); rowsFailed++; continue;
              }
            } else {
              personId = newPerson.id;
              peopleCreated++;
              if (row.cpf_valid) people.byCpf.set(row.cpf_valid, personId);
            }
          }
        } else {
          peopleReused++;
        }

        if (!personId) {
          commitErrors.push({ row_number: row.row_number, error_code: "PERSON_MISSING", error_message: "Pessoa não resolvida" });
          rowsFailed++;
          continue;
        }

        // ── Participant ──
        let participantId = participantByPerson.get(personId);
        if (participantId) {
          participantsReused++;
        } else {
          const { data: newPart, error: partErr } = await serviceClient.from("participants").insert({
            person_id: personId,
            event_id: eventId,
            delegation_id: delId,
            participant_type: row.participant_type,
            status: "confirmed",
          }).select("id").single();
          if (partErr) {
            const { data: existing } = await serviceClient.from("participants")
              .select("id").eq("person_id", personId).eq("event_id", eventId).single();
            if (existing) { participantId = existing.id; participantsReused++; }
            else { commitErrors.push({ row_number: row.row_number, error_code: "PARTICIPANT_FAILED", error_message: partErr.message }); rowsFailed++; continue; }
          } else {
            participantId = newPart.id;
            participantsCreated++;
            participantByPerson.set(personId, participantId);
          }
        }

        // ── Participant ↔ Stage (rastreabilidade operacional por etapa) ──
        if (!pesSet.has(participantId)) {
          const { error: pesErr } = await serviceClient.from("participant_event_stages").insert({
            participant_id: participantId,
            event_stage_id: eventStageId,
            event_id: eventId,
            status: "active",
            created_by: operatorId,
          });
          if (pesErr) {
            if (pesErr.message?.includes("duplicate") || pesErr.message?.includes("unique")) {
              pesReused++;
            } else {
              // não bloqueante; registra como warning
              allWarnings.push({ row: row.row_number, field: "STAGE", value: eventStageId, code: "PES_INSERT_FAILED", message: pesErr.message });
            }
          } else {
            pesCreated++;
            pesSet.add(participantId);
          }
        } else {
          pesReused++;
        }

        // ── Participant Sport Event (athletes only) — agora único por (participant, sport_event, stage) ──
        if (row.participant_type === "athlete" && resolved.sport_event_id) {
          const pseKey = `${participantId}|${resolved.sport_event_id}|${eventStageId}`;
          if (pseSet.has(pseKey)) {
            pseReused++;
            rowsSkippedDuplicate++;
          } else {
            const { error: pseErr } = await serviceClient.from("participant_sport_events").insert({
              participant_id: participantId,
              sport_event_id: resolved.sport_event_id,
              event_stage_id: eventStageId,
              status: "confirmed",
            });
            if (pseErr) {
              if (pseErr.message?.includes("duplicate") || pseErr.message?.includes("unique")) {
                pseReused++;
                rowsSkippedDuplicate++;
              } else {
                commitErrors.push({ row_number: row.row_number, error_code: "PSE_FAILED", error_message: pseErr.message });
                rowsFailed++;
              }
            } else {
              pseCreated++;
              pseSet.add(pseKey);
            }
          }
        }
      } catch (rowErr) {
        commitErrors.push({ row_number: row.row_number, error_code: "UNEXPECTED", error_message: String(rowErr) });
        rowsFailed++;
      }
    }

    // Update import log
    const finalStatus = rowsFailed > 0 ? (validRows.length - rowsFailed > 0 ? "partial" : "error") : "success";
    const resultSummary = {
      people_created: peopleCreated,
      people_reused: peopleReused,
      participants_created: participantsCreated,
      participants_reused: participantsReused,
      participant_event_stages_created: pesCreated,
      participant_event_stages_reused: pesReused,
      participant_sport_events_created: pseCreated,
      participant_sport_events_reused: pseReused,
      institutions_created: newInstMap.size,
      delegations_created: delegationsCreated,
      pendencias_created: allPending.length,
      rows_skipped_as_duplicate: rowsSkippedDuplicate,
      rows_failed: rowsFailed,
    };

    if (importLogId) {
      await serviceClient.from("import_logs").update({
        status: finalStatus,
        result_summary: resultSummary,
      }).eq("id", importLogId);
    }

    if (commitErrors.length > 0) {
      const errBatch = commitErrors.map(e => ({
        event_id: eventId,
        import_log_id: importLogId,
        row_number: e.row_number,
        error_code: e.error_code,
        error_message: e.error_message,
        entity: "commit",
      }));
      for (let i = 0; i < errBatch.length; i += 100) {
        await serviceClient.from("import_row_errors").insert(errBatch.slice(i, i + 100));
      }
    }

    return new Response(JSON.stringify({
      status: finalStatus === "success" ? "committed" : finalStatus,
      partial_success: finalStatus === "partial",
      operator_id: operatorId,
      event_id: eventId,
      event_stage_id: eventStageId,
      event_stage: { id: stageData.id, name: stageData.name, slug: stageData.slug },
      event: { id: eventData.id, name: eventData.name, year: eventData.year },
      file_name: fileName || null,
      timestamp: new Date().toISOString(),
      result: resultSummary,
      errors_preview: commitErrors.slice(0, 20),
      warnings: allWarnings.slice(0, 30),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("import-inscricoes error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// redeploy marker: 2026-04-16T20:35Z (event_stages support)

// redeploy marker: 2026-04-16T16:00Z
