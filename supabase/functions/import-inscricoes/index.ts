import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { smartMatch, matchEventInCatalog } from "./matcher.ts";

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
  // Faixa dinâmica: aceita do nascido com até ~110 anos até o ano corrente.
  // Evita falsos negativos quando atletas nascem no ano da edição (categorias mais novas).
  const currentYear = new Date().getUTCFullYear();
  return year >= 1915 && year <= currentYear;
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
  // Texto bruto da planilha (mantido para auditoria)
  sport_raw: string;
  competicao_raw: string;
  // Resultado do parser canônico
  sport_name: string;          // = sport_raw (retrocompat)
  sport_slug: string;          // canônico do catálogo (vazio se falhou)
  category_name: string;       // = competicao_raw
  category_slug: string;       // canônico do catálogo (vazio se falhou)
  prova_name: string;
  prova_slug: string;          // derivado quando sport+category resolvidos
  // Auxiliares de parsing
  parse_age_band: string | null;
  parse_gender: string | null;
  parse_is_paralimpic: boolean;
  parse_sport_reason: string;
  parse_category_reason: string;
  // Rastreabilidade de resolução de categoria
  category_candidates: string[];                  // candidatas no catálogo p/ a modalidade
  category_resolved_by: "age_band" | "birth_date" | "single_in_catalog" | null;
  user_type: string;
  inscription_status: string;
  participant_type: string;
  funcao: string;
  pcd: string | null;
  esfera: string;
  external_credential: string | null;
  raw_payload: Record<string, unknown>;
}

type PendingCode =
  | "CPF_MISSING"
  | "CPF_INVALID"
  | "BIRTH_DATE_MISSING"
  | "BIRTH_DATE_INVALID"
  | "PERSON_MATCH_AMBIGUOUS"
  | "SPORT_EVENT_NOT_FOUND"
  | "SPORT_EVENT_NOT_FOUND_CANONICAL"
  | "SPORT_PARSE_FAILED"
  | "CATEGORY_PARSE_FAILED"
  | "PROVA_PARSE_FAILED"
  | "SPORT_EVENT_AMBIGUOUS"
  | "TM_2012_MANUAL_CATEGORY_SELECTION"
  | "INSTITUTION_NOT_FOUND"
  | "CREDENTIAL_DUPLICATED"
  | "CREDENTIAL_ALREADY_LINKED"
  | "MANUAL_REVIEW_REQUIRED";

// Marcador textual usado para sinalizar caso TM 2012 antes da pendência ser emitida.
const TM_2012_MARKER = "tm_2012_manual_required";
const TM_2012_VALID_CHOICES = new Set(["tm-12-14", "tm-14-15"]);

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
  "PROVA": ["PROVA", "DISCIPLINE", "PROVA/EVENTO"],
  "COMPETICAO": ["COMPETICAO", "COMPETIÇÃO", "COMPETIÇÃO/CATEGORIA", "CATEGORIA", "CATEGORY", "COMP"],
  "CREDENCIAL": ["CREDENCIAL", "CREDENTIAL", "CREDENTIAL_CODE", "CODIGO", "CREDENTIAL-CODE"],
};

const REQUIRED_COLUMNS = ["NOME", "ESCOLA", "MODALIDADE"];

function normalizeStr(s: string): string {
  return s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 _/-]/g, " ").replace(/\s+/g, " ");
}

// ─── Sport / Category Canonical Parser ────────────────────────────────
//
// Objetivo: transformar o texto bruto da planilha (que mistura modalidade,
// nome da etapa, faixa etária e gênero) em slugs canônicos do catálogo do
// evento. NUNCA inventa slug — só resolve para algo que já existe.

// Tokens da etapa que devem ser removidos antes do match esportivo.
const STAGE_TOKENS = [
  "CARACARAI", "BONFIM", "BOA VISTA", "FINAL", "CLASSIFICATORIA",
  "ETAPA", "REGIONAL", "ESTADUAL",
];

// Aliases de modalidade (texto bruto -> slug canônico). Usado como atalho
// antes do match por substring contra o catálogo. Apenas quando o slugify
// puro do nome não bate naturalmente com o catálogo (acentos/espaços já
// tratados, então quase sempre o match natural funciona).
const SPORT_ALIASES: Record<string, string> = {
  // Combate
  "JUDO": "judo",
  "JUDÔ": "judo",
  "KARATE": "karate",
  "KARATÊ": "karate",
  "TAEKWONDO": "taekwondo",
  "TAE KWON DO": "taekwondo",
  "WRESTLING": "wrestling",
  "LUTA OLIMPICA": "wrestling",
  // Coletivos
  "FUTSAL": "futsal",
  "FUTEBOL DE SALAO": "futsal",
  "FUTEBOL": "futebol",
  "FUTEBOL DE CAMPO": "futebol",
  "BASQUETE": "basquete",
  "BASQUETEBOL": "basquete",
  "VOLEI": "volei",
  "VOLEIBOL": "volei",
  "VOLEI DE PRAIA": "volei-de-praia",
  "VOLEIBOL DE PRAIA": "volei-de-praia",
  "HANDEBOL": "handebol",
  // Raquete / mesa
  "TENIS DE MESA": "tenis-de-mesa",
  "BADMINTON": "badminton",
  "XADREZ": "xadrez",
  // Tempo / marca
  "ATLETISMO": "atletismo",
  "NATACAO": "natacao",
  "NATAÇÃO": "natacao",
  "CICLISMO": "ciclismo",
  // Ginástica
  "GINASTICA RITMICA": "ginastica-ritmica",
  "GINÁSTICA RÍTMICA": "ginastica-ritmica",
  // JERPA
  "ATLETISMO PARALIMPICO": "atletismo-paralimpico",
  "ATLETISMO PARALÍMPICO": "atletismo-paralimpico",
  "NATACAO PARALIMPICA": "natacao-paralimpica",
  "NATAÇÃO PARALÍMPICA": "natacao-paralimpica",
  "BOCHA PARALIMPICA": "bocha-paralimpica",
  "BOCHA PARALÍMPICA": "bocha-paralimpica",
  "TENIS DE MESA PARALIMPICO": "tenis-de-mesa-paralimpico",
  "TÊNIS DE MESA PARALÍMPICO": "tenis-de-mesa-paralimpico",
  "PARABADMINTON": "parabadminton",
};

interface ParsedSportText {
  raw_combined: string;          // texto sanitizado (sem etapa)
  sport_token: string;           // o que restou após tirar gênero/idade/etapa
  age_band_raw: string | null;   // ex.: "15-17 ANOS"
  age_band_normalized: string | null; // ex.: "15-17"
  gender_raw: string | null;     // ex.: "MASCULINO"
  is_paralimpic: boolean;
}

function parseSportText(modalidadeRaw: string, competicaoRaw: string, provaRaw: string = ""): ParsedSportText {
  // SIGECOM: PROVA frequentemente carrega faixa etária e gênero (ex.: "BASQUETE 15 A 17 ANOS MASCULINO",
  // "3000 METROS", "14 A 16 ANOS - 50 METROS LIVRE - FEMININO"). Incluímos para extrair age_band/gender.
  const combined = normalizeStr(`${modalidadeRaw} ${competicaoRaw} ${provaRaw}`);
  let cleaned = ` ${combined} `;

  // Remove tokens de etapa
  for (const tok of STAGE_TOKENS) {
    cleaned = cleaned.replace(new RegExp(`\\b${tok}\\b`, "g"), " ");
  }

  // Extrai gênero
  const genderMatch = cleaned.match(/\b(FEMININO|MASCULINO|MISTO|MISTA)\b/);
  const gender = genderMatch?.[1] ?? null;
  if (genderMatch) cleaned = cleaned.replace(genderMatch[0], " ");

  // Extrai faixa etária. SIGECOM: "ANOS" às vezes está ausente em provas de
  // combate/ciclismo (ex.: "KATA INDIVIDUAL 15 A 17 FEMININO", "CICLISMO 15 A 17").
  // Aceitamos intervalo numérico (\d{1,2}-\d{1,2} ou \d A \d) com ANOS opcional;
  // valor único só se vier seguido de ANOS para evitar falso positivo com pesos/distâncias.
  const rangeMatch = cleaned.match(/\b(\d{1,2})\s*(?:[-/]|A)\s*(\d{1,2})\s*(?:ANOS?\b)?/);
  const singleMatch = !rangeMatch ? cleaned.match(/\b(\d{1,2})\s*ANOS?\b/) : null;
  let ageBandRaw: string | null = null;
  let ageBandNormalized: string | null = null;
  if (rangeMatch) {
    ageBandRaw = rangeMatch[0].replace(/\s+/g, " ").trim();
    ageBandNormalized = `${rangeMatch[1]}-${rangeMatch[2]}`;
    cleaned = cleaned.replace(rangeMatch[0], " ");
  } else if (singleMatch) {
    ageBandRaw = singleMatch[0].replace(/\s+/g, " ").trim();
    ageBandNormalized = singleMatch[1];
    cleaned = cleaned.replace(singleMatch[0], " ");
  }

  const sportToken = cleaned.replace(/\s+/g, " ").trim();
  const isParalimpic = /\bPARALIMPIC[OA]?\b|\bPARA\b/.test(combined) || /PARA/.test(sportToken);

  return {
    raw_combined: combined,
    sport_token: sportToken,
    age_band_raw: ageBandRaw,
    age_band_normalized: ageBandNormalized,
    gender_raw: gender,
    is_paralimpic: isParalimpic,
  };
}

interface SportResolution {
  sport_slug: string | null;
  reason: string;       // explicação do match (ou da falha)
  matched_by: "alias" | "exact" | "substring" | null;
}

function canonicalizeSport(
  parsed: ParsedSportText,
  sportsInCatalog: Set<string>,
  dynamicAliases: Record<string, string> = {},
): SportResolution {
  const token = parsed.sport_token;
  if (!token) {
    return { sport_slug: null, reason: "modalidade vazia após sanitização", matched_by: null };
  }

  // 0. Alias dinâmico (vindo de import_aliases — fonte de verdade)
  if (dynamicAliases[token]) {
    const slug = dynamicAliases[token];
    if (sportsInCatalog.has(slug)) {
      return { sport_slug: slug, reason: `alias DB "${token}" -> ${slug}`, matched_by: "alias" };
    }
  }

  // 1. Alias hardcoded (legado — será migrado p/ DB)
  if (SPORT_ALIASES[token]) {
    const slug = SPORT_ALIASES[token];
    if (sportsInCatalog.has(slug)) {
      return { sport_slug: slug, reason: `alias direto "${token}" -> ${slug}`, matched_by: "alias" };
    }
    return { sport_slug: null, reason: `alias "${token}" mapeia para "${slug}" mas não está no catálogo do evento`, matched_by: null };
  }

  // 2. Match exato pelo slug derivado
  const slugified = slugify(token);
  if (sportsInCatalog.has(slugified)) {
    return { sport_slug: slugified, reason: `match exato slug "${slugified}"`, matched_by: "exact" };
  }

  // 3. Match por substring (sport do catálogo é prefixo do token)
  const candidates = [...sportsInCatalog].filter(s => slugified.startsWith(s) || slugified.includes(s));
  if (candidates.length === 1) {
    return { sport_slug: candidates[0], reason: `substring única "${slugified}" ⊃ "${candidates[0]}"`, matched_by: "substring" };
  }
  if (candidates.length > 1) {
    candidates.sort((a, b) => b.length - a.length);
    return { sport_slug: candidates[0], reason: `substring (escolhido mais específico entre ${candidates.length}): ${candidates.join(", ")}`, matched_by: "substring" };
  }

  return { sport_slug: null, reason: `nenhum match para token "${token}" (slug "${slugified}") no catálogo`, matched_by: null };
}

interface CategoryResolution {
  category_slug: string | null;
  reason: string;
  matched_by: "age_band" | "single_in_catalog" | "birth_date" | null;
  candidates: string[];
}

// Mapa: (sport_slug, age_band_normalized) -> category_slug.
// Construído a partir do catálogo real do evento (entregue pela query de
// diagnóstico). Mantém regra explícita SEM chute genérico.
const AGE_BAND_TO_CATEGORY: Array<{
  sportPattern: RegExp; ageBand: string; categorySlug: string;
}> = [
  // JERPA (paralímpicas)
  { sportPattern: /paralimpic/, ageBand: "11-14", categorySlug: "jerpa-11-14" },
  { sportPattern: /paralimpic/, ageBand: "15-17", categorySlug: "jerpa-15-17" },
  { sportPattern: /^parabadminton$/, ageBand: "11-14", categorySlug: "jerpa-11-14" },
  { sportPattern: /^parabadminton$/, ageBand: "15-17", categorySlug: "jerpa-15-17" },
  // Ginástica Rítmica (faixas próprias)
  { sportPattern: /^ginastica-ritmica$/, ageBand: "11-12", categorySlug: "gr-11-12" },
  { sportPattern: /^ginastica-ritmica$/, ageBand: "13-15", categorySlug: "gr-13-15" },
  // Natação / Judô (faixas próprias)
  { sportPattern: /^(natacao|judo)$/, ageBand: "12-14", categorySlug: "nat-judo-wrest-12-14" },
  { sportPattern: /^(natacao|judo)$/, ageBand: "14-16", categorySlug: "nat-judo-wrest-14-16" },
  { sportPattern: /^(natacao|judo)$/, ageBand: "17", categorySlug: "nat-judo-wrest-17" },
  // Tênis de Mesa (faixas próprias, não-paralímpico)
  { sportPattern: /^tenis-de-mesa$/, ageBand: "12-14", categorySlug: "tm-12-14" },
  { sportPattern: /^tenis-de-mesa$/, ageBand: "14-15", categorySlug: "tm-14-15" },
  { sportPattern: /^tenis-de-mesa$/, ageBand: "16-17", categorySlug: "tm-16-17" },
  // Default JERS
  { sportPattern: /.*/, ageBand: "12-14", categorySlug: "jers-12-14" },
  { sportPattern: /.*/, ageBand: "15-17", categorySlug: "jers-15-17" },
];

// Whitelist: modalidades onde, na ausência de faixa etária na planilha, é
// seguro assumir a única categoria existente no catálogo do evento.
// Mantida explícita para evitar chute em modalidades multi-categoria.
const SINGLE_CATEGORY_FALLBACK_WHITELIST = new Set<string>([
  // Coletivos: catálogo costuma ter 1 categoria por (modalidade, naipe)
  "futebol",
  "futsal",
  "basquete",
  "volei",
  "volei-de-praia",
  "handebol",
  // Raquete/mesa quando o evento só roda 1 categoria
  "xadrez",
  "badminton",
  // Combate: muitos eventos rodam categoria única para JER
  "karate",
  "taekwondo",
  "wrestling",
]);

interface CategoryWindow { slug: string; min_birth_year: number | null; max_birth_year: number | null; gender_scope: string | null; }

/**
 * Resolve categoria canônica em até 3 estágios:
 *   1) faixa etária explícita no texto da planilha (AGE_BAND_TO_CATEGORY)
 *   2) desempate por birth_date contra categories.{min,max}_birth_year do catálogo
 *      (apenas quando restar EXATAMENTE 1 candidata compatível)
 *   3) fallback whitelist (única categoria no catálogo p/ a modalidade)
 *
 * Sem birth_date válida ou ainda ambígua => sem resolução (pendência mantida).
 */
function canonicalizeCategory(
  sportSlug: string,
  parsed: ParsedSportText,
  catalogPairs: Set<string>,                          // "sport_slug|category_slug"
  categoriesBySport: Map<string, CategoryWindow[]>,   // sport_slug -> janelas etárias
  birthDate: string | null,                           // ISO yyyy-mm-dd
  eventYear: number | null,                           // ano-base do evento (events.year)
): CategoryResolution {
  const cats = (categoriesBySport.get(sportSlug) ?? []).filter(c =>
    catalogPairs.has(`${sportSlug}|${c.slug}`),
  );
  const candidateSlugs = cats.map(c => c.slug);

  // 1. Faixa etária explícita — resolução DINÂMICA via janelas do catálogo
  //    (sem mapa hardcoded; funciona para qualquer evento/modalidade).
  if (parsed.age_band_normalized) {
    const ageParts = parsed.age_band_normalized.split("-").map(n => Number(n)).filter(n => Number.isFinite(n));
    const ageMin = ageParts[0];
    const ageMax = ageParts.length > 1 ? ageParts[1] : ageParts[0];
    if (Number.isFinite(ageMin) && Number.isFinite(ageMax) && eventYear) {
      // Faixa de birth_year derivada da faixa etária + ano-base
      const derivedBirthMin = eventYear - ageMax;
      const derivedBirthMax = eventYear - ageMin;

      // Gênero alvo a partir do texto da planilha
      const g = (parsed.gender_raw || "").toUpperCase();
      const targetGender: string | null =
        g === "MASCULINO" ? "male" :
        g === "FEMININO" ? "female" :
        (g === "MISTO" || g === "MISTA") ? "mixed" : null;

      // Filtra candidatas por sobreposição de janela e (se houver) gênero
      const matches = cats.filter(c => {
        const winMin = c.min_birth_year ?? -Infinity;
        const winMax = c.max_birth_year ?? Infinity;
        const overlaps = winMax >= derivedBirthMin && winMin <= derivedBirthMax;
        if (!overlaps) return false;
        if (targetGender && c.gender_scope && c.gender_scope !== "mixed" && c.gender_scope !== targetGender) return false;
        return true;
      });

      if (matches.length === 1) {
        return {
          category_slug: matches[0].slug,
          reason: `by_age_band: faixa "${parsed.age_band_normalized}"${targetGender ? `/${targetGender}` : ""} -> birth ∈ [${derivedBirthMin},${derivedBirthMax}] -> ${matches[0].slug}`,
          matched_by: "age_band",
          candidates: candidateSlugs,
        };
      }

      // Múltiplos matches: tentar desempate fino por birth_date dentro do subset
      if (matches.length > 1 && birthDate) {
        const by = Number(birthDate.slice(0, 4));
        if (Number.isFinite(by)) {
          const tight = matches.filter(c =>
            (c.min_birth_year == null || by >= c.min_birth_year) &&
            (c.max_birth_year == null || by <= c.max_birth_year)
          );
          if (tight.length === 1) {
            return {
              category_slug: tight[0].slug,
              reason: `by_age_band+birth_date: faixa "${parsed.age_band_normalized}"${targetGender ? `/${targetGender}` : ""} + birth_year=${by} -> ${tight[0].slug}`,
              matched_by: "age_band",
              candidates: candidateSlugs,
            };
          }
        }
      }

      // Se faixa explícita não casou com NENHUMA categoria do catálogo
      // (ex.: planilha "15 A 17" mas catálogo só tem jers-12-14, ou natação
      // só tem nat-12-14/14-16/17), NÃO falhar — cair para resolução por
      // birth_date abaixo, que escolhe pela idade real do atleta.
      // (matches.length === 0 → segue adiante)
    }
  }

  if (cats.length === 0) {
    return {
      category_slug: null,
      reason: `no_categories_in_catalog: nenhuma categoria cadastrada para "${sportSlug}"`,
      matched_by: null,
      candidates: [],
    };
  }

  // 2. Desempate por birth_date
  if (cats.length > 1) {
    if (!birthDate) {
      return {
        category_slug: null,
        reason: `no_birth_date: ambígua entre [${candidateSlugs.join(", ")}] e sem data de nascimento para desempatar`,
        matched_by: null,
        candidates: candidateSlugs,
      };
    }
    const birthYear = Number(birthDate.slice(0, 4));
    if (!Number.isFinite(birthYear)) {
      return {
        category_slug: null,
        reason: `no_birth_date: birth_date inválida "${birthDate}"`,
        matched_by: null,
        candidates: candidateSlugs,
      };
    }
    const compatible = cats.filter(c => {
      if (c.min_birth_year != null && birthYear < c.min_birth_year) return false;
      if (c.max_birth_year != null && birthYear > c.max_birth_year) return false;
      return true;
    });

    // ── Caso especial determinístico: Tênis de Mesa, atleta nascido em 2012 ──
    // Sem base normativa para escolher entre tm-12-14 e tm-14-15.
    // SEMPRE pendência manual, antes de qualquer desempate ou fallback.
    if (
      sportSlug === "tenis-de-mesa" &&
      birthYear === 2012 &&
      candidateSlugs.includes("tm-12-14") &&
      candidateSlugs.includes("tm-14-15")
    ) {
      return {
        category_slug: null,
        reason: `${TM_2012_MARKER}: TM atleta nascido em 2012 — escolha manual obrigatória entre tm-12-14 e tm-14-15`,
        matched_by: null,
        candidates: candidateSlugs,
      };
    }

    if (compatible.length === 1) {
      const chosen = compatible[0];
      const yearNote = eventYear ? ` (ano-base ${eventYear})` : "";
      return {
        category_slug: chosen.slug,
        reason: `by_birth_date: birth_year=${birthYear} ∈ [${chosen.min_birth_year ?? "-∞"}, ${chosen.max_birth_year ?? "+∞"}] -> ${chosen.slug}${yearNote}`,
        matched_by: "birth_date",
        candidates: candidateSlugs,
      };
    }
    if (compatible.length === 0) {
      // Fallback determinístico: catálogo da modalidade não tem categoria
      // para a faixa etária real do atleta (ex.: tiro-com-arco só possui
      // jers-12-14 mas atleta nasceu em 2009-2011 → faixa 15-17 inexistente).
      // Mapeia para a categoria de gênero correspondente mais próxima da idade
      // do atleta para garantir inscrição (princípio: o sistema deve aceitar
      // todas as inscrições com mapeamento determinístico).
      const targetGender =
        (parsed.gender_raw || "").toUpperCase() === "MASCULINO" ? "male" :
        (parsed.gender_raw || "").toUpperCase() === "FEMININO" ? "female" : null;
      let pool = cats;
      if (targetGender) {
        const filtered = pool.filter(c => c.gender_scope == null || c.gender_scope === "mixed" || c.gender_scope === targetGender);
        if (filtered.length > 0) pool = filtered;
      }
      // Escolhe a categoria com janela etária mais próxima do birth_year
      const scored = pool.map(c => {
        const minY = c.min_birth_year ?? -Infinity;
        const maxY = c.max_birth_year ?? Infinity;
        const dist = birthYear < minY ? minY - birthYear : birthYear > maxY ? birthYear - maxY : 0;
        return { c, dist };
      }).sort((a, b) => a.dist - b.dist);
      if (scored.length > 0) {
        const chosen = scored[0].c;
        return {
          category_slug: chosen.slug,
          reason: `by_nearest_age_band: birth_year=${birthYear} fora das janelas de [${candidateSlugs.join(", ")}], escolhida categoria mais próxima "${chosen.slug}" (distância ${scored[0].dist} ano(s))`,
          matched_by: "birth_date",
          candidates: candidateSlugs,
        };
      }
      return {
        category_slug: null,
        reason: `birth_year_out_of_range: birth_year=${birthYear} fora de toda janela de [${candidateSlugs.join(", ")}]`,
        matched_by: null,
        candidates: candidateSlugs,
      };
    }
    // ── Desempate em sobreposição de faixas (ex.: nat-12-14 e nat-14-16 ambos
    //    aceitam 2012). Regra geral JER: atleta compete na faixa MAIS NOVA
    //    compatível com sua idade (princípio padrão de competições escolares).
    //    Exceção: Tênis de Mesa 2012 (já tratado acima como pendência manual).
    //    Exceção: se o gênero da prova bruta foi extraído, filtramos por gênero
    //    primeiro (slugs com sufixo -male/-female).
    const targetGender =
      (parsed.gender_raw || "").toUpperCase() === "MASCULINO" ? "male" :
      (parsed.gender_raw || "").toUpperCase() === "FEMININO" ? "female" : null;
    let pool = compatible;
    if (targetGender) {
      const filtered = pool.filter(c => c.gender_scope == null || c.gender_scope === "mixed" || c.gender_scope === targetGender);
      if (filtered.length > 0) pool = filtered;
    }
    if (pool.length === 1) {
      const chosen = pool[0];
      return {
        category_slug: chosen.slug,
        reason: `by_birth_date+gender: birth_year=${birthYear}, gender=${targetGender ?? "—"} -> ${chosen.slug}`,
        matched_by: "birth_date",
        candidates: candidateSlugs,
      };
    }
    // Escolhe a faixa MAIS NOVA (max_birth_year mais alto = atletas mais novos)
    const sorted = [...pool].sort((a, b) => (b.max_birth_year ?? 0) - (a.max_birth_year ?? 0));
    const chosen = sorted[0];
    return {
      category_slug: chosen.slug,
      reason: `by_age_overlap_youngest: birth_year=${birthYear} compatível com [${pool.map(c => c.slug).join(", ")}], escolhida faixa mais nova "${chosen.slug}"`,
      matched_by: "birth_date",
      candidates: candidateSlugs,
    };
  }

  // 3. Única categoria no catálogo
  const onlySlug = cats[0].slug;
  if (SINGLE_CATEGORY_FALLBACK_WHITELIST.has(sportSlug)) {
    return {
      category_slug: onlySlug,
      reason: `single_in_catalog (whitelist): "${sportSlug}" possui única categoria (${onlySlug})`,
      matched_by: "single_in_catalog",
      candidates: candidateSlugs,
    };
  }
  // Tentar via birth_date mesmo com 1 categoria, para validar coerência
  if (birthDate) {
    const birthYear = Number(birthDate.slice(0, 4));
    const c = cats[0];
    const inRange =
      (c.min_birth_year == null || birthYear >= c.min_birth_year) &&
      (c.max_birth_year == null || birthYear <= c.max_birth_year);
    if (inRange) {
      return {
        category_slug: onlySlug,
        reason: `by_birth_date: única categoria "${onlySlug}" e birth_year=${birthYear} compatível`,
        matched_by: "birth_date",
        candidates: candidateSlugs,
      };
    }
    // Fallback determinístico: única categoria do catálogo, mesmo fora da
    // janela etária — aceita inscrição (sistema deve mapear todas as inscrições).
    return {
      category_slug: onlySlug,
      reason: `by_only_category_available: birth_year=${birthYear} fora de [${c.min_birth_year ?? "-∞"}, ${c.max_birth_year ?? "+∞"}], mas "${onlySlug}" é a única categoria disponível no catálogo desta modalidade`,
      matched_by: "single_in_catalog",
      candidates: candidateSlugs,
    };
  }
  return {
    category_slug: null,
    reason: `no_birth_date: única categoria "${onlySlug}" mas não está na whitelist e sem birth_date para confirmar`,
    matched_by: null,
    candidates: candidateSlugs,
  };
}

function deriveProvaName(sportSlug: string, categorySlug: string): string {
  // Padrão observado no catálogo: "<Sport Name> - <category-slug>"
  // Como o catálogo só guarda 1 prova por (sport, category) na maioria dos
  // casos, montamos o slug correspondente.
  return `${sportSlug}--${categorySlug}`;
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
    return newRow;
  });
}

function deriveParticipantType(userType: string, funcao: string): string {
  const ut = (userType || "").toLowerCase();
  const fn = (funcao || "").toLowerCase();
  // Atleta sempre vence (mesmo se TIPO USUARIO vier composto)
  if (ut.includes("atleta")) return "athlete";
  // Chefe de delegação tem prioridade sobre técnico/prestador
  if (fn.includes("chefe de delegação") || fn.includes("chefe de delegacao") || ut.includes("chefe de delegação") || ut.includes("chefe de delegacao")) return "head_of_delegation";
  // Comissão técnica / técnico antes de prestador (para casos compostos do SIGECOM
  // como "Prestador de serviço, Comissão técnica")
  if (ut.includes("comissão técnica") || ut.includes("comissao tecnica") || fn.includes("técnico") || fn.includes("tecnico")) return "coach";
  if (ut.includes("prestador")) return "staff";
  return "staff";
}

function mapColumns(
  raw: RawRow,
  rowIndex: number,
  catalog: {
    sportsSet: Set<string>;
    sportCategoryPairs: Set<string>;
    categoriesBySport: Map<string, CategoryWindow[]>;
    eventYear: number | null;
    sportAliases?: Record<string, string>;
    categoryAliases?: Record<string, string>;
  },
): NormalizedRow {
  const fullName = normalizeName(getField(raw, "NOME", "NOME COMPLETO"));
  const institution = getField(raw, "ESCOLA", "INSTITUICAO");
  const sportRaw = getField(raw, "MODALIDADE");
  const competicaoRaw = getField(raw, "COMPETICAO", "CATEGORIA");
  const prova = getField(raw, "PROVA");
  const userType = getField(raw, "TIPO USUARIO", "TIPO_USUARIO");
  const status = getField(raw, "STATUS DA INSCRIÇÃO", "STATUS DA INSCRICAO", "STATUS_INSCRICAO");
  const funcao = getField(raw, "FUNCAO");
  const pcd = getField(raw, "PCD");
  const esfera = getField(raw, "ESFERA");
  const externalCredential = getField(raw, "CREDENCIAL") || null;

  const cpfRaw = cleanCpfRaw(getField(raw, "CPF") || null);
  const cpfDigits = extractCpfDigits(cpfRaw);
  const cpfValid = cpfDigits && validateCpfDigits(cpfDigits) ? cpfDigits : null;

  const rawBirthDate = String(raw["DATA NASCIMENTO"] ?? raw["DATA_NASCIMENTO"] ?? "").trim();
  const birthDate = parseDate(raw["DATA NASCIMENTO"] ?? raw["DATA_NASCIMENTO"]);

  // ── Parser canônico: modalidade + categoria do catálogo ──
  const parsed = parseSportText(sportRaw, competicaoRaw, prova);
  const sportRes = canonicalizeSport(parsed, catalog.sportsSet, catalog.sportAliases ?? {});
  let categoryRes: CategoryResolution = {
    category_slug: null, reason: "modalidade não resolvida", matched_by: null, candidates: [],
  };
  let provaSlug = "";
  if (sportRes.sport_slug) {
    categoryRes = canonicalizeCategory(
      sportRes.sport_slug,
      parsed,
      catalog.sportCategoryPairs,
      catalog.categoriesBySport,
      birthDate,
      catalog.eventYear,
    );
    if (categoryRes.category_slug) {
      provaSlug = deriveProvaName(sportRes.sport_slug, categoryRes.category_slug);
    }
  }

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
    sport_raw: sportRaw,
    competicao_raw: competicaoRaw,
    sport_name: sportRaw,
    sport_slug: sportRes.sport_slug ?? "",
    category_name: competicaoRaw,
    category_slug: categoryRes.category_slug ?? "",
    prova_name: prova,
    prova_slug: provaSlug,
    parse_age_band: parsed.age_band_normalized,
    parse_gender: parsed.gender_raw,
    parse_is_paralimpic: parsed.is_paralimpic,
    parse_sport_reason: sportRes.reason,
    parse_category_reason: categoryRes.reason,
    category_candidates: categoryRes.candidates,
    category_resolved_by: categoryRes.matched_by,
    user_type: userType,
    inscription_status: status,
    participant_type: deriveParticipantType(userType, funcao),
    funcao,
    pcd: isBlank(pcd) ? null : pcd,
    esfera,
    external_credential: externalCredential,
    raw_payload: raw,
  };
}

// ─── READ-ONLY Validation ────────────────────────────────────────────

interface ReadOnlyMaps {
  institutions: Map<string, string>;
  sports: Map<string, string>;                // sport_slug -> sport_id
  categories: Map<string, string>;            // category_slug -> category_id
  sportEvents: Map<string, string>;           // "sport_id|category_id|prova_slug" -> sport_event_id
  sportEventsBySportCat: Map<string, Array<{ id: string; slug: string; name: string }>>; // "sport_id|category_id" -> SEs
  sportCategoryPairs: Set<string>;            // "sport_slug|category_slug" presentes no catálogo
  sportsSet: Set<string>;                     // sport_slugs presentes no catálogo
  categoriesBySport: Map<string, CategoryWindow[]>; // sport_slug -> janelas etárias do catálogo
  eventYear: number | null;                   // events.year (ano-base do desempate por idade)
  delegations: Map<string, string>;
  existingInstitutionSlugs: Set<string>;
  /** Aliases dinâmicos vindos da tabela import_aliases (kind='sport'). */
  sportAliases: Record<string, string>;
  /** Aliases dinâmicos vindos da tabela import_aliases (kind='category'). */
  categoryAliases: Record<string, string>;
  /** Credenciais externas já ocupadas (credential_code -> participant_id). */
  existingCredentials: Map<string, string>;
}

async function loadReadOnlyMaps(
  supabase: any,
  eventId: string,
): Promise<ReadOnlyMaps> {
  const [instRes, sportRes, catRes, seRes, delRes, evRes, aliasRes, credRes] = await Promise.all([
    supabase.from("institutions").select("id, slug").eq("is_active", true),
    supabase.from("sports").select("id, slug").eq("event_id", eventId),
    supabase.from("categories").select("id, slug, min_birth_year, max_birth_year, gender_scope").eq("event_id", eventId),
    supabase.from("sport_events").select("id, sport_id, category_id, slug, name").eq("event_id", eventId),
    supabase.from("delegations").select("id, institution_id").eq("event_id", eventId),
    supabase.from("events").select("year").eq("id", eventId).maybeSingle(),
    supabase.from("import_aliases")
      .select("alias_norm, canonical_slug, kind, event_id")
      .or(`event_id.eq.${eventId},event_id.is.null`),
    supabase.from("external_credentials").select("credential_code, participant_id").eq("event_id", eventId).eq("status", "active"),
  ]);

  const institutions = new Map<string, string>();
  for (const i of (instRes.data ?? []) as any[]) institutions.set(i.slug, i.id);

  const sports = new Map<string, string>();
  const sportsById = new Map<string, string>();
  for (const s of (sportRes.data ?? []) as any[]) {
    sports.set(s.slug, s.id);
    sportsById.set(s.id, s.slug);
  }

  const categories = new Map<string, string>();
  const catsById = new Map<string, string>();
  const catWindowBySlug = new Map<string, CategoryWindow>();
  for (const c of (catRes.data ?? []) as any[]) {
    categories.set(c.slug, c.id);
    catsById.set(c.id, c.slug);
    catWindowBySlug.set(c.slug, {
      slug: c.slug,
      min_birth_year: c.min_birth_year ?? null,
      max_birth_year: c.max_birth_year ?? null,
      gender_scope: (c as any).gender_scope ?? null,
    });
  }

  const sportEvents = new Map<string, string>();
  const sportEventsBySportCat = new Map<string, Array<{ id: string; slug: string; name: string }>>();
  const sportCategoryPairs = new Set<string>();
  const categoriesBySport = new Map<string, CategoryWindow[]>();
  for (const se of (seRes.data ?? []) as any[]) {
    sportEvents.set(`${se.sport_id}|${se.category_id}|${se.slug}`, se.id);
    const pairKey = `${se.sport_id}|${se.category_id}`;
    const arrSE = sportEventsBySportCat.get(pairKey) ?? [];
    arrSE.push({ id: se.id, slug: se.slug, name: se.name ?? se.slug });
    sportEventsBySportCat.set(pairKey, arrSE);
    const sSlug = sportsById.get(se.sport_id);
    const cSlug = catsById.get(se.category_id);
    if (sSlug && cSlug) {
      sportCategoryPairs.add(`${sSlug}|${cSlug}`);
      const win = catWindowBySlug.get(cSlug);
      if (win) {
        const arr = categoriesBySport.get(sSlug) ?? [];
        if (!arr.find(x => x.slug === cSlug)) arr.push(win);
        categoriesBySport.set(sSlug, arr);
      }
    }
  }

  const delegations = new Map<string, string>();
  for (const d of (delRes.data ?? []) as any[]) delegations.set(d.institution_id, d.id);

  const eventYear = (evRes.data as { year?: number | null } | null)?.year ?? null;

  // Aliases dinâmicos da fonte de verdade (event-scoped tem prioridade sobre global)
  const sportAliases: Record<string, string> = {};
  const categoryAliases: Record<string, string> = {};
  const aliasRows = (aliasRes.data ?? []) as Array<{
    alias_norm: string; canonical_slug: string; kind: string; event_id: string | null;
  }>;
  // Ordena: globais primeiro, depois event-scoped (sobrescreve)
  aliasRows.sort((a, b) => Number(!!a.event_id) - Number(!!b.event_id));
  for (const a of aliasRows) {
    const key = a.alias_norm.toUpperCase();
    if (a.kind === "sport") sportAliases[key] = a.canonical_slug;
    else if (a.kind === "category") categoryAliases[key] = a.canonical_slug;
  }

  return {
    institutions,
    sports,
    categories,
    sportEvents,
    sportEventsBySportCat,
    sportCategoryPairs,
    sportsSet: new Set(sports.keys()),
    categoriesBySport,
    eventYear,
    delegations,
    existingInstitutionSlugs: new Set(institutions.keys()),
    sportAliases,
    categoryAliases,
  };
}

// ─── Incremental People Lookup ───────────────────────────────────────

interface PeopleMaps {
  byCpf: Map<string, string>;                    // cpf_digits -> person_id
  byNameDob: Map<string, string[]>;              // "name|dob|gender" -> person_id[] (supports ambiguity)
}

async function loadPeopleIncremental(
  supabase: any,
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
    for (const p of (data ?? []) as any[]) {
      if (p.cpf) byCpf.set(p.cpf as string, p.id as string);
      if (p.full_name && p.birth_date) {
        const key = `${(p.full_name as string).toLowerCase()}|${p.birth_date}|${p.gender}`;
        const arr = byNameDob.get(key) || [];
        arr.push(p.id as string);
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
    for (const p of (data ?? []) as any[]) {
      if (p.cpf && !byCpf.has(p.cpf as string)) byCpf.set(p.cpf as string, p.id as string);
      if (p.full_name && p.birth_date) {
        const key = `${(p.full_name as string).toLowerCase()}|${p.birth_date}|${p.gender}`;
        const arr = byNameDob.get(key) || [];
        if (!arr.includes(p.id as string)) arr.push(p.id as string);
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

  // Skip invalid inscription status — aceita variações usadas pelo SIGECOM.
  // Aceitos como válidos (segue): vazio, "valida", "deferida", "aprovada", "homologada", "confirmada".
  // Tudo o mais (indeferida, pendente, cancelada, etc.) é ignorado com warning.
  const statusNorm = row.inscription_status
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim();
  const STATUS_OK = new Set(["", "valida", "deferida", "aprovada", "homologada", "confirmada"]);
  if (statusNorm && !STATUS_OK.has(statusNorm)) {
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
  // O parser canônico já tentou resolver row.sport_slug e row.category_slug
  // contra o catálogo. Aqui apenas classificamos as falhas com códigos
  // específicos para diferenciar parser vs catálogo vs ambiguidade.
  if (isAthlete) {
    if (!row.sport_raw) {
      errors.push({ row: row.row_number, field: "MODALIDADE", value: "", code: "SPORT_MISSING", message: "Modalidade obrigatória para atletas" });
      return { status: "erro_bloqueante", errors, warnings, pending, resolved };
    }
    if (!row.sport_slug) {
      pending.push({
        row_number: row.row_number, reason_code: "SPORT_PARSE_FAILED",
        reason_detail: `Modalidade bruta "${row.sport_raw}" não foi resolvida no catálogo. Motivo: ${row.parse_sport_reason}`,
        row, fingerprint, candidate_person_id: null,
      });
      return { status: "pendencia", errors, warnings, pending, resolved };
    }
    const sportId = maps.sports.get(row.sport_slug);
    if (!sportId) {
      pending.push({
        row_number: row.row_number, reason_code: "SPORT_EVENT_NOT_FOUND_CANONICAL",
        reason_detail: `Modalidade canônica "${row.sport_slug}" deveria estar no catálogo, mas não foi encontrada`,
        row, fingerprint, candidate_person_id: null,
      });
      return { status: "pendencia", errors, warnings, pending, resolved };
    }
    resolved.sport_id = sportId;

    if (!row.category_slug) {
      // Diferenciar ambiguidade (com motivo textual) vs falha pura de parsing.
      // Os marcadores 'no_birth_date' / 'ambiguous_after_age' / 'birth_year_out_of_range'
      // vêm do canonicalizeCategory.
      const reason = row.parse_category_reason || "";
      const isTM2012 = reason.startsWith(TM_2012_MARKER);
      const isAmbiguous =
        !isTM2012 && (
          /amb[ií]gua/.test(reason) ||
          reason.startsWith("no_birth_date") ||
          reason.startsWith("ambiguous_after_age") ||
          reason.startsWith("birth_year_out_of_range")
        );
      const code: PendingCode = isTM2012
        ? "TM_2012_MANUAL_CATEGORY_SELECTION"
        : (isAmbiguous ? "SPORT_EVENT_AMBIGUOUS" : "CATEGORY_PARSE_FAILED");
      const detail = isTM2012
        ? `Tênis de Mesa, atleta nascido em 2012: escolha manual obrigatória entre tm-12-14 e tm-14-15. Candidatas=[${row.category_candidates.join(", ")}]. birth_date=${row.birth_date ?? "null"}.`
        : `Categoria não resolvida para "${row.sport_slug}". Candidatas=[${row.category_candidates.join(", ") || "—"}]. birth_date=${row.birth_date ?? "null"}. Motivo: ${reason}`;
      pending.push({
        row_number: row.row_number,
        reason_code: code,
        reason_detail: detail,
        row, fingerprint, candidate_person_id: null,
      });
      return { status: "pendencia", errors, warnings, pending, resolved };
    }
    const catId = maps.categories.get(row.category_slug);
    if (!catId) {
      pending.push({
        row_number: row.row_number, reason_code: "SPORT_EVENT_NOT_FOUND_CANONICAL",
        reason_detail: `Categoria canônica "${row.category_slug}" não encontrada no catálogo do evento`,
        row, fingerprint, candidate_person_id: null,
      });
      return { status: "pendencia", errors, warnings, pending, resolved };
    }
    resolved.category_id = catId;

    if (!row.prova_slug) {
      pending.push({
        row_number: row.row_number, reason_code: "PROVA_PARSE_FAILED",
        reason_detail: `Prova não derivada (sport=${row.sport_slug}, category=${row.category_slug})`,
        row, fingerprint, candidate_person_id: null,
      });
      return { status: "pendencia", errors, warnings, pending, resolved };
    }

    const seKey = `${sportId}|${catId}|${row.prova_slug}`;
    let seId = maps.sportEvents.get(seKey);
    if (!seId) {
      // O slug derivado pelo importador (`<sport>--<cat>`) raramente bate com
      // o slug real do catálogo (ex.: `futsal-partida-jers-15-17-male`,
      // `badminton-simples-masc-jers-15-17-male`). Buscamos os SEs do par
      // (sport_id, category_id) e tentamos:
      //   1) Se houver 1 SE só → usa direto (coletivas).
      //   2) Se houver vários → usa o motor inteligente para casar pelo nome
      //      da prova bruta (ex.: "SIMPLES 15 A 17 ANOS MASCULINO" →
      //      `badminton-simples-masc-...`).
      //   3) Se nem isso resolver → pendência informativa.
      const candidates = maps.sportEventsBySportCat.get(`${sportId}|${catId}`) ?? [];
      if (candidates.length === 1) {
        seId = candidates[0].id;
      } else if (candidates.length > 1) {
        // Motor genérico: scoring por tokens contra o catálogo REAL.
        // Funciona para QUALQUER prova (não depende de listas hardcoded).
        const rawText = `${row.prova_name || ""} ${row.competicao_raw || ""} ${row.sport_raw || ""}`;
        const mr = matchEventInCatalog(rawText, candidates);
        if (mr.event_id) {
          seId = mr.event_id;
        } else {
          pending.push({
            row_number: row.row_number, reason_code: "SPORT_EVENT_AMBIGUOUS",
            reason_detail: `Modalidade "${row.sport_slug}" / categoria "${row.category_slug}": catálogo tem ${candidates.length} provas e o motor não conseguiu decidir. PROVA bruta="${row.prova_name || "—"}". Top scores: ${mr.candidates.map(c => `${c.slug}=${c.score}`).join(", ")}. Razões: ${mr.reasons.join(" | ")}`,
            row, fingerprint, candidate_person_id: null,
          });
          return { status: "pendencia", errors, warnings, pending, resolved };
        }
      } else {
        pending.push({
          row_number: row.row_number, reason_code: "SPORT_EVENT_NOT_FOUND_CANONICAL",
          reason_detail: `Nenhum sport_event cadastrado para ${row.sport_slug} / ${row.category_slug} no catálogo do evento`,
          row, fingerprint, candidate_person_id: null,
        });
        return { status: "pendencia", errors, warnings, pending, resolved };
      }
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

// ─── Manual resolutions for TM 2012 (override por chave estável) ─────
//
// Chave estável usada para casar override com linha da planilha:
//   `${event_stage_id}|${source_row_number}|${fallback_fingerprint}`
//
// O override só vale para a mesma etapa, mesma posição na planilha original
// E mesmo fingerprint (nome+dob+gender+inst+modalidade+prova). Isso impede
// que uma escolha manual de um lote/etapa vaze para outro.
interface ManualOverride {
  pending_id: string;
  category_slug: string; // tm-12-14 | tm-14-15
}

async function loadTm2012Overrides(
  client: any,
  eventId: string,
  eventStageId: string,
): Promise<Map<string, ManualOverride>> {
  const { data, error } = await client
    .from("import_pendencias")
    .select("id, source_row_number, fallback_fingerprint, raw_payload_json")
    .eq("event_id", eventId)
    .eq("event_stage_id", eventStageId)
    .eq("pending_reason_code", "TM_2012_MANUAL_CATEGORY_SELECTION")
    .eq("resolution_status", "resolved");
  if (error || !data) return new Map();
  const out = new Map<string, ManualOverride>();
  for (const r of data) {
    const mr = (r.raw_payload_json as any)?.manual_resolution;
    const chosen = mr?.chosen_category_slug;
    if (!chosen || !TM_2012_VALID_CHOICES.has(chosen)) continue;
    if (r.source_row_number == null || !r.fallback_fingerprint) continue;
    const key = `${eventStageId}|${r.source_row_number}|${r.fallback_fingerprint}`;
    out.set(key, { pending_id: r.id as string, category_slug: chosen });
  }
  return out;
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

    // ── Ação: marcar pendência como revisada (qualquer tipo, com sugestão IA opcional) ──
    // Body: { action: "mark_reviewed", pending_id, ai_suggestion? }
    if ((body as any)?.action === "mark_reviewed") {
      const pendingId = (body as any).pending_id as string | undefined;
      if (!pendingId) {
        return new Response(JSON.stringify({ error: "pending_id obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const serviceClientMR = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: pend, error: pendErr } = await serviceClientMR
        .from("import_pendencias")
        .select("id, raw_payload_json")
        .eq("id", pendingId)
        .maybeSingle();
      if (pendErr || !pend) {
        return new Response(JSON.stringify({ error: "Pendência não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const payload = ((pend as any).raw_payload_json as Record<string, unknown>) ?? {};
      const aiSuggestion = (body as any).ai_suggestion;
      if (aiSuggestion) payload["ai_resolution"] = aiSuggestion;
      const { error: upErr } = await serviceClientMR
        .from("import_pendencias")
        .update({
          raw_payload_json: payload,
          resolution_status: "resolved",
          resolved_by: operatorId,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", pendingId);
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, pending_id: pendingId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Ação especial: gravar escolha manual de categoria para TM 2012 ──
    // Body: { action: "apply_manual_resolution", pending_id, chosen_category_slug }
    if ((body as any)?.action === "apply_manual_resolution") {
      const pendingId = (body as any).pending_id as string | undefined;
      const chosen = (body as any).chosen_category_slug as string | undefined;
      if (!pendingId || !chosen) {
        return new Response(JSON.stringify({ error: "pending_id e chosen_category_slug são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!TM_2012_VALID_CHOICES.has(chosen)) {
        return new Response(JSON.stringify({ error: `chosen_category_slug deve ser um de: ${[...TM_2012_VALID_CHOICES].join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const serviceClientLocal = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: pend, error: pendErr } = await serviceClientLocal
        .from("import_pendencias")
        .select("id, pending_reason_code, raw_payload_json, event_id, event_stage_id")
        .eq("id", pendingId).maybeSingle();
      if (pendErr || !pend) {
        return new Response(JSON.stringify({ error: "Pendência não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (pend.pending_reason_code !== "TM_2012_MANUAL_CATEGORY_SELECTION") {
        return new Response(JSON.stringify({ error: "Esta pendência não é do tipo TM 2012" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const payload = (pend.raw_payload_json as any) ?? {};
      payload.manual_resolution = {
        chosen_category_slug: chosen,
        resolved_by: operatorId,
        resolved_at: new Date().toISOString(),
      };
      const { error: upErr } = await serviceClientLocal
        .from("import_pendencias")
        .update({
          raw_payload_json: payload,
          resolution_status: "resolved",
          resolved_by: operatorId,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", pendingId);
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        ok: true,
        pending_id: pendingId,
        chosen_category_slug: chosen,
        message: "Escolha gravada. Reimporte a planilha (mesma etapa) para reprocessar a linha.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let { rows: rawRows, event_id: eventId, event_stage_id: eventStageId, mode, file_name: fileName,
          import_log_id: providedImportLogId, chunk_index: chunkIndex, chunk_total: chunkTotal,
          row_offset: rowOffset } = body as {
      rows: RawRow[]; event_id: string; event_stage_id?: string; mode: string; file_name?: string;
      import_log_id?: string; chunk_index?: number; chunk_total?: number; row_offset?: number;
    };
    const isChunked = typeof chunkIndex === "number" && typeof chunkTotal === "number";

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

    // Load READ-ONLY maps (no writes!) — necessário ANTES do mapColumns
    // porque o parser canônico precisa do catálogo do evento.
    const maps = await loadReadOnlyMaps(serviceClient, eventId);

    // Normalize rows usando catálogo canônico
    const catalog = {
      sportsSet: maps.sportsSet,
      sportCategoryPairs: maps.sportCategoryPairs,
      categoriesBySport: maps.categoriesBySport,
      eventYear: maps.eventYear,
      sportAliases: maps.sportAliases,
      categoryAliases: maps.categoryAliases,
    };
    const normalizedRows = rawRows.map((raw, i) => mapColumns(raw, i, catalog));

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

    // ── Carregar overrides manuais (TM 2012) gravados em pendências resolvidas ──
    const manualOverrides = await loadTm2012Overrides(serviceClient, eventId, eventStageId);
    let manualOverridesApplied = 0;

    for (const row of normalizedRows) {
      // Aplicar override manual TM 2012, se existir, ANTES de classificar.
      // Chave estável: event_stage_id + source_row_number + fingerprint.
      const fp = buildFingerprint(
        row.full_name, row.birth_date, row.gender,
        row.institution_name, row.sport_name, row.prova_name,
      );
      const overrideKey = `${eventStageId}|${row.row_number}|${fp}`;
      const override = manualOverrides.get(overrideKey);
      if (override && row.sport_slug === "tenis-de-mesa") {
        row.category_slug = override.category_slug;
        row.category_name = override.category_slug;
        row.prova_slug = deriveProvaName(row.sport_slug, override.category_slug);
        row.prova_name = row.prova_slug;
        row.parse_category_reason = `manual_override: pending_id=${override.pending_id} -> ${override.category_slug}`;
        row.category_resolved_by = "manual" as any;
        manualOverridesApplied++;
      }

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
          if (
            p.reason_code === "SPORT_EVENT_NOT_FOUND" ||
            p.reason_code === "SPORT_EVENT_NOT_FOUND_CANONICAL" ||
            p.reason_code === "SPORT_PARSE_FAILED" ||
            p.reason_code === "CATEGORY_PARSE_FAILED" ||
            p.reason_code === "PROVA_PARSE_FAILED" ||
            p.reason_code === "SPORT_EVENT_AMBIGUOUS"
          ) seNaoEncontrados++;
        }
        continue;
      }

      // ok
      allErrors.push(...result.errors);
      validRows.push({ row, resolved: result.resolved });

      if (row.cpf_valid) { cpfsValidos++; }
      if (result.resolved.person_action === "reuse") cpfsReutilizados++;
      if (result.resolved.person_action === "create") cpfsNovos++;
      if (result.resolved.institution_will_create === "true") institutionsToCreate.add(row.institution_slug);
      if (result.resolved.delegation_will_create === "true") delegationsToCreate.add(row.institution_slug);
    }

    // Breakdown por código (para o frontend mostrar contadores específicos)
    const pendingByCode: Record<string, number> = {};
    for (const p of allPending) {
      pendingByCode[p.reason_code] = (pendingByCode[p.reason_code] ?? 0) + 1;
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
      pending_by_code: pendingByCode,
      manual_overrides_applied: manualOverridesApplied,
      errors: allErrors.slice(0, 50),
      warnings: allWarnings.slice(0, 50),
      pendencias_preview: allPending.slice(0, 30).map(p => ({
        row_number: p.row_number,
        reason_code: p.reason_code,
        reason_detail: p.reason_detail,
        fingerprint: p.fingerprint,
        normalized_name: p.row.full_name,
        cpf_raw: p.row.cpf_raw,
        candidate_person_id: p.candidate_person_id,
        // Rastreabilidade do parsing canônico:
        sport_raw: p.row.sport_raw,
        competicao_raw: p.row.competicao_raw,
        sport_slug_resolved: p.row.sport_slug || null,
        category_slug_resolved: p.row.category_slug || null,
        prova_slug_resolved: p.row.prova_slug || null,
        parse_age_band: p.row.parse_age_band,
        parse_gender: p.row.parse_gender,
        parse_is_paralimpic: p.row.parse_is_paralimpic,
        parse_sport_reason: p.row.parse_sport_reason,
        parse_category_reason: p.row.parse_category_reason,
        // Desempate por idade:
        birth_date: p.row.birth_date,
        category_candidates: p.row.category_candidates,
        category_resolved: p.row.category_slug || null,
        category_resolution_reason: p.row.parse_category_reason,
        category_resolved_by: p.row.category_resolved_by,
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

    // Create import log (reuse if provided by chunked client)
    let importLogId: string | undefined = providedImportLogId;
    if (!importLogId) {
      const { data: logData } = await serviceClient.from("import_logs").insert({
        event_id: eventId,
        event_stage_id: eventStageId,
        source_phase_name: stageData.name,
        source_phase_slug: stageData.slug,
        performed_by: operatorId,
        file_name: fileName || "unknown",
        row_count: isChunked && typeof chunkTotal === "number" ? chunkTotal : rawRows.length,
        status: "processing",
      }).select("id").single();
      importLogId = logData?.id;
    }

    // ── Background processing (evita CPU Time exceeded em planilhas grandes) ──
    const processCommit = async () => {
      try {
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
          for (let i = 0; i < pendBatch.length; i += 200) {
            await serviceClient.from("import_pendencias").insert(pendBatch.slice(i, i + 200));
          }
        }

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

        const newDelMap = new Map<string, string>();
        let delegationsCreated = 0;
        for (const slug of delegationsToCreate) {
          const instId = allInstMap.get(slug);
          if (!instId) continue;
          if (maps.delegations.has(instId)) continue;
          const sampleRow = validRows.find(r => r.row.institution_slug === slug)?.row;
          const schoolName = sampleRow?.institution_name || slug;
          const { data, error } = await serviceClient.from("delegations")
            .insert({
              institution_id: instId,
              event_id: eventId,
              status: "confirmed",
              school_name: schoolName,
              school_slug: slug,
              school_network_type: "pending_review",
            }).select("id").single();
          if (error) {
            const { data: existing } = await serviceClient.from("delegations")
              .select("id").eq("institution_id", instId).eq("event_id", eventId).maybeSingle();
            if (existing) newDelMap.set(instId, existing.id);
            else console.error("[delegations] insert failed:", { slug, instId, error: error.message });
          } else {
            newDelMap.set(instId, data.id);
            delegationsCreated++;
          }
        }

        const allDelMap = new Map(maps.delegations);
        for (const [instId, delId] of newDelMap) allDelMap.set(instId, delId);

        let peopleCreated = 0, peopleReused = 0;
        let participantsCreated = 0, participantsReused = 0;
        let pseCreated = 0, pseReused = 0;
        let pesCreated = 0, pesReused = 0;
        let rowsFailed = 0;
        let rowsSkippedDuplicate = 0;
        const commitErrors: { row_number: number; error_code: string; error_message: string; payload?: Record<string, unknown> }[] = [];
        const processedPersonKeys = new Set<string>();

        const { data: existingParticipants } = await serviceClient
          .from("participants").select("id, person_id").eq("event_id", eventId);
        const participantByPerson = new Map<string, string>();
        for (const p of existingParticipants ?? []) participantByPerson.set(p.person_id, p.id);

        const { data: existingPSE } = await serviceClient
          .from("participant_sport_events").select("id, participant_id, sport_event_id, event_stage_id")
          .in("participant_id", [...participantByPerson.values(), "00000000-0000-0000-0000-000000000000"]);
        const pseSet = new Set<string>();
        for (const p of existingPSE ?? []) {
          pseSet.add(`${p.participant_id}|${p.sport_event_id}|${p.event_stage_id ?? "null"}`);
        }

        const { data: existingPES } = await serviceClient
          .from("participant_event_stages").select("participant_id").eq("event_stage_id", eventStageId);
        const pesSet = new Set<string>();
        for (const r of existingPES ?? []) pesSet.add(r.participant_id);

        let processed = 0;
        const total = validRows.length;
        const progressEvery = Math.max(50, Math.floor(total / 20));

        for (const { row, resolved } of validRows) {
          try {
            const instId = resolved.institution_id || allInstMap.get(row.institution_slug);
            const delId = instId ? (resolved.delegation_id || allDelMap.get(instId)) : null;

            if (!instId || !delId) {
              commitErrors.push({ row_number: row.row_number, error_code: "DELEGATION_FAILED", error_message: "Não conseguiu resolver delegação" });
              rowsFailed++; processed++; continue;
            }

            const personKey = row.cpf_valid!;
            let personId = resolved.person_id || null;

            if (resolved.person_action === "create") {
              if (processedPersonKeys.has(personKey)) {
                const { data: lookupData } = await serviceClient.from("people").select("id").eq("cpf", row.cpf_valid!).single();
                if (lookupData) { personId = lookupData.id; peopleReused++; }
              } else {
                processedPersonKeys.add(personKey);
                const { data: newPerson, error: personErr } = await serviceClient.from("people").insert({
                  full_name: row.full_name, birth_date: row.birth_date, gender: row.gender,
                  cpf: row.cpf_valid, rg: row.rg, email: row.email, phone: row.phone,
                  institution_id: instId, disability_type: row.pcd,
                }).select("id").single();
                if (personErr) {
                  if (row.cpf_valid) {
                    const { data: existing } = await serviceClient.from("people").select("id").eq("cpf", row.cpf_valid).single();
                    if (existing) { personId = existing.id; peopleReused++; }
                    else { commitErrors.push({ row_number: row.row_number, error_code: "PERSON_CREATE_FAILED", error_message: personErr.message }); rowsFailed++; processed++; continue; }
                  } else {
                    commitErrors.push({ row_number: row.row_number, error_code: "PERSON_CREATE_FAILED", error_message: personErr.message }); rowsFailed++; processed++; continue;
                  }
                } else {
                  personId = newPerson.id; peopleCreated++;
                  if (row.cpf_valid) people.byCpf.set(row.cpf_valid, personId!);
                }
              }
            } else {
              peopleReused++;
            }

            if (!personId) {
              commitErrors.push({ row_number: row.row_number, error_code: "PERSON_MISSING", error_message: "Pessoa não resolvida" });
              rowsFailed++; processed++; continue;
            }

            let participantId = participantByPerson.get(personId);
            if (participantId) {
              participantsReused++;
            } else {
              const { data: newPart, error: partErr } = await serviceClient.from("participants").insert({
                person_id: personId, event_id: eventId, delegation_id: delId,
                participant_type: row.participant_type, status: "confirmed",
              }).select("id").single();
              if (partErr) {
                const { data: existing } = await serviceClient.from("participants")
                  .select("id").eq("person_id", personId).eq("event_id", eventId).single();
                if (existing) { participantId = existing.id; participantsReused++; }
                else { commitErrors.push({ row_number: row.row_number, error_code: "PARTICIPANT_FAILED", error_message: partErr.message }); rowsFailed++; processed++; continue; }
              } else {
                participantId = newPart.id; participantsCreated++;
                participantByPerson.set(personId, participantId as string);
              }
            }

            if (!participantId) {
              commitErrors.push({ row_number: row.row_number, error_code: "PARTICIPANT_MISSING", error_message: "Participant não resolvido" });
              rowsFailed++; processed++; continue;
            }

            if (!pesSet.has(participantId)) {
              const { error: pesErr } = await serviceClient.from("participant_event_stages").insert({
                participant_id: participantId, event_stage_id: eventStageId, event_id: eventId,
                status: "active", created_by: operatorId,
              });
              if (pesErr) {
                if (pesErr.message?.includes("duplicate") || pesErr.message?.includes("unique")) pesReused++;
              } else {
                pesCreated++; pesSet.add(participantId as string);
              }
            } else {
              pesReused++;
            }

            if (row.participant_type === "athlete" && resolved.sport_event_id) {
              const pseKey = `${participantId}|${resolved.sport_event_id}|${eventStageId}`;
              if (pseSet.has(pseKey)) { pseReused++; rowsSkippedDuplicate++; }
              else {
                const { error: pseErr } = await serviceClient.from("participant_sport_events").insert({
                  participant_id: participantId, sport_event_id: resolved.sport_event_id,
                  event_stage_id: eventStageId, status: "confirmed",
                });
                if (pseErr) {
                  if (pseErr.message?.includes("duplicate") || pseErr.message?.includes("unique")) {
                    pseReused++; rowsSkippedDuplicate++;
                  } else {
                    commitErrors.push({ row_number: row.row_number, error_code: "PSE_FAILED", error_message: pseErr.message, payload: { full_name: row.full_name, institution_name: row.institution_name, sport_name: row.sport_name, prova_name: row.prova_name, category_name: row.category_name } });
                    rowsFailed++;
                  }
                } else {
                  pseCreated++; pseSet.add(pseKey);
                }
              }
            }
          } catch (rowErr) {
            commitErrors.push({ row_number: row.row_number, error_code: "UNEXPECTED", error_message: String(rowErr) });
            rowsFailed++;
          }

          processed++;
          if (importLogId && processed % progressEvery === 0) {
            await serviceClient.from("import_logs").update({
              result_summary: {
                progress: { processed, total },
                people_created: peopleCreated,
                participants_created: participantsCreated,
                participant_sport_events_created: pseCreated,
                rows_failed: rowsFailed,
              },
            }).eq("id", importLogId);
          }
        }

        // Build chunk-local result summary
        const chunkSummary = {
          people_created: peopleCreated, people_reused: peopleReused,
          participants_created: participantsCreated, participants_reused: participantsReused,
          participant_event_stages_created: pesCreated, participant_event_stages_reused: pesReused,
          participant_sport_events_created: pseCreated, participant_sport_events_reused: pseReused,
          institutions_created: newInstMap.size, delegations_created: delegationsCreated,
          pendencias_created: allPending.length, rows_skipped_as_duplicate: rowsSkippedDuplicate,
          rows_failed: rowsFailed,
        };

        if (importLogId) {
          if (isChunked) {
            const { data: cur } = await serviceClient.from("import_logs")
              .select("result_summary").eq("id", importLogId).maybeSingle();
            const prev = (cur?.result_summary as Record<string, number> | null) ?? {};
            const merged: Record<string, unknown> = {
              people_created: (Number(prev.people_created) || 0) + chunkSummary.people_created,
              people_reused: (Number(prev.people_reused) || 0) + chunkSummary.people_reused,
              participants_created: (Number(prev.participants_created) || 0) + chunkSummary.participants_created,
              participants_reused: (Number(prev.participants_reused) || 0) + chunkSummary.participants_reused,
              participant_event_stages_created: (Number(prev.participant_event_stages_created) || 0) + chunkSummary.participant_event_stages_created,
              participant_event_stages_reused: (Number(prev.participant_event_stages_reused) || 0) + chunkSummary.participant_event_stages_reused,
              participant_sport_events_created: (Number(prev.participant_sport_events_created) || 0) + chunkSummary.participant_sport_events_created,
              participant_sport_events_reused: (Number(prev.participant_sport_events_reused) || 0) + chunkSummary.participant_sport_events_reused,
              institutions_created: (Number(prev.institutions_created) || 0) + chunkSummary.institutions_created,
              delegations_created: (Number(prev.delegations_created) || 0) + chunkSummary.delegations_created,
              pendencias_created: (Number(prev.pendencias_created) || 0) + chunkSummary.pendencias_created,
              rows_skipped_as_duplicate: (Number(prev.rows_skipped_as_duplicate) || 0) + chunkSummary.rows_skipped_as_duplicate,
              rows_failed: (Number(prev.rows_failed) || 0) + chunkSummary.rows_failed,
            };
            const isLastChunk = (chunkIndex! + 1) >= chunkTotal!;
            const baseOffset = typeof rowOffset === "number" ? rowOffset : 0;
            (merged as any).progress = {
              processed: baseOffset + total,
              total: chunkTotal,
              chunk_index: chunkIndex,
              chunk_total: chunkTotal,
            };
            const totalFailed = Number(merged.rows_failed) || 0;
            const newStatus = isLastChunk ? (totalFailed > 0 ? "partial" : "success") : "processing";
            await serviceClient.from("import_logs").update({
              status: newStatus, result_summary: merged,
            }).eq("id", importLogId);
          } else {
            const finalStatus = rowsFailed > 0 ? (validRows.length - rowsFailed > 0 ? "partial" : "success") : "success";
            (chunkSummary as any).progress = { processed: total, total };
            await serviceClient.from("import_logs").update({
              status: finalStatus, result_summary: chunkSummary,
            }).eq("id", importLogId);
          }
        }

        if (commitErrors.length > 0) {
          const errBatch = commitErrors.map(e => ({
            event_id: eventId, import_log_id: importLogId,
            row_number: e.row_number, error_code: e.error_code,
            error_message: e.error_message, entity: "commit",
            payload: e.payload ?? null,
          }));
          for (let i = 0; i < errBatch.length; i += 200) {
            await serviceClient.from("import_row_errors").insert(errBatch.slice(i, i + 200));
          }
        }
      } catch (bgErr) {
        console.error("[background] processCommit failed:", bgErr);
        if (importLogId) {
          await serviceClient.from("import_logs").update({
            status: "error", error_message: String(bgErr),
          }).eq("id", importLogId);
        }
        throw bgErr;
      }
    };

    // Chunked mode: synchronous processing, return immediately for this chunk
    if (isChunked) {
      try {
        await processCommit();
      } catch (err) {
        return new Response(JSON.stringify({
          error: "Erro ao processar chunk", details: String(err),
          import_log_id: importLogId, chunk_index: chunkIndex,
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        status: "chunk_ok",
        import_log_id: importLogId,
        chunk_index: chunkIndex,
        chunk_total: chunkTotal,
        valid_rows: validRows.length,
        pendencias: allPending.length,
        is_last: (chunkIndex! + 1) >= chunkTotal!,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Non-chunked legacy path: background processing
    // @ts-ignore - EdgeRuntime existe no Supabase Edge Runtime
    EdgeRuntime.waitUntil(processCommit());

    return new Response(JSON.stringify({
      status: "processing",
      async: true,
      import_log_id: importLogId,
      operator_id: operatorId,
      event_id: eventId,
      event_stage_id: eventStageId,
      event_stage: { id: stageData.id, name: stageData.name, slug: stageData.slug },
      event: { id: eventData.id, name: eventData.name, year: eventData.year },
      file_name: fileName || null,
      timestamp: new Date().toISOString(),
      planned: {
        valid_rows: validRows.length,
        pendencias: allPending.length,
        institutions_to_create: institutionsToCreate.size,
        delegations_to_create: delegationsToCreate.size,
      },
      message: "Importação iniciada em background. Acompanhe o status do import_log.",
    }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("import-inscricoes error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// redeploy marker: 2026-04-16T20:35Z (event_stages support)

// redeploy marker: 2026-04-16T16:00Z
