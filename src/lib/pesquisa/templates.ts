export interface PesquisaQuestion {
  key: string;
  label: string;
  dim: string;
}

export interface PesquisaTemplate {
  id: string;
  name: string;
  description: string;
  badge: string;
  questions: PesquisaQuestion[];
}

// Chaves fixas que existem nas colunas do banco — apenas os labels/dims mudam entre templates
export const PESQUISA_TEMPLATES: PesquisaTemplate[] = [
  {
    id: 'padrao_jer',
    name: 'Padrão JER',
    description: 'Modelo oficial dos Jogos Escolares de Roraima com 12 perguntas em 3 dimensões.',
    badge: 'Recomendado',
    questions: [
      { key: 'd1_organizacao',    label: 'Organização do evento',      dim: 'D1 — Operação' },
      { key: 'd1_infraestrutura', label: 'Infraestrutura',             dim: 'D1 — Operação' },
      { key: 'd1_alimentacao',    label: 'Alimentação',                dim: 'D1 — Operação' },
      { key: 'd1_seguranca',      label: 'Segurança',                  dim: 'D1 — Operação' },
      { key: 'd1_transporte',     label: 'Transporte',                 dim: 'D1 — Operação' },
      { key: 'd2_igualdade',      label: 'Igualdade de tratamento',    dim: 'D2 — Valores' },
      { key: 'd2_acessibilidade', label: 'Acessibilidade',             dim: 'D2 — Valores' },
      { key: 'd2_inclusao',       label: 'Inclusão',                   dim: 'D2 — Valores' },
      { key: 'd3_aprendizado',    label: 'Aprendizado',                dim: 'D3 — Impacto' },
      { key: 'd3_convivencia',    label: 'Convivência e amizade',      dim: 'D3 — Impacto' },
      { key: 'd3_cidadania',      label: 'Cidadania',                  dim: 'D3 — Impacto' },
      { key: 'd3_superacao',      label: 'Superação pessoal',          dim: 'D3 — Impacto' },
    ],
  },

  {
    id: 'osc_prestacao_contas',
    name: 'OSC — Prestação de Contas',
    description:
      'Focado nas obrigações contratuais da OSC executora. Indicado para relatórios oficiais e auditoria.',
    badge: 'OSC / Legal',
    questions: [
      { key: 'd1_organizacao',    label: 'Organização e coordenação dos serviços',        dim: 'D1 — Serviços Prestados' },
      { key: 'd1_alimentacao',    label: 'Qualidade da alimentação fornecida',             dim: 'D1 — Serviços Prestados' },
      { key: 'd1_transporte',     label: 'Conforto e pontualidade do transporte',          dim: 'D1 — Serviços Prestados' },
      { key: 'd1_seguranca',      label: 'Segurança e proteção dos participantes',         dim: 'D1 — Serviços Prestados' },
      { key: 'd1_infraestrutura', label: 'Infraestrutura e instalações oferecidas',        dim: 'D1 — Serviços Prestados' },
      { key: 'd2_igualdade',      label: 'Cumprimento das atividades previstas no contrato', dim: 'D2 — Conformidade OSC' },
      { key: 'd2_acessibilidade', label: 'Acessibilidade e atendimento às necessidades',   dim: 'D2 — Conformidade OSC' },
      { key: 'd2_inclusao',       label: 'Tratamento digno e igualitário',                 dim: 'D2 — Conformidade OSC' },
      { key: 'd3_aprendizado',    label: 'Contribuição ao desenvolvimento dos participantes', dim: 'D3 — Impacto Social' },
      { key: 'd3_convivencia',    label: 'Integração e convivência social',                dim: 'D3 — Impacto Social' },
      { key: 'd3_cidadania',      label: 'Formação cidadã e valores',                      dim: 'D3 — Impacto Social' },
      { key: 'd3_superacao',      label: 'Sentimento de valorização e pertencimento',      dim: 'D3 — Impacto Social' },
    ],
  },

  {
    id: 'avaliacao_etapa',
    name: 'Avaliação de Etapa',
    description:
      'Avalia a experiência específica de uma etapa da competição — logística, esporte e vivência.',
    badge: 'Por Etapa',
    questions: [
      { key: 'd1_organizacao',    label: 'Organização e pontualidade das atividades',  dim: 'D1 — Logística da Etapa' },
      { key: 'd1_alimentacao',    label: 'Refeições servidas durante a etapa',         dim: 'D1 — Logística da Etapa' },
      { key: 'd1_infraestrutura', label: 'Alojamento e estrutura física',              dim: 'D1 — Logística da Etapa' },
      { key: 'd1_seguranca',      label: 'Segurança nas instalações',                  dim: 'D1 — Logística da Etapa' },
      { key: 'd1_transporte',     label: 'Transporte para/durante a etapa',            dim: 'D1 — Logística da Etapa' },
      { key: 'd2_igualdade',      label: 'Igualdade de oportunidades na competição',   dim: 'D2 — Ambiente Esportivo' },
      { key: 'd2_acessibilidade', label: 'Acessibilidade e condições de participação', dim: 'D2 — Ambiente Esportivo' },
      { key: 'd2_inclusao',       label: 'Inclusão e respeito entre participantes',    dim: 'D2 — Ambiente Esportivo' },
      { key: 'd3_aprendizado',    label: 'Aprendizado esportivo e técnico',            dim: 'D3 — Experiência' },
      { key: 'd3_convivencia',    label: 'Amizades e convivência na etapa',            dim: 'D3 — Experiência' },
      { key: 'd3_cidadania',      label: 'Valores e cidadania no esporte',             dim: 'D3 — Experiência' },
      { key: 'd3_superacao',      label: 'Superação de limites pessoais',              dim: 'D3 — Experiência' },
    ],
  },

  {
    id: 'satisfacao_participante',
    name: 'Satisfação do Participante',
    description:
      'Perspectiva do atleta/aluno sobre a experiência geral nos Jogos. Linguagem acessível e direta.',
    badge: 'Participante',
    questions: [
      { key: 'd1_organizacao',    label: 'Como foi a organização do evento?',          dim: 'D1 — Minha Experiência' },
      { key: 'd1_infraestrutura', label: 'O espaço estava bom para o evento?',         dim: 'D1 — Minha Experiência' },
      { key: 'd1_alimentacao',    label: 'Como foi a comida oferecida?',               dim: 'D1 — Minha Experiência' },
      { key: 'd1_seguranca',      label: 'Me senti seguro(a) durante o evento?',       dim: 'D1 — Minha Experiência' },
      { key: 'd1_transporte',     label: 'O transporte foi adequado?',                 dim: 'D1 — Minha Experiência' },
      { key: 'd2_igualdade',      label: 'Todos foram tratados com igualdade?',        dim: 'D2 — Convivência' },
      { key: 'd2_acessibilidade', label: 'O evento foi acessível para todos?',         dim: 'D2 — Convivência' },
      { key: 'd2_inclusao',       label: 'Me senti incluído(a) e respeitado(a)?',      dim: 'D2 — Convivência' },
      { key: 'd3_aprendizado',    label: 'Aprendi coisas novas no evento?',            dim: 'D3 — O que Ficou' },
      { key: 'd3_convivencia',    label: 'Fiz novos amigos e vivi bons momentos?',     dim: 'D3 — O que Ficou' },
      { key: 'd3_cidadania',      label: 'O evento me ensinou valores importantes?',   dim: 'D3 — O que Ficou' },
      { key: 'd3_superacao',      label: 'Me senti capaz de superar desafios?',        dim: 'D3 — O que Ficou' },
    ],
  },
];

export const DEFAULT_TEMPLATE = PESQUISA_TEMPLATES[0];

export function getTemplateById(id: string): PesquisaTemplate | undefined {
  return PESQUISA_TEMPLATES.find(t => t.id === id);
}
