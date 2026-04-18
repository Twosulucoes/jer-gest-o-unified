/**
 * Catálogo canônico para o modelo padrão de importação JER/JERPA.
 * 
 * Usado como FALLBACK quando o evento ainda não tem modalidades/categorias
 * cadastradas no banco. Quando houver dados reais, eles têm prioridade.
 * 
 * Baseado no Regulamento Geral 2026 dos Jogos Escolares de Roraima.
 */

export interface CatalogModalidade {
  nome: string;
  tipo: "individual" | "coletivo";
  provas: string[]; // Provas técnicas dentro da modalidade
}

/** Modalidades canônicas JER + provas oficiais. */
export const MODALIDADES_CATALOGO: CatalogModalidade[] = [
  // ── Coletivos ──
  { nome: "Futsal", tipo: "coletivo", provas: ["Partida"] },
  { nome: "Basquete", tipo: "coletivo", provas: ["Partida"] },
  { nome: "Vôlei", tipo: "coletivo", provas: ["Partida"] },
  { nome: "Vôlei de Praia", tipo: "coletivo", provas: ["Partida"] },
  { nome: "Handebol", tipo: "coletivo", provas: ["Partida"] },
  { nome: "Futebol de Campo", tipo: "coletivo", provas: ["Partida"] },

  // ── Individuais (atletismo) ──
  {
    nome: "Atletismo",
    tipo: "individual",
    provas: [
      "75m rasos", "100m rasos", "200m rasos", "400m rasos",
      "800m rasos", "1500m rasos", "3000m rasos",
      "Revezamento 4x75m", "Revezamento 4x100m",
      "Salto em distância", "Salto em altura", "Salto triplo",
      "Arremesso de peso", "Lançamento de disco",
    ],
  },

  // ── Natação ──
  {
    nome: "Natação",
    tipo: "individual",
    provas: [
      "50m livre", "100m livre", "200m livre", "400m livre",
      "50m costas", "100m costas",
      "50m peito", "100m peito",
      "50m borboleta", "100m borboleta",
      "Revezamento 4x50m livre",
    ],
  },

  // ── Combate ──
  { nome: "Judô", tipo: "individual", provas: ["Combate"] },
  { nome: "Karatê", tipo: "individual", provas: ["Kumite", "Kata"] },
  { nome: "Taekwondo", tipo: "individual", provas: ["Combate"] },
  { nome: "Wrestling", tipo: "individual", provas: ["Combate"] },

  // ── Raquetes / mesa ──
  { nome: "Tênis de Mesa", tipo: "individual", provas: ["Simples", "Duplas", "Equipes"] },
  { nome: "Badminton", tipo: "individual", provas: ["Simples", "Duplas"] },
  { nome: "Xadrez", tipo: "individual", provas: ["Individual", "Equipes"] },

  // ── Ciclismo / outros ──
  { nome: "Ciclismo", tipo: "individual", provas: ["Estrada", "Contrarrelógio"] },
];

/** Categorias por idade (faixa etária do JER). */
export const CATEGORIAS_CATALOGO = [
  { nome: "Sub-12", idade_min: 8, idade_max: 12 },
  { nome: "Sub-14", idade_min: 12, idade_max: 14 },
  { nome: "Sub-17", idade_min: 15, idade_max: 17 },
  { nome: "Sub-20", idade_min: 18, idade_max: 20 },
  { nome: "Livre", idade_min: 0, idade_max: 99 },
];

/** Naipes (gender_scope). */
export const NAIPES = ["Masculino", "Feminino", "Misto"] as const;

/** Tipos de usuário aceitos pelo importador. */
export const TIPOS_USUARIO = [
  "Atleta",
  "Técnico",
  "Chefe de Delegação",
  "Auxiliar",
  "Dirigente",
  "Médico",
  "Fisioterapeuta",
  "Massagista",
] as const;

/** Mapeamento label PT-BR → tipo do importador (matching já feito no edge function). */
export const TIPO_USUARIO_MAP: Record<string, string> = {
  "Atleta": "athlete",
  "Técnico": "coach",
  "Chefe de Delegação": "head_of_delegation",
  "Auxiliar": "staff",
  "Dirigente": "staff",
  "Médico": "staff",
  "Fisioterapeuta": "staff",
  "Massagista": "staff",
};

/** Status válidos de inscrição (o importador filtra "deferida"/"aprovada"). */
export const STATUS_INSCRICAO = ["Deferida", "Aprovada", "Indeferida", "Pendente"] as const;

/** Sexo / gênero. */
export const SEXOS = ["Masculino", "Feminino"] as const;

/** PCD. */
export const PCD_VALORES = ["Não", "Sim - Física", "Sim - Visual", "Sim - Auditiva", "Sim - Intelectual"] as const;

/** Esfera (rede de ensino). */
export const ESFERAS = ["Estadual", "Municipal", "Federal", "Particular"] as const;
