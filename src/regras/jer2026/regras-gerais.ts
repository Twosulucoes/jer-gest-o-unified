import type { RegrasGerais } from "./types";

/**
 * Regras gerais e operacionais (seções 1, 10, 11, 12, 17 do regulamento).
 */
export const REGRAS_GERAIS_JER2026: RegrasGerais = {
  evento: {
    nome_oficial: "53º Jogos Escolares de Roraima (JER's)",
    paralimpico: "1º Jogos Escolares Paralímpicos de Roraima (JERPA)",
    organizador: "IDJUV-RR",
    parceiro_principal: "SEED-RR",
    ano: 2026,
    abertura_fase_final: "2026-07-05",
    sistema_inscricao: "https://sigecom.mms.inf.br/login",
  },
  inscricoes: {
    jers_inicio: "2026-03-16",
    jers_fim: "2026-03-26",
    jerpa_inicio: "2026-04-01",
    jerpa_fim: "2026-04-20",
    max_modalidades_individuais_por_atleta: 2,
    max_modalidade_coletiva_por_atleta: 1,
    max_modalidade_jerpa_por_atleta: 1,
  },
  substituicoes: {
    custo_fora_prazo_kg_alimento: 3,
    max_substituicoes_coletivas_por_modalidade_por_genero: 3,
    permitidas_apos_reuniao_tecnica: true,
    atletismo_limite_percentual_por_sexo_categoria: 50,
  },
  wo: {
    minutos_tolerancia_inicio: 15,
    minutos_recusa_reinicio: 5,
    excecao_transporte_oficial: true,
  },
  protestos: {
    prazo_minutos_apos_termino: 60,
    onus_da_prova: "reclamante",
  },
  credenciamento: {
    pessoal_e_intransferivel: true,
    dupla_funcao_proibida: true,
    segunda_via_kg_alimento: 3,
    segunda_via_horas_emissao: 3,
  },
  pontuacao_geral: [10, 8, 6, 5, 4, 3, 2, 1],
  desempate_geral: [
    "Maior número de medalhas de ouro",
    "Maior número de medalhas de prata",
    "Maior número de medalhas de bronze",
    "Melhor desempenho nas modalidades coletivas (total de pontos nelas)",
  ],
  selecao_estadual_coletivas_15_17: {
    par: { campea: 50, seletiva: 50 },
    impar: { campea: 40, seletiva: 60 },
  },
};
