import type { ReportDefinition } from '../core/types';

/**
 * Definição-âncora para presets do Quadro de Medalhas e Classificação Geral.
 * Página real: /admin/relatorios/quadro-medalhas
 * Filtros persistidos: scope (all|jer|jerpa), type (all|collective|individual), sportId.
 */
export const quadroMedalhasReport: ReportDefinition = {
  id: 'quadro-medalhas',
  name: 'Quadro de Medalhas e Classificação Geral',
  description: 'Ranking de medalhas (critério olímpico) e Campeonato Geral (Art. 108 / 111).',
  scope: 'event',
  formats: ['pdf', 'excel'],
  filters: [
    { key: 'event_id', label: 'Evento', type: 'uuid', required: true },
    { key: 'scope', label: 'Escopo', type: 'select', defaultValue: 'all', options: [
      { value: 'all', label: 'Geral' },
      { value: 'jer', label: 'Somente JER' },
      { value: 'jerpa', label: 'Somente JERPA' },
    ]},
    { key: 'type', label: 'Tipo', type: 'select', defaultValue: 'all', options: [
      { value: 'all', label: 'Todas as modalidades' },
      { value: 'collective', label: 'Somente Coletivas' },
      { value: 'individual', label: 'Somente Individuais' },
    ]},
    { key: 'sportId', label: 'Modalidade', type: 'select' },
  ],
  columns: [],
  datasource: { type: 'custom', customLoader: async () => [] },
  layout: { orientation: 'portrait', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria', 'coordenacao_tecnica'] },
};
