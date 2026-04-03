import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Constants ───────────────────────────────────────────────────────
const MAX_ROWS = 3000;

// ─── Helpers ─────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function capitalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function cleanCpf(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const cleaned = cpf.replace(/\D/g, "");
  return cleaned.length === 11 ? cleaned : null;
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "number") {
    // Excel serial date
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  const str = String(value).trim();
  // Try DD/MM/YYYY
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}

function normalizeGender(value: string | null | undefined): string {
  if (!value) return "male";
  const v = value.toString().trim().toLowerCase();
  if (["f", "feminino", "female", "fem"].includes(v)) return "female";
  if (["m", "masculino", "male", "masc"].includes(v)) return "male";
  return "male";
}

// ─── Types ───────────────────────────────────────────────────────────

interface RawRow {
  [key: string]: unknown;
}

interface NormalizedRow {
  row_number: number;
  full_name: string;
  birth_date: string | null;
  gender: string;
  cpf: string | null;
  rg: string | null;
  email: string | null;
  phone: string | null;
  institution_slug: string;
  sport_slug: string;
  category_slug: string;
  sport_event_name: string;
  sport_event_slug: string;
  user_type: string;
  inscription_status: string;
  raw: RawRow;
}

interface RowResult {
  row: number;
  field: string;
  value: unknown;
  code: string;
  message: string;
}

interface ReferenceMaps {
  institutions: Map<string, string>;
  delegations: Map<string, string>;
  sports: Map<string, string>;
  categories: Map<string, string>;
  peopleByCpf: Map<string, { id: string; full_name: string; birth_date: string }>;
  peopleByNameDob: Map<string, string>;
}

// ─── XLSX Parsing ────────────────────────────────────────────────────

function parseXlsx(buffer: ArrayBuffer): RawRow[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: null }) as RawRow[];
}

// ─── Header Validation ──────────────────────────────────────────────

const REQUIRED_COLUMNS = ["NOME", "DATA NASCIMENTO", "SEXO", "ESCOLA", "MODALIDADE", "PROVA", "COMPETICAO"];

function validateHeaders(rawRows: RawRow[]): string[] {
  if (rawRows.length === 0) return [];
  const headers = Object.keys(rawRows[0]);
  const missing: string[] = [];
  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      missing.push(col);
    }
  }
  return missing;
}

// ─── Column Mapping ──────────────────────────────────────────────────

function getField(raw: RawRow, ...keys: string[]): string {
  for (const k of keys) {
    if (raw[k] != null && String(raw[k]).trim() !== "" && String(raw[k]).trim() !== "---") {
      return String(raw[k]).trim();
    }
  }
  return "";
}

function mapColumns(raw: RawRow, rowIndex: number): NormalizedRow {
  const fullName = capitalize(getField(raw, "NOME", "NOME COMPLETO", "NOME_COMPLETO"));
  const institution = getField(raw, "ESCOLA", "INSTITUICAO");
  const sport = getField(raw, "MODALIDADE");
  const category = getField(raw, "COMPETICAO", "CATEGORIA");
  const prova = getField(raw, "PROVA");
  const userType = getField(raw, "TIPO USUARIO", "TIPO_USUARIO").toLowerCase();
  const status = getField(raw, "STATUS DA INSCRIÇÃO", "STATUS DA INSCRICAO", "STATUS_INSCRICAO");

  return {
    row_number: rowIndex + 2,
    full_name: fullName,
    birth_date: parseDate(raw["DATA NASCIMENTO"] ?? raw["DATA_NASCIMENTO"] ?? raw["NASCIMENTO"]),
    gender: normalizeGender(getField(raw, "SEXO", "GENERO")),
    cpf: cleanCpf(getField(raw, "CPF") || null),
    rg: getField(raw, "RG") || null,
    email: getField(raw, "EMAIL") || null,
    phone: getField(raw, "TELEFONE") || null,
    institution_slug: slugify(institution),
    sport_slug: slugify(sport),
    category_slug: slugify(category),
    sport_event_name: prova,
    sport_event_slug: slugify(prova),
    user_type: userType,
    inscription_status: status,
    raw,
  };
}

// ─── Reference Data Loading ──────────────────────────────────────────

async function loadReferenceMaps(
  supabase: ReturnType<typeof createClient>,
  eventId: string
): Promise<ReferenceMaps> {
  const [instRes, delRes, sportRes, catRes, peopleRes] = await Promise.all([
    supabase.from("institutions").select("id, slug").eq("is_active", true),
    supabase.from("delegations").select("id, institution_id").eq("event_id", eventId),
    supabase.from("sports").select("id, slug").eq("event_id", eventId),
    supabase.from("categories").select("id, slug").eq("event_id", eventId),
    supabase.from("people").select("id, full_name, birth_date, gender, cpf").eq("is_active", true),
  ]);

  const institutions = new Map<string, string>();
  for (const i of instRes.data ?? []) institutions.set(i.slug, i.id);

  const delegations = new Map<string, string>();
  for (const d of delRes.data ?? []) delegations.set(d.institution_id, d.id);

  const sports = new Map<string, string>();
  for (const s of sportRes.data ?? []) sports.set(s.slug, s.id);

  const categories = new Map<string, string>();
  for (const c of catRes.data ?? []) categories.set(c.slug, c.id);

  const peopleByCpf = new Map<string, { id: string; full_name: string; birth_date: string }>();
  const peopleByNameDob = new Map<string, string>();
  for (const p of peopleRes.data ?? []) {
    if (p.cpf) peopleByCpf.set(p.cpf, { id: p.id, full_name: p.full_name, birth_date: p.birth_date });
    peopleByNameDob.set(`${p.full_name.toLowerCase()}|${p.birth_date}|${p.gender}`, p.id);
  }

  return { institutions, delegations, sports, categories, peopleByCpf, peopleByNameDob };
}

// ─── Row Validation ──────────────────────────────────────────────────

function validateRow(
  row: NormalizedRow,
  refs: ReferenceMaps
): { errors: RowResult[]; warnings: RowResult[]; resolved: Record<string, string | null>; skip: boolean } {
  const errors: RowResult[] = [];
  const warnings: RowResult[] = [];
  const resolved: Record<string, string | null> = {};

  // Skip non-athlete rows (coaches, staff, etc.)
  if (row.user_type && row.user_type !== "atleta") {
    return { errors: [], warnings: [], resolved: {}, skip: true };
  }

  // Skip rows with invalid inscription status
  if (row.inscription_status && row.inscription_status.toLowerCase() !== "válida" && row.inscription_status.toLowerCase() !== "valida") {
    warnings.push({ row: row.row_number, field: "STATUS DA INSCRIÇÃO", value: row.inscription_status, code: "INVALID_STATUS", message: `Inscrição com status "${row.inscription_status}" — ignorada` });
    return { errors: [], warnings, resolved: {}, skip: true };
  }

  // Required fields
  if (!row.full_name) {
    errors.push({ row: row.row_number, field: "NOME", value: row.full_name, code: "NAME_MISSING", message: "Nome obrigatório" });
  }
  if (!row.birth_date) {
    errors.push({ row: row.row_number, field: "DATA NASCIMENTO", value: null, code: "DOB_MISSING", message: "Data de nascimento obrigatória" });
  }

  // Institution
  const instId = refs.institutions.get(row.institution_slug);
  if (!instId) {
    errors.push({ row: row.row_number, field: "ESCOLA", value: row.institution_slug, code: "INSTITUTION_NOT_FOUND", message: "Instituição não encontrada" });
  } else {
    resolved.institution_id = instId;
    const delId = refs.delegations.get(instId);
    if (!delId) {
      errors.push({ row: row.row_number, field: "DELEGAÇÃO", value: instId, code: "DELEGATION_NOT_FOUND", message: "Delegação não encontrada para esta instituição/evento" });
    } else {
      resolved.delegation_id = delId;
    }
  }

  // Sport
  const sportId = refs.sports.get(row.sport_slug);
  if (!sportId) {
    errors.push({ row: row.row_number, field: "MODALIDADE", value: row.sport_slug, code: "SPORT_NOT_FOUND", message: "Modalidade não encontrada" });
  } else {
    resolved.sport_id = sportId;
  }

  // Category
  const catId = refs.categories.get(row.category_slug);
  if (!catId) {
    errors.push({ row: row.row_number, field: "COMPETICAO", value: row.category_slug, code: "CATEGORY_NOT_FOUND", message: "Categoria não encontrada" });
  } else {
    resolved.category_id = catId;
  }

  // Sport event name
  if (!row.sport_event_name) {
    errors.push({ row: row.row_number, field: "PROVA", value: null, code: "PROVA_MISSING", message: "Nome da prova obrigatório" });
  }

  // CPF resolution
  if (row.cpf) {
    const existing = refs.peopleByCpf.get(row.cpf);
    if (existing) {
      resolved.person_id = existing.id;
      resolved.person_action = "reuse";
    } else {
      resolved.person_id = null;
      resolved.person_action = "create";
    }
  } else {
    warnings.push({ row: row.row_number, field: "CPF", value: null, code: "CPF_MISSING", message: "CPF ausente — será localizado por nome+nascimento" });
    if (row.full_name && row.birth_date) {
      const key = `${row.full_name.toLowerCase()}|${row.birth_date}|${row.gender}`;
      const existingId = refs.peopleByNameDob.get(key);
      if (existingId) {
        resolved.person_id = existingId;
        resolved.person_action = "reuse";
      } else {
        resolved.person_id = null;
        resolved.person_action = "create";
      }
    } else {
      resolved.person_id = null;
      resolved.person_action = "create";
    }
  }

  return { errors, warnings, resolved, skip: false };
}

// ─── Build Commit Payload ────────────────────────────────────────────

interface ProcessedRow {
  row: NormalizedRow;
  resolved: Record<string, string | null>;
}

function buildCommitPayload(validRows: ProcessedRow[], eventId: string) {
  const peopleToCreate: Record<string, unknown>[] = [];
  const seenPeopleKeys = new Set<string>();
  const enrollments: {
    person_key: string;
    delegation_id: string;
    sport_id: string;
    category_id: string;
    sport_event_name: string;
    sport_event_slug: string;
  }[] = [];

  for (const { row, resolved } of validRows) {
    const personKey = row.cpf ?? `${row.full_name.toLowerCase()}|${row.birth_date}|${row.gender}`;

    if (resolved.person_action === "create" && !seenPeopleKeys.has(personKey)) {
      seenPeopleKeys.add(personKey);
      peopleToCreate.push({
        full_name: row.full_name,
        birth_date: row.birth_date,
        gender: row.gender,
        cpf: row.cpf,
        rg: row.rg,
        email: row.email,
        phone: row.phone,
        institution_id: resolved.institution_id,
      });
    }

    enrollments.push({
      person_key: personKey,
      delegation_id: resolved.delegation_id!,
      sport_id: resolved.sport_id!,
      category_id: resolved.category_id!,
      sport_event_name: row.sport_event_name,
      sport_event_slug: row.sport_event_slug,
    });
  }

  return {
    event_id: eventId,
    people_to_create: peopleToCreate,
    enrollments,
  };
}

// ─── Main Handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const operatorId = claimsData.claims.sub as string;

    // ── Parse multipart ──
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const eventId = formData.get("event_id") as string | null;
    const mode = formData.get("mode") as string | null;

    if (!file || !eventId || !mode) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file, event_id, mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mode !== "validate" && mode !== "commit") {
      return new Response(
        JSON.stringify({ error: 'mode must be "validate" or "commit"' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Service-role client for data operations ──
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Validate event exists ──
    const { data: eventData, error: eventError } = await serviceClient
      .from("events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !eventData) {
      return new Response(
        JSON.stringify({ error: `Evento não encontrado: ${eventId}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse XLSX ──
    const buffer = await file.arrayBuffer();
    const rawRows = parseXlsx(buffer);

    if (rawRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Planilha vazia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (rawRows.length > MAX_ROWS) {
      return new Response(
        JSON.stringify({ error: `Planilha excede o limite de ${MAX_ROWS} linhas (encontradas: ${rawRows.length})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Load reference maps ──
    const refs = await loadReferenceMaps(serviceClient, eventId);

    // ── Validate headers ──
    const missingCols = validateHeaders(rawRows);
    if (missingCols.length > 0) {
      return new Response(
        JSON.stringify({ error: `Colunas obrigatórias ausentes: ${missingCols.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Normalize and validate ──
    const allErrors: RowResult[] = [];
    const allWarnings: RowResult[] = [];
    const validRows: ProcessedRow[] = [];
    let skippedRows = 0;

    const normalizedRows = rawRows.map((raw, i) => mapColumns(raw, i));

    for (const row of normalizedRows) {
      const { errors, warnings, resolved, skip } = validateRow(row, refs);
      allWarnings.push(...warnings);
      if (skip) {
        skippedRows++;
        continue;
      }
      if (errors.length > 0) {
        allErrors.push(...errors);
      } else {
        validRows.push({ row, resolved });
      }
    }

    // ── Preview counts ──
    const personActions = validRows.map((r) => r.resolved.person_action);
    const preview = {
      people_to_create: personActions.filter((a) => a === "create").length,
      people_to_reuse: personActions.filter((a) => a === "reuse").length,
      participants_to_create: validRows.length,
      sport_events_to_create: new Set(validRows.map((r) => `${r.resolved.sport_id}|${r.resolved.category_id}|${r.row.sport_event_slug}`)).size,
      enrollments_to_create: validRows.length,
    };

    // ── Mode: validate ──
    if (mode === "validate") {
      return new Response(
        JSON.stringify({
          status: "validated",
          operator_id: operatorId,
          event_id: eventId,
          timestamp: new Date().toISOString(),
          summary: {
            total_rows: rawRows.length,
            skipped_rows: skippedRows,
            valid: validRows.length,
            warnings: allWarnings.length,
            errors: allErrors.length,
          },
          preview,
          errors: allErrors,
          warnings: allWarnings,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Mode: commit ──
    if (allErrors.length > 0) {
      return new Response(
        JSON.stringify({
          status: "rejected",
          message: `Não é possível gravar: ${allErrors.length} erros encontrados. Execute mode=validate primeiro.`,
          errors: allErrors,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = buildCommitPayload(validRows, eventId);

    const { data: rpcResult, error: rpcError } = await serviceClient.rpc(
      "import_inscricoes_batch",
      { payload: JSON.stringify(payload) }
    );

    if (rpcError) {
      return new Response(
        JSON.stringify({
          status: "rollback",
          error: rpcError.message,
          details: rpcError,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "committed",
        operator_id: operatorId,
        event_id: eventId,
        timestamp: new Date().toISOString(),
        result: rpcResult,
        warnings: allWarnings,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("import-inscricoes error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
