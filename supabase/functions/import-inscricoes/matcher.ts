// Motor inteligente de resolução SIGECOM → catálogo do evento.
//
// Estratégia v3 (definitiva): regras DETERMINÍSTICAS por palavra-chave de
// disciplina + extração de NÚMERO (distância/peso) + filtro de gênero embutido.
// O scoring genérico vira fallback quando nenhuma regra determinística decide.

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

const SYNONYM_GROUPS: string[][] = [
  ["REVEZAMENTO", "REV", "RELAY"],
  ["MASCULINO", "MASC", "MALE"],
  ["FEMININO", "FEM", "FEMININA", "FEMALE"],
  ["MISTO", "MISTA", "MISTAS", "MISTOS", "MIXED"],
  ["INDIVIDUAL", "IND", "SOLO"],
  ["EQUIPE", "EQUIPES", "TEAM", "EQUIPO"],
  ["DUPLAS", "DUPLA", "DOUBLES"],
  ["SIMPLES", "SINGLES", "SINGLE"],
  ["ARREMESSO", "ARREMESO", "PUT"],
  ["LANCAMENTO", "LANC"],
  ["DISTANCIA", "DISTANCE", "LONG"],
  ["ALTURA", "HIGH"],
  ["TRIPLO", "TRIPLE"],
  ["BARREIRAS", "BARREIRA", "HURDLES"],
  ["MARCHA", "WALK"],
  ["CONTRARRELOGIO", "CRONO", "CONTRA-RELOGIO", "CONTRARELOGIO", "CRONOMETRO"],
  ["ESTRADA", "ROAD"],
  ["LIVRES", "LIVRE", "FREE", "FREESTYLE"],
  ["BORBOLETA", "BUTTERFLY", "FLY"],
  ["COSTAS", "COSTA", "BACK"],
  ["PEITO", "BREAST"],
  ["MEDLEY", "MEDLEI"],
  ["RECURVO", "RECURVE"],
  ["GRECO-ROMANO", "GRECO", "GRECOROMANO", "GRECOROMANA", "GRECO-ROMANA"],
  ["AGUAS", "ABERTAS", "OPEN"],
  ["DARDO", "JAVELIN"],
  ["DISCO", "DISCUS"],
  ["PESO", "SHOT"],
  ["RITMICA", "RITIMICA"],
];

const STOPWORDS = new Set([
  "DE", "DA", "DO", "DAS", "DOS", "EM", "E", "A", "O", "AS", "OS",
  "ANO", "ANOS", "CAT", "CATEGORIA", "MODALIDADE", "PROVA", "PROVAS",
  "COMPETICAO", "RASOS", "RASO", "METROS", "METRO",
  "GRAMAS", "GRAMA", "GR", "KG", "G",
  "BOA", "VISTA", "BONFIM", "CARACARAI", "MUCAJAI", "CANTA", "PACARAIMA",
  "ALTO", "ALEGRE", "URAICOERA", "AMAJARI", "RORAINOPOLIS", "IRACEMA",
  "FINAL", "CLASSIFICATORIA", "ETAPA", "REGIONAL", "ESTADUAL",
  "JERS", "JERPA", "JER", "ATE", "ATÉ", "ACIMA", "SUPER", "MEDIO",
  "LEVE", "PESADO", "MEIO", "—", "-", "INDIVIDUAL", "EQUIPE",
]);

function applySynonyms(text: string): string {
  let t = text;
  for (const group of SYNONYM_GROUPS) {
    const canonical = group[0];
    for (let i = 1; i < group.length; i++) {
      const re = new RegExp(`(^|\\s)${group[i].replace(/[+\-]/g, "\\$&")}(\\s|$)`, "g");
      t = t.replace(re, `$1${canonical}$2`);
    }
  }
  return t;
}

function tokenize(text: string): string[] {
  const cleaned = applySynonyms(norm(text))
    .replace(/(\d+)\s*M\b/g, "$1")
    .replace(/(\d+)\s+METROS?\b/g, "$1")
    .replace(/(\d+)\s*KG\b/g, "$1KG")
    .replace(/-/g, " ");
  return cleaned.split(/\s+/).filter(t => t && !STOPWORDS.has(t));
}

// ─── Catálogo dinâmico ─────────────────────────────────────────────

export interface CatalogEvent {
  id: string;
  slug: string;
  name: string;
  prova_label?: string;
}

export interface MatchResult {
  event_id: string | null;
  event_slug: string | null;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  candidates: Array<{ id: string; slug: string; score: number }>;
}

// ─── Regras DETERMINÍSTICAS por modalidade ─────────────────────────

/**
 * Cada regra recebe o texto bruto normalizado e o catálogo (já filtrado por gênero).
 * Retorna o slug escolhido OU null se a regra não se aplica.
 */
type DeterministicRule = (rawNorm: string, catalog: CatalogEvent[]) => CatalogEvent | null;

const findInCatalog = (catalog: CatalogEvent[], predicate: (slug: string) => boolean): CatalogEvent | null =>
  catalog.find(c => predicate(c.slug.toLowerCase())) ?? null;

const RULES: DeterministicRule[] = [
  // ── KARATÊ: KATA vs KUMITE ───────────────────────────────────────
  (raw, cat) => {
    if (!cat.some(c => /karate/.test(c.slug))) return null;
    if (/\bKATA\b/.test(raw)) return findInCatalog(cat, s => /karate.*kata/.test(s));
    if (/\bKUMITE\b/.test(raw)) return findInCatalog(cat, s => /karate.*kumite/.test(s));
    // Indicador de peso → KUMITE (combate)
    if (/[+\-]?\d{2,3}\s*KG|ATE\s+\d{2,3}/.test(raw)) return findInCatalog(cat, s => /karate.*kumite/.test(s));
    return null;
  },

  // ── TAEKWONDO: KYORUGI/COMBATE vs POOMSAE/FORMA ──────────────────
  (raw, cat) => {
    if (!cat.some(c => /taekwondo/.test(c.slug))) return null;
    if (/\bPOOMSAE\b|\bPUMSE\b|\bFORMA\b/.test(raw)) return findInCatalog(cat, s => /taekwondo.*(poomsae|forma|pumse)/.test(s));
    if (/\bKYORUGI\b|\bGYEORUGI\b|\bCOMBATE\b/.test(raw)) return findInCatalog(cat, s => /taekwondo.*(kyorugi|combate|gyeorugi)/.test(s));
    // Indicador de peso → KYORUGI (combate)
    if (/[+\-]?\d{2,3}\s*KG|ATE\s+\d{2,3}/.test(raw)) return findInCatalog(cat, s => /taekwondo.*(kyorugi|combate)/.test(s));
    return null;
  },

  // ── WRESTLING: livre-masc / livre-fem / greco-romano ─────────────
  (raw, cat) => {
    if (!cat.some(c => /wrestling/.test(c.slug))) return null;
    const isFem = /\bFEMININO\b|\bFEMININA\b|\bFEM\b/.test(raw);
    const isMasc = /\bMASCULINO\b|\bMASCULINA\b|\bMASC\b/.test(raw);
    if (/GRECO/.test(raw)) return findInCatalog(cat, s => /greco/.test(s));
    // Sem GRECO: estilo livre
    if (isFem) return findInCatalog(cat, s => /wrestling-livre-fem/.test(s)) ?? findInCatalog(cat, s => /wrestling.*livre/.test(s));
    if (isMasc) return findInCatalog(cat, s => /wrestling-livre-masc/.test(s)) ?? findInCatalog(cat, s => /wrestling.*livre/.test(s));
    return null;
  },

  // ── JUDÔ: peso → única prova "judo" da categoria (sem subdivisão por estilo) ─
  // (Catálogo de judô normalmente tem só 1 prova por categoria.)
  (_raw, cat) => {
    if (!cat.some(c => /^judo/.test(c.slug))) return null;
    if (cat.length === 1) return cat[0];
    return null;
  },

  // ── CICLISMO: ESTRADA vs CONTRARRELÓGIO ──────────────────────────
  (raw, cat) => {
    if (!cat.some(c => /ciclismo/.test(c.slug))) return null;
    if (/CONTRARRELOGIO|CRONO/.test(raw)) return findInCatalog(cat, s => /contrarrelogio|crono/.test(s));
    if (/ESTRADA|ROAD/.test(raw)) return findInCatalog(cat, s => /estrada/.test(s));
    // Texto vago "CICLISMO 15 A 17 FEMININO" → assume ESTRADA (prova base mais comum)
    if (/^CICLISMO/.test(raw.trim()) && !/CONTRA|CRONO/.test(raw)) {
      return findInCatalog(cat, s => /estrada/.test(s));
    }
    return null;
  },

  // ── ATLETISMO: distância numérica + tipo de prova ───────────────
  (raw, cat) => {
    if (!cat.some(c => /atletismo/.test(c.slug))) return null;

    // 1) Lançamentos / arremessos (DARDO, DISCO, PESO, MARTELO)
    if (/\bDARDO\b|JAVELIN/.test(raw)) {
      return findInCatalog(cat, s => /dardo|javelin/.test(s))
        ?? findInCatalog(cat, s => /lancamento/.test(s))   // fallback p/ "lançamento" genérico
        ?? findInCatalog(cat, s => /arremesso/.test(s));
    }
    if (/\bDISCO\b/.test(raw)) return findInCatalog(cat, s => /disco/.test(s));
    if (/\bPESO\b|\bSHOT\b/.test(raw)) return findInCatalog(cat, s => /peso|arremesso-peso/.test(s));
    if (/\bMARTELO\b/.test(raw)) return findInCatalog(cat, s => /martelo/.test(s));

    // 2) Saltos
    if (/\bSALTO\b.*\bDISTANCIA\b|SALTO\s+EM\s+DISTANCIA|SALTO\s+DISTANCIA/.test(raw))
      return findInCatalog(cat, s => /salto-distancia|salto-em-distancia/.test(s));
    if (/\bSALTO\b.*\bALTURA\b|SALTO\s+EM\s+ALTURA|SALTO\s+ALTURA/.test(raw))
      return findInCatalog(cat, s => /salto-altura|salto-em-altura/.test(s));
    if (/\bSALTO\b.*\bTRIPLO\b|SALTO\s+TRIPLO/.test(raw))
      return findInCatalog(cat, s => /salto-triplo/.test(s));

    // 3) Barreiras / marcha — se existir slug específico use; senão fallback
    //    determinístico p/ distância de corrida mais próxima (catálogo JERS
    //    não possui slugs de barreira/marcha — mapeia 110→100, 80→75, etc.)
    if (/BARREIRAS?|HURDLES?/.test(raw)) {
      const m = raw.match(/(\d{2,4})/);
      const exactBarreira = findInCatalog(cat, s => /barreira|hurdle/.test(s));
      if (exactBarreira && m) {
        const dist = m[1];
        const distSpecific = findInCatalog(cat, s => new RegExp(`-${dist}m?-.*barreira|barreira.*${dist}`).test(s));
        if (distSpecific) return distSpecific;
      }
      if (exactBarreira) return exactBarreira;
      // Fallback: barreira é prova de velocidade — mapeia p/ corrida mais próxima
      if (m) {
        const target = Number(m[1]);
        const distances = cat
          .map(c => {
            const mm = c.slug.match(/atletismo-(\d{2,4})m-/);
            return mm ? { c, d: Number(mm[1]) } : null;
          })
          .filter((x): x is { c: CatalogEvent; d: number } => x !== null);
        if (distances.length > 0) {
          distances.sort((a, b) => Math.abs(a.d - target) - Math.abs(b.d - target));
          return distances[0].c;
        }
      }
    }
    if (/MARCHA|WALK/.test(raw)) {
      const exactMarcha = findInCatalog(cat, s => /marcha|walk/.test(s));
      if (exactMarcha) return exactMarcha;
      // Fallback: marcha atlética é prova de longa distância → mapeia p/ maior corrida
      const distances = cat
        .map(c => {
          const mm = c.slug.match(/atletismo-(\d{2,4})m-/);
          return mm ? { c, d: Number(mm[1]) } : null;
        })
        .filter((x): x is { c: CatalogEvent; d: number } => x !== null);
      if (distances.length > 0) {
        distances.sort((a, b) => b.d - a.d);
        return distances[0].c;
      }
    }

    // 4) Revezamento NxDistancia
    const relayMatch = raw.match(/(?:REVEZAMENTO|REV)\s*(\d)\s*X\s*(\d{2,3})|(\d)\s*X\s*(\d{2,3})/);
    if (relayMatch || /REVEZAMENTO|REV\b/.test(raw)) {
      const n = relayMatch?.[1] ?? relayMatch?.[3];
      const d = relayMatch?.[2] ?? relayMatch?.[4];
      if (n && d) {
        const exact = findInCatalog(cat, s => new RegExp(`rev[-_]?${n}x${d}`).test(s));
        if (exact) return exact;
      }
      return findInCatalog(cat, s => /rev/.test(s));
    }

    // 5) Corrida por distância — pega o número e tenta casar com -<dist>m-
    const distMatch = raw.match(/(\d{2,4})\s*(METROS?|M)?\b/);
    if (distMatch) {
      const dist = distMatch[1];
      // Match exato
      const exact = findInCatalog(cat, s => new RegExp(`-${dist}m?-`).test(s) || new RegExp(`atletismo-${dist}m?-`).test(s));
      if (exact) return exact;
      // Match aproximado: 80→75, 150→100, 800→800, 2000→1500/3000 (pega o mais próximo)
      const distances = cat
        .map(c => {
          const m = c.slug.match(/atletismo-(\d{2,4})m-/);
          return m ? { c, d: Number(m[1]) } : null;
        })
        .filter((x): x is { c: CatalogEvent; d: number } => x !== null);
      if (distances.length > 0) {
        const target = Number(dist);
        distances.sort((a, b) => Math.abs(a.d - target) - Math.abs(b.d - target));
        return distances[0].c;
      }
    }
    return null;
  },

  // ── NATAÇÃO: distância + estilo ─────────────────────────────────
  (raw, cat) => {
    if (!cat.some(c => /natacao/.test(c.slug))) return null;

    // Estilo
    let style: string | null = null;
    if (/\bBORBOLETA\b|BUTTERFLY|\bFLY\b/.test(raw)) style = "borboleta";
    else if (/\bCOSTAS\b|\bBACK\b/.test(raw)) style = "costas";
    else if (/\bPEITO\b|\bBREAST\b/.test(raw)) style = "peito";
    else if (/\bMEDLEY\b|\bMEDLEI\b|MEDLEY\s+INDIVIDUAL/.test(raw)) style = "medley";
    else if (/\bLIVRE\b|\bLIVRES\b|\bFREE\b/.test(raw)) style = "livre";

    // Revezamento
    const relayMatch = raw.match(/(?:REVEZAMENTO|REV)\s*(\d)\s*X\s*(\d{2,3})/);
    if (relayMatch || /REVEZAMENTO|\bREV\b/.test(raw)) {
      const n = relayMatch?.[1] ?? "4";
      const d = relayMatch?.[2];
      if (d && style) {
        const exact = findInCatalog(cat, s => new RegExp(`rev-?${n}x${d}-${style}`).test(s));
        if (exact) return exact;
      }
      return findInCatalog(cat, s => /rev/.test(s) && (!style || s.includes(style)));
    }

    // Distância
    const distMatch = raw.match(/(\d{2,4})\s*(METROS?|M)?\b/);
    if (distMatch && style) {
      const dist = distMatch[1];
      const exact = findInCatalog(cat, s => new RegExp(`natacao-${dist}-${style}`).test(s));
      if (exact) return exact;
      // Fallback: distância mais próxima dentro do mesmo estilo
      const same = cat
        .map(c => {
          const m = c.slug.match(new RegExp(`natacao-(\\d{2,4})-${style}`));
          return m ? { c, d: Number(m[1]) } : null;
        })
        .filter((x): x is { c: CatalogEvent; d: number } => x !== null);
      if (same.length > 0) {
        const target = Number(dist);
        same.sort((a, b) => Math.abs(a.d - target) - Math.abs(b.d - target));
        return same[0].c;
      }
    }
    if (distMatch && !style) {
      // Sem estilo: assume LIVRE
      const dist = distMatch[1];
      const exact = findInCatalog(cat, s => new RegExp(`natacao-${dist}-livre`).test(s));
      if (exact) return exact;
    }
    if (style && !distMatch) {
      return findInCatalog(cat, s => s.includes(`-${style}`));
    }
    return null;
  },

  // ── TÊNIS DE MESA: INDIVIDUAL/SIMPLES vs DUPLAS vs EQUIPE ────────
  (raw, cat) => {
    if (!cat.some(c => /tenis-de-mesa/.test(c.slug))) return null;
    if (/DUPLAS?|DOUBLES/.test(raw)) return findInCatalog(cat, s => /dupla/.test(s));
    if (/EQUIPES?|TEAM/.test(raw)) return findInCatalog(cat, s => /equipe/.test(s));
    if (/INDIVIDUAL|SIMPLES|SINGLES?|SOLO/.test(raw))
      return findInCatalog(cat, s => /individual|simples|singles/.test(s));
    return null;
  },

  // ── BADMINTON: SIMPLES / DUPLAS (mesmo gênero) / DUPLAS MISTAS ───
  (raw, cat) => {
    if (!cat.some(c => /badminton/.test(c.slug))) return null;
    const isMista = /MIST(A|AS|O|OS)|MIXED/.test(raw);
    if (/DUPLAS?|DOUBLES/.test(raw)) {
      if (isMista) return findInCatalog(cat, s => /dupla.*mist|mistas|misto/.test(s));
      // Duplas sem "MISTA" → preferir duplas-{fem|masc} (o filtro de gênero
      // já reduziu o catálogo, então a primeira que casa "dupla" e NÃO é mista serve)
      return findInCatalog(cat, s => /dupla/.test(s) && !/mist/.test(s))
        ?? findInCatalog(cat, s => /dupla/.test(s));
    }
    if (/SIMPLES|SINGLES?|INDIVIDUAL/.test(raw))
      return findInCatalog(cat, s => /simples|singles|individual/.test(s));
    return null;
  },

  // ── GINÁSTICA RÍTMICA: aparelho explícito ou DEFAULT (arco) ──────
  (raw, cat) => {
    if (!cat.some(c => /ginastica-ritmica/.test(c.slug))) return null;
    if (/\bMACAS?\b|\bMAÇAS?\b|\bCLUBS?\b/.test(raw)) return findInCatalog(cat, s => /macas|macas/.test(s) || /maca/.test(s));
    if (/\bARCO\b|\bHOOP\b/.test(raw)) return findInCatalog(cat, s => /arco/.test(s));
    if (/\bFITA\b|\bRIBBON\b/.test(raw)) return findInCatalog(cat, s => /fita/.test(s));
    if (/\bBOLA\b|\bBALL\b/.test(raw)) return findInCatalog(cat, s => /bola/.test(s));
    if (/\bCORDA\b|\bROPE\b/.test(raw)) return findInCatalog(cat, s => /corda/.test(s));
    // Sem aparelho explícito ("GINASTICA RITMICA 12-13 FEMININO") → default ARCO
    return findInCatalog(cat, s => /arco/.test(s)) ?? cat[0];
  },

  // ── TIRO COM ARCO: RECURVO / COMPOSTO ────────────────────────────
  (raw, cat) => {
    if (!cat.some(c => /tiro-com-arco/.test(c.slug))) return null;
    if (/COMPOSTO|COMPOUND/.test(raw)) return findInCatalog(cat, s => /composto|compound/.test(s));
    if (/RECURVO|RECURVE/.test(raw)) return findInCatalog(cat, s => /recurvo|recurve/.test(s));
    return null;
  },
];

/**
 * Filtro por gênero embutido no slug (-fem-, -masc-, -male, -female).
 */
function filterByEmbeddedGender(catalog: CatalogEvent[], rawText: string): CatalogEvent[] {
  const t = norm(rawText);
  const isFemale = /\b(FEMININO|FEMININA|FEM)\b/.test(t);
  const isMale = /\b(MASCULINO|MASCULINA|MASC)\b/.test(t);
  if (!isFemale && !isMale) return catalog;

  // Marcadores no slug que indicam gênero específico
  const femMarker = /(^|-)(fem|feminino|female)(-|$)/i;
  const mascMarker = /(^|-)(masc|masculino|male)(-|$)/i;

  const hasEmbedded = catalog.some(c => femMarker.test(c.slug) || mascMarker.test(c.slug));
  if (!hasEmbedded) return catalog;

  const filtered = catalog.filter(c => {
    const hasFem = femMarker.test(c.slug);
    const hasMasc = mascMarker.test(c.slug);
    if (!hasFem && !hasMasc) return true;
    if (isFemale && hasFem && !hasMasc) return true;
    if (isMale && hasMasc && !hasFem) return true;
    return false;
  });
  return filtered.length > 0 ? filtered : catalog;
}

/**
 * Resolve qual sport_event do catálogo melhor casa com o texto bruto.
 */
export function matchEventInCatalog(rawText: string, catalog: CatalogEvent[]): MatchResult {
  const reasons: string[] = [];
  if (catalog.length === 0) {
    return { event_id: null, event_slug: null, score: 0, confidence: "low", reasons: ["catálogo vazio"], candidates: [] };
  }
  if (catalog.length === 1) {
    return {
      event_id: catalog[0].id, event_slug: catalog[0].slug, score: 999, confidence: "high",
      reasons: ["única prova no catálogo"],
      candidates: [{ id: catalog[0].id, slug: catalog[0].slug, score: 999 }],
    };
  }

  // 1) Filtro por gênero embutido
  const filtered = filterByEmbeddedGender(catalog, rawText);
  if (filtered.length < catalog.length) {
    reasons.push(`pré-filtro por gênero embutido: ${catalog.length} → ${filtered.length}`);
  }
  if (filtered.length === 1) {
    return {
      event_id: filtered[0].id, event_slug: filtered[0].slug, score: 998, confidence: "high",
      reasons: [...reasons, "única prova após filtro de gênero"],
      candidates: [{ id: filtered[0].id, slug: filtered[0].slug, score: 998 }],
    };
  }

  // 2) Regras determinísticas
  const rawNorm = applySynonyms(norm(rawText));
  for (const rule of RULES) {
    const hit = rule(rawNorm, filtered);
    if (hit) {
      reasons.push(`regra determinística: ${hit.slug}`);
      return {
        event_id: hit.id, event_slug: hit.slug, score: 100, confidence: "high",
        reasons,
        candidates: [{ id: hit.id, slug: hit.slug, score: 100 }],
      };
    }
  }

  // 3) Scoring genérico (fallback)
  const rawTokens = tokenize(rawText);
  reasons.push(`tokens raw: [${rawTokens.join(", ")}]`);

  const scored = filtered.map(c => {
    const slugClean = c.slug.replace(/-(jers|nat|tm|gr|jerpa|wrestling|judo)-.*$/, "");
    const slugTokens = tokenize(slugClean.replace(/^[a-z-]+?-/, ""));
    const labelTokens = tokenize(c.prova_label ?? c.name);
    const candTokens = [...new Set([...labelTokens, ...slugTokens])];
    const candSet = new Set(candTokens);
    const rawSet = new Set(rawTokens);
    let score = 0;
    for (const t of rawTokens) {
      if (candSet.has(t)) {
        if (/^\d/.test(t)) score += 3;
        else score += 1;
      }
    }
    for (const t of candTokens) {
      if (!rawSet.has(t) && /^\d/.test(t)) score -= 1;
    }
    return { id: c.id, slug: c.slug, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];

  let confidence: "high" | "medium" | "low" = "low";
  if (top.score - second.score >= 3) confidence = "high";
  else if (top.score > second.score) confidence = "medium";

  reasons.push(`scoring fallback — top: ${top.slug} (${top.score}) vs ${second.slug} (${second.score})`);

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

export function extractProvaLabel(fullName: string): string {
  const parts = fullName.split(/—|–|-{2,}/);
  if (parts.length >= 2) {
    const middle = parts.slice(1, parts.length > 2 ? -1 : parts.length).join(" ");
    return middle.trim();
  }
  return fullName;
}

// ─── Resolução de modalidade (sport) ───────────────────────────────

interface SportAlias { sport: string; alias: string; }

const SPORT_ALIASES: SportAlias[] = [
  ...["BASQUETE","BASQUETEBOL","BASKETBALL","BASKET"].map(a=>({sport:"basquete",alias:a})),
  ...["FUTSAL","FUTEBOL DE SALAO","FUTSAL FEMININO","FUTSAL MASCULINO"].map(a=>({sport:"futsal",alias:a})),
  ...["FUTEBOL","FUTEBOL DE CAMPO","SOCCER","FOOTBALL"].map(a=>({sport:"futebol",alias:a})),
  ...["HANDEBOL","HANDBALL"].map(a=>({sport:"handebol",alias:a})),
  ...["VOLEI","VOLEIBOL","VOLLEYBALL","VOLLEY"].map(a=>({sport:"volei",alias:a})),
  ...["VOLEI DE PRAIA","VOLEIBOL DE PRAIA","BEACH VOLLEY","VOLEI PRAIA"].map(a=>({sport:"volei-de-praia",alias:a})),
  ...["JUDO"].map(a=>({sport:"judo",alias:a})),
  ...["KARATE","KARATÊ"].map(a=>({sport:"karate",alias:a})),
  ...["TAEKWONDO","TAE KWON DO","TKD"].map(a=>({sport:"taekwondo",alias:a})),
  ...["WRESTLING","LUTA OLIMPICA","LUTA"].map(a=>({sport:"wrestling",alias:a})),
  ...["BADMINTON"].map(a=>({sport:"badminton",alias:a})),
  ...["PARABADMINTON","PARA BADMINTON","BADMINTON PARALIMPICO"].map(a=>({sport:"parabadminton",alias:a})),
  ...["TENIS DE MESA","TM","PINGUE-PONGUE","PINGUE PONGUE","TABLE TENNIS"].map(a=>({sport:"tenis-de-mesa",alias:a})),
  ...["TENIS DE MESA PARALIMPICO","TM PARALIMPICO","PARA TENIS DE MESA"].map(a=>({sport:"tenis-de-mesa-paralimpico",alias:a})),
  ...["TIRO COM ARCO","TIRO ARCO","ARCHERY"].map(a=>({sport:"tiro-com-arco",alias:a})),
  ...["XADREZ","CHESS"].map(a=>({sport:"xadrez",alias:a})),
  ...["GINASTICA RITMICA","GINASTICA RITIMICA","GR","RHYTHMIC"].map(a=>({sport:"ginastica-ritmica",alias:a})),
  ...["ATLETISMO","ATHLETICS"].map(a=>({sport:"atletismo",alias:a})),
  ...["ATLETISMO PARALIMPICO","ATLETISMO PARA","PARA ATLETISMO"].map(a=>({sport:"atletismo-paralimpico",alias:a})),
  ...["NATACAO","SWIMMING"].map(a=>({sport:"natacao",alias:a})),
  ...["NATACAO PARALIMPICA","PARA NATACAO"].map(a=>({sport:"natacao-paralimpica",alias:a})),
  ...["AGUAS ABERTAS","OPEN WATER","MARATONA AQUATICA"].map(a=>({sport:"aguas-abertas",alias:a})),
  ...["CICLISMO","CYCLING","BIKE"].map(a=>({sport:"ciclismo",alias:a})),
  ...["BOCHA","BOCHA PARALIMPICA","BOCCIA"].map(a=>({sport:"bocha-paralimpica",alias:a})),
];

export function resolveSport(modalidadeRaw: string, provaRaw: string, competicaoRaw: string): { slug: string | null; reason: string } {
  const m = norm(modalidadeRaw);
  const p = norm(provaRaw);
  const c = norm(competicaoRaw);
  const isPara = /PARALIMPIC|PARA[\s-]/.test(`${m} ${p} ${c}`);

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
  if (ageBand === "12-14") push("jers-12-14");
  if (ageBand === "15-17" || ageBand === "17" || ageBand === "16-17") push("jers-15-17");
  if (ageBand === "11-14") push("jerpa-11-14");
  return candidates;
}

// ─── Função principal exposta (compatibilidade) ────────────────────

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

export function smartMatch(input: SmartMatchInput): SmartMatchOutput & {
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
    prova_slug: null,
    confidence: "low",
    prova_candidates: [],
  };
}
