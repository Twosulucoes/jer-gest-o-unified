// Motor inteligente de resolução SIGECOM → catálogo do evento.
//
// Entrada: textos brutos das colunas MODALIDADE / PROVA / COMPETIÇÃO + sexo + ano de nascimento.
// Saída: { sport_slug, prova_slug?, age_band?, gender, confidence, reasons }.
//
// Filosofia:
//   1. Tudo é resolvido por palavras-chave (não por slug exato).
//   2. Aceita variações de grafia, acento, pluralização e ordem.
//   3. Quando há ambiguidade, retorna candidatos para a UI escolher.
//   4. Coletivas: prova é sempre "Partida" (única no par sport+categoria).
//   5. Faixa etária: extraída do PROVA quando presente; senão derivada do nascimento.

// ─── Knowledge base embutido (espelho de src/regras/jer2026) ───────

export type Gender = "male" | "female" | "mixed";

interface ProvaDef {
  slug: string;
  /** Tokens que identificam a prova (em UPPER, sem acento). */
  keywords: string[][];     // OR de AND — ex.: [["KATA"], ["KUMITE","-50"]]
  /** Restrição de gênero, se a prova for específica. */
  gender?: Gender;
}

interface SportDef {
  slug: string;
  aliases: string[];        // tokens da MODALIDADE (UPPER, sem acento)
  /** Provas conhecidas. Vazio = coletiva ("partida" implícita). */
  provas: ProvaDef[];
  /** Se true, ausência de PROVA explícita resolve para a única prova do par. */
  collective: boolean;
}

const SPORTS: SportDef[] = [
  // ── Coletivas ──
  { slug: "basquete",        aliases: ["BASQUETE","BASQUETEBOL","BASKETBALL","BASKET"], provas: [], collective: true },
  { slug: "futsal",          aliases: ["FUTSAL","FUTEBOL DE SALAO"], provas: [], collective: true },
  { slug: "futebol",         aliases: ["FUTEBOL","FUTEBOL DE CAMPO","SOCCER","FOOTBALL"], provas: [], collective: true },
  { slug: "handebol",        aliases: ["HANDEBOL","HANDBALL"], provas: [], collective: true },
  { slug: "volei",           aliases: ["VOLEI","VOLEIBOL","VOLLEYBALL","VOLLEY"], provas: [], collective: true },
  { slug: "volei-de-praia",  aliases: ["VOLEI DE PRAIA","VOLEIBOL DE PRAIA","BEACH VOLLEY","VOLEI PRAIA"], provas: [], collective: true },

  // ── Combate ──
  {
    slug: "judo", aliases: ["JUDO"], collective: false,
    provas: [{ slug: "combate", keywords: [["JUDO"],["COMBATE"],["KG"]] }],
  },
  {
    slug: "karate", aliases: ["KARATE"], collective: false,
    provas: [
      { slug: "kata",   keywords: [["KATA"]] },
      { slug: "kumite", keywords: [["KUMITE"],["KUMITÊ"]] },
    ],
  },
  {
    slug: "taekwondo", aliases: ["TAEKWONDO","TAE KWON DO","TKD"], collective: false,
    provas: [
      { slug: "poomsae", keywords: [["POOMSAE"],["FORMA"]] },
      { slug: "kyorugi", keywords: [["KYORUGI"],["COMBATE"],["KG"],["LIGEIRO"],["LEVE"],["MEIO"],["MEDIO"],["PESADO"],["PESO"],["SUPERLIGEIRO"],["SUPER LIGEIRO"]] },
    ],
  },
  {
    slug: "wrestling", aliases: ["WRESTLING","LUTA OLIMPICA"], collective: false,
    provas: [
      { slug: "livre-fem",     keywords: [["ESTILO","LIVRE","FEMININO"],["LIVRE","FEMININO"]], gender: "female" },
      { slug: "livre-masc",    keywords: [["ESTILO","LIVRE","MASCULINO"],["LIVRE","MASCULINO"]], gender: "male" },
      { slug: "greco-romano",  keywords: [["GRECO"],["GRECO-ROMANO"],["GRECO ROMANO"]], gender: "male" },
    ],
  },

  // ── Técnicas / individuais ──
  {
    slug: "badminton", aliases: ["BADMINTON"], collective: false,
    provas: [
      { slug: "simples-masc",   keywords: [["SIMPLES","MASCULINO"]], gender: "male" },
      { slug: "simples-fem",    keywords: [["SIMPLES","FEMININO"]], gender: "female" },
      { slug: "duplas-masc",    keywords: [["DUPLAS","MASCULINO"],["DUPLA","MASCULINO"]], gender: "male" },
      { slug: "duplas-fem",     keywords: [["DUPLAS","FEMININO"],["DUPLA","FEMININO"]], gender: "female" },
      { slug: "duplas-mistas",  keywords: [["DUPLAS","MISTA"],["DUPLAS","MISTAS"],["DUPLA","MISTA"]], gender: "mixed" },
    ],
  },
  {
    slug: "tenis-de-mesa", aliases: ["TENIS DE MESA","TM","PINGUE-PONGUE","PINGUE PONGUE","TABLE TENNIS"], collective: false,
    provas: [
      { slug: "individual-masc", keywords: [["INDIVIDUAL","MASCULINO"]], gender: "male" },
      { slug: "individual-fem",  keywords: [["INDIVIDUAL","FEMININO"]], gender: "female" },
      { slug: "equipe-masc",     keywords: [["EQUIPE","MASCULINO"]], gender: "male" },
      { slug: "equipe-fem",      keywords: [["EQUIPE","FEMININO"]], gender: "female" },
    ],
  },
  {
    slug: "tiro-com-arco", aliases: ["TIRO COM ARCO","TIRO ARCO","ARCHERY"], collective: false,
    provas: [{ slug: "recurvo-individual", keywords: [["TIRO","ARCO"]] }],
  },
  {
    slug: "xadrez", aliases: ["XADREZ","CHESS"], collective: false,
    provas: [{ slug: "individual", keywords: [["XADREZ"]] }],
  },
  {
    slug: "ginastica-ritmica", aliases: ["GINASTICA RITMICA","GINASTICA RITIMICA","GR"], collective: false,
    provas: [
      { slug: "arco",    keywords: [["ARCO"]] },
      { slug: "macas",   keywords: [["MACAS"]] },
      { slug: "fita",    keywords: [["FITA"]] },
      { slug: "bola",    keywords: [["BOLA"]] },
      { slug: "corda",   keywords: [["CORDA"]] },
      { slug: "maos-livres", keywords: [["MAOS","LIVRES"]] },
    ],
  },

  // ── Tempo & marca ──
  {
    slug: "atletismo", aliases: ["ATLETISMO","ATHLETICS"], collective: false,
    provas: [
      { slug: "75m",  keywords: [["75","METROS"],["75M","RASOS"],["75M"]] },
      { slug: "80m",  keywords: [["80","METROS"],["80M"]] },
      { slug: "100m", keywords: [["100","METROS"],["100M","RASOS"],["100M"]] },
      { slug: "150m", keywords: [["150","METROS"],["150M"]] },
      { slug: "200m", keywords: [["200","METROS"],["200M"]] },
      { slug: "400m", keywords: [["400","METROS"],["400M"]] },
      { slug: "800m", keywords: [["800","METROS"],["800M"]] },
      { slug: "1500m", keywords: [["1500","METROS"],["1500M"]] },
      { slug: "2000m", keywords: [["2000","METROS"],["2000M"]] },
      { slug: "3000m", keywords: [["3000","METROS"],["3000M"]] },
      { slug: "5000m", keywords: [["5000","METROS"],["5000M"]] },
      { slug: "80m-barreiras",  keywords: [["80","BARREIRA"]] },
      { slug: "100m-barreiras", keywords: [["100","BARREIRA"]] },
      { slug: "110m-barreiras", keywords: [["110","BARREIRA"]] },
      { slug: "rev-4x75m",      keywords: [["REVEZAMENTO","4X75"],["4 X 75"]] },
      { slug: "rev-4x100m",     keywords: [["REVEZAMENTO","4X100"],["4 X 100"]] },
      { slug: "rev-misto-4x400",keywords: [["REVEZAMENTO","MISTO","4X400"],["MISTO","4 X 400"]] },
      { slug: "rev-5x80m",      keywords: [["REVEZAMENTO","5X80"],["5 X 80"]] },
      { slug: "marcha-3000m",   keywords: [["MARCHA","3000"]] },
      { slug: "marcha-5000m",   keywords: [["MARCHA","5000"]] },
      { slug: "salto-distancia",keywords: [["SALTO","DISTANCIA"]] },
      { slug: "salto-altura",   keywords: [["SALTO","ALTURA"]] },
      { slug: "salto-triplo",   keywords: [["SALTO","TRIPLO"]] },
      { slug: "arremesso-peso", keywords: [["ARREMESSO","PESO"],["ARREMESO","PESO"]] },
      { slug: "lancamento-disco",keywords: [["LANCAMENTO","DISCO"]] },
      { slug: "lancamento-dardo",keywords: [["LANCAMENTO","DARDO"]] },
      { slug: "pentatlo",       keywords: [["PENTATLO"]] },
      { slug: "hexatlo",        keywords: [["HEXATLO"]] },
    ],
  },
  {
    slug: "natacao", aliases: ["NATACAO","SWIMMING"], collective: false,
    provas: [
      { slug: "50-livre",      keywords: [["50","METROS","LIVRE"],["50M","LIVRE"]] },
      { slug: "100-livre",     keywords: [["100","METROS","LIVRE"],["100M","LIVRE"]] },
      { slug: "200-livre",     keywords: [["200","METROS","LIVRE"],["200M","LIVRE"]] },
      { slug: "400-livre",     keywords: [["400","METROS","LIVRE"],["400M","LIVRE"]] },
      { slug: "800-livre",     keywords: [["800","METROS","LIVRE"]] },
      { slug: "1500-livre",    keywords: [["1500","METROS","LIVRE"]] },
      { slug: "50-costas",     keywords: [["50","METROS","COSTAS"],["50","METROS","COSTA"]] },
      { slug: "100-costas",    keywords: [["100","METROS","COSTAS"],["100","METROS","COSTA"]] },
      { slug: "200-costas",    keywords: [["200","METROS","COSTAS"]] },
      { slug: "50-peito",      keywords: [["50","METROS","PEITO"]] },
      { slug: "100-peito",     keywords: [["100","METROS","PEITO"]] },
      { slug: "200-peito",     keywords: [["200","METROS","PEITO"]] },
      { slug: "50-borboleta",  keywords: [["50","METROS","BORBOLETA"],["BORBOLETA","50"]] },
      { slug: "100-borboleta", keywords: [["100","METROS","BORBOLETA"],["BORBOLETA","100"]] },
      { slug: "200-medley",    keywords: [["200","METROS","MEDLEY"]] },
      { slug: "400-medley",    keywords: [["400","METROS","MEDLEY"]] },
      { slug: "rev-4x50-medley-misto", keywords: [["4X50","METROS","MEDLEY"],["4X50","MEDLEY","MISTO"]] },
      { slug: "rev-4x50-livre",        keywords: [["4X50","LIVRE"]] },
      { slug: "rev-4x100-livre",       keywords: [["4X100","LIVRE"]] },
    ],
  },
  {
    slug: "ciclismo", aliases: ["CICLISMO","CYCLING"], collective: false,
    provas: [
      { slug: "estrada",        keywords: [["ESTRADA"]] },
      { slug: "contrarrelogio", keywords: [["CONTRARRELOGIO"],["CRONO"]] },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────

export function norm(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s\-+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAll(text: string, tokens: string[]): boolean {
  return tokens.every(t => text.includes(t));
}

export interface MatchResult {
  sport_slug: string | null;
  prova_slug: string | null;
  age_band: string | null;          // "12-14", "15-17", "11-12", "12-13", "14-15"
  gender: Gender | null;
  weight_class: string | null;       // "50KG", "+59KG", "-44KG"
  confidence: "high" | "medium" | "low";
  reasons: string[];
  /** Provas candidatas quando há ambiguidade (mais de 1 match). */
  prova_candidates: string[];
}

// ─── Resolução de modalidade (sport) ───────────────────────────────

export function resolveSport(modalidadeRaw: string, provaRaw: string, competicaoRaw: string): { slug: string | null; reason: string } {
  const m = norm(modalidadeRaw);
  const p = norm(provaRaw);
  const c = norm(competicaoRaw);
  // 1) Match direto pelos aliases na MODALIDADE
  for (const sp of SPORTS) {
    if (sp.aliases.some(a => m === a || m.includes(a))) {
      return { slug: sp.slug, reason: `match by MODALIDADE alias "${sp.aliases.find(a => m.includes(a))}"` };
    }
  }
  // 2) Tenta inferir pela COMPETIÇÃO ("BASQUETE BOA VISTA", "TÊNIS DE MESA BOA VISTA")
  for (const sp of SPORTS) {
    if (sp.aliases.some(a => c.includes(a))) {
      return { slug: sp.slug, reason: `inferred from COMPETICAO contains "${sp.aliases.find(a => c.includes(a))}"` };
    }
  }
  // 3) Tenta pela PROVA (KATA INDIVIDUAL → karate; CICLISMO 15 A 17 → ciclismo)
  for (const sp of SPORTS) {
    if (sp.aliases.some(a => p.includes(a))) {
      return { slug: sp.slug, reason: `inferred from PROVA contains "${sp.aliases.find(a => p.includes(a))}"` };
    }
    // Match por palavras de prova específicas
    for (const pv of sp.provas) {
      for (const tokens of pv.keywords) {
        if (matchesAll(p, tokens)) return { slug: sp.slug, reason: `inferred from PROVA keywords [${tokens.join(",")}] (prova ${pv.slug})` };
      }
    }
  }
  return { slug: null, reason: `não foi possível resolver modalidade. MODALIDADE="${modalidadeRaw}" PROVA="${provaRaw}" COMPETICAO="${competicaoRaw}"` };
}

// ─── Faixa etária ──────────────────────────────────────────────────

const AGE_PATTERNS: Array<{ re: RegExp; band: string }> = [
  { re: /\b12\s*A?\s*-?\s*14\b/, band: "12-14" },
  { re: /\b14\s*A?\s*-?\s*16\b/, band: "14-16" },
  { re: /\b15\s*A?\s*-?\s*17\b/, band: "15-17" },
  { re: /\b11\s*A?\s*-?\s*14\b/, band: "11-14" },
  { re: /\b12\s*A?\s*-?\s*13\b/, band: "12-13" },
  { re: /\b13\s*A?\s*-?\s*15\b/, band: "13-15" },
  { re: /\b14\s*A?\s*-?\s*15\b/, band: "14-15" },
  { re: /\b16\s*A?\s*-?\s*17\b/, band: "16-17" },
  { re: /\b11\s*A?\s*-?\s*12\b/, band: "11-12" },
  { re: /\b\s17\s+ANOS\b/,       band: "17" },
  { re: /\b\s5\s+A\s+17\b/,      band: "15-17" },  // erro de digitação comum: "5 A 17" → "15 A 17"
];

export function extractAgeBand(text: string): string | null {
  const t = norm(text);
  for (const { re, band } of AGE_PATTERNS) {
    if (re.test(t)) return band;
  }
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

// ─── Resolução de prova ────────────────────────────────────────────

export function resolveProva(sportSlug: string, provaRaw: string, gender: Gender | null): { slug: string | null; candidates: string[]; reason: string } {
  const sp = SPORTS.find(s => s.slug === sportSlug);
  if (!sp) return { slug: null, candidates: [], reason: `sport "${sportSlug}" desconhecido no matcher` };
  if (sp.collective) return { slug: "partida", candidates: ["partida"], reason: "coletiva: prova padrão 'partida'" };
  if (sp.provas.length === 0) return { slug: null, candidates: [], reason: "sem catálogo de provas" };

  const p = norm(provaRaw);
  const matched: string[] = [];
  for (const pv of sp.provas) {
    // Restrição de gênero quando aplicável
    if (pv.gender && gender && pv.gender !== gender) continue;
    for (const tokens of pv.keywords) {
      if (matchesAll(p, tokens)) {
        matched.push(pv.slug);
        break;
      }
    }
  }
  // dedup
  const uniq = [...new Set(matched)];
  if (uniq.length === 1) return { slug: uniq[0], candidates: uniq, reason: `match único` };
  if (uniq.length > 1) return { slug: null, candidates: uniq, reason: `ambíguo: ${uniq.length} provas casaram` };
  return { slug: null, candidates: [], reason: `nenhuma prova de "${sportSlug}" casou com "${provaRaw}"` };
}

// ─── Faixa etária via ano de nascimento (fallback) ─────────────────

export function ageBandFromBirthYear(eventYear: number, birthYear: number): string | null {
  const age = eventYear - birthYear;
  if (age >= 12 && age <= 14) return "12-14";
  if (age >= 15 && age <= 17) return "15-17";
  if (age >= 11 && age <= 14) return "11-14";
  return null;
}

// ─── Normalização da age_band para slug de categoria ───────────────

export function normalizeAgeBandToCategorySlug(sportSlug: string, ageBand: string, gender: Gender): string[] {
  // Retorna slugs candidatos no formato JER de categoria.
  // Ex.: ("futsal","15-17","male") → ["jers-15-17-male", "jers-15-17"]
  // Ex.: ("natacao","14-16","female") → ["nat-14-16-female","nat-14-16"]
  const g = gender === "female" ? "female" : gender === "male" ? "male" : null;
  const candidates: string[] = [];
  const push = (base: string) => {
    if (g) candidates.push(`${base}-${g}`);
    candidates.push(base);
  };
  // Modalidades com prefixos próprios (regulamento separa faixas)
  if (sportSlug === "natacao" || sportSlug === "judo" || sportSlug === "wrestling") {
    if (ageBand === "12-14") push("nat-judo-wrest-12-14");
    if (ageBand === "14-16") push("nat-judo-wrest-14-16");
    if (ageBand === "17")    push("nat-judo-wrest-17");
  }
  if (sportSlug === "tenis-de-mesa") {
    if (ageBand === "12-14") push("tm-12-14");
    if (ageBand === "14-15") push("tm-14-15");
    if (ageBand === "16-17") push("tm-16-17");
  }
  if (sportSlug === "ginastica-ritmica") {
    if (ageBand === "11-12" || ageBand === "12-13") push("gr-11-12");
    if (ageBand === "13-15" || ageBand === "14-15") push("gr-13-15");
  }
  // Padrão geral JER
  if (ageBand === "12-14") push("jers-12-14");
  if (ageBand === "15-17" || ageBand === "17" || ageBand === "16-17") push("jers-15-17");
  // Paralímpicas
  if (ageBand === "11-14") push("jerpa-11-14");
  return candidates;
}

// ─── Função principal exposta ──────────────────────────────────────

export function smartMatch(input: {
  modalidadeRaw: string;
  provaRaw: string;
  competicaoRaw: string;
  sexoColumn?: string;
  birthYear?: number | null;
  eventYear?: number | null;
}): MatchResult {
  const reasons: string[] = [];
  const sport = resolveSport(input.modalidadeRaw, input.provaRaw, input.competicaoRaw);
  reasons.push(`sport: ${sport.reason}`);
  if (!sport.slug) {
    return { sport_slug: null, prova_slug: null, age_band: null, gender: null, weight_class: null, confidence: "low", reasons, prova_candidates: [] };
  }
  // Texto onde buscamos faixa etária / gênero
  const allText = `${input.provaRaw} ${input.competicaoRaw} ${input.modalidadeRaw}`;
  let ageBand = extractAgeBand(allText);
  if (!ageBand && input.birthYear && input.eventYear) {
    ageBand = ageBandFromBirthYear(input.eventYear, input.birthYear);
    if (ageBand) reasons.push(`age_band derivada do nascimento ${input.birthYear} → ${ageBand}`);
  }
  if (ageBand) reasons.push(`age_band: ${ageBand}`);

  const gender = extractGender(allText, input.sexoColumn);
  if (gender) reasons.push(`gender: ${gender}`);

  const prova = resolveProva(sport.slug, input.provaRaw, gender);
  reasons.push(`prova: ${prova.reason}`);

  const weight = extractWeightClass(allText);
  if (weight) reasons.push(`weight_class: ${weight}`);

  let confidence: "high" | "medium" | "low" = "low";
  if (sport.slug && prova.slug && ageBand && gender) confidence = "high";
  else if (sport.slug && (prova.slug || ageBand)) confidence = "medium";

  return {
    sport_slug: sport.slug,
    prova_slug: prova.slug,
    age_band: ageBand,
    gender,
    weight_class: weight,
    confidence,
    reasons,
    prova_candidates: prova.candidates,
  };
}
