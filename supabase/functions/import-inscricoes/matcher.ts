// Motor inteligente de resolução SIGECOM → catálogo do evento.
//
// ESTRATÉGIA: scoring por tokens contra o catálogo REAL carregado do banco.
//
// Em vez de manter listas hardcoded de keywords (que sempre ficam incompletas),
// o matcher recebe a lista de provas candidatas (sport_events do par sport+categoria)
// e calcula um score de similaridade entre o texto bruto e o NOME/slug de cada prova.
//
// Regras:
//   1. Tokeniza o texto bruto e o nome de cada candidata (normaliza acentos, plurais).
//   2. Pesa tokens numéricos com word boundary forte (75 ≠ 750).
//   3. Aplica sinônimos comuns (RASOS↔'', BORBOLETA↔FLY, EQUIPE↔TEAM, etc.).
//   4. Retorna a candidata com maior score; se houver empate ou score baixo, devolve null.

export type Gender = "male" | "female" | "mixed";

// ─── Normalização ──────────────────────────────────────────────────

export function norm(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s\-+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Sinônimos: chave canônica → variantes que devem ser tratadas como equivalentes.
// Aplicado em ambos os lados (texto bruto E nome da candidata) antes de tokenizar.
const SYNONYM_GROUPS: string[][] = [
  ["RASOS", "RASO", "METROS", "METRO"],          // "100 METROS" ≡ "100M RASOS"
  ["REVEZAMENTO", "REV", "RELAY"],
  ["MASCULINO", "MASC", "MALE", "M"],
  ["FEMININO", "FEM", "FEMININA", "FEMALE", "F"],
  ["MISTO", "MISTA", "MISTAS", "MISTOS", "MIXED"],
  ["INDIVIDUAL", "IND", "SOLO"],
  ["EQUIPE", "EQUIPES", "TEAM", "EQUIPO"],
  ["DUPLAS", "DUPLA", "DOUBLES"],
  ["SIMPLES", "SINGLES", "SINGLE"],
  ["COMBATE", "FIGHT", "LUTA"],
  ["FORMA", "FORMS"],
  ["ARREMESSO", "ARREMESO", "PUT"],              // erro comum SIGECOM
  ["LANCAMENTO", "LANC"],
  ["DISTANCIA", "DISTANCE", "LONG"],
  ["ALTURA", "HIGH"],
  ["TRIPLO", "TRIPLE"],
  ["BARREIRAS", "BARREIRA", "HURDLES"],
  ["MARCHA", "WALK"],
  ["CONTRARRELOGIO", "CRONO", "CONTRA-RELOGIO", "CONTRA"],
  ["ESTRADA", "ROAD"],
  ["MAOS", "MAO"],
  ["LIVRES", "LIVRE", "FREE", "FREESTYLE"],
  ["BORBOLETA", "BUTTERFLY", "FLY"],
  ["COSTAS", "COSTA", "BACK"],
  ["PEITO", "BREAST"],
  ["MEDLEY", "MEDLEI"],
  ["RECURVO", "RECURVE"],
  ["GRECO-ROMANO", "GRECO", "GRECOROMANO"],
  ["ESTILO", "STYLE"],
  ["KUMITE", "KUMITÊ"],
  ["PARTIDA", "JOGO", "MATCH", "GAME"],
  ["AGUAS", "ABERTAS", "OPEN"],
  ["PROVA", "PROVAS"],
  ["UNICA", "UNICO", "UNIQUE"],
  ["DARDO", "JAVELIN"],
  ["DISCO", "DISCUS"],
  ["PESO", "SHOT"],
  ["HEXATLO", "HEPTATLO", "PENTATLO", "MULTIPROVAS"],
  ["KYORUGI", "GYEORUGI"],
  ["POOMSAE", "PUMSE"],
  ["KATA", "FORMA"],
  ["RITMICA", "RITIMICA"],
  ["ARTISTICA", "ARTISTIC"],
];

// Stopwords descartadas em ambos os lados (não contribuem para o score).
const STOPWORDS = new Set([
  "DE", "DA", "DO", "DAS", "DOS", "EM", "E", "A", "O", "AS", "OS",
  "JERS", "JERPA", "JER", "ANO", "ANOS", "CAT", "CATEGORIA",
  "MODALIDADE", "PROVA", "COMPETICAO", "—", "-",
]);

function applySynonyms(text: string): string {
  let t = text;
  for (const group of SYNONYM_GROUPS) {
    const canonical = group[0];
    for (let i = 1; i < group.length; i++) {
      // Substitui palavra inteira pelo canônico
      const re = new RegExp(`(^|\\s)${group[i].replace(/[+\-]/g, "\\$&")}(\\s|$)`, "g");
      t = t.replace(re, `$1${canonical}$2`);
    }
  }
  return t;
}

function tokenize(text: string): string[] {
  // Normaliza distâncias: "75M" → "75", "4X100M" → "4X100"
  const cleaned = applySynonyms(norm(text))
    .replace(/(\d+)\s*M\b/g, "$1")            // "75M" → "75"
    .replace(/(\d+)\s+METROS?\b/g, "$1")      // "75 METROS" → "75"
    .replace(/-/g, " ");                       // "4-x-100" → "4 x 100"
  return cleaned.split(/\s+/).filter(t => t && !STOPWORDS.has(t));
}

// ─── Catálogo dinâmico ─────────────────────────────────────────────

export interface CatalogEvent {
  id: string;
  slug: string;       // sport_event slug (já com categoria)
  name: string;       // "Atletismo — 800m rasos — Masculino"
  prova_label?: string; // texto da parte central do nome (sem sport e sem gênero)
}

/**
 * Score de match entre tokens do texto bruto e tokens do nome da prova.
 * - Tokens numéricos exigem match EXATO (75 ≠ 750, 80 ≠ 800).
 * - Tokens textuais valem 1 ponto cada quando presentes em ambos.
 * - Tokens numéricos valem 3 pontos (são mais discriminativos).
 */
function scoreMatch(rawTokens: string[], candTokens: string[]): number {
  const candSet = new Set(candTokens);
  let score = 0;
  let matched = 0;
  for (const t of rawTokens) {
    if (candSet.has(t)) {
      const isNum = /^\d/.test(t);
      score += isNum ? 3 : 1;
      matched++;
    }
  }
  // Penaliza se a candidata tem tokens numéricos que NÃO estão no texto bruto
  // (evita "800m" casar com "80 METROS" só por overlap de "800"≈"80").
  for (const t of candTokens) {
    if (/^\d/.test(t) && !rawTokens.includes(t)) {
      score -= 2;
    }
  }
  return score;
}

/** Extrai a parte central do nome ("Atletismo — 800m rasos — Masculino" → "800m rasos"). */
export function extractProvaLabel(fullName: string): string {
  const parts = fullName.split(/—|–|-{2,}/);
  if (parts.length >= 2) {
    // Remove sufixo de gênero
    const middle = parts.slice(1, parts.length > 2 ? -1 : parts.length).join(" ");
    return middle.trim();
  }
  return fullName;
}

export interface MatchResult {
  event_id: string | null;
  event_slug: string | null;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  candidates: Array<{ id: string; slug: string; score: number }>;
}

/**
 * Resolve qual sport_event do catálogo melhor casa com o texto bruto.
 *
 * @param rawText  Texto bruto (PROVA + MODALIDADE + COMPETICAO concatenados)
 * @param catalog  Lista de provas candidatas (já filtrada por sport+categoria)
 */
export function matchEventInCatalog(rawText: string, catalog: CatalogEvent[]): MatchResult {
  const reasons: string[] = [];
  if (catalog.length === 0) {
    return { event_id: null, event_slug: null, score: 0, confidence: "low", reasons: ["catálogo vazio"], candidates: [] };
  }
  if (catalog.length === 1) {
    return {
      event_id: catalog[0].id,
      event_slug: catalog[0].slug,
      score: 999,
      confidence: "high",
      reasons: ["única prova no catálogo"],
      candidates: [{ id: catalog[0].id, slug: catalog[0].slug, score: 999 }],
    };
  }

  const rawTokens = tokenize(rawText);
  reasons.push(`tokens raw: [${rawTokens.join(", ")}]`);

  const scored = catalog.map(c => {
    const label = c.prova_label ?? extractProvaLabel(c.name);
    // Inclui também o slug (sem prefixo do sport) para captar tokens que só aparecem lá
    const slugTokens = tokenize(c.slug.replace(/^[a-z-]+?-/, "").replace(/-(jers|nat|tm|gr|jerpa)-.*$/, ""));
    const labelTokens = tokenize(label);
    const candTokens = [...new Set([...labelTokens, ...slugTokens])];
    const score = scoreMatch(rawTokens, candTokens);
    return { id: c.id, slug: c.slug, score, candTokens };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];

  // Confiança:
  //   high   = score >= 3 e diferença ≥ 2 sobre o segundo
  //   medium = score >= 2 e ganha do segundo
  //   low    = empatado ou score baixo → null
  let confidence: "high" | "medium" | "low" = "low";
  if (top.score >= 3 && top.score - second.score >= 2) confidence = "high";
  else if (top.score >= 2 && top.score > second.score) confidence = "medium";

  reasons.push(`top: ${top.slug} (score=${top.score}) vs ${second.slug} (score=${second.score})`);

  if (confidence === "low") {
    return {
      event_id: null, event_slug: null, score: top.score, confidence, reasons,
      candidates: scored.slice(0, 5).map(s => ({ id: s.id, slug: s.slug, score: s.score })),
    };
  }
  return {
    event_id: top.id, event_slug: top.slug, score: top.score, confidence, reasons,
    candidates: scored.slice(0, 5).map(s => ({ id: s.id, slug: s.slug, score: s.score })),
  };
}

// ─── Resolução de modalidade (sport) ───────────────────────────────

interface SportAlias { sport: string; alias: string; }

const SPORT_ALIASES: SportAlias[] = [
  // Coletivas
  ...["BASQUETE","BASQUETEBOL","BASKETBALL","BASKET"].map(a=>({sport:"basquete",alias:a})),
  ...["FUTSAL","FUTEBOL DE SALAO","FUTSAL FEMININO","FUTSAL MASCULINO"].map(a=>({sport:"futsal",alias:a})),
  ...["FUTEBOL","FUTEBOL DE CAMPO","SOCCER","FOOTBALL"].map(a=>({sport:"futebol",alias:a})),
  ...["HANDEBOL","HANDBALL"].map(a=>({sport:"handebol",alias:a})),
  ...["VOLEI","VOLEIBOL","VOLLEYBALL","VOLLEY"].map(a=>({sport:"volei",alias:a})),
  ...["VOLEI DE PRAIA","VOLEIBOL DE PRAIA","BEACH VOLLEY","VOLEI PRAIA"].map(a=>({sport:"volei-de-praia",alias:a})),
  // Combate
  ...["JUDO"].map(a=>({sport:"judo",alias:a})),
  ...["KARATE","KARATÊ"].map(a=>({sport:"karate",alias:a})),
  ...["TAEKWONDO","TAE KWON DO","TKD"].map(a=>({sport:"taekwondo",alias:a})),
  ...["WRESTLING","LUTA OLIMPICA","LUTA"].map(a=>({sport:"wrestling",alias:a})),
  // Técnicas/individuais
  ...["BADMINTON"].map(a=>({sport:"badminton",alias:a})),
  ...["PARABADMINTON","PARA BADMINTON","BADMINTON PARALIMPICO"].map(a=>({sport:"parabadminton",alias:a})),
  ...["TENIS DE MESA","TM","PINGUE-PONGUE","PINGUE PONGUE","TABLE TENNIS"].map(a=>({sport:"tenis-de-mesa",alias:a})),
  ...["TENIS DE MESA PARALIMPICO","TM PARALIMPICO","PARA TENIS DE MESA"].map(a=>({sport:"tenis-de-mesa-paralimpico",alias:a})),
  ...["TIRO COM ARCO","TIRO ARCO","ARCHERY"].map(a=>({sport:"tiro-com-arco",alias:a})),
  ...["XADREZ","CHESS"].map(a=>({sport:"xadrez",alias:a})),
  ...["GINASTICA RITMICA","GINASTICA RITIMICA","GR","RHYTHMIC"].map(a=>({sport:"ginastica-ritmica",alias:a})),
  // Tempo & marca
  ...["ATLETISMO","ATHLETICS"].map(a=>({sport:"atletismo",alias:a})),
  ...["ATLETISMO PARALIMPICO","ATLETISMO PARA","PARA ATLETISMO"].map(a=>({sport:"atletismo-paralimpico",alias:a})),
  ...["NATACAO","SWIMMING"].map(a=>({sport:"natacao",alias:a})),
  ...["NATACAO PARALIMPICA","PARA NATACAO"].map(a=>({sport:"natacao-paralimpica",alias:a})),
  ...["AGUAS ABERTAS","OPEN WATER","MARATONA AQUATICA"].map(a=>({sport:"aguas-abertas",alias:a})),
  ...["CICLISMO","CYCLING","BIKE"].map(a=>({sport:"ciclismo",alias:a})),
  // Paralímpicas
  ...["BOCHA","BOCHA PARALIMPICA","BOCCIA"].map(a=>({sport:"bocha-paralimpica",alias:a})),
];

export function resolveSport(modalidadeRaw: string, provaRaw: string, competicaoRaw: string): { slug: string | null; reason: string } {
  const m = norm(modalidadeRaw);
  const p = norm(provaRaw);
  const c = norm(competicaoRaw);
  // Detecta paralímpico no competição/prova
  const isPara = /PARALIMPIC|PARA[\s-]/.test(`${m} ${p} ${c}`);

  // Ordena aliases por tamanho desc para evitar que "VOLEI" case antes de "VOLEI DE PRAIA"
  const sorted = [...SPORT_ALIASES].sort((a, b) => b.alias.length - a.alias.length);

  const matchToken = (text: string, alias: string): boolean => {
    if (alias.length <= 3) {
      const re = new RegExp(`(^|\\s)${alias.replace(/[+\-]/g, "\\$&")}(\\s|$)`);
      return re.test(text);
    }
    return text.includes(alias);
  };

  for (const text of [m, c, p]) {
    for (const { sport, alias } of sorted) {
      if (matchToken(text, alias)) {
        // Se detectou paralímpico mas o sport casado é a versão olímpica, tenta a paralímpica
        if (isPara && !sport.includes("paralimpic")) {
          const paraVersion = sorted.find(s => s.sport === `${sport}-paralimpico`);
          if (paraVersion) return { slug: paraVersion.sport, reason: `paralímpico detectado, alias "${alias}" + "PARA"` };
        }
        return { slug: sport, reason: `alias "${alias}"` };
      }
    }
  }
  return { slug: null, reason: `não foi possível resolver. MOD="${modalidadeRaw}" PROVA="${provaRaw}" COMP="${competicaoRaw}"` };
}

// ─── Faixa etária ──────────────────────────────────────────────────

const AGE_PATTERNS: Array<{ re: RegExp; band: string }> = [
  { re: /\b12\s*A?\s*-?\s*14\b/, band: "12-14" },
  { re: /\b14\s*A?\s*-?\s*16\b/, band: "14-16" },
  { re: /\b15\s*A?\s*-?\s*17\b/, band: "15-17" },
  { re: /\b15\s*A?\s*-?\s*16\b/, band: "15-16" },
  { re: /\b11\s*A?\s*-?\s*14\b/, band: "11-14" },
  { re: /\b12\s*A?\s*-?\s*13\b/, band: "12-13" },
  { re: /\b13\s*A?\s*-?\s*15\b/, band: "13-15" },
  { re: /\b14\s*A?\s*-?\s*15\b/, band: "14-15" },
  { re: /\b16\s*A?\s*-?\s*17\b/, band: "16-17" },
  { re: /\b11\s*A?\s*-?\s*12\b/, band: "11-12" },
  { re: /\b\s17\s+ANOS\b/,       band: "17" },
  { re: /\b\s5\s+A\s+17\b/,      band: "15-17" },
];

export function extractAgeBand(text: string): string | null {
  const t = norm(text);
  for (const { re, band } of AGE_PATTERNS) if (re.test(t)) return band;
  return null;
}

export function ageBandFromBirthYear(eventYear: number, birthYear: number): string | null {
  const age = eventYear - birthYear;
  if (age >= 12 && age <= 14) return "12-14";
  if (age >= 15 && age <= 17) return "15-17";
  if (age >= 11 && age <= 14) return "11-14";
  return null;
}

// ─── Gênero ────────────────────────────────────────────────────────

export function extractGender(text: string, sexoColumn?: string): Gender | null {
  const t = norm(text);
  if (/\bMISTO\b|\bMISTA\b|\bMISTAS\b|\bMISTOS\b/.test(t)) return "mixed";
  if (/\bFEMININO\b|\bFEMININA\b|\bFEM\b/.test(t)) return "female";
  if (/\bMASCULINO\b|\bMASCULINA\b|\bMASC\b|\bMASCULIN\b/.test(t)) return "male";
  if (sexoColumn) {
    const sx = norm(sexoColumn);
    if (sx.startsWith("F")) return "female";
    if (sx.startsWith("M")) return "male";
  }
  return null;
}

// ─── Categoria de peso (combate) ───────────────────────────────────

const WEIGHT_RE = /([+\-]?\d{2,3})\s*KG|ATE\s+(\d{2,3})\s*KG|ACIMA\s+DE\s+(\d{2,3})\s*KG/;
export function extractWeightClass(text: string): string | null {
  const t = norm(text);
  const m = t.match(WEIGHT_RE);
  if (!m) return null;
  if (m[1]) return `${m[1]}KG`;
  if (m[2]) return `-${m[2]}KG`;
  if (m[3]) return `+${m[3]}KG`;
  return null;
}

// ─── Categoria → slug candidatos ───────────────────────────────────

export function normalizeAgeBandToCategorySlug(sportSlug: string, ageBand: string, gender: Gender): string[] {
  const g = gender === "female" ? "female" : gender === "male" ? "male" : null;
  const candidates: string[] = [];
  const push = (base: string) => {
    if (g) candidates.push(`${base}-${g}`);
    candidates.push(base);
  };
  // Natação / Judô / Wrestling têm faixas próprias
  if (sportSlug === "natacao" || sportSlug === "natacao-paralimpica") {
    if (ageBand === "12-14") push("nat-12-14");
    if (ageBand === "14-16" || ageBand === "15-16") push("nat-14-16");
    if (ageBand === "17" || ageBand === "16-17" || ageBand === "15-17") push("nat-17");
  }
  if (sportSlug === "judo") {
    if (ageBand === "12-14") push("judo-12-14");
    if (ageBand === "14-16" || ageBand === "15-16" || ageBand === "15-17") push("judo-15-16");
  }
  if (sportSlug === "wrestling") {
    if (ageBand === "12-14") push("wrestling-12-14");
    if (ageBand === "14-16" || ageBand === "15-16" || ageBand === "15-17") push("wrestling-14-16");
  }
  if (sportSlug === "tenis-de-mesa") {
    if (ageBand === "12-14") push("tm-12-14");
    if (ageBand === "14-15") push("tm-14-15");
    if (ageBand === "16-17" || ageBand === "15-17") push("tm-16-17");
  }
  if (sportSlug === "ginastica-ritmica") {
    if (ageBand === "11-12" || ageBand === "12-13") push("gr-11-12");
    if (ageBand === "13-15" || ageBand === "14-15") push("gr-13-15");
  }
  // Padrão geral JER
  if (ageBand === "12-14") push("jers-12-14");
  if (ageBand === "15-17" || ageBand === "17" || ageBand === "16-17") push("jers-15-17");
  if (ageBand === "11-14") push("jerpa-11-14");
  return candidates;
}

// ─── Função principal exposta (compatibilidade com código existente) ───

export interface SmartMatchInput {
  modalidadeRaw: string;
  provaRaw: string;
  competicaoRaw: string;
  sexoColumn?: string;
  birthYear?: number | null;
  eventYear?: number | null;
}

export interface SmartMatchOutput {
  sport_slug: string | null;
  age_band: string | null;
  gender: Gender | null;
  weight_class: string | null;
  reasons: string[];
}

/**
 * Resolve sport, age_band, gender e weight_class a partir do texto bruto.
 * A resolução da PROVA específica é delegada ao `matchEventInCatalog` que
 * recebe a lista real de candidatas do banco.
 */
export function smartMatch(input: SmartMatchInput): SmartMatchOutput & {
  // legados para não quebrar callsites existentes
  prova_slug: string | null;
  confidence: "high" | "medium" | "low";
  prova_candidates: string[];
} {
  const reasons: string[] = [];
  const sport = resolveSport(input.modalidadeRaw, input.provaRaw, input.competicaoRaw);
  reasons.push(`sport: ${sport.reason}`);

  const allText = `${input.provaRaw} ${input.competicaoRaw} ${input.modalidadeRaw}`;
  let ageBand = extractAgeBand(allText);
  if (!ageBand && input.birthYear && input.eventYear) {
    ageBand = ageBandFromBirthYear(input.eventYear, input.birthYear);
    if (ageBand) reasons.push(`age_band derivada do nascimento ${input.birthYear} → ${ageBand}`);
  }
  if (ageBand) reasons.push(`age_band: ${ageBand}`);

  const gender = extractGender(allText, input.sexoColumn);
  if (gender) reasons.push(`gender: ${gender}`);

  const weight = extractWeightClass(allText);
  if (weight) reasons.push(`weight_class: ${weight}`);

  return {
    sport_slug: sport.slug,
    age_band: ageBand,
    gender,
    weight_class: weight,
    reasons,
    prova_slug: null,         // resolvido pelo catálogo no index.ts
    confidence: "low",
    prova_candidates: [],
  };
}
