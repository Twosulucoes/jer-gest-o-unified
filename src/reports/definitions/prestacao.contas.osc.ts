import type { ReportDefinition } from '../core/types';

export const prestacaoContasOscReport: ReportDefinition = {
  id: 'prestacao-contas-osc',
  name: 'Prestação de Contas (OSC)',
  description: 'Relatório formal consolidado para parceiros institucionais e órgãos de controle.',
  scope: 'event',
  formats: ['pdf', 'excel'],
  filters: [{ key: 'event_id', label: 'Evento', type: 'uuid', required: true }],
  columns: [],
  datasource: { type: 'custom', customLoader: async () => [] },
  layout: { orientation: 'portrait', showLogo: true, showPageNumbers: true },
  permissions: { roles: ['admin', 'secretaria'] },
};
