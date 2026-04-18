// Retorna o "catálogo" de regras embutidas no importador SIGECOM.
// Espelha SPORT_ALIASES, SINGLE_CATEGORY_FALLBACK_WHITELIST, AGE_BAND_TO_CATEGORY,
// status aceitos e faixa de datas — para a tela /admin/importacao/catalogo
// auditar e cruzar com o catálogo real do evento.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPORT_ALIASES: Record<string, string> = {
  "JUDO": "judo", "JUDÔ": "judo",
  "KARATE": "karate", "KARATÊ": "karate",
  "TAEKWONDO": "taekwondo", "TAE KWON DO": "taekwondo",
  "WRESTLING": "wrestling", "LUTA OLIMPICA": "wrestling",
  "FUTSAL": "futsal", "FUTEBOL DE SALAO": "futsal",
  "FUTEBOL": "futebol", "FUTEBOL DE CAMPO": "futebol",
  "BASQUETE": "basquete", "BASQUETEBOL": "basquete",
  "VOLEI": "volei", "VOLEIBOL": "volei",
  "VOLEI DE PRAIA": "volei-de-praia", "VOLEIBOL DE PRAIA": "volei-de-praia",
  "HANDEBOL": "handebol",
  "TENIS DE MESA": "tenis-de-mesa",
  "BADMINTON": "badminton",
  "XADREZ": "xadrez",
  "ATLETISMO": "atletismo",
  "NATACAO": "natacao", "NATAÇÃO": "natacao",
  "CICLISMO": "ciclismo",
  "GINASTICA RITMICA": "ginastica-ritmica", "GINÁSTICA RÍTMICA": "ginastica-ritmica",
  "ATLETISMO PARALIMPICO": "atletismo-paralimpico", "ATLETISMO PARALÍMPICO": "atletismo-paralimpico",
  "NATACAO PARALIMPICA": "natacao-paralimpica", "NATAÇÃO PARALÍMPICA": "natacao-paralimpica",
  "BOCHA PARALIMPICA": "bocha-paralimpica", "BOCHA PARALÍMPICA": "bocha-paralimpica",
  "TENIS DE MESA PARALIMPICO": "tenis-de-mesa-paralimpico", "TÊNIS DE MESA PARALÍMPICO": "tenis-de-mesa-paralimpico",
  "PARABADMINTON": "parabadminton",
};

const SINGLE_CATEGORY_FALLBACK_WHITELIST = [
  "futebol", "futsal", "basquete", "volei", "volei-de-praia", "handebol",
  "xadrez", "badminton", "karate", "taekwondo", "wrestling",
];

const AGE_BAND_TO_CATEGORY = [
  { sportPattern: "paralimpic", ageBand: "11-14", categorySlug: "jerpa-11-14" },
  { sportPattern: "paralimpic", ageBand: "15-17", categorySlug: "jerpa-15-17" },
  { sportPattern: "parabadminton", ageBand: "11-14", categorySlug: "jerpa-11-14" },
  { sportPattern: "parabadminton", ageBand: "15-17", categorySlug: "jerpa-15-17" },
  { sportPattern: "ginastica-ritmica", ageBand: "11-12", categorySlug: "gr-11-12" },
  { sportPattern: "ginastica-ritmica", ageBand: "13-15", categorySlug: "gr-13-15" },
  { sportPattern: "natacao|judo", ageBand: "12-14", categorySlug: "nat-judo-wrest-12-14" },
  { sportPattern: "natacao|judo", ageBand: "14-16", categorySlug: "nat-judo-wrest-14-16" },
  { sportPattern: "natacao|judo", ageBand: "17", categorySlug: "nat-judo-wrest-17" },
  { sportPattern: "tenis-de-mesa", ageBand: "12-14", categorySlug: "tm-12-14" },
  { sportPattern: "tenis-de-mesa", ageBand: "14-15", categorySlug: "tm-14-15" },
  { sportPattern: "tenis-de-mesa", ageBand: "16-17", categorySlug: "tm-16-17" },
  { sportPattern: "*", ageBand: "12-14", categorySlug: "jers-12-14" },
  { sportPattern: "*", ageBand: "15-17", categorySlug: "jers-15-17" },
];

const ACCEPTED_STATUS = ["Deferida", "Aprovada", "Homologada", "Confirmada"];
const ACCEPTED_PARTICIPANT_TYPES = {
  "Atleta": "athlete",
  "Técnico": "coach",
  "Chefe de Delegação": "head_of_delegation",
  "Auxiliar": "staff",
  "Dirigente": "staff",
  "Médico": "staff",
  "Fisioterapeuta": "staff",
  "Massagista": "staff",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const aliasGrouped: Record<string, string[]> = {};
  for (const [alias, slug] of Object.entries(SPORT_ALIASES)) {
    if (!aliasGrouped[slug]) aliasGrouped[slug] = [];
    aliasGrouped[slug].push(alias);
  }

  return new Response(JSON.stringify({
    version: "phase-1",
    sport_aliases: aliasGrouped,
    single_category_fallback_whitelist: SINGLE_CATEGORY_FALLBACK_WHITELIST,
    age_band_to_category: AGE_BAND_TO_CATEGORY,
    accepted_status: ACCEPTED_STATUS,
    accepted_participant_types: ACCEPTED_PARTICIPANT_TYPES,
    accepted_birth_year_range: { min: 1915, max: new Date().getUTCFullYear() },
    notes: [
      "Status são normalizados (sem acento, case-insensitive) antes da comparação.",
      "Modalidade é resolvida por: 1) alias direto, 2) match exato de slug, 3) substring no catálogo do evento.",
      "Categoria é resolvida por: 1) faixa etária explícita no texto, 2) desempate por birth_date, 3) fallback se modalidade está na whitelist e há só 1 categoria no catálogo.",
      "CPF ainda é obrigatório nesta fase (Fase 2 introduzirá fingerprint nome+nascimento+escola).",
    ],
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
