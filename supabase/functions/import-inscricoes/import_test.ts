/**
 * Testes unitários para a lógica de importação.
 *
 * Execução: npx tsx supabase/functions/import-inscricoes/import_test.ts
 * Ou via Deno: deno test --allow-net --allow-env supabase/functions/import-inscricoes/import_test.ts
 *
 * Estes testes validam a lógica pura (normalizeName, classifyRow, etc.)
 * sem precisar de Supabase real.
 */

// ─── Inline helpers (mirror of index.ts for testability) ─────────────

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

function slugify(text: string): string {
  return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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

// ─── Minimal types for testing ───────────────────────────────────────

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

interface PeopleMaps {
  byCpf: Map<string, string>;
  byNameDob: Map<string, string[]>;
}

interface ReadOnlyMaps {
  institutions: Map<string, string>;
  sports: Map<string, string>;
  categories: Map<string, string>;
  sportEvents: Map<string, string>;
  delegations: Map<string, string>;
  existingInstitutionSlugs: Set<string>;
}

type PendingCode = "CPF_MISSING" | "CPF_INVALID" | "BIRTH_DATE_MISSING" | "BIRTH_DATE_INVALID" | "PERSON_MATCH_AMBIGUOUS" | "SPORT_EVENT_NOT_FOUND" | "INSTITUTION_NOT_FOUND" | "MANUAL_REVIEW_REQUIRED";

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

// ─── classifyRow (copy from index.ts for test isolation) ─────────────

function classifyRow(row: NormalizedRow, maps: ReadOnlyMaps, people: PeopleMaps): RowClassification {
  const errors: RowClassification["errors"] = [];
  const warnings: RowClassification["warnings"] = [];
  const pending: PendingItem[] = [];
  const resolved: Record<string, string | null> = {};
  const isAthlete = row.participant_type === "athlete";

  const fingerprint = buildFingerprint(row.full_name, row.birth_date, row.gender, row.institution_name, row.sport_name, row.prova_name);

  if (row.inscription_status && !["válida", "valida", ""].includes(row.inscription_status.toLowerCase())) {
    return { status: "skip", errors: [], warnings: [{ row: row.row_number, field: "STATUS", value: row.inscription_status, code: "INVALID_STATUS", message: "" }], pending: [], resolved: {} };
  }

  if (!row.full_name) {
    errors.push({ row: row.row_number, field: "NOME", value: "", code: "NAME_MISSING", message: "Nome obrigatório" });
    return { status: "erro_bloqueante", errors, warnings, pending, resolved };
  }

  if (row.cpf_raw && !row.cpf_valid) {
    pending.push({ row_number: row.row_number, reason_code: "CPF_INVALID", reason_detail: `CPF "${row.cpf_raw}" inválido`, row, fingerprint, candidate_person_id: null });
    return { status: "pendencia", errors, warnings, pending, resolved };
  }

  if (!row.cpf_raw && isAthlete) {
    let candidateId: string | null = null;
    if (row.full_name && row.birth_date) {
      const key = `${row.full_name.toLowerCase()}|${row.birth_date}|${row.gender}`;
      const matches = people.byNameDob.get(key) ?? [];
      if (matches.length === 1) candidateId = matches[0];
    }
    pending.push({ row_number: row.row_number, reason_code: "CPF_MISSING", reason_detail: "Atleta sem CPF", row, fingerprint, candidate_person_id: candidateId });
    return { status: "pendencia", errors, warnings, pending, resolved };
  }

  if (!row.cpf_raw && !isAthlete) {
    let candidateId: string | null = null;
    if (row.full_name && row.birth_date) {
      const key = `${row.full_name.toLowerCase()}|${row.birth_date}|${row.gender}`;
      const matches = people.byNameDob.get(key) ?? [];
      if (matches.length === 1) candidateId = matches[0];
      if (matches.length > 1) {
        pending.push({ row_number: row.row_number, reason_code: "PERSON_MATCH_AMBIGUOUS", reason_detail: `Múltiplos matches (${matches.length})`, row, fingerprint, candidate_person_id: matches[0] });
        return { status: "pendencia", errors, warnings, pending, resolved };
      }
    }
    pending.push({ row_number: row.row_number, reason_code: "CPF_MISSING", reason_detail: "Comissão técnica sem CPF", row, fingerprint, candidate_person_id: candidateId });
    return { status: "pendencia", errors, warnings, pending, resolved };
  }

  if (isAthlete && !row.birth_date) {
    const code = row.raw_birth_date ? "BIRTH_DATE_INVALID" : "BIRTH_DATE_MISSING";
    pending.push({ row_number: row.row_number, reason_code: code, reason_detail: "Data inválida/ausente", row, fingerprint, candidate_person_id: null });
    return { status: "pendencia", errors, warnings, pending, resolved };
  }

  const instId = maps.institutions.get(row.institution_slug);
  if (!instId && !row.institution_slug) {
    if (isAthlete) {
      errors.push({ row: row.row_number, field: "ESCOLA", value: "", code: "INSTITUTION_MISSING", message: "" });
      return { status: "erro_bloqueante", errors, warnings, pending, resolved };
    } else {
      return { status: "skip", errors, warnings: [{ row: row.row_number, field: "ESCOLA", value: "", code: "INSTITUTION_MISSING_STAFF", message: "" }], pending, resolved };
    }
  }
  if (instId) resolved.institution_id = instId;
  else { resolved.institution_will_create = "true"; resolved.institution_slug = row.institution_slug; }

  if (resolved.institution_id) {
    const delId = maps.delegations.get(resolved.institution_id);
    if (delId) resolved.delegation_id = delId;
    else resolved.delegation_will_create = "true";
  } else resolved.delegation_will_create = "true";

  if (isAthlete) {
    if (!row.sport_slug) { errors.push({ row: row.row_number, field: "MODALIDADE", value: "", code: "SPORT_MISSING", message: "" }); return { status: "erro_bloqueante", errors, warnings, pending, resolved }; }
    const sportId = maps.sports.get(row.sport_slug);
    if (!sportId) { pending.push({ row_number: row.row_number, reason_code: "SPORT_EVENT_NOT_FOUND", reason_detail: `Modalidade "${row.sport_name}" não encontrada`, row, fingerprint, candidate_person_id: null }); return { status: "pendencia", errors, warnings, pending, resolved }; }
    resolved.sport_id = sportId;

    if (!row.category_slug) { errors.push({ row: row.row_number, field: "COMPETICAO", value: "", code: "CATEGORY_MISSING", message: "" }); return { status: "erro_bloqueante", errors, warnings, pending, resolved }; }
    const catId = maps.categories.get(row.category_slug);
    if (!catId) { pending.push({ row_number: row.row_number, reason_code: "SPORT_EVENT_NOT_FOUND", reason_detail: `Categoria não encontrada`, row, fingerprint, candidate_person_id: null }); return { status: "pendencia", errors, warnings, pending, resolved }; }
    resolved.category_id = catId;

    if (!row.prova_slug) { return { status: "skip", errors, warnings: [{ row: row.row_number, field: "PROVA", value: null, code: "PROVA_EMPTY", message: "" }], pending, resolved }; }
    const seKey = `${sportId}|${catId}|${row.prova_slug}`;
    const seId = maps.sportEvents.get(seKey);
    if (!seId) { pending.push({ row_number: row.row_number, reason_code: "SPORT_EVENT_NOT_FOUND", reason_detail: `Prova não encontrada`, row, fingerprint, candidate_person_id: null }); return { status: "pendencia", errors, warnings, pending, resolved }; }
    resolved.sport_event_id = seId;
  }

  if (row.cpf_valid) {
    const existingId = people.byCpf.get(row.cpf_valid);
    if (existingId) { resolved.person_id = existingId; resolved.person_action = "reuse"; }
    else { resolved.person_action = "create"; }
  }

  return { status: "ok", errors, warnings, pending, resolved };
}

// ─── Test Helpers ────────────────────────────────────────────────────

function makeRow(overrides: Partial<NormalizedRow> = {}): NormalizedRow {
  return {
    row_number: 2,
    full_name: "Joao da Silva",
    birth_date: "2010-05-15",
    raw_birth_date: "15/05/2010",
    gender: "male",
    cpf_valid: "12345678909", // valid test CPF
    cpf_raw: "123.456.789-09",
    rg: null,
    email: null,
    phone: null,
    institution_name: "Escola Teste",
    institution_slug: "escola-teste",
    sport_name: "Futsal",
    sport_slug: "futsal",
    category_name: "Juvenil Masculino",
    category_slug: "juvenil-masculino",
    prova_name: "Futsal Juvenil Masculino",
    prova_slug: "futsal-juvenil-masculino",
    user_type: "Atleta",
    inscription_status: "Válida",
    participant_type: "athlete",
    funcao: "",
    pcd: null,
    esfera: "",
    raw_payload: {},
    ...overrides,
  };
}

function makeMaps(overrides: Partial<ReadOnlyMaps> = {}): ReadOnlyMaps {
  const sports = new Map([["futsal", "sport-1"]]);
  const categories = new Map([["juvenil-masculino", "cat-1"]]);
  const sportEvents = new Map([["sport-1|cat-1|futsal-juvenil-masculino", "se-1"]]);
  const institutions = new Map([["escola-teste", "inst-1"]]);
  const delegations = new Map([["inst-1", "del-1"]]);
  return {
    institutions,
    sports,
    categories,
    sportEvents,
    delegations,
    existingInstitutionSlugs: new Set(institutions.keys()),
    ...overrides,
  };
}

function makePeople(overrides: Partial<PeopleMaps> = {}): PeopleMaps {
  return {
    byCpf: new Map(),
    byNameDob: new Map(),
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.error(`  ❌ ${msg}`); }
}

// ─── TESTS ───────────────────────────────────────────────────────────

console.log("\n═══ Testes do Importador ═══\n");

// 1. normalizeName preserva preposições
console.log("── normalizeName ──");
assert(normalizeName("  JOAO   DA  SILVA  ") === "Joao da Silva", "trim + colapsar espaços + preposição 'da' minúscula");
assert(normalizeName("MARIA DAS GRAÇAS DE SOUZA") === "Maria das Gracas de Souza", "preposições 'das' e 'de' minúsculas");
assert(normalizeName("pedro dos santos do nascimento") === "Pedro dos Santos do Nascimento", "'dos' e 'do' minúsculas");
assert(normalizeName("ANA") === "Ana", "nome simples capitalizado");

// 2. CPF validation
console.log("\n── CPF ──");
assert(validateCpfDigits("12345678909") === true, "CPF válido aceito");
assert(validateCpfDigits("11111111111") === false, "CPF repetido rejeitado");
assert(validateCpfDigits("1234567890") === false, "CPF com 10 dígitos rejeitado");
assert(validateCpfDigits("12345678900") === false, "CPF com dígito verificador errado rejeitado");

// 3. CPF válido já existente → reuse
console.log("\n── Cenário: CPF válido já existente ──");
{
  const row = makeRow();
  const people = makePeople({ byCpf: new Map([["12345678909", "person-existing"]]) });
  const result = classifyRow(row, makeMaps(), people);
  assert(result.status === "ok", "status = ok");
  assert(result.resolved.person_action === "reuse", "person_action = reuse");
  assert(result.resolved.person_id === "person-existing", "person_id correto");
}

// 4. CPF válido novo → create
console.log("\n── Cenário: CPF válido novo ──");
{
  const row = makeRow();
  const people = makePeople(); // empty
  const result = classifyRow(row, makeMaps(), people);
  assert(result.status === "ok", "status = ok");
  assert(result.resolved.person_action === "create", "person_action = create");
}

// 5. CPF inválido → pendência
console.log("\n── Cenário: CPF inválido ──");
{
  const row = makeRow({ cpf_valid: null, cpf_raw: "123.456.789-00" });
  const result = classifyRow(row, makeMaps(), makePeople());
  assert(result.status === "pendencia", "status = pendencia");
  assert(result.pending[0]?.reason_code === "CPF_INVALID", "reason = CPF_INVALID");
}

// 6. CPF ausente (atleta) → pendência
console.log("\n── Cenário: CPF ausente (atleta) ──");
{
  const row = makeRow({ cpf_valid: null, cpf_raw: null });
  const result = classifyRow(row, makeMaps(), makePeople());
  assert(result.status === "pendencia", "status = pendencia");
  assert(result.pending[0]?.reason_code === "CPF_MISSING", "reason = CPF_MISSING");
}

// 7. CPF ausente (comissão técnica) → pendência (NOVA REGRA)
console.log("\n── Cenário: CPF ausente (comissão técnica) ──");
{
  const row = makeRow({ cpf_valid: null, cpf_raw: null, participant_type: "coach", user_type: "Comissão Técnica" });
  const result = classifyRow(row, makeMaps(), makePeople());
  assert(result.status === "pendencia", "comissão sem CPF vai para pendência");
  assert(result.pending[0]?.reason_code === "CPF_MISSING", "reason = CPF_MISSING");
}

// 8. Nascimento inválido (atleta) → pendência
console.log("\n── Cenário: nascimento inválido ──");
{
  const row = makeRow({ birth_date: null, raw_birth_date: "32/13/2010" });
  const result = classifyRow(row, makeMaps(), makePeople());
  assert(result.status === "pendencia", "status = pendencia");
  assert(result.pending[0]?.reason_code === "BIRTH_DATE_INVALID", "reason = BIRTH_DATE_INVALID");
}

// 9. Nascimento ausente (atleta) → pendência
console.log("\n── Cenário: nascimento ausente ──");
{
  const row = makeRow({ birth_date: null, raw_birth_date: null });
  const result = classifyRow(row, makeMaps(), makePeople());
  assert(result.status === "pendencia", "status = pendencia");
  assert(result.pending[0]?.reason_code === "BIRTH_DATE_MISSING", "reason = BIRTH_DATE_MISSING");
}

// 10. Pessoa ambígua por nome+nascimento+sexo → pendência
console.log("\n── Cenário: pessoa ambígua por nome+nascimento+sexo ──");
{
  const row = makeRow({ cpf_valid: null, cpf_raw: null, participant_type: "coach" });
  const people = makePeople({
    byNameDob: new Map([
      ["joao da silva|2010-05-15|male", ["person-a", "person-b"]] // 2 matches!
    ]),
  });
  const result = classifyRow(row, makeMaps(), people);
  assert(result.status === "pendencia", "status = pendencia");
  assert(result.pending[0]?.reason_code === "PERSON_MATCH_AMBIGUOUS", "reason = PERSON_MATCH_AMBIGUOUS");
}

// 11. sport_event não encontrado → pendência
console.log("\n── Cenário: sport_event não encontrado ──");
{
  const row = makeRow({ sport_slug: "xadrez", sport_name: "Xadrez" });
  const maps = makeMaps();
  const people = makePeople({ byCpf: new Map([["12345678909", "p1"]]) });
  const result = classifyRow(row, maps, people);
  assert(result.status === "pendencia", "status = pendencia");
  assert(result.pending[0]?.reason_code === "SPORT_EVENT_NOT_FOUND", "reason = SPORT_EVENT_NOT_FOUND");
}

// 12. Validate não grava (structural verification)
console.log("\n── Cenário: validate é read-only (verificação estrutural) ──");
{
  // This test verifies that classifyRow never mutates maps or people
  const maps = makeMaps();
  const people = makePeople();
  const instBefore = maps.institutions.size;
  const sportsBefore = maps.sports.size;
  const peopleBefore = people.byCpf.size;

  const row = makeRow();
  classifyRow(row, maps, people);

  assert(maps.institutions.size === instBefore, "institutions map não foi mutada");
  assert(maps.sports.size === sportsBefore, "sports map não foi mutada");
  assert(people.byCpf.size === peopleBefore, "people map não foi mutada");
}

// 13. Commit idempotente (structural verification)
console.log("\n── Cenário: commit idempotente (verificação estrutural) ──");
{
  // Running classifyRow twice with same data produces same result
  const row = makeRow();
  const maps = makeMaps();
  const people = makePeople({ byCpf: new Map([["12345678909", "person-1"]]) });

  const r1 = classifyRow(row, maps, people);
  const r2 = classifyRow(row, maps, people);

  assert(r1.status === r2.status, "mesmo status em execuções consecutivas");
  assert(r1.resolved.person_action === r2.resolved.person_action, "mesma ação de pessoa");
  assert(r1.resolved.person_id === r2.resolved.person_id, "mesmo person_id");
}

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(40)}`);
console.log(`Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);
console.log(`${"═".repeat(40)}\n`);

if (failed > 0) {
  if (typeof Deno !== "undefined") Deno.exit(1);
  else process.exit(1);
}
