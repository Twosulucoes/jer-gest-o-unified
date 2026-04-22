import type { ReportDefinition } from '../core/types';

/**
 * Definição para o relatório de Boletim Informativo.
 * Compilado de informações gerais do evento para distribuição às delegações.
 */
export const boletimInformativoReport: ReportDefinition = {
  id: 'boletim-informativo',
  name: 'Boletim Informativo',
  description: 'Informativo geral com avisos, programação e resultados consolidados do dia.',
  scope: 'event',
  formats: ['pdf'],
  filters: [
    { key: 'event_id', label: 'Evento', type: 'uuid', required: true },
    { key: 'date', label: 'Data de Referência', type: 'date', required: true },
    { key: 'include_results', label: 'Incluir Resultados', type: 'boolean', defaultValue: true },
    { key: 'include_schedule', label: 'Incluir Programação', type: 'boolean', defaultValue: true },
  ],
  columns: [
    { key: 'section', label: 'Seção', width: 30 },
    { key: 'content', label: 'Conteúdo Resumido', width: 70 },
  ],
  datasource: {
    type: 'custom',
    customLoader: async (_filters) => {
      // Mock data for boletim structure
      return [
        { section: 'Avisos Gerais', content: 'Informações sobre transporte e alimentação.' },
        { section: 'Programação', content: 'Próximas partidas e eventos sociais.' },
        { section: 'Resultados', content: 'Placar das partidas finalizadas no período.' },
      ];
    }
  },
  layout: { orientation: 'portrait', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria', 'coordenacao_tecnica'] },
};
