/**
 * Tipos da fonte de verdade JER 2026.
 * Todo o sistema (importação, motor de competição, UI de regras) deve consumir
 * estas estruturas via src/regras/jer2026/index.ts. Qualquer outra origem
 * (templateCatalog, import-catalog, hardcoded) está OBSOLETA.
 */

export enum Familia {
  SCORE = "score",
  SETS = "sets",
  TIME = "time",
  MARK = "mark",
  COMBAT = "combat",
  RANKING = "ranking",
}

export enum Formato {
  RR = "RR",
  SE = "SE",
  DE = "DE",
  GP_SE = "GP+SE",
  GP_DE = "GP+DE",
  SUICO = "SUICO",
  RANK = "RANK",
  ELIM_REP = "ELIM+REP",
}

export enum Naipe {
  MASCULINO = "Masculino",
  FEMININO = "Feminino",
  MISTO = "Misto",
}

export enum TipoModalidade {
  INDIVIDUAL = "individual",
  COLETIVA = "coletiva",
  INDIVIDUAL_PARALIMPICA = "individual_paralimpica",
}

export interface CategoriaEtaria {
  /** Slug canônico (ex.: "12-14", "jerpa-15-17", "nat-12-14"). */
  slug: string;
  nome: string;
  min_ano_nascimento: number;
  max_ano_nascimento: number;
  naipes: Naipe[];
  /** Modalidades específicas que usam esta categoria (vazio = padrão geral). */
  exclusiva_para?: string[];
}

export interface LimiteEscola {
  masculino: number | null;
  feminino: number | null;
  /** Mínimo de atletas para iniciar (coletivas / individuais com quórum). */
  minimo: number | null;
  observacao?: string;
}

export interface Desempate {
  ordem: number;
  criterio: string;
}

export interface Prova {
  /** Slug único dentro da modalidade (ex.: "100m-rasos", "kata", "kumite-50kg"). */
  slug: string;
  nome: string;
  /** Caso a prova tenha categorias de peso/classe específicas, lista aqui. */
  categorias_peso?: { categoria: string; naipe: Naipe; faixa: string }[];
}

export interface Modalidade {
  /** Slug canônico estável (chave primária da fonte de verdade). */
  slug: string;
  nome: string;
  tipo: TipoModalidade;
  familia: Familia;
  formato: Formato;
  confederacao?: string;
  /** Categorias etárias aplicáveis (slugs de CATEGORIAS_JER2026). */
  categorias: string[];
  /** Naipes disputados. */
  naipes: Naipe[];
  /** Provas técnicas (para individuais) ou ["Partida"] para coletivas. */
  provas: Prova[];
  /** Limite por escola por categoria. Chave = slug da categoria. */
  limites_por_escola: Record<string, LimiteEscola>;
  /** Cascata de desempate na fase de grupos. */
  desempates: Desempate[];
  /** Configuração de partida (duração, sets, placar W.O., etc.). Livre. */
  partida?: Record<string, unknown>;
  /** Pontuação na fase de grupos. */
  pontuacao_grupos?: Record<string, number>;
  /** Mínimo de inscritos para a categoria existir. */
  minimo_para_categoria?: number;
  /** Aliases reconhecidos na importação (variações de grafia). */
  aliases: string[];
  observacoes?: string[];
}

export interface RegrasGerais {
  evento: {
    nome_oficial: string;
    paralimpico: string;
    organizador: string;
    parceiro_principal: string;
    ano: number;
    abertura_fase_final: string;
    sistema_inscricao: string;
  };
  inscricoes: {
    jers_inicio: string;
    jers_fim: string;
    jerpa_inicio: string;
    jerpa_fim: string;
    max_modalidades_individuais_por_atleta: number;
    max_modalidade_coletiva_por_atleta: number;
    max_modalidade_jerpa_por_atleta: number;
  };
  substituicoes: {
    custo_fora_prazo_kg_alimento: number;
    max_substituicoes_coletivas_por_modalidade_por_genero: number;
    permitidas_apos_reuniao_tecnica: boolean;
    atletismo_limite_percentual_por_sexo_categoria: number;
  };
  wo: {
    minutos_tolerancia_inicio: number;
    minutos_recusa_reinicio: number;
    excecao_transporte_oficial: boolean;
  };
  protestos: {
    prazo_minutos_apos_termino: number;
    onus_da_prova: "reclamante" | "comissao";
  };
  credenciamento: {
    pessoal_e_intransferivel: boolean;
    dupla_funcao_proibida: boolean;
    segunda_via_kg_alimento: number;
    segunda_via_horas_emissao: number;
  };
  pontuacao_geral: number[]; // [10, 8, 6, 5, 4, 3, 2, 1]
  desempate_geral: string[];
  selecao_estadual_coletivas_15_17: {
    par: { campea: number; seletiva: number };
    impar: { campea: number; seletiva: number };
  };
}

export interface FonteDeVerdade {
  versao: string;
  gerado_em: string;
  regras_gerais: RegrasGerais;
  categorias: CategoriaEtaria[];
  modalidades: Modalidade[];
  /** Aliases globais (chaves de mapeamento usadas pela importação). */
  aliases_modalidades: Record<string, string>; // alias -> modalidade.slug
  aliases_categorias: Record<string, string>;  // alias -> categoria.slug
}
