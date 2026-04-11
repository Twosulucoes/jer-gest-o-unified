import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ROWS = 3000;

// ─── Helpers ─────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function capitalize(text: string): string {
  return text.trim().toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
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
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  const str = String(value).trim();
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
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

function genderScopeFromCompetition(competicao: string): string {
  const lower = competicao.toLowerCase();
  if (lower.includes("feminino")) return "female";
  if (lower.includes("masculino")) return "male";
  return "mixed";
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

// ─── Types ───────────────────────────────────────────────────────────

interface RawRow { [key: string]: unknown; }

interface NormalizedRow {
  row_number: number;
  full_name: string;
  birth_date: string | null;
  gender: string;
  cpf: string | null;
  rg: string | null;
  email: string | null;
  phone: string | null;
  institution_name: string;
  institution_slug: string;
  delegation_name: string;
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
  food_restrictions: string | null;
  esfera: string;
}

interface RowResult {
  row: number;
  field: string;
  value: unknown;
  code: string;
  message: string;
}

// ─── XLSX Parsing ────────────────────────────────────────────────────

const REQUIRED_COLUMNS = ["NOME", "ESCOLA", "MODALIDADE", "PROVA", "COMPETICAO"];

function findDataSheet(workbook: XLSX.WorkBook): string {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const sample = XLSX.utils.sheet_to_json(sheet, { defval: null, range: 0 }) as RawRow[];
    if (sample.length > 0) {
      const headers = Object.keys(sample[0]);
      if (REQUIRED_COLUMNS.every((col) => headers.includes(col))) return name;
    }
  }
  return workbook.SheetNames[0];
}

function parseXlsx(buffer: ArrayBuffer): RawRow[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const sheetName = findDataSheet(workbook);
  console.log(`import-inscricoes: using sheet "${sheetName}"`);
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: null }) as RawRow[];
}

function validateHeaders(rawRows: RawRow[]): string[] {
  if (rawRows.length === 0) return [];
  const headers = Object.keys(rawRows[0]);
  return REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
}

// ─── Column Mapping ──────────────────────────────────────────────────

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
  const fullName = capitalize(getField(raw, "NOME", "NOME COMPLETO"));
  const institution = getField(raw, "ESCOLA", "INSTITUICAO");
  const delegation = getField(raw, "DELEGAÇÃO", "DELEGACAO");
  const sport = getField(raw, "MODALIDADE");
  const category = getField(raw, "COMPETICAO", "CATEGORIA");
  const prova = getField(raw, "PROVA");
  const userType = getField(raw, "TIPO USUARIO", "TIPO_USUARIO");
  const status = getField(raw, "STATUS DA INSCRIÇÃO", "STATUS DA INSCRICAO", "STATUS_INSCRICAO");
  const funcao = getField(raw, "FUNCAO");
  const pcd = getField(raw, "PCD");
  const esfera = getField(raw, "ESFERA");

  return {
    row_number: rowIndex + 2,
    full_name: fullName,
    birth_date: parseDate(raw["DATA NASCIMENTO"] ?? raw["DATA_NASCIMENTO"]),
    gender: normalizeGender(getField(raw, "SEXO", "GENERO")),
    cpf: cleanCpf(getField(raw, "CPF") || null),
    rg: getField(raw, "RG") || null,
    email: getField(raw, "EMAIL") || null,
    phone: getField(raw, "TELEFONE") || null,
    institution_name: institution,
    institution_slug: slugify(institution),
    delegation_name: delegation,
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
    food_restrictions: null,
    esfera: esfera,
  };
}

// ─── Auto-Create Reference Entities ──────────────────────────────────

interface ResolvedMaps {
  institutions: Map<string, string>;   // slug -> id
  delegations: Map<string, string>;    // institution_id -> delegation_id
  sports: Map<string, string>;         // slug -> id
  categories: Map<string, string>;     // slug -> id
}

async function ensureReferenceEntities(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  rows: NormalizedRow[]
): Promise<{ maps: ResolvedMaps; warnings: RowResult[] }> {
  const warnings: RowResult[] = [];

  // 1. Collect unique institutions
  const uniqueInstitutions = new Map<string, string>(); // slug -> name
  for (const r of rows) {
    if (r.institution_slug && !uniqueInstitutions.has(r.institution_slug)) {
      uniqueInstitutions.set(r.institution_slug, r.institution_name);
    }
  }

  // Load existing institutions
  const { data: existingInst } = await supabase
    .from("institutions").select("id, slug").eq("is_active", true);
  const instMap = new Map<string, string>();
  for (const i of existingInst ?? []) instMap.set(i.slug, i.id);

  // Create missing institutions
  for (const [slug, name] of uniqueInstitutions) {
    if (!instMap.has(slug)) {
      const { data, error } = await supabase
        .from("institutions")
        .insert({ name, slug, network_type: "municipal" })
        .select("id")
        .single();
      if (error) {
        // Try to fetch in case of race condition
        const { data: existing } = await supabase
          .from("institutions").select("id").eq("slug", slug).single();
        if (existing) {
          instMap.set(slug, existing.id);
        } else {
          console.error(`Failed to create institution ${slug}:`, error.message);
        }
      } else {
        instMap.set(slug, data.id);
      }
    }
  }

  // 2. Collect unique delegations (institution_id -> event)
  const { data: existingDel } = await supabase
    .from("delegations").select("id, institution_id").eq("event_id", eventId);
  const delMap = new Map<string, string>();
  for (const d of existingDel ?? []) delMap.set(d.institution_id, d.id);

  // Create missing delegations
  for (const [slug] of uniqueInstitutions) {
    const instId = instMap.get(slug);
    if (instId && !delMap.has(instId)) {
      const { data, error } = await supabase
        .from("delegations")
        .insert({ institution_id: instId, event_id: eventId, status: "confirmed" })
        .select("id")
        .single();
      if (error) {
        const { data: existing } = await supabase
          .from("delegations")
          .select("id")
          .eq("institution_id", instId)
          .eq("event_id", eventId)
          .single();
        if (existing) delMap.set(instId, existing.id);
      } else {
        delMap.set(instId, data.id);
      }
    }
  }

  // 3. Collect unique sports
  const uniqueSports = new Map<string, string>(); // slug -> name
  for (const r of rows) {
    if (r.sport_slug && !uniqueSports.has(r.sport_slug)) {
      uniqueSports.set(r.sport_slug, r.sport_name);
    }
  }

  const { data: existingSports } = await supabase
    .from("sports").select("id, slug").eq("event_id", eventId);
  const sportMap = new Map<string, string>();
  for (const s of existingSports ?? []) sportMap.set(s.slug, s.id);

  for (const [slug, name] of uniqueSports) {
    if (!sportMap.has(slug)) {
      const isCollective = ["futsal", "futebol", "handebol", "voleibol", "volei-de-praia"].includes(slug);
      const { data, error } = await supabase
        .from("sports")
        .insert({ name, slug, event_id: eventId, is_collective: isCollective })
        .select("id")
        .single();
      if (error) {
        const { data: existing } = await supabase
          .from("sports").select("id").eq("slug", slug).eq("event_id", eventId).single();
        if (existing) sportMap.set(slug, existing.id);
      } else {
        sportMap.set(slug, data.id);
      }
    }
  }

  // 4. Collect unique categories (from COMPETICAO)
  const uniqueCategories = new Map<string, { name: string; genderScope: string }>();
  for (const r of rows) {
    if (r.category_slug && !uniqueCategories.has(r.category_slug)) {
      uniqueCategories.set(r.category_slug, {
        name: r.category_name,
        genderScope: genderScopeFromCompetition(r.category_name),
      });
    }
  }

  const { data: existingCats } = await supabase
    .from("categories").select("id, slug").eq("event_id", eventId);
  const catMap = new Map<string, string>();
  for (const c of existingCats ?? []) catMap.set(c.slug, c.id);

  for (const [slug, info] of uniqueCategories) {
    if (!catMap.has(slug)) {
      const { data, error } = await supabase
        .from("categories")
        .insert({ name: info.name, slug, event_id: eventId, gender_scope: info.genderScope })
        .select("id")
        .single();
      if (error) {
        const { data: existing } = await supabase
          .from("categories").select("id").eq("slug", slug).eq("event_id", eventId).single();
        if (existing) catMap.set(slug, existing.id);
      } else {
        catMap.set(slug, data.id);
      }
    }
  }

  return {
    maps: { institutions: instMap, delegations: delMap, sports: sportMap, categories: catMap },
    warnings,
  };
}

// ─── Row Validation ──────────────────────────────────────────────────

function validateRow(
  row: NormalizedRow,
  maps: ResolvedMaps,
  peopleByCpf: Map<string, string>,
  peopleByNameDob: Map<string, string>
): { errors: RowResult[]; warnings: RowResult[]; resolved: Record<string, string | null>; skip: boolean } {
  const errors: RowResult[] = [];
  const warnings: RowResult[] = [];
  const resolved: Record<string, string | null> = {};

  // Skip non-athletes with no sport data
  const isAthlete = row.participant_type === "athlete";

  // Skip invalid inscription status
  if (row.inscription_status && !["válida", "valida", ""].includes(row.inscription_status.toLowerCase())) {
    warnings.push({ row: row.row_number, field: "STATUS DA INSCRIÇÃO", value: row.inscription_status, code: "INVALID_STATUS", message: `Inscrição com status "${row.inscription_status}" — ignorada` });
    return { errors: [], warnings, resolved: {}, skip: true };
  }

  // Basic fields
  if (!row.full_name) {
    errors.push({ row: row.row_number, field: "NOME", value: "", code: "NAME_MISSING", message: "Nome obrigatório" });
  }

  // For athletes, birth_date is required; for staff it's optional
  if (isAthlete && !row.birth_date) {
    errors.push({ row: row.row_number, field: "DATA NASCIMENTO", value: null, code: "DOB_MISSING", message: "Data de nascimento obrigatória para atletas" });
  }

  // Institution
  const instId = maps.institutions.get(row.institution_slug);
  if (!instId) {
    if (row.institution_slug) {
      errors.push({ row: row.row_number, field: "ESCOLA", value: row.institution_name, code: "INSTITUTION_RESOLVE_FAILED", message: "Não foi possível resolver a instituição" });
    }
  } else {
    resolved.institution_id = instId;
    const delId = maps.delegations.get(instId);
    if (!delId) {
      errors.push({ row: row.row_number, field: "DELEGAÇÃO", value: row.institution_name, code: "DELEGATION_RESOLVE_FAILED", message: "Não foi possível resolver a delegação" });
    } else {
      resolved.delegation_id = delId;
    }
  }

  // Sport (required for athletes)
  if (isAthlete) {
    const sportId = maps.sports.get(row.sport_slug);
    if (!sportId) {
      if (row.sport_slug) {
        errors.push({ row: row.row_number, field: "MODALIDADE", value: row.sport_name, code: "SPORT_RESOLVE_FAILED", message: "Não foi possível resolver a modalidade" });
      } else {
        errors.push({ row: row.row_number, field: "MODALIDADE", value: "", code: "SPORT_MISSING", message: "Modalidade obrigatória para atletas" });
      }
    } else {
      resolved.sport_id = sportId;
    }

    const catId = maps.categories.get(row.category_slug);
    if (!catId) {
      if (row.category_slug) {
        errors.push({ row: row.row_number, field: "COMPETICAO", value: row.category_name, code: "CATEGORY_RESOLVE_FAILED", message: "Não foi possível resolver a categoria" });
      } else {
        errors.push({ row: row.row_number, field: "COMPETICAO", value: "", code: "CATEGORY_MISSING", message: "Competição/categoria obrigatória para atletas" });
      }
    } else {
      resolved.category_id = catId;
    }

    if (!row.prova_slug) {
      warnings.push({ row: row.row_number, field: "PROVA", value: null, code: "PROVA_EMPTY", message: "Nenhuma prova — linha ignorada" });
      return { errors: [], warnings, resolved: {}, skip: true };
    }
  } else {
    // Non-athletes: no sport data needed, but they still need delegation
    if (!resolved.delegation_id && !row.institution_slug) {
      // Try to use delegation_name to find any delegation
      warnings.push({ row: row.row_number, field: "TIPO USUARIO", value: row.user_type, code: "NON_ATHLETE", message: `Tipo "${row.user_type}" sem escola — ignorado` });
      return { errors: [], warnings, resolved: {}, skip: true };
    }
  }

  // Person resolution
  if (row.cpf) {
    const existingId = peopleByCpf.get(row.cpf);
    if (existingId) {
      resolved.person_id = existingId;
      resolved.person_action = "reuse";
    } else {
      resolved.person_action = "create";
    }
  } else {
    if (!isAthlete) {
      // Staff without CPF — try name match
      warnings.push({ row: row.row_number, field: "CPF", value: null, code: "CPF_MISSING", message: "CPF ausente" });
    }
    if (row.full_name && row.birth_date) {
      const key = `${row.full_name.toLowerCase()}|${row.birth_date}|${row.gender}`;
      const existingId = peopleByNameDob.get(key);
      if (existingId) {
        resolved.person_id = existingId;
        resolved.person_action = "reuse";
      } else {
        resolved.person_action = "create";
      }
    } else {
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
    participant_type: string;
  }[] = [];

  for (const { row, resolved } of validRows) {
    const personKey = row.cpf ?? `${row.full_name.toLowerCase()}|${row.birth_date}|${row.gender}`;

    if (resolved.person_action === "create" && !seenPeopleKeys.has(personKey)) {
      seenPeopleKeys.add(personKey);
      peopleToCreate.push({
        full_name: row.full_name,
        birth_date: row.birth_date || "2000-01-01",
        gender: row.gender,
        cpf: row.cpf,
        rg: row.rg,
        email: row.email,
        phone: row.phone,
        institution_id: resolved.institution_id,
        disability_type: row.pcd,
      });
    }

    const isAthlete = row.participant_type === "athlete";

    if (isAthlete && resolved.sport_id && resolved.category_id) {
      enrollments.push({
        person_key: personKey,
        delegation_id: resolved.delegation_id!,
        sport_id: resolved.sport_id!,
        category_id: resolved.category_id!,
        sport_event_name: row.prova_name,
        sport_event_slug: row.prova_slug,
        participant_type: row.participant_type,
      });
    } else if (!isAthlete && resolved.delegation_id) {
      // Non-athletes: create participant without sport enrollment
      // We still add an enrollment entry but with empty sport data so the RPC creates the participant
      enrollments.push({
        person_key: personKey,
        delegation_id: resolved.delegation_id!,
        sport_id: "",
        category_id: "",
        sport_event_name: "",
        sport_event_slug: "",
        participant_type: row.participant_type,
      });
    }
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

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: eventData, error: eventError } = await serviceClient
      .from("events").select("id").eq("id", eventId).maybeSingle();

    if (eventError || !eventData) {
      return new Response(
        JSON.stringify({ error: `Evento não encontrado: ${eventId}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const buffer = await file.arrayBuffer();
    const rawRows = parseXlsx(buffer);

    if (rawRows.length === 0) {
      return new Response(JSON.stringify({ error: "Planilha vazia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (rawRows.length > MAX_ROWS) {
      return new Response(
        JSON.stringify({ error: `Planilha excede o limite de ${MAX_ROWS} linhas (encontradas: ${rawRows.length})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const missingCols = validateHeaders(rawRows);
    if (missingCols.length > 0) {
      return new Response(
        JSON.stringify({ error: `Colunas obrigatórias ausentes: ${missingCols.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize all rows
    const normalizedRows = rawRows.map((raw, i) => mapColumns(raw, i));

    // Filter only processable rows (valid status, not blank names)
    const processableRows = normalizedRows.filter(r => {
      if (!r.full_name) return false;
      return true;
    });

    // Auto-create reference entities (institutions, delegations, sports, categories)
    // In validate mode we only do lookups, in commit mode we create missing ones
    let maps: ResolvedMaps;
    const refWarnings: RowResult[] = [];

    if (mode === "commit") {
      const result = await ensureReferenceEntities(serviceClient, eventId, processableRows);
      maps = result.maps;
      refWarnings.push(...result.warnings);
    } else {
      // Validate mode: also auto-create so validation is accurate
      // But we do it anyway because the user needs to see real validation results
      const result = await ensureReferenceEntities(serviceClient, eventId, processableRows);
      maps = result.maps;
      refWarnings.push(...result.warnings);
    }

    // Load people for dedup
    const { data: peopleData } = await serviceClient
      .from("people").select("id, full_name, birth_date, gender, cpf").eq("is_active", true);
    const peopleByCpf = new Map<string, string>();
    const peopleByNameDob = new Map<string, string>();
    for (const p of peopleData ?? []) {
      if (p.cpf) peopleByCpf.set(p.cpf, p.id);
      peopleByNameDob.set(`${p.full_name.toLowerCase()}|${p.birth_date}|${p.gender}`, p.id);
    }

    // Validate each row
    const allErrors: RowResult[] = [];
    const allWarnings: RowResult[] = [...refWarnings];
    const validRows: ProcessedRow[] = [];
    let skippedRows = 0;

    for (const row of normalizedRows) {
      const { errors, warnings, resolved, skip } = validateRow(row, maps, peopleByCpf, peopleByNameDob);
      allWarnings.push(...warnings);
      if (skip) { skippedRows++; continue; }
      if (errors.length > 0) { allErrors.push(...errors); }
      else { validRows.push({ row, resolved }); }
    }

    // Preview counts
    const personActions = validRows.map((r) => r.resolved.person_action);
    const athleteRows = validRows.filter(r => r.row.participant_type === "athlete");
    const sportEventKeys = new Set<string>();
    for (const { row, resolved } of athleteRows) {
      if (resolved.sport_id && resolved.category_id) {
        sportEventKeys.add(`${resolved.sport_id}|${resolved.category_id}|${row.prova_slug}`);
      }
    }

    // Count unique people
    const uniquePeopleKeys = new Set<string>();
    for (const { row } of validRows) {
      const key = row.cpf ?? `${row.full_name.toLowerCase()}|${row.birth_date}|${row.gender}`;
      uniquePeopleKeys.add(key);
    }

    const preview = {
      people_to_create: new Set(validRows.filter(r => r.resolved.person_action === "create").map(r => r.row.cpf ?? `${r.row.full_name.toLowerCase()}|${r.row.birth_date}|${r.row.gender}`)).size,
      people_to_reuse: new Set(validRows.filter(r => r.resolved.person_action === "reuse").map(r => r.row.cpf ?? `${r.row.full_name.toLowerCase()}|${r.row.birth_date}|${r.row.gender}`)).size,
      participants_to_create: uniquePeopleKeys.size,
      sport_events_to_create: sportEventKeys.size,
      enrollments_to_create: athleteRows.length,
      staff_to_create: validRows.filter(r => r.row.participant_type !== "athlete").length,
      institutions_created: maps.institutions.size,
      sports_created: maps.sports.size,
      categories_created: maps.categories.size,
    };

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

    console.log("import-inscricoes: commit payload stats", {
      people_to_create: payload.people_to_create.length,
      enrollments: payload.enrollments.length,
    });

    const { data: rpcResult, error: rpcError } = await serviceClient.rpc(
      "import_inscricoes_batch",
      { payload }
    );

    if (rpcError) {
      await serviceClient.from("import_logs").insert({
        event_id: eventId,
        performed_by: operatorId,
        file_name: file.name,
        row_count: rawRows.length,
        status: "error",
        error_message: rpcError.message,
      });
      return new Response(
        JSON.stringify({ status: "rollback", error: rpcError.message, details: rpcError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const failedCount = rpcResult?.failed_count ?? 0;
    const partialSuccess = failedCount > 0;

    await serviceClient.from("import_logs").insert({
      event_id: eventId,
      performed_by: operatorId,
      file_name: file.name,
      row_count: validRows.length,
      status: partialSuccess ? "partial" : "success",
      result_summary: rpcResult,
    });

    return new Response(
      JSON.stringify({
        status: partialSuccess ? "partial" : "committed",
        partial_success: partialSuccess,
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
